/**
 * Base da auditoria: resultados, leitura de arquivos, git e rede. Mesmo desenho do
 * track/scripts/security-check.ts (copiado aqui porque o track é outro workspace).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type Level = "ok" | "atencao" | "falha";
export interface Result {
	area: string;
	name: string;
	level: Level;
	detail?: string;
}

export const results: Result[] = [];
export function record(area: string, name: string, level: Level, detail?: string) {
	results.push({ area, detail, level, name });
}
/** OK quando a condição vale; senão o nível dado (FALHA por padrão). */
export const pass = (cond: boolean, otherwise: Level = "falha"): Level => (cond ? "ok" : otherwise);

export const ROOT = path.resolve(import.meta.dirname, "../..");
export const WORKSPACES = ["backend", "frontend", "track", "vsl"] as const;
export type Workspace = (typeof WORKSPACES)[number];

const abs = (rel: string) => path.join(ROOT, rel);
export const exists = (rel: string) => existsSync(abs(rel));
export const read = (rel: string) => readFileSync(abs(rel), "utf8");
export const readIf = (rel: string) => (exists(rel) ? read(rel) : "");

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "dist-scripts", "out", "build", "coverage"]);

/** Arquivos (caminho relativo à raiz) dentro de `dir`, sem node_modules, saídas de build e pastas ocultas. */
export function walk(dir: string, filter: (rel: string) => boolean): string[] {
	if (!exists(dir)) return [];
	const out: string[] = [];
	for (const name of readdirSync(abs(dir))) {
		if (SKIP_DIRS.has(name) || name.startsWith(".")) continue;
		const rel = path.join(dir, name);
		if (statSync(abs(rel)).isDirectory()) out.push(...walk(rel, filter));
		else if (filter(rel)) out.push(rel);
	}
	return out;
}

export const isCode = (rel: string) =>
	/\.(ts|tsx|mjs|js)$/.test(rel) && !/\.(test|spec)\.tsx?$/.test(rel) && !rel.includes("/public/");

/**
 * Remove comentários (// e /* *\/) mantendo as quebras de linha, para as buscas não acharem documentação.
 * Lê caractere a caractere: um "/*" dentro de um comentário // ou de uma string não abre bloco.
 */
export function stripComments(code: string): string {
	let out = "";
	let state: "code" | "line" | "block" | "'" | '"' | "`" = "code";
	for (let i = 0; i < code.length; i++) {
		const c = code[i];
		const next = code[i + 1];
		if (state === "code") {
			if (c === "/" && next === "/") state = "line";
			else if (c === "/" && next === "*") {
				state = "block";
				i++;
			} else {
				if (c === "'" || c === '"' || c === "`") state = c;
				out += c;
			}
			continue;
		}
		if (state === "line") {
			if (c === "\n") {
				state = "code";
				out += c;
			}
			continue;
		}
		if (state === "block") {
			if (c === "*" && next === "/") {
				state = "code";
				i++;
			} else if (c === "\n") out += c;
			continue;
		}
		// Dentro de string: só sai no mesmo delimitador sem escape.
		out += c;
		if (c === "\\") {
			out += next ?? "";
			i++;
		} else if (c === state) state = "code";
	}
	return out;
}

/** Número da linha (1-based) de uma posição no texto. */
export const lineOf = (code: string, index: number) => code.slice(0, index).split("\n").length;

/** Texto entre o delimitador de abertura em `start` e o seu par (aceita ( e {). */
export function balanced(code: string, start: number): { inner: string; end: number } | null {
	const open = code[start];
	const close = open === "(" ? ")" : open === "{" ? "}" : null;
	if (!close) return null;
	let depth = 0;
	for (let i = start; i < code.length; i++) {
		if (code[i] === open) depth++;
		else if (code[i] === close && --depth === 0) return { end: i, inner: code.slice(start + 1, i) };
	}
	return null;
}

export function git(args: string[]): string {
	return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
}
export const trackedFiles = () => git(["ls-files"]).split("\n").filter(Boolean);

/** Requisição só de leitura: sem seguir redirecionamento, com tempo-limite e sem cookies. */
export async function req(url: string, init: RequestInit = {}): Promise<Response> {
	const method = (init.method ?? "GET").toUpperCase();
	if (!["GET", "HEAD", "OPTIONS"].includes(method))
		throw new Error(`método ${method} proibido na auditoria`);
	return fetch(url, {
		...init,
		headers: { "user-agent": "rastrewin-auditoria", ...init.headers },
		redirect: "manual",
		signal: AbortSignal.timeout(15_000),
	});
}

/** Versão declarada de uma dependência no package.json do workspace, sem ^ ou ~. */
export function depVersion(ws: Workspace, name: string): string | null {
	const manifest = JSON.parse(read(`${ws}/package.json`));
	const version: string | undefined = manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
	return version ? version.replace(/^[\^~]/, "") : null;
}
