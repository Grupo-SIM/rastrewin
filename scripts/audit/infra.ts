/** Infraestrutura versionada: compose de produção, .dockerignore e saúde dos containers. */
import { exists, pass, read, readIf, record } from "./lib";

const AREA = "Infraestrutura";

/** Blocos de serviço de um compose (indentação de 2 espaços sob `services:`). */
function services(compose: string): { name: string; body: string }[] {
	const section = compose.split(/^services:\s*$/m)[1]?.split(/^\S/m)[0] ?? "";
	return [...section.matchAll(/^ {2}([\w-]+):\s*$([\s\S]*?)(?=^ {2}[\w-]+:\s*$|(?![\s\S]))/gm)].map(m => ({
		body: m[2],
		name: m[1],
	}));
}

export function checkInfra() {
	const ignore = readIf(".dockerignore");
	record(
		AREA,
		".dockerignore tira todo .env das imagens",
		pass(/^\*\*\/\.env$/m.test(ignore) && /^\*\*\/\.env\.\*$/m.test(ignore)),
	);

	const composes = ["compose.production.yaml", "vsl/compose.yml"].filter(exists);
	for (const file of composes) {
		for (const svc of services(read(file))) {
			const name = `${file} › ${svc.name}`;
			const hardened = /no-new-privileges:true/.test(svc.body) && /cap_drop:[\s-]*ALL/.test(svc.body);
			record(AREA, `${name}: sem novos privilégios e sem capacidades`, pass(hardened));
			const ports = /^\s{4}ports:/m.test(svc.body);
			record(
				AREA,
				`${name}: nenhuma porta publicada (só o Caddy chega)`,
				pass(!ports),
				ports ? "publicar a porta deixa o X-Forwarded-For forjável nos limites por IP" : undefined,
			);
			const extras = [
				!/read_only:\s*true/.test(svc.body) && "sem read_only",
				!/healthcheck:/.test(svc.body) && "sem healthcheck",
			].filter(Boolean);
			record(
				AREA,
				`${name}: só leitura e com healthcheck`,
				pass(!extras.length, "atencao"),
				extras.join("; ") || undefined,
			);
		}
	}

	const backendSvc = services(readIf("compose.production.yaml")).find(s => s.name === "backend");
	if (backendSvc && /caddy\.import:\s*cloudflare/.test(backendSvc.body))
		record(
			AREA,
			"api.rastrewin.com fora do proxy da Cloudflare (premissa do IP nos limites)",
			"atencao",
			"label caddy.import: cloudflare na API: se for proxy (nuvem laranja) e não só o certificado, o último X-Forwarded-For passa a ser a Cloudflare. A auditoria --producao confere o cabeçalho cf-ray",
		);
}
