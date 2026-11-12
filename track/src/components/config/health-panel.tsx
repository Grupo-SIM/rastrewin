import {
	BotIcon,
	CircleAlertIcon,
	CircleCheckIcon,
	CircleDashedIcon,
	CircleXIcon,
	DatabaseIcon,
	type LucideIcon,
	SendIcon,
	ServerIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { GlassCard } from "@/components/glass-card";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes, formatInt } from "@/lib/dashboard/format";
import type { RelayState } from "@/lib/health/evaluate";
import type { HealthView } from "@/lib/health/queries";
import { formatDateTime } from "@/lib/time";
import { BOT_REASON_LABEL, type BotReason } from "@/lib/tracking/bot-user-agent";
import { RetryRelaysButton } from "./retry-relays-button";

/* Status sempre com ícone + rótulo (nunca só cor). */
interface Spec {
	label: string;
	icon: LucideIcon;
	color: string;
}
const GOOD = (label: string): Spec => ({ color: "var(--status-good)", icon: CircleCheckIcon, label });
const WARN = (label: string): Spec => ({ color: "var(--status-warning)", icon: CircleAlertIcon, label });
const BAD = (label: string): Spec => ({ color: "var(--status-critical)", icon: CircleXIcon, label });
const IDLE = (label: string): Spec => ({ color: "var(--muted-foreground)", icon: CircleDashedIcon, label });

function Status({ spec }: { spec: Spec }) {
	const Icon = spec.icon;
	return (
		<span className="inline-flex items-center gap-1.5 text-sm font-medium">
			<Icon className="size-4 shrink-0" style={{ color: spec.color }} aria-hidden />
			{spec.label}
		</span>
	);
}

function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
			<dt className="text-muted-foreground text-sm">{label}</dt>
			<dd className="text-sm sm:text-right">{children}</dd>
		</div>
	);
}

function Section({
	icon: Icon,
	title,
	description,
	children,
}: {
	icon: LucideIcon;
	title: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<GlassCard>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 font-semibold">
					<Icon className="text-muted-foreground size-4" aria-hidden />
					{title}
				</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>{children}</CardContent>
		</GlassCard>
	);
}

const Note = ({ tone, children }: { tone: "warn" | "bad"; children: ReactNode }) => (
	<p
		className={
			tone === "bad"
				? "bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm"
				: "bg-amber/10 text-amber rounded-lg px-3 py-2 text-sm"
		}
	>
		{children}
	</p>
);

// ---------------------------------------------------------------- resumo

function Summary({ view }: { view: HealthView }) {
	if (!view.issues.length)
		return (
			<div className="bg-card/50 flex items-center gap-3 rounded-xl border px-4 py-3">
				<CircleCheckIcon
					className="size-5 shrink-0"
					style={{ color: "var(--status-good)" }}
					aria-hidden
				/>
				<p className="text-sm">
					<span className="font-medium">Tudo certo.</span>{" "}
					<span className="text-muted-foreground">
						Nenhum problema no banco, na limpeza diária, nos repasses do backend ou nos envios à
						Meta e ao GA4.
					</span>
				</p>
			</div>
		);
	return (
		<div className="bg-amber/10 border-amber/30 flex flex-col gap-2 rounded-xl border px-4 py-3">
			<p className="text-sm font-medium">
				{view.issues.length === 1
					? "1 ponto precisa de atenção"
					: `${view.issues.length} pontos precisam de atenção`}
			</p>
			<ul className="flex flex-col gap-1.5">
				{view.issues.map(i => (
					<li key={i.key} className="flex items-start gap-2 text-sm">
						<CircleAlertIcon
							className="mt-0.5 size-4 shrink-0"
							style={{ color: "var(--status-warning)" }}
							aria-hidden
						/>
						{i.title}
					</li>
				))}
			</ul>
		</div>
	);
}

// ---------------------------------------------------------------- repasses

