/** Progresso de um play, em segundos inteiros, já coerente com a duração. */
export interface VideoProgress {
	durationS: number;
	maxPositionS: number;
	watchedS: number;
	completed: boolean;
}

/**
 * Normaliza o que o site mandou: posição e tempo assistido nunca passam da duração (quando conhecida);
 * "concluído" = o player avisou o fim, ou a posição chegou ao último segundo.
 */
export function videoProgress(input: {
	duration: number;
	position: number;
	watched: number;
	ended?: boolean;
}): VideoProgress {
	const durationS = Math.round(input.duration);
	const cap = (n: number) => {
		const r = Math.round(n);
		return durationS > 0 ? Math.min(r, durationS) : r;
	};
	const ended = input.ended === true;
	const maxPositionS = ended && durationS > 0 ? durationS : cap(input.position);
	return {
		completed: ended || (durationS > 0 && maxPositionS >= durationS - 1),
		durationS,
		maxPositionS,
		watchedS: cap(input.watched),
	};
}
