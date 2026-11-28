"use server";

import { eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { serviceDb } from "@/db";
import { visitors } from "@/db/schema";
import type { ActionResult } from "@/lib/config/types";
import { denyUnlessAdmin } from "@/lib/dal";
import { safeErrorMessage } from "@/lib/errors";
import { TRCK_ID } from "@/lib/tracking/schemas";

/*
 * Modo teste (plano 0008, decisão B): o Administrador marca ou desmarca o visitante como teste.
 * Marcado, os relatórios ignoram todo o histórico dele e nada novo vai à Meta nem ao GA4; o que já foi
 * enviado antes não volta. Server Action é endpoint público: começa com denyUnlessAdmin() e valida com Zod.
 */

const inputSchema = z.object({ id: z.string().regex(TRCK_ID), isTest: z.boolean() });

export async function setVisitorTest(id: string, isTest: boolean): Promise<ActionResult> {
	const denied = await denyUnlessAdmin();
	if (denied) return denied;
	const parsed = inputSchema.safeParse({ id, isTest });
	if (!parsed.success) return { error: "Visitante inválido.", ok: false };

	try {
		const updated = await serviceDb()
			.update(visitors)
			.set({
				isTest: parsed.data.isTest,
				testMarkedAt: parsed.data.isTest ? sql`now()` : null,
			})
			.where(eq(visitors.trckUserId, parsed.data.id))
			.returning({ id: visitors.id });
		if (!updated.length) return { error: "Visitante não encontrado.", ok: false };
	} catch (error) {
		console.error("[visitante] falha ao marcar teste", safeErrorMessage(error));
		return { error: "Não foi possível salvar. Tente de novo.", ok: false };
	}
	refresh();
	return {
		message: parsed.data.isTest
			? "Marcado como teste: fora dos números e dos envios."
			: "Voltou a ser um visitante comum.",
		ok: true,
	};
}
