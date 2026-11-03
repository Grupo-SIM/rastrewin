/**
 * Testa a retenção diária (app_private.run_retention + job do pg_cron). Termina com código 1 se algo falhar.
 *
 *   npm run test:retention
 *
 * Conecta como DONO do banco (MIGRATION_DATABASE_URL), igual ao pg_cron.
 * Cria eventos com o prefixo "retention-test-" e apaga só eles no final.
 * A procedure roda de verdade: eventos REAIS com mais de 14 dias também têm os payloads zerados,
 * que é o comportamento esperado em produção.
 */
import { Client } from "pg";

const PREFIX = "retention-test-";
const results: { name: string; ok: boolean; detail?: string }[] = [];
const record = (name: string, ok: boolean, detail?: string) => results.push({ name, ok, detail });

async function main() {
  const ownerUrl = process.env.MIGRATION_DATABASE_URL;
  if (!ownerUrl) throw new Error("Defina MIGRATION_DATABASE_URL");
  const db = new Client({ connectionString: ownerUrl, application_name: "rastrewin:test-retention" });
  await db.connect();

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

    const job = (
      await db.query("select schedule, command, database, active from cron.job where jobname = 'rastrewin-retencao'")
    ).rows[0] as { schedule: string; command: string; database: string; active: boolean } | undefined;
    record(
      "job do pg_cron agendado (06:15 UTC = 03:15 Brasília) neste banco",
      job?.schedule === "15 6 * * *" && job.command === "CALL app_private.run_retention()" && job.active === true && job.database === (await db.query("select current_database() as d")).rows[0].d,
      JSON.stringify(job),
    );

    const exec = (
      await db.query(
        `select r.rolname, has_function_privilege(r.rolname, 'app_private.run_retention(integer,integer,integer)', 'EXECUTE') as can
           from pg_roles r where r.rolname in ('app_login', 'app_service', 'app_reader')`,
      )
    ).rows as { rolname: string; can: boolean }[];
    record("papéis do app NÃO executam a retenção", exec.length === 3 && exec.every((r) => !r.can), JSON.stringify(exec));
  } finally {
    await db.query("delete from events_log where event_id like $1", [`${PREFIX}%`]);
    await db.end();
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
