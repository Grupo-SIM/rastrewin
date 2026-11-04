import { describe, expect, it } from "vitest";
import {
	advanceWatchProgress,
	initialWatchProgress,
	STEP_TOLERANCE_SECONDS,
	type WatchProgress,
} from "./watch-progress";

const TICK = 0.25;

/** Leituras a cada TICK segundos de tempo real (aba em primeiro plano). */
const feed = (positions: number[], start: WatchProgress = initialWatchProgress) =>
	positions.reduce((progress, position) => advanceWatchProgress(progress, position, TICK), start);

describe("advanceWatchProgress", () => {
	it("soma a reprodução normal", () => {
		expect(feed([0, 0.25, 0.5, 0.75, 1]).watchedSeconds).toBeCloseTo(1);
	});

	it("a primeira leitura só marca a posição", () => {
		expect(feed([42])).toEqual({ lastPosition: 42, watchedSeconds: 0 });
	});

	it("não conta pulo para frente", () => {
		expect(feed([0, 1, 120, 121]).watchedSeconds).toBeCloseTo(2);
	});

	it("não conta volta nem recomeço do vídeo", () => {
		expect(feed([10, 11, 2, 3]).watchedSeconds).toBeCloseTo(2);
	});

	it("não conta tempo parado (pausa)", () => {
		expect(feed([5, 5, 5, 5]).watchedSeconds).toBe(0);
	});

	it("aceita um avanço no limite e ignora acima dele", () => {
		const limit = TICK + STEP_TOLERANCE_SECONDS;
		expect(feed([0, limit]).watchedSeconds).toBe(limit);
		expect(feed([0, limit + 0.01]).watchedSeconds).toBe(0);
	});

	it("conta a aba em segundo plano, com leituras espaçadas pelo navegador", () => {
		const start = feed([10]);
		const afterMinute = advanceWatchProgress(start, 70, 60);
		expect(afterMinute.watchedSeconds).toBe(60);
		// Mesmo espaçamento, mas avanço maior que o tempo real: pulo.
		expect(advanceWatchProgress(start, 200, 60).watchedSeconds).toBe(0);
	});

	it("trata tempo real inválido como zero (só a folga vale)", () => {
		const start = feed([0]);
		expect(advanceWatchProgress(start, 1, Number.NaN).watchedSeconds).toBe(1);
		expect(advanceWatchProgress(start, 30, -5).watchedSeconds).toBe(0);
	});

	it("ignora leituras inválidas", () => {
		const before = feed([3]);
		expect(advanceWatchProgress(before, Number.NaN, TICK)).toBe(before);
		expect(advanceWatchProgress(before, -1, TICK)).toBe(before);
	});
});
