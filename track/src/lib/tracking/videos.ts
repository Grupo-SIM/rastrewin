import "server-only";
import { sql } from "drizzle-orm";
import { serviceDb } from "@/db";
import type { Geo } from "@/lib/geo";
import type { VideoInput } from "./schemas";
import { type VideoProgress, videoProgress } from "./video-progress";

/**
 * Grava/atualiza o resumo de um play (uma linha por view_id). Cada envio só AUMENTA o progresso:
 * um envio atrasado ou repetido nunca faz a pessoa "desassistir". UTMs vêm do visitante (se já existir);
 * geo, do IP no primeiro envio. Um view_id de outro visitante não é sobrescrito.
 */
export async function recordVideoView(input: VideoInput, geo: Geo): Promise<void> {
	const p: VideoProgress = videoProgress(input);
	await serviceDb().execute(sql`
    insert into video_views (
      view_id, trck_user_id, video_id, video_title, page_url,
      duration_s, max_position_s, watched_s, completed, cta_s,
      utm_campaign, utm_content, utm_medium, utm_source, utm_term,
      geo_city, geo_country, geo_region
    )
    select ${input.view_id}, ${input.trck_user_id}, ${input.video_id}, ${input.title}, ${input.page_url},
           ${p.durationS}, ${p.maxPositionS}, ${p.watchedS}, ${p.completed}, ${input.cta === undefined ? null : Math.round(input.cta)},
           v.utm_campaign, v.utm_content, v.utm_medium, v.utm_source, v.utm_term,
           ${geo.city}, ${geo.country}, ${geo.region}
    from (select 1) as one
    left join visitors v on v.trck_user_id = ${input.trck_user_id}
    on conflict (view_id) do update set
      duration_s = greatest(video_views.duration_s, excluded.duration_s),
      max_position_s = greatest(video_views.max_position_s, excluded.max_position_s),
      watched_s = greatest(video_views.watched_s, excluded.watched_s),
      completed = video_views.completed or excluded.completed,
      cta_s = coalesce(excluded.cta_s, video_views.cta_s),
      video_title = coalesce(excluded.video_title, video_views.video_title),
      updated_at = now()
    where video_views.trck_user_id = excluded.trck_user_id`);
}
