/**
 * Verificação de segurança repetível do track. Termina com código 1 se alguma regra FALHAR.
 *
 *   bun run security:check                                   # só o código (sem rede, sem banco)
 *   bun run security:check -- --url https://track.rastrewin.com   # + conferência de fora, SÓ LEITURA
 *   bun run security:check -- --url http://localhost:3000 --ativo # + testes que enviam POST (só local)
 *
 * Modo externo: só GET/HEAD/OPTIONS. Não faz login, não envia evento e não grava nada.
 * Modo ativo: tenta cadastro, webhook sem assinatura, corpo grande e 6 logins errados (bloqueia o
 * login daquele IP por 1 min). Por isso só aceita localhost/127.0.0.1.
 *
 * O banco é conferido à parte: `bun run test:rls` (Postgres descartável) e scripts/security-check.sql
 * (produção, só leitura). Regras de cada item: SECURITY.md.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

type Level = "ok" | "atencao" | "falha";
interface Result {
	area: string;
	name: string;
	level: Level;
	detail?: string;
}
const results: Result[] = [];
function record(area: string, name: string, level: Level, detail?: string) {
	results.push({ area, detail, level, name });
}
const pass = (cond: boolean): Level => (cond ? "ok" : "falha");

const TRACK = path.resolve(import.meta.dirname, "..");
const ROOT = path.resolve(TRACK, "..");
const rel = (file: string) => path.relative(TRACK, file);
const read = (file: string) => readFileSync(file, "utf8");

function walk(dir: string, filter: (file: string) => boolean): string[] {
	if (!existsSync(dir)) return [];
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		if (name === "node_modules" || name.startsWith(".")) continue;
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) out.push(...walk(full, filter));
		else if (filter(full)) out.push(full);
	}
	return out;
}

const SRC = path.join(TRACK, "src");
const isCode = (f: string) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f);
const srcFiles = walk(SRC, isCode);

/** Remove comentários (// e /* *\/) para as buscas não acharem texto de documentação. */
function stripComments(code: string): string {
	return code
		.replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, "")) // mantém as quebras de linha
		.replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

/** Corpo (texto) de cada `export async function nome(...)` / `export function nome(...)` do arquivo. */
function exportedFunctions(code: string): { name: string; params: string; body: string }[] {
	const out: { name: string; params: string; body: string }[] = [];
	// O corpo começa no último "{" da linha da assinatura (o tipo de retorno pode ter "{ ... }").
	const re = /export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::[^\n]*)?\{[ \t]*$/gm;
	for (let m = re.exec(code); m; m = re.exec(code)) {
		let depth = 1;
		let i = re.lastIndex;
		while (i < code.length && depth > 0) {
			if (code[i] === "{") depth++;
			else if (code[i] === "}") depth--;
			i++;
		}
		out.push({ body: code.slice(re.lastIndex, i - 1), name: m[1], params: m[2].trim() });
	}
	return out;
}

/** Resolve um import "@/x/y" para o arquivo em src. */
function resolveAlias(spec: string): string | null {
	if (!spec.startsWith("@/")) return null;
	const base = path.join(SRC, spec.slice(2));
	for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")])
		if (existsSync(candidate)) return candidate;
	return null;
}

