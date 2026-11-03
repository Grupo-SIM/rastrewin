-- Retenção diária (Fase 8).
--
-- Todo dia às 03:15 de Brasília (06:15 UTC; o pg_cron roda em UTC), o pg_cron chama
-- app_private.run_retention(), que:
--   1. zera os campos pesados do events_log (payload/resposta da Meta e do GA4) com mais de 14 dias.
--      A LINHA FICA: evento, UTMs, geo e datas continuam nos relatórios;
--   2. apaga sessões de login e verificações vencidas há mais de 1 dia;
--   3. apaga o cache de insights da Meta com mais de 30 dias;
--   4. registra a execução em maintenance_runs (o painel mostra em Configurações › Geral).
--
-- Rodar à mão (como dono do banco):  CALL app_private.run_retention();
-- Teste:                              npm run test:retention

-- A tabela de execuções segue a regra de todas as outras: RLS forçada; o painel lê com sessão válida.
SELECT app_private.secure_table('public.maintenance_runs', true);
--> statement-breakpoint

-- Policies para o DONO do banco (quem roda o job). Superusuário já ignora a RLS. Se o dono não for
-- superusuário (ex.: Postgres gerenciado), a RLS forçada também vale para ele e o bloquearia.
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['public.events_log', 'public.session', 'public.verification', 'public.meta_insights_cache', 'public.maintenance_runs']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS owner_maintenance ON %s', tbl);
    EXECUTE format(
      'CREATE POLICY owner_maintenance ON %s AS PERMISSIVE FOR ALL TO %I USING (true) WITH CHECK (true)',
      tbl, current_user
    );
  END LOOP;
END
$$;
--> statement-breakpoint

-- Procedure, e não function, para dar COMMIT entre os lotes e manter cada lock curto.
-- Ela não tem SECURITY DEFINER nem SET search_path, porque os dois impedem COMMIT dentro da procedure.
-- Por isso todos os nomes são qualificados com o schema.
CREATE OR REPLACE PROCEDURE app_private.run_retention(
  p_days integer DEFAULT 14,
  p_batch integer DEFAULT 5000,
  p_max_batches integer DEFAULT 400
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_run bigint;
  v_n integer;
  v_payloads integer := 0;
  v_batches integer := 0;
  v_sessions integer := 0;
  v_verif integer := 0;
  v_cache integer := 0;
BEGIN
  IF p_days IS NULL OR p_days < 1 OR p_batch IS NULL OR p_batch < 1 THEN
    RAISE EXCEPTION 'parâmetros inválidos (p_days=%, p_batch=%)', p_days, p_batch;
  END IF;

  -- Execução anterior que morreu no meio: COMMITs parciais deixam o status em "running".
  UPDATE public.maintenance_runs
     SET status = 'erro', finished_at = pg_catalog.now(), error = 'interrompida antes de terminar (ver cron.job_run_details)'
   WHERE status = 'running' AND started_at < pg_catalog.now() - interval '1 hour';

  INSERT INTO public.maintenance_runs (job) VALUES ('retencao') RETURNING id INTO v_run;
  COMMIT;

  -- 1. Campos pesados do events_log, em lotes (o índice parcial events_log_retention_idx só cobre linhas com payload).
  LOOP
    UPDATE public.events_log
       SET payload_meta = NULL, response_meta = NULL, payload_ga4 = NULL, response_ga4 = NULL
     WHERE id IN (
       SELECT e.id
         FROM public.events_log e
        WHERE e.created_at < pg_catalog.now() - pg_catalog.make_interval(days => p_days)
          AND (e.payload_meta IS NOT NULL OR e.response_meta IS NOT NULL OR e.payload_ga4 IS NOT NULL OR e.response_ga4 IS NOT NULL)
        ORDER BY e.created_at
        LIMIT p_batch
     );
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_payloads := v_payloads + v_n;
    v_batches := v_batches + 1;
    UPDATE public.maintenance_runs SET rows_payloads = v_payloads WHERE id = v_run;
    COMMIT;
    EXIT WHEN v_n < p_batch OR v_batches >= p_max_batches;
  END LOOP;

  -- 2. Login: sessões e verificações vencidas (a sessão expirada já não dá acesso; isto só limpa).
  DELETE FROM public.session WHERE expires_at < pg_catalog.now() - interval '1 day';
  GET DIAGNOSTICS v_sessions = ROW_COUNT;
  DELETE FROM public.verification WHERE expires_at < pg_catalog.now() - interval '1 day';
  GET DIAGNOSTICS v_verif = ROW_COUNT;

  -- 3. Cache de insights da Meta antigo (o cache válido dura no máximo 12 h).
  DELETE FROM public.meta_insights_cache WHERE fetched_at < pg_catalog.now() - interval '30 days';
  GET DIAGNOSTICS v_cache = ROW_COUNT;

  -- 4. Histórico de execuções: guarda 180 dias.
  DELETE FROM public.maintenance_runs WHERE started_at < pg_catalog.now() - interval '180 days';

  UPDATE public.maintenance_runs
     SET status = 'ok', finished_at = pg_catalog.now(),
         rows_sessions = v_sessions + v_verif, rows_cache = v_cache
   WHERE id = v_run;
  COMMIT;
END
$$;
--> statement-breakpoint
REVOKE ALL ON PROCEDURE app_private.run_retention(integer, integer, integer) FROM PUBLIC;
--> statement-breakpoint

-- Agendamento. Um job com nome é substituído se já existir, então a migration é idempotente.
-- O banco é o desta migration, mesmo que cron.database_name aponte para outro.
CREATE EXTENSION IF NOT EXISTS pg_cron;
--> statement-breakpoint
SELECT cron.schedule_in_database(
  'rastrewin-retencao',
  '15 6 * * *',
  'CALL app_private.run_retention()',
  current_database()
);
