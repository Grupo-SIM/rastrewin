import "server-only";
import { eq } from "drizzle-orm";
import { serviceDb } from "@/db";
import { ga4Accounts, metaPixels, settings } from "@/db/schema";
import { decryptSecret } from "@/lib/secrets";

/*
 * Configuração usada pelos endpoints públicos, com cache em memória de 30 s
 * (evita ir ao banco a cada evento). A tela de Configurações chama
 * invalidateRuntimeConfig() ao salvar, então mudanças valem na hora.
 * Tokens decifrados ficam SÓ na memória do servidor.
 */

export type RuntimeConfig = {
  currency: string;
  testEventCode: string | null;
  allowedOrigins: string[];
  checkoutDomains: string[];
  pixels: { pixelId: string; token: string }[];
  ga4: { measurementId: string; apiSecret: string }[];
};

const TTL_MS = 30_000;
const g = globalThis as unknown as { __runtimeConfig?: { value: RuntimeConfig; at: number } | null; __runtimeConfigLoading?: Promise<RuntimeConfig> | null };

async function load(): Promise<RuntimeConfig> {
  const db = serviceDb();
  const [row] = await db
    .select({
      currency: settings.currency,
      testEventCode: settings.testEventCode,
      allowedOrigins: settings.allowedOrigins,
      checkoutDomains: settings.checkoutDomains,
    })
    .from(settings)
    .where(eq(settings.id, 1));
  const pixels = await db
    .select({ pixelId: metaPixels.pixelId, token: decryptSecret(metaPixels.capiTokenEnc) })
    .from(metaPixels)
    .where(eq(metaPixels.active, true));
  const ga4 = await db
    .select({ measurementId: ga4Accounts.measurementId, apiSecret: decryptSecret(ga4Accounts.apiSecretEnc) })
    .from(ga4Accounts)
    .where(eq(ga4Accounts.active, true));
  return {
    currency: row?.currency ?? "BRL",
    testEventCode: row?.testEventCode ?? null,
    allowedOrigins: row?.allowedOrigins ?? [],
    checkoutDomains: row?.checkoutDomains ?? [],
    pixels,
    ga4,
  };
}

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  const cached = g.__runtimeConfig;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  g.__runtimeConfigLoading ??= load()
    .then((value) => {
      g.__runtimeConfig = { value, at: Date.now() };
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
