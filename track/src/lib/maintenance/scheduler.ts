import "server-only";
import { serviceDb } from "@/db";
import { safeErrorMessage } from "@/lib/errors";
import { RETENTION_CHECK_MS, runRetentionIfDue } from "./retention";

/*
 * Liga a limpeza diária dentro do app (chamado pelo instrumentation.ts).
 * Primeira conferência 1 min depois de subir (recupera uma noite perdida), depois a cada 15 min.
 */
const g = globalThis as unknown as { __retentionStarted?: boolean; __retentionRunning?: boolean };

async function tick() {
	if (g.__retentionRunning) return;
	g.__retentionRunning = true;
	try {
		const result = await runRetentionIfDue(serviceDb().$client);
		if (result.outcome === "ran") {
			console.log(
				`[retenção] limpeza concluída em ${result.ms} ms: ${result.rowsPayloads} eventos limpos, ${result.rowsSessions} sessões removidas, ${result.rowsCache} caches removidos`,
			);
		}
	} catch (error) {
		console.error("[retenção] falhou (nova tentativa em 1 h)", safeErrorMessage(error));
	} finally {
		g.__retentionRunning = false;
	}
}

export function startRetentionLoop() {
	if (g.__retentionStarted) return;
	g.__retentionStarted = true;
	setTimeout(tick, 60_000).unref();
	setInterval(tick, RETENTION_CHECK_MS).unref();
}
