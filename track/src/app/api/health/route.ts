/** Healthcheck do container (Docker HEALTHCHECK). Não expõe nenhum dado. */
export function GET() {
  return Response.json({ ok: true });
}
