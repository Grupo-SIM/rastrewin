/*
 * Rastreamento (track.rastrewin.com): o t.js registra o visitante, a origem do anúncio
 * (fbclid/UTMs) e o PageView. O cookie _trck vale em .rastrewin.com, então o mesmo visitante
 * é reconhecido no rastrewin.com, onde acontece o cadastro e a compra.
 * Em produção carrega de https://track.rastrewin.com; no dev, só com NEXT_PUBLIC_TRACK_URL.
 */

export const TRACK_URL =
	process.env.NEXT_PUBLIC_TRACK_URL ||
	(process.env.NODE_ENV === "production" ? "https://track.rastrewin.com" : "");

/** Mesmo stub do cartão "Instalação no site" do painel do track. */
export const TRCK_STUB = "window.trck=window.trck||function(){(trck.q=trck.q||[]).push(arguments)};";
