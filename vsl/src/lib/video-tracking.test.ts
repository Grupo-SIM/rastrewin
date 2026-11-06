import { afterEach, describe, expect, it, vi } from "vitest";
import { dueForReport, reportVideo, VIDEO_REPORT_EVERY_MS, videoPayload } from "./video-tracking";

const state = {
	cta: 150,
	duration: 600.4,
	maxPosition: 95.6,
	title: "VSL",
	videoId: "1243006876",
	watched: 90.2,
};

describe("videoPayload", () => {
	it("monta o id com o provedor e arredonda os segundos", () => {
		expect(videoPayload(state)).toEqual({
			cta: 150,
			duration: 600,
			ended: false,
			id: "vimeo:1243006876",
			position: 96,
			title: "VSL",
			watched: 90,
		});
	});

	it("nunca passa da duração e o fim vale a duração inteira", () => {
		expect(videoPayload({ ...state, maxPosition: 700, watched: 650 })).toMatchObject({
			position: 600,
			watched: 600,
		});
		expect(videoPayload({ ...state, ended: true, maxPosition: 598 })).toMatchObject({
			ended: true,
			position: 600,
		});
	});

	it("valores inválidos viram zero", () => {
		expect(
			videoPayload({
				...state,
				duration: Number.NaN,
				maxPosition: -3,
				watched: Number.POSITIVE_INFINITY,
			}),
		).toMatchObject({
			duration: 0,
			position: 0,
			watched: 0,
		});
	});
});

describe("dueForReport", () => {
	it("só depois do intervalo", () => {
		expect(dueForReport(10_000, 0)).toBe(false);
		expect(dueForReport(VIDEO_REPORT_EVERY_MS, 0)).toBe(true);
	});
});

describe("reportVideo", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("chama trck('video', …) quando o t.js existe", () => {
		const trck = vi.fn();
		vi.stubGlobal("window", { trck });
		reportVideo(state);
		expect(trck).toHaveBeenCalledWith("video", expect.objectContaining({ id: "vimeo:1243006876" }));
	});

	it("sem t.js ou com erro no t.js, não quebra", () => {
		vi.stubGlobal("window", {});
		expect(() => reportVideo(state)).not.toThrow();
		vi.stubGlobal("window", {
			trck: () => {
				throw new Error("falhou");
			},
		});
		expect(() => reportVideo(state)).not.toThrow();
	});
});
