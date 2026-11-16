/*
 * Eventos da VSL para a Meta (comando trck('track') do t.js): Pixel + Conversions API com o mesmo
 * event_id, só depois do aceite no banner (antes, o t.js descarta). Vão só para a Meta (ga4: false).
 * O progresso detalhado do vídeo continua só no painel (video-tracking.ts); à Meta vão só os marcos
 * de 25/50/75/95% (VSLProgress), para públicos de quem assistiu. Nada aqui pode afetar o player
 * ou o botão: o envio é protegido e ignora qualquer erro.
 */

export type VslEventName = "VSLStart" | "VSLProgress" | "VSLCTAUnlock" | "CTAClick";

/** Marcos do VSLProgress, em % da duração do vídeo. */
export const PROGRESS_MARKS = [25, 50, 75, 95] as const;

/**
 * Marcos alcançados e ainda não enviados, pelo tempo REALMENTE assistido (pulos e repetições não
 * contam, como na aba Vídeos). Sem duração conhecida, nenhum.
 */
export function progressMarksReached(
	watchedSeconds: number,
	durationSeconds: number,
	sent: ReadonlySet<number>,
): number[] {
	if (!(durationSeconds > 0) || !(watchedSeconds > 0)) return [];
	const percent = (watchedSeconds / durationSeconds) * 100;
	return PROGRESS_MARKS.filter(mark => percent >= mark && !sent.has(mark));
}

type Trck = (command: string, ...args: unknown[]) => void;

/** Envia o evento com page_type "vsl" (mesmo CTAClick da landing, separado por page_type). Nunca lança erro. */
export function vslEvent(name: VslEventName, params: Record<string, string | number> = {}): void {
	try {
		const trck = (window as unknown as { trck?: Trck }).trck;
		if (typeof trck === "function") trck("track", name, { page_type: "vsl", ...params, ga4: false });
	} catch {
		// medição nunca atrapalha o vídeo nem o botão
	}
}
