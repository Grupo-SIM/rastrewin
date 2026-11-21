/** Ferramentas do projeto (lint, formato, tipos, testes, build, dependências). Lento: só com --ferramentas. */
import { spawnSync } from "node:child_process";
import { stripVTControlCharacters } from "node:util";
import { record, ROOT } from "./lib";

const AREA = "Ferramentas";

const COMMANDS: { name: string; cmd: string[]; level: "falha" | "atencao" }[] = [
	{ cmd: ["bun", "run", "lint"], level: "falha", name: "lint (Biome + ESLint)" },
	{ cmd: ["bun", "run", "format:check"], level: "atencao", name: "formatação (bun fmt --check)" },
	{ cmd: ["bun", "run", "check-types"], level: "falha", name: "tipos (turbo check-types)" },
	{ cmd: ["bun", "run", "test"], level: "falha", name: "testes (vsl + track)" },
	{ cmd: ["bun", "run", "build"], level: "falha", name: "build dos 4 projetos" },
	{
		cmd: ["bun", "audit", "--prod", "--audit-level=high"],
		level: "falha",
		name: "dependências de produção sem aviso alto/crítico",
	},
	{
		cmd: ["bun", "audit", "--audit-level=high"],
		level: "atencao",
		name: "dependências de desenvolvimento sem aviso alto/crítico",
	},
];

const tail = (text: string, lines = 4) =>
	text
		.split("\n")
		.map(l => stripVTControlCharacters(l).trim())
		.filter(Boolean)
		.slice(-lines)
		.join(" | ");

export function checkTools() {
	for (const { name, cmd, level } of COMMANDS) {
		const started = Date.now();
		process.stderr.write(`… ${name}\n`);
		const run = spawnSync(cmd[0], cmd.slice(1), {
			cwd: ROOT,
			encoding: "utf8",
			env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
			maxBuffer: 256 * 1024 * 1024,
			timeout: 20 * 60_000,
		});
		const seconds = Math.round((Date.now() - started) / 1000);
		const ok = run.status === 0;
		record(
			AREA,
			name,
			ok ? "ok" : level,
			ok ? `${seconds}s` : `saída ${run.status ?? run.signal}: ${tail(`${run.stdout}\n${run.stderr}`)}`,
		);
	}
}
