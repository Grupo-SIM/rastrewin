/** Variáveis de ambiente lidas no código × as documentadas no .env.example de cada projeto. */
import { exists, isCode, read, record, stripComments, walk, type Workspace, WORKSPACES } from "./lib";

const AREA = "Variáveis de ambiente";

/** Variáveis do exemplo que o código ainda não lê de propósito, com o motivo (não contam como sobra). */
const RESERVED: Partial<Record<Workspace, Record<string, string>>> = {
	backend: { SIMPAY_INBOUND_TOKEN: "reservada para chamadas futuras à API do SimIntPay" },
};

/** Definidas pelo runtime/Next/Docker, não pelo .env. */
const BUILTIN = new Set(["CI", "HOSTNAME", "NEXT_PHASE", "NEXT_RUNTIME", "NODE_ENV", "TZ"]);

/** Leituras que um `process.env.X` não mostra (nome montado em tempo de execução). */
const DYNAMIC: Partial<Record<Workspace, { file: string; pattern: RegExp; vars: string[] }[]>> = {
	backend: [
		{
			file: "backend/src/plans.ts",
			pattern: /SIMPAY_CHECKOUT_URL_\$\{/,
			vars: ["SIMPAY_CHECKOUT_URL_BASICO", "SIMPAY_CHECKOUT_URL_PRO", "SIMPAY_CHECKOUT_URL_VIP"],
		},
	],
};

/** Variáveis lidas no código e, à parte, as que só aparecem com valor padrão (`process.env.X ?? ...`). */
function readsOf(ws: Workspace): { vars: Set<string>; optional: Set<string> } {
	const vars = new Set<string>();
	const required = new Set<string>();
	const need = (name: string) => {
		vars.add(name);
		required.add(name);
	};
	for (const file of walk(ws, isCode)) {
		const code = stripComments(read(file));
		for (const m of code.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)(\s*\?\?)?/g)) {
			vars.add(m[1]);
			if (!m[2]) required.add(m[1]);
		}
		for (const m of code.matchAll(/process\.env\[\s*["'`]([A-Z][A-Z0-9_]*)["'`]\s*\]/g)) need(m[1]);
		// Segredos derivados: o nome da variável vai como texto para um helper (ex.: hmacFor(.., "RESET_CODE_SECRET")).
		if (ws === "backend") for (const m of code.matchAll(/["']([A-Z][A-Z0-9_]*_SECRET)["']/g)) need(m[1]);
		// Esquema Zod validando o process.env inteiro (track/src/lib/env.ts): as chaves do objeto são as variáveis.
		if (/\.(safeParse|parse)\(\s*process\.env\s*\)/.test(code))
			for (const m of code.matchAll(/^\s*([A-Z][A-Z0-9_]*):\s*z\./gm)) need(m[1]);
	}
	for (const file of walk(ws, f => f.endsWith(".prisma")))
		for (const m of read(file).matchAll(/env\("([A-Z][A-Z0-9_]*)"\)/g)) need(m[1]);
	for (const dyn of DYNAMIC[ws] ?? [])
		if (exists(dyn.file) && dyn.pattern.test(read(dyn.file))) for (const v of dyn.vars) need(v);
	for (const v of BUILTIN) vars.delete(v);
	return { optional: new Set([...vars].filter(v => !required.has(v))), vars };
}

/** Variáveis citadas como ${VAR} em compose/Dockerfile/CI do projeto (usadas fora do código). */
function infraRefs(ws: Workspace): Set<string> {
	const files = [
		...walk(ws, f => /(compose[\w.-]*\.ya?ml|Dockerfile|\.conf|Caddyfile)$/.test(f)),
		"compose.yaml",
		"compose.production.yaml",
		".github/workflows/cd.yml",
	].filter(exists);
	const vars = new Set<string>();
	for (const file of files) for (const m of read(file).matchAll(/\$\{?([A-Z][A-Z0-9_]*)/g)) vars.add(m[1]);
	return vars;
}

function documented(file: string): Set<string> {
	return new Set([...read(file).matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map(m => m[1]));
}

export function checkEnv() {
	for (const ws of WORKSPACES) {
		const { vars: reads, optional } = readsOf(ws);
		const example = `${ws}/.env.example`;
		if (!exists(example)) {
			record(
				AREA,
				`${ws}: .env.example existe`,
				reads.size ? "falha" : "ok",
				reads.size
					? `o código lê ${[...reads].sort().join(", ")} e nada documenta`
					: "o projeto não lê variáveis",
			);
			continue;
		}
		const docs = documented(example);
		// Variável com valor padrão no código (`?? ...`) é ajuste opcional: não precisa estar no exemplo.
		const missing = [...reads].filter(v => !docs.has(v) && !optional.has(v)).sort();
		record(
			AREA,
			`${ws}: toda variável obrigatória lida no código está no .env.example`,
			missing.length ? "atencao" : "ok",
			missing.length ? `faltam: ${missing.join(", ")}` : `${reads.size} variáveis`,
		);
		const refs = infraRefs(ws);
		const reserved = RESERVED[ws] ?? {};
		const unused = [...docs].filter(v => !reads.has(v) && !refs.has(v) && !reserved[v]).sort();
		const kept = Object.entries(reserved).filter(([v]) => docs.has(v) && !reads.has(v));
		record(
			AREA,
			`${ws}: .env.example sem variável que ninguém lê`,
			unused.length ? "atencao" : "ok",
			unused.length
				? `sem uso no código nem no compose: ${unused.join(", ")}`
				: kept.map(([v, why]) => `${v}: ${why}`).join("; ") || undefined,
		);
	}
}
