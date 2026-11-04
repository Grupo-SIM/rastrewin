"use client";

import { ChevronRightIcon, CircleAlertIcon, CircleCheckIcon, InfoIcon } from "lucide-react";
import { Fragment, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cpa, ctr, roas, type Metrics, type TreeNode } from "@/lib/campaigns/build";
import { formatInt, formatMoney, formatPct } from "@/lib/dashboard/format";
import { cn } from "@/lib/utils";

const COLUMNS: { key: string; label: string; info: string }[] = [
  { key: "spend", label: "Gasto", info: "Valor investido segundo a Meta no período." },
  { key: "impressions", label: "Impressões", info: "Vezes que os anúncios apareceram." },
  { key: "clicks", label: "Cliques", info: "Cliques nos anúncios (todos)." },
  { key: "ctr", label: "CTR", info: "Cliques ÷ impressões." },
  { key: "purchases", label: "Vendas", info: "Vendas aprovadas do período ligadas a este item pelas UTMs (ID do anúncio, conjunto ou campanha)." },
  { key: "revenue", label: "Receita", info: "Valor bruto das vendas ligadas pelas UTMs." },
  { key: "roas", label: "ROAS", info: "Receita ÷ gasto. Acima de 1, a receita superou o gasto." },
  { key: "cpa", label: "CPA", info: "Gasto ÷ vendas ligadas." },
  { key: "meta", label: "Compras (Meta)", info: "Compras que a própria Meta atribui (configuração de atribuição da conta), para comparar." },
];

const LEVEL = { campaign: "Campanha", adset: "Conjunto", ad: "Anúncio" } as const;

function Roas({ m }: { m: Metrics }) {
  const r = roas(m);
  if (r === null) return <span className="text-muted-foreground">—</span>;
  const good = r >= 1;
  const Icon = good ? CircleCheckIcon : CircleAlertIcon;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <Icon className="size-3.5" style={{ color: good ? "var(--status-good)" : "var(--status-warning)" }} aria-hidden />
      <span className="num">{r.toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</span>
      <span className="sr-only">{good ? "(acima de 1)" : "(abaixo de 1)"}</span>
    </span>
  );
}

function cells(m: Metrics, currency: string) {
  const c = cpa(m);
  return {
    spend: formatMoney(m.spend, currency),
    impressions: formatInt(m.impressions),
    clicks: formatInt(m.clicks),
    ctr: formatPct(ctr(m)),
    purchases: formatInt(m.purchases),
    revenue: formatMoney(m.revenue, currency),
    cpa: c === null ? "—" : formatMoney(c, currency),
    meta: m.metaPurchases ? `${formatInt(m.metaPurchases)} · ${formatMoney(m.metaPurchaseValue, currency)}` : "—",
  };
}

