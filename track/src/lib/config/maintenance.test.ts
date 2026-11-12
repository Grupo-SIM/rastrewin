import assert from "node:assert/strict";
import { test } from "node:test";
import { maintenanceHealth } from "./maintenance";

test("maintenanceHealth", () => {
	const now = new Date("2026-11-03T12:00:00Z");
	const ago = (h: number) => new Date(now.getTime() - h * 3600_000);
	assert.equal(maintenanceHealth(null, now), "nunca");
	assert.equal(maintenanceHealth({ startedAt: ago(6), status: "ok" }, now), "ok");
	assert.equal(maintenanceHealth({ startedAt: ago(30), status: "ok" }, now), "ok");
	assert.equal(maintenanceHealth({ startedAt: ago(37), status: "ok" }, now), "atrasada");
	assert.equal(maintenanceHealth({ startedAt: ago(1), status: "erro" }, now), "erro");
	assert.equal(maintenanceHealth({ startedAt: ago(0.1), status: "running" }, now), "rodando");
	assert.equal(maintenanceHealth({ startedAt: ago(2), status: "running" }, now), "erro");
});
