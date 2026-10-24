import { describe, expect, it } from "vitest";
import {
  advanceWatchProgress,
  initialWatchProgress,
  MAX_STEP_SECONDS,
  type WatchProgress,
} from "./watch-progress";

const feed = (positions: number[], start: WatchProgress = initialWatchProgress) =>
  positions.reduce(advanceWatchProgress, start);

describe("advanceWatchProgress", () => {
  it("soma a reprodução normal", () => {
    expect(feed([0, 0.25, 0.5, 0.75, 1]).watchedSeconds).toBeCloseTo(1);
  });

  it("a primeira leitura só marca a posição", () => {
    expect(feed([42])).toEqual({ watchedSeconds: 0, lastPosition: 42 });
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
    expect(feed([0, MAX_STEP_SECONDS]).watchedSeconds).toBe(MAX_STEP_SECONDS);
    expect(feed([0, MAX_STEP_SECONDS + 0.01]).watchedSeconds).toBe(0);
  });

  it("ignora leituras inválidas", () => {
    const before = feed([3]);
    expect(advanceWatchProgress(before, Number.NaN)).toBe(before);
    expect(advanceWatchProgress(before, -1)).toBe(before);
  });
});
