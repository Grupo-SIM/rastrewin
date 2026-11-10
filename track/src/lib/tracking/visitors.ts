import "server-only";
import { sql } from "drizzle-orm";
import { serviceDb } from "@/db";
import { visitors } from "@/db/schema";
import type { Geo } from "@/lib/geo";
import { hashed, normEmail, normLastName, normName, normPhone } from "./normalize";

export interface VisitorInput {
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
}

export type VisitorRow = typeof visitors.$inferSelect;

/**
 * UPSERT do visitante. Regras:
 * - dados novos só sobrescrevem se vierem preenchidos (coalesce);
 * - UTMs: última origem com UTM (o conjunto inteiro é trocado junto);
 * - referrer: a PRIMEIRA origem externa (a rota já descarta o próprio site); landing_url: a da 1ª visita;
 * - email fica em texto (painel); telefone e nomes, só o hash.
 */
export async function upsertVisitor(input: VisitorInput): Promise<VisitorRow> {
	const email = normEmail(input.email);
	const hasUtm = Boolean(
		input.utmSource || input.utmMedium || input.utmCampaign || input.utmTerm || input.utmContent,
	);

	const values = {
		email,
		emHash: hashed(email),
		fbc: input.fbc ?? null,
		fbp: input.fbp ?? null,
		fnHash: hashed(normName(input.firstName)),
		gaClientId: input.gaClientId ?? null,
		gaSessionId: input.gaSessionId ?? null,
		geoCity: input.geo.city,
		geoCountry: input.geo.country,
		geoRegion: input.geo.region,
		ip: input.ip ?? null,
		landingUrl: input.landingUrl ?? null,
		lnHash: hashed(normLastName(input.lastName)),
		phHash: hashed(normPhone(input.phone)),
		pixelId: input.pixelId ?? null,
		referrer: input.referrer ?? null,
		trckUserId: input.trckUserId,
		userAgent: input.userAgent ?? null,
		utmCampaign: hasUtm ? (input.utmCampaign ?? null) : null,
		utmContent: hasUtm ? (input.utmContent ?? null) : null,
		utmMedium: hasUtm ? (input.utmMedium ?? null) : null,
		utmSource: hasUtm ? (input.utmSource ?? null) : null,
		utmTerm: hasUtm ? (input.utmTerm ?? null) : null,
	};

	const keepOld = (col: string) => sql.raw(`coalesce(excluded.${col}, visitors.${col})`);
	const keepFirst = (col: string) => sql.raw(`coalesce(visitors.${col}, excluded.${col})`);
	const utm = (col: string) => (hasUtm ? sql.raw(`excluded.${col}`) : sql.raw(`visitors.${col}`));
	const geo = (col: string) =>
		input.geo.country ? sql.raw(`excluded.${col}`) : sql.raw(`visitors.${col}`);

	const [row] = await serviceDb()
		.insert(visitors)
		.values(values)
		.onConflictDoUpdate({
			set: {
				email: keepOld("email"),
				emHash: keepOld("em_hash"),
				fbc: keepOld("fbc"),
				fbp: keepOld("fbp"),
				fnHash: keepOld("fn_hash"),
				gaClientId: keepOld("ga_client_id"),
				gaSessionId: keepOld("ga_session_id"),
				geoCity: geo("geo_city"),
				geoCountry: geo("geo_country"),
				geoRegion: geo("geo_region"),
				ip: keepOld("ip"),
				landingUrl: keepFirst("landing_url"),
				lnHash: keepOld("ln_hash"),
				phHash: keepOld("ph_hash"),
				pixelId: keepFirst("pixel_id"),
				referrer: keepFirst("referrer"),
				updatedAt: sql`now()`,
				userAgent: keepOld("user_agent"),
				utmCampaign: utm("utm_campaign"),
				utmContent: utm("utm_content"),
				utmMedium: utm("utm_medium"),
				utmSource: utm("utm_source"),
				utmTerm: utm("utm_term"),
			},
			target: visitors.trckUserId,
		})
		.returning();
	return row;
}
