import "server-only";
import { sql } from "drizzle-orm";
import { serviceDb } from "@/db";
import { visitors } from "@/db/schema";
import type { Geo } from "@/lib/geo";
import { hashed, normEmail, normName, normPhone } from "./normalize";

export type VisitorInput = {
  trckUserId: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  gaClientId?: string | null;
  gaSessionId?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  referrer?: string | null;
  landingUrl?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  geo: Geo;
  pixelId?: string | null;
};

export type VisitorRow = typeof visitors.$inferSelect;

/**
 * UPSERT do visitante. Regras:
 * - dados novos só sobrescrevem se vierem preenchidos (coalesce);
 * - UTMs: última origem com UTM (o conjunto inteiro é trocado junto);
 * - referrer/landing_url: os da PRIMEIRA visita;
 * - email fica em texto (painel); telefone e nomes, só o hash.
 */
export async function upsertVisitor(input: VisitorInput): Promise<VisitorRow> {
  const email = normEmail(input.email);
  const hasUtm = Boolean(input.utmSource || input.utmMedium || input.utmCampaign || input.utmTerm || input.utmContent);

  const values = {
    trckUserId: input.trckUserId,
    email,
    emHash: hashed(email),
    phHash: hashed(normPhone(input.phone)),
    fnHash: hashed(normName(input.firstName)),
    lnHash: hashed(normName(input.lastName)),
    fbp: input.fbp ?? null,
    fbc: input.fbc ?? null,
    gaClientId: input.gaClientId ?? null,
    gaSessionId: input.gaSessionId ?? null,
    utmSource: hasUtm ? (input.utmSource ?? null) : null,
    utmMedium: hasUtm ? (input.utmMedium ?? null) : null,
    utmCampaign: hasUtm ? (input.utmCampaign ?? null) : null,
    utmTerm: hasUtm ? (input.utmTerm ?? null) : null,
    utmContent: hasUtm ? (input.utmContent ?? null) : null,
    referrer: input.referrer ?? null,
    landingUrl: input.landingUrl ?? null,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    geoCountry: input.geo.country,
    geoRegion: input.geo.region,
    geoCity: input.geo.city,
    pixelId: input.pixelId ?? null,
  };

  const keepOld = (col: string) => sql.raw(`coalesce(excluded.${col}, visitors.${col})`);
  const keepFirst = (col: string) => sql.raw(`coalesce(visitors.${col}, excluded.${col})`);
  const utm = (col: string) =>
    hasUtm ? sql.raw(`excluded.${col}`) : sql.raw(`visitors.${col}`);
  const geo = (col: string) =>
    input.geo.country ? sql.raw(`excluded.${col}`) : sql.raw(`visitors.${col}`);

  const [row] = await serviceDb()
    .insert(visitors)
    .values(values)
    .onConflictDoUpdate({
      target: visitors.trckUserId,
      set: {
        email: keepOld("email"),
        emHash: keepOld("em_hash"),
        phHash: keepOld("ph_hash"),
        fnHash: keepOld("fn_hash"),
        lnHash: keepOld("ln_hash"),
        fbp: keepOld("fbp"),
        fbc: keepOld("fbc"),
        gaClientId: keepOld("ga_client_id"),
        gaSessionId: keepOld("ga_session_id"),
        utmSource: utm("utm_source"),
        utmMedium: utm("utm_medium"),
        utmCampaign: utm("utm_campaign"),
        utmTerm: utm("utm_term"),
        utmContent: utm("utm_content"),
        referrer: keepFirst("referrer"),
        landingUrl: keepFirst("landing_url"),
        ip: keepOld("ip"),
        userAgent: keepOld("user_agent"),
        geoCountry: geo("geo_country"),
        geoRegion: geo("geo_region"),
        geoCity: geo("geo_city"),
        pixelId: keepFirst("pixel_id"),
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return row;
}
