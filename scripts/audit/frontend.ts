/** Frontend (rastrewin.com) e VSL (vsl.rastrewin.com): cabeçalhos, XSS, segredos públicos, LGPD, imagem. */
import { exists, isCode, lineOf, pass, read, readIf, record, stripComments, walk } from "./lib";

/** Sem HTML cru, eval ou Function: o React escapa todo o resto. */
function checkXss(area: string, dirs: string[]) {
	const hits: string[] = [];
	for (const file of dirs.flatMap(d => walk(d, isCode))) {
		const code = stripComments(read(file));
		for (const m of code.matchAll(/dangerouslySetInnerHTML|\beval\(|new Function\(|\.innerHTML\s*=/g))
			hits.push(`${file}:${lineOf(code, m.index ?? 0)}`);
	}
	record(
		area,
		"sem dangerouslySetInnerHTML, eval, new Function ou innerHTML",
		pass(!hits.length),
		hits.join(", ") || undefined,
	);
}

function checkPublicEnv(area: string, dirs: string[]) {
	const names = new Set<string>();
	for (const file of dirs.flatMap(d => walk(d, isCode)))
		for (const m of read(file).matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) names.add(m[0]);
	const secret = [...names].filter(n => /SECRET|TOKEN|PASSWORD|PRIVATE|_KEY\b/.test(n));
	record(
		area,
		"nenhum NEXT_PUBLIC_ com nome de segredo (vai para o navegador)",
		pass(!secret.length),
		secret.length ? secret.join(", ") : [...names].sort().join(", ") || "nenhum",
	);
}

function checkBlankLinks(area: string, dirs: string[]) {
	const bad: string[] = [];
	for (const file of dirs.flatMap(d => walk(d, f => f.endsWith(".tsx")))) {
		const code = stripComments(read(file));
		for (const m of code.matchAll(/target=(?:"_blank"|\{["']_blank["']\})/g)) {
			const idx = m.index ?? 0;
			const start = code.lastIndexOf("<", idx);
			const next = code.indexOf("<", idx);
			const element = code.slice(start, next === -1 ? idx + 300 : next);
			if (!/noopener|noreferrer/.test(element)) bad.push(`${file}:${lineOf(code, idx)}`);
		}
	}
	record(area, 'links target="_blank" com rel="noopener"', pass(!bad.length), bad.join(", ") || undefined);
}

function checkImage(area: string, dockerfile: string) {
	const docker = read(dockerfile);
	const user = [...docker.matchAll(/^USER\s+(\S+)/gm)].at(-1)?.[1];
	record(
		area,
		"imagem roda sem root",
		pass(!!user && user !== "root" && user !== "0"),
		`USER ${user ?? "—"}`,
	);
}

function checkFrontend() {
	const area = "Frontend";
	const config = stripComments(read("frontend/next.config.mjs"));
	const csp: [string, RegExp][] = [
		["default-src 'self'", /default-src 'self'/],
		["frame-ancestors 'none'", /frame-ancestors 'none'/],
		["object-src 'none'", /object-src 'none'/],
		["base-uri", /base-uri '(self|none)'/],
		["form-action", /form-action '(self|none)'/],
	];
	const missingCsp = csp.filter(([, re]) => !re.test(config)).map(([n]) => n);
	record(
		area,
		"CSP do next.config.mjs fecha embutir, plugins, <base> e formulários",
		pass(!missingCsp.length),
		missingCsp.join(", ") || undefined,
	);
	const headers = [
		"X-Content-Type-Options",
		"X-Frame-Options",
		"Strict-Transport-Security",
		"Referrer-Policy",
		"Permissions-Policy",
	];
	const missingHeaders = headers.filter(h => !config.includes(h));
	record(
		area,
		"cabeçalhos de segurança no next.config.mjs",
		pass(!missingHeaders.length),
		missingHeaders.join(", ") || undefined,
	);
	record(area, "poweredByHeader: false", pass(/poweredByHeader:\s*false/.test(config)));

	const dirs = ["frontend/app", "frontend/components", "frontend/lib"];
	checkXss(area, dirs);
	checkPublicEnv(area, dirs);
	checkBlankLinks(area, dirs);

	const page = stripComments(readIf("frontend/app/page.tsx"));
	const opens = [...page.matchAll(/window\.open\(([^)]*)\)/g)].filter(m => !/noopener/.test(m[1]));
	record(
		area,
		"window.open sem acesso de volta à página (noopener)",
		pass(!opens.length, "atencao"),
		opens.length
			? `frontend/app/page.tsx:${opens.map(m => lineOf(page, m.index ?? 0)).join(", ")}: a aba do checkout fica com window.opener para o rastrewin.com (o código guarda a referência para redirecionar a aba)`
			: undefined,
	);

	const admin = readIf("frontend/app/admin/page.tsx");
	record(
		area,
		'botão de teste "Encerrar em 10s" preso a NEXT_PUBLIC_ENABLE_TEST_TOOLS',
		pass(/NEXT_PUBLIC_ENABLE_TEST_TOOLS\s*===\s*["']true["']/.test(admin)),
	);
	const layout = readIf("frontend/app/layout.tsx");
	record(
		area,
		"t.js com stub e data-no-auto (InitiateCheckout só pelo código da landing)",
		pass(/trck-stub/.test(layout) && /\/t\.js/.test(layout) && /data-no-auto/.test(layout)),
	);

	const privacy = readIf("frontend/app/privacidade/page.tsx");
	record(
		area,
		"política de privacidade com POLICY_VERSION",
		pass(/POLICY_VERSION\s*=\s*["']\d+["']/.test(privacy)),
	);
	const markers = (privacy.match(/PERSONALIZAR|RASCUNHO/g) ?? []).length;
	const noDpo = /ENCARREGADO\s*=\s*["']{2}/.test(privacy);
	record(
		area,
		"política de privacidade revisada (sem marcas de rascunho)",
		pass(!markers && !noDpo, "atencao"),
		[markers && `${markers} marcas PERSONALIZAR/RASCUNHO`, noDpo && "ENCARREGADO vazio"]
			.filter(Boolean)
			.join("; ") || undefined,
	);
	const storageKeys = new Set<string>();
	for (const file of dirs.flatMap(d => walk(d, isCode))) {
		const code = read(file);
		for (const m of code.matchAll(/localStorage\.(?:get|set)Item\(\s*["'](\w+)["']/g))
			storageKeys.add(m[1]);
		for (const m of code.matchAll(/export const \w*KEY\s*=\s*["'](\w+)["']/g)) storageKeys.add(m[1]);
	}
	const undocumented = [...storageKeys].filter(k => !privacy.includes(k));
	record(
		area,
		"tabela de cookies da política cita toda chave guardada no navegador",
		pass(!undocumented.length, "atencao"),
		undocumented.length ? `fora da tabela: ${undocumented.join(", ")}` : [...storageKeys].join(", "),
	);

	const hasRobots = exists("frontend/app/robots.ts") || exists("frontend/public/robots.txt");
	const privateAreas = ["admin", "dashboard", "login"].filter(dir => {
		const files = walk(`frontend/app/${dir}`, f => /(page|layout)\.tsx$/.test(f));
		return !files.some(f => /robots|noindex/.test(read(f)));
	});
	record(
		area,
		"áreas logadas fora dos buscadores (noindex ou robots)",
		pass(hasRobots || !privateAreas.length, "atencao"),
		!hasRobots && privateAreas.length
			? `sem noindex nem robots.txt: /${privateAreas.join(", /")}`
			: undefined,
	);
	checkImage(area, "frontend/Dockerfile");
}

function checkVsl() {
	const area = "VSL";
	const compose = readIf("vsl/compose.yml");
	const labels: [string, RegExp][] = [
		["HSTS", /caddy\.header\.Strict-Transport-Security/],
		["nosniff", /caddy\.header\.X-Content-Type-Options:\s*nosniff/],
		["X-Frame-Options DENY", /caddy\.header\.X-Frame-Options:\s*DENY/],
		["CSP frame-ancestors 'none'", /caddy\.header\.Content-Security-Policy:.*frame-ancestors 'none'/],
		["CSP object-src 'none'", /caddy\.header\.Content-Security-Policy:.*object-src 'none'/],
		["X-Robots-Tag noindex", /caddy\.header\.X-Robots-Tag:.*noindex/],
		["sem cabeçalho Server", /caddy\.header\.-Server/],
	];
	const missing = labels.filter(([, re]) => !re.test(compose)).map(([n]) => n);
	record(
		area,
		"cabeçalhos de segurança nas labels do Caddy (vsl/compose.yml)",
		pass(!missing.length),
		missing.join(", ") || undefined,
	);
	record(
		area,
		"container só leitura, sem capacidades e sem novos privilégios",
		pass(
			/read_only:\s*true/.test(compose) &&
				/cap_drop:[\s-]*ALL/.test(compose) &&
				/no-new-privileges:true/.test(compose),
		),
	);
	const config = readIf("vsl/next.config.ts");
	record(area, "poweredByHeader: false", pass(/poweredByHeader:\s*false/.test(config)));
	const page = readIf("vsl/src/app/page.tsx");
	record(area, "página fora dos buscadores (robots index: false)", pass(/index:\s*false/.test(page)));
	const docker = readIf("vsl/Dockerfile").replace(/\\\n/g, " ");
	record(area, "imagem roda os testes antes do build", pass(/RUN[^\n]*\btest\b/.test(docker)));
	checkImage(area, "vsl/Dockerfile");
	checkXss(area, ["vsl/src"]);
	checkPublicEnv(area, ["vsl/src"]);
	checkBlankLinks(area, ["vsl/src"]);
}

export function checkSites() {
	checkFrontend();
	checkVsl();
}
