import { describe, expect, it } from "vitest";
import { VIMEO_PLAYER_ORIGIN, vimeoEmbedUrl } from "./vimeo-player";

const paramsOf = (url: string) => new URL(url).searchParams;

describe("vimeoEmbedUrl", () => {
	it("aponta para o player do Vimeo com o ID do vídeo", () => {
		const url = new URL(vimeoEmbedUrl("1243006876"));
		expect(url.origin).toBe(VIMEO_PLAYER_ORIGIN);
		expect(url.pathname).toBe("/video/1243006876");
	});

	it("mostra só o play do Vimeo, no centro, sem barra nem pular para frente", () => {
		const params = paramsOf(vimeoEmbedUrl("1243006876"));
		expect(params.get("controls")).toBe("1");
		expect(params.get("play_button_position")).toBe("center");
		expect(params.get("progress_bar")).toBe("0");
		expect(params.get("skipping_forward")).toBe("0");
		expect(params.get("playsinline")).toBe("1");
	});

	it("nunca pede autoplay: o vídeo só começa no toque da pessoa", () => {
		expect(paramsOf(vimeoEmbedUrl("1243006876")).get("autoplay")).toBe("0");
	});

	it("não deixa o Vimeo gravar cookies nem dados de sessão (dnt)", () => {
		expect(paramsOf(vimeoEmbedUrl("1243006876")).get("dnt")).toBe("1");
	});
});