const RELAY: Record<RelayState, (v: HealthView["relay"]) => Spec> = {
	aguardando: () => IDLE("Aguardando o primeiro sinal"),
	atrasado: () => WARN("Vendas atrasadas na fila"),
	desistiu: () => BAD("Vendas não entregues"),
	ok: () => GOOD("Funcionando"),
	"sem-sinal": v => BAD(`Sem sinal há ${formatInt(v.silenceMinutes ?? 0)} min`),
};

function RelayCard({ relay, timeZone }: { relay: HealthView["relay"]; timeZone: string }) {
	const s = relay.status;
	return (
		<Section
			icon={ServerIcon}
			title="Repasses de venda do backend"
			description="Cada venda do SimIntPay chega ao backend, que a repassa para cá. Se o painel estiver fora do ar, o backend guarda a venda e tenta de novo por até 3 dias. Ele manda um sinal por minuto com a situação da fila."
		>
			<dl className="flex flex-col gap-3">
				<Row label="Situação">
					<Status spec={RELAY[relay.state](relay)} />
				</Row>
				{relay.receivedAt && (
					<Row label="Último sinal">
						<span className="num">{formatDateTime(relay.receivedAt, timeZone)}</span>
					</Row>
				)}
				{s && (
					<Row label="Vendas na fila">
						<span className="num">{formatInt(s.pending)}</span>
						{s.oldestPendingAt && (
							<span className="text-muted-foreground block text-xs">
								a mais antiga desde{" "}
								<span className="num">{formatDateTime(s.oldestPendingAt, timeZone)}</span>
							</span>
						)}
					</Row>
				)}
				{s && s.failed > 0 && (
					<Row label="Desistiu de reenviar">
						<span className="num">{formatInt(s.failed)}</span>
					</Row>
				)}
				{relay.state === "aguardando" && (
					<p className="text-muted-foreground text-xs">
						O painel guarda o sinal em memória: logo depois de reiniciar, ele leva até 1 minuto
						para chegar. Se continuar assim, confira se o backend está atualizado e com{" "}
						<code className="text-xs">TRACK_WEBHOOK_URL</code> e{" "}
						<code className="text-xs">TRACK_WEBHOOK_SECRET</code> configurados.
					</p>
				)}
				{relay.state === "sem-sinal" && (
					<Note tone="bad">
						O backend parou de mandar sinal. Ou ele está fora do ar, ou não consegue falar com o
						painel. Vendas novas podem não estar chegando: confira o backend no Komodo.
					</Note>
				)}
				{relay.state === "atrasado" && s?.lastError && (
					<Note tone="warn">
						Último erro do backend ao repassar: <span className="num">{s.lastError}</span>. Ele
						continua tentando sozinho.
					</Note>
				)}
				{s && s.failed > 0 && (
					<>
						<Note tone="bad">
							O backend desistiu destas vendas (erro definitivo ou 3 dias de tentativas).
							Corrija a causa e toque em “Tentar de novo”: ele recoloca todas na fila.
						</Note>
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="text-muted-foreground border-b text-left text-xs">
										<th scope="col" className="py-2 pr-3 font-medium">
											Evento
										</th>
										<th scope="col" className="py-2 pr-3 font-medium">
											Desde
										</th>
										<th scope="col" className="py-2 pr-3 text-right font-medium">
											Tentativas
										</th>
										<th scope="col" className="py-2 font-medium">
											Erro
										</th>
									</tr>
								</thead>
								<tbody>
									{s.failedSample.map(f => (
										<tr key={f.eventId} className="border-b last:border-0">
											<td
												className="num max-w-40 truncate py-1.5 pr-3 text-xs"
												title={f.eventId}
											>
												{f.eventId}
											</td>
											<td className="num py-1.5 pr-3 text-xs whitespace-nowrap">
												{formatDateTime(f.createdAt, timeZone)}
											</td>
											<td className="num py-1.5 pr-3 text-right">
												{formatInt(f.attempts)}
											</td>
											<td className="text-muted-foreground py-1.5 text-xs">
												{f.lastError ?? "—"}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<div className="flex flex-wrap items-center gap-3">
							<RetryRelaysButton />
							{relay.retry && (
								<span className="text-muted-foreground text-xs">
									{relay.retry.deliveredAt
										? `O backend recebeu o pedido às ${formatDateTime(relay.retry.deliveredAt, timeZone)}.`
										: `Pedido feito às ${formatDateTime(relay.retry.requestedAt, timeZone)}; vai no próximo sinal.`}
								</span>
							)}
						</div>
					</>
				)}
			</dl>
		</Section>
	);
}

// ---------------------------------------------------------------- envios Meta/GA4

function DeliveriesCard({ d, timeZone }: { d: HealthView["deliveries"]; timeZone: string }) {
	return (
		<Section
			icon={SendIcon}
			title="Envio das vendas à Meta e ao GA4"
			description="Cada venda nova vai para todos os pixels e propriedades ativos. Se falhar, o painel tenta de novo a cada 5 minutos, até 5 vezes, por até 7 dias."
		>
			<dl className="flex flex-col gap-3">
				<Row label="Últimos 7 dias">
					<Status
						spec={
							d.total
								? BAD(
										`${formatInt(d.total)} ${d.total === 1 ? "venda não chegou" : "vendas não chegaram"}`,
									)
								: GOOD("Todas chegaram")
						}
					/>
				</Row>
				{d.total > 0 && (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="text-muted-foreground border-b text-left text-xs">
									<th scope="col" className="py-2 pr-3 font-medium">
										Pedido
									</th>
									<th scope="col" className="py-2 pr-3 font-medium">
										Data
									</th>
									<th scope="col" className="py-2 pr-3 font-medium">
										Faltou
									</th>
									<th scope="col" className="py-2 font-medium">
										Erro
									</th>
								</tr>
							</thead>
							<tbody>
								{d.sample.map(f => (
									<tr key={f.transactionId} className="border-b last:border-0">
										<td className="py-1.5 pr-3 text-xs">
											<Link
												href={`/painel/faturamento?periodo=max&q=${encodeURIComponent(f.transactionId)}`}
												className="num hover:text-primary underline-offset-4 hover:underline"
											>
												{f.transactionId}
											</Link>
										</td>
										<td className="num py-1.5 pr-3 text-xs whitespace-nowrap">
											{formatDateTime(f.occurredAt, timeZone)}
										</td>
										<td className="py-1.5 pr-3 text-xs">{f.destinations.join(" e ")}</td>
										<td className="text-muted-foreground py-1.5 text-xs">
											{f.error ?? "—"}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</dl>
		</Section>
	);
}

// ---------------------------------------------------------------- banco

function DbCard({
	db,
	maintenance,
	timeZone,
}: Pick<HealthView, "db" | "maintenance"> & { timeZone: string }) {
	const pct = Math.min(100, (db.bytes / db.limitBytes) * 100);
	const over = db.bytes >= db.limitBytes;
	const cleanup: Spec =
		maintenance.health === "ok"
			? GOOD("Funcionando")
			: maintenance.health === "erro"
				? BAD("Falhou")
				: maintenance.health === "atrasada"
					? WARN("Atrasada")
					: maintenance.health === "rodando"
						? IDLE("Rodando agora")
						: IDLE("Ainda não rodou");
	const years = db.daysToLimit !== null && db.daysToLimit > 3650;
	return (
		<Section
			icon={DatabaseIcon}
			title="Banco de dados"
			description="Tamanho do banco do painel e quanto ele cresce. O aviso aparece ao passar de 5 GB."
		>
			<dl className="flex flex-col gap-3">
				<div className="flex flex-col gap-2">
					<p className="text-sm">
						<span className="num text-2xl font-semibold">{formatBytes(db.bytes)}</span>{" "}
						<span className="text-muted-foreground">de {formatBytes(db.limitBytes)}</span>
					</p>
					<div
						role="meter"
						aria-label="Uso do limite do banco"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={Math.round(pct)}
						className="bg-muted h-2 overflow-hidden rounded-full"
					>
						<div
							className="h-full rounded-full"
							style={{
								background: over
									? "var(--status-critical)"
									: pct >= 80
										? "var(--status-warning)"
										: "var(--status-good)",
								width: `${Math.max(pct, 1)}%`,
							}}
						/>
					</div>
				</div>
				<Row label="Crescimento estimado">
					<span className="num">{formatBytes(db.perDay)}</span> por dia
					<span className="text-muted-foreground block text-xs">
						≈ <span className="num">{formatBytes(db.perDay * 30)}</span> por mês, pelo ritmo dos
						últimos 7 dias
					</span>
				</Row>
				{db.daysToLimit !== null && !over && (
					<Row label="Chega a 5 GB em">
						{years ? (
							"mais de 10 anos"
						) : (
							<span className="num">~{formatInt(db.daysToLimit)} dias</span>
						)}
					</Row>
				)}
				<Row label="Limpeza diária">
					<Status spec={cleanup} />
					{maintenance.startedAt && (
						<span className="text-muted-foreground block text-xs">
							última em{" "}
							<span className="num">{formatDateTime(maintenance.startedAt, timeZone)}</span>
						</span>
					)}
				</Row>
				{maintenance.error && <Note tone="bad">{maintenance.error}</Note>}
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="text-muted-foreground border-b text-left text-xs">
								<th scope="col" className="py-2 pr-3 font-medium">
									Tabela
								</th>
								<th scope="col" className="py-2 pr-3 text-right font-medium">
									Linhas
								</th>
								<th scope="col" className="py-2 text-right font-medium">
									Tamanho
								</th>
							</tr>
						</thead>
						<tbody>
							{db.tables.slice(0, 8).map(t => (
								<tr key={t.name} className="border-b last:border-0">
									<td className="py-1.5 pr-3">{t.label}</td>
									<td className="num py-1.5 pr-3 text-right">{formatInt(t.rows)}</td>
									<td className="num py-1.5 text-right">{formatBytes(t.bytes)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<p className="text-muted-foreground text-xs">
					O crescimento é uma estimativa: a limpeza diária esvazia o conteúdo técnico dos eventos
					com mais de 14 dias, então a tendência real é menor. O painel não enxerga o espaço livre
					no disco da VPS, que é compartilhado com outros bancos.
				</p>
			</dl>
		</Section>
	);
}

// ---------------------------------------------------------------- robôs

function BotsCard({ bots, timeZone }: { bots: HealthView["bots"]; timeZone: string }) {
	const entries = (Object.entries(bots.counts) as [BotReason, number][])
		.filter(([, n]) => n > 0)
		.sort((a, b) => b[1] - a[1]);
	return (
		<Section
			icon={BotIcon}
			title="Visitas de robôs ignoradas"
			description="Visitas que não viram visitante, evento nem envio à Meta/GA4. A contagem recomeça quando o painel reinicia."
		>
			<dl className="flex flex-col gap-3">
				<Row label={`Desde ${formatDateTime(bots.since, timeZone)}`}>
					<span className="num font-medium">{formatInt(bots.total)}</span>{" "}
					{bots.total === 1 ? "visita" : "visitas"}
				</Row>
				{entries.length > 0 && (
					<ul className="flex flex-col gap-1.5 border-t pt-3">
						{entries.map(([reason, n]) => (
							<li key={reason} className="flex items-baseline justify-between gap-4 text-sm">
								<span className="text-muted-foreground">{BOT_REASON_LABEL[reason]}</span>
								<span className="num">{formatInt(n)}</span>
							</li>
						))}
					</ul>
				)}
			</dl>
		</Section>
	);
}

export function HealthPanel({ view, timeZone }: { view: HealthView; timeZone: string }) {
	return (
		<div className="flex flex-col gap-5">
			<Summary view={view} />
			<div className="grid items-start gap-5 lg:grid-cols-2">
				<div className="flex flex-col gap-5">
					<RelayCard relay={view.relay} timeZone={timeZone} />
					<DeliveriesCard d={view.deliveries} timeZone={timeZone} />
				</div>
				<div className="flex flex-col gap-5">
					<DbCard db={view.db} maintenance={view.maintenance} timeZone={timeZone} />
					<BotsCard bots={view.bots} timeZone={timeZone} />
				</div>
			</div>
		</div>
	);
}
