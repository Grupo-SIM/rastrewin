ALTER TABLE "maintenance_runs" ADD COLUMN "details" jsonb;--> statement-breakpoint
CREATE INDEX "events_log_client_retention_idx" ON "events_log" USING btree ("created_at") WHERE "events_log"."ip" is not null or "events_log"."user_agent" is not null;--> statement-breakpoint
CREATE INDEX "visitors_updated_at_idx" ON "visitors" USING btree ("updated_at");--> statement-breakpoint
-- Retenção LGPD (prazos em src/lib/maintenance/retention.ts → RETENTION_DAYS; os padrões abaixo são os mesmos).
-- Além do que já fazia (payloads de 14 dias, sessões, cache, histórico), a limpeza diária agora:
--   2. zera IP e navegador (events_log e visitors) com mais de 90 dias;
--   3. troca o corpo bruto do webhook (webhook_events.payload, purchases.webhook_raw) com mais de 90 dias;
--   4. apaga visitantes sem atividade há 13 meses (os eventos ficam, com o id aleatório sem ligação com a pessoa);
--   5. anonimiza os dados pessoais das vendas com mais de 5 anos (valor, data, status e produto ficam);
--   6. apaga registros de consentimento com mais de 5 anos;
--   7. apaga os hashes de quem pediu exclusão depois de 30 dias (ficam data e contagens).
-- Contagens de cada etapa em maintenance_runs.details. Teste: npm run test:retention.

