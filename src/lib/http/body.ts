/** Lê o corpo como JSON com limite de tamanho (protege contra payloads gigantes). */
export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; data: unknown; raw: string } | { ok: false; status: 400 | 413 }> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return { ok: false, status: 413 };
  if (!request.body) return { ok: false, status: 400 };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return { ok: false, status: 413 };
    }
    chunks.push(value);
  }
  const raw = new TextDecoder().decode(Buffer.concat(chunks));
  try {
    return { ok: true, data: JSON.parse(raw), raw };
  } catch {
    return { ok: false, status: 400 };
  }
}
