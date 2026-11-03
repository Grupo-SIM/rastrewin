import assert from "node:assert/strict";
import { test } from "node:test";
import { isRetentionDue, nextSlot, previousSlot } from "./retention";

const d = (iso: string) => new Date(iso);

test("horários: 06:15 UTC (03:15 Brasília)", () => {
  assert.equal(previousSlot(d("2026-11-03T05:00:00Z")).toISOString(), "2026-11-02T06:15:00.000Z");
  assert.equal(previousSlot(d("2026-11-03T06:15:00Z")).toISOString(), "2026-11-03T06:15:00.000Z");
  assert.equal(nextSlot(d("2026-11-03T05:00:00Z")).toISOString(), "2026-11-03T06:15:00.000Z");
  assert.equal(nextSlot(d("2026-11-03T06:15:00Z")).toISOString(), "2026-11-04T06:15:00.000Z");
  assert.equal(nextSlot(d("2026-12-31T23:00:00Z")).toISOString(), "2027-01-01T06:15:00.000Z");
});

test("isRetentionDue: roda uma vez por dia, depois do horário", () => {
  const none = { lastOkAt: null, lastAttemptAt: null };
  assert.equal(isRetentionDue(d("2026-11-03T06:20:00Z"), none), true, "nunca rodou → roda");
  const okToday = { lastOkAt: d("2026-11-03T06:16:00Z"), lastAttemptAt: d("2026-11-03T06:16:00Z") };
  assert.equal(isRetentionDue(d("2026-11-03T20:00:00Z"), okToday), false, "já rodou hoje");
  assert.equal(isRetentionDue(d("2026-11-04T06:00:00Z"), okToday), false, "antes do horário do dia seguinte");
  assert.equal(isRetentionDue(d("2026-11-04T06:20:00Z"), okToday), true, "passou o horário do dia seguinte");
});

test("isRetentionDue: recupera noite perdida e espera 1 h depois de falha", () => {
  const okTwoDaysAgo = { lastOkAt: d("2026-11-01T06:16:00Z"), lastAttemptAt: d("2026-11-01T06:16:00Z") };
  assert.equal(isRetentionDue(d("2026-11-03T14:00:00Z"), okTwoDaysAgo), true, "app voltou à tarde → roda");
  const failed = { lastOkAt: d("2026-11-02T06:16:00Z"), lastAttemptAt: d("2026-11-03T06:16:00Z") };
  assert.equal(isRetentionDue(d("2026-11-03T06:50:00Z"), failed), false, "falhou há 34 min → espera");
  assert.equal(isRetentionDue(d("2026-11-03T07:20:00Z"), failed), true, "falhou há 1 h+ → tenta de novo");
});
