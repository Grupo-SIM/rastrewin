CREATE TABLE "maintenance_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"rows_payloads" integer DEFAULT 0 NOT NULL,
	"rows_sessions" integer DEFAULT 0 NOT NULL,
	"rows_cache" integer DEFAULT 0 NOT NULL,
	"error" text,
	CONSTRAINT "maintenance_runs_status" CHECK ("maintenance_runs"."status" in ('running', 'ok', 'erro'))
);
--> statement-breakpoint
CREATE INDEX "maintenance_runs_started_idx" ON "maintenance_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "events_log_retention_idx" ON "events_log" USING btree ("created_at") WHERE "events_log"."payload_meta" is not null or "events_log"."response_meta" is not null or "events_log"."payload_ga4" is not null or "events_log"."response_ga4" is not null;