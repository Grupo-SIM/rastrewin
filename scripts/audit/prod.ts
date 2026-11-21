/**
 * Produção vista de fora, SÓ LEITURA: GET/HEAD/OPTIONS sem login, sem cookie, sem enviar evento e sem gravar
 * nada (req() recusa outros métodos). O track é conferido pelo script dele (track.ts) — aqui só o certificado.
 */
import { resolveTxt } from "node:dns/promises";
import { connect } from "node:tls";
import { type Level, pass, record, req } from "./lib";

const SITE = "rastrewin.com";
const API = "api.rastrewin.com";
const VSL = "vsl.rastrewin.com";
const TRACK = "track.rastrewin.com";

async function run(area: string, name: string, fn: () => Promise<[Level, string?]>) {
	try {
		const [level, detail] = await fn();
		record(area, name, level, detail);
	} catch (error) {
		record(area, name, "falha", `erro: ${error instanceof Error ? error.message : String(error)}`);
	}
}

function certificate(host: string): Promise<{ days: number; protocol: string }> {
	return new Promise((resolve, reject) => {
		const socket = connect({ host, port: 443, servername: host, timeout: 15_000 }, () => {
			const cert = socket.getPeerCertificate();
			const days = Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86_400_000);
			resolve({ days, protocol: socket.getProtocol() ?? "?" });
			socket.end();
		});
		socket.on("error", reject);
		socket.on("timeout", () => socket.destroy(new Error("tempo esgotado")));
	});
}

async function checkHost(host: string, home: string) {
	const area = `Produção (${host})`;
	await run(area, "certificado TLS válido por mais de 21 dias", async () => {
		const { days, protocol } = await certificate(host);
		return [days > 21 ? "ok" : days > 0 ? "atencao" : "falha", `${days} dias · ${protocol}`];
	});
	if (host === TRACK) return;
	await run(area, "http:// redireciona para https://", async () => {
		const res = await req(`http://${host}/`);
		const to = res.headers.get("location") ?? "";
		return [
			pass([301, 302, 307, 308].includes(res.status) && to.startsWith(`https://${host}`)),
			`${res.status} → ${to || "—"}`,
		];
	});
	await run(area, `GET ${home}: cabeçalhos de segurança`, async () => {
		const res = await req(`https://${host}${home}`);
		const h = res.headers;
		const csp = h.get("content-security-policy") ?? "";
		const hsts = Number(h.get("strict-transport-security")?.match(/max-age=(\d+)/)?.[1] ?? 0);
		const missing = [
			hsts < 15_552_000 && "HSTS (≥ 180 dias)",
			h.get("x-content-type-options") !== "nosniff" && "nosniff",
			!/frame-ancestors 'none'/.test(csp) &&
				h.get("x-frame-options") !== "DENY" &&
				"proteção contra embutir (frame)",
			!csp && "CSP",
		].filter(Boolean);
		return [
			pass(!missing.length),
			missing.length ? `${res.status}; falta: ${missing.join(", ")}` : `${res.status}`,
		];
	});
	await run(area, "não expõe tecnologia/versão do servidor", async () => {
		const res = await req(`https://${host}${home}`, { method: "HEAD" });
		const powered = res.headers.get("x-powered-by");
		const server = res.headers.get("server") ?? "";
		const versioned = /\d/.test(server);
		return [
			pass(!powered && !versioned, "atencao"),
			[powered && `X-Powered-By: ${powered}`, server && `Server: ${server}`]
				.filter(Boolean)
				.join("; ") || undefined,
		];
	});
	const probes: [string, RegExp][] = [
		["/.env", /^[A-Z_]+=/m],
		["/.git/config", /\[core\]/],
		["/.git/HEAD", /^ref: /],
		["/package.json", /"dependencies"/],
		["/Dockerfile", /^FROM /m],
	];
	await run(area, "arquivos internos não são servidos", async () => {
		const served: string[] = [];
		for (const [probe, signature] of probes) {
			const res = await req(`https://${host}${probe}`);
			const body = res.status === 200 ? await res.text() : "";
			if (signature.test(body)) served.push(`${probe} (${res.status})`);
		}
		return [pass(!served.length), served.join(", ") || probes.map(([p]) => p).join(" ")];
	});
}

