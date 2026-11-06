import "server-only";
import { sql } from "drizzle-orm";
import { ACTIVE_SALE, num, param, rows, type SearchParams, withDashboard } from "./context";
import { pageKey, pageKeySql } from "./page-url";
import type { Period } from "./period";
import { type Bin, retentionCurve, type RetentionPoint, stopBands } from "./video-stats";

/*
 * Aba Vídeos: um play = uma linha de video_views (um vídeo, num carregamento de página).
 * Plays contam pelo início (started_at) dentro do período. "Até onde chegou" = max_position_s.
 */

export interface VideoRow {
	videoId: string;
	title: string | null;
	pages: string[];
	plays: number;
	durationS: number;
	avgPct: number | null;
	avgWatchedS: number;
}
export interface VideoDetail {
	videoId: string;
	title: string | null;
	durationS: number;
	plays: number;
	people: number;
	pageViews: number;
	avgPct: number | null;
	avgWatchedS: number;
	completed: number;
	ctaS: number | null;
	reachedCta: number;
	buyers: number;
	curve: RetentionPoint[];
	bands: { label: string; value: number }[];
}
export interface VideosView {
	period: Period;
	videos: VideoRow[];
	selected: VideoDetail | null;
}

const toNum = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export function getVideos(sp: SearchParams): Promise<VideosView> {
	return withDashboard(sp, async ({ tx, period }) => {
		const { start: s, end: e } = period;
		const inPeriod = sql`started_at >= ${s} and started_at < ${e}`;

		const list = await rows<Record<string, unknown>>(
			tx,
			sql`
      select video_id,
             (array_agg(video_title order by updated_at desc) filter (where video_title is not null))[1] as title,
             array_agg(distinct page_url) filter (where page_url is not null) as pages,
             count(*) as plays,
             max(duration_s) as duration,
             avg(least(1, max_position_s::numeric / nullif(duration_s, 0))) as avg_pct,
             avg(watched_s) as avg_watched
      from video_views where ${inPeriod}
      group by video_id order by count(*) desc, video_id limit 50`,
		);
		const videos: VideoRow[] = list.map(r => ({
			avgPct: toNum(r.avg_pct),
			avgWatchedS: num(r.avg_watched),
			durationS: num(r.duration),
			pages: [...new Set(((r.pages as string[] | null) ?? []).map(pageKey))].sort(),
			plays: num(r.plays),
			title: (r.title as string | null) ?? null,
			videoId: String(r.video_id),
		}));

		const wanted = param(sp, "video");
		const pick = videos.find(v => v.videoId === wanted) ?? videos[0];
		if (!pick) return { period, selected: null, videos };

		const vid = sql`video_id = ${pick.videoId} and ${inPeriod}`;
		const [sum] = await rows<Record<string, unknown>>(
			tx,
			sql`
      select count(*) as plays, count(distinct trck_user_id) as people,
             avg(least(1, max_position_s::numeric / nullif(duration_s, 0))) as avg_pct,
             avg(watched_s) as avg_watched,
             count(*) filter (where completed) as completed,
             max(cta_s) as cta
      from video_views where ${vid}`,
		);
		const ctaS = toNum(sum?.cta);

		const [extra] = await rows<Record<string, unknown>>(
			tx,
			sql`
      with plays as (select * from video_views where ${vid}),
      pages as (select distinct ${pageKeySql(sql`page_url`)} as page from plays where page_url is not null)
      select
        (select count(*) from plays where ${ctaS === null ? sql`false` : sql`max_position_s >= ${ctaS}`}) as reached_cta,
        (select count(*) from events_log
          where event_name = 'PageView' and created_at >= ${s} and created_at < ${e}
            and ${pageKeySql(sql`event_source_url`)} in (select page from pages)) as page_views,
        (select count(distinct p.trck_user_id) from purchases p
          where p.status in ${ACTIVE_SALE} and not p.is_renewal
            and coalesce(p.occurred_at, p.created_at) >= ${s} and coalesce(p.occurred_at, p.created_at) < ${e}
            and p.trck_user_id in (select trck_user_id from plays)) as buyers`,
		);

		// Até onde cada play chegou, em % (sem duração conhecida, conta como 0%).
		const hist = await rows<{ bin: unknown; c: unknown }>(
			tx,
			sql`
      select coalesce(least(100, floor(100.0 * max_position_s / nullif(coalesce(nullif(duration_s, 0), ${pick.durationS}), 0))), 0)::int as bin,
             count(*) as c
      from video_views where ${vid} group by 1`,
		);
		const bins: Bin[] = hist.map(h => ({ bin: num(h.bin), count: num(h.c) }));

		return {
			period,
			selected: {
				avgPct: toNum(sum?.avg_pct),
				avgWatchedS: num(sum?.avg_watched),
				bands: stopBands(bins),
				buyers: num(extra?.buyers),
				completed: num(sum?.completed),
				ctaS,
				curve: retentionCurve(bins),
				durationS: pick.durationS,
				pageViews: num(extra?.page_views),
				people: num(sum?.people),
				plays: num(sum?.plays),
				reachedCta: num(extra?.reached_cta),
				title: pick.title,
				videoId: pick.videoId,
			},
			videos,
		};
	});
}
