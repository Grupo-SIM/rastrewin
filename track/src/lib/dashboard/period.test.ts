import assert from "node:assert/strict";
import { test } from "node:test";
import {
	daysOf,
	localDate,
	maxLookback,
	periodRange,
	resolvePeriod,
	startOfLocalDay,
	withFrom,
} from "./period";

const SP = "America/Sao_Paulo";

test("meia-noite de Brasília = 03:00 UTC", () => {
	assert.equal(startOfLocalDay("2026-11-02", SP).toISOString(), "2026-11-02T03:00:00.000Z");
	assert.equal(
		startOfLocalDay("2026-11-02", "America/Rio_Branco").toISOString(),
		"2026-11-02T05:00:00.000Z",
	);
});

test("'hoje' vira o dia certo na virada (00:30 em Brasília ainda é dia anterior em UTC-?)", () => {
	// 02/11 00:30 em Brasília = 02/11 03:30 UTC
	const now = new Date("2026-11-02T03:30:00Z");
	assert.equal(localDate(now, SP), "2026-11-02");
	const p = resolvePeriod({ periodo: "hoje" }, SP, now);
	assert.equal(p.from, "2026-11-02");
	assert.equal(p.start.toISOString(), "2026-11-02T03:00:00.000Z");
	assert.equal(p.end.toISOString(), "2026-11-03T03:00:00.000Z");
	// 01/11 23:30 em Brasília = 02/11 02:30 UTC → ainda é 01/11 no painel
	assert.equal(resolvePeriod({ periodo: "hoje" }, SP, new Date("2026-11-02T02:30:00Z")).from, "2026-11-01");
});

test("ontem, 7d, 30d, hoje (padrão), mês e período anterior do mesmo tamanho", () => {
	const now = new Date("2026-11-02T15:00:00Z");
	const ontem = resolvePeriod({ periodo: "ontem" }, SP, now);
	assert.deepEqual([ontem.from, ontem.to, ontem.days], ["2026-11-01", "2026-11-01", 1]);
	const d7 = resolvePeriod({ periodo: "7d" }, SP, now);
	assert.deepEqual([d7.from, d7.to, d7.days], ["2026-10-27", "2026-11-02", 7]);
	assert.equal(d7.prevStart.toISOString(), startOfLocalDay("2026-10-20", SP).toISOString());
	assert.equal(d7.prevEnd.toISOString(), d7.start.toISOString());
	const d30 = resolvePeriod({ periodo: "30d" }, SP, now);
	assert.deepEqual([d30.key, d30.from, d30.days], ["30d", "2026-10-04", 30]);
	const def = resolvePeriod({}, SP, now);
	assert.deepEqual(
		[def.key, def.from, def.to, def.days, def.label],
		["hoje", "2026-11-02", "2026-11-02", 1, "Hoje"],
	);
	const mes = resolvePeriod({ periodo: "mes" }, SP, now);
	assert.deepEqual([mes.from, mes.days], ["2026-11-01", 2]);
	assert.equal(daysOf(d7).length, 7);
});

test("personalizado válido; inválido cai no padrão", () => {
	const now = new Date("2026-11-02T15:00:00Z");
	const c = resolvePeriod({ ate: "2026-10-10", de: "2026-10-01", periodo: "custom" }, SP, now);
	assert.deepEqual([c.key, c.days, c.label], ["custom", 10, "01/10/2026 – 10/10/2026"]);
	assert.equal(
		resolvePeriod({ ate: "2026-10-01", de: "2026-10-10", periodo: "custom" }, SP, now).key,
		"hoje",
	);
	assert.equal(resolvePeriod({ ate: "y", de: "x", periodo: "custom" }, SP, now).key, "hoje");
	assert.equal(resolvePeriod({ periodo: "lixo" }, SP, now).key, "hoje");
});

