import { allowedOrigin, corsHeaders, json, preflight } from "@/lib/http/cors";
import { getRuntimeConfig } from "@/lib/tracking/runtime-config";

/*
 * GET /api/config/public — o que o /t.js precisa saber. Só IDs PÚBLICOS
 * (ids de pixel e measurement ids já aparecem no HTML de qualquer site).
 * Só responde para origens autorizadas.
 */
export function OPTIONS(request: Request) {
  return preflight(request, "GET, OPTIONS");
}

export async function GET(request: Request) {
  const origin = await allowedOrigin(request);
  if (!origin) return json({ error: "origem não autorizada" }, 403);
  const config = await getRuntimeConfig();
  return json(
    {
      pixels: config.pixels.map((p) => p.pixelId),
      ga4: config.ga4.map((g) => g.measurementId),
      checkoutDomains: config.checkoutDomains,
      currency: config.currency,
    },
    200,
    { ...corsHeaders(origin, "GET, OPTIONS"), "Cache-Control": "public, max-age=60" },
  );
}
