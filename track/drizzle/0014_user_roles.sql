-- Níveis de acesso ao painel (plugin admin do Better Auth): "admin" ou "colaborador".
-- Compatível com o código anterior: só ADICIONA colunas, com padrão. Testada em Postgres 15 e 18.
-- user e session: RLS e grants reaplicados no fim (app_reader continua sem ler tabelas de login).
ALTER TABLE "session" ADD COLUMN "impersonated_by" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_expires" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'colaborador' NOT NULL;--> statement-breakpoint
-- Quem já existia tinha acesso total: vira Administrador. Novos usuários nascem Colaborador.
UPDATE "user" SET "role" = 'admin';--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_check" CHECK ("user"."role" in ('admin', 'colaborador'));
--> statement-breakpoint
-- Reaplica RLS, policies e grants das tabelas alteradas (regra do security:check, incidente da 0007).
-- Tabelas de login: o painel (app_reader) continua SEM ler.
SELECT app_private.secure_table('public."user"', false);--> statement-breakpoint
SELECT app_private.secure_table('public.session', false);
