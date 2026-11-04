import { lookupGeo } from "@/lib/geo";
import { readJsonBody } from "@/lib/http/body";
import { clientIp, rateLimitKey } from "@/lib/http/client-ip";
import { allowedOrigin, corsHeaders, json, preflight } from "@/lib/http/cors";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { newTrckUserId } from "@/lib/tracking/ids";
import { identifySchema } from "@/lib/tracking/schemas";
import { upsertVisitor } from "@/lib/tracking/visitors";

/*
 * POST /api/identify — UPSERT do visitante (público, chamado pelo /t.js).
 * Valida origem (CORS), rate limit por IP, tamanho e formato. IP, user agent e geo vêm do SERVIDOR.
 */

const limiter = createRateLimiter({ perMinute: 30, burst: 15 });
const MAX_BYTES = 8 * 1024;

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  const origin = await allowedOrigin(request);
  if (!origin) return json({ error: "origem não autorizada" }, 403);
  const cors = corsHeaders(origin);

  if (!limiter.take(rateLimitKey(request.headers))) return json({ error: "muitas requisições" }, 429, cors);

  const body = await readJsonBody(request, MAX_BYTES);
  if (!body.ok) return json({ error: body.status === 413 ? "corpo grande demais" : "JSON inválido" }, body.status, cors);

  const parsed = identifySchema.safeParse(body.data);
  if (!parsed.success) return json({ error: "dados inválidos", fields: parsed.error.issues.map((i) => i.path.join(".")) }, 400, cors);
  const d = parsed.data;

  const ip = clientIp(request.headers);
  const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? null;
  const trckUserId = d.trck_user_id ?? newTrckUserId();

  await upsertVisitor({
    trckUserId,
    email: d.email,
    phone: d.phone,
    firstName: d.first_name,
    lastName: d.last_name,
    fbp: d.fbp,
    fbc: d.fbc,
    gaClientId: d.ga_client_id,
    gaSessionId: d.ga_session_id,
    utmSource: d.utm_source,
    utmMedium: d.utm_medium,
    utmCampaign: d.utm_campaign,
    utmTerm: d.utm_term,
    utmContent: d.utm_content,
    referrer: d.referrer,
    landingUrl: d.landing_url,
    ip,
    userAgent,
    geo: lookupGeo(ip),
    pixelId: d.pixel_id,
  });

  return json({ ok: true, trck_user_id: trckUserId }, 200, cors);
}
