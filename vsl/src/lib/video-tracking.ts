/*
 * Progresso do vídeo para a aba Vídeos do track (comando trck('video') do t.js).
 * Vai SÓ para o painel: o t.js manda direto para /api/video, sem Pixel, gtag ou Conversions API.
 * Nada aqui pode afetar o player ou o botão: o envio é protegido e ignora qualquer erro.
 */

/** Enquanto toca, um envio a cada 15 s (além de play, pause, fim e saída da página). */
export const VIDEO_REPORT_EVERY_MS = 15_000;

export interface VideoState {
	videoId: string;
	title: string | null;
	/** Duração em segundos (0 se ainda não conhecida). */
	duration: number;
	/** Ponto mais adiante a que a pessoa chegou, em segundos. */
	maxPosition: number;
	/** Segundos assistidos em reprodução normal (pulos e repetições não contam). */
	watched: number;
	/** Segundo em que o botão é liberado. */
	cta: number;
	ended?: boolean;
}

const secs = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);

/** Dados do comando trck('video', …): id com o provedor, segundos inteiros e coerentes com a duração. */
export function videoPayload(s: VideoState) {
	const duration = secs(s.duration);
	const cap = (n: number) => (duration ? Math.min(secs(n), duration) : secs(n));
	return {
		cta: secs(s.cta),
		duration,
		ended: s.ended === true,
		id: `vimeo:${s.videoId}`,
		position: s.ended && duration ? duration : cap(s.maxPosition),
		title: s.title,
		watched: cap(s.watched),
	};
}

/** Já passou o intervalo desde o último envio? */
export function dueForReport(now: number, lastReportAt: number): boolean {
	return now - lastReportAt >= VIDEO_REPORT_EVERY_MS;
}

type Trck = (command: string, data: unknown) => void;

/** Envia ao track, se o t.js estiver na página (ou na fila do stub). Nunca lança erro. */
export function reportVideo(s: VideoState): void {
	try {
		const trck = (window as unknown as { trck?: Trck }).trck;
		if (typeof trck === "function") trck("video", videoPayload(s));
	} catch {
		// medição nunca atrapalha o vídeo
	}
}
