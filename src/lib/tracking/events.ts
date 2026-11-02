import "server-only";
import { eq } from "drizzle-orm";
import { serviceDb } from "@/db";
import { eventsLog } from "@/db/schema";
import { buildEvent, sendToPixels, type CapiCustomData } from "@/lib/meta/capi";
import type { Geo } from "@/lib/geo";
import type { RuntimeConfig } from "./runtime-config";
import type { VisitorRow } from "./visitors";

export type RecordEventInput = {
  eventName: string;
  eventId: string;
  eventSourceUrl: string | null;
  customData?: CapiCustomData;
  visitor: VisitorRow;
  ip: string | null;
  userAgent: string | null;
  geo: Geo;
};

/** Grava o evento (dedup por event_id). Retorna o id da linha, ou null se já existia. */
export async function insertEvent(input: RecordEventInput): Promise<number | null> {
  const { visitor } = input;
  const [row] = await serviceDb()
    .insert(eventsLog)
    .values({
      trckUserId: visitor.trckUserId,
      eventName: input.eventName,
      eventId: input.eventId,
      eventSourceUrl: input.eventSourceUrl,
      value: input.customData?.value !== undefined ? String(input.customData.value) : null,
      currency: input.customData?.currency ?? null,
      utmSource: visitor.utmSource,
      utmMedium: visitor.utmMedium,
      utmCampaign: visitor.utmCampaign,
      utmTerm: visitor.utmTerm,
      utmContent: visitor.utmContent,
      // GA4 dos eventos web vai pela gtag no navegador; o MP só é usado na compra do webhook.
      payloadGa4: { via: "gtag" },
      ip: input.ip,
      userAgent: input.userAgent,
      geoCountry: input.geo.country,
      geoRegion: input.geo.region,
      geoCity: input.geo.city,
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
    eventName: input.eventName,
    eventId: input.eventId,
    eventSourceUrl: input.eventSourceUrl,
    customData: input.customData,
    person: {
      externalId: visitor.trckUserId,
      emHash: visitor.emHash,
      phHash: visitor.phHash,
      fnHash: visitor.fnHash,
      lnHash: visitor.lnHash,
      city: input.geo.city ?? visitor.geoCity,
      region: input.geo.region ?? visitor.geoRegion,
      country: input.geo.country ?? visitor.geoCountry,
      ip: input.ip ?? visitor.ip,
      userAgent: input.userAgent ?? visitor.userAgent,
      fbp: visitor.fbp,
      fbc: visitor.fbc,
    },
  });
  try {
    const { payload, responses } = await sendToPixels(config.pixels, event, config.testEventCode);
    await serviceDb()
      .update(eventsLog)
      .set({ payloadMeta: payload, responseMeta: responses })
      .where(eq(eventsLog.id, rowId));
  } catch (error) {
    console.error("[capi] falha ao enviar evento", input.eventId, error instanceof Error ? error.message : error);
    await serviceDb()
      .update(eventsLog)
      .set({ payloadMeta: { data: [event] }, responseMeta: { error: "falha interna no envio" } })
      .where(eq(eventsLog.id, rowId));
  }
}
