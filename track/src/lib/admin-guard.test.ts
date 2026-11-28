import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

/*
 * Server Actions são endpoints públicos: esconder um botão não protege nada.
 * Este teste lê o código das actions do painel e garante que:
 *   - toda action de arquivo SÓ DE ADMINISTRADOR começa com
 *       const denied = await denyUnlessAdmin();
 *       if (denied) return denied;
 *   - todo arquivo de actions do painel foi classificado aqui (admin ou aberto aos dois níveis),
 *     então uma action nova não fica aberta por esquecimento.
 */

const PAINEL = path.join(import.meta.dirname, "..", "app", "painel");

/** Só Administrador. */
const ADMIN_ONLY = [
	"config/actions.ts",
	"faturamento/admin-actions.ts",
	"usuarios/actions.ts",
	"visitante/[id]/actions.ts",
];
/** Abertos ao Colaborador (dados pessoais saem mascarados no servidor, ver src/lib/privacy/mask.ts). */
const OPEN_TO_ALL = ["campanhas/actions.ts", "eventos/actions.ts", "faturamento/actions.ts"];

function actionFiles(dir: string, base = dir): string[] {
	return readdirSync(dir).flatMap(name => {
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) return actionFiles(full, base);
		const source = name.endsWith(".ts") || name.endsWith(".tsx") ? readFileSync(full, "utf8") : "";
		return /^["']use server["'];?/m.test(source)
			? [path.relative(base, full).split(path.sep).join("/")]
			: [];
	});
}

/** Corpo de cada `export async function nome(...)`: o texto do primeiro `{` do corpo até o próximo export. */
function exportedActions(source: string): { name: string; body: string }[] {
	const re = /export\s+async\s+function\s+(\w+)\s*\(/g;
	const found: { name: string; start: number }[] = [];
	for (let m = re.exec(source); m; m = re.exec(source)) found.push({ name: m[1], start: m.index });
	return found.map((f, i) => {
		const chunk = source.slice(f.start, found[i + 1]?.start ?? source.length);
		// Pula a assinatura (parâmetros e tipo de retorno podem ter chaves): o corpo começa no
		// primeiro "{" depois do ")" que fecha a lista de parâmetros, contando parênteses.
		let depth = 0;
		let i2 = chunk.indexOf("(");
		for (; i2 < chunk.length; i2 += 1) {
			if (chunk[i2] === "(") depth += 1;
			else if (chunk[i2] === ")" && --depth === 0) break;
		}
		const afterParams = chunk.slice(i2 + 1);
		const typeAndBody = afterParams.replace(/^\s*:\s*Promise<[\s\S]*?>\s*(?=\{)/, "");
		return { body: typeAndBody.slice(typeAndBody.indexOf("{") + 1), name: f.name };
	});
}

test("todo arquivo de Server Actions do painel está classificado (admin ou aberto)", () => {
	const files = actionFiles(PAINEL).sort();
	const known = [...ADMIN_ONLY, ...OPEN_TO_ALL];
	const unknown = files.filter(f => !known.includes(f));
	assert.deepEqual(unknown, [], `classifique em src/lib/admin-guard.test.ts: ${unknown.join(", ")}`);
});

test("toda action só de administrador começa com denyUnlessAdmin()", () => {
	let checked = 0;
	for (const file of ADMIN_ONLY) {
		const full = path.join(PAINEL, file);
		if (!existsSync(full)) continue; // usuarios/actions.ts chega na etapa da aba Usuários
		const actions = exportedActions(readFileSync(full, "utf8"));
		assert.ok(actions.length > 0, `${file}: nenhuma action encontrada`);
		for (const { name, body } of actions) {
			assert.match(
				body,
				/^\s*const denied = await denyUnlessAdmin\(\);\s*if \(denied\) return denied;/,
				`${file} › ${name}: a 1ª linha precisa ser a trava de administrador`,
			);
			checked += 1;
		}
	}
	assert.ok(checked >= 10, `esperava ao menos as 10 actions de Configurações, conferiu ${checked}`);
});
