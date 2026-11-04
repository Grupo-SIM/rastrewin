import type { Pool } from "pg";
import { safeErrorMessage } from "../errors";

/*
 * Limpeza diária agendada pelo APP (Postgres padrão, sem pg_cron).
 *
 * A cada 15 min o app chama runRetentionIfDue(). A limpeza roda se ainda não houve execução OK desde
 * o último horário marcado (03:15 de Brasília = 06:15 UTC). Se o app estava fora do ar no horário,
 * ela roda assim que ele voltar. Depois de uma falha, tenta de novo 1 h depois.
 *
 * A trava pg_try_advisory_lock (por sessão; vale entre os COMMITs da procedure) impede duas limpezas
 * ao mesmo tempo, mesmo com várias instâncias do app. Ela é sempre liberada no fim. Se a liberação
 * falhar, a conexão é descartada, e fechar a conexão também solta a trava.
 *
 * Sem "server-only": o scripts/test-retention.ts usa este módulo com a conexão real do app.
 * Só recebe um Pool já aberto como app_service; não lê env nem segredo.
 */

/** Horário da limpeza em UTC (03:15 em Brasília, que não tem horário de verão desde 2019). */
export const RETENTION_SLOT_UTC = { hour: 6, minute: 15 } as const;
/** Chave fixa da trava (pg_advisory_lock). */
export const RETENTION_LOCK_KEY = 726_401_115;
/** De quanto em quanto tempo o app confere se a limpeza do dia já rodou. */
export const RETENTION_CHECK_MS = 15 * 60 * 1000;
/** Depois de uma tentativa (que falhou ou ficou pela metade), espera isto antes de tentar de novo. */
const RETRY_AFTER_MS = 60 * 60 * 1000;

function slotOf(day: Date): Date {
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), RETENTION_SLOT_UTC.hour, RETENTION_SLOT_UTC.minute));
}

/** Último horário marcado que já passou (≤ now). */
export function previousSlot(now: Date): Date {
  const slot = slotOf(now);
  if (slot > now) slot.setUTCDate(slot.getUTCDate() - 1);
  return slot;
}

/** Próximo horário marcado (> now). */
export function nextSlot(now: Date): Date {
  const slot = slotOf(now);
  if (slot <= now) slot.setUTCDate(slot.getUTCDate() + 1);
  return slot;
}

/** A limpeza deve rodar agora? */
export function isRetentionDue(now: Date, last: { lastOkAt: Date | null; lastAttemptAt: Date | null }): boolean {
  if (last.lastOkAt && last.lastOkAt >= previousSlot(now)) return false;
  if (last.lastAttemptAt && now.getTime() - last.lastAttemptAt.getTime() < RETRY_AFTER_MS) return false;
  return true;
}

export type RetentionResult =
  | { outcome: "ran"; rowsPayloads: number; rowsSessions: number; rowsCache: number; ms: number }
  | { outcome: "not-due" | "locked" };

/**
 * Roda a limpeza se estiver na hora (ou sempre, com force) e se nenhuma outra estiver rodando.
 * `pool` deve conectar como app_service. Erros da procedure sobem para quem chamou.
 */
export async function runRetentionIfDue(pool: Pool, opts: { force?: boolean; now?: Date } = {}): Promise<RetentionResult> {
  const client = await pool.connect();
  let broken: Error | undefined;
  try {
    const lock = await client.query<{ ok: boolean }>("select pg_try_advisory_lock($1) as ok", [RETENTION_LOCK_KEY]);
    if (!lock.rows[0]?.ok) return { outcome: "locked" };
    try {
      if (!opts.force) {
        const last = await client.query<{ last_ok: Date | null; last_attempt: Date | null }>(
          `select max(started_at) filter (where status = 'ok') as last_ok, max(started_at) as last_attempt
             from public.maintenance_runs where job = 'retencao'`,
        );
        const row = last.rows[0];
        if (!isRetentionDue(opts.now ?? new Date(), { lastOkAt: row?.last_ok ?? null, lastAttemptAt: row?.last_attempt ?? null })) {
          return { outcome: "not-due" };
        }
      }
      const started = Date.now();
      try {
        // Fora de transação: a procedure dá COMMIT entre os lotes.
        await client.query("CALL app_private.run_retention()");
      } catch (error) {
        // Com a trava na mão, qualquer execução "running" é esta: marca a falha já (o painel mostra).
        await client
          .query(
            `update public.maintenance_runs set status = 'erro', finished_at = now(), error = $1
              where job = 'retencao' and status = 'running'`,
            [safeErrorMessage(error).slice(0, 500)],
          )
          .catch(() => {});
        throw error;
      }
      const run = await client.query<{ rows_payloads: number; rows_sessions: number; rows_cache: number }>(
        `select rows_payloads, rows_sessions, rows_cache from public.maintenance_runs
          where job = 'retencao' order by started_at desc limit 1`,
      );
      const r = run.rows[0];
      return { outcome: "ran", rowsPayloads: r?.rows_payloads ?? 0, rowsSessions: r?.rows_sessions ?? 0, rowsCache: r?.rows_cache ?? 0, ms: Date.now() - started };
    } finally {
      await client.query("select pg_advisory_unlock($1)", [RETENTION_LOCK_KEY]);
    }
  } catch (error) {
    // Conexão descartada: se a trava não foi liberada, fechar a sessão libera.
    broken = error instanceof Error ? error : new Error(String(error));
    throw error;
  } finally {
    client.release(broken);
  }
}
