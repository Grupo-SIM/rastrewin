ALTER TABLE "events_log" ADD COLUMN "affiliate_code" text;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "affiliate_code" text;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "affiliate_commission" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "affiliate_name" text;--> statement-breakpoint
ALTER TABLE "video_views" ADD COLUMN "affiliate_code" text;--> statement-breakpoint
ALTER TABLE "visitors" ADD COLUMN "affiliate_code" text;--> statement-breakpoint
CREATE INDEX "purchases_affiliate_code_idx" ON "purchases" USING btree ("affiliate_code");
--> statement-breakpoint
-- Colunas novas: secure_table de novo refaz os GRANTs por coluna do app_reader (sem isso o painel não as lê).
SELECT app_private.secure_table('public.visitors', true);
--> statement-breakpoint
SELECT app_private.secure_table('public.events_log', true);
--> statement-breakpoint
SELECT app_private.secure_table('public.video_views', true);
--> statement-breakpoint
SELECT app_private.secure_table('public.purchases', true);
