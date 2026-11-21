"use client";

import type Player from "@vimeo/player";
import { useCallback, useEffect, useRef, useState } from "react";
import { progressMarksReached, vslEvent } from "@/lib/meta-events";
import { dueForReport, reportVideo } from "@/lib/video-tracking";
import { loadVimeoPlayer, vimeoEmbedUrl } from "@/lib/vimeo-player";
import { advanceWatchProgress, initialWatchProgress } from "@/lib/watch-progress";

const TICK_MS = 250;
/**
 * O player não ficou pronto nesse tempo depois de a página abrir (rede travada, bloqueador): libera o botão
 * para não travar o funil. O player continua carregando e funciona se ficar pronto depois.
 */
const SLOW_LOAD_MS = 15_000;

/** Eventos do Vimeo que o player escuta (desligados ao desmontar). */
const PLAYER_EVENTS = [
	"timeupdate",
	"play",
	"playing",
	"bufferstart",
	"bufferend",
	"pause",
	"ended",
	"error",
	"texttrackchange",
] as const;

/** watched = assistiu o tempo de liberação; ended = o vídeo terminou antes disso; error = o player falhou ou não carregou. */
export type UnlockReason = "watched" | "ended" | "error";

/** "ok": o player do Vimeo na tela (carregando ou pronto); "error": o vídeo não carregou. */
type Status = "ok" | "error";

interface VslPlayerProps {
	videoId: string;
	unlockAtSeconds: number;
	title: string;
	/** Já liberado (ex.: visita anterior): não precisa mais contar o tempo. */
	unlocked: boolean;
	onUnlock: (reason: UnlockReason) => void;
}

