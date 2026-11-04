#!/usr/bin/env node
// Gera o header de CSP com hashes sha256 dos scripts inline do export estático do Next.
// O export estático não aceita nonce, então os hashes permitem uma CSP sem 'unsafe-inline' em scripts.
//
// uso: node scripts/csp-hashes.mjs <pasta-out> [--enforce]
// saída: uma linha de header no formato do Caddyfile (importada dentro do bloco `header`).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [outDir, flag] = process.argv.slice(2);
if (!outDir) {
	console.error("uso: node scripts/csp-hashes.mjs <pasta-out> [--enforce]");
	process.exit(1);
}

const htmlFiles = readdirSync(outDir, { recursive: true, withFileTypes: true })
	.filter(entry => entry.isFile() && entry.name.endsWith(".html"))
	.map(entry => join(entry.parentPath, entry.name));

const inlineScript = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
const hashes = new Set();
for (const file of htmlFiles) {
	for (const [, body] of readFileSync(file, "utf8").matchAll(inlineScript)) {
		if (body.length > 0) hashes.add(`'sha256-${createHash("sha256").update(body).digest("base64")}'`);
	}
}

if (hashes.size === 0) {
	console.error(`Nenhum script inline encontrado em ${outDir}. O build rodou?`);
	process.exit(1);
}

const policy = [
	"default-src 'self'",
	`script-src 'self' ${[...hashes].sort().join(" ")}`,
	"frame-src https://player.vimeo.com",
	"img-src 'self' data:",
	"style-src 'self' 'unsafe-inline'",
	"font-src 'self'",
	"connect-src 'self'",
	"object-src 'none'",
	"base-uri 'none'",
	"form-action 'none'",
	"frame-ancestors 'none'",
].join("; ");

const header = flag === "--enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
process.stdout.write(`${header} "${policy}"\n`);
console.error(`${hashes.size} hashes de ${htmlFiles.length} arquivos HTML.`);
