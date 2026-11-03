import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { serviceDb } from "@/db";
import { purchases, visitors } from "@/db/schema";
import { hashed, normEmail, normName, normPhone, splitFullName } from "@/lib/tracking/normalize";
import { nextStatus, toPurchaseFields, type SalesEvent } from "./simintpay";

type Tx = Parameters<Parameters<ReturnType<typeof serviceDb>["transaction"]>[0]>[0];
type VisitorRow = typeof visitors.$inferSelect;

export type MatchResult = {
  found: boolean;
  by: "trck_user_id" | "email" | "phone" | null;
  reason: string;
};

/** Liga a venda ao visitante: 1º pelo trck_user_id (src), depois email, depois telefone. */
export async function matchVisitor(
  tx: Tx,
  input: { trckUserId: string | null; emHash: string | null; phHash: string | null; src: string | null },
): Promise<{ visitor: VisitorRow | null; match: MatchResult }> {
  if (input.trckUserId) {
    const [v] = await tx.select().from(visitors).where(eq(visitors.trckUserId, input.trckUserId)).limit(1);
    if (v) return { visitor: v, match: { found: true, by: "trck_user_id", reason: "src do checkout = trck_user_id" } };
  }
  if (input.emHash) {
    const [v] = await tx.select().from(visitors).where(eq(visitors.emHash, input.emHash)).orderBy(desc(visitors.updatedAt)).limit(1);
    if (v) return { visitor: v, match: { found: true, by: "email", reason: "mesmo email de um visitante" } };
  }
  if (input.phHash) {
    const [v] = await tx.select().from(visitors).where(eq(visitors.phHash, input.phHash)).orderBy(desc(visitors.updatedAt)).limit(1);
    if (v) return { visitor: v, match: { found: true, by: "phone", reason: "mesmo telefone de um visitante" } };
  }
  const reason = input.trckUserId
    ? "trck_user_id do src não existe em visitors e email/telefone não bateram"
    : input.src
      ? "src não é um trck_user_id e email/telefone não bateram"
      : "sem src no checkout e email/telefone não bateram";
  return { visitor: null, match: { found: false, by: null, reason } };
}

/**
 * Grava/atualiza a compra (UPSERT por transaction_id, com precedência de status).
 * Retorna o id da compra e o status final.
 */
export async function upsertPurchase(event: SalesEvent, currency: string) {
  const f = toPurchaseFields(event);
  const email = normEmail(event.customerEmail);
  const names = splitFullName(event.customerName);
  const emHash = hashed(email);
  const phHash = hashed(normPhone(event.phone));

  return serviceDb().transaction(async (tx) => {
    const { visitor, match } = await matchVisitor(tx, {
      trckUserId: f.trckUserIdFromSrc,
      emHash,
      phHash,
      src: f.src,
    });

    // Último toque exato do checkout tem prioridade; senão, o que o visitante tinha.
    const utm = f.hasUtm
      ? f.utm
      : {
          utmSource: visitor?.utmSource ?? null,
          utmMedium: visitor?.utmMedium ?? null,
          utmCampaign: visitor?.utmCampaign ?? null,
          utmTerm: visitor?.utmTerm ?? null,
          utmContent: visitor?.utmContent ?? null,
        };

    const base = {
      trckUserId: visitor?.trckUserId ?? f.trckUserIdFromSrc,
      email,
      emHash,
      phHash,
      fnHash: hashed(names.fn ? normName(names.fn) : null),
      lnHash: hashed(names.ln ? normName(names.ln) : null),
      product: f.product,
      items: f.items,
      value: f.value,
      netValue: f.netValue,
      currency,
      paymentMethod: f.paymentMethod,
      ...utm,
      src: f.src,
      fbp: f.fbp ?? visitor?.fbp ?? null,
      fbc: f.fbc ?? visitor?.fbc ?? null,
      fbclid: f.fbclid,
      geoCountry: visitor?.geoCountry ?? null,
      geoRegion: visitor?.geoRegion ?? null,
      geoCity: visitor?.geoCity ?? null,
      match,
      gaClientId: visitor?.gaClientId ?? null,
      gaSessionId: visitor?.gaSessionId ?? null,
      metaEventId: `purchase_${f.transactionId}`,
      webhookRaw: event,
    };
    const isApproval = f.status === "approved";
    const isRefund = f.status === "refunded" || f.status === "chargeback";

    const [created] = await tx
      .insert(purchases)
      .values({
        transactionId: f.transactionId,
        status: f.status,
        ...base,
        occurredAt: f.occurredAt,
        approvedAt: isApproval ? f.occurredAt : null,
        refundedAt: isRefund ? f.occurredAt : null,
      })
      .onConflictDoNothing({ target: purchases.transactionId })
      .returning({ id: purchases.id, status: purchases.status });
    if (created) return { purchaseId: created.id, status: created.status, match, visitor };

    const [existing] = await tx
      .select({ id: purchases.id, status: purchases.status, match: purchases.match, trckUserId: purchases.trckUserId })
      .from(purchases)
      .where(eq(purchases.transactionId, f.transactionId))
      .for("update");
    const status = nextStatus(existing.status, f.status);
    const keepOldMatch = !match.found && (existing.match as MatchResult | null)?.found;

    // Eventos seguintes (reembolso, chargeback...) costumam vir SEM tracking/email.
    // Só troca um campo se o evento novo trouxer valor; senão mantém o que já estava gravado.
    const merged: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(base)) {
      const column = purchases[key as keyof typeof purchases.$inferSelect];
      merged[key] = value === null || value === undefined ? column : value;
    }
    // UTMs andam juntas: sem UTM no evento novo, mantém o conjunto anterior inteiro.
    if (!f.hasUtm) {
      for (const key of ["utmSource", "utmMedium", "utmCampaign", "utmTerm", "utmContent"] as const) {
        merged[key] = purchases[key];
      }
    }
    if (keepOldMatch) merged.match = purchases.match;

    await tx
      .update(purchases)
      .set({
        ...(merged as typeof base),
        status,
        // Aprovação define o momento da venda; reembolso registra quando aconteceu.
        occurredAt: isApproval ? f.occurredAt : sql`coalesce(${purchases.occurredAt}, ${f.occurredAt})`,
        approvedAt: isApproval ? sql`coalesce(${purchases.approvedAt}, ${f.occurredAt})` : purchases.approvedAt,
        refundedAt: isRefund ? sql`coalesce(${purchases.refundedAt}, ${f.occurredAt})` : purchases.refundedAt,
        updatedAt: new Date(),
      })
      .where(eq(purchases.id, existing.id));
    return { purchaseId: existing.id, status, match: keepOldMatch ? (existing.match as MatchResult) : match, visitor };
  });
}
