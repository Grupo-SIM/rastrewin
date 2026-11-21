/**
 * Backend (NestJS): as regras de docs/engineering-rules.md › Security conferidas no código.
 * Identidade vem do token, rotas públicas têm limite, DTOs têm tamanho, cabeçalhos, webhooks, imagem.
 */
import path from "node:path";
import { balanced, exists, lineOf, pass, read, record, stripComments, walk } from "./lib";

const AREA = "Backend";

/** Rotas públicas que dispensam limite próprio (o global de 300/min por IP continua valendo), com o motivo. */
const PUBLIC_EXCEPTIONS: Record<string, string> = {
	"GET /health": "só responde {ok:true}, para o HEALTHCHECK da imagem",
};

/** Risco aceito pelo time: registrado em docs/engineering-rules.md › Accepted risks. */
function acceptedRisk(marker: RegExp): boolean {
	const rules = exists("docs/engineering-rules.md") ? read("docs/engineering-rules.md") : "";
	const line = rules.split("\n").find(l => l.startsWith("- **Accepted risks:**")) ?? "";
	return marker.test(line);
}
const ROUTE_DECORATOR = /@(Get|Post|Put|Patch|Delete)\(\s*(?:["'`]([^"'`]*)["'`])?\s*\)/g;

interface Route {
	file: string;
	line: number;
	method: string;
	path: string;
	guard: string | null;
	body: string;
	params: string;
}

function parseRoutes(file: string): Route[] {
	const code = stripComments(read(file));
	const classAt = code.search(/export\s+class\s+\w+/);
	const prefix = code.match(/@Controller\(\s*["'`]([^"'`]*)["'`]/)?.[1] ?? "";
	const classGuard = code.slice(0, classAt).match(/@UseGuards\((\w+)/)?.[1] ?? null;
	const routes: Route[] = [];
	for (const m of code.matchAll(ROUTE_DECORATOR)) {
		const start = m.index ?? 0;
		// Assinatura do método: primeiro "nome(" depois dos decoradores (que começam com @).
		const sig = /^\s*(?:async\s+)?(\w+)\s*\(/gm;
		sig.lastIndex = start;
		let s = sig.exec(code);
		while (s && /^\s*@/.test(code.slice(s.index, s.index + s[0].length + 1))) s = sig.exec(code);
		if (!s) continue;
		const params = balanced(code, s.index + s[0].length - 1);
		const open = params ? code.indexOf("{", params.end) : -1;
		const body = open >= 0 ? (balanced(code, open)?.inner ?? "") : "";
		const decorators = code.slice(start, s.index);
		routes.push({
			body,
			file,
			guard: decorators.match(/@UseGuards\((\w+)/)?.[1] ?? classGuard,
			line: lineOf(code, start),
			method: m[1].toUpperCase(),
			params: params?.inner ?? "",
			path: `/${[prefix, m[2] ?? ""].filter(Boolean).join("/")}`,
		});
	}
	return routes;
}

function checkRoutes() {
	const files = walk("backend/src", f => f.endsWith(".controller.ts"));
	const routes = files.flatMap(parseRoutes);
	if (!routes.length) return record(AREA, "nenhuma rota encontrada nos controllers", "falha");
	for (const r of routes) {
		const where = `${r.file}:${r.line}`;
		const limited = /\benforce\(|\.take\(/.test(r.body);
		const userIdFromUrl = /@(Param|Query)\(\s*["'`](user_?id|userId|uid|accountId)["'`]/i.test(r.params);
		const exception = PUBLIC_EXCEPTIONS[`${r.method} ${r.path}`];
		const problems = [
			!r.body && "corpo do método não pôde ser lido",
			!r.guard && !limited && !exception && "rota pública sem limite próprio (enforce/.take)",
			userIdFromUrl && "id de usuário vindo da URL (a identidade tem de vir do token)",
		].filter(Boolean);
		record(
			AREA,
			`${r.method} ${r.path}`,
			pass(!problems.length),
			problems.length
				? `${problems.join("; ")} — ${where}`
				: r.guard
					? `${r.guard}${limited ? " + limite" : ""}`
					: exception
						? `exceção: ${exception}`
						: "pública + limite próprio",
		);
	}
}

function checkDtos() {
	const loose: string[] = [];
	let fields = 0;
	for (const file of walk("backend/src", f => f.endsWith(".ts"))) {
		const code = stripComments(read(file));
		for (const m of code.matchAll(/class\s+(\w+Dto)\b[^{]*\{/g)) {
			const body = balanced(code, (m.index ?? 0) + m[0].length - 1)?.inner ?? "";
			for (const stmt of body.split(";")) {
				const field = stmt.match(/(\w+)\??:\s*string(\[\])?\s*$/);
				if (!field) continue;
				fields++;
				if (!/@(MaxLength|Length|IsIn|IsEnum)\(/.test(stmt))
					loose.push(`${m[1]}.${field[1]} (${file})`);
			}
		}
	}
	record(
		AREA,
		"campos texto dos DTOs com tamanho máximo (@MaxLength/@Length/@IsIn)",
		pass(!loose.length && fields > 0),
		loose.length ? `sem limite: ${loose.join(", ")}` : `${fields} campos`,
	);
}

function checkMain() {
	const main = stripComments(read("backend/src/main.ts"));
	record(
		AREA,
		"ValidationPipe recusa campo não declarado (whitelist + forbidNonWhitelisted)",
		pass(/whitelist:\s*true/.test(main) && /forbidNonWhitelisted:\s*true/.test(main)),
	);
	const headers: [string, RegExp][] = [
		["X-Content-Type-Options nosniff", /X-Content-Type-Options["'],\s*["']nosniff/],
		["X-Frame-Options DENY", /X-Frame-Options["'],\s*["']DENY/],
		["Strict-Transport-Security", /Strict-Transport-Security["'],\s*["']max-age=\d{8}/],
		["CSP default-src 'none'", /Content-Security-Policy["'],\s*["']default-src 'none'/],
		["sem X-Powered-By", /disable\(\s*["']x-powered-by["']\s*\)/],
	];
	const missing = headers.filter(([, re]) => !re.test(main)).map(([name]) => name);
	record(
		AREA,
		"cabeçalhos de segurança da API (main.ts)",
		pass(!missing.length),
		missing.join(", ") || undefined,
	);
	record(
		AREA,
		"limite global por IP antes das rotas",
		pass(/createRateLimiter\(/.test(main) && /app\.use\(\s*globalRateLimit\s*\)/.test(main)),
	);
	const cors = main.match(/origin:\s*([^\n,]+)/)?.[1] ?? "";
	record(
		AREA,
		"CORS com uma origem fixa (sem refletir qualquer origem)",
		pass(!!cors && !/true|\*/.test(cors)),
		cors.trim() || "origin não encontrado",
	);
	const jwtEnforced = /JWT_SECRET[\s\S]{0,300}<\s*32[\s\S]{0,200}throw/.test(main);
	const jwtAccepted = !jwtEnforced && acceptedRisk(/JWT_SECRET/);
	record(
		AREA,
		"JWT_SECRET curto impede o boot",
		pass(jwtEnforced || jwtAccepted, "atencao"),
		jwtEnforced
			? undefined
			: jwtAccepted
				? "risco aceito (docs/engineering-rules.md): só aviso no boot; mantenha o de produção com 32+"
				: "com menos de 32 caracteres o boot só registra um aviso (logger.warn)",
	);
}

function checkIpAndSecrets() {
	const code = walk("backend/src", f => f.endsWith(".ts")).map(f => [f, stripComments(read(f))] as const);
	const foreign = code
		.filter(([, c]) => /cf-connecting-ip|true-client-ip|x-client-ip|fastly-client-ip/i.test(c))
		.map(([f]) => f);
	const xff = code
		.filter(([f, c]) => /x-forwarded-for|x-real-ip/i.test(c) && !f.endsWith("http/client-ip.ts"))
		.map(([f]) => f);
	record(
		AREA,
		"IP do cliente só em http/client-ip.ts (sem cabeçalhos de CDN)",
		pass(!foreign.length && !xff.length),
		[...foreign, ...xff].join(", ") || undefined,
	);

	const webhooks = walk("backend/src", f => f.endsWith(".controller.ts")).filter(f =>
		/@Post\(\s*["'`][^"'`]*webhook/.test(read(f)),
	);
	for (const file of webhooks) {
		const dir = path.dirname(file);
		const ok = walk(dir, f => f.endsWith(".ts")).some(f => /timingSafeEqual\(/.test(read(f)));
		record(AREA, `webhook ${file}: segredo comparado em tempo constante`, pass(ok));
	}

	const admin = stripComments(read("backend/src/admin/admin.controller.ts"));
	const endRoute = parseRoutes("backend/src/admin/admin.controller.ts").find(r => r.path.endsWith("/end"));
	record(
		AREA,
		"ferramenta de teste (encerrar sorteio) desligada em produção sem ENABLE_TEST_TOOLS",
		pass(!!endRoute && /ENABLE_TEST_TOOLS/.test(endRoute.body) && /NODE_ENV/.test(admin)),
	);

	const plans = exists("backend/src/plans.ts") ? read("backend/src/plans.ts") : "";
	const prefill = /cpf/i.test(plans) && /phone/i.test(plans);
	const prefillAccepted = prefill && acceptedRisk(/CPF/);
	record(
		AREA,
		"dados pessoais só saem pelas allow-lists (toPublicUser/toAdminUser)",
		pass(!prefill || prefillAccepted, "atencao"),
		prefillAccepted
			? "risco aceito (docs/engineering-rules.md): checkoutUrl leva CPF e telefone para o SimIntPay abrir preenchido"
			: prefill
				? "checkoutUrl (/users/me e POST /users) leva CPF e telefone na query para o pré-preenchimento do checkout (backend/src/plans.ts)"
				: undefined,
	);
}

function checkImage() {
	// Sem comentários: o Dockerfile explica em comentário por que NÃO usa --accept-data-loss.
	const docker = read("backend/Dockerfile").replace(/^\s*#.*$/gm, "");
	const user = [...docker.matchAll(/^USER\s+(\S+)/gm)].at(-1)?.[1];
	record(
		AREA,
		"imagem roda sem root",
		pass(!!user && user !== "root" && user !== "0"),
		`USER ${user ?? "—"}`,
	);
	record(AREA, "prisma db push sem --accept-data-loss", pass(!/--accept-data-loss/.test(docker)));
	record(
		AREA,
		"HEALTHCHECK na imagem",
		pass(/^HEALTHCHECK/m.test(docker), "atencao"),
		/^HEALTHCHECK/m.test(docker)
			? undefined
			: "sem HEALTHCHECK e sem rota /health: o Komodo não sabe se a API travou",
	);
	const migrations = exists("backend/prisma/migrations");
	record(
		AREA,
		"mudanças de banco versionadas (migrations)",
		pass(migrations, "atencao"),
		migrations
			? undefined
			: "sem prisma/migrations: o schema vai por `db push` no boot, sem histórico nem revisão",
	);
}

export function checkBackend() {
	checkRoutes();
	checkDtos();
	checkMain();
	checkIpAndSecrets();
	checkImage();
}
