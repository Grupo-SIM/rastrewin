-- =============================================================================
-- Verificação de segurança do banco do track — SÓ LEITURA (nada é alterado).
--
-- Rode como DONO do banco (o mesmo usuário das migrations), por exemplo na VPS:
--   docker exec -i <container-do-postgres> psql -U <dono> -d <banco> < track/scripts/security-check.sql
--
-- Cada linha sai com OK, ATENÇÃO ou FALHA. Tudo roda numa transação READ ONLY desfeita no final.
-- Ao criar uma migration nova, atualize o número em "as esperado_migrations" (o
-- `bun run security:check` avisa se ele ficar diferente do drizzle/meta/_journal.json).
-- =============================================================================
\set ON_ERROR_STOP on
\pset footer off
begin transaction read only;

with
params as (select 10 as esperado_migrations),
tabelas as (
  select c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity,
         exists (select 1 from pg_policy p where p.polrelid = c.oid and p.polname = 'reader_select') as painel_le
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
colunas as (
  select t.relname, a.attname, t.painel_le,
         a.attname like '%\_enc' escape '\' as cifrada,
         has_column_privilege('app_reader', t.oid, a.attnum, 'SELECT') as leitor_le
  from tabelas t join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
),
papeis as (
  select rolname, rolsuper, rolbypassrls, rolinherit, rolcanlogin
  from pg_roles where rolname in ('app_login', 'app_service', 'app_reader')
),
checks (ordem, verificacao, resultado) as (
  select 1, 'RLS ligada e FORÇADA em todas as tabelas',
    coalesce('FALHA: ' || (select string_agg(relname, ', ') from tabelas
      where not relrowsecurity or not relforcerowsecurity), 'OK')
  union all
  select 2, 'app_reader lê todas as colunas não cifradas das tabelas do painel',
    coalesce('FALHA (rode de novo o secure_table da migration): ' || (select string_agg(relname || '.' || attname, ', ')
      from colunas where painel_le and not cifrada and not leitor_le), 'OK')
  union all
  select 3, 'app_reader NÃO lê colunas *_enc nem tabelas de login',
    coalesce('FALHA: ' || (select string_agg(relname || '.' || attname, ', ')
      from colunas where leitor_le and (cifrada or not painel_le)), 'OK')
  union all
  select 4, 'papéis app_login/app_service/app_reader existem',
    case when (select count(*) from papeis) = 3 then 'OK' else 'FALHA' end
  union all
  select 5, 'nenhum papel do app é superusuário ou ignora RLS',
    coalesce('FALHA: ' || (select string_agg(rolname, ', ') from papeis where rolsuper or rolbypassrls), 'OK')
  union all
  select 6, 'app_login é NOINHERIT; app_service e app_reader não fazem login',
    case when (select not rolinherit from papeis where rolname = 'app_login')
          and not exists (select 1 from papeis where rolname <> 'app_login' and rolcanlogin)
         then 'OK' else 'FALHA' end
  union all
  select 7, 'PUBLIC não conecta no banco',
    case when has_database_privilege('public', current_database(), 'CONNECT') then 'FALHA' else 'OK' end
  union all
  select 8, 'migrations aplicadas (esperado: ' || (select esperado_migrations from params) || ')',
    (select case when count(*) = (select esperado_migrations from params) then 'OK: ' else 'FALHA: ' end
            || count(*) || ' aplicada(s)' from drizzle.__drizzle_migrations)
  union all
  select 9, 'código de teste da Meta vazio e debug do GA4 desligado',
    (select case when coalesce(test_event_code, '') = '' and not ga4_debug then 'OK'
                 else 'ATENÇÃO: test_event_code=' || coalesce(nullif(test_event_code, ''), '—') || ', ga4_debug=' || ga4_debug end
     from settings where id = 1)
  union all
  select 10, 'origens autorizadas só em https',
    (select coalesce('ATENÇÃO: ' || string_agg(o, ', '), 'OK')
     from settings s, unnest(s.allowed_origins) as o
     where s.id = 1 and o not like 'https://%')
  union all
  select 11, 'limpeza diária rodou nas últimas 26 h',
    (select case when max(started_at) > now() - interval '26 hours' then 'OK' else 'ATENÇÃO: última em ' || coalesce(max(started_at)::text, 'nunca') end
     from maintenance_runs where error is null)
)
select verificacao, resultado from checks order by ordem;

rollback;
