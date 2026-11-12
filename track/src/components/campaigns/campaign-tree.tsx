"use client";

import {
	ArchiveIcon,
	ChevronRightIcon,
	CircleAlertIcon,
	CircleCheckIcon,
	CircleDashedIcon,
	CirclePauseIcon,
	CircleXIcon,
	ClockIcon,
	FlagIcon,
	InfoIcon,
} from "lucide-react";
import { Fragment, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cpa, ctr, type Metrics, roas } from "@/lib/campaigns/build";
import type { NodeStatus, StatusKey, StatusTone, StructuredNode } from "@/lib/campaigns/structure";
import { formatInt, formatMoney, formatPct } from "@/lib/dashboard/format";
import { cn } from "@/lib/utils";

const COLUMNS: { key: string; label: string; info: string }[] = [
	{ info: "Valor investido segundo a Meta no período.", key: "spend", label: "Gasto" },
	{ info: "Vezes que os anúncios apareceram.", key: "impressions", label: "Impressões" },
	{ info: "Cliques nos anúncios (todos).", key: "clicks", label: "Cliques" },
	{ info: "Cliques ÷ impressões.", key: "ctr", label: "CTR" },
	{
		info: "Vendas aprovadas do período ligadas a este item pelas UTMs (ID do anúncio, conjunto ou campanha).",
		key: "purchases",
		label: "Vendas",
	},
	{ info: "Valor bruto das vendas ligadas pelas UTMs.", key: "revenue", label: "Receita" },
	{ info: "Receita ÷ gasto. Acima de 1, a receita superou o gasto.", key: "roas", label: "ROAS" },
	{ info: "Gasto ÷ vendas ligadas.", key: "cpa", label: "CPA" },
	{
		info: "Compras que a própria Meta atribui (configuração de atribuição da conta), para comparar.",
		key: "meta",
		label: "Compras (Meta)",
	},
];

const LEVEL = { ad: "Anúncio", adset: "Conjunto", campaign: "Campanha" } as const;

/** Chave do grupo no estado de abertos (ids da Meta são só números: não colide). */
const ARCHIVED_GROUP = "arquivadas";

function ArchivedTitle({ count }: { count: number }) {
	return (
		<span className="min-w-0">
			<span className="flex items-center gap-1.5 font-semibold">
				<ArchiveIcon className="text-muted-foreground size-3.5" aria-hidden />
				Arquivadas ou excluídas{" "}
				<span className="num text-muted-foreground font-normal">({count})</span>
			</span>
			<span className="text-muted-foreground block text-xs">
				Encerradas na Meta; o gasto delas continua no total.
			</span>
		</span>
	);
}

/* Situação SEMPRE com ícone + rótulo (nunca só cor); cores de status reservadas. */
const STATUS_ICON: Record<StatusKey, typeof CircleCheckIcon> = {
	analise: ClockIcon,
	arquivada: ArchiveIcon,
	ativa: CircleCheckIcon,
	concluida: FlagIcon,
	outra: CircleDashedIcon,
	pagamento: CircleAlertIcon,
	pausada: CirclePauseIcon,
	problema: CircleAlertIcon,
	reprovada: CircleXIcon,
};
const TONE_COLOR: Record<StatusTone, string> = {
	critical: "var(--status-critical)",
	good: "var(--status-good)",
	muted: "var(--muted-foreground)",
	warning: "var(--status-warning)",
};

function StatusLabel({ status }: { status: NodeStatus }) {
	const Icon = STATUS_ICON[status.key];
	return (
		<span className="inline-flex items-center gap-1 whitespace-nowrap">
			<Icon className="size-3" style={{ color: TONE_COLOR[status.tone] }} aria-hidden />
			<span className={status.tone === "muted" ? undefined : "text-foreground"}>{status.label}</span>
		</span>
	);
}

/** Linha com " · " entre os itens (o separador fica dentro de cada item: não sobra sozinho). */
function Dotted({ parts }: { parts: [string, React.ReactNode][] }) {
	return (
		<span className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
			{parts.map(([key, p], i) => (
				<span key={key} className="inline-flex items-center gap-1.5">
					{i > 0 && <span aria-hidden>·</span>}
					{p}
				</span>
			))}
		</span>
	);
}

