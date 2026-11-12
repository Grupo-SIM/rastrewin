import { rateLimitKey } from "@/lib/http/client-ip";
import { allowedOrigin, corsHeaders, json, preflight } from "@/lib/http/cors";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { getRuntimeConfig } from "@/lib/tracking/runtime-config";

/*
 * GET /api/config/public — o que o /t.js precisa saber. Só IDs PÚBLICOS
 * (ids de pixel e measurement ids já aparecem no HTML de qualquer site).
 * Só responde para origens autorizadas, com limite por IP (uma chamada por página; o navegador guarda por 60 s).
 */

const limiter = createRateLimiter({ perMinute: 60, burst: 30 });
export function OPTIONS(request: Request) {
  return preflight(request, "GET, OPTIONS");
}

export async function GET(request: Request) {
  const origin = await allowedOrigin(request);
  if (!origin) return json({ error: "origem não autorizada" }, 403);
  if (!limiter.take(rateLimitKey(request.headers))) return json({ error: "muitas requisições" }, 429, corsHeaders(origin, "GET, OPTIONS"));
  const config = await getRuntimeConfig();
  return json(
    {
      pixels: config.pixels.map((p) => p.pixelId),
      ga4: config.ga4.map((g) => g.measurementId),
      checkoutDomains: config.checkoutDomains,
      currency: config.currency,
      // Banner de consentimento (LGPD): o t.js só ativa o marketing depois do aceite desta versão.
      consent: config.consent,
    },
    200,
    { ...corsHeaders(origin, "GET, OPTIONS"), "Cache-Control": "public, max-age=60" },
  );
}
