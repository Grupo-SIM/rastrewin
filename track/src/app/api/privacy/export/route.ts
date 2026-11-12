import { safeErrorMessage } from "@/lib/errors";
import { json } from "@/lib/http/cors";
import { readSignedPrivacyRequest } from "@/lib/privacy/signed-request";
import { exportSubject } from "@/lib/privacy/subject";

/*
 * POST /api/privacy/export — ACESSO (LGPD art. 18, II): tudo o que o track guarda sobre a pessoa.
 * Só o backend chama (assinado), depois que a pessoa confirmou o email. Sem dados: listas vazias.
 */
export async function POST(request: Request) {
	const read = await readSignedPrivacyRequest(request, "export");
	if (!read.ok) return read.response;
	try {
		const data = await exportSubject(read.subject);
		return json(
			{ data: data ?? { consents: [], events: [], purchases: [], videos: [], visitors: [] }, ok: true },
			200,
		);
	} catch (error) {
		console.error(`[privacidade] falha no export: ${safeErrorMessage(error)}`);
		return json({ error: "falha ao exportar" }, 500);
	}
}
