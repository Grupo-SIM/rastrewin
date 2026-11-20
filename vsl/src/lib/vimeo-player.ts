import type Player from "@vimeo/player";

export const VIMEO_PLAYER_ORIGIN = "https://player.vimeo.com";

/** Cor dos controles do Vimeo: `--ink` do site, sem o `#`. */
export const VIMEO_CONTROLS_COLOR = "08304c";

/**
 * Endereço do player. O iframe já vem no HTML da página e começa a carregar junto com ela; o play é o do
 * próprio Vimeo (o único toque, que no iPhone também libera o som). O resto fica escondido (exige plano
 * pago do Vimeo): sem barra de progresso, sem pular para frente, sem logo. Nunca pede `autoplay`: o vídeo
 * só começa no toque da pessoa.
 * `dnt` (LGPD): o player não grava cookies (ex.: `vuid`) nem dados de sessão no navegador, porque ele abre
 * antes da resposta ao banner. Efeito: as estatísticas do próprio Vimeo param de contar; a medição do
 * vídeo é a aba Vídeos do track (`trck('video')`, só depois do aceite), que não depende disso.
 */
export function vimeoEmbedUrl(videoId: string): string {
	const params = new URLSearchParams({
		airplay: "0",
		autopause: "0",
		autoplay: "0",
		badge: "0",
		byline: "0",
		cc: "0",
		chromecast: "0",
		color: VIMEO_CONTROLS_COLOR,
		controls: "1",
		dnt: "1",
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

/** Biblioteca oficial do Vimeo, servida pelo próprio site e baixada quando a página fica ativa. */
export async function loadVimeoPlayer(): Promise<typeof Player> {
	return (await import("@vimeo/player")).default;
}
