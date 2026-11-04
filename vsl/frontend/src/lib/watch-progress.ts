/**
 * Conta o tempo efetivamente assistido a partir da posição do vídeo, lida em intervalos.
 * Só soma avanços compatíveis com o tempo real que passou entre as leituras (reprodução normal):
 * pulos para frente, voltas e recomeços não contam.
 */

/**
 * Folga além do tempo real entre leituras: a posição informada pelo YouTube chega com atraso e em saltos.
 * Avanço maior que "tempo real + folga" é pulo e não conta.
 */
export const STEP_TOLERANCE_SECONDS = 2;

export type WatchProgress = {
  watchedSeconds: number;
  lastPosition: number | null;
};

export const initialWatchProgress: WatchProgress = { watchedSeconds: 0, lastPosition: null };

/**
 * @param elapsedSeconds tempo real desde a leitura anterior. Com a aba em segundo plano o navegador
 * espaça as leituras (até 1 por minuto), e o avanço grande continua sendo reprodução normal.
 */
export function advanceWatchProgress(
  progress: WatchProgress,
  position: number,
  elapsedSeconds: number,
): WatchProgress {
  if (!Number.isFinite(position) || position < 0) return progress;
  if (progress.lastPosition === null) return { ...progress, lastPosition: position };

  const maxStep =
    (Number.isFinite(elapsedSeconds) ? Math.max(elapsedSeconds, 0) : 0) + STEP_TOLERANCE_SECONDS;
  const step = position - progress.lastPosition;
  const counted = step > 0 && step <= maxStep ? step : 0;
  return { watchedSeconds: progress.watchedSeconds + counted, lastPosition: position };
}
