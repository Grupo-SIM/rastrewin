/** Track: roda o verificador próprio (track/scripts/security-check.ts) e traz o resultado para cá. */
import { spawnSync } from "node:child_process";
import { type Level, record, ROOT } from "./lib";

const LEVELS: Record<string, Level> = { "! ATENÇÃO": "atencao", "✓ OK": "ok", "✗ FALHA": "falha" };

export function checkTrack(production: boolean) {
	const args = ["run", "--cwd", "track", "security:check"];
	if (production) args.push("--", "--url", "https://track.rastrewin.com");
	const run = spawnSync("bun", args, {
		cwd: ROOT,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
		timeout: 300_000,
	});
	const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
	let area = "Track";
	let parsed = 0;
	for (const line of output.split("\n")) {
		const item = line.match(/^ {2}(✓ OK|! ATENÇÃO|✗ FALHA)\s+(.*?)(?:\s{2}— (.*))?$/);
		if (item) {
			// Só ATENÇÃO e FALHA viram linhas; os OK entram no resumo para não afogar o relatório.
			if (LEVELS[item[1]] !== "ok") record(area, item[2], LEVELS[item[1]], item[3]);
			parsed++;
		} else if (line && !line.startsWith(" ") && !/^\d+ OK ·|^Dica:|^\$|^✗ erro/.test(line))
			area = `Track › ${line.trim()}`;
	}
	const summary = output.match(/(\d+) OK · (\d+) ATENÇÃO · (\d+) FALHA/);
	record(
		"Track",
		`security:check do track${production ? " (com https://track.rastrewin.com, só leitura)" : ""}`,
		!summary || !parsed ? "falha" : run.status === 0 ? (Number(summary[2]) ? "atencao" : "ok") : "falha",
		summary ? summary[0] : `não rodou: ${output.trim().split("\n").slice(-3).join(" | ")}`,
	);
}
