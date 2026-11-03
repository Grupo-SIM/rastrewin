ALTER TABLE "settings" ADD COLUMN "timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL;
--> statement-breakpoint
SELECT app_private.secure_table('public.settings', true);
