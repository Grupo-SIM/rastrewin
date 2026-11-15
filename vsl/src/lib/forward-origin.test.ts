import { describe, expect, it } from "vitest";
import { ctaHref, originParams, refusedConsent } from "./forward-origin";

const AD =
	"?utm_source=teste&utm_medium=paid&utm_campaign=vsl%7C123&utm_term=conj%7C9&utm_content=ad%7C7&fbclid=ABC_123&gclid=X&trck=abc&email=a%40b.com";
const consentCookie = (m: boolean, v = "1") =>
	`_ga=GA1.1.1.1; _trck_consent=${encodeURIComponent(JSON.stringify({ id: "abcdefgh12345678", m, v }))}; outro=1`;

describe("originParams", () => {
	it("pega só as UTMs e o fbclid, na ordem fixa", () => {
		expect(originParams(AD)).toEqual([
			["utm_source", "teste"],
			["utm_medium", "paid"],
			["utm_campaign", "vsl|123"],
			["utm_term", "conj|9"],
			["utm_content", "ad|7"],
			["fbclid", "ABC_123"],
		]);
	});

	it("ignora valores vazios e corta valores longos em 300 caracteres", () => {
		const long = "x".repeat(400);
		expect(originParams(`?utm_source=&utm_campaign=${long}&fbclid=%20%20`)).toEqual([
			["utm_campaign", "x".repeat(300)],
		]);
	});

	it("sem query não há origem", () => {
		expect(originParams("")).toEqual([]);
	});
});

describe("refusedConsent", () => {
	it("recusa (m: false) conta em qualquer versão do texto", () => {
		expect(refusedConsent(consentCookie(false))).toBe(true);
		expect(refusedConsent(consentCookie(false, "antiga"))).toBe(true);
	});

	it("aceite, cookie ausente ou inválido não são recusa", () => {
		expect(refusedConsent(consentCookie(true))).toBe(false);
		expect(refusedConsent("_ga=GA1.1.1.1")).toBe(false);
		expect(refusedConsent("")).toBe(false);
		expect(refusedConsent("_trck_consent=nao-e-json")).toBe(false);
		expect(refusedConsent("x_trck_consent=%7B%22m%22%3Afalse%7D")).toBe(false);
	});
});

describe("ctaHref", () => {
	it("sem resposta no banner: leva a origem do anúncio para a landing", () => {
		expect(ctaHref("https://rastrewin.com", AD, "")).toBe(
			"https://rastrewin.com/?utm_source=teste&utm_medium=paid&utm_campaign=vsl%7C123&utm_term=conj%7C9&utm_content=ad%7C7&fbclid=ABC_123",
		);
	});

	it("com aceite: também leva a origem", () => {
		expect(ctaHref("https://rastrewin.com", "?utm_source=teste&fbclid=F", consentCookie(true))).toBe(
			"https://rastrewin.com/?utm_source=teste&fbclid=F",
		);
	});

	it("com recusa: destino puro", () => {
		expect(ctaHref("https://rastrewin.com", AD, consentCookie(false))).toBe("https://rastrewin.com");
	});

	it("não sobrescreve parâmetros que o destino já tem", () => {
		expect(
			ctaHref("https://rastrewin.com/?utm_source=site", "?utm_source=teste&utm_campaign=c", ""),
		).toBe("https://rastrewin.com/?utm_source=site&utm_campaign=c");
	});

	it("sem origem na VSL ou destino inválido: destino como está", () => {
		expect(ctaHref("https://rastrewin.com", "?gclid=X", "")).toBe("https://rastrewin.com");
		expect(ctaHref("não é url", AD, "")).toBe("não é url");
	});
});
