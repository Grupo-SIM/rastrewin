"use server";

import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { serviceDb } from "@/db";
import { ga4Accounts, metaAdAccounts, metaPixels, settings } from "@/db/schema";
import { testGa4, testMetaAdAccount, testMetaPixel, type TestResult } from "@/lib/config/connection-tests";
import type { ActionResult } from "@/lib/config/types";
import {
  ACCOUNT_KINDS,
  accountSchema,
  fieldErrors,
  generalSchema,
  webhookSecretSchema,
  type AccountKind,
} from "@/lib/config/validation";
import { requireSession } from "@/lib/dal";
import { decryptSecret, encryptSecret, secretHint } from "@/lib/secrets";
import { invalidateRuntimeConfig } from "@/lib/tracking/runtime-config";

/*
 * Server Actions são endpoints públicos: TODA função aqui chama requireSession()
 * e valida a entrada com Zod antes de tocar no banco (sempre como app_service).
 * Segredos nunca voltam ao navegador, exceto o token do webhook recém-gerado, exibido uma vez.
 */

const kindSchema = z.enum(ACCOUNT_KINDS);
const idSchema = z.uuid();

/** Mapa de cada tipo de conta → tabela e colunas. */
const REGISTRY = {
  ga4: {
    table: ga4Accounts,
    externalCol: ga4Accounts.measurementId,
    encCol: ga4Accounts.apiSecretEnc,
    keys: { external: "measurementId", enc: "apiSecretEnc", hint: "apiSecretHint" },
    test: testGa4,
    secretName: "api_secret",
  },
  pixel: {
    table: metaPixels,
    externalCol: metaPixels.pixelId,
    encCol: metaPixels.capiTokenEnc,
    keys: { external: "pixelId", enc: "capiTokenEnc", hint: "capiTokenHint" },
    test: testMetaPixel,
    secretName: "token da Conversions API",
  },
  ads: {
    table: metaAdAccounts,
    externalCol: metaAdAccounts.adAccountId,
    encCol: metaAdAccounts.adsTokenEnc,
    keys: { external: "adAccountId", enc: "adsTokenEnc", hint: "adsTokenHint" },
    test: testMetaAdAccount,
    secretName: "token de acesso",
  },
} as const;

type AnyAccountTable = typeof ga4Accounts | typeof metaPixels | typeof metaAdAccounts;

function pgCode(error: unknown): string | undefined {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.cause?.code ?? e?.code;
}

function dbError(error: unknown): ActionResult {
  const code = pgCode(error);
  if (code === "23505") return { ok: false, error: "Já existe uma conta com esse ID.", fieldErrors: { externalId: "ID já cadastrado" } };
  if (code === "23514") return { ok: false, error: "Algum valor está em formato inválido." };
  console.error("[config] erro no banco", code);
  return { ok: false, error: "Não foi possível salvar. Tente de novo." };
}

// ---------------------------------------------------------------- contas

export async function saveAccount(kind: AccountKind, input: unknown): Promise<ActionResult> {
  await requireSession();
  const k = kindSchema.parse(kind);
  const parsed = accountSchema(k).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Confira os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  }
  const { id, label, externalId, secret, active } = parsed.data;
  const reg = REGISTRY[k];
  const table = reg.table as AnyAccountTable;

  if (!id && !secret) {
    return { ok: false, error: `Informe o ${reg.secretName}.`, fieldErrors: { secret: "Obrigatório" } };
  }

  const values: Record<string, unknown> = { label, [reg.keys.external]: externalId, active };
  if (secret) {
    values[reg.keys.enc] = encryptSecret(secret);
    values[reg.keys.hint] = secretHint(secret);
  }
  // Mudou o ID ou o segredo? O resultado do último teste deixa de valer. Só o nome? Mantém.
  if (id) {
    const keep = (col: unknown) =>
      secret ? null : sql`CASE WHEN ${reg.externalCol} = ${externalId} THEN ${col} ELSE NULL END`;
    values.lastTestAt = keep(table.lastTestAt);
    values.lastTestStatus = keep(table.lastTestStatus);
    values.lastTestMessage = keep(table.lastTestMessage);
  }

  try {
    const db = serviceDb();
    if (id) {
      const updated = await db.update(table).set(values as never).where(eq(table.id, id)).returning({ id: table.id });
      if (!updated.length) return { ok: false, error: "Conta não encontrada." };
    } else {
      await db.insert(table).values(values as never);
    }
  } catch (error) {
    return dbError(error);
  }
  invalidateRuntimeConfig();
  refresh();
  return { ok: true, message: id ? "Conta atualizada." : "Conta adicionada." };
}