test("periodRange: um dia mostra a data; vários dias mostram início – fim", () => {
	const now = new Date("2026-11-05T15:00:00Z");
	assert.equal(periodRange(resolvePeriod({ periodo: "hoje" }, SP, now)), "05/11/2026");
	assert.equal(periodRange(resolvePeriod({ periodo: "ontem" }, SP, now)), "04/11/2026");
	assert.equal(periodRange(resolvePeriod({ periodo: "30d" }, SP, now)), "07/10/2026 – 05/11/2026");
	assert.equal(periodRange(resolvePeriod({ periodo: "90d" }, SP, now)), "08/08/2026 – 05/11/2026");
	assert.equal(periodRange(resolvePeriod({ periodo: "mes" }, SP, now)), "01/11/2026 – 05/11/2026");
	const custom = resolvePeriod({ ate: "2026-11-05", de: "2026-01-01", periodo: "custom" }, SP, now);
	assert.equal(custom.label, "01/01/2026 – 05/11/2026");
});

test("períodos no modelo da Meta: hoje e ontem, 14/28 dias, semanas e mês passado", () => {
	// quinta-feira, 05/11/2026, 12:00 em Brasília
	const now = new Date("2026-11-05T15:00:00Z");
	const r = (periodo: string) => {
		const p = resolvePeriod({ periodo }, SP, now);
		return [p.key, p.from, p.to, p.days];
	};
	assert.deepEqual(r("hoje-ontem"), ["hoje-ontem", "2026-11-04", "2026-11-05", 2]);
	assert.deepEqual(r("14d"), ["14d", "2026-10-23", "2026-11-05", 14]);
	assert.deepEqual(r("28d"), ["28d", "2026-10-09", "2026-11-05", 28]);
	assert.deepEqual(r("semana"), ["semana", "2026-11-01", "2026-11-05", 5]);
	assert.deepEqual(r("semana-ant"), ["semana-ant", "2026-10-25", "2026-10-31", 7]);
	assert.deepEqual(r("mes-ant"), ["mes-ant", "2026-10-01", "2026-10-31", 31]);
	assert.equal(resolvePeriod({ periodo: "semana-ant" }, SP, now).label, "Semana passada");
	assert.equal(resolvePeriod({ periodo: "14d" }, SP, now).compare, true);
});

test("semana começa no domingo: hoje domingo e hoje sábado", () => {
	const domingo = new Date("2026-11-08T15:00:00Z");
	assert.deepEqual(
		[
			resolvePeriod({ periodo: "semana" }, SP, domingo).from,
			resolvePeriod({ periodo: "semana" }, SP, domingo).to,
		],
		["2026-11-08", "2026-11-08"],
	);
	const ant = resolvePeriod({ periodo: "semana-ant" }, SP, domingo);
	assert.deepEqual([ant.from, ant.to], ["2026-11-01", "2026-11-07"]);
	const sabado = new Date("2026-11-07T15:00:00Z");
	assert.equal(resolvePeriod({ periodo: "semana" }, SP, sabado).from, "2026-11-01");
});

test("mês passado na virada do ano", () => {
	const p = resolvePeriod({ periodo: "mes-ant" }, SP, new Date("2027-01-10T15:00:00Z"));
	assert.deepEqual([p.from, p.to, p.days], ["2026-12-01", "2026-12-31", 31]);
});

test("Máximo: começa no 1º dado, sem comparação e limitado a 37 meses", () => {
	const now = new Date("2026-11-05T15:00:00Z");
	const p = resolvePeriod({ periodo: "max" }, SP, now, "2026-11-01");
	assert.deepEqual(
		[p.key, p.from, p.to, p.compare, p.label],
		["max", "2026-11-01", "2026-11-05", false, "Máximo"],
	);
	assert.equal(p.prevStart.getTime(), p.start.getTime());
	assert.equal(p.prevEnd.getTime(), p.start.getTime());
	// sem dados: só hoje
	assert.equal(resolvePeriod({ periodo: "max" }, SP, now).from, "2026-11-05");
	// dado mais antigo que 37 meses: corta no limite da Meta
	assert.equal(resolvePeriod({ periodo: "max" }, SP, now, "2019-01-01").from, "2023-10-06");
	assert.equal(maxLookback("2026-11-05"), "2023-10-06");
	// withFrom recua o início e mantém o fim e o "sem comparação"
	const w = withFrom(p, "2026-05-16", SP);
	assert.deepEqual([w.from, w.to, w.compare, w.days], ["2026-05-16", "2026-11-05", false, 174]);
});
