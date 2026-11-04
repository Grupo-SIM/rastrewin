ALTER TABLE "purchases" ADD COLUMN "occurred_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "meta_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "ga4_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "last_delivery_error" text;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "refund_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "refund_response_ga4" jsonb;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "ga4_debug" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Colunas novas precisam entrar nos grants de coluna do app_reader (segredos *_enc continuam fora).
SELECT app_private.secure_table('public.settings', true);
--> statement-breakpoint
SELECT app_private.secure_table('public.purchases', true);
