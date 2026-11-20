/**
 * Auditoria do monorepo (backend, frontend, track, vsl e infraestrutura). Termina com código 1 se algo FALHAR;
 * ATENÇÃO não muda o código de saída. Checklist com os itens manuais: docs/audit-checklist.md.
 *
 *   bun scripts/audit/index.ts                 # código + repositório (sem rede, rápido)
 *   bun scripts/audit/index.ts --ferramentas   # + lint, formatação, tipos, testes, build, bun audit (lento)
 *   bun scripts/audit/index.ts --producao      # + produção vista de fora, SÓ LEITURA (GET/HEAD/OPTIONS)
 *
 * Nunca toca banco, nunca faz login e nunca envia POST. O banco do track em produção é conferido à parte,
 * só leitura: track/scripts/security-check.sql (ver track/SECURITY.md).
 */
import { checkBackend } from "./backend";
import { checkDocs } from "./docs";
import { checkEnv } from "./env";
import { checkSites } from "./frontend";
import { checkInfra } from "./infra";
import { git, type Level, results } from "./lib";
import { checkProduction } from "./prod";
import { checkRepo } from "./repo";
import { checkTools } from "./tools";
import { checkTrack } from "./track";

const KNOWN = new Set(["--ferramentas", "--producao"]);

async function main() {
	const args = process.argv.slice(2);
	const unknown = args.filter(a => !KNOWN.has(a));
	if (unknown.length)
		throw new Error(`argumento desconhecido: ${unknown.join(" ")} (use --ferramentas e/ou --producao)`);
	const tools = args.includes("--ferramentas");
	const production = args.includes("--producao");

	const head = git(["log", "-1", "--format=%h %s"]).trim();
	console.log(
		`Auditoria Rastrewin — ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
	);
	console.log(
		`Commit ${head}${tools ? " · com ferramentas" : ""}${production ? " · com produção (só leitura)" : ""}`,
	);

	checkRepo();
	checkEnv();
	checkBackend();
	checkSites();
	checkInfra();
	checkDocs();
	checkTrack(production);
	if (tools) checkTools();
	if (production) await checkProduction();

	const icon: Record<Level, string> = { atencao: "! ATENÇÃO", falha: "✗ FALHA  ", ok: "✓ OK     " };
	let area = "";
	for (const r of results) {
		if (r.area !== area) {
			area = r.area;
			console.log(`\n${area}`);
		}
		console.log(`  ${icon[r.level]} ${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
	}
	const count = (l: Level) => results.filter(r => r.level === l).length;
	console.log(`\n${count("ok")} OK · ${count("atencao")} ATENÇÃO · ${count("falha")} FALHA`);
	if (!tools || !production)
		console.log(
			"Dica: --ferramentas roda lint/tipos/testes/build; --producao confere os sites de fora (só leitura).",
		);
	if (count("falha")) process.exit(1);
}

main().catch((error: unknown) => {
	console.error("✗ erro ao rodar a auditoria:", error instanceof Error ? error.message : error);
	process.exit(1);
});
