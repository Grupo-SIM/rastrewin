import assert from "node:assert/strict";
import { test } from "node:test";
import { BR_UFS, IBGE_UF, UF_NAME } from "./br-states";

test("tabela IBGE → UF cobre os 27 estados da malha oficial", () => {
	const malha = [
		"11",
		"12",
		"13",
		"14",
		"15",
		"16",
		"17",
		"21",
		"22",
		"23",
		"24",
		"25",
		"26",
		"27",
		"28",
		"29",
		"31",
		"32",
		"33",
		"35",
		"41",
		"42",
		"43",
		"50",
		"51",
		"52",
		"53",
	];
	assert.deepEqual(Object.keys(IBGE_UF).sort(), malha);
	assert.deepEqual(Object.values(IBGE_UF).sort(), BR_UFS);
	assert.equal(Object.keys(UF_NAME).length, 27);
	assert.equal(IBGE_UF["35"], "SP");
	assert.equal(IBGE_UF["12"], "AC");
});
