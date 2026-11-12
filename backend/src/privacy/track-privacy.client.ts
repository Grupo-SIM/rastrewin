import { signBody } from "../payments/simintpay";

const TIMEOUT_MS = 15_000;

export type TrackPrivacyResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Chamadas de privacidade ao track (acesso e exclusão), assinadas como o relay de vendas
 * (x-simintpay-signature com TRACK_WEBHOOK_SECRET). A rota sai do mesmo host de TRACK_WEBHOOK_URL.
 * O corpo leva a ação e a hora: o track recusa corpo de outra rota ou com mais de 5 min.
 */
export async function callTrackPrivacy<T>(
	action: "export" | "erase",
	subject: { email: string; phone: string | null },
): Promise<TrackPrivacyResult<T>> {
	const base = process.env.TRACK_WEBHOOK_URL?.trim();
	const secret = process.env.TRACK_WEBHOOK_SECRET?.trim();
	if (!base || !secret) return { error: "track não configurado", ok: false };
	const body = JSON.stringify({
		action,
		email: subject.email,
		phone: subject.phone,
		sent_at: new Date().toISOString(),
	});
	try {
		const res = await fetch(new URL(`/api/privacy/${action}`, base), {
			body,
			headers: { "content-type": "application/json", "x-simintpay-signature": signBody(body, secret) },
			method: "POST",
			redirect: "error",
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!res.ok) return { error: `HTTP ${res.status}`, ok: false };
		const json = (await res.json()) as { data?: T; result?: T };
		return { data: (json.data ?? json.result) as T, ok: true };
	} catch (error) {
		const code = (error as { cause?: { code?: unknown } })?.cause?.code;
		return {
			error: typeof code === "string" ? code : error instanceof Error ? error.name : "erro",
			ok: false,
		};
	}
}
