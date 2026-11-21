/** Documentação: links quebrados, caminhos citados que não existem, versões desatualizadas e migrations. */
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
	depVersion,
	exists,
	read,
	readIf,
	record,
	ROOT,
	trackedFiles,
	type Workspace,
	WORKSPACES,
} from "./lib";

const AREA = "Documentação";

/** Planos são histórico: citam caminhos e versões da época. */
const isLiveDoc = (f: string) =>
	f.endsWith(".md") && !f.startsWith("plans/") && !f.startsWith(".agents/") && !f.startsWith(".claude/");

function resolveCandidates(file: string, target: string): string[] {
	const ws = file.split("/")[0];
	return [
		path.normalize(path.join(path.dirname(file), target)),
		path.normalize(target.replace(/^\//, "")),
		...(WORKSPACES.includes(ws as Workspace) ? [path.normalize(path.join(ws, target))] : []),
	];
}

function checkLinks(docs: string[]) {
	const broken: string[] = [];
	for (const file of docs) {
		for (const m of read(file).matchAll(/\]\(([^)\s]+)\)/g)) {
			const target = m[1].split("#")[0];
			if (!target || /^[a-z]+:/i.test(target)) continue;
			if (!exists(path.normalize(path.join(path.dirname(file), decodeURI(target)))))
				broken.push(`${file} → ${m[1]}`);
		}
	}
	record(
		AREA,
		"links relativos entre os .md apontam para arquivos que existem",
		broken.length ? "atencao" : "ok",
		broken.join("; ") || `${docs.length} arquivos`,
	);
}

/** Arquivo gerado ou baixado (ignorado pelo git): não existe num checkout limpo, e está certo. */
function ignored(rel: string): boolean {
	try {
		execFileSync("git", ["check-ignore", "-q", "--no-index", rel], { cwd: ROOT });
		return true;
	} catch {
		return false;
	}
}

function checkCitedPaths(docs: string[]) {
	const missing = new Map<string, Set<string>>();
	for (const file of docs) {
		let templateSection = false;
		for (const line of read(file).split("\n")) {
			// Seção sobre o repositório-modelo (ex.: "## Template notes" do guia de scaffolding) descreve outro repo.
			if (/^#{1,6}\s/.test(line)) templateSection = /template/i.test(line);
			if (templateSection) continue;
			// Linhas que citam outro repositório (ex.: Grupo-SIM/simintpay) falam de caminhos de lá.
			if (/Grupo-SIM\/(?!rastrewin)/.test(line)) continue;
			// "Create `arquivo`": instrução para criar um arquivo novo, que ainda não existe por definição.
			if (/^\s*(Create|Crie)\s+`/.test(line)) continue;
			for (const m of line.matchAll(/`([\w.@-]+(?:\/[\w.@[\]-]+)+\.[a-z]{1,5})`/g)) {
				const cited = m[1];
				// Pula domínios (track.rastrewin.com/t.js) e reticências (.../page.tsx).
				if ((/^[^/]*\.[a-z]{2,}\//i.test(cited) && !cited.startsWith(".")) || cited.startsWith("..."))
					continue;
				const candidates = resolveCandidates(file, cited);
				if (candidates.some(c => exists(c) || ignored(c))) continue;
				missing.set(file, (missing.get(file) ?? new Set()).add(cited));
			}
		}
	}
	const detail = [...missing].map(([file, paths]) => `${file} → ${[...paths].join(", ")}`).join("; ");
	record(
		AREA,
		"caminhos de arquivo citados nos .md existem",
		missing.size ? "atencao" : "ok",
		detail || undefined,
	);
}

function checkVersions(docs: string[]) {
	const next = depVersion("frontend", "next");
	const stale: string[] = [];
	for (const file of docs) {
		// Seção com data no título (ex.: "Auditoria de novembro (2ª, 09/11/2026)") é registro de época.
		let history = false;
		for (const line of read(file).split("\n")) {
			if (/^#{1,6}\s/.test(line)) history = /\d{2}\/\d{2}\/\d{4}/.test(line);
			if (history) continue;
			for (const m of line.matchAll(/Next(?:\.js)?\s+(\d+\.\d+\.\d+)/g))
				if (next && m[1] !== next) stale.push(`${file}: "Next ${m[1]}" (instalado ${next})`);
		}
	}
	const arch = readIf("docs/architecture.md");
	const rows: [Workspace, string, string][] = [
		["backend", "NestJS", "@nestjs/core"],
		["backend", "Prisma", "prisma"],
		["frontend", "Next.js", "next"],
		["frontend", "React", "react"],
		["track", "Next.js", "next"],
		["vsl", "Next.js", "next"],
	];
	for (const [ws, label, dep] of rows) {
		const row = arch.split("\n").find(l => l.startsWith(`| \`${ws}\``)) ?? "";
		const cited = row.match(new RegExp(`${label.replace(".", "\\.")}\\s+(\\d+)`))?.[1];
		const actual = depVersion(ws, dep)?.split(".")[0];
		if (cited && actual && cited !== actual)
			stale.push(`docs/architecture.md: ${ws} "${label} ${cited}" (instalado ${actual})`);
	}
	record(
		AREA,
		"versões citadas nos .md batem com as instaladas",
		stale.length ? "atencao" : "ok",
		stale.join("; ") || undefined,
	);
}

function checkMigrations() {
	const dir = "track/drizzle";
	const sql = trackedFiles().filter(f => new RegExp(`^${dir}/\\d{4}_[\\w-]+\\.sql$`).test(f));
	const journal = JSON.parse(readIf(`${dir}/meta/_journal.json`) || '{"entries":[]}').entries as {
		tag: string;
	}[];
	const tags = new Set(journal.map(e => `${dir}/${e.tag}.sql`));
	const orphans = sql.filter(f => !tags.has(f));
	const absent = [...tags].filter(t => !sql.includes(t));
	record(
		AREA,
		"track: migrations .sql batem com o _journal.json",
		orphans.length || absent.length ? "falha" : "ok",
		[
			orphans.length && `fora do journal: ${orphans.join(", ")}`,
			absent.length && `no journal sem arquivo: ${absent.join(", ")}`,
		]
			.filter(Boolean)
			.join("; ") || `${sql.length} migrations`,
	);
}

export function checkDocs() {
	const docs = trackedFiles().filter(isLiveDoc);
	checkLinks(docs);
	checkCitedPaths(docs);
	checkVersions(docs);
	checkMigrations();
}
