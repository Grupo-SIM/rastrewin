import "server-only";
import { asc, eq } from "drizzle-orm";
import { ga4Accounts, metaAdAccounts, metaPixels, settings } from "@/db/schema";
import { readAsUser } from "@/lib/dal";
import { env } from "@/lib/env";
import type { AccountView, ConfigView } from "./types";

type TestCols = { lastTestAt: Date | null; lastTestStatus: string | null; lastTestMessage: string | null };

function testView(row: TestCols) {
  return {
    lastTestAt: row.lastTestAt?.toISOString() ?? null,
    lastTestStatus: (row.lastTestStatus as AccountView["lastTestStatus"]) ?? null,
    lastTestMessage: row.lastTestMessage,
  };
}

/** Lê a configuração como app_reader (RLS). Colunas *_enc nem são selecionáveis por esse papel. */
export async function getConfigView(): Promise<ConfigView> {
  const data = await readAsUser(async (tx) => {
    const [general] = await tx
      .select({
        currency: settings.currency,
        testEventCode: settings.testEventCode,
        allowedOrigins: settings.allowedOrigins,
        checkoutDomains: settings.checkoutDomains,
        webhookTokenHint: settings.webhookTokenHint,
      })
      .from(settings)
      .where(eq(settings.id, 1));


    const ga4 = await tx
      .select({
        id: ga4Accounts.id,
        label: ga4Accounts.label,
        externalId: ga4Accounts.measurementId,
        secretHint: ga4Accounts.apiSecretHint,
        active: ga4Accounts.active,
        lastTestAt: ga4Accounts.lastTestAt,
        lastTestStatus: ga4Accounts.lastTestStatus,
        lastTestMessage: ga4Accounts.lastTestMessage,
      })
      .from(ga4Accounts)
      .orderBy(asc(ga4Accounts.createdAt));

    const pixel = await tx
      .select({
        id: metaPixels.id,
        label: metaPixels.label,
        externalId: metaPixels.pixelId,
        secretHint: metaPixels.capiTokenHint,
        active: metaPixels.active,
        lastTestAt: metaPixels.lastTestAt,
        lastTestStatus: metaPixels.lastTestStatus,
        lastTestMessage: metaPixels.lastTestMessage,
      })
      .from(metaPixels)
      .orderBy(asc(metaPixels.createdAt));

    const ads = await tx
      .select({
        id: metaAdAccounts.id,
        label: metaAdAccounts.label,
        externalId: metaAdAccounts.adAccountId,
        secretHint: metaAdAccounts.adsTokenHint,
        active: metaAdAccounts.active,
        lastTestAt: metaAdAccounts.lastTestAt,
        lastTestStatus: metaAdAccounts.lastTestStatus,
        lastTestMessage: metaAdAccounts.lastTestMessage,
      })
      .from(metaAdAccounts)
      .orderBy(asc(metaAdAccounts.createdAt));

    return { general, ga4, pixel, ads };
  });

  const toView = (kind: AccountView["kind"]) => (row: (typeof data.ga4)[number]): AccountView => ({
    id: row.id,
    kind,
    label: row.label,
    externalId: row.externalId,
    secretHint: row.secretHint,
    active: row.active,
    ...testView(row),
  });

  return {
    general: {
      currency: data.general?.currency ?? "BRL",
      testEventCode: data.general?.testEventCode ?? "",
      allowedOrigins: data.general?.allowedOrigins ?? [],
      checkoutDomains: data.general?.checkoutDomains ?? [],
      webhookTokenHint: data.general?.webhookTokenHint ?? null,
      webhookUrl: new URL("/api/webhook/compra", env().APP_URL).toString(),
    },
    accounts: {
      ga4: data.ga4.map(toView("ga4")),
      pixel: data.pixel.map(toView("pixel")),
      ads: data.ads.map(toView("ads")),
    },
  };
}