export async function deleteAccount(kind: AccountKind, id: string): Promise<ActionResult> {
  await requireSession();
  const k = kindSchema.parse(kind);
  const accountId = idSchema.parse(id);
  const table = REGISTRY[k].table as AnyAccountTable;
  await serviceDb().delete(table).where(eq(table.id, accountId));
  invalidateRuntimeConfig();
  refresh();
  return { ok: true, message: "Conta removida." };
}

export async function setAccountActive(kind: AccountKind, id: string, active: boolean): Promise<ActionResult> {
  await requireSession();
  const k = kindSchema.parse(kind);
  const accountId = idSchema.parse(id);
  const table = REGISTRY[k].table as AnyAccountTable;
  await serviceDb()
    .update(table)
    .set({ active: z.boolean().parse(active) } as never)
    .where(eq(table.id, accountId));
  invalidateRuntimeConfig();
  refresh();
  return { ok: true, message: active ? "Conta ativada." : "Conta desativada: não recebe mais eventos." };
}

export async function testAccount(kind: AccountKind, id: string): Promise<ActionResult<TestResult>> {
  await requireSession();
  const k = kindSchema.parse(kind);
  const accountId = idSchema.parse(id);
  const reg = REGISTRY[k];
  const table = reg.table as AnyAccountTable;
  const db = serviceDb();

  const [row] = await db
    .select({ externalId: reg.externalCol, secret: decryptSecret(reg.encCol) })
    .from(table)
    .where(eq(table.id, accountId));
  if (!row) return { ok: false, error: "Conta não encontrada." };

  const result = await reg.test(row.externalId, row.secret);
  await db
    .update(table)
    .set({ lastTestAt: new Date(), lastTestStatus: result.status, lastTestMessage: result.message.slice(0, 500) } as never)
    .where(eq(table.id, accountId));
  invalidateRuntimeConfig();
  refresh();
  return { ok: true, data: result };
}

// ---------------------------------------------------------------- geral

export async function saveGeneral(input: unknown): Promise<ActionResult> {
  await requireSession();
  const parsed = generalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Confira os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  }
  const { currency, testEventCode, allowedOrigins, checkoutDomains } = parsed.data;
  try {
    await serviceDb()
      .update(settings)
      .set({ currency, testEventCode: testEventCode || null, allowedOrigins, checkoutDomains })
      .where(eq(settings.id, 1));
  } catch (error) {
    return dbError(error);
  }
  invalidateRuntimeConfig();
  refresh();
  return { ok: true, message: "Configurações salvas." };
}

/** Gera um segredo novo para o webhook. Ele é devolvido UMA vez para ser copiado. */
export async function generateWebhookSecret(): Promise<ActionResult<{ secret: string }>> {
  await requireSession();
  const secret = randomBytes(36).toString("base64url");
  await serviceDb()
    .update(settings)
    .set({ webhookTokenEnc: encryptSecret(secret) as never, webhookTokenHint: secretHint(secret) })
    .where(eq(settings.id, 1));
  invalidateRuntimeConfig();
  refresh();
  return { ok: true, message: "Segredo gerado.", data: { secret } };
}

/** Define um segredo que já existe na plataforma de venda. */
export async function setWebhookSecret(value: unknown): Promise<ActionResult> {
  await requireSession();
  const parsed = webhookSecretSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Segredo inválido.", fieldErrors: { secret: parsed.error.issues[0]?.message ?? "" } };
  }
  await serviceDb()
    .update(settings)
    .set({ webhookTokenEnc: encryptSecret(parsed.data) as never, webhookTokenHint: secretHint(parsed.data) })
    .where(eq(settings.id, 1));
  invalidateRuntimeConfig();
  refresh();
  return { ok: true, message: "Segredo do webhook salvo." };
}