export function CampaignTree({
  tree,
  totals,
  unattributed,
  currency,
  campaignAccount,
  showAccount,
}: {
  tree: TreeNode[];
  totals: Metrics;
  unattributed: Metrics | null;
  currency: string;
  campaignAccount: Record<string, string>;
  showAccount: boolean;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (!tree.length) return <p className="py-10 text-center text-sm text-muted-foreground">Sem gasto em anúncios neste período.</p>;

  const renderRow = (n: TreeNode, depth: number): React.ReactNode => {
    const c = cells(n, currency);
    const expandable = n.children.length > 0;
    const isOpen = open.has(n.id);
    return (
      <Fragment key={`${n.level}-${n.id}`}>
        <tr className={cn("border-b last:border-0", depth === 0 && "bg-card/30", expandable && "cursor-pointer hover:bg-accent/50")} onClick={() => expandable && toggle(n.id)}>
          <th scope="row" className="py-2 pr-3 text-left font-normal" style={{ paddingLeft: `${depth * 1.25}rem` }}>
            <span className="flex items-start gap-1.5">
              {expandable ? (
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? "Recolher" : "Expandir"} ${n.name}`}
                  onClick={(e) => { e.stopPropagation(); toggle(n.id); }}
                  className="-my-1 grid size-7 shrink-0 place-items-center rounded-md hover:bg-accent"
                >
                  <ChevronRightIcon className={cn("size-4 transition-transform", isOpen && "rotate-90")} />
                </button>
              ) : (
                <span className="size-7 shrink-0" />
              )}
              <span className="min-w-0">
                <span className={cn("block max-w-52 truncate xl:max-w-72", depth === 0 && "font-semibold")} title={n.name}>{n.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {LEVEL[n.level]}
                  {depth === 0 && showAccount && campaignAccount[n.id] ? ` · ${campaignAccount[n.id]}` : ""}
                </span>
              </span>
            </span>
          </th>
          <td className="num py-2 pr-2.5 text-right">{c.spend}</td>
          <td className="num hidden py-2 pr-2.5 text-right min-[1400px]:table-cell">{c.impressions}</td>
          <td className="num py-2 pr-2.5 text-right">{c.clicks}</td>
          <td className="num hidden py-2 pr-2.5 text-right min-[1400px]:table-cell">{c.ctr}</td>
          <td className="num py-2 pr-2.5 text-right">{c.purchases}</td>
          <td className="num py-2 pr-2.5 text-right">{c.revenue}</td>
          <td className="py-2 pr-2.5 text-right"><Roas m={n} /></td>
          <td className="num py-2 pr-2.5 text-right">{c.cpa}</td>
          <td className="num py-2 text-right text-muted-foreground">{c.meta}</td>
        </tr>
        {isOpen && n.children.map((child) => renderRow(child, depth + 1))}
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
            <tr className="border-b text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-3 text-left font-medium">Campanha / conjunto / anúncio</th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "py-2 pr-2.5 text-right font-medium whitespace-nowrap last:pr-0",
                    (col.key === "impressions" || col.key === "ctr") && "hidden min-[1400px]:table-cell",
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
          <tbody>{tree.map((n) => renderRow(n, 0))}</tbody>
          <tfoot>
            <tr className="border-t-2 font-semibold">
              <th scope="row" className="py-2 pr-3 text-left">Total das campanhas</th>
              <td className="num py-2 pr-2.5 text-right">{t.spend}</td>
              <td className="num hidden py-2 pr-2.5 text-right min-[1400px]:table-cell">{t.impressions}</td>
              <td className="num py-2 pr-2.5 text-right">{t.clicks}</td>
              <td className="num hidden py-2 pr-2.5 text-right min-[1400px]:table-cell">{t.ctr}</td>
              <td className="num py-2 pr-2.5 text-right">{t.purchases}</td>
              <td className="num py-2 pr-2.5 text-right">{t.revenue}</td>
              <td className="py-2 pr-2.5 text-right"><Roas m={totals} /></td>
              <td className="num py-2 pr-2.5 text-right">{t.cpa}</td>
              <td className="num py-2 text-right text-muted-foreground">{t.meta}</td>
            </tr>
            {unattributed && unattributed.purchases > 0 && (
              <tr className="text-muted-foreground">
                <th scope="row" className="py-2 pr-3 text-left font-normal">Sem campanha identificada</th>
                {/* gasto · impressões (some < 1400px) · cliques · CTR (some < 1400px) */}
                <td />
                <td className="hidden min-[1400px]:table-cell" />
                <td />
                <td className="hidden min-[1400px]:table-cell" />
                <td className="num py-2 pr-2.5 text-right">{formatInt(unattributed.purchases)}</td>
                <td className="num py-2 pr-2.5 text-right">{formatMoney(unattributed.revenue, currency)}</td>
                <td colSpan={3} />
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {/* Celular / tablet */}
      <ul className="flex flex-col gap-2 lg:hidden">
        {tree.map((n) => (
          <MobileNode key={n.id} node={n} depth={0} currency={currency} open={open} toggle={toggle} />
        ))}
        {unattributed && unattributed.purchases > 0 && (
          <li className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Sem campanha identificada: <span className="num">{formatInt(unattributed.purchases)}</span> venda(s) ·{" "}
            <span className="num">{formatMoney(unattributed.revenue, currency)}</span>
          </li>
        )}
      </ul>
    </>
  );
}

function MobileNode({ node, depth, currency, open, toggle }: { node: TreeNode; depth: number; currency: string; open: Set<string>; toggle: (id: string) => void }) {
  const c = cells(node, currency);
  const isOpen = open.has(node.id);
  return (
    <li className={cn("rounded-lg border bg-card/40", depth > 0 && "ml-3")}>
      <button
        type="button"
        className="flex w-full items-start gap-2 p-3 text-left"
        aria-expanded={node.children.length ? isOpen : undefined}
        onClick={() => node.children.length && toggle(node.id)}
      >
        {node.children.length > 0 && <ChevronRightIcon className={cn("mt-0.5 size-4 shrink-0 transition-transform", isOpen && "rotate-90")} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{node.name}</span>
          <span className="block text-xs text-muted-foreground">{LEVEL[node.level]}</span>
          <span className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <span className="text-muted-foreground">Gasto</span><span className="num text-right">{c.spend}</span>
            <span className="text-muted-foreground">Receita</span><span className="num text-right">{c.revenue}</span>
            <span className="text-muted-foreground">ROAS</span><span className="text-right"><Roas m={node} /></span>
            <span className="text-muted-foreground">CPA</span><span className="num text-right">{c.cpa}</span>
            <span className="text-muted-foreground">Vendas · Meta</span><span className="num text-right">{c.purchases} · {node.metaPurchases ? formatInt(node.metaPurchases) : "—"}</span>
          </span>
        </span>
      </button>
      {isOpen && node.children.length > 0 && (
        <ul className="flex flex-col gap-2 pr-2 pb-2">
          {node.children.map((child) => (
            <MobileNode key={child.id} node={child} depth={depth + 1} currency={currency} open={open} toggle={toggle} />
          ))}
        </ul>
      )}
    </li>
  );
}