export function VslPlayer({ videoId, unlockAtSeconds, title, unlocked, onUnlock }: VslPlayerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const playerRef = useRef<Player | null>(null);
	const tickRef = useRef<number | null>(null);
	const lastTickAtRef = useRef(0);
	const startedRef = useRef(false);
	const pausedRef = useRef(true);
	/** Posição do vídeo, do último evento "timeupdate" do Vimeo. */
	const positionRef = useRef<number | null>(null);
	const progressRef = useRef(initialWatchProgress);
	/** Medição (aba Vídeos do track): duração, ponto mais adiante, título do Vimeo e último envio. */
	const durationRef = useRef(0);
	const maxPositionRef = useRef(0);
	const videoTitleRef = useRef<string | null>(null);
	const lastReportAtRef = useRef(0);
	/** Marcos do VSLProgress (Meta) já enviados neste carregamento da página. */
	const progressMarksRef = useRef(new Set<number>());
	const unlockedRef = useRef(unlocked);
	const onUnlockRef = useRef(onUnlock);
	const [status, setStatus] = useState<Status>("ok");

	useEffect(() => {
		unlockedRef.current = unlocked;
		onUnlockRef.current = onUnlock;
	});

	const stopTicking = useCallback(() => {
		if (tickRef.current === null) return;
		window.clearInterval(tickRef.current);
		tickRef.current = null;
	}, []);

	const unlock = useCallback((reason: UnlockReason) => {
		if (unlockedRef.current) return;
		unlockedRef.current = true;
		onUnlockRef.current(reason);
	}, []);

	/** Envia o progresso ao track (só depois do primeiro play). Nunca afeta o player. */
	const report = useCallback(
		(ended = false) => {
			if (!startedRef.current) return;
			lastReportAtRef.current = Date.now();
			reportVideo({
				cta: unlockAtSeconds,
				duration: durationRef.current,
				ended,
				maxPosition: maxPositionRef.current,
				title: videoTitleRef.current ?? title,
				videoId,
				watched: progressRef.current.watchedSeconds,
			});
		},
		[title, unlockAtSeconds, videoId],
	);

	/** Meta: VSLProgress em 25/50/75/95% do vídeo, pelo tempo realmente assistido. Nunca afeta o player. */
	const sendProgressMarks = useCallback(() => {
		const sent = progressMarksRef.current;
		for (const percent of progressMarksReached(
			progressRef.current.watchedSeconds,
			durationRef.current,
			sent,
		)) {
			sent.add(percent);
			vslEvent("VSLProgress", { percent, video_id: `vimeo:${videoId}` });
		}
	}, [videoId]);

	// Saiu da página ou trocou de aba: manda o progresso até ali.
	useEffect(() => {
		const onHide = () => {
			if (document.visibilityState === "hidden") report();
		};
		const onPageHide = () => report();
		document.addEventListener("visibilitychange", onHide);
		window.addEventListener("pagehide", onPageHide);
		return () => {
			document.removeEventListener("visibilitychange", onHide);
			window.removeEventListener("pagehide", onPageHide);
		};
	}, [report]);

	// Conta o tempo assistido enquanto toca (para o botão e para a medição do vídeo inteiro).
	const startTicking = useCallback(() => {
		if (tickRef.current !== null) return;
		// Recomeça a cada play: o tempo pausado não entra no tempo real entre leituras.
		lastTickAtRef.current = performance.now();
		tickRef.current = window.setInterval(() => {
			const position = positionRef.current;
			if (position === null) return;
			const now = performance.now();
			const elapsedSeconds = (now - lastTickAtRef.current) / 1000;
			lastTickAtRef.current = now;
			progressRef.current = advanceWatchProgress(progressRef.current, position, elapsedSeconds);
			if (!unlockedRef.current && progressRef.current.watchedSeconds >= unlockAtSeconds)
				unlock("watched");
			sendProgressMarks();
			if (dueForReport(Date.now(), lastReportAtRef.current)) report();
		}, TICK_MS);
	}, [report, sendProgressMarks, unlock, unlockAtSeconds]);

	// Se o vídeo falhar, mostra o erro e libera o botão para não travar o funil.
	const fail = useCallback(() => {
		stopTicking();
		void playerRef.current?.destroy();
		playerRef.current = null;
		setStatus("error");
		unlock("error");
	}, [stopTicking, unlock]);

	/**
	 * Liga a medição ao iframe do Vimeo, que já veio no HTML e carrega desde a abertura da página.
	 * A capa e o play são os do próprio Vimeo, que aparecem quando o player fica pronto.
	 */
	useEffect(() => {
		let active = true;
		const slowLoad = window.setTimeout(() => unlock("error"), SLOW_LOAD_MS);
		const iframe = containerRef.current?.querySelector("iframe");

		loadVimeoPlayer()
			.then(VimeoPlayer => {
				if (!active || !iframe) return;
				const player = new VimeoPlayer(iframe);
				playerRef.current = player;

				player.on("timeupdate", ({ seconds, duration }) => {
					positionRef.current = seconds;
					if (seconds > maxPositionRef.current) maxPositionRef.current = seconds;
					if (duration > 0) durationRef.current = duration;
				});
				player.on("play", () => {
					// Meta: início real do vídeo, uma vez por carregamento da página.
					if (!startedRef.current) vslEvent("VSLStart", { video_id: `vimeo:${videoId}` });
					startedRef.current = true;
					report();
				});
				player.on("playing", () => {
					pausedRef.current = false;
					startTicking();
				});
				player.on("bufferstart", stopTicking);
				player.on("bufferend", () => {
					if (!pausedRef.current) startTicking();
				});
				player.on("pause", () => {
					pausedRef.current = true;
					stopTicking();
					report();
				});
				player.on("ended", () => {
					pausedRef.current = true;
					stopTicking();
					// Assistiu até o fim: libera mesmo que o vídeo seja mais curto que unlockAtSeconds.
					unlock("ended");
					report(true);
				});
				player.on("error", error => {
					// Erros de um comando (ex.: autoplay bloqueado) não derrubam o player.
					if (error.method) return;
					if (active) fail();
				});
				// O vídeo já tem a legenda editada; a automática do Vimeo (que o iPhone pode ligar sozinho) duplicaria.
				player.on("texttrackchange", ({ kind }) => {
					if (kind) player.disableTextTrack().catch(() => {});
				});

				player
					.ready()
					.then(() => {
						if (!active) return;
						window.clearTimeout(slowLoad);
						player.disableTextTrack().catch(() => {});
						player
							.getVideoTitle()
							.then(t => {
								videoTitleRef.current = t || null;
							})
							.catch(() => {});
					})
					.catch(() => {
						if (active) fail();
					});
			})
			.catch(() => {
				if (active) fail();
			});

		return () => {
			active = false;
			window.clearTimeout(slowLoad);
			stopTicking();
			// Só desliga os ouvintes: destruir o player tiraria da página o iframe que veio no HTML.
			const player = playerRef.current;
			if (player) for (const event of PLAYER_EVENTS) player.off(event);
			playerRef.current = null;
		};
	}, [fail, report, startTicking, stopTicking, unlock, videoId]);

	return (
		<div className="w-full">
			<div className="bg-ink shadow-brand-lg relative aspect-[9/16] w-full overflow-hidden rounded-[1.75rem]">
				{/* Player do Vimeo: no HTML desde o início. A capa e o play são os do próprio Vimeo (a miniatura
				    do vídeo, trocada no Vimeo); até ele carregar, o quadro fica na cor do fundo. */}
				<div ref={containerRef} className="absolute inset-0 [&_iframe]:size-full">
					<iframe
						src={vimeoEmbedUrl(videoId)}
						title={`Vídeo: ${title}`}
						allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
					/>
				</div>

				{status === "error" ? (
					<div
						role="alert"
						className="bg-ink absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-white"
					>
						<p className="font-semibold">Não foi possível carregar o vídeo.</p>
						<button
							type="button"
							onClick={() => window.location.reload()}
							className="text-ink cursor-pointer rounded-full bg-white px-4 py-2 text-sm font-semibold outline-offset-4 focus-visible:outline-2 focus-visible:outline-white"
						>
							Tentar de novo
						</button>
					</div>
				) : null}
			</div>

			<noscript>
				<p className="mt-3 text-sm font-semibold">Ative o JavaScript para assistir ao vídeo.</p>
			</noscript>
		</div>
	);
}