/** A função chama readAsUser diretamente ou via uma função importada que chama. */
function reachesReadAsUser(body: string, code: string): boolean {
	if (/\breadAsUser\(/.test(body)) return true;
	const imports = [...code.matchAll(/import\s*\{([^}]+)\}\s*from\s*"(@\/[^"]+)"/g)];
	for (const [, names, spec] of imports) {
		const file = resolveAlias(spec);
		if (!file) continue;
		const target = stripComments(read(file));
		for (const name of names.split(",").map(n => n.trim().split(/\s+as\s+/)[0])) {
			if (!new RegExp(`\\b${name}\\(`).test(body)) continue;
			const fn = exportedFunctions(target).find(f => f.name === name);
			if (fn && /\breadAsUser\(/.test(fn.body)) return true;
		}
	}
	return false;
}

// =============================================================================== estático

function checkServerActions() {
	const area = "Server Actions";
	const files = srcFiles.filter(f => /^\s*["']use server["']/m.test(read(f).slice(0, 200)));
	for (const file of files) {
		const code = stripComments(read(file));
		const declared = code.match(/export\s+(?:async\s+)?function\s+\w+/g)?.length ?? 0;
		const parsed = exportedFunctions(code);
		if (parsed.length !== declared)
			record(
				area,
				rel(file),
				"falha",
				`só ${parsed.length} de ${declared} funções exportadas puderam ser lidas`,
			);
		for (const fn of parsed) {
			const session = /\brequireSession\(/.test(fn.body)
				? "requireSession"
				: reachesReadAsUser(fn.body, code)
					? "readAsUser"
					: null;
			const zod = !fn.params || /\.(safeParse|parse)\(/.test(fn.body);
			const ok = !!session && zod;
			record(
				area,
				`${rel(file)} › ${fn.name}`,
				pass(ok),
				ok
					? `${session}${fn.params ? " + Zod" : ""}`
					: [!session && "sem requireSession/readAsUser", !zod && "entrada sem validação Zod"]
							.filter(Boolean)
							.join("; "),
			);
		}
	}
	if (!files.length) record(area, 'nenhum arquivo com "use server" encontrado', "atencao");
}

/** Rotas que dispensam as proteções padrão, com o motivo. */
const ROUTE_EXCEPTIONS: Record<string, string> = {
	"api/auth/[...all]": "Better Auth: rate limit próprio (login 5/min), trustedOrigins e cadastro desligado",
	"api/health": "só responde {ok:true}, sem dado",
};

function checkRoutes() {
	const area = "Rotas /api";
	const files = walk(path.join(SRC, "app", "api"), f => f.endsWith("route.ts"));
	for (const file of files) {
		const route = path.relative(path.join(SRC, "app"), path.dirname(file));
		if (ROUTE_EXCEPTIONS[route]) {
			record(area, `/${route}`, "ok", `exceção: ${ROUTE_EXCEPTIONS[route]}`);
			continue;
		}
		const code = stripComments(read(file));
		const methods = [
			...code.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g),
		].map(m => m[1]);
		const writes = methods.some(m => m !== "GET");
		const missing: string[] = [];
		if (!/\.take\(/.test(code)) missing.push("rate limit");
		if (writes && !/\breadJsonBody\(/.test(code)) missing.push("limite de corpo (readJsonBody)");
		if (writes && !/\.(safeParse|parse)\(/.test(code)) missing.push("validação Zod");
		if (route.startsWith("api/webhook/") && !/\bverifySignature\(/.test(code))
			missing.push("assinatura HMAC");
		const capture = /export\s+(?:async\s+)?function\s+OPTIONS\b/.test(code);
		if (capture && !/\ballowedOrigin\(/.test(code)) missing.push("origem autorizada (CORS)");
		const done = [
			capture && "origem",
			"rate limit",
			writes && "corpo",
			writes && "Zod",
			route.startsWith("api/webhook/") && "assinatura",
		].filter(Boolean);
		record(
			area,
			`/${route} (${methods.join(", ") || "sem handler"})`,
			pass(!missing.length),
			missing.length ? `falta: ${missing.join(", ")}` : done.join(" + "),
		);
	}
}

/** Migrations até esta já foram para produção; nelas aceitamos secure_table numa migration seguinte. */
const LAST_REVIEWED_MIGRATION = 9;

function checkMigrations() {
	const area = "Migrations";
	const dir = path.join(TRACK, "drizzle");
	const files = readdirSync(dir)
		.filter(f => /^\d{4}_.*\.sql$/.test(f))
		.sort();
	const secured = files.map(f => {
		const sql = read(path.join(dir, f));
		return new Set(
			[...sql.matchAll(/secure_table\(\s*'public\.("?)(\w+)\1'/gi)].map(m => m[2].toLowerCase()),
		);
	});
	let problems = 0;
	files.forEach((file, idx) => {
		const sql = read(path.join(dir, file)).replace(/--.*$/gm, "");
		const number = Number(file.slice(0, 4));
		const touched = [
			...[
				...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?(\w+)"?/gi),
			].map(m => ({
				kind: "tabela nova",
				table: m[1].toLowerCase(),
			})),
			...[
				...sql.matchAll(/alter\s+table\s+(?:only\s+)?(?:"?public"?\.)?"?(\w+)"?\s+add\s+column/gi),
			].map(m => ({ kind: "coluna nova", table: m[1].toLowerCase() })),
		];
		for (const t of [...new Map(touched.map(t => [`${t.kind}:${t.table}`, t])).values()]) {
			const same = secured[idx].has(t.table);
			const later = secured.slice(idx + 1).findIndex(s => s.has(t.table));
			if (same) continue;
			if (later >= 0 && number <= LAST_REVIEWED_MIGRATION) continue; // histórico, já em produção
			problems++;
			record(
				area,
				`${file}: ${t.kind} em ${t.table}`,
				"falha",
				"chame app_private.secure_table('public.<tabela>', true|false) no MESMO arquivo (incidente da 0007)",
			);
		}
	});
	if (!problems)
		record(area, `${files.length} migrations: toda tabela/coluna nova passa por secure_table`, "ok");

	// O SQL de produção traz o número esperado de migrations; tem que acompanhar o journal.
	const journal = JSON.parse(read(path.join(dir, "meta", "_journal.json"))) as {
		entries: { tag: string; when: number }[];
	};
	const last = journal.entries.at(-1);
	const prodSql = path.join(TRACK, "scripts", "security-check.sql");
	const expected = existsSync(prodSql)
		? read(prodSql).match(/(\d+)\s+as\s+esperado_migrations/)?.[1]
		: undefined;
	record(
		area,
		`scripts/security-check.sql espera ${journal.entries.length} migrations (última ${last?.tag})`,
		pass(Number(expected) === journal.entries.length),
		Number(expected) === journal.entries.length
			? undefined
			: `o arquivo espera ${expected ?? "?"}; atualize o número em "as esperado_migrations"`,
	);
}

function checkSecretsInCode() {
	const area = "Segredos no código";
	const publicEnv = [...srcFiles, path.join(TRACK, "next.config.ts")].filter(f =>
		/NEXT_PUBLIC_/.test(stripComments(read(f))),
	);
	record(
		area,
		"nenhum NEXT_PUBLIC_ (tudo do env fica no servidor)",
		pass(!publicEnv.length),
		publicEnv.map(rel).join(", ") || undefined,
	);

	const clientFiles = srcFiles.filter(f => /^\s*["']use client["']/m.test(read(f).slice(0, 200)));
	const serverOnly = /from\s+"@\/(db|lib\/secrets|lib\/dal|lib\/env)(\/[^"]*)?"/;
	const leaking = clientFiles.filter(f => serverOnly.test(read(f)));
	record(
		area,
		'componentes "use client" não importam banco, segredos nem env',
		pass(!leaking.length),
		leaking.map(rel).join(", ") || undefined,
	);

	const serviceInReader = srcFiles.filter(
		f =>
			(f.startsWith(path.join(SRC, "components")) ||
				f.startsWith(path.join(SRC, "lib", "dashboard"))) &&
			/\bserviceDb\(/.test(stripComments(read(f))),
	);
	record(
		area,
		"serviceDb() (escrita) fora dos componentes e das consultas do painel",
		pass(!serviceInReader.length),
		serviceInReader.map(rel).join(", ") || undefined,
	);

	const browserCode = [
		...walk(path.join(SRC, "tracker"), isCode),
		...(existsSync(path.join(TRACK, "public", "t.js")) ? [path.join(TRACK, "public", "t.js")] : []),
	];
	const secretRe = /process\.env|ENCRYPTION_KEY|DATABASE_URL|BETTER_AUTH_SECRET|_enc\b|postgres:\/\//;
	const inBrowser = browserCode.filter(f => secretRe.test(stripComments(read(f))));
	record(
		area,
		"o script do site (src/tracker, public/t.js) não cita env nem colunas cifradas",
		pass(!inBrowser.length),
		inBrowser.map(rel).join(", ") || undefined,
	);
}

function checkIpTrust() {
	const area = "IP confiável";
	const forgeable = srcFiles.filter(f =>
		/["'](cf-connecting-ip|true-client-ip|x-client-ip|fastly-client-ip)["']/i.test(
			stripComments(read(f)),
		),
	);
	record(
		area,
		"nenhum cabeçalho de IP forjável (cf-connecting-ip, true-client-ip…)",
		pass(!forgeable.length),
		forgeable.map(rel).join(", ") || undefined,
	);
	const clientIp = path.join(SRC, "lib", "http", "client-ip.ts");
	const direct = srcFiles.filter(
		f => f !== clientIp && /headers\.get\(\s*["'](x-real-ip|x-forwarded-for)["']/i.test(read(f)),
	);
	record(
		area,
		"só src/lib/http/client-ip.ts lê X-Real-IP/X-Forwarded-For",
		pass(!direct.length),
		direct.map(rel).join(", ") || undefined,
	);
}

function checkXss() {
	const area = "XSS";
	const bad = srcFiles.filter(f =>
		/dangerouslySetInnerHTML|\beval\(|new Function\(|\.innerHTML\s*=/.test(stripComments(read(f))),
	);
	record(
		area,
		"sem dangerouslySetInnerHTML, eval, new Function ou innerHTML",
		pass(!bad.length),
		bad.map(rel).join(", ") || undefined,
	);
}

function checkLogs() {
	const area = "Logs";
	const raw: string[] = [];
	for (const file of srcFiles.filter(f => !f.includes(`${path.sep}tracker${path.sep}`))) {
		const lines = stripComments(read(file)).split("\n");
		lines.forEach((line, i) => {
			const m = line.match(/console\.(error|warn|log)\((.*)$/);
			if (!m) return;
			const args = [m[2], lines[i + 1] ?? "", lines[i + 2] ?? ""].join(" ");
			if (/safeErrorMessage|describeGraphError/.test(args)) return;
			if (/(?:,|\()\s*(error|err|e|cause)\s*(?:\)|,)|\b(error|err|e)\.message\b/.test(args))
				raw.push(`${rel(file)}:${i + 1}`);
		});
	}
	record(
		area,
		"erros logados passam por safeErrorMessage() (o Drizzle põe os parâmetros na mensagem)",
		raw.length ? "atencao" : "ok",
		raw.join(", ") || undefined,
	);
}

function checkConfig() {
	const area = "Configuração";
	const next = read(path.join(TRACK, "next.config.ts"));
	const wanted = [
		"frame-ancestors 'none'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"default-src 'self'",
		"X-Frame-Options",
		"X-Content-Type-Options",
		"Strict-Transport-Security",
		"Referrer-Policy",
		"Permissions-Policy",
	];
	const missing = wanted.filter(w => !next.includes(w));
	record(
		area,
		"next.config.ts: CSP e cabeçalhos de segurança",
		pass(!missing.length),
		missing.length ? `falta: ${missing.join(", ")}` : undefined,
	);
	record(
		area,
		"next.config.ts: poweredByHeader: false (sem X-Powered-By)",
		/poweredByHeader:\s*false/.test(next) ? "ok" : "atencao",
	);

	const auth = stripComments(read(path.join(SRC, "lib", "auth.ts")));
	const authRules: [string, RegExp][] = [
		["cadastro público desligado", /disableSignUp:\s*true/],
		["rate limit ligado", /rateLimit:\s*\{[\s\S]*?enabled:\s*true/],
		["login limitado a 5/min", /"\/sign-in\/email":\s*\{\s*max:\s*5,\s*window:\s*60/],
		["trustedOrigins", /trustedOrigins:/],
		["cookie Secure em https", /useSecureCookies:/],
		["IP do X-Real-IP primeiro", /ipAddressHeaders:\s*\[\s*"x-real-ip"/],
	];
	const authMissing = authRules.filter(([, re]) => !re.test(auth)).map(([name]) => name);
	const minLen = Number(auth.match(/minPasswordLength:\s*(\d+)/)?.[1] ?? 0);
	if (minLen < 12) authMissing.push("senha mínima de 12");
	record(
		area,
		"src/lib/auth.ts: login protegido",
		pass(!authMissing.length),
		authMissing.length ? `falta: ${authMissing.join(", ")}` : undefined,
	);

	for (const compose of [
		path.join(TRACK, "docker-compose.yml"),
		path.join(TRACK, "deploy", "docker-compose.yml"),
	]) {
		if (!existsSync(compose)) continue;
		const ports = [...read(compose).matchAll(/^\s*-\s*["']?([\d.:]+:\d+)["']?\s*$/gm)].map(m => m[1]);
		const open = ports.filter(p => !p.startsWith("127.0.0.1:"));
		record(
			area,
			`${rel(compose)}: portas só em 127.0.0.1`,
			pass(!open.length),
			open.length ? `aberta(s): ${open.join(", ")}` : undefined,
		);
	}

	const caddy = path.join(TRACK, "deploy", "Caddyfile");
	const nginx = path.join(TRACK, "deploy", "nginx.conf");
	if (existsSync(caddy))
		record(
			area,
			"deploy/Caddyfile sobrescreve X-Real-IP",
			pass(/header_up\s+X-Real-IP\s+\{remote_host\}/i.test(read(caddy))),
		);
	if (existsSync(nginx))
		record(
			area,
			"deploy/nginx.conf sobrescreve X-Real-IP e X-Forwarded-For",
			pass(
				/proxy_set_header\s+X-Real-IP\s+\$remote_addr/i.test(read(nginx)) &&
					/proxy_set_header\s+X-Forwarded-For\s+\$remote_addr/i.test(read(nginx)),
			),
		);
}

function git(args: string[]): string {
	return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
}

function checkGit() {
	const area = "Git e imagem";
	let tracked: string[] = [];
	try {
		tracked = git(["ls-files"]).split("\n");
	} catch {
		record(area, "git indisponível: verificações do repositório puladas", "atencao");
		return;
	}
	const envFiles = tracked.filter(f => /(^|\/)\.env(\.|$)/.test(f) && !/\.env\.example$/.test(f));
	record(area, "nenhum .env no git", pass(!envFiles.length), envFiles.join(", ") || undefined);

	// O Dockerfile usa a raiz do monorepo como contexto e o Next copia .env/.env.production para o standalone.
	const ignore = existsSync(path.join(ROOT, ".dockerignore")) ? read(path.join(ROOT, ".dockerignore")) : "";
	const ignoresEnv = /^\*\*\/\.env\s*$/m.test(ignore) && /^\*\*\/\.env\.\*\s*$/m.test(ignore);
	record(
		area,
		".dockerignore exclui **/.env* (o Next copia o .env para a imagem standalone)",
		pass(ignoresEnv),
	);

	const patterns = [
		"EAA[A-Za-z0-9]{40,}", // token da Meta
		"-----BEGIN [A-Z ]*PRIVATE KEY-----",
		"ghp_[A-Za-z0-9]{30,}",
		"github_pat_[A-Za-z0-9_]{30,}",
	];
	let hits: string[] = [];
	try {
		hits = git([
			"log",
			"--all",
			"-p",
			"--no-color",
			"-G",
			patterns.join("|"),
			"--format=commit %h",
			"--",
			"track",
		])
			.split("\n")
			.filter(l => /^\+/.test(l) && new RegExp(patterns.join("|")).test(l))
			.map(l => l.slice(0, 60));
	} catch {
		record(area, "histórico do git não pôde ser lido", "atencao");
		return;
	}
	record(
		area,
		"histórico do git (track/) sem token da Meta, chave privada ou token do GitHub",
		pass(!hits.length),
		hits.length ? `${hits.length} linha(s): ${hits.slice(0, 3).join(" | ")}` : undefined,
	);
}

// =============================================================================== externo (só leitura)

const EVIL_ORIGIN = "https://origem-nao-autorizada.example";

async function req(base: string, pathname: string, init: RequestInit = {}) {
	return fetch(new URL(pathname, base), {
		redirect: "manual",
		...init,
		signal: AbortSignal.timeout(15_000),
	});
}

async function checkExternal(base: string) {
	const area = `Externo (${new URL(base).host})`;
	const https = base.startsWith("https://");
	const run = async (name: string, fn: () => Promise<[Level, string?]>) => {
		try {
			const [level, detail] = await fn();
			record(area, name, level, detail);
		} catch (error) {
			record(area, name, "falha", `erro: ${error instanceof Error ? error.message : String(error)}`);
		}
	};

	if (https)
		await run("http:// redireciona para https://", async () => {
			const res = await req(base.replace(/^https:/, "http:"), "/login", { method: "HEAD" });
			const loc = res.headers.get("location") ?? "";
			return [
				pass([301, 302, 307, 308].includes(res.status) && loc.startsWith("https://")),
				`${res.status} → ${loc || "—"}`,
			];
		});

	await run("/login: cabeçalhos de segurança e CSP", async () => {
		const res = await req(base, "/login");
		const h = res.headers;
		const csp = h.get("content-security-policy") ?? "";
		const missing = [
			res.status !== 200 && `status ${res.status}`,
			!csp.includes("frame-ancestors 'none'") && "CSP frame-ancestors",
			!csp.includes("object-src 'none'") && "CSP object-src",
			!csp.includes("default-src 'self'") && "CSP default-src",
			h.get("x-frame-options") !== "DENY" && "X-Frame-Options",
			h.get("x-content-type-options") !== "nosniff" && "nosniff",
			!h.get("referrer-policy") && "Referrer-Policy",
			!h.get("permissions-policy") && "Permissions-Policy",
			https && !h.get("strict-transport-security") && "HSTS",
		].filter(Boolean);
		return [pass(!missing.length), missing.length ? `falta: ${missing.join(", ")}` : undefined];
	});

	await run("sem X-Powered-By", async () => {
		const res = await req(base, "/login", { method: "HEAD" });
		const v = res.headers.get("x-powered-by");
		return [v ? "atencao" : "ok", v ? `X-Powered-By: ${v}` : undefined];
	});

	await run("/painel sem login redireciona para /login", async () => {
		const res = await req(base, "/painel");
		const loc = res.headers.get("location") ?? "";
		return [
			pass([302, 303, 307, 308].includes(res.status) && loc.includes("/login")),
			`${res.status} → ${loc || "—"}`,
		];
	});

	await run('/api/health responde só {"ok":true}', async () => {
		const res = await req(base, "/api/health");
		const body = (await res.text()).trim();
		return [pass(res.status === 200 && body === '{"ok":true}'), `${res.status} ${body.slice(0, 60)}`];
	});

	await run("/api/auth/get-session sem cookie não traz sessão", async () => {
		const res = await req(base, "/api/auth/get-session");
		const body = (await res.text()).trim();
		return [
			pass(res.status === 200 ? body === "null" || body === "" : res.status >= 400),
			`${res.status} ${body.slice(0, 40)}`,
		];
	});

	await run("CORS: preflight de origem estranha em /api/event é recusado", async () => {
		const res = await req(base, "/api/event", {
			headers: { "access-control-request-method": "POST", origin: EVIL_ORIGIN },
			method: "OPTIONS",
		});
		const acao = res.headers.get("access-control-allow-origin");
		return [pass(res.status >= 400 && !acao), `${res.status}${acao ? ` ACAO=${acao}` : ""}`];
	});

	await run("/api/config/public não responde para origem estranha nem sem origem", async () => {
		const evil = await req(base, "/api/config/public", { headers: { origin: EVIL_ORIGIN } });
		const none = await req(base, "/api/config/public");
		const evilBody = await evil.text();
		await none.text();
		return [
			pass(evil.status === 403 && none.status === 403 && !evilBody.includes("pixels")),
			`origem estranha ${evil.status}, sem origem ${none.status}`,
		];
	});

	await run("webhook não aceita GET", async () => {
		const res = await req(base, "/api/webhook/compra");
		await res.text();
		return [pass(res.status === 405 || res.status === 404), String(res.status)];
	});

	await run("arquivos internos não são servidos (/.env, /.git/config, /SECURITY.md)", async () => {
		const exposed: string[] = [];
		for (const p of ["/.env", "/.git/config", "/SECURITY.md", "/package.json"]) {
			const res = await req(base, p);
			const body = await res.text();
			if (res.status === 200 && !/<html/i.test(body)) exposed.push(p);
		}
		return [pass(!exposed.length), exposed.length ? `expostos: ${exposed.join(", ")}` : undefined];
	});

	await run("/t.js não carrega segredo", async () => {
		const res = await req(base, "/t.js");
		const js = await res.text();
		const bad =
			/process\.env|ENCRYPTION_KEY|DATABASE_URL|BETTER_AUTH_SECRET|postgres:\/\/|capi_token|api_secret/.test(
				js,
			);
		return [pass(res.status === 200 && !bad), `${res.status}, ${js.length} bytes`];
	});
}

// =============================================================================== ativo (só local)

async function checkActive(base: string) {
	const area = "Ativo (local)";
	const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
		body: JSON.stringify(body),
		headers: { "content-type": "application/json", origin: base, ...headers },
		method: "POST",
	});
	const run = async (name: string, fn: () => Promise<[Level, string?]>) => {
		try {
			const [level, detail] = await fn();
			record(area, name, level, detail);
		} catch (error) {
			record(area, name, "falha", `erro: ${error instanceof Error ? error.message : String(error)}`);
		}
	};

	await run("cadastro público recusado", async () => {
		const res = await req(
			base,
			"/api/auth/sign-up/email",
			json({ email: `sec-check-${Date.now()}@local.test`, name: "x", password: "SenhaQualquer123!" }),
		);
		await res.text();
		return [pass(res.status >= 400 && res.status < 500), String(res.status)];
	});

	for (const route of ["/api/webhook/compra", "/api/webhook/relay-status"])
		await run(`${route} sem assinatura → 401`, async () => {
			const res = await req(base, route, json({ type: "relay_status" }));
			const body = await res.text();
			if (res.status === 503) return ["atencao", "segredo do webhook não configurado neste ambiente"];
			return [pass(res.status === 401), `${res.status} ${body.slice(0, 60)}`];
		});

	await run("/api/webhook/compra com corpo de 70 KB → 413", async () => {
		const res = await req(base, "/api/webhook/compra", json({ pad: "x".repeat(70 * 1024) }));
		await res.text();
		return [pass(res.status === 413), String(res.status)];
	});

	await run("/api/event de origem estranha → 403", async () => {
		const res = await req(base, "/api/event", json({}, { origin: EVIL_ORIGIN }));
		await res.text();
		return [pass(res.status === 403), String(res.status)];
	});

	await run("6ª tentativa de login em 1 min → 429, mesmo trocando XFF e cf-connecting-ip", async () => {
		// Simula o proxy: X-Real-IP fixo (sobrescrito por ele); o resto, o cliente inventa a cada tentativa.
		const statuses: number[] = [];
		for (let i = 0; i < 6; i++) {
			const fake = `198.51.100.${i + 1}`;
			const res = await req(
				base,
				"/api/auth/sign-in/email",
				json(
					{ email: "sec-check@local.test", password: "senha-errada-123456" },
					{
						"cf-connecting-ip": fake,
						"x-forwarded-for": `${fake}, 203.0.113.77`,
						"x-real-ip": "203.0.113.77",
					},
				),
			);
			await res.text();
			statuses.push(res.status);
		}
		return [pass(statuses.at(-1) === 429), statuses.join(", ")];
	});
}

// =============================================================================== main

function parseArgs(argv: string[]) {
	const url = argv.includes("--url") ? argv[argv.indexOf("--url") + 1] : undefined;
	return { active: argv.includes("--ativo"), url };
}

async function main() {
	const { url, active } = parseArgs(process.argv.slice(2));

	checkServerActions();
	checkRoutes();
	checkMigrations();
	checkSecretsInCode();
	checkIpTrust();
	checkXss();
	checkLogs();
	checkConfig();
	checkGit();

	if (url) {
		if (!/^https?:\/\//.test(url)) throw new Error(`--url inválida: ${url}`);
		await checkExternal(url);
	}
	if (active) {
		const host = url ? new URL(url).hostname : "";
		if (!["localhost", "127.0.0.1", "::1"].includes(host))
			throw new Error(
				"--ativo só roda contra localhost/127.0.0.1 (envia POSTs e bloqueia o login por 1 min)",
			);
		await checkActive(url!);
	}

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
	if (!url) console.log("Dica: --url https://track.rastrewin.com confere também de fora (só leitura).");
	if (count("falha")) process.exit(1);
}

main().catch((error: unknown) => {
	console.error("✗ erro ao rodar a verificação:", error instanceof Error ? error.message : error);
	process.exit(1);
});
