import {
	CircleAlertIcon,
	CircleCheckIcon,
	CircleDashedIcon,
	CircleXIcon,
	LoaderCircleIcon,
	type LucideIcon,
} from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MaintenanceView } from "@/lib/config/types";
import { formatDateTime } from "@/lib/time";

/* Status sempre com ícone + rótulo (nunca só cor). */
const HEALTH: Record<MaintenanceView["health"], { label: string; icon: LucideIcon; color: string }> = {
	atrasada: { color: "var(--status-warning)", icon: CircleAlertIcon, label: "Atrasada" },
	erro: { color: "var(--status-critical)", icon: CircleXIcon, label: "Falhou" },
	nunca: { color: "var(--muted-foreground)", icon: CircleDashedIcon, label: "Ainda não rodou" },
	ok: { color: "var(--status-good)", icon: CircleCheckIcon, label: "Funcionando" },
	rodando: { color: "var(--muted-foreground)", icon: LoaderCircleIcon, label: "Rodando agora" },
};

const nf = new Intl.NumberFormat("pt-BR");

function Status({ spec }: { spec: { label: string; icon: LucideIcon; color: string } }) {
	const Icon = spec.icon;
	return (
		<span className="inline-flex items-center gap-1.5 text-sm font-medium">
			<Icon className="size-4 shrink-0" style={{ color: spec.color }} aria-hidden />
			{spec.label}
		</span>
	);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
			<dt className="text-muted-foreground text-sm">{label}</dt>
			<dd className="text-sm sm:text-right">{children}</dd>
		</div>
	);
}

function proxyStatus(m: MaintenanceView) {
	if (!m.production) {
		return {
			note: "Sem proxy local. Em produção, o nginx/Caddy precisa enviar o X-Real-IP.",
			spec: { color: "var(--muted-foreground)", icon: CircleDashedIcon, label: "Desenvolvimento" },
		};
	}
	if (m.ipSource === "x-real-ip") {
		return {
			note: "Confira se este é o seu IP atual. Se aparecer o IP do servidor, o proxy está enviando o endereço errado.",
			spec: { color: "var(--status-good)", icon: CircleCheckIcon, label: "Proxy configurado" },
		};
	}
	return {
		note: "Configure o proxy como em deploy/nginx.conf ou deploy/Caddyfile. Sem isso, a geolocalização e os limites de acesso ficam imprecisos.",
		spec: { color: "var(--status-warning)", icon: CircleAlertIcon, label: "Proxy sem X-Real-IP" },
	};
}

export function MaintenanceCard({
	maintenance: m,
	timeZone,
}: {
	maintenance: MaintenanceView;
	timeZone: string;
}) {
	const run = m.lastRun;
	const proxy = proxyStatus(m);

	return (
		<GlassCard>
			<CardHeader>
				<CardTitle className="font-semibold">Manutenção e servidor</CardTitle>
				<CardDescription>
					Todo dia, a partir das 03:15 (Brasília), uma limpeza automática apaga o conteúdo enviado e
					recebido da Meta e do GA4 nos eventos com mais de {m.retentionDays} dias. O evento
					continua nos relatórios. Ela também remove sessões de login vencidas e o cache antigo das
					campanhas.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<dl className="flex flex-col gap-3">
					<Row label="Limpeza diária">
						<Status spec={HEALTH[m.health]} />
					</Row>
					{run && (
						<Row label="Última execução">
							<span className="num">
								{formatDateTime(run.finishedAt ?? run.startedAt, timeZone)}
							</span>
							{m.health !== "erro" && m.health !== "rodando" && (
								<span className="text-muted-foreground block text-xs">
									{nf.format(run.rowsPayloads)} eventos limpos ·{" "}
									{nf.format(run.rowsSessions)} sessões removidas
								</span>
							)}
						</Row>
					)}
					{run?.error && (
						<p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
							{run.error.replace(/\.?\s*$/, ".")} O app tenta de novo em 1 hora. Detalhes nos
							logs: <code className="text-xs">docker compose logs app | grep retenção</code>
						</p>
					)}
					{m.health === "atrasada" && (
						<p className="bg-amber/10 text-amber rounded-lg px-3 py-2 text-sm">
							Nenhuma limpeza nas últimas 36 horas. Ela roda dentro do app: confira os logs (
							<code className="text-xs">docker compose logs app | grep retenção</code>).
						</p>
					)}
					<Row label="Próxima execução">
						<span className="num">{formatDateTime(m.nextRunAt, timeZone)}</span>
					</Row>
					<div className="my-1 border-t" />
					<Row label="Seu IP visto pelo servidor">
						<span className="num">{m.ip ?? "não identificado"}</span>
					</Row>
					<Row label="Proxy reverso">
						<Status spec={proxy.spec} />
					</Row>
					<p className="text-muted-foreground text-xs">{proxy.note}</p>
				</dl>
			</CardContent>
		</GlassCard>
	);
}
