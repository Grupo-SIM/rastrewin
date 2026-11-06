"use client";

import type Player from "@vimeo/player";
import { LoaderCircle, Play } from "lucide-react";
import Image from "next/image";
import { type MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { dueForReport, reportVideo } from "@/lib/video-tracking";
import {
	canPreloadPlayer,
	loadVimeoPlayer,
	preconnectVimeo,
	vimeoEmbedUrl,
	whenPageIdle,
} from "@/lib/vimeo-player";
import { advanceWatchProgress, initialWatchProgress } from "@/lib/watch-progress";

const TICK_MS = 250;
/** Tocou na capa e o player não ficou pronto nesse tempo (rede travada, bloqueador): erro e libera o botão. */
const LOAD_TIMEOUT_MS = 15_000;

export type UnlockReason = "watched" | "error";

/**
 * - "idle": capa clicável, ainda sem player pronto embaixo (o toque cria ou espera o player).
 * - "loading": tocou na capa e o player está carregando.
 * - "ready": player pronto embaixo da capa; a capa vira só imagem e o toque cai no play do Vimeo.
 * - "error": o vídeo não carregou.
 */
type Status = "idle" | "loading" | "ready" | "error";

interface VslPlayerProps {
	videoId: string;
	unlockAtSeconds: number;
	posterSrc: string;
	title: string;
	/** Já liberado (ex.: visita anterior): não precisa mais contar o tempo. */
	unlocked: boolean;
	onUnlock: (reason: UnlockReason) => void;
}

export function VslPlayer({
	videoId,
	unlockAtSeconds,
	posterSrc,
	title,
	unlocked,
	onUnlock,
}: VslPlayerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const retryRef = useRef<HTMLButtonElement>(null);
	/** O foco estava na capa ao tocar: acompanha o player para não voltar ao topo da página. */
	const keepFocusRef = useRef(false);
	const playerRef = useRef<Player | null>(null);
	const iframeRef = useRef<HTMLIFrameElement | null>(null);
	const tickRef = useRef<number | null>(null);
	const lastTickAtRef = useRef(0);
	const loadTimeoutRef = useRef<number | null>(null);
	const failedRef = useRef(false);
	const creatingRef = useRef(false);
	/** A pessoa tocou na capa antes de o player ficar pronto: falha dele vira erro na tela. */
	const tappedRef = useRef(false);
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
	const unlockedRef = useRef(unlocked);
	const onUnlockRef = useRef(onUnlock);
	const [status, setStatus] = useState<Status>("idle");
	const [started, setStarted] = useState(false);

	useEffect(() => {
		unlockedRef.current = unlocked;
		onUnlockRef.current = onUnlock;
	});

	const clearLoadTimeout = useCallback(() => {
		if (loadTimeoutRef.current === null) return;
		window.clearTimeout(loadTimeoutRef.current);
		loadTimeoutRef.current = null;
	}, []);

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
			if (dueForReport(Date.now(), lastReportAtRef.current)) report();
		}, TICK_MS);
	}, [report, unlock, unlockAtSeconds]);

	/** Descarta o player atual (o iframe sai da página). */
	const discardPlayer = useCallback(() => {
		void playerRef.current?.destroy();
		playerRef.current = null;
		iframeRef.current = null;
	}, []);

	// Se o vídeo falhar, libera o botão para não travar o funil.
	const fail = useCallback(() => {
		failedRef.current = true;
		clearLoadTimeout();
		stopTicking();
		discardPlayer();
		setStatus("error");
		unlock("error");
	}, [clearLoadTimeout, discardPlayer, stopTicking, unlock]);

	useEffect(
		() => () => {
			clearLoadTimeout();
			stopTicking();
			void playerRef.current?.destroy();
			playerRef.current = null;
		},
		[clearLoadTimeout, stopTicking],
	);

	/**
	 * Falha antes de a pessoa tocar (pré-carregamento): descarta em silêncio e a capa volta a ser
	 * clicável, para o toque tentar de novo. Depois do toque ou com o vídeo já tocado: erro na tela.
	 */
	const handleFailure = useCallback(
		(player: Player) => {
			if (playerRef.current !== player) return;
			if (tappedRef.current || startedRef.current) {
				fail();
				return;
			}
			discardPlayer();
			setStatus("idle");
		},
		[discardPlayer, fail],
	);

	useEffect(() => {
		if (!keepFocusRef.current) return;
		if (status === "ready") {
			// Tocou na capa pelo teclado: o foco vai para o player, onde está o play do Vimeo.
			iframeRef.current?.focus({ preventScroll: true });
			keepFocusRef.current = false;
		} else if (status === "error") {
			retryRef.current?.focus({ preventScroll: true });
			keepFocusRef.current = false;
		}
	}, [status]);

	/**
	 * Cria o player uma única vez, embaixo da capa: no pré-carregamento (sem tocar) ou no toque na capa
	 * quando a página não pré-carrega (aí com autoplay, liberado pelo próprio toque).
	 */
	const createPlayer = useCallback(
		async (autoplay: boolean) => {
			if (playerRef.current || creatingRef.current) return;
			creatingRef.current = true;
			try {
				const VimeoPlayer = await loadVimeoPlayer();
				const container = containerRef.current;
				// A biblioteca pode chegar depois do limite: nesse caso o erro já foi mostrado.
				if (!container || failedRef.current || playerRef.current) return;

				// O iframe fica fora do controle do React.
				const iframe = document.createElement("iframe");
				iframe.src = vimeoEmbedUrl(videoId, { autoplay });
				iframe.title = `Vídeo: ${title}`;
				iframe.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
				container.replaceChildren(iframe);

				const player = new VimeoPlayer(iframe);
				playerRef.current = player;
				iframeRef.current = iframe;
				positionRef.current = null;

				player.on("timeupdate", ({ seconds, duration }) => {
					positionRef.current = seconds;
					if (seconds > maxPositionRef.current) maxPositionRef.current = seconds;
					if (duration > 0) durationRef.current = duration;
				});
				// Tocou no play do Vimeo: a capa sai da frente.
				player.on("play", () => {
					clearLoadTimeout();
					startedRef.current = true;
					setStarted(true);
					setStatus("ready");
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
					unlock("watched");
					report(true);
				});
				player.on("error", error => {
					// Erros de um comando (ex.: autoplay bloqueado) não derrubam o player.
					if (error.method) return;
					handleFailure(player);
				});
				// O vídeo já tem a legenda editada; a automática do Vimeo (que o iPhone pode ligar sozinho) duplicaria.
				player.on("texttrackchange", ({ kind }) => {
					if (kind) player.disableTextTrack().catch(() => {});
				});

				player
					.ready()
					.then(() => {
						if (playerRef.current !== player) return;
						clearLoadTimeout();
						player.disableTextTrack().catch(() => {});
						player
							.getVideoTitle()
							.then(t => {
								videoTitleRef.current = t || null;
							})
							.catch(() => {});
						setStatus(current => (current === "error" ? current : "ready"));
					})
					.catch(() => handleFailure(player));
			} catch {
				// Sem a biblioteca no pré-carregamento, o toque tenta de novo.
				if (tappedRef.current) fail();
			} finally {
				creatingRef.current = false;
			}
		},
		[clearLoadTimeout, fail, handleFailure, report, startTicking, stopTicking, title, unlock, videoId],
	);

	// Pré-carrega o player depois de a página abrir: o toque na capa já cai no play do Vimeo.
	useEffect(() => {
		if (!canPreloadPlayer()) return;
		return whenPageIdle(() => void createPlayer(false));
	}, [createPlayer]);

	/** Toque na capa antes de o player ficar pronto (ou sem pré-carregamento). */
	const start = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			if (status !== "idle") return;
			keepFocusRef.current = document.activeElement === event.currentTarget;
			tappedRef.current = true;
			setStatus("loading");
			loadTimeoutRef.current = window.setTimeout(fail, LOAD_TIMEOUT_MS);
			// Sem pré-carregamento, o player nasce tocando (o toque na página libera o som no Chrome).
			// Com pré-carregamento, só espera ficar pronto: o próximo toque cai no play do Vimeo.
			void createPlayer(!canPreloadPlayer());
		},
		[createPlayer, fail, status],
	);

	const warmUp = () => {
		preconnectVimeo();
		loadVimeoPlayer().catch(() => {});
	};

	return (
		<div className="w-full">
			<div
				className={`bg-ink shadow-brand-lg relative aspect-[9/16] w-full overflow-hidden rounded-[1.75rem] ${
					// Foco pelo teclado no play do Vimeo, embaixo da capa: o quadro mostra o anel.
					status === "ready" && !started ? "focus-within:ring-ring focus-within:ring-4" : ""
				}`}
			>
				{/* inert até o player ficar pronto: o pré-carregado fica fora do Tab e do leitor de tela. */}
				<div
					ref={containerRef}
					inert={status !== "ready"}
					className="absolute inset-0 [&_iframe]:size-full"
				/>

				{!started && status !== "error" ? (
					// Só imagem: com o player pronto, o toque atravessa a capa e cai no play do Vimeo,
					// que fica no centro, embaixo do play da capa.
					<div aria-hidden="true" className="pointer-events-none absolute inset-0">
						<Image
							src={posterSrc}
							alt=""
							fill
							preload
							fetchPriority="high"
							sizes="(min-width: 640px) 400px, 100vw"
							className="object-cover"
						/>
						<span className="bg-ink/15 absolute inset-0 grid place-items-center">
							<span className="text-ink shadow-brand-lg grid size-20 place-items-center rounded-full border-[3px] border-transparent [background:linear-gradient(#fff,#fff)_padding-box,var(--rainbow)_border-box]">
								{status === "loading" ? (
									<LoaderCircle className="size-8 animate-spin" />
								) : (
									<Play className="ml-1 size-8 fill-current" />
								)}
							</span>
						</span>
					</div>
				) : null}

				{status === "idle" || status === "loading" ? (
					<button
						type="button"
						onClick={start}
						onPointerEnter={preconnectVimeo}
						onPointerDown={warmUp}
						onFocus={preconnectVimeo}
						// aria-disabled (e não disabled): desabilitar um botão com foco joga o foco para o topo.
						aria-disabled={status === "loading"}
						aria-label={`Assistir ao vídeo: ${title}`}
						className="focus-visible:ring-ring absolute inset-0 cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-inset"
					/>
				) : null}

				{status === "error" ? (
					<div
						role="alert"
						className="bg-ink absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-white"
					>
						<p className="font-semibold">Não foi possível carregar o vídeo.</p>
						<button
							ref={retryRef}
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
