CREATE TABLE "privacy_erasures" (
	"counts" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"em_hash" text,
	"ga_client_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"ga_done_at" timestamp with time zone,
	"id" bigserial PRIMARY KEY NOT NULL,
	"ph_hash" text
);
--> statement-breakpoint
CREATE INDEX "privacy_erasures_em_hash_idx" ON "privacy_erasures" USING btree ("em_hash");--> statement-breakpoint
CREATE INDEX "privacy_erasures_ph_hash_idx" ON "privacy_erasures" USING btree ("ph_hash");--> statement-breakpoint
-- RLS ligada e forçada; app_service escreve (/api/privacy/erase), app_reader lê (Configurações › Privacidade).
SELECT app_private.secure_table('public.privacy_erasures', true);
