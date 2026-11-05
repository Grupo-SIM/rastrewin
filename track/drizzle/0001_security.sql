-- =============================================================================
-- Segurança: papéis, RLS forçada, policies e grants por coluna.
-- Roda como DONO do banco (MIGRATION_DATABASE_URL), via scripts/migrate.ts.
--
--   app_login   LOGIN, NOINHERIT, sem privilégios próprios. É o usuário da DATABASE_URL.
--   app_service NOLOGIN. Escrita (código de servidor). Equivale ao "service_role".
--   app_reader  NOLOGIN. Só leitura no painel, e só com sessão válida em app.user_id.
--
-- Tabela nova em migration futura? Chame:
--   SELECT app_private.secure_table('public.minha_tabela', true);  -- true = painel lê
-- O script `npm run test:rls` falha se alguma tabela de public ficar sem RLS.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_service') THEN
    CREATE ROLE app_service NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_reader') THEN
    CREATE ROLE app_reader NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_login') THEN
    CREATE ROLE app_login LOGIN NOINHERIT;
  END IF;
END
$$;
--> statement-breakpoint
ALTER ROLE app_login NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
--> statement-breakpoint
ALTER ROLE app_service NOLOGIN NOSUPERUSER NOBYPASSRLS;
--> statement-breakpoint
ALTER ROLE app_reader NOLOGIN NOSUPERUSER NOBYPASSRLS;
--> statement-breakpoint
-- app_login só pode TROCAR para os papéis (SET ROLE); não herda os privilégios deles, porque é NOINHERIT.
-- Sem `WITH INHERIT FALSE, SET TRUE` (só existe no Postgres 16+): a produção roda no Postgres 15. No 16+,
-- o padrão do GRANT dá o mesmo resultado: INHERIT segue o NOINHERIT do app_login, e SET vem ligado.
GRANT app_service TO app_login;
--> statement-breakpoint
GRANT app_reader TO app_login;
--> statement-breakpoint

-- Banco: além do dono, só app_login conecta.
DO $$
BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_login', current_database());
END
$$;
--> statement-breakpoint
REVOKE ALL ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_service, app_reader;
--> statement-breakpoint

-- ----------------------------------------------------------------------------- helpers
CREATE SCHEMA IF NOT EXISTS app_private;
--> statement-breakpoint
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA app_private TO app_reader;
--> statement-breakpoint

-- Verdadeiro só se app.user_id tiver uma sessão NÃO expirada.
-- O servidor define app.user_id depois de validar a sessão. Este check repete a validação dentro do banco.
CREATE OR REPLACE FUNCTION app_private.has_valid_session()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.session s
    WHERE s.user_id = nullif(current_setting('app.user_id', true), '')
      AND s.expires_at > now()
  )
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.has_valid_session() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.has_valid_session() TO app_reader;
--> statement-breakpoint

-- Liga e FORÇA a RLS e recria as policies e grants de uma tabela.
-- Colunas terminadas em _enc (segredos cifrados) nunca ficam legíveis para app_reader.
CREATE OR REPLACE FUNCTION app_private.secure_table(tbl regclass, reader_can_read boolean)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  readable_cols text;
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', tbl);
  EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, app_service, app_reader, app_login', tbl);

  EXECUTE format('DROP POLICY IF EXISTS service_all ON %s', tbl);
  EXECUTE format(
    'CREATE POLICY service_all ON %s AS PERMISSIVE FOR ALL TO app_service USING (true) WITH CHECK (true)',
    tbl
  );
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %s TO app_service', tbl);

  EXECUTE format('DROP POLICY IF EXISTS reader_select ON %s', tbl);
  IF reader_can_read THEN
    SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum)
      INTO readable_cols
      FROM pg_attribute
     WHERE attrelid = tbl
       AND attnum > 0
       AND NOT attisdropped
       AND attname NOT LIKE '%\_enc' ESCAPE '\';
    EXECUTE format('GRANT SELECT (%s) ON TABLE %s TO app_reader', readable_cols, tbl);
    EXECUTE format(
      'CREATE POLICY reader_select ON %s AS PERMISSIVE FOR SELECT TO app_reader USING ((SELECT app_private.has_valid_session()))',
      tbl
    );
  END IF;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.secure_table(regclass, boolean) FROM PUBLIC;
--> statement-breakpoint

-- ----------------------------------------------------------------------------- tabelas
-- Dados do painel: app_reader lê (com sessão válida); app_service escreve.
SELECT app_private.secure_table('public.settings', true);
--> statement-breakpoint
SELECT app_private.secure_table('public.ga4_accounts', true);
--> statement-breakpoint
SELECT app_private.secure_table('public.meta_pixels', true);
--> statement-breakpoint
SELECT app_private.secure_table('public.meta_ad_accounts', true);
--> statement-breakpoint
SELECT app_private.secure_table('public.visitors', true);
--> statement-breakpoint
SELECT app_private.secure_table('public.events_log', true);
--> statement-breakpoint
SELECT app_private.secure_table('public.purchases', true);
--> statement-breakpoint
SELECT app_private.secure_table('public.webhook_events', true);
--> statement-breakpoint
SELECT app_private.secure_table('public.meta_insights_cache', true);
--> statement-breakpoint
-- Login (Better Auth): só app_service. O painel nunca lê essas tabelas diretamente.
SELECT app_private.secure_table('public."user"', false);
--> statement-breakpoint
SELECT app_private.secure_table('public.session', false);
--> statement-breakpoint
SELECT app_private.secure_table('public.account', false);
--> statement-breakpoint
SELECT app_private.secure_table('public.verification', false);
--> statement-breakpoint

-- has_valid_session() roda como o dono. Com a RLS forçada, o dono também precisa de policy
-- para ler a tabela session. Isso vale quando o dono não é superusuário (ex.: Postgres gerenciado).
DO $$
BEGIN
  EXECUTE format(
    'CREATE POLICY definer_read_session ON public.session AS PERMISSIVE FOR SELECT TO %I USING (true)',
    current_user
  );
END
$$;
--> statement-breakpoint

-- Sequências (bigserial) usadas nos INSERTs de app_service.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_service;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_service;
--> statement-breakpoint

-- Linha única de configuração.
INSERT INTO public.settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
