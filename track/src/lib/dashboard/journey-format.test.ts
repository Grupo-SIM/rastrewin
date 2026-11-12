import assert from "node:assert/strict";
import { test } from "node:test";
import {
	deviceSummary,
	fbcInfo,
	formatDayLong,
	formatTimeSec,
	hasUtm,
	latestChronological,
	saleEventLabel,
	sameUtm,
	splitUtm,
	utmSummary,
} from "./journey-format";

const SP = "America/Sao_Paulo";
const u = (o: Partial<Parameters<typeof hasUtm>[0]> = {}) => ({
	campaign: null,
	content: null,
	medium: null,
	source: null,
	term: null,
	...o,
});

test("splitUtm separa nome e ID do anúncio (convenção nome|id)", () => {
	assert.deepEqual(splitUtm("Campanha A|120200000000001"), { id: "120200000000001", name: "Campanha A" });
	assert.deepEqual(splitUtm("Black|Friday|120200000000001"), {
		id: "120200000000001",
		name: "Black|Friday",
	});
	assert.deepEqual(splitUtm("só nome"), { id: null, name: "só nome" });
	assert.deepEqual(splitUtm("nome|abc"), { id: null, name: "nome|abc" });
	assert.deepEqual(splitUtm(null), { id: null, name: null });
});

test("UTMs: presença, comparação e resumo", () => {
	assert.equal(hasUtm(u()), false);
	assert.equal(hasUtm(u({ term: "x" })), true);
	assert.equal(sameUtm(u({ source: "facebook" }), u({ source: "facebook" })), true);
	assert.equal(sameUtm(u({ source: "facebook" }), u({ source: "instagram" })), false);
	assert.equal(
		utmSummary(u({ campaign: "VSL Nov|120200000000001", medium: "paid", source: "facebook" })),
		"facebook · paid · VSL Nov",
	);
});

test("fbcInfo lê o clique no anúncio da Meta do cookie _fbc", () => {
	assert.deepEqual(fbcInfo("fb.1.1762520000000.IwAR0abc"), {
		clickedAt: new Date(1762520000000).toISOString(),
		fbclid: "IwAR0abc",
	});
	assert.equal(fbcInfo("fb.1.1762520000.IwAR0abc")?.clickedAt, new Date(1762520000000).toISOString());
	assert.equal(fbcInfo("lixo"), null);
	assert.equal(fbcInfo(null), null);
});

test("rótulos dos eventos de venda", () => {
	assert.equal(saleEventLabel("purchase_approved"), "Compra aprovada");
	assert.equal(saleEventLabel("pix_generated"), "PIX gerado");
	assert.equal(saleEventLabel("novo_tipo"), "novo_tipo");
});

test("latestChronological: os N mais recentes, em ordem do mais antigo ao mais novo", () => {
	const a = [
		{ at: "2026-11-07T10:00:00Z", k: "a3" },
		{ at: "2026-11-05T10:00:00Z", k: "a1" },
	];
	const b = [
		{ at: "2026-11-06T10:00:00Z", k: "b2" },
		{ at: "2026-11-04T10:00:00Z", k: "b0" },
	];
	assert.deepEqual(
		latestChronological([a, b], 3).map(x => x.k),
		["a1", "b2", "a3"],
	);
	assert.deepEqual(
		latestChronological([a, b], 10).map(x => x.k),
		["b0", "a1", "b2", "a3"],
	);
});

test("hora com segundos e dia por extenso no fuso do painel", () => {
	assert.equal(formatTimeSec("2026-11-07T17:03:27Z", SP), "14:03:27");
	assert.equal(formatDayLong("2026-11-07T17:03:27Z", SP), "sábado, 07/11/2026");
	// 01:30 UTC ainda é o dia anterior em Brasília
	assert.equal(formatDayLong("2026-11-08T01:30:00Z", SP), "sábado, 07/11/2026");
});

test("deviceSummary resume navegador, sistema e tipo de aparelho", () => {
	assert.equal(
		deviceSummary(
			"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0]",
		),
		"Facebook (app) · iOS · celular",
	);
	assert.equal(
		deviceSummary(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
		),
		"Chrome · macOS · computador",
	);
	assert.equal(deviceSummary(null), null);
});