/** Sob o nome: nível · conta · situação; numa 2ª linha, orçamento · sem entrega. */
function NodeMeta({ n, account }: { n: StructuredNode; account?: string }) {
	const top: [string, React.ReactNode][] = [["nivel", LEVEL[n.level]]];
	if (account) top.push(["conta", account]);
	if (n.status) top.push(["situacao", <StatusLabel key="situacao" status={n.status} />]);
	const bottom: [string, React.ReactNode][] = [];
	if (n.budget)
		bottom.push([
			"orcamento",
			<span key="orcamento" className="num whitespace-nowrap">
				{n.budget}
			</span>,
		]);
	if (n.idle)
		bottom.push([
			"ocioso",
			<span key="ocioso" className="whitespace-nowrap">
				sem entrega no período
			</span>,
		]);
	return (
		<>
			<Dotted parts={top} />
			{bottom.length > 0 && <Dotted parts={bottom} />}
		</>
	);
}

function Roas({ m }: { m: Metrics }) {
	const r = roas(m);
	if (r === null) return <span className="text-muted-foreground">—</span>;
	const good = r >= 1;
	const Icon = good ? CircleCheckIcon : CircleAlertIcon;
	return (
		<span className="inline-flex items-center gap-1 whitespace-nowrap">
			<Icon
				className="size-3.5"
				style={{ color: good ? "var(--status-good)" : "var(--status-warning)" }}
				aria-hidden
			/>
			<span className="num">
				{r.toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
			</span>
			<span className="sr-only">{good ? "(acima de 1)" : "(abaixo de 1)"}</span>
		</span>
	);
}

function cells(m: Metrics, currency: string) {
	const c = cpa(m);
	return {
		clicks: formatInt(m.clicks),
		cpa: c === null ? "—" : formatMoney(c, currency),
		ctr: formatPct(ctr(m)),
		impressions: formatInt(m.impressions),
		meta: m.metaPurchases
			? `${formatInt(m.metaPurchases)} · ${formatMoney(m.metaPurchaseValue, currency)}`
			: "—",
		purchases: formatInt(m.purchases),
		revenue: formatMoney(m.revenue, currency),
		spend: formatMoney(m.spend, currency),
	};
}

/** Colunas de números de uma linha (mesma ordem de COLUMNS; impressões e CTR somem < 1400px). */
function MetricCells({ m, currency }: { m: Metrics; currency: string }) {
	const c = cells(m, currency);
	return (
		<>
			<td className="num py-2 pr-2.5 text-right">{c.spend}</td>
			<td className="num hidden py-2 pr-2.5 text-right min-[1400px]:table-cell">{c.impressions}</td>
			<td className="num py-2 pr-2.5 text-right">{c.clicks}</td>
			<td className="num hidden py-2 pr-2.5 text-right min-[1400px]:table-cell">{c.ctr}</td>
			<td className="num py-2 pr-2.5 text-right">{c.purchases}</td>
			<td className="num py-2 pr-2.5 text-right">{c.revenue}</td>
			<td className="py-2 pr-2.5 text-right">
				<Roas m={m} />
			</td>
			<td className="num py-2 pr-2.5 text-right">{c.cpa}</td>
			<td className="num text-muted-foreground py-2 text-right">{c.meta}</td>
		</>
	);
}

export function CampaignTree({
	tree,
	archived,
	totals,
	unattributed,
	currency,
	campaignAccount,
	showAccount,
}: {
	tree: StructuredNode[];
	archived: { nodes: StructuredNode[]; totals: Metrics } | null;
	totals: Metrics;
	unattributed: Metrics | null;
	currency: string;
	campaignAccount: Record<string, string>;
	showAccount: boolean;
}) {
	const [open, setOpen] = useState<Set<string>>(new Set());
	const toggle = (id: string) =>
		setOpen(s => {
			const n = new Set(s);
			if (n.has(id)) n.delete(id);
			else n.add(id);
			return n;
		});

	if (!tree.length && !archived)
		return (
			<p className="text-muted-foreground py-10 text-center text-sm">
				Sem gasto em anúncios neste período.
			</p>
		);

	const renderRow = (n: StructuredNode, depth: number): React.ReactNode => {
		const expandable = n.children.length > 0;
		const isOpen = open.has(n.id);
		return (
			<Fragment key={`${n.level}-${n.id}`}>
				<tr
					className={cn(
						"border-b last:border-0",
						depth === 0 && "bg-card/30",
						expandable && "hover:bg-accent/50 cursor-pointer",
					)}
					onClick={() => expandable && toggle(n.id)}
				>
					<th
						scope="row"
						className="py-2 pr-3 text-left font-normal"
						style={{ paddingLeft: `${depth * 1.25}rem` }}
					>
						<span className="flex items-start gap-1.5">
							{expandable ? (
								<button
									type="button"
									aria-expanded={isOpen}
									aria-label={`${isOpen ? "Recolher" : "Expandir"} ${n.name}`}
									onClick={e => {
										e.stopPropagation();
										toggle(n.id);
									}}
									className="hover:bg-accent -my-1 grid size-7 shrink-0 place-items-center rounded-md"
								>
									<ChevronRightIcon
										className={cn("size-4 transition-transform", isOpen && "rotate-90")}
									/>
								</button>
							) : (
								<span className="size-7 shrink-0" />
							)}
							<span className="min-w-0">
								<span
									className={cn(
										"block max-w-52 truncate xl:max-w-72",
										depth === 0 && "font-semibold",
									)}
									title={n.name}
								>
									{n.name}
								</span>
								<NodeMeta
									n={n}
									account={depth === 0 && showAccount ? campaignAccount[n.id] : undefined}
								/>
							</span>
						</span>
					</th>
					<MetricCells m={n} currency={currency} />
				</tr>
				{isOpen && n.children.map(child => renderRow(child, depth + 1))}
			</Fragment>
		);
	};

	const t = cells(totals, currency);
	return (
		<>
			{/* Desktop */}
			<div className="hidden overflow-x-auto lg:block">
				<table className="w-full text-sm">
					<thead>
						<tr className="text-muted-foreground border-b text-xs">
							<th scope="col" className="py-2 pr-3 text-left font-medium">
								Campanha / conjunto / anúncio
							</th>
							{COLUMNS.map(col => (
								<th
									key={col.key}
									scope="col"
									className={cn(
										"py-2 pr-2.5 text-right font-medium whitespace-nowrap last:pr-0",
										(col.key === "impressions" || col.key === "ctr") &&
											"hidden min-[1400px]:table-cell",
									)}
								>
									<Tooltip>
										<TooltipTrigger asChild>
											<span className="inline-flex cursor-help items-center gap-1">
												{col.label} <InfoIcon className="size-3" />
											</span>
										</TooltipTrigger>
										<TooltipContent className="max-w-60">{col.info}</TooltipContent>
									</Tooltip>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{tree.map(n => renderRow(n, 0))}
						{archived && (
							<>
								<tr
									className="hover:bg-accent/50 cursor-pointer border-b last:border-0"
									onClick={() => toggle(ARCHIVED_GROUP)}
								>
									<th scope="row" className="py-2 pr-3 text-left font-normal">
										<span className="flex items-start gap-1.5">
											<button
												type="button"
												aria-expanded={open.has(ARCHIVED_GROUP)}
												aria-label={`${open.has(ARCHIVED_GROUP) ? "Recolher" : "Expandir"} campanhas arquivadas ou excluídas`}
												onClick={e => {
													e.stopPropagation();
													toggle(ARCHIVED_GROUP);
												}}
												className="hover:bg-accent -my-1 grid size-7 shrink-0 place-items-center rounded-md"
											>
												<ChevronRightIcon
													className={cn(
														"size-4 transition-transform",
														open.has(ARCHIVED_GROUP) && "rotate-90",
													)}
												/>
											</button>
											<ArchivedTitle count={archived.nodes.length} />
										</span>
									</th>
									<MetricCells m={archived.totals} currency={currency} />
								</tr>
								{open.has(ARCHIVED_GROUP) && archived.nodes.map(n => renderRow(n, 1))}
							</>
						)}
					</tbody>
					<tfoot>
						<tr className="border-t-2 font-semibold">
							<th scope="row" className="py-2 pr-3 text-left">
								Total das campanhas
							</th>
							<td className="num py-2 pr-2.5 text-right">{t.spend}</td>
							<td className="num hidden py-2 pr-2.5 text-right min-[1400px]:table-cell">
								{t.impressions}
							</td>
							<td className="num py-2 pr-2.5 text-right">{t.clicks}</td>
							<td className="num hidden py-2 pr-2.5 text-right min-[1400px]:table-cell">
								{t.ctr}
							</td>
							<td className="num py-2 pr-2.5 text-right">{t.purchases}</td>
							<td className="num py-2 pr-2.5 text-right">{t.revenue}</td>
							<td className="py-2 pr-2.5 text-right">
								<Roas m={totals} />
							</td>
							<td className="num py-2 pr-2.5 text-right">{t.cpa}</td>
							<td className="num text-muted-foreground py-2 text-right">{t.meta}</td>
						</tr>
						{unattributed && unattributed.purchases > 0 && (
							<tr className="text-muted-foreground">
								<th scope="row" className="py-2 pr-3 text-left font-normal">
									Sem campanha identificada
								</th>
								{/* gasto · impressões (some < 1400px) · cliques · CTR (some < 1400px) */}
								<td />
								<td className="hidden min-[1400px]:table-cell" />
								<td />
								<td className="hidden min-[1400px]:table-cell" />
								<td className="num py-2 pr-2.5 text-right">
									{formatInt(unattributed.purchases)}
								</td>
								<td className="num py-2 pr-2.5 text-right">
									{formatMoney(unattributed.revenue, currency)}
								</td>
								<td colSpan={3} />
							</tr>
						)}
					</tfoot>
				</table>
			</div>

			{/* Celular / tablet */}
			<ul className="flex flex-col gap-2 lg:hidden">
				{tree.map(n => (
					<MobileNode
						key={n.id}
						node={n}
						depth={0}
						currency={currency}
						open={open}
						toggle={toggle}
					/>
				))}
				{archived && (
					<li className="bg-card/40 rounded-lg border">
						<button
							type="button"
							className="flex w-full items-start gap-2 p-3 text-left"
							aria-expanded={open.has(ARCHIVED_GROUP)}
							onClick={() => toggle(ARCHIVED_GROUP)}
						>
							<ChevronRightIcon
								className={cn(
									"mt-0.5 size-4 shrink-0 transition-transform",
									open.has(ARCHIVED_GROUP) && "rotate-90",
								)}
							/>
							<span className="min-w-0 flex-1">
								<ArchivedTitle count={archived.nodes.length} />
								<span className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
									<span className="text-muted-foreground">Gasto</span>
									<span className="num text-right">
										{formatMoney(archived.totals.spend, currency)}
									</span>
									<span className="text-muted-foreground">Receita</span>
									<span className="num text-right">
										{formatMoney(archived.totals.revenue, currency)}
									</span>
								</span>
							</span>
						</button>
						{open.has(ARCHIVED_GROUP) && (
							<ul className="flex flex-col gap-2 pr-2 pb-2">
								{archived.nodes.map(n => (
									<MobileNode
										key={n.id}
										node={n}
										depth={1}
										currency={currency}
										open={open}
										toggle={toggle}
									/>
								))}
							</ul>
						)}
					</li>
				)}
				{unattributed && unattributed.purchases > 0 && (
					<li className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
						Sem campanha identificada:{" "}
						<span className="num">{formatInt(unattributed.purchases)}</span> venda(s) ·{" "}
						<span className="num">{formatMoney(unattributed.revenue, currency)}</span>
					</li>
				)}
			</ul>
		</>
	);
}

function MobileNode({
	node,
	depth,
	currency,
	open,
	toggle,
}: {
	node: StructuredNode;
	depth: number;
	currency: string;
	open: Set<string>;
	toggle: (id: string) => void;
}) {
	const c = cells(node, currency);
	const isOpen = open.has(node.id);
	return (
		<li className={cn("bg-card/40 rounded-lg border", depth > 0 && "ml-3")}>
			<button
				type="button"
				className="flex w-full items-start gap-2 p-3 text-left"
				aria-expanded={node.children.length ? isOpen : undefined}
				onClick={() => node.children.length && toggle(node.id)}
			>
				{node.children.length > 0 && (
					<ChevronRightIcon
						className={cn("mt-0.5 size-4 shrink-0 transition-transform", isOpen && "rotate-90")}
					/>
				)}
				<span className="min-w-0 flex-1">
					<span className="block truncate font-medium">{node.name}</span>
					<NodeMeta n={node} />
					<span className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
						<span className="text-muted-foreground">Gasto</span>
						<span className="num text-right">{c.spend}</span>
						<span className="text-muted-foreground">Receita</span>
						<span className="num text-right">{c.revenue}</span>
						<span className="text-muted-foreground">ROAS</span>
						<span className="text-right">
							<Roas m={node} />
						</span>
						<span className="text-muted-foreground">CPA</span>
						<span className="num text-right">{c.cpa}</span>
						<span className="text-muted-foreground">Vendas · Meta</span>
						<span className="num text-right">
							{c.purchases} · {node.metaPurchases ? formatInt(node.metaPurchases) : "—"}
						</span>
					</span>
				</span>
			</button>
			{isOpen && node.children.length > 0 && (
				<ul className="flex flex-col gap-2 pr-2 pb-2">
					{node.children.map(child => (
						<MobileNode
							key={child.id}
							node={child}
							depth={depth + 1}
							currency={currency}
							open={open}
							toggle={toggle}
						/>
					))}
				</ul>
			)}
		</li>
	);
}
