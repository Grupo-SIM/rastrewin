import { ClockIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/button";
import { type DeliveryAlerts as Alerts, getDeliveryAlerts } from "@/lib/dashboard/delivery-alerts";
import { formatInt, formatMoney } from "@/lib/dashboard/format";
import { localDate } from "@/lib/dashboard/period";
import { safeErrorMessage } from "@/lib/errors";
import { whenText } from "@/lib/sales/delivery-state";

const plural = (n: number, one: string, many: string) => `${formatInt(n)} ${n === 1 ? one : many}`;
const TO = { ga4: "ao GA4", meta: "à Meta" } as const;
const toAll = (d: ("meta" | "ga4")[]) => d.map(x => TO[x]).join(" e ");

/** "07:46" no mesmo dia; "27/11 às 07:46" em outro dia (fuso do painel). */
function sinceText(iso: string, timeZone: string): string {
	const at = new Date(iso);
	const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone });
	const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone });
	return day.format(at) === day.format(new Date())
		? time.format(at)
		: `${day.format(at)} às ${time.format(at)}`;
}

function shortDateTime(iso: string, timeZone: string): string {
	return new Intl.DateTimeFormat("pt-BR", {
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		month: "2-digit",
		timeZone,
	})
		.format(new Date(iso))
		.replace(",", "");
}

function MetaOutageAlert({
	meta,
	admin,
	timeZone,
}: {
	meta: NonNullable<Alerts["meta"]>;
	admin: boolean;
	timeZone: string;
}) {
	const sales = meta.affectedSales
		? `${plural(meta.affectedSales, "venda", "vendas")} esperando reenvio`
		: "nenhuma venda afetada";
	return (
		<div
			role="alert"
			className="border-destructive/40 bg-destructive/10 mb-3 flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 text-sm"
		>
			<TriangleAlertIcon className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
			<div className="min-w-[14rem] flex-1">
				<p className="font-semibold">
					A Meta está recusando os envios do servidor desde {sinceText(meta.since, timeZone)}
				</p>
				<p className="text-destructive">
					{meta.pixel ? `${meta.pixel}: ` : ""}
					{meta.reason}.
				</p>
				<p className="text-muted-foreground">
					{plural(meta.rejected, "evento recusado", "eventos recusados")} até agora · {sales}.{" "}
					{admin
						? "O pixel no navegador continua funcionando para quem aceitou cookies."
						: "Avise um Administrador."}
				</p>
			</div>
			{admin && (
				<Button asChild size="sm" className="h-10">
					<Link href="/painel/config?aba=pixel">Abrir Configurações</Link>
				</Button>
			)}
		</div>
	);
}

function PendingSalesAlert({ sales, timeZone }: { sales: NonNullable<Alerts["sales"]>; timeZone: string }) {
	const s = sales.latest;
	const title =
		sales.count === 1
			? `1 venda ainda não chegou ${toAll(sales.destinations)}`
			: `${plural(sales.count, "venda", "vendas")} ainda não chegaram ${toAll(sales.destinations)}`;
	const detail = `Pedido ${s.transactionId} · ${formatMoney(s.value, s.currency)} · ${shortDateTime(s.occurredAt, timeZone)} · ${plural(s.attempts, "tentativa", "tentativas")} · próxima ${whenText(s.nextAt, new Date(), timeZone)}, automática.`;
	// Intervalo exato (do dia da venda mais antiga até hoje): os "Últimos N dias" não incluem hoje.
	const range = `periodo=custom&de=${localDate(new Date(sales.oldestAt), timeZone)}&ate=${localDate(new Date(), timeZone)}`;
	const href =
		sales.count === 1
			? `/painel/faturamento?${range}&q=${encodeURIComponent(s.transactionId)}`
			: `/painel/faturamento?${range}`;
	return (
		<div className="border-amber/30 bg-amber/10 mb-3 flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 text-sm">
			<ClockIcon className="text-amber mt-0.5 size-4 shrink-0" aria-hidden />
			<div className="min-w-[14rem] flex-1">
				<p className="font-semibold">{title}</p>
				<p className="text-muted-foreground">
					{sales.count > 1 && "A mais recente: "}
					{detail}
				</p>
			</div>
			<Button asChild variant="outline" size="sm" className="h-10">
				<Link href={href}>Ver em Faturamento</Link>
			</Button>
		</div>
	);
}

/**
 * Avisos de envio no topo do painel, para Administrador e Colaborador (plano: aviso quando a Meta
 * recusa e venda ainda sem envio). Nunca derruba a página: sem os dados, simplesmente não aparece.
 */
export async function DeliveryAlerts() {
	let alerts: Alerts;
	try {
		alerts = await getDeliveryAlerts();
	} catch (err) {
		unstable_rethrow(err);
		console.error("[envios] aviso do painel falhou", safeErrorMessage(err));
		return null;
	}
	if (!alerts.meta && !alerts.sales) return null;
	return (
		<div className="mb-2">
			{alerts.meta && (
				<MetaOutageAlert meta={alerts.meta} admin={alerts.admin} timeZone={alerts.timeZone} />
			)}
			{alerts.sales && <PendingSalesAlert sales={alerts.sales} timeZone={alerts.timeZone} />}
		</div>
	);
}
