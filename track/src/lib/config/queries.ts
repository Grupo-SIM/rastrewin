import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { ga4Accounts, metaAdAccounts, metaPixels, settings, webhookEvents } from "@/db/schema";
import { readAsUser } from "@/lib/dal";
import { env } from "@/lib/env";
import { DEFAULT_TIMEZONE } from "@/lib/time";
import { getMaintenanceView } from "./maintenance";
import type { AccountView, ConfigView } from "./types";

interface TestCols {
	lastTestAt: Date | null;
	lastTestStatus: string | null;
	lastTestMessage: string | null;
}

function testView(row: TestCols) {
	return {
		lastTestAt: row.lastTestAt?.toISOString() ?? null,
		lastTestMessage: row.lastTestMessage,
		lastTestStatus: (row.lastTestStatus as AccountView["lastTestStatus"]) ?? null,
	};
}

/** Lê a configuração como app_reader (RLS). Colunas *_enc nem são selecionáveis por esse papel. */
export async function getConfigView(): Promise<ConfigView> {
	const requestHeaders = await headers();
	const production = env().APP_URL.startsWith("https://");
	const data = await readAsUser(async tx => {
		const [general] = await tx
			.select({
				allowedOrigins: settings.allowedOrigins,
				checkoutDomains: settings.checkoutDomains,
				currency: settings.currency,
				ga4Debug: settings.ga4Debug,
				testEventCode: settings.testEventCode,
				timezone: settings.timezone,
				webhookTokenHint: settings.webhookTokenHint,
			})
			.from(settings)
			.where(eq(settings.id, 1));

		const [lastWebhook] = await tx
			.select({
				error: webhookEvents.error,
				eventType: webhookEvents.eventType,
				orderId: webhookEvents.orderId,
				processedAt: webhookEvents.processedAt,
				receivedAt: webhookEvents.receivedAt,
			})
			.from(webhookEvents)
			.orderBy(desc(webhookEvents.receivedAt))
			.limit(1);

		const ga4 = await tx
			.select({
				active: ga4Accounts.active,
				externalId: ga4Accounts.measurementId,
				id: ga4Accounts.id,
				label: ga4Accounts.label,
				lastTestAt: ga4Accounts.lastTestAt,
				lastTestMessage: ga4Accounts.lastTestMessage,
				lastTestStatus: ga4Accounts.lastTestStatus,
				secretHint: ga4Accounts.apiSecretHint,
			})
			.from(ga4Accounts)
			.orderBy(asc(ga4Accounts.createdAt));

		const pixel = await tx
			.select({
				active: metaPixels.active,
				externalId: metaPixels.pixelId,
				id: metaPixels.id,
				label: metaPixels.label,
				lastTestAt: metaPixels.lastTestAt,
				lastTestMessage: metaPixels.lastTestMessage,
				lastTestStatus: metaPixels.lastTestStatus,
				secretHint: metaPixels.capiTokenHint,
			})
			.from(metaPixels)
			.orderBy(asc(metaPixels.createdAt));

		const ads = await tx
			.select({
				active: metaAdAccounts.active,
				externalId: metaAdAccounts.adAccountId,
				id: metaAdAccounts.id,
				label: metaAdAccounts.label,
				lastTestAt: metaAdAccounts.lastTestAt,
				lastTestMessage: metaAdAccounts.lastTestMessage,
				lastTestStatus: metaAdAccounts.lastTestStatus,
				secretHint: metaAdAccounts.adsTokenHint,
			})
			.from(metaAdAccounts)
			.orderBy(asc(metaAdAccounts.createdAt));

		const maintenance = await getMaintenanceView(tx, requestHeaders, production);
		return { ads, ga4, general, lastWebhook, maintenance, pixel };
	});

	const toView =
		(kind: AccountView["kind"]) =>
		(row: (typeof data.ga4)[number]): AccountView => ({
			active: row.active,
			externalId: row.externalId,
			id: row.id,
			kind,
			label: row.label,
			secretHint: row.secretHint,
			...testView(row),
		});

	return {
		accounts: {
			ads: data.ads.map(toView("ads")),
			ga4: data.ga4.map(toView("ga4")),
			pixel: data.pixel.map(toView("pixel")),
		},
		general: {
			allowedOrigins: data.general?.allowedOrigins ?? [],
			checkoutDomains: data.general?.checkoutDomains ?? [],
			currency: data.general?.currency ?? "BRL",
			ga4Debug: data.general?.ga4Debug ?? false,
			lastWebhook: data.lastWebhook
				? {
						error: data.lastWebhook.error,
						eventType: data.lastWebhook.eventType,
						orderId: data.lastWebhook.orderId,
						processed: Boolean(data.lastWebhook.processedAt),
						receivedAt: data.lastWebhook.receivedAt.toISOString(),
					}
				: null,
			scriptUrl: new URL("/t.js", env().APP_URL).toString(),
			testEventCode: data.general?.testEventCode ?? "",
			timezone: data.general?.timezone ?? DEFAULT_TIMEZONE,
			webhookTokenHint: data.general?.webhookTokenHint ?? null,
			webhookUrl: new URL("/api/webhook/compra", env().APP_URL).toString(),
		},
		maintenance: data.maintenance,
	};
}
