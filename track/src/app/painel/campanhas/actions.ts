"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { settings } from "@/db/schema";
import { refreshNow } from "@/lib/campaigns/cache";
import { listAdAccounts } from "@/lib/campaigns/query";
import { readAsUser, requireSession } from "@/lib/dal";
import { resolvePeriod } from "@/lib/dashboard/period";
import { DEFAULT_TIMEZONE } from "@/lib/time";

const input = z.object({
	ate: z.string().max(10).nullish(),
	conta: z
		.string()
		.regex(/^\d{5,25}$/)
		.nullish(),
	de: z.string().max(10).nullish(),
	periodo: z.string().max(10).nullish(),
});

/** "Atualizar agora": busca na Meta respeitando o cooldown de 15 min por conta. */
export async function refreshCampaigns(raw: unknown): Promise<{ ok: boolean; message: string }> {
	await requireSession();
	const params = input.parse(raw);
	const tz = await readAsUser(async tx => {
		const [row] = await tx
			.select({ timezone: settings.timezone })
			.from(settings)
			.where(eq(settings.id, 1));
		return row?.timezone ?? DEFAULT_TIMEZONE;
	});
	const period = resolvePeriod(params, tz);
	const accounts = (await listAdAccounts()).filter(a => !params.conta || a.adAccountId === params.conta);
	if (!accounts.length) return { message: "Nenhuma conta de anúncio ativa.", ok: false };

	const notices = await Promise.all(accounts.map(a => refreshNow(a, period.from, period.to, period.days)));
	refresh();
	const errors = notices.map((n, i) => (n ? `${accounts[i].label}: ${n}` : null)).filter(Boolean);
	return errors.length
		? { message: errors.join(" "), ok: false }
		: { message: "Dados atualizados com a Meta.", ok: true };
}
