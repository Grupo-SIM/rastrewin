import assert from "node:assert/strict";
import { test } from "node:test";
import { pageHref, pageKey } from "./page-url";

test("pageKey: domínio + caminho, sem protocolo, www, query, hash e barra final", () => {
	assert.equal(pageKey("https://vsl.rastrewin.com/?utm_source=fb&fbclid=abc#topo"), "vsl.rastrewin.com");
	assert.equal(pageKey("https://VSL.Rastrewin.com/"), "vsl.rastrewin.com");
	assert.equal(pageKey("https://www.rastrewin.com/privacidade/"), "rastrewin.com/privacidade");
	assert.equal(pageKey("http://rastrewin.com/termos?x=1"), "rastrewin.com/termos");
	assert.equal(pageKey("https://rastrewin.com/a/b//"), "rastrewin.com/a/b");
	assert.equal(pageKey("https://rastrewin.com#so-hash"), "rastrewin.com");
});

test("pageHref abre a página a partir da chave", () => {
	assert.equal(pageHref("rastrewin.com/privacidade"), "https://rastrewin.com/privacidade");
});
