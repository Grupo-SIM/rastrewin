import assert from "node:assert/strict";
import { test } from "node:test";
import { videoSchema } from "./schemas";
import { videoProgress } from "./video-progress";

const base = {
	duration: 600,
	page_url: "https://vsl.rastrewin.com/?utm_source=fb",
	position: 95,
	trck_user_id: "abc123def456ghi7",
	video_id: "vimeo:1243006876",
	view_id: "0f8e2a1c-1234-4cde-9abc-1234567890ab",
	watched: 90,
};

test("videoSchema: play válido passa; id, segundos e campos extras são validados", () => {
	assert.equal(videoSchema.safeParse(base).success, true);
	assert.equal(videoSchema.safeParse({ ...base, video_id: "1243006876" }).success, false);
	assert.equal(videoSchema.safeParse({ ...base, video_id: "vimeo:<script>" }).success, false);
	assert.equal(videoSchema.safeParse({ ...base, duration: 21_601 }).success, false);
	assert.equal(videoSchema.safeParse({ ...base, position: -1 }).success, false);
	assert.equal(videoSchema.safeParse({ ...base, page_url: "javascript:alert(1)" }).success, false);
	assert.equal(videoSchema.safeParse({ ...base, trck_user_id: "x" }).success, false);
	assert.equal(videoSchema.parse(base).ended, false);
	assert.equal(videoSchema.parse({ ...base, cta: 150 }).cta, 150);
	assert.equal(videoSchema.safeParse({ ...base, cta: -5 }).success, false);
});

test("videoProgress: arredonda e não passa da duração", () => {
	assert.deepEqual(videoProgress({ duration: 600.4, position: 95.6, watched: 90.2 }), {
		completed: false,
		durationS: 600,
		maxPositionS: 96,
		watchedS: 90,
	});
	assert.deepEqual(videoProgress({ duration: 600, position: 700, watched: 650 }), {
		completed: true,
		durationS: 600,
		maxPositionS: 600,
		watchedS: 600,
	});
});

test("videoProgress: fim avisado pelo player conta como concluído na duração", () => {
	const p = videoProgress({ duration: 600, ended: true, position: 598, watched: 580 });
	assert.deepEqual([p.completed, p.maxPositionS, p.watchedS], [true, 600, 580]);
	// último segundo também conclui
	assert.equal(videoProgress({ duration: 600, position: 599, watched: 590 }).completed, true);
});

test("videoProgress: sem duração conhecida, não limita nem conclui", () => {
	assert.deepEqual(videoProgress({ duration: 0, position: 30, watched: 30 }), {
		completed: false,
		durationS: 0,
		maxPositionS: 30,
		watchedS: 30,
	});
});
