import assert from "node:assert/strict";
import { test } from "node:test";
import { maintenanceHealth } from "./maintenance";

test("maintenanceHealth", () => {
  const now = new Date("2026-11-03T12:00:00Z");
  const ago = (h: number) => new Date(now.getTime() - h * 3600_000);
  assert.equal(maintenanceHealth(null, now), "nunca");
  assert.equal(maintenanceHealth({ status: "ok", startedAt: ago(6) }, now), "ok");
  assert.equal(maintenanceHealth({ status: "ok", startedAt: ago(49) }, now), "atrasada");
  assert.equal(maintenanceHealth({ status: "erro", startedAt: ago(1) }, now), "erro");
  assert.equal(maintenanceHealth({ status: "running", startedAt: ago(0.1) }, now), "rodando");
  assert.equal(maintenanceHealth({ status: "running", startedAt: ago(2) }, now), "erro");
});
