import "server-only";
import { eq, sql } from "drizzle-orm";
import { serviceDb } from "@/db";
import { consentRecords, visitors } from "@/db/schema";
import type { ConsentInput } from "@/lib/tracking/schemas";

/** Página sem query nem # (a query pode levar UTMs, fbclid ou dados pessoais). */
export function pagePathOf(pageUrl: string | null | undefined): string | null {
	if (!pageUrl) return null;
	try {
		return new URL(pageUrl).pathname.slice(0, 500) || "/";
	} catch {
		return null;
	}
}

/**
 * Grava a escolha do banner (prova do consentimento) e aplica no visitante:
 * - aceitou: consent_marketing = true (os eventos seguintes vão à Meta/GA4);
 * - recusou/revogou: consent_marketing = false e os identificadores de marketing do visitante
 *   (fbc, fbp, ids do GA) são apagados, para não serem usados em nenhum envio.
 */
export async function recordConsent(input: ConsentInput, origin: string) {
	const db = serviceDb();
	await db.transaction(async tx => {
		await tx.insert(consentRecords).values({
			action: input.action,
			consentId: input.consent_id,
			marketing: input.marketing,
			origin,
			pagePath: pagePathOf(input.page_url),
			trckUserId: input.trck_user_id ?? null,
			version: input.version,
		});
		if (!input.trck_user_id) return;
		await tx
			.update(visitors)
			.set({
				consentAt: sql`now()`,
				consentMarketing: input.marketing,
				...(input.marketing ? {} : { fbc: null, fbp: null, gaClientId: null, gaSessionId: null }),
				updatedAt: sql`now()`,
			})
			.where(eq(visitors.trckUserId, input.trck_user_id));
	});
}