async function checkApi() {
	const area = `Produção (${API})`;
	for (const route of ["/users/me", "/raffles", "/raffles/summary", "/admin/users", "/admin/raffles"])
		await run(area, `GET ${route} sem token → 401`, async () => {
			const res = await req(`https://${API}${route}`);
			return [pass(res.status === 401), `${res.status}`];
		});
	await run(area, "CORS não libera origem desconhecida", async () => {
		const res = await req(`https://${API}/users/me`, {
			headers: { "access-control-request-method": "GET", origin: "https://auditoria.invalid" },
			method: "OPTIONS",
		});
		const allowed = res.headers.get("access-control-allow-origin");
		return [
			pass(allowed !== "*" && allowed !== "https://auditoria.invalid"),
			`${res.status}; allow-origin: ${allowed ?? "—"}`,
		];
	});
	await run(area, "erro 404 sem detalhes internos (stack, caminho de arquivo)", async () => {
		const res = await req(`https://${API}/rota-inexistente-auditoria`);
		const body = await res.text();
		return [
			pass(res.status === 404 && !/\bat \w|node_modules|\/app\/|Error:/.test(body)),
			`${res.status}`,
		];
	});
	await run(area, "GET /payments/webhook não existe (só POST assinado)", async () => {
		const res = await req(`https://${API}/payments/webhook`);
		return [pass([404, 405].includes(res.status)), `${res.status}`];
	});
	await run(area, "API não está atrás do proxy da Cloudflare (premissa do IP nos limites)", async () => {
		const res = await req(`https://${API}/raffles`);
		const cf = res.headers.get("cf-ray") || /cloudflare/i.test(res.headers.get("server") ?? "");
		return [
			pass(!cf),
			cf
				? "cf-ray presente: o último X-Forwarded-For vira a Cloudflare (backend/src/http/client-ip.ts)"
				: "sem cf-ray",
		];
	});
}

async function checkSitesContent() {
	await run(`Produção (${SITE})`, "landing carrega o t.js do track", async () => {
		const html = await (await req(`https://${SITE}/`)).text();
		return [pass(html.includes(`${TRACK}/t.js`)), undefined];
	});
	await run(`Produção (${SITE})`, "páginas legais no ar (/privacidade, /termos)", async () => {
		const codes = await Promise.all(
			["/privacidade", "/termos"].map(async p => (await req(`https://${SITE}${p}`)).status),
		);
		return [pass(codes.every(c => c === 200)), codes.join(", ")];
	});
	await run(`Produção (${VSL})`, "VSL fora dos buscadores (noindex)", async () => {
		const res = await req(`https://${VSL}/`);
		const header = /noindex/.test(res.headers.get("x-robots-tag") ?? "");
		const meta = /<meta name="robots" content="[^"]*noindex/.test(await res.text());
		return [
			pass(header || meta),
			header
				? "cabeçalho X-Robots-Tag"
				: meta
					? "só pela meta tag (o X-Robots-Tag do vsl/compose.yml não chega)"
					: "sem noindex",
		];
	});
	await run(`Produção (${VSL})`, "VSL carrega o t.js do track", async () => {
		const html = await (await req(`https://${VSL}/`)).text();
		return [pass(html.includes(`${TRACK}/t.js`)), undefined];
	});
}

async function checkEmailDns() {
	const area = `Produção (DNS de ${SITE})`;
	const txt = async (name: string) =>
		(await resolveTxt(name).catch(() => [] as string[][])).map(r => r.join(""));
	await run(area, "SPF publicado", async () => {
		const spf = (await txt(SITE)).find(r => r.startsWith("v=spf1"));
		return [pass(!!spf, "atencao"), spf ?? "sem registro v=spf1 (vale se o e-mail sai por este domínio)"];
	});
	await run(area, "DMARC publicado", async () => {
		const dmarc = (await txt(`_dmarc.${SITE}`)).find(r => r.startsWith("v=DMARC1"));
		return [pass(!!dmarc, "atencao"), dmarc ?? "sem _dmarc (vale se o e-mail sai por este domínio)"];
	});
}

export async function checkProduction() {
	await checkHost(SITE, "/");
	await checkHost(API, "/raffles");
	await checkHost(VSL, "/");
	await checkHost(TRACK, "/");
	await checkApi();
	await checkSitesContent();
	await checkEmailDns();
}
