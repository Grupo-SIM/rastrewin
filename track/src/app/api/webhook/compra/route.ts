import { and, eq, isNull } from "drizzle-orm";
import { after } from "next/server";
import { serviceDb } from "@/db";
import { webhookEvents } from "@/db/schema";
import { safeErrorMessage } from "@/lib/errors";
import { readJsonBody } from "@/lib/http/body";
import { rateLimitKey } from "@/lib/http/client-ip";
import { json } from "@/lib/http/cors";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { deliverPurchase } from "@/lib/sales/deliver";
import { upsertPurchase } from "@/lib/sales/process";
import { verifySignature } from "@/lib/sales/signature";
import { salesEventSchema } from "@/lib/sales/simintpay";
import { getRuntimeConfig } from "@/lib/tracking/runtime-config";
import { upsertVisitor } from "@/lib/tracking/visitors";

/*
 * POST /api/webhook/compra — vendas do SimIntPay (server-to-server).
 * 1) rate limit  2) corpo ≤ 64 KB  3) segredo configurado (senão 503: o SimIntPay tenta de novo)
 * 4) assinatura HMAC (x-simintpay-signature) — inválida = 401 e NADA é gravado  5) validação Zod
 * Idempotente por eventId (webhook_events) e por transaction_id (purchases).
 * Responde rápido; Meta/GA4 são chamados depois da resposta (after) e reenviados se falharem.
 */

const limiter = createRateLimiter({ burst: 60, perMinute: 120 });
const MAX_BYTES = 64 * 1024;
const g = globalThis as unknown as { __webhookInvalidSignatures?: number };

export async function POST(request: Request) {
	if (!limiter.take(rateLimitKey(request.headers))) return json({ error: "muitas requisições" }, 429);

	const body = await readJsonBody(request, MAX_BYTES);
	if (!body.ok)
		return json({ error: body.status === 413 ? "corpo grande demais" : "JSON inválido" }, body.status);

	const config = await getRuntimeConfig();
	if (!config.webhookSecret) return json({ error: "webhook ainda não configurado" }, 503);

	if (!verifySignature(body.raw, request.headers.get("x-simintpay-signature"), config.webhookSecret)) {
		g.__webhookInvalidSignatures = (g.__webhookInvalidSignatures ?? 0) + 1;
		console.warn(`[webhook] assinatura inválida (total desde o início: ${g.__webhookInvalidSignatures})`);
		return json({ error: "assinatura inválida" }, 401);
	}

	const parsed = salesEventSchema.safeParse(body.data);
	if (!parsed.success) {
		return json(
			{ error: "payload inválido", fields: parsed.error.issues.map(i => i.path.join(".")) },
			400,
		);
	}
	const event = parsed.data;
	const db = serviceDb();

	// Idempotência por eventId: já processado → 200 sem refazer nada.
	const [inserted] = await db
		.insert(webhookEvents)
		.values({
			eventId: event.eventId,
			eventType: event.event,
			orderId: event.orderId,
			payload: event,
			signatureValid: true,
		})
		.onConflictDoNothing({ target: webhookEvents.eventId })
		.returning({ id: webhookEvents.id });
	if (!inserted) {
		const [previous] = await db
			.select({ processedAt: webhookEvents.processedAt })
			.from(webhookEvents)
			.where(eq(webhookEvents.eventId, event.eventId));
		if (previous?.processedAt) return json({ duplicate: true, ok: true }, 200);
	}

	try {
		const result = await upsertPurchase(event, config.currency);
		await db
			.update(webhookEvents)
			.set({ error: null, processedAt: new Date() })
			.where(and(eq(webhookEvents.eventId, event.eventId), isNull(webhookEvents.processedAt)));

		after(async () => {
			// Visitante ligado pelo trck_user_id ganha os dados do comprador (melhora as próximas correspondências).
			if (result.match.by === "trck_user_id" && result.visitor) {
				const [firstName, ...rest] = (event.customerName ?? "").trim().split(/\s+/);
				await upsertVisitor({
					email: event.customerEmail,
					firstName: firstName || null,
					geo: { city: null, country: null, region: null },
					lastName: rest.at(-1) ?? null,
					phone: event.phone,
					trckUserId: result.visitor.trckUserId,
				}).catch(e => console.error("[webhook] falha ao atualizar visitante", safeErrorMessage(e)));
			}
			await deliverPurchase(result.purchaseId).catch(e =>
				console.error(
					"[webhook] falha no envio (o reenvio automático tenta de novo)",
					safeErrorMessage(e),
				),
			);
		});
		return json({ matched: result.match.by, ok: true, status: result.status }, 200);
	} catch (error) {
		const message = safeErrorMessage(error);
		await db
			.update(webhookEvents)
			.set({ error: message.slice(0, 500) })
			.where(eq(webhookEvents.eventId, event.eventId));
		console.error("[webhook] falha ao processar", event.eventId, message);
		// 500 → o SimIntPay tenta de novo; como processed_at continua nulo, reprocessamos.
		return json({ error: "falha ao processar" }, 500);
	}
}
