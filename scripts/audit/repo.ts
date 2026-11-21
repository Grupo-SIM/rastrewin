/** Repositório: segredos versionados, lockfile, versões de ferramentas e CI. */
import { execFileSync } from "node:child_process";
import { exists, git, pass, read, record, ROOT, trackedFiles, WORKSPACES } from "./lib";

const AREA = "Repositório e CI";

/** Padrões de segredo real (não batem no próprio texto deste arquivo). */
const SECRET_PATTERNS =
	"EAA[A-Za-z0-9]{40,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}";

function checkTrackedSecrets(files: string[]) {
	const envFiles = files.filter(f => /(^|\/)\.env(\.[\w-]+)?$/.test(f) && !f.endsWith(".env.example"));
	record(AREA, "nenhum .env versionado", pass(!envFiles.length), envFiles.join(", ") || undefined);
	const keys = files.filter(f => /\.(pem|key|p12|pfx|keystore)$|(^|\/)id_(rsa|ed25519)$/.test(f));
	record(AREA, "nenhuma chave/certificado versionado", pass(!keys.length), keys.join(", ") || undefined);

	let commits: string[] = [];
	try {
		commits = git([
			"log",
			"--all",
			"-E",
			`-G${SECRET_PATTERNS}`,
			"--format=%h %s",
			"--",
			".",
			":(exclude)bun.lock",
			":(exclude)**/*.lock",
		])
			.split("\n")
			.filter(Boolean);
	} catch {
		record(AREA, "histórico do git não pôde ser lido", "atencao");
		return;
	}
	record(
		AREA,
		"histórico do git (repositório inteiro) sem token Meta/GitHub/Anthropic/AWS ou chave privada",
		pass(!commits.length),
		commits.length ? `commits com padrão de segredo: ${commits.slice(0, 5).join(" | ")}` : undefined,
	);
}

function checkLockfiles(files: string[]) {
	const foreign = files.filter(f => /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(f));
	record(
		AREA,
		"só bun.lock como lockfile",
		pass(!foreign.length && files.includes("bun.lock")),
		foreign.join(", ") || undefined,
	);
}

function checkGitignore() {
	const samples = [".env", "backend/.env.local", "backend/.env.production", "frontend/.env.development"];
	const notIgnored = samples.filter(p => {
		try {
			execFileSync("git", ["check-ignore", "-q", "--no-index", p], { cwd: ROOT });
			return false;
		} catch {
			return true;
		}
	});
	record(
		AREA,
		".gitignore cobre todas as variações de .env",
		pass(!notIgnored.length, "atencao"),
		notIgnored.length ? `não ignorados: ${notIgnored.join(", ")}` : undefined,
	);
}

function checkWorkingTree() {
	const lines = git(["status", "--porcelain"]).split("\n").filter(Boolean);
	const untracked = lines.filter(l => l.startsWith("??")).map(l => l.slice(3));
	const changed = lines.filter(l => !l.startsWith("??")).map(l => l.slice(3));
	record(
		AREA,
		"árvore de trabalho limpa",
		pass(!lines.length, "atencao"),
		[
			changed.length && `alterados: ${changed.join(", ")}`,
			untracked.length && `não versionados: ${untracked.join(", ")}`,
		]
			.filter(Boolean)
			.join("; ") || undefined,
	);
}

const dockerfiles = () => WORKSPACES.map(ws => `${ws}/Dockerfile`).filter(exists);

function checkToolVersions() {
	const bun = (JSON.parse(read("package.json")).packageManager ?? "").replace("bun@", "");
	const wrong = dockerfiles().filter(file => {
		const tags = [...read(file).matchAll(/FROM\s+(?:--platform=\S+\s+)?oven\/bun:([\w.-]+)/g)].map(
			m => m[1],
		);
		return tags.some(tag => !tag.startsWith(`${bun}`));
	});
	const ciOk = [".github/workflows/ci.yml", ".github/workflows/cd.yml"]
		.filter(exists)
		.every(file => !/setup-bun/.test(read(file)) || /bun-version-file:\s*package\.json/.test(read(file)));
	record(
		AREA,
		`Bun ${bun} igual no package.json, nos Dockerfiles e no CI`,
		pass(!wrong.length && ciOk),
		[
			wrong.length && `Dockerfiles com outra versão: ${wrong.join(", ")}`,
			!ciOk && "CI sem bun-version-file",
		]
			.filter(Boolean)
			.join("; ") || undefined,
	);

	const node = dockerfiles().map(file => {
		const code = read(file);
		const arg = code.match(/ARG\s+NODE_VERSION=(\S+)/)?.[1];
		const tags = [...code.matchAll(/FROM\s+(?:--platform=\S+\s+)?node:(\S+)/g)].map(m =>
			m[1].replace("${NODE_VERSION}", arg ?? "?"),
		);
		return { file, majors: [...new Set(tags.map(t => t.split(/[.-]/)[0]))], tags: [...new Set(tags)] };
	});
	const majors = new Set(node.flatMap(n => n.majors));
	record(
		AREA,
		"mesma versão principal do Node em todas as imagens",
		pass(majors.size <= 1, "atencao"),
		node.map(n => `${n.file.split("/")[0]}: node:${n.tags.join(", ")}`).join("; "),
	);
	const loose = node.filter(n => n.tags.some(t => !/^\d+\.\d+\.\d+/.test(t)));
	record(
		AREA,
		"imagens do Node fixadas na versão exata (x.y.z)",
		pass(!loose.length, "atencao"),
		loose.length ? `tag solta em: ${loose.map(n => n.file).join(", ")}` : undefined,
	);
}

function checkWorkflows(files: string[]) {
	const workflows = files.filter(f => /^\.github\/workflows\/.+\.ya?ml$/.test(f));
	for (const file of workflows) {
		const code = read(file);
		const unpinned = [...code.matchAll(/uses:\s*([^\s#]+)@([^\s#]+)/g)]
			.filter(m => !/^[0-9a-f]{40}$/.test(m[2]))
			.map(m => `${m[1]}@${m[2]}`);
		record(
			AREA,
			`${file}: actions fixadas por SHA`,
			pass(!unpinned.length),
			unpinned.join(", ") || undefined,
		);
		record(
			AREA,
			`${file}: bloco permissions (token com o mínimo)`,
			pass(/^permissions:/m.test(code), "atencao"),
			/^permissions:/m.test(code)
				? undefined
				: "sem permissions no topo: o GITHUB_TOKEN usa o padrão da organização",
		);
	}
}

function checkAgentHooks() {
	const script = "scripts/agent-hooks/block-generated-edits.ts";
	const configs = [".claude/settings.json", ".codex/hooks.json"];
	const missing = configs.filter(c => !exists(c) || !read(c).includes(script));
	record(
		AREA,
		"hooks do Claude Code e do Codex apontam para o mesmo script",
		pass(!missing.length && exists(script), "atencao"),
		missing.length ? `sem ${script}: ${missing.join(", ")}` : undefined,
	);
}

export function checkRepo() {
	const files = trackedFiles();
	checkTrackedSecrets(files);
	checkLockfiles(files);
	checkGitignore();
	checkWorkingTree();
	checkToolVersions();
	checkWorkflows(files);
	checkAgentHooks();
}
