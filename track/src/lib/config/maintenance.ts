import "server-only";
import { desc } from "drizzle-orm";
import type { ReaderTx } from "@/db";
import { maintenanceRuns } from "@/db/schema";
import { clientIp, ipSource } from "@/lib/http/client-ip";
import { nextSlot, RETENTION_DAYS } from "@/lib/maintenance/retention";
import type { MaintenanceView } from "./types";

/** Roda todo dia às 03:15: mais de 36 h sem rodar = perdeu uma noite (com folga para atrasos). */
const STALE_MS = 36 * 60 * 60 * 1000;
const RUNNING_LIMIT_MS = 60 * 60 * 1000;

export function maintenanceHealth(
	run: { status: string; startedAt: Date } | null,
	now: Date,
): MaintenanceView["health"] {
	if (!run) return "nunca";
	const age = now.getTime() - run.startedAt.getTime();
	if (run.status === "erro") return "erro";
	if (run.status === "running") return age > RUNNING_LIMIT_MS ? "erro" : "rodando";
	return age > STALE_MS ? "atrasada" : "ok";
}

/** Lê a última execução (dentro da transação readAsUser da tela) e monta o diagnóstico de IP. */
export async function getMaintenanceView(
	tx: ReaderTx,
	requestHeaders: Headers,
	production: boolean,
): Promise<MaintenanceView> {
	const [run] = await tx
		.select({
			details: maintenanceRuns.details,
			error: maintenanceRuns.error,
			finishedAt: maintenanceRuns.finishedAt,
			rowsCache: maintenanceRuns.rowsCache,
			rowsPayloads: maintenanceRuns.rowsPayloads,
			rowsSessions: maintenanceRuns.rowsSessions,
			startedAt: maintenanceRuns.startedAt,
			status: maintenanceRuns.status,
		})
		.from(maintenanceRuns)
		.orderBy(desc(maintenanceRuns.startedAt))
		.limit(1);

	const now = new Date();
	const health = maintenanceHealth(run ?? null, now);
	return {
		health,
		ip: clientIp(requestHeaders),
		ipSource: ipSource(requestHeaders),
		lastRun: run
			? {
					details: (run.details as Record<string, number> | null) ?? null,
					error:
						run.status === "running" && health === "erro"
							? "Interrompida antes de terminar."
							: run.error,
					finishedAt: run.finishedAt?.toISOString() ?? null,
					rowsCache: run.rowsCache,
					rowsPayloads: run.rowsPayloads,
					rowsSessions: run.rowsSessions,
					startedAt: run.startedAt.toISOString(),
				}
			: null,
		nextRunAt: nextSlot(now).toISOString(),
		production,
		retention: RETENTION_DAYS,
	};
}
