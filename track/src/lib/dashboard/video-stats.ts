/*
 * Matemática da aba Vídeos (pura, testada). A entrada é o histograma de "até onde cada play chegou",
 * em % do vídeo (0–100, inteiro): { bin: 37, count: 4 } = 4 plays pararam entre 37% e 38%.
 */

export interface Bin {
	bin: number;
	count: number;
}
export interface RetentionPoint {
	/** Ponto do vídeo, em % (0, 5, 10… 100). */
	pct: number;
	/** Plays que chegaram a esse ponto. */
	plays: number;
	/** plays ÷ total de plays (0–1). */
	share: number;
}

/** Curva de retenção: % dos plays que chegaram a cada ponto do vídeo (o ponto 0 é sempre 100%). */
export function retentionCurve(hist: Bin[], step = 5): RetentionPoint[] {
	const total = hist.reduce((s, h) => s + h.count, 0);
	const out: RetentionPoint[] = [];
	for (let pct = 0; pct <= 100; pct += step) {
		const plays = pct === 0 ? total : hist.reduce((s, h) => (h.bin >= pct ? s + h.count : s), 0);
		out.push({ pct, plays, share: total ? plays / total : 0 });
	}
	return out;
}

export const BANDS = [
	{ from: 0, label: "Até 25%", to: 25 },
	{ from: 25, label: "25% a 50%", to: 50 },
	{ from: 50, label: "50% a 75%", to: 75 },
	{ from: 75, label: "75% ao fim", to: 101 },
] as const;

/** Quantos plays PARARAM em cada faixa (somam o total). */
export function stopBands(hist: Bin[]): { label: string; value: number }[] {
	return BANDS.map(b => ({
		label: b.label,
		value: hist.reduce((s, h) => (h.bin >= b.from && h.bin < b.to ? s + h.count : s), 0),
	}));
}

/** 0 → "0:00", 75 → "1:15", 3725 → "1:02:05". */
export function formatClock(seconds: number): string {
	const s = Math.max(0, Math.round(seconds));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const ss = String(s % 60).padStart(2, "0");
	return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
