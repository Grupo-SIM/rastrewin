/**
 * Roda uma vez quando o servidor Next.js inicia.
 * Liga o reenvio automático das compras (só no runtime Node.js, nunca durante o build).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build" || !process.env.DATABASE_URL) return;
  const { startSalesRetryLoop } = await import("./lib/sales/retry");
  startSalesRetryLoop();
}
