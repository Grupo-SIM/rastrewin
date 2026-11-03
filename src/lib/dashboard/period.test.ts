import assert from "node:assert/strict";
import { test } from "node:test";
import { daysOf, localDate, resolvePeriod, startOfLocalDay } from "./period";

const SP = "America/Sao_Paulo";

test("meia-noite de Brasília = 03:00 UTC", () => {
  assert.equal(startOfLocalDay("2026-11-02", SP).toISOString(), "2026-11-02T03:00:00.000Z");
  assert.equal(startOfLocalDay("2026-11-02", "America/Rio_Branco").toISOString(), "2026-11-02T05:00:00.000Z");
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

test("ontem, 7d, 30d (padrão), mês e período anterior do mesmo tamanho", () => {
  const now = new Date("2026-11-02T15:00:00Z");
  const ontem = resolvePeriod({ periodo: "ontem" }, SP, now);
  assert.deepEqual([ontem.from, ontem.to, ontem.days], ["2026-11-01", "2026-11-01", 1]);
  const d7 = resolvePeriod({ periodo: "7d" }, SP, now);
  assert.deepEqual([d7.from, d7.to, d7.days], ["2026-10-27", "2026-11-02", 7]);
  assert.equal(d7.prevStart.toISOString(), startOfLocalDay("2026-10-20", SP).toISOString());
  assert.equal(d7.prevEnd.toISOString(), d7.start.toISOString());
  const def = resolvePeriod({}, SP, now);
  assert.deepEqual([def.key, def.from, def.days], ["30d", "2026-10-04", 30]);
  const mes = resolvePeriod({ periodo: "mes" }, SP, now);
  assert.deepEqual([mes.from, mes.days], ["2026-11-01", 2]);
  assert.equal(daysOf(d7).length, 7);
});

test("personalizado válido; inválido cai no padrão", () => {
  const now = new Date("2026-11-02T15:00:00Z");
  const c = resolvePeriod({ periodo: "custom", de: "2026-10-01", ate: "2026-10-10" }, SP, now);
  assert.deepEqual([c.key, c.days, c.label], ["custom", 10, "01/10/2026 – 10/10/2026"]);
  assert.equal(resolvePeriod({ periodo: "custom", de: "2026-10-10", ate: "2026-10-01" }, SP, now).key, "30d");
  assert.equal(resolvePeriod({ periodo: "custom", de: "x", ate: "y" }, SP, now).key, "30d");
  assert.equal(resolvePeriod({ periodo: "lixo" }, SP, now).key, "30d");
});
