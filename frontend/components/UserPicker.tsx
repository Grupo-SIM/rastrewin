"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface UserOption {
	id: string;
	name: string;
	sub: string;
}

const MAX_SHOWN = 80;

/** Combobox com busca para escolher um cliente. A lista abre em portal (não é cortada por overflow). */
export function UserPicker({
	options,
	value,
	fallbackLabel,
	loadOptions,
	onChange,
}: {
	options: UserOption[];
	/** busca remota (use quando há clientes demais para baixar todos): recebe o texto digitado */
	loadOptions?: (q: string) => Promise<UserOption[]>;
	value: string;
	/** texto exibido quando há ganhador sem vínculo com um cliente */
	fallbackLabel?: string | null;
	onChange: (id: string, name?: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const [q, setQ] = useState("");
	const [hi, setHi] = useState(0);
	const [pos, setPos] = useState<{
		left: number;
		top: number;
		width: number;
		up: boolean;
		max: number;
	} | null>(null);
	const btn = useRef<HTMLButtonElement>(null);
	const pop = useRef<HTMLDivElement>(null);
	const list = useRef<HTMLDivElement>(null);

	const [remote, setRemote] = useState<UserOption[]>([]);
	useEffect(() => {
		if (!open || !loadOptions) return;
		let alive = true;
		const t = setTimeout(
			() =>
				loadOptions(q.trim())
					.then(r => alive && setRemote(r))
					.catch(() => {}),
			250,
		);
		return () => {
			alive = false;
			clearTimeout(t);
		};
		// eslint-disable-next-line
	}, [open, q]);

	const selected =
		(loadOptions ? remote : options).find(o => o.id === value) ?? options.find(o => o.id === value);
	const shown = useMemo(() => {
		if (loadOptions) return remote;
		const n = q.trim().toLowerCase();
		return n ? options.filter(o => `${o.name} ${o.sub}`.toLowerCase().includes(n)) : options;
		// eslint-disable-next-line
	}, [options, q, remote]);
	const visible = shown.slice(0, MAX_SHOWN);

	function place() {
		const r = btn.current?.getBoundingClientRect();
		if (!r) return;
		const width = Math.max(r.width, 320);
		const below = window.innerHeight - r.bottom - 12;
		const above = r.top - 12;
		const up = below < 280 && above > below;
		setPos({
			left: Math.max(12, Math.min(r.left, window.innerWidth - width - 12)),
			max: Math.max(160, Math.min(360, up ? above : below) - 56),
			top: up ? r.top - 6 : r.bottom + 6,
			up,
			width,
		});
	}

	function close() {
		setOpen(false);
		setQ("");
	}

	useEffect(() => {
		if (!open) return;
		place();
		const onDown = (e: MouseEvent) => {
			const t = e.target as Node;
			if (!pop.current?.contains(t) && !btn.current?.contains(t)) close();
		};
		const onMove = (e: Event) => {
			if (!pop.current?.contains(e.target as Node)) close();
		};
		document.addEventListener("mousedown", onDown);
		window.addEventListener("scroll", onMove, true);
		window.addEventListener("resize", close);
		return () => {
			document.removeEventListener("mousedown", onDown);
			window.removeEventListener("scroll", onMove, true);
			window.removeEventListener("resize", close);
		};
	}, [open]);

	useEffect(() => setHi(0), [q, open]);
	useEffect(() => {
		list.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" });
	}, [hi]);

	function pick(id: string) {
		onChange(id, shown.find(o => o.id === id)?.name);
		close();
		btn.current?.focus();
	}

	function onKey(e: React.KeyboardEvent) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setHi(h => Math.min(h + 1, visible.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setHi(h => Math.max(h - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (visible[hi]) pick(visible[hi].id);
		} else if (e.key === "Escape") {
			e.preventDefault();
			close();
			btn.current?.focus();
		}
	}

	return (
		<>
			<button
				type="button"
				ref={btn}
				className={`rp-btn fill ${selected ? "has" : ""} ${open ? "open" : ""}`}
				onClick={() => (open ? close() : setOpen(true))}
				aria-haspopup="listbox"
				aria-expanded={open}
			>
				{selected ? (
					<>
						<span className="rp-av">{selected.name[0]}</span>
						<span className="rp-val">{selected.name}</span>
					</>
				) : fallbackLabel ? (
					<span className="rp-val" title="Ganhador sem vínculo com um cliente">
						{fallbackLabel}
					</span>
				) : (
					<span className="rp-val ph">Escolher cliente...</span>
				)}
				<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
					<path
						d="M2.5 4.5 6 8l3.5-3.5"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.6"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</button>
			{open &&
				pos &&
				createPortal(
					<div
						ref={pop}
						className="rp-pop"
						style={{
							left: pos.left,
							width: pos.width,
							...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
						}}
						onKeyDown={onKey}
					>
						<div className="rp-search">
							<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
								<circle
									cx="7"
									cy="7"
									r="5"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.6"
								/>
								<path
									d="m11 11 3.5 3.5"
									stroke="currentColor"
									strokeWidth="1.6"
									strokeLinecap="round"
								/>
							</svg>
							<input
								placeholder="Buscar cliente..."
								value={q}
								onChange={e => setQ(e.target.value)}
							/>
							{q && (
								<button
									type="button"
									className="rp-clear"
									onClick={() => setQ("")}
									aria-label="Limpar"
								>
									×
								</button>
							)}
						</div>
						<div className="rp-list" ref={list} role="listbox" style={{ maxHeight: pos.max }}>
							{visible.length === 0 && (
								<div className="rp-empty">Nenhum cliente encontrado.</div>
							)}
							{visible.map((o, i) => (
								<div
									key={o.id}
									data-i={i}
									role="option"
									aria-selected={o.id === value}
									className={`rp-item ${i === hi ? "hi" : ""} ${o.id === value ? "sel" : ""}`}
									onMouseEnter={() => setHi(i)}
									onClick={() => pick(o.id)}
								>
									<span className="rp-av lg">{o.name[0]}</span>
									<span className="rp-txt">
										<span className="rp-t">{o.name}</span>
										<span className="rp-s">{o.sub}</span>
									</span>
								</div>
							))}
							{shown.length > visible.length && (
								<div className="rp-more">
									+{shown.length - visible.length} — refine a busca
								</div>
							)}
						</div>
						<div className="rp-foot">
							{shown.length} cliente{shown.length === 1 ? "" : "s"} pagante
							{shown.length === 1 ? "" : "s"}
						</div>
					</div>,
					document.body,
				)}
		</>
	);
}
