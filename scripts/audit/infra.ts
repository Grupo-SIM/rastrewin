/** Infraestrutura versionada: compose de produção, .dockerignore e saúde dos containers. */
import { exists, pass, read, readIf, record } from "./lib";

const AREA = "Infraestrutura";

/** Dockerfile da imagem de cada serviço: o HEALTHCHECK pode estar nela, e não no compose. */
const DOCKERFILE: Record<string, string> = {
	backend: "backend/Dockerfile",
	frontend: "frontend/Dockerfile",
	"vsl-rastrewin": "vsl/Dockerfile",
};

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
				!/healthcheck:/.test(svc.body) &&
					!/^HEALTHCHECK/m.test(readIf(DOCKERFILE[svc.name] ?? "")) &&
					"sem healthcheck",
			].filter(Boolean);
			record(
				AREA,
				`${name}: só leitura e com healthcheck`,
				pass(!extras.length, "atencao"),
				extras.join("; ") || undefined,
			);
		}
	}
}
