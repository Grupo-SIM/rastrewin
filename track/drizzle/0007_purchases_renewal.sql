ALTER TABLE "purchases" ADD COLUMN "is_renewal" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
SELECT app_private.secure_table('public.purchases', true);
