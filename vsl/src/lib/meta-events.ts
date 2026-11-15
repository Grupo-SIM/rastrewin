/*
 * Eventos da VSL para a Meta (comando trck('track') do t.js): Pixel + Conversions API com o mesmo
 * event_id, só depois do aceite no banner (antes, o t.js descarta). Vão só para a Meta (ga4: false).
 * O progresso do vídeo continua só no painel (video-tracking.ts). Nada aqui pode afetar o player
 * ou o botão: o envio é protegido e ignora qualquer erro.
 */

export type VslEventName = "VSLStart" | "VSLCTAUnlock" | "CTAClick";

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
