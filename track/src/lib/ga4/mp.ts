import { createHash } from "node:crypto";
import { GA4_MP_COLLECT_URL, GA4_MP_DEBUG_URL } from "./endpoints";

/*
 * GA4 Measurement Protocol — usado SÓ para o evento que nasce fora do navegador
 * (compra/reembolso do webhook). Os eventos do site vão pela gtag.
 * Doc: https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */

export interface MpItem {
	item_id: string;
	item_name: string;
	price: number;
	quantity: number;
	item_category?: string;
}
export interface MpBody {
	client_id: string;
	timestamp_micros?: number;
	consent: { ad_user_data: "GRANTED"; ad_personalization: "GRANTED" };
	user_location?: { city?: string; region_id?: string; country_id: string };
	ip_override?: string;
	device?: { category: "mobile" | "tablet" | "desktop" };
	events: { name: string; params: Record<string, unknown> }[];
}

/** Visita ligada à venda: de onde e em que aparelho (o MP não deduz isso do client_id na web). */
export interface MpVisit {
	city?: string | null;
	/** UF no Brasil (geo do painel) */
	region?: string | null;
	country?: string | null;
	ip?: string | null;
	userAgent?: string | null;
}

export function deviceCategory(userAgent: string): "mobile" | "tablet" | "desktop" {
	if (/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) return "tablet";
	if (/Mobi|iPhone|iPod|Android/i.test(userAgent)) return "mobile";
	return "desktop";
}

/**
 * Sem localização/dispositivo, a compra do MP aparece no GA4 como "(not set)". user_location
 * (ISO 3166: country_id "BR", region_id "BR-SP") tem precedência; sem geo, ip_override.
 */
export function visitContext(
	visit: MpVisit | null | undefined,
): Pick<MpBody, "user_location" | "ip_override" | "device"> {
	if (!visit) return {};
	const country = visit.country?.trim().toUpperCase();
	const region = visit.region?.trim().toUpperCase();
	const out: Pick<MpBody, "user_location" | "ip_override" | "device"> = {};
	if (country && /^[A-Z]{2}$/.test(country)) {
		out.user_location = {
			country_id: country,
			...(visit.city ? { city: visit.city } : {}),
			...(region && /^[A-Z0-9]{1,3}$/.test(region) ? { region_id: `${country}-${region}` } : {}),
		};
	} else if (visit.ip) {
		out.ip_override = visit.ip;
	}
	if (visit.userAgent) out.device = { category: deviceCategory(visit.userAgent) };
	return out;
}

/** O MP aceita eventos de até 72 h atrás; usamos 71 h de margem. */
const MAX_BACKDATE_MS = 71 * 3600 * 1000;

/** client_id estável derivado do transaction_id, para vendas sem visitante (sem _ga). */
export function syntheticClientId(transactionId: string): string {
	const hex = createHash("sha256").update(`rastrewin:${transactionId}`).digest("hex");
	return `${Number.parseInt(hex.slice(0, 8), 16)}.${Number.parseInt(hex.slice(8, 16), 16)}`;
}

export function buildMpBody(input: {
	name: "purchase" | "refund";
	clientId: string | null;
	transactionId: string;
	sessionId?: string | null;
	occurredAt?: Date | null;
	value: number;
	currency: string;
	items?: MpItem[];
	visit?: MpVisit | null;
	debug?: boolean;
	now?: Date;
}): MpBody {
	const now = input.now ?? new Date();
	const ts =
		input.occurredAt && now.getTime() - input.occurredAt.getTime() < MAX_BACKDATE_MS
			? input.occurredAt
			: null;
	const params: Record<string, unknown> = {
		currency: input.currency,
		engagement_time_msec: 1,
		transaction_id: input.transactionId,
		value: input.value,
	};
	if (input.items?.length) params.items = input.items;
	if (input.sessionId) params.session_id = input.sessionId;
	if (input.debug) params.debug_mode = 1;
	return {
		client_id: input.clientId ?? syntheticClientId(input.transactionId),
		...(ts ? { timestamp_micros: ts.getTime() * 1000 } : {}),
		...visitContext(input.visit),
		// LGPD: o MP só é chamado para quem aceitou marketing no banner (ver deliver.ts).
		consent: { ad_personalization: "GRANTED", ad_user_data: "GRANTED" },
		events: [{ name: input.name, params }],
	};
}

export interface MpDelivery {
	ok: boolean;
	status: number;
	validationMessages?: unknown[];
	error?: string;
}

async function post(url: URL, body: MpBody) {
	return fetch(url, {
		body: JSON.stringify(body),
		cache: "no-store",
		headers: { "content-type": "application/json" },
		method: "POST",
		redirect: "error",
		signal: AbortSignal.timeout(10_000),
	});
}

/** Envia o mesmo corpo para cada propriedade GA4 ativa. Em modo debug, valida antes. */
export async function sendMp(
	accounts: { measurementId: string; apiSecret: string }[],
	body: MpBody,
	debug: boolean,
): Promise<Record<string, MpDelivery>> {
	const results = await Promise.all(
		accounts.map(async ({ measurementId, apiSecret }) => {
			const qs = (base: string) => {
				const url = new URL(base);
				url.searchParams.set("measurement_id", measurementId);
				url.searchParams.set("api_secret", apiSecret);
				return url;
			};
			try {
				let validationMessages: unknown[] | undefined;
				if (debug) {
					const v = await post(qs(GA4_MP_DEBUG_URL), body);
					validationMessages =
						((await v.json().catch(() => ({}))) as { validationMessages?: unknown[] })
							.validationMessages ?? [];
				}
				const r = await post(qs(GA4_MP_COLLECT_URL), body);
				const delivery: MpDelivery = {
					ok: r.ok,
					status: r.status,
					...(validationMessages ? { validationMessages } : {}),
				};
				return [measurementId, delivery] as const;
			} catch (error) {
				const timeout = error instanceof Error && error.name === "TimeoutError";
				return [
					measurementId,
					{ error: timeout ? "tempo esgotado" : "falha de rede", ok: false, status: 0 },
				] as const;
			}
		}),
	);
	return Object.fromEntries(results);
}
