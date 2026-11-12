import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	daysToLimit,
	DB_ALERT_BYTES,
	growthPerDay,
	type HealthInputs,
	healthIssues,
	relayState,
	type RelayStatus,
} from "./evaluate";

const now = new Date("2026-11-08T12:00:00Z");
const minAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const status = (s: Partial<RelayStatus> = {}): RelayStatus => ({
	failed: 0,
	failedSample: [],
	lastError: null,
	oldestPendingAt: null,
	pending: 0,
	sentAt: now.toISOString(),
	...s,
});
const ok: HealthInputs = {
	dbBytes: 100 * 1024 ** 2,
	deliveryFailures: 0,
	maintenance: "ok",
	relay: { failed: 0, pending: 0, state: "ok" },
};

describe("relayState", () => {
	it("sem nenhum sinal desde que o app subiu: aguardando (não é alarme)", () => {
		assert.equal(relayState(null, now), "aguardando");
	});
	it("sinal recente e fila vazia: ok", () => {
		assert.equal(relayState({ receivedAt: minAgo(1), status: status() }, now), "ok");
	});
	it("mais de 10 min sem sinal: sem-sinal", () => {
		assert.equal(relayState({ receivedAt: minAgo(11), status: status() }, now), "sem-sinal");
		assert.equal(relayState({ receivedAt: minAgo(9), status: status() }, now), "ok");
	});
	it("venda na fila há mais de 30 min: atrasado; há menos, ainda ok", () => {
		const late = status({ oldestPendingAt: minAgo(31).toISOString(), pending: 2 });
		const fresh = status({ oldestPendingAt: minAgo(5).toISOString(), pending: 1 });
		assert.equal(relayState({ receivedAt: minAgo(1), status: late }, now), "atrasado");
		assert.equal(relayState({ receivedAt: minAgo(1), status: fresh }, now), "ok");
	});
	it("backend desistiu de alguma venda: desistiu (mais grave que atrasado)", () => {
		const s = status({ failed: 1, oldestPendingAt: minAgo(31).toISOString(), pending: 1 });
		assert.equal(relayState({ receivedAt: minAgo(1), status: s }, now), "desistiu");
	});
});

describe("healthIssues", () => {
	it("tudo certo: nenhuma pendência", () => {
		assert.deepEqual(healthIssues(ok), []);
		assert.deepEqual(healthIssues({ ...ok, maintenance: "nunca" }), []);
		assert.deepEqual(healthIssues({ ...ok, relay: { failed: 0, pending: 0, state: "aguardando" } }), []);
	});
	it("cada problema vira um aviso, na ordem de gravidade", () => {
		const issues = healthIssues({
			dbBytes: DB_ALERT_BYTES,
			deliveryFailures: 2,
			maintenance: "erro",
			relay: { failed: 0, pending: 0, state: "sem-sinal" },
		});
		assert.deepEqual(
			issues.map(i => i.key),
			["repasse-sinal", "envio", "limpeza", "banco"],
		);
		assert.match(issues[1].title, /^2 vendas não chegaram/);
	});
	it("singular e plural", () => {
		const one = healthIssues({ ...ok, relay: { failed: 1, pending: 0, state: "desistiu" } });
		assert.equal(one[0].title, "1 venda não chegou do backend (ele desistiu de reenviar)");
		const late = healthIssues({ ...ok, relay: { failed: 0, pending: 3, state: "atrasado" } });
		assert.equal(late[0].title, "3 vendas estão paradas no backend há mais de 30 min");
	});
	it("limpeza atrasada também avisa", () => {
		assert.deepEqual(
			healthIssues({ ...ok, maintenance: "atrasada" }).map(i => i.key),
			["limpeza"],
		);
	});
});

describe("crescimento do banco", () => {
	it("linhas novas por dia × tamanho médio da linha", () => {
		const perDay = growthPerDay([
			{ bytes: 10_000_000, rows: 10_000, rows7d: 7_000 }, // 1.000 linhas/dia × 1.000 bytes
			{ bytes: 500_000, rows: 1_000, rows7d: 70 }, // 10 linhas/dia × 500 bytes
			{ bytes: 9_999_999, rows: 0, rows7d: 0 }, // vazia: ignora
			{ bytes: 1_000_000, rows: 10, rows7d: null }, // não cresce com o tráfego: ignora
		]);
		assert.equal(perDay, 1_005_000);
	});
	it("dias até o limite", () => {
		assert.equal(daysToLimit(DB_ALERT_BYTES - 10_000, 1_000), 10);
		assert.equal(daysToLimit(DB_ALERT_BYTES + 1, 1_000), 0);
		assert.equal(daysToLimit(100, 0), null);
	});
});