-- A coluna nova (details) precisa do GRANT por coluna para o painel ler.
SELECT app_private.secure_table('public.maintenance_runs', true);
--> statement-breakpoint
-- Dono do banco (rodar à mão sem ser superusuário): mesmas policies da 0005, nas tabelas novas da limpeza.
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['public.visitors', 'public.webhook_events', 'public.purchases', 'public.consent_records', 'public.privacy_erasures']
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
DROP PROCEDURE IF EXISTS app_private.run_retention(integer, integer, integer);
--> statement-breakpoint
-- PROCEDURE sem SECURITY DEFINER e sem SET search_path (os dois impedem COMMIT): todo nome qualificado.
CREATE PROCEDURE app_private.run_retention(
  p_days integer DEFAULT 14,
  p_batch integer DEFAULT 5000,
  p_max_batches integer DEFAULT 400,
  p_client_days integer DEFAULT 90,
  p_raw_days integer DEFAULT 90,
  p_visitor_days integer DEFAULT 395,
  p_sale_pii_days integer DEFAULT 1825,
  p_consent_days integer DEFAULT 1825,
  p_erasure_hash_days integer DEFAULT 30
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_run bigint;
  v_n integer;
  v_batches integer;
  v_payloads integer := 0;
  v_sessions integer := 0;
  v_verif integer := 0;
  v_cache integer := 0;
  v_ip_events integer := 0;
  v_ip_visitors integer := 0;
  v_raw_webhook integer := 0;
  v_raw_sales integer := 0;
  v_visitors integer := 0;
  v_sales integer := 0;
  v_consents integer := 0;
  v_erasures integer := 0;
BEGIN
  IF p_days IS NULL OR p_days < 1 OR p_batch IS NULL OR p_batch < 1
     OR p_client_days IS NULL OR p_client_days < 8          -- a CAPI aceita compras de até 7 dias
     OR p_raw_days IS NULL OR p_raw_days < 1
     OR p_visitor_days IS NULL OR p_visitor_days < 30
     OR p_sale_pii_days IS NULL OR p_sale_pii_days < 30
     OR p_consent_days IS NULL OR p_consent_days < 30
     OR p_erasure_hash_days IS NULL OR p_erasure_hash_days < 1 THEN
    RAISE EXCEPTION 'parâmetros inválidos (p_days=%, p_batch=%, p_client_days=%, p_raw_days=%, p_visitor_days=%, p_sale_pii_days=%, p_consent_days=%, p_erasure_hash_days=%)',
      p_days, p_batch, p_client_days, p_raw_days, p_visitor_days, p_sale_pii_days, p_consent_days, p_erasure_hash_days;
  END IF;

  -- Execução anterior que morreu no meio: COMMITs parciais deixam o status em "running".
  UPDATE public.maintenance_runs
     SET status = 'erro', finished_at = pg_catalog.now(), error = 'interrompida antes de terminar (ver os logs do app: [retenção])'
   WHERE status = 'running' AND started_at < pg_catalog.now() - interval '1 hour';

  INSERT INTO public.maintenance_runs (job) VALUES ('retencao') RETURNING id INTO v_run;
  COMMIT;

  -- 1. Campos pesados do events_log, em lotes (índice parcial events_log_retention_idx).
  v_batches := 0;
  LOOP
    UPDATE public.events_log
       SET payload_meta = NULL, response_meta = NULL, payload_ga4 = NULL, response_ga4 = NULL
     WHERE id IN (
       SELECT e.id FROM public.events_log e
        WHERE e.created_at < pg_catalog.now() - pg_catalog.make_interval(days => p_days)
          AND (e.payload_meta IS NOT NULL OR e.response_meta IS NOT NULL OR e.payload_ga4 IS NOT NULL OR e.response_ga4 IS NOT NULL)
        ORDER BY e.created_at LIMIT p_batch);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_payloads := v_payloads + v_n;
    v_batches := v_batches + 1;
    UPDATE public.maintenance_runs SET rows_payloads = v_payloads WHERE id = v_run;
    COMMIT;
    EXIT WHEN v_n < p_batch OR v_batches >= p_max_batches;
  END LOOP;

  -- 2. IP e navegador dos eventos, em lotes (índice parcial events_log_client_retention_idx), e dos visitantes.
  v_batches := 0;
  LOOP
    UPDATE public.events_log SET ip = NULL, user_agent = NULL
     WHERE id IN (
       SELECT e.id FROM public.events_log e
        WHERE e.created_at < pg_catalog.now() - pg_catalog.make_interval(days => p_client_days)
          AND (e.ip IS NOT NULL OR e.user_agent IS NOT NULL)
        ORDER BY e.created_at LIMIT p_batch);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_ip_events := v_ip_events + v_n;
    v_batches := v_batches + 1;
    COMMIT;
    EXIT WHEN v_n < p_batch OR v_batches >= p_max_batches;
  END LOOP;
  UPDATE public.visitors SET ip = NULL, user_agent = NULL
   WHERE updated_at < pg_catalog.now() - pg_catalog.make_interval(days => p_client_days)
     AND (ip IS NOT NULL OR user_agent IS NOT NULL);
  GET DIAGNOSTICS v_ip_visitors = ROW_COUNT;
  COMMIT;

  -- 3. Corpo bruto do webhook (traz email, nome e telefone do comprador).
  UPDATE public.webhook_events SET payload = '{"redacted": true}'::jsonb
   WHERE received_at < pg_catalog.now() - pg_catalog.make_interval(days => p_raw_days)
     AND payload <> '{"redacted": true}'::jsonb;
  GET DIAGNOSTICS v_raw_webhook = ROW_COUNT;
  UPDATE public.purchases SET webhook_raw = NULL
   WHERE updated_at < pg_catalog.now() - pg_catalog.make_interval(days => p_raw_days)
     AND webhook_raw IS NOT NULL;
  GET DIAGNOSTICS v_raw_sales = ROW_COUNT;
  COMMIT;

  -- 4. Visitantes sem atividade: a linha some (email, hashes, fbc/fbp, ids do GA). Em lotes.
  v_batches := 0;
  LOOP
    DELETE FROM public.visitors
     WHERE id IN (
       SELECT v.id FROM public.visitors v
        WHERE v.updated_at < pg_catalog.now() - pg_catalog.make_interval(days => p_visitor_days)
        ORDER BY v.updated_at LIMIT p_batch);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_visitors := v_visitors + v_n;
    v_batches := v_batches + 1;
    COMMIT;
    EXIT WHEN v_n < p_batch OR v_batches >= p_max_batches;
  END LOOP;

  -- 5. Dados pessoais das vendas antigas: fica o que o faturamento precisa (valor, data, status, produto, UTMs).
  UPDATE public.purchases SET
    email = NULL, em_hash = NULL, ph_hash = NULL, fn_hash = NULL, ln_hash = NULL,
    fbc = NULL, fbp = NULL, fbclid = NULL, src = NULL, trck_user_id = NULL,
    ga_client_id = NULL, ga_session_id = NULL, geo_city = NULL,
    payload_meta = NULL, response_meta = NULL, payload_ga4 = NULL, response_ga4 = NULL, refund_response_ga4 = NULL,
    webhook_raw = NULL, updated_at = pg_catalog.now()
   WHERE COALESCE(occurred_at, created_at) < pg_catalog.now() - pg_catalog.make_interval(days => p_sale_pii_days)
     AND (email IS NOT NULL OR em_hash IS NOT NULL OR ph_hash IS NOT NULL OR fn_hash IS NOT NULL OR ln_hash IS NOT NULL
          OR fbc IS NOT NULL OR fbp IS NOT NULL OR fbclid IS NOT NULL OR src IS NOT NULL OR trck_user_id IS NOT NULL
          OR ga_client_id IS NOT NULL OR geo_city IS NOT NULL);
  GET DIAGNOSTICS v_sales = ROW_COUNT;
  COMMIT;

  -- 6. Prova de consentimento antiga.
  DELETE FROM public.consent_records
   WHERE created_at < pg_catalog.now() - pg_catalog.make_interval(days => p_consent_days);
  GET DIAGNOSTICS v_consents = ROW_COUNT;

  -- 7. Hashes de quem pediu exclusão: só serviam para anonimizar vendas a caminho.
  UPDATE public.privacy_erasures SET em_hash = NULL, ph_hash = NULL
   WHERE created_at < pg_catalog.now() - pg_catalog.make_interval(days => p_erasure_hash_days)
     AND (em_hash IS NOT NULL OR ph_hash IS NOT NULL);
  GET DIAGNOSTICS v_erasures = ROW_COUNT;
  COMMIT;

  -- 8. Login: sessões e verificações vencidas.
  DELETE FROM public.session WHERE expires_at < pg_catalog.now() - interval '1 day';
  GET DIAGNOSTICS v_sessions = ROW_COUNT;
  DELETE FROM public.verification WHERE expires_at < pg_catalog.now() - interval '1 day';
  GET DIAGNOSTICS v_verif = ROW_COUNT;

  -- 9. Cache de insights da Meta antigo.
  DELETE FROM public.meta_insights_cache WHERE fetched_at < pg_catalog.now() - interval '30 days';
  GET DIAGNOSTICS v_cache = ROW_COUNT;

  -- 10. Histórico de execuções: guarda 180 dias.
  DELETE FROM public.maintenance_runs WHERE started_at < pg_catalog.now() - interval '180 days';

  UPDATE public.maintenance_runs
     SET status = 'ok', finished_at = pg_catalog.now(),
         rows_sessions = v_sessions + v_verif, rows_cache = v_cache,
         details = pg_catalog.jsonb_build_object(
           'ip_eventos', v_ip_events, 'ip_visitantes', v_ip_visitors,
           'webhook_bruto', v_raw_webhook + v_raw_sales, 'visitantes_apagados', v_visitors,
           'vendas_anonimizadas', v_sales, 'consentimentos_apagados', v_consents,
           'exclusoes_sem_hash', v_erasures)
   WHERE id = v_run;
  COMMIT;
END
$$;
--> statement-breakpoint
REVOKE ALL ON PROCEDURE app_private.run_retention(integer, integer, integer, integer, integer, integer, integer, integer, integer) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON PROCEDURE app_private.run_retention(integer, integer, integer, integer, integer, integer, integer, integer, integer) TO app_service;
