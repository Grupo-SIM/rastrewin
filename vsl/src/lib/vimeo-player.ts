import type Player from "@vimeo/player";

export const VIMEO_PLAYER_ORIGIN = "https://player.vimeo.com";

const PRECONNECT_ORIGINS = [VIMEO_PLAYER_ORIGIN, "https://f.vimeocdn.com", "https://i.vimeocdn.com"];

let preconnected = false;

/** Abre as conexões com o Vimeo antes do clique (quando o dedo/mouse chega na capa). */
export function preconnectVimeo() {
	if (preconnected) return;
	preconnected = true;
	for (const href of PRECONNECT_ORIGINS) {
		const link = document.createElement("link");
		link.rel = "preconnect";
		link.href = href;
		document.head.append(link);
	}
}

interface NetworkInformation {
	saveData?: boolean;
	effectiveType?: string;
}

/** Economia de dados ligada ou rede 2G: não pré-carrega o player (carrega só no toque). */
export function canPreloadPlayer(): boolean {
	const { connection } = navigator as Navigator & { connection?: NetworkInformation };
	if (!connection) return true;
	return (
		!connection.saveData && connection.effectiveType !== "2g" && connection.effectiveType !== "slow-2g"
	);
}

/**
 * Roda `callback` depois de a página terminar de abrir e o navegador ficar ocioso,
 * para o pré-carregamento não disputar banda nem CPU com título, capa e fontes. Devolve o cancelamento.
 */
export function whenPageIdle(callback: () => void): () => void {
	let idleId: number | null = null;
	let timeoutId: number | null = null;
	const schedule = () => {
		// Safari não tem requestIdleCallback.
		if (typeof window.requestIdleCallback === "function") {
			idleId = window.requestIdleCallback(callback, { timeout: 2000 });
		} else {
			timeoutId = window.setTimeout(callback, 200);
		}
	};

	if (document.readyState === "complete") schedule();
	else window.addEventListener("load", schedule, { once: true });

	return () => {
		window.removeEventListener("load", schedule);
		if (idleId !== null) window.cancelIdleCallback(idleId);
		if (timeoutId !== null) window.clearTimeout(timeoutId);
	};
}

/** Cor dos controles do Vimeo: `--ink` do site, sem o `#`. */
export const VIMEO_CONTROLS_COLOR = "08304c";

/**
 * Endereço do player. O play é o do próprio Vimeo, no centro, embaixo da capa do site: o toque atravessa
 * a capa e acontece dentro do player, o único jeito de o iPhone liberar o som no 1º toque. O resto fica
 * escondido (exige plano pago do Vimeo): sem barra de progresso, sem pular para frente, sem logo.
 * `autoplay` só quando a página não pré-carrega (economia de dados, 2G) e a pessoa já tocou na capa.
 */
export function vimeoEmbedUrl(videoId: string, { autoplay }: { autoplay: boolean }): string {
	const params = new URLSearchParams({
		airplay: "0",
		autopause: "0",
		autoplay: autoplay ? "1" : "0",
		badge: "0",
		byline: "0",
		cc: "0",
		chromecast: "0",
		color: VIMEO_CONTROLS_COLOR,
		controls: "1",
		fullscreen: "0",
		keyboard: "0",
		pip: "0",
		play_button_position: "center",
		playsinline: "1",
		portrait: "0",
		progress_bar: "0",
		quality_selector: "0",
		skipping_forward: "0",
		speed: "0",
		title: "0",
		vimeo_logo: "0",
		volume: "0",
	});
	return `${VIMEO_PLAYER_ORIGIN}/video/${videoId}?${params}`;
}

/** Biblioteca oficial do Vimeo, servida pelo próprio site e baixada só quando o player é criado. */
export async function loadVimeoPlayer(): Promise<typeof Player> {
	return (await import("@vimeo/player")).default;
}
