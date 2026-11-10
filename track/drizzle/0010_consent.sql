CREATE TABLE "consent_records" (
	"action" text NOT NULL,
	"consent_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" bigserial PRIMARY KEY NOT NULL,
	"marketing" boolean NOT NULL,
	"origin" text,
	"page_path" text,
	"trck_user_id" text,
	"version" text NOT NULL,
	CONSTRAINT "consent_records_action_check" CHECK ("consent_records"."action" in ('accept_all', 'reject_all', 'custom', 'revoke'))
);
--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "marketing_consent" boolean;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "consent_texts" jsonb;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "consent_version" text DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "privacy_policy_url" text;--> statement-breakpoint
ALTER TABLE "visitors" ADD COLUMN "consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "visitors" ADD COLUMN "consent_marketing" boolean;--> statement-breakpoint
CREATE INDEX "consent_records_consent_id_idx" ON "consent_records" USING btree ("consent_id");--> statement-breakpoint
CREATE INDEX "consent_records_trck_user_id_idx" ON "consent_records" USING btree ("trck_user_id");--> statement-breakpoint
CREATE INDEX "consent_records_created_at_idx" ON "consent_records" USING btree ("created_at");--> statement-breakpoint
-- RLS ligada e forçada; app_service escreve (/api/consent), app_reader lê (Configurações › Privacidade).
SELECT app_private.secure_table('public.consent_records', true);
--> statement-breakpoint
-- Colunas novas em tabelas existentes: secure_table de novo refaz os GRANTs por coluna do app_reader
-- (sem isso o painel não lê as colunas novas — incidente da 0007).
SELECT app_private.secure_table('public.purchases', true);
--> statement-breakpoint
SELECT app_private.secure_table('public.settings', true);
--> statement-breakpoint
SELECT app_private.secure_table('public.visitors', true);
