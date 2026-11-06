CREATE TABLE "video_views" (
	"completed" boolean DEFAULT false NOT NULL,
	"cta_s" integer,
	"duration_s" integer DEFAULT 0 NOT NULL,
	"id" bigserial PRIMARY KEY NOT NULL,
	"max_position_s" integer DEFAULT 0 NOT NULL,
	"page_url" text,
	"trck_user_id" text NOT NULL,
	"video_id" text NOT NULL,
	"video_title" text,
	"view_id" text NOT NULL,
	"watched_s" integer DEFAULT 0 NOT NULL,
	"utm_campaign" text,
	"utm_content" text,
	"utm_medium" text,
	"utm_source" text,
	"utm_term" text,
	"geo_city" text,
	"geo_country" text,
	"geo_region" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_views_view_id_unique" UNIQUE("view_id"),
	CONSTRAINT "video_views_seconds_check" CHECK ("video_views"."duration_s" >= 0 and "video_views"."max_position_s" >= 0 and "video_views"."watched_s" >= 0 and ("video_views"."cta_s" is null or "video_views"."cta_s" >= 0))
);
--> statement-breakpoint
CREATE INDEX "video_views_video_started_idx" ON "video_views" USING btree ("video_id","started_at");--> statement-breakpoint
CREATE INDEX "video_views_started_at_idx" ON "video_views" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "video_views_trck_user_id_idx" ON "video_views" USING btree ("trck_user_id");--> statement-breakpoint
-- RLS ligada e forçada; app_service escreve (rota /api/video), app_reader lê (aba Vídeos).
SELECT app_private.secure_table('public.video_views', true);
