import "server-only";
import {
	hashed,
	normCity,
	normCountry,
	normEmail,
	normName,
	normPhone,
	normState,
} from "@/lib/tracking/normalize";
import { graphPost, type GraphResult } from "./graph";

/*
 * Conversions API (Meta) — https://developers.facebook.com/docs/marketing-api/conversions-api
 * Hash SHA-256: em, ph, fn, ln, ct, st, country, external_id.
 * SEM hash: fbp, fbc, client_ip_address, client_user_agent (exigência da Meta).
 */

export interface CapiPerson {
	/** trck_user_id; ausente em vendas sem visitante ligado */
	externalId?: string | null;
	email?: string | null;
	/** hashes já calculados (ex.: vindos do banco) têm prioridade sobre o valor cru */
	emHash?: string | null;
	phone?: string | null;
	phHash?: string | null;
	firstName?: string | null;
	fnHash?: string | null;
	lastName?: string | null;
	lnHash?: string | null;
	city?: string | null;
	region?: string | null;
	country?: string | null;
	ip?: string | null;
	userAgent?: string | null;
	fbp?: string | null;
	fbc?: string | null;
}

export interface CapiCustomData {
	value?: number;
	currency?: string;
	content_ids?: string[];
	content_name?: string;
	content_type?: "product" | "product_group";
	num_items?: number;
	order_id?: string;
	contents?: { id: string; quantity: number; item_price?: number }[];
}

export interface CapiEvent {
	event_name: string;
	event_time: number;
	event_id: string;
	event_source_url?: string;
	/** "website" exige client_user_agent; sem visitante (venda não ligada) usamos "system_generated". */
	action_source: "website" | "system_generated";
	user_data: Record<string, string | string[]>;
	custom_data?: CapiCustomData;
}

const arr = (v: string | null) => (v ? [v] : undefined);

/**
 * fbc montado a partir do fbclid quando não há o cookie _fbc (doc da Meta, "fbp and fbc"):
 * fb.1.<ms em que o fbclid foi visto>.<fbclid>, com o fbclid exatamente como veio (sensível a maiúsculas).
 */
export function fbcFromFbclid(fbclid: string | null | undefined, seenAt: Date): string | null {
	const v = fbclid?.trim();
	return v && /^[\w-]{8,500}$/.test(v) ? `fb.1.${seenAt.getTime()}.${v}` : null;
}

export function buildUserData(p: CapiPerson): Record<string, string | string[]> {
	const out: Record<string, string | string[] | undefined> = {
		client_ip_address: p.ip ?? undefined,
		client_user_agent: p.userAgent ?? undefined,
		country: arr(hashed(normCountry(p.country))),
		ct: arr(hashed(normCity(p.city))),
		em: arr(p.emHash ?? hashed(normEmail(p.email))),
		external_id: arr(hashed(p.externalId ?? null)),
		fbc: p.fbc ?? undefined,
		fbp: p.fbp ?? undefined,
		fn: arr(p.fnHash ?? hashed(normName(p.firstName))),
		ln: arr(p.lnHash ?? hashed(normName(p.lastName))),
		ph: arr(p.phHash ?? hashed(normPhone(p.phone))),
		st: arr(hashed(normState(p.region, p.country))),
	};
	return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as Record<
		string,
		string | string[]
	>;
}

export function buildEvent(input: {
	eventName: string;
	eventId: string;
	eventTime?: Date;
	eventSourceUrl?: string | null;
	person: CapiPerson;
	customData?: CapiCustomData;
	actionSource?: CapiEvent["action_source"];
}): CapiEvent {
	const custom = input.customData && Object.keys(input.customData).length ? input.customData : undefined;
	return {
		event_id: input.eventId,
		event_name: input.eventName,
		event_time: Math.floor((input.eventTime ?? new Date()).getTime() / 1000),
		...(input.eventSourceUrl ? { event_source_url: input.eventSourceUrl } : {}),
		action_source: input.actionSource ?? "website",
		user_data: buildUserData(input.person),
		...(custom ? { custom_data: custom } : {}),
	};
}

export interface CapiDelivery {
	ok: boolean;
	status: number;
	body: unknown;
}

/** Envia o MESMO evento para cada pixel ativo, em paralelo. Retorna a resposta de cada um. */
export async function sendToPixels(
	pixels: { pixelId: string; token: string }[],
	event: CapiEvent,
	testEventCode: string | null,
): Promise<{ payload: Record<string, unknown>; responses: Record<string, CapiDelivery> }> {
	const payload: Record<string, unknown> = {
		data: [event],
		...(testEventCode ? { test_event_code: testEventCode } : {}),
	};
	const results = await Promise.all(
		pixels.map(async ({ pixelId, token }) => {
			const r: GraphResult<unknown> = await graphPost(`${pixelId}/events`, token, payload);
			return [
				pixelId,
				{ body: r.ok ? r.data : { error: r.error }, ok: r.ok, status: r.status },
			] as const;
		}),
	);
	return {
		payload: { pixels: pixels.map(p => p.pixelId), ...payload },
		responses: Object.fromEntries(results),
	};
}
