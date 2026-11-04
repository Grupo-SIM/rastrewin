CREATE TABLE "events_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"trck_user_id" text NOT NULL,
	"event_name" text NOT NULL,
	"event_id" text NOT NULL,
	"event_source_url" text,
	"value" numeric(14, 2),
	"currency" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"payload_meta" jsonb,
	"response_meta" jsonb,
	"payload_ga4" jsonb,
	"response_ga4" jsonb,
	"ip" "inet",
	"user_agent" text,
	"geo_country" text,
	"geo_region" text,
	"geo_city" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_log_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "ga4_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"measurement_id" text NOT NULL,
	"api_secret_enc" "bytea" NOT NULL,
	"api_secret_hint" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_test_at" timestamp with time zone,
	"last_test_status" text,
	"last_test_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ga4_accounts_measurement_id_unique" UNIQUE("measurement_id"),
	CONSTRAINT "ga4_measurement_id_format" CHECK ("ga4_accounts"."measurement_id" ~ '^G-[A-Z0-9]{4,20}$')
);
--> statement-breakpoint
CREATE TABLE "meta_ad_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"ad_account_id" text NOT NULL,
	"ads_token_enc" "bytea" NOT NULL,
	"ads_token_hint" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_test_at" timestamp with time zone,
	"last_test_status" text,
	"last_test_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meta_ad_accounts_ad_account_id_unique" UNIQUE("ad_account_id"),
	CONSTRAINT "meta_ad_account_id_format" CHECK ("meta_ad_accounts"."ad_account_id" ~ '^[0-9]{5,25}$')
);
--> statement-breakpoint
CREATE TABLE "meta_insights_cache" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ad_account_id" text NOT NULL,
	"cache_key" text NOT NULL,
	"level" text NOT NULL,
	"since" date,
	"until" date,
	"data" jsonb NOT NULL,
	"usage" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meta_insights_cache_cache_key_unique" UNIQUE("cache_key")
);
--> statement-breakpoint
CREATE TABLE "meta_pixels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"pixel_id" text NOT NULL,
	"capi_token_enc" "bytea" NOT NULL,
	"capi_token_hint" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_test_at" timestamp with time zone,
	"last_test_status" text,
	"last_test_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meta_pixels_pixel_id_unique" UNIQUE("pixel_id"),
	CONSTRAINT "meta_pixel_id_format" CHECK ("meta_pixels"."pixel_id" ~ '^[0-9]{5,25}$')
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"trck_user_id" text,
	"email" text,
	"em_hash" text,
	"ph_hash" text,
	"fn_hash" text,
	"ln_hash" text,
	"product" text,
	"items" jsonb,
	"value" numeric(14, 2) NOT NULL,
	"net_value" numeric(14, 2),
	"currency" text NOT NULL,
	"status" text NOT NULL,
	"payment_method" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"src" text,
	"fbp" text,
	"fbc" text,
	"fbclid" text,
	"geo_country" text,
	"geo_region" text,
	"geo_city" text,
	"match" jsonb,
	"meta_event_id" text,
	"meta_sent_at" timestamp with time zone,
	"payload_meta" jsonb,
	"response_meta" jsonb,
	"ga_client_id" text,
	"ga_session_id" text,
	"ga4_sent_at" timestamp with time zone,
	"payload_ga4" jsonb,
	"response_ga4" jsonb,
	"webhook_raw" jsonb,
	"approved_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchases_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"webhook_token_enc" "bytea",
	"webhook_token_hint" text,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"test_event_code" text,
	"allowed_origins" text[] DEFAULT '{}'::text[] NOT NULL,
	"checkout_domains" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_singleton" CHECK ("settings"."id" = 1),
	CONSTRAINT "settings_currency_iso" CHECK ("settings"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "visitors" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"trck_user_id" text NOT NULL,
	"email" text,
	"em_hash" text,
	"ph_hash" text,
	"fn_hash" text,
	"ln_hash" text,
	"fbp" text,
	"fbc" text,
	"ga_client_id" text,
	"ga_session_id" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"referrer" text,
	"landing_url" text,
	"ip" "inet",
	"user_agent" text,
	"geo_country" text,
	"geo_region" text,
	"geo_city" text,
	"pixel_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visitors_trck_user_id_unique" UNIQUE("trck_user_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'simintpay' NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"order_id" text,
	"signature_valid" boolean NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	CONSTRAINT "webhook_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_log_trck_user_id_idx" ON "events_log" USING btree ("trck_user_id");--> statement-breakpoint
CREATE INDEX "events_log_event_name_idx" ON "events_log" USING btree ("event_name");--> statement-breakpoint
CREATE INDEX "events_log_created_at_idx" ON "events_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "events_log_event_name_created_at_idx" ON "events_log" USING btree ("event_name","created_at");--> statement-breakpoint
CREATE INDEX "meta_insights_cache_account_fetched_idx" ON "meta_insights_cache" USING btree ("ad_account_id","fetched_at");--> statement-breakpoint
CREATE INDEX "purchases_trck_user_id_idx" ON "purchases" USING btree ("trck_user_id");--> statement-breakpoint
CREATE INDEX "purchases_status_idx" ON "purchases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "purchases_created_at_idx" ON "purchases" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "purchases_utm_campaign_idx" ON "purchases" USING btree ("utm_campaign");--> statement-breakpoint
CREATE INDEX "visitors_em_hash_idx" ON "visitors" USING btree ("em_hash");--> statement-breakpoint
CREATE INDEX "visitors_ph_hash_idx" ON "visitors" USING btree ("ph_hash");--> statement-breakpoint
CREATE INDEX "visitors_created_at_idx" ON "visitors" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "webhook_events_order_id_idx" ON "webhook_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "webhook_events_received_at_idx" ON "webhook_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");