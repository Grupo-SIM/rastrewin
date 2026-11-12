import assert from "node:assert/strict";
import { test } from "node:test";
import {
	cleanReferrer,
	DIRECT_LABEL,
	hostOf,
	originOf,
	ownHostsOf,
	referrerSource,
	summarizeOrigins,
} from "./referrer";

const OWN = ownHostsOf(["https://rastrewin.com", "https://vsl.rastrewin.com"], ["pay.simpay.com.br"]);

test("ownHostsOf/hostOf: origens e domínios viram hosts sem www, sem repetir", () => {
	assert.deepEqual(OWN, ["rastrewin.com", "vsl.rastrewin.com", "pay.simpay.com.br"]);
	assert.deepEqual(ownHostsOf(["https://www.rastrewin.com", "rastrewin.com"]), ["rastrewin.com"]);
	assert.equal(hostOf("https://WWW.Google.com.br/search?q=x"), "google.com.br");
	assert.equal(hostOf(""), null);
	assert.equal(hostOf("http://"), null);
});

test("cleanReferrer: próprio site (com www e subdomínio) e checkout viram null", () => {
	for (const url of [
		"https://rastrewin.com/",
		"https://www.rastrewin.com/planos",
		"https://vsl.rastrewin.com/?utm_source=x",
		"https://app.rastrewin.com/login",
		"https://pay.simpay.com.br/checkout/123",
	])
		assert.equal(cleanReferrer(url, OWN), null, url);
});

test("cleanReferrer: externo guarda origem + caminho, sem query nem #", () => {
	assert.equal(
		cleanReferrer("https://www.google.com/search?q=meu+email@x.com#top", OWN),
		"https://www.google.com/search",
	);
	assert.equal(cleanReferrer("https://l.instagram.com/", OWN), "https://l.instagram.com/");
	assert.equal(
		cleanReferrer("http://blog.exemplo.com:8080/post/1?a=1", OWN),
		"http://blog.exemplo.com:8080/post/1",
	);
});

test("cleanReferrer: vazio, inválido ou outro protocolo vira null", () => {
	for (const url of [
		null,
		undefined,
		"",
		"não é url",
		"android-app://com.google.android.gm/",
		"ftp://x.com/",
	])
		assert.equal(cleanReferrer(url, OWN), null, String(url));
});

test("referrerSource: fontes conhecidas viram rótulos amigáveis", () => {
	const cases: [string, string][] = [
		["https://www.google.com/", "Google"],
		["https://www.google.com.br/", "Google"],
		["https://news.google.co.uk/", "Google"],
		["http://m.facebook.com/", "Facebook"],
		["https://l.facebook.com/", "Facebook"],
		["https://lm.facebook.com/", "Facebook"],
		["https://l.instagram.com/", "Instagram"],
		["https://www.instagram.com/", "Instagram"],
		["https://m.youtube.com/", "YouTube"],
		["https://youtu.be/", "YouTube"],
		["https://t.co/", "X (Twitter)"],
		["https://x.com/", "X (Twitter)"],
		["https://www.tiktok.com/", "TikTok"],
		["https://www.bing.com/", "Bing"],
		["https://duckduckgo.com/", "DuckDuckGo"],
		["https://br.search.yahoo.com/", "Yahoo"],
		["https://www.linkedin.com/", "LinkedIn"],
		["https://lnkd.in/", "LinkedIn"],
		["https://web.whatsapp.com/", "WhatsApp"],
		["https://br.pinterest.com/", "Pinterest"],
		["https://www.reddit.com/", "Reddit"],
		["https://chatgpt.com/", "ChatGPT"],
		["https://www.perplexity.ai/", "Perplexity"],
	];
	for (const [url, label] of cases) assert.equal(referrerSource(url, OWN).label, label, url);
});

test("referrerSource: desconhecido mostra o domínio; vazio e próprio site são Direto", () => {
	assert.deepEqual(referrerSource("https://www.blog.exemplo.com/post", OWN), {
		host: "blog.exemplo.com",
		key: "site",
		label: "blog.exemplo.com",
	});
	assert.equal(referrerSource("https://notgoogle.com/", OWN).key, "site");
	assert.equal(referrerSource(null, OWN).label, DIRECT_LABEL);
	assert.equal(
		referrerSource("https://www.rastrewin.com/", OWN).key,
		"direto",
		"dado antigo do próprio site",
	);
});

test("originOf: UTM vence o referrer; sem os dois, Direto", () => {
	assert.deepEqual(
		originOf({ referrer: "https://www.google.com/", utmCampaign: "bf", utmSource: "facebook" }, OWN),
		{ detail: null, kind: "utm", label: "facebook · bf" },
	);
	assert.deepEqual(
		originOf({ referrer: "https://l.instagram.com/", utmCampaign: null, utmSource: null }, OWN),
		{
			detail: "l.instagram.com",
			kind: "referrer",
			label: "Instagram",
		},
	);
	assert.equal(originOf({ referrer: null, utmCampaign: null, utmSource: null }, OWN).kind, "direto");
	assert.equal(
		originOf({ referrer: "https://rastrewin.com/", utmCampaign: null, utmSource: null }, OWN).label,
		DIRECT_LABEL,
	);
});

test("summarizeOrigins: junta por rótulo, UTM separado, ordena e cria Outros", () => {
	const rows = [
		{ referrer: "www.google.com", utmSource: null, visitors: 3 },
		{ referrer: "google.com.br", utmSource: null, visitors: 2 },
		{ referrer: "l.instagram.com", utmSource: null, visitors: 4 },
		{ referrer: null, utmSource: null, visitors: 6 },
		{ referrer: "rastrewin.com", utmSource: null, visitors: 1 },
		{ referrer: "www.google.com", utmSource: "Facebook", visitors: 2 },
		{ referrer: null, utmSource: "facebook", visitors: 1 },
	];
	assert.deepEqual(summarizeOrigins(rows, OWN), [
		{ label: DIRECT_LABEL, value: 7 },
		{ label: "Google", value: 5 },
		{ label: "Instagram", value: 4 },
		{ label: "UTM · facebook", value: 3 },
	]);
	const many = ["a.com", "b.com", "c.com", "d.com"].map((r, i) => ({
		referrer: r,
		utmSource: null,
		visitors: 10 - i,
	}));
	const out = summarizeOrigins(many, OWN, 3);
	assert.deepEqual(out, [
		{ label: "a.com", value: 10 },
		{ label: "b.com", value: 9 },
		{ label: "Outros", value: 15 },
	]);
	const total = (xs: { value: number }[]) => xs.reduce((s, x) => s + x.value, 0);
	assert.equal(total(out), total(many.map(m => ({ value: m.visitors }))));
});
