import "server-only";
import { eq, sql } from "drizzle-orm";
import { serviceDb } from "@/db";
import { ga4Accounts, metaPixels, settings } from "@/db/schema";
import { type ConsentTexts, resolveConsentTexts } from "@/lib/privacy/consent-texts";
import { decryptSecret } from "@/lib/secrets";

/*
 * Configuração usada pelos endpoints públicos, com cache em memória de 30 s
 * (evita ir ao banco a cada evento). A tela de Configurações chama
 * invalidateRuntimeConfig() ao salvar, então mudanças valem na hora.
 * Tokens decifrados ficam SÓ na memória do servidor.
 */

export interface RuntimeConfig {
	currency: string;
	testEventCode: string | null;
	allowedOrigins: string[];
	checkoutDomains: string[];
	pixels: { pixelId: string; token: string }[];
	ga4: { measurementId: string; apiSecret: string }[];
	ga4Debug: boolean;
	/** Segredo HMAC do webhook de vendas (null = não configurado). */
	webhookSecret: string | null;
	/** Banner de consentimento (LGPD): versão do texto, link da política e textos já com o padrão. */
	consent: { version: string; policyUrl: string | null; texts: ConsentTexts };
}

const TTL_MS = 30_000;
const g = globalThis as unknown as {
	__runtimeConfig?: { value: RuntimeConfig; at: number } | null;
	__runtimeConfigLoading?: Promise<RuntimeConfig> | null;
};

async function load(): Promise<RuntimeConfig> {
	const db = serviceDb();
	const [row] = await db
		.select({
			allowedOrigins: settings.allowedOrigins,
			checkoutDomains: settings.checkoutDomains,
			consentTexts: settings.consentTexts,
			consentVersion: settings.consentVersion,
			currency: settings.currency,
			ga4Debug: settings.ga4Debug,
			privacyPolicyUrl: settings.privacyPolicyUrl,
			testEventCode: settings.testEventCode,
			webhookSecret: sql<
				string | null
			>`case when ${settings.webhookTokenEnc} is null then null else ${decryptSecret(settings.webhookTokenEnc)} end`,
		})
		.from(settings)
		.where(eq(settings.id, 1));
	const pixels = await db
		.select({ pixelId: metaPixels.pixelId, token: decryptSecret(metaPixels.capiTokenEnc) })
		.from(metaPixels)
		.where(eq(metaPixels.active, true));
	const ga4 = await db
		.select({
			apiSecret: decryptSecret(ga4Accounts.apiSecretEnc),
			measurementId: ga4Accounts.measurementId,
		})
		.from(ga4Accounts)
		.where(eq(ga4Accounts.active, true));
	return {
		allowedOrigins: row?.allowedOrigins ?? [],
		checkoutDomains: row?.checkoutDomains ?? [],
		consent: {
			policyUrl: row?.privacyPolicyUrl ?? null,
			texts: resolveConsentTexts(row?.consentTexts),
			version: row?.consentVersion ?? "1",
		},
		currency: row?.currency ?? "BRL",
		ga4,
		ga4Debug: row?.ga4Debug ?? false,
		pixels,
		testEventCode: row?.testEventCode ?? null,
		webhookSecret: row?.webhookSecret ?? null,
	};
}

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
	const cached = g.__runtimeConfig;
	if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
	g.__runtimeConfigLoading ??= load()
		.then(value => {
			g.__runtimeConfig = { at: Date.now(), value };
			return value;
		})
		.finally(() => {
			g.__runtimeConfigLoading = null;
		});
	return g.__runtimeConfigLoading;
}

export function invalidateRuntimeConfig() {
	g.__runtimeConfig = null;
}
