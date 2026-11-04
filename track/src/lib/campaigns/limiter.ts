/*
 * Limite PRÓPRIO de chamadas à Insights API — bem abaixo do da Meta.
 * (Conta em development_access: 600 pontos/h e bloqueio de 5 min.)
 * Regras por conta: ≥ 10 s entre chamadas, ≤ 20 chamadas/h, pausa de 15 min se o uso
 * informado pela Meta passar de 50% ou vier erro de limite; "Atualizar agora" a cada 15 min.
 */
export const MIN_INTERVAL_MS = 10_000;
export const MAX_PER_HOUR = 20;
export const PAUSE_MS = 15 * 60_000;
export const MANUAL_COOLDOWN_MS = 15 * 60_000;
export const USAGE_PAUSE_PCT = 50;

export interface LimiterState {
	calls: number[];
	pausedUntil: number;
	lastManualAt: number;
}
export const emptyState = (): LimiterState => ({ calls: [], lastManualAt: 0, pausedUntil: 0 });

export type Decision =
	{ ok: true } | { ok: false; reason: "pausa" | "intervalo" | "hora" | "cooldown"; retryAt: number };

export function canCall(state: LimiterState, now: number, manual = false): Decision {
	if (state.pausedUntil > now) return { ok: false, reason: "pausa", retryAt: state.pausedUntil };
	if (manual && now - state.lastManualAt < MANUAL_COOLDOWN_MS)
		return { ok: false, reason: "cooldown", retryAt: state.lastManualAt + MANUAL_COOLDOWN_MS };
	const last = state.calls.at(-1) ?? 0;
	if (now - last < MIN_INTERVAL_MS)
		return { ok: false, reason: "intervalo", retryAt: last + MIN_INTERVAL_MS };
	const recent = state.calls.filter(t => now - t < 3_600_000);
	if (recent.length >= MAX_PER_HOUR) return { ok: false, reason: "hora", retryAt: recent[0] + 3_600_000 };
	return { ok: true };
}

export function recordCall(state: LimiterState, now: number, manual = false): LimiterState {
	return {
		calls: [...state.calls.filter(t => now - t < 3_600_000), now],
		lastManualAt: manual ? now : state.lastManualAt,
		pausedUntil: state.pausedUntil,
	};
}

export function pause(state: LimiterState, now: number): LimiterState {
	return { ...state, pausedUntil: now + PAUSE_MS };
}

/** Maior % de uso informado pela Meta nos headers (BUC, conta e Insights). */
export function usagePct(usage: {
	app?: unknown;
	businessUseCase?: unknown;
	adAccount?: unknown;
	insights?: unknown;
}): number {
	const pcts: number[] = [];
	const push = (v: unknown) => typeof v === "number" && Number.isFinite(v) && pcts.push(v);
	const buc = usage.businessUseCase as
		Record<string, { call_count?: number; total_cputime?: number; total_time?: number }[]> | undefined;
	if (buc && typeof buc === "object")
		for (const list of Object.values(buc))
			for (const u of list ?? []) [u.call_count, u.total_cputime, u.total_time].forEach(push);
	const acc = usage.adAccount as { acc_id_util_pct?: number } | undefined;
	push(acc?.acc_id_util_pct);
	const ins = usage.insights as { app_id_util_pct?: number; acc_id_util_pct?: number } | undefined;
	push(ins?.app_id_util_pct);
	push(ins?.acc_id_util_pct);
	const app = usage.app as { call_count?: number; total_cputime?: number; total_time?: number } | undefined;
	if (app) [app.call_count, app.total_cputime, app.total_time].forEach(push);
	return pcts.length ? Math.max(...pcts) : 0;
}

/** Códigos de erro de limite da Meta (pausar). */
export const THROTTLE_CODES = new Set([4, 17, 32, 613, 80000, 80003, 80004, 80014]);
