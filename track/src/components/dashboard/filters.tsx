"use client";

import { CalendarIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, type FormEvent, type ReactNode, use, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseEventTypes, serializeEventTypes } from "@/lib/dashboard/event-types";
import { DEFAULT_PRESET, PRESETS } from "@/lib/dashboard/period";
import { cn } from "@/lib/utils";

/*
 * Filtros do painel: UMA linha acima de tudo o que eles afetam; estado na URL (link compartilhável).
 * Ao trocar, o conteúdo antigo fica na tela com opacidade reduzida até o novo chegar (sem piscar).
 */

interface Ctx {
	pending: boolean;
	setParams: (update: Record<string, string | null>) => void;
}
const FiltersContext = createContext<Ctx | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();
	const [pending, startTransition] = useTransition();

	function setParams(update: Record<string, string | null>) {
		const next = new URLSearchParams(params.toString());
		for (const [k, v] of Object.entries(update)) {
			if (v === null || v === "") next.delete(k);
			else next.set(k, v);
		}
		if (!("page" in update)) next.delete("page"); // filtro novo volta para a página 1
		const qs = next.toString();
		startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
	}

	return <FiltersContext value={{ pending, setParams }}>{children}</FiltersContext>;
}

export function useFilters() {
	const ctx = use(FiltersContext);
	if (!ctx) throw new Error("useFilters precisa de <FiltersProvider>");
	return ctx;
}

/** Área de conteúdo que "esmaece" enquanto os dados novos carregam. */
export function PendingArea({ children, className }: { children: ReactNode; className?: string }) {
	const { pending } = useFilters();
	return (
		<div
			aria-busy={pending}
			className={cn("transition-opacity duration-200", pending && "opacity-50", className)}
		>
			{children}
		</div>
	);
}

export function FiltersBar({ children }: { children?: ReactNode }) {
	return (
		<div role="search" aria-label="Filtros" className="flex flex-wrap items-center gap-2">
			<PeriodFilter />
			{children}
		</div>
	);
}

const trigger = "h-10 min-w-0 bg-card/60";

export function PeriodFilter() {
	const { setParams } = useFilters();
	const params = useSearchParams();
	const current = params.get("periodo") ?? DEFAULT_PRESET;
	const [custom, setCustom] = useState(current === "custom");
	const [de, setDe] = useState(params.get("de") ?? "");
	const [ate, setAte] = useState(params.get("ate") ?? "");

	return (
		<>
			<Select
				value={custom ? "custom" : current}
				onValueChange={v => {
					if (v === "custom") return setCustom(true);
					setCustom(false);
					setParams({ ate: null, de: null, periodo: v });
				}}
			>
				<SelectTrigger aria-label="Período" className={cn(trigger, "w-[11.5rem]")}>
					<CalendarIcon className="text-muted-foreground size-4" />
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{PRESETS.map(p => (
						<SelectItem key={p.key} value={p.key}>
							{p.label}
						</SelectItem>
					))}
					<SelectItem value="custom">Personalizado…</SelectItem>
				</SelectContent>
			</Select>
			{custom && (
				<form
					className="flex flex-wrap items-center gap-2"
					onSubmit={e => {
						e.preventDefault();
						if (de && ate && de <= ate) setParams({ ate, de, periodo: "custom" });
					}}
				>
					<Input
						type="date"
						aria-label="De"
						value={de}
						max={ate || undefined}
						onChange={e => setDe(e.target.value)}
						className="h-10 w-[9.5rem]"
					/>
					<span className="text-muted-foreground text-sm">até</span>
					<Input
						type="date"
						aria-label="Até"
						value={ate}
						min={de || undefined}
						onChange={e => setAte(e.target.value)}
						className="h-10 w-[9.5rem]"
					/>
					<Button
						type="submit"
						variant="outline"
						className="h-10"
						disabled={!de || !ate || de > ate}
					>
						Aplicar
					</Button>
				</form>
			)}
		</>
	);
}

