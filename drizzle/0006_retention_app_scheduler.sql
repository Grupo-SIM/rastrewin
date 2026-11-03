-- Retenção agendada pelo APP, em Postgres padrão (sem pg_cron).
--
-- O app (src/lib/maintenance/retention.ts, ligado no instrumentation.ts) confere a cada 15 min se a
-- limpeza do dia já rodou. Se não rodou desde as 03:15 de Brasília, ele chama a procedure como app_service,
-- com uma trava (pg_try_advisory_lock) para nunca rodar duas ao mesmo tempo. Se o app ficar fora do ar
-- no horário, a limpeza roda assim que ele voltar.
--
-- app_service já pode UPDATE/DELETE nessas tabelas (policy service_all), então executar a procedure
-- não aumenta o acesso dele. app_reader e app_login continuam sem permissão.

-- O banco não precisa mais do pg_cron. Remove a extensão onde ela existir (o job some junto).
-- DROP EXTENSION não chama a biblioteca do pg_cron, então funciona mesmo depois da troca para a imagem padrão.
DROP EXTENSION IF EXISTS pg_cron;
--> statement-breakpoint

-- Mesma procedure da 0005; só muda o texto do erro de execução interrompida.
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
     SET status = 'erro', finished_at = pg_catalog.now(), error = 'interrompida antes de terminar (ver os logs do app: [retenção])'
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
GRANT USAGE ON SCHEMA app_private TO app_service;
--> statement-breakpoint
GRANT EXECUTE ON PROCEDURE app_private.run_retention(integer, integer, integer) TO app_service;
