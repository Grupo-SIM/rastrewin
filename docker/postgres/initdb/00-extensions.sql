-- Executado só na PRIMEIRA inicialização do volume.
-- Papéis, RLS e tabelas ficam nas migrations do app (Fase 2).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;