export function SelectFilter({
	name,
	label,
	options,
	allLabel,
	width = "w-[11rem]",
}: {
	name: string;
	label: string;
	options: { value: string; label: string }[];
	allLabel?: string;
	width?: string;
}) {
	const { setParams } = useFilters();
	const params = useSearchParams();
	const ALL = "__all__";
	return (
		<Select
			value={params.get(name) || ALL}
			onValueChange={v => setParams({ [name]: v === ALL ? null : v })}
		>
			<SelectTrigger aria-label={label} className={cn(trigger, width)}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
				{options.map(o => (
					<SelectItem key={o.value} value={o.value}>
						{o.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

/**
 * Filtro de tipo de evento com várias opções marcadas (?tipo=A,B). Marcar/desmarcar não recarrega
 * a cada clique: aplica ao fechar o menu (ou em "Aplicar"), numa única navegação.
 */
export function EventTypesFilter({ options }: { options: string[] }) {
	const { setParams } = useFilters();
	const applied = parseEventTypes(useSearchParams().get("tipo"));
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState<string[]>(applied);
	// Tipo marcado que não existe no período atual continua na lista, para poder desmarcar.
	const all = [...options, ...applied.filter(t => !options.includes(t))];

	function apply(next: string[]) {
		const value = serializeEventTypes(all.filter(t => next.includes(t)));
		if (value !== serializeEventTypes(applied)) setParams({ tipo: value });
	}
	function onOpenChange(next: boolean) {
		if (next) setDraft(applied);
		else apply(draft);
		setOpen(next);
	}
	const toggle = (t: string, on: boolean) => setDraft(d => (on ? [...d, t] : d.filter(x => x !== t)));

	const label =
		applied.length === 0
			? "Todos os eventos"
			: applied.length === 1
				? applied[0]
				: `${applied.length} tipos de evento`;

	return (
		<DropdownMenu open={open} onOpenChange={onOpenChange}>
			<DropdownMenuTrigger
				aria-label={`Tipo de evento: ${applied.length ? applied.join(", ") : "todos"}`}
				className={cn(
					trigger,
					"border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 flex w-[13rem] items-center justify-between gap-1.5 rounded-lg border py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3",
				)}
			>
				<span className="truncate">{label}</span>
				<ChevronDownIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-60">
				<DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
					Marque um ou mais tipos
				</DropdownMenuLabel>
				{all.length ? (
					all.map(t => (
						<DropdownMenuCheckboxItem
							key={t}
							checked={draft.includes(t)}
							onCheckedChange={on => toggle(t, on === true)}
							onSelect={e => e.preventDefault()}
							className="min-h-9"
						>
							{t}
						</DropdownMenuCheckboxItem>
					))
				) : (
					<p className="text-muted-foreground px-2 py-1.5 text-sm">Nenhum evento no período</p>
				)}
				<DropdownMenuSeparator />
				<div className="flex gap-2 p-1">
					<Button
						variant="ghost"
						className="h-9 flex-1"
						disabled={!draft.length}
						onClick={() => setDraft([])}
					>
						Limpar
					</Button>
					<Button className="h-9 flex-1" onClick={() => onOpenChange(false)}>
						Aplicar
					</Button>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function SearchFilter({ placeholder }: { placeholder: string }) {
	// A chave refaz o campo quando a busca da URL muda: o Next 16 guarda o estado de páginas já
	// visitadas, então sem isso o campo mostrava o texto antigo (ex.: link com ?q= vindo da Jornada).
	const q = useSearchParams().get("q") ?? "";
	return <SearchInput key={q} initial={q} placeholder={placeholder} />;
}

function SearchInput({ initial, placeholder }: { initial: string; placeholder: string }) {
	const { setParams } = useFilters();
	const [value, setValue] = useState(initial);
	function submit(e: FormEvent) {
		e.preventDefault();
		setParams({ q: value.trim() || null });
	}
	return (
		<form onSubmit={submit} className="relative min-w-[12rem] flex-1 sm:max-w-xs">
			<SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
			<Input
				type="search"
				aria-label={placeholder}
				placeholder={placeholder}
				value={value}
				onChange={e => setValue(e.target.value)}
				className="bg-card/60 h-10 pl-9"
			/>
		</form>
	);
}

export function Pagination({ page, total, pageSize }: { page: number; total: number; pageSize: number }) {
	const { setParams } = useFilters();
	const navRef = useRef<HTMLElement>(null);
	const pages = Math.max(1, Math.ceil(total / pageSize));
	if (pages <= 1) return null;

	// Quem clica em "Próxima" no fim de uma lista longa volta ao topo do cartão para ler a nova página
	// desde o começo (descontando a barra fixa do topo no celular).
	function go(to: number) {
		setParams({ page: String(to) });
		const card = navRef.current?.closest<HTMLElement>("[data-slot=card]");
		if (!card) return;
		const top = card.getBoundingClientRect().top;
		if (top < 0) window.scrollTo({ behavior: "smooth", top: window.scrollY + top - 80 });
	}

	return (
		<nav
			ref={navRef}
			aria-label="Paginação"
			className="flex items-center justify-between gap-3 pt-2 text-sm"
		>
			<span className="text-muted-foreground">
				Página <span className="num">{page}</span> de <span className="num">{pages}</span>
			</span>
			<div className="flex gap-2">
				<Button variant="outline" className="h-10" disabled={page <= 1} onClick={() => go(page - 1)}>
					Anterior
				</Button>
				<Button
					variant="outline"
					className="h-10"
					disabled={page >= pages}
					onClick={() => go(page + 1)}
				>
					Próxima
				</Button>
			</div>
		</nav>
	);
}
