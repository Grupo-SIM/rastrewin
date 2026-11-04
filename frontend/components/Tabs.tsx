"use client";
import { useLayoutEffect, useRef, useState } from "react";

export interface TabItem<K extends string> {
	key: K;
	label: string;
	count: number;
}

/** Abas com indicador deslizante (a borda arco-íris desliza até a aba clicada). */
export function Tabs<K extends string>({
	items,
	value,
	onChange,
}: {
	items: TabItem<K>[];
	value: K;
	onChange: (k: K) => void;
}) {
	const wrap = useRef<HTMLDivElement>(null);
	const refs = useRef<Record<string, HTMLButtonElement | null>>({});
	const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
	const sig = items.map(i => i.count).join(",");

	useLayoutEffect(() => {
		const measure = () => {
			const el = refs.current[value];
			if (el) setInd({ w: el.offsetWidth, x: el.offsetLeft });
		};
		measure();
		const ro = new ResizeObserver(measure);
		if (wrap.current) ro.observe(wrap.current);
		return () => ro.disconnect();
	}, [value, sig]);

	return (
		<div className="tabs" ref={wrap} role="tablist">
			{ind && (
				<span className="tab-ind" style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} />
			)}
			{items.map(t => (
				<button
					key={t.key}
					ref={el => {
						refs.current[t.key] = el;
					}}
					role="tab"
					aria-selected={value === t.key}
					className={`tab ${value === t.key ? "on" : ""}`}
					onClick={() => onChange(t.key)}
				>
					{t.label}
					<span className="c">{t.count}</span>
				</button>
			))}
		</div>
	);
}
