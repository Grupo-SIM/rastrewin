/**
 * Roda uma vez quando o servidor Next.js inicia (só no runtime Node.js, nunca durante o build):
 * - liga a redação dos logs (segredos do env nunca saem no stdout/stderr — ver src/lib/errors.ts);
 * - liga o reenvio automático das compras;
 * - liga a limpeza diária dos logs (03:15 de Brasília; ver src/lib/maintenance/retention.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { installLogRedaction } = await import("./lib/errors");
  installLogRedaction();
  if (process.env.NEXT_PHASE === "phase-production-build" || !process.env.DATABASE_URL) return;
  const { startSalesRetryLoop } = await import("./lib/sales/retry");
  startSalesRetryLoop();
  const { startRetentionLoop } = await import("./lib/maintenance/scheduler");
  startRetentionLoop();
}
