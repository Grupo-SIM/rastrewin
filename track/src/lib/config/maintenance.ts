import "server-only";
import { desc } from "drizzle-orm";
import type { ReaderTx } from "@/db";
import { maintenanceRuns } from "@/db/schema";
import { clientIp, ipSource } from "@/lib/http/client-ip";
import { nextSlot } from "@/lib/maintenance/retention";
import type { MaintenanceView } from "./types";

/** Mesmo valor padrão da procedure (drizzle/0005_retention.sql). */
export const RETENTION_DAYS = 14;
const STALE_MS = 2 * 24 * 60 * 60 * 1000;
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
export async function getMaintenanceView(tx: ReaderTx, requestHeaders: Headers, production: boolean): Promise<MaintenanceView> {
  const [run] = await tx
    .select({
      status: maintenanceRuns.status,
      startedAt: maintenanceRuns.startedAt,
      finishedAt: maintenanceRuns.finishedAt,
      rowsPayloads: maintenanceRuns.rowsPayloads,
      rowsSessions: maintenanceRuns.rowsSessions,
      rowsCache: maintenanceRuns.rowsCache,
      error: maintenanceRuns.error,
    })
    .from(maintenanceRuns)
    .orderBy(desc(maintenanceRuns.startedAt))
    .limit(1);

  const now = new Date();
  const health = maintenanceHealth(run ?? null, now);
  return {
    health,
    lastRun: run
      ? {
          startedAt: run.startedAt.toISOString(),
          finishedAt: run.finishedAt?.toISOString() ?? null,
          rowsPayloads: run.rowsPayloads,
          rowsSessions: run.rowsSessions,
          rowsCache: run.rowsCache,
          error: run.status === "running" && health === "erro" ? "Interrompida antes de terminar." : run.error,
        }
      : null,
    nextRunAt: nextSlot(now).toISOString(),
    retentionDays: RETENTION_DAYS,
    ip: clientIp(requestHeaders),
    ipSource: ipSource(requestHeaders),
    production,
  };
}
