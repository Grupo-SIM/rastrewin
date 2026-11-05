ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "is_renewal" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
SELECT app_private.secure_table('public.purchases', true);
