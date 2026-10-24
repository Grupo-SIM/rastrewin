/**
 * Conta o tempo efetivamente assistido a partir da posição do vídeo, lida em intervalos curtos.
 * Só soma avanços pequenos (reprodução normal): pulos para frente, voltas e recomeços não contam.
 */

/** Maior avanço aceito entre duas leituras. Acima disso é pulo (ou aba congelada) e não conta. */
export const MAX_STEP_SECONDS = 2;

export type WatchProgress = {
  watchedSeconds: number;
  lastPosition: number | null;
};

export const initialWatchProgress: WatchProgress = { watchedSeconds: 0, lastPosition: null };

export function advanceWatchProgress(progress: WatchProgress, position: number): WatchProgress {
  if (!Number.isFinite(position) || position < 0) return progress;
  if (progress.lastPosition === null) return { ...progress, lastPosition: position };

  const step = position - progress.lastPosition;
  const counted = step > 0 && step <= MAX_STEP_SECONDS ? step : 0;
  return { watchedSeconds: progress.watchedSeconds + counted, lastPosition: position };
}
