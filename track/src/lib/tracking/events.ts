import "server-only";
import { eq } from "drizzle-orm";
import { serviceDb } from "@/db";
import { eventsLog } from "@/db/schema";
import { safeErrorMessage } from "@/lib/errors";
import type { Geo } from "@/lib/geo";
import { buildEvent, type CapiCustomData, sendToPixels } from "@/lib/meta/capi";
import type { RuntimeConfig } from "./runtime-config";
import type { VisitorRow } from "./visitors";

export interface RecordEventInput {
	eventName: string;
	eventId: string;
	eventSourceUrl: string | null;
	customData?: CapiCustomData;
	visitor: VisitorRow;
	ip: string | null;
	userAgent: string | null;
	geo: Geo;
}

/** Grava o evento (dedup por event_id). Retorna o id da linha, ou null se já existia. */
export async function insertEvent(input: RecordEventInput): Promise<number | null> {
	const { visitor } = input;
	const [row] = await serviceDb()
		.insert(eventsLog)
		.values({
			currency: input.customData?.currency ?? null,
			eventId: input.eventId,
			eventName: input.eventName,
			eventSourceUrl: input.eventSourceUrl,
			geoCity: input.geo.city,
			geoCountry: input.geo.country,
			geoRegion: input.geo.region,
			ip: input.ip,
			// GA4 dos eventos web vai pela gtag no navegador; o MP só é usado na compra do webhook.
			payloadGa4: { via: "gtag" },
			trckUserId: visitor.trckUserId,
			userAgent: input.userAgent,
			utmCampaign: visitor.utmCampaign,
			utmContent: visitor.utmContent,
			utmMedium: visitor.utmMedium,
			utmSource: visitor.utmSource,
			utmTerm: visitor.utmTerm,
			value: input.customData?.value !== undefined ? String(input.customData.value) : null,
		})
		.onConflictDoNothing({ target: eventsLog.eventId })
		.returning({ id: eventsLog.id });
	return row?.id ?? null;
}

/** Envia para todos os pixels ativos e salva payload + resposta de cada um no log. */
export async function deliverEventToMeta(rowId: number, input: RecordEventInput, config: RuntimeConfig) {
	if (!config.pixels.length) {
		await serviceDb()
			.update(eventsLog)
			.set({ responseMeta: { skipped: "nenhum pixel ativo" } })
			.where(eq(eventsLog.id, rowId));
		return;
	}
	const { visitor } = input;
	const event = buildEvent({
		customData: input.customData,
		eventId: input.eventId,
		eventName: input.eventName,
		eventSourceUrl: input.eventSourceUrl,
		person: {
			city: input.geo.city ?? visitor.geoCity,
			country: input.geo.country ?? visitor.geoCountry,
			emHash: visitor.emHash,
			externalId: visitor.trckUserId,
			fbc: visitor.fbc,
			fbp: visitor.fbp,
			fnHash: visitor.fnHash,
			ip: input.ip ?? visitor.ip,
			lnHash: visitor.lnHash,
			phHash: visitor.phHash,
			region: input.geo.region ?? visitor.geoRegion,
			userAgent: input.userAgent ?? visitor.userAgent,
		},
	});
	try {
		const { payload, responses } = await sendToPixels(config.pixels, event, config.testEventCode);
		await serviceDb()
			.update(eventsLog)
			.set({ payloadMeta: payload, responseMeta: responses })
			.where(eq(eventsLog.id, rowId));
	} catch (error) {
		console.error("[capi] falha ao enviar evento", input.eventId, safeErrorMessage(error));
		await serviceDb()
			.update(eventsLog)
			.set({ payloadMeta: { data: [event] }, responseMeta: { error: "falha interna no envio" } })
			.where(eq(eventsLog.id, rowId));
	}
}
