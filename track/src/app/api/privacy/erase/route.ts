import { safeErrorMessage } from "@/lib/errors";
import { json } from "@/lib/http/cors";
import { readSignedPrivacyRequest } from "@/lib/privacy/signed-request";
import { eraseSubject } from "@/lib/privacy/subject";

/*
 * POST /api/privacy/erase — EXCLUSÃO (LGPD art. 18, VI): apaga/anonimiza os dados da pessoa no track.
 * Só o backend chama (assinado), depois que a pessoa confirmou o email. Idempotente: pedir de novo
 * só registra outra exclusão sem linhas.
 */
export async function POST(request: Request) {
	const read = await readSignedPrivacyRequest(request, "erase");
	if (!read.ok) return read.response;
	try {
		const result = await eraseSubject(read.subject);
		console.info("[privacidade] exclusão concluída", JSON.stringify(result));
		return json({ ok: true, result }, 200);
	} catch (error) {
		console.error(`[privacidade] falha na exclusão: ${safeErrorMessage(error)}`);
		return json({ error: "falha ao excluir" }, 500);
	}
}
