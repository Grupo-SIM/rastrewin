ALTER TABLE "visitors" ADD COLUMN "is_test" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "visitors" ADD COLUMN "test_marked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "visitors_test_idx" ON "visitors" USING btree ("trck_user_id") WHERE "visitors"."is_test";
--> statement-breakpoint
-- Colunas novas: secure_table de novo refaz os GRANTs por coluna do app_reader (sem isso o painel não as lê).
SELECT app_private.secure_table('public.visitors', true);
