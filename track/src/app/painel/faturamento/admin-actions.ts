"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { serviceDb } from "@/db";
import { purchases } from "@/db/schema";
import type { ActionResult } from "@/lib/config/types";
import { denyUnlessAdmin } from "@/lib/dal";
import { safeErrorMessage } from "@/lib/errors";
import { deliverPurchase } from "@/lib/sales/deliver";

/*
 * "Reenviar agora" do detalhe da venda (só Administrador): manda de novo à Meta e ao GA4 o que ainda
 * não chegou, sem esperar a próxima tentativa automática. Vai só aos destinos que ainda não confirmaram
 * (deliver.ts), com o mesmo event_id da venda. Server Action é endpoint público: começa com
 * denyUnlessAdmin() e valida com Zod.
 */

const DESTINATION = { ga4: "ao GA4", meta: "à Meta" } as const;

export async function resendPurchase(id: unknown): Promise<ActionResult> {
	const denied = await denyUnlessAdmin();
	if (denied) return denied;
	const parsed = z.number().int().positive().safeParse(id);
	if (!parsed.success) return { error: "Venda inválida.", ok: false };

	try {
		const report = await deliverPurchase(parsed.data, "manual");
		refresh();
		const sent = (["meta", "ga4"] as const).filter(d => report[d] === "enviado");
		const failed = (["meta", "ga4"] as const).filter(d => report[d] === "falhou");
		if (failed.length) {
			const [row] = await serviceDb()
				.select({ error: purchases.lastDeliveryError })
				.from(purchases)
				.where(eq(purchases.id, parsed.data));
			const ok = sent.length ? ` Chegou ${sent.map(d => DESTINATION[d]).join(" e ")}.` : "";
			return {
				error: `Ainda não chegou ${failed.map(d => DESTINATION[d]).join(" nem ")}${row?.error ? `: ${row.error.replace(/^(Meta|GA4): /, "")}` : "."}${ok}`,
				ok: false,
			};
		}
		if (report.meta === "fora do prazo")
			return { error: "A Meta não aceita venda com mais de 7 dias.", ok: false };
		if (!sent.length)
			return {
				error: "Nada a reenviar: a venda já foi enviada ou está sendo enviada agora.",
				ok: false,
			};
		return { message: `Venda enviada ${sent.map(d => DESTINATION[d]).join(" e ")}.`, ok: true };
	} catch (error) {
		console.error("[venda] reenvio manual falhou", safeErrorMessage(error));
		return { error: "Não foi possível reenviar. Tente de novo.", ok: false };
	}
}
