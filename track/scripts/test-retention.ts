/**
 * Testa a retenção diária: a procedure app_private.run_retention e o executor do app
 * (src/lib/maintenance/retention.ts, com trava). Termina com código 1 se algo falhar.
 *
 *   npm run test:retention
 *
 * Usa o DONO do banco (MIGRATION_DATABASE_URL) para preparar dados e conferir, e a conexão REAL do app
 * (DATABASE_URL → app_login → app_service, com RLS) para rodar o executor, igual em produção.
 * Cria eventos com o prefixo "retention-test-" e apaga só eles no final.
 * A procedure roda de verdade: eventos REAIS com mais de 14 dias também têm os payloads zerados,
 * que é o comportamento esperado em produção.
 */
import { Client, Pool } from "pg";
import { RETENTION_LOCK_KEY, runRetentionIfDue } from "../src/lib/maintenance/retention";

const PREFIX = "retention-test-";
const results: { name: string; ok: boolean; detail?: string }[] = [];
const record = (name: string, ok: boolean, detail?: string) => results.push({ name, ok, detail });

async function main() {
  const ownerUrl = process.env.MIGRATION_DATABASE_URL;
  const appUrl = process.env.DATABASE_URL;
  if (!ownerUrl || !appUrl) throw new Error("Defina MIGRATION_DATABASE_URL e DATABASE_URL");
  const db = new Client({ connectionString: ownerUrl, application_name: "rastrewin:test-retention" });
  await db.connect();
  const app = new Pool({ connectionString: appUrl, max: 2, options: "-c role=app_service", application_name: "rastrewin:test-retention-app" });

  const payload = JSON.stringify({ data: [{ event_name: "PageView" }] });
  try {
    await db.query(
      `insert into events_log (trck_user_id, event_name, event_id, utm_source, geo_region, payload_meta, response_meta, payload_ga4, response_ga4, created_at)
       values
         ($1 || 'old',   'PageView', $1 || 'old-1',   'facebook', 'SP', $2::jsonb, $2::jsonb, $2::jsonb, $2::jsonb, now() - interval '20 days'),
         ($1 || 'edge',  'PageView', $1 || 'edge-1',  'facebook', 'SP', $2::jsonb, null,      null,      null,      now() - interval '14 days 1 hour'),
         ($1 || 'young', 'PageView', $1 || 'young-1', 'facebook', 'SP', $2::jsonb, $2::jsonb, $2::jsonb, $2::jsonb, now() - interval '2 days')`,
      [PREFIX, payload],
    );
    const before = Number((await db.query("select coalesce(max(id), 0) as id from maintenance_runs")).rows[0].id);

    // Lote de 1 para exercitar o laço com COMMIT entre lotes.
    await db.query("CALL app_private.run_retention(14, 1)");

    const rows = (
      await db.query(
        `select event_id, utm_source, geo_region, created_at,
                payload_meta is null and response_meta is null and payload_ga4 is null and response_ga4 is null as cleared
           from events_log where event_id like $1 order by event_id`,
        [`${PREFIX}%`],
      )
    ).rows as { event_id: string; utm_source: string; geo_region: string; cleared: boolean }[];
    const byId = Object.fromEntries(rows.map((r) => [r.event_id.slice(PREFIX.length), r]));

    record("as 3 linhas continuam existindo (a retenção não apaga eventos)", rows.length === 3);
    record("evento de 20 dias: payloads/respostas zerados", byId["old-1"]?.cleared === true);
    record("evento de 14 dias e 1 hora: payload zerado", byId["edge-1"]?.cleared === true);
    record("evento de 2 dias: intacto", byId["young-1"]?.cleared === false);
    record(
      "UTM e geo continuam nas linhas limpas",
      byId["old-1"]?.utm_source === "facebook" && byId["old-1"]?.geo_region === "SP",
    );

    const run = (
      await db.query("select status, rows_payloads, finished_at from maintenance_runs where id > $1 order by id desc limit 1", [before])
    ).rows[0] as { status: string; rows_payloads: number; finished_at: Date | null } | undefined;
    record("execução registrada em maintenance_runs com status ok", run?.status === "ok" && !!run.finished_at, JSON.stringify(run));
    record("contagem de linhas limpas >= 2", (run?.rows_payloads ?? 0) >= 2, `rows_payloads=${run?.rows_payloads}`);

    const again = Number((await db.query("select coalesce(max(id), 0) as id from maintenance_runs")).rows[0].id);
    await db.query("CALL app_private.run_retention()");
    const second = (await db.query("select rows_payloads from maintenance_runs where id > $1 order by id desc limit 1", [again])).rows[0];
    record("segunda execução não relê o que já foi limpo (0 linhas)", second?.rows_payloads === 0, JSON.stringify(second));

    try {
      await db.query("CALL app_private.run_retention(0)");
      record("parâmetro inválido (0 dias) é recusado", false);
    } catch {
      record("parâmetro inválido (0 dias) é recusado", true);
    }

    const exec = (
      await db.query(
        `select r.rolname, has_function_privilege(r.rolname, 'app_private.run_retention(integer,integer,integer)', 'EXECUTE') as can
           from pg_roles r where r.rolname in ('app_login', 'app_service', 'app_reader')`,
      )
    ).rows as { rolname: string; can: boolean }[];
    const can = Object.fromEntries(exec.map((r) => [r.rolname, r.can]));
    record(
      "só app_service executa a retenção (app_reader e app_login não)",
      can.app_service === true && can.app_reader === false && can.app_login === false,
      JSON.stringify(can),
    );
    record(
      "banco sem pg_cron (Postgres padrão)",
      Number((await db.query("select count(*) as n from pg_extension where extname = 'pg_cron'")).rows[0].n) === 0,
    );

    // ---------------------------------------------------------------- executor do app (conexão real, app_service + RLS)
    await db.query("update events_log set payload_meta = $2::jsonb where event_id like $1", [`${PREFIX}%`, payload]);
    await db.query("update events_log set created_at = now() - interval '20 days' where event_id = $1", [`${PREFIX}young-1`]);

    await db.query("select pg_advisory_lock($1)", [RETENTION_LOCK_KEY]);
    const locked = await runRetentionIfDue(app, { force: true });
    record("com outra limpeza rodando (trava ocupada), o executor não roda", locked.outcome === "locked", JSON.stringify(locked));
    await db.query("select pg_advisory_unlock($1)", [RETENTION_LOCK_KEY]);

    const ran = await runRetentionIfDue(app, { force: true });
    record("executor roda como app_service e limpa os 3 eventos", ran.outcome === "ran" && ran.rowsPayloads >= 3, JSON.stringify(ran));
    const left = Number(
      (await db.query("select count(*) as n from events_log where event_id like $1 and payload_meta is not null", [`${PREFIX}%`])).rows[0].n,
    );
    record("nenhum payload antigo sobrou", left === 0, `restaram ${left}`);

    const notDue = await runRetentionIfDue(app);
    record("sem force: já rodou desde o último horário → não roda de novo", notDue.outcome === "not-due", JSON.stringify(notDue));

    const [a, b] = await Promise.all([runRetentionIfDue(app, { force: true }), runRetentionIfDue(app, { force: true })]);
    const outcomes = [a.outcome, b.outcome].sort().join(",");
    record("duas ao mesmo tempo: nunca rodam juntas", outcomes === "locked,ran" || outcomes === "ran,ran", outcomes);

    const free = (await db.query("select pg_try_advisory_lock($1) as ok", [RETENTION_LOCK_KEY])).rows[0].ok as boolean;
    if (free) await db.query("select pg_advisory_unlock($1)", [RETENTION_LOCK_KEY]);
    record("a trava é sempre liberada no fim", free === true);
  } finally {
    await db.query("delete from events_log where event_id like $1", [`${PREFIX}%`]);
    await db.end();
    await app.end();
  }

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.detail && !r.ok ? `  — ${r.detail}` : ""}`);
  }
  console.log(`\n${results.length - failed}/${results.length} verificações passaram`);
  if (failed) process.exit(1);
}

main().catch((error: unknown) => {
  console.error("✗ erro ao rodar o teste:", error instanceof Error ? error.message : error);
  process.exit(1);
});
