"use client";

import type Player from "@vimeo/player";
import { LoaderCircle, Play, Volume2 } from "lucide-react";
import Image from "next/image";
import { type MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import {
	canPreloadPlayer,
	isAppleTouchDevice,
	loadVimeoPlayer,
	preconnectVimeo,
	vimeoEmbedUrl,
	whenPageIdle,
} from "@/lib/vimeo-player";
import { advanceWatchProgress, initialWatchProgress } from "@/lib/watch-progress";

const TICK_MS = 250;
/** Sem player pronto nesse tempo (rede travada, bloqueador), mostra o erro e libera o botão. */
const LOAD_TIMEOUT_MS = 15_000;
/** Play pedido e o vídeo não começou nesse tempo (ex.: iPhone bloqueia): mostra o play do próprio Vimeo. */
const PLAY_FALLBACK_MS = 2000;
/** Preparação no iPhone (play sem som escondido) que não começou nesse tempo: desiste e fica pausado. */
const PRIME_TIMEOUT_MS = 8000;

export type UnlockReason = "watched" | "error";

type Status = "idle" | "loading" | "ready" | "error";
/** "buffering": travou para baixar; mostra carregamento em vez do ícone de play. */
type Playback = "playing" | "buffering" | "paused";

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
	const frameRef = useRef<HTMLDivElement>(null);
	const overlayRef = useRef<HTMLButtonElement>(null);
	const retryRef = useRef<HTMLButtonElement>(null);
	/** O foco estava na capa ao dar play: acompanha o player para não voltar ao topo da página. */
	const keepFocusRef = useRef(false);
	const playerRef = useRef<Player | null>(null);
	const iframeRef = useRef<HTMLIFrameElement | null>(null);
	const tickRef = useRef<number | null>(null);
	const lastTickAtRef = useRef(0);
	const loadTimeoutRef = useRef<number | null>(null);
	const playFallbackRef = useRef<number | null>(null);
	const primeTimeoutRef = useRef<number | null>(null);
	/**
	 * iPhone: o player pré-carregado dá um play sem som, escondido atrás da capa, e pausa no 1º quadro.
	 * Com o vídeo já preparado, o toque na capa toca com som na hora (sem isso o 1º play sai mudo).
	 */
	const primingRef = useRef(false);
	const failedRef = useRef(false);
	/** A pessoa tocou na capa: o player toca assim que estiver pronto. */
	const wantsPlayRef = useRef(false);
	const playerReadyRef = useRef(false);
	const creatingRef = useRef(false);
	/** Plano B: player com os controles do próprio Vimeo (o navegador bloqueou o play com som). */
	const nativeControlsRef = useRef(false);
	/** O play já saiu sem som uma vez e a capa voltou pedindo outro toque ("Assistir com som"). */
	const soundRetryRef = useRef(false);
	/** O Vimeo aceitou o play (evento "play") ou está baixando: não está bloqueado, só lento. */
	const playAcceptedRef = useRef(false);
	const startedRef = useRef(false);
	const pausedRef = useRef(true);
	/** Posição do vídeo, do último evento "timeupdate" do Vimeo. */
	const positionRef = useRef<number | null>(null);
	const progressRef = useRef(initialWatchProgress);
	const unlockedRef = useRef(unlocked);
	const onUnlockRef = useRef(onUnlock);
	const [status, setStatus] = useState<Status>("idle");
	const [started, setStarted] = useState(false);
	const [playback, setPlayback] = useState<Playback>("paused");
	const [askSound, setAskSound] = useState(false);

	useEffect(() => {
		unlockedRef.current = unlocked;
		onUnlockRef.current = onUnlock;
	});

	const clearLoadTimeout = useCallback(() => {
		if (loadTimeoutRef.current === null) return;
		window.clearTimeout(loadTimeoutRef.current);
		loadTimeoutRef.current = null;
	}, []);

	const clearPlayFallback = useCallback(() => {
		if (playFallbackRef.current === null) return;
		window.clearTimeout(playFallbackRef.current);
		playFallbackRef.current = null;
	}, []);

	const clearPrimeTimeout = useCallback(() => {
		if (primeTimeoutRef.current === null) return;
		window.clearTimeout(primeTimeoutRef.current);
		primeTimeoutRef.current = null;
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

	const startTicking = useCallback(() => {
		if (tickRef.current !== null || unlockedRef.current) return;
		// Recomeça a cada play: o tempo pausado não entra no tempo real entre leituras.
		lastTickAtRef.current = performance.now();
		tickRef.current = window.setInterval(() => {
			const position = positionRef.current;
			if (position === null) return;
			const now = performance.now();
			const elapsedSeconds = (now - lastTickAtRef.current) / 1000;
			lastTickAtRef.current = now;
			progressRef.current = advanceWatchProgress(progressRef.current, position, elapsedSeconds);
			if (progressRef.current.watchedSeconds >= unlockAtSeconds) {
				stopTicking();
				unlock("watched");
			}
		}, TICK_MS);
	}, [stopTicking, unlock, unlockAtSeconds]);

	/** Descarta o player atual (o iframe sai da página). */
	const discardPlayer = useCallback(() => {
		clearPrimeTimeout();
		primingRef.current = false;
		void playerRef.current?.destroy();
		playerRef.current = null;
		iframeRef.current = null;
		playerReadyRef.current = false;
	}, [clearPrimeTimeout]);

	// Se o vídeo falhar, libera o botão para não travar o funil.
	const fail = useCallback(() => {
		failedRef.current = true;
		clearLoadTimeout();
		clearPlayFallback();
		stopTicking();
		discardPlayer();
		setStatus("error");
		unlock("error");
	}, [clearLoadTimeout, clearPlayFallback, discardPlayer, stopTicking, unlock]);

	useEffect(
		() => () => {
			clearLoadTimeout();
			clearPlayFallback();
			clearPrimeTimeout();
			stopTicking();
			void playerRef.current?.destroy();
			playerRef.current = null;
		},
		[clearLoadTimeout, clearPlayFallback, clearPrimeTimeout, stopTicking],
	);

	// As funções abaixo se chamam em ciclo (criar → tocar → plano B → criar); a ref quebra o ciclo.
	const createPlayerRef = useRef<(withControls?: boolean) => Promise<void>>(async () => {});

	/** Plano B: troca pelo player com o play do próprio Vimeo, para a pessoa tocar nele. */
	const showNativeControls = useCallback(() => {
		if (nativeControlsRef.current || startedRef.current || failedRef.current) return;
		nativeControlsRef.current = true;
		clearPlayFallback();
		discardPlayer();
		loadTimeoutRef.current = window.setTimeout(fail, LOAD_TIMEOUT_MS);
		void createPlayerRef.current(true);
	}, [clearPlayFallback, discardPlayer, fail]);

	/**
	 * O play saiu sem som ou foi recusado (iPhone: o toque veio antes de o player ficar pronto e a
	 * permissão de som expirou). Volta à capa com o player já pronto: o próximo toque toca com som na
	 * hora. Se acontecer de novo, vai para o plano B.
	 */
	const askForSound = useCallback(() => {
		const player = playerRef.current;
		if (!player || soundRetryRef.current) {
			showNativeControls();
			return;
		}
		soundRetryRef.current = true;
		clearPlayFallback();
		stopTicking();
		wantsPlayRef.current = false;
		playAcceptedRef.current = false;
		player.pause().catch(() => {});
		player.setMuted(false).catch(() => {});
		player.setVolume(1).catch(() => {});
		player.setCurrentTime(0).catch(() => {});
		setAskSound(true);
		setStatus("idle");
	}, [clearPlayFallback, showNativeControls, stopTicking]);

	/** Fim da preparação: volta ao início, pausado e com som, à espera do toque na capa. */
	const endPriming = useCallback(
		(player: Player) => {
			if (!primingRef.current) return;
			primingRef.current = false;
			clearPrimeTimeout();
			playAcceptedRef.current = false;
			// Pausa antes de ligar o som: o iPhone não deixa ligar o som de um vídeo tocando sem um toque.
			player.pause().catch(() => {});
			player.setMuted(false).catch(() => {});
			player.setVolume(1).catch(() => {});
			player.setCurrentTime(0).catch(() => {});
		},
		[clearPrimeTimeout],
	);

	const prime = useCallback(
		(player: Player) => {
			primingRef.current = true;
			primeTimeoutRef.current = window.setTimeout(() => endPriming(player), PRIME_TIMEOUT_MS);
			player.setMuted(true).catch(() => {});
			// Recusado (ex.: Modo de Pouca Energia): segue sem preparar; o toque na capa tenta mesmo assim.
			player.play().catch(() => endPriming(player));
		},
		[endPriming],
	);

	const play = useCallback(() => {
		const player = playerRef.current;
		if (!player) return;
		clearLoadTimeout();
		// Toque no meio da preparação: interrompe e toca do início, com som.
		endPriming(player);
		player.play().catch((error: Error) => {
			if (playerRef.current === player && error.name === "NotAllowedError") askForSound();
		});
		const requestedAt = performance.now();
		const revealIfBlocked = () => {
			playFallbackRef.current = null;
			if (startedRef.current) return;
			// Aceito mas ainda baixando (rede lenta), não bloqueado: a capa fica, com limite de tempo.
			if (playAcceptedRef.current && performance.now() - requestedAt < LOAD_TIMEOUT_MS) {
				playFallbackRef.current = window.setTimeout(revealIfBlocked, TICK_MS);
				return;
			}
			showNativeControls();
		};
		playFallbackRef.current = window.setTimeout(revealIfBlocked, PLAY_FALLBACK_MS);
	}, [askForSound, clearLoadTimeout, endPriming, showNativeControls]);

	useEffect(() => {
		if (!keepFocusRef.current) return;
		if (status === "ready" && started) {
			overlayRef.current?.focus({ preventScroll: true });
			keepFocusRef.current = false;
		} else if (status === "ready") {
			// Plano B: foco dentro do player, perto do play do Vimeo.
			(iframeRef.current ?? frameRef.current)?.focus({ preventScroll: true });
		} else if (status === "error") {
			retryRef.current?.focus({ preventScroll: true });
			keepFocusRef.current = false;
		}
	}, [status, started]);

	/**
	 * Cria o player uma única vez: no pré-carregamento (escondido atrás da capa, sem tocar),
	 * no toque (se o pré-carregamento não rodou ou falhou) ou no plano B, com os controles do Vimeo.
	 */
	const createPlayer = useCallback(
		async (withControls = false) => {
			if (playerRef.current || creatingRef.current) return;
			creatingRef.current = true;
			try {
				const VimeoPlayer = await loadVimeoPlayer();
				const container = containerRef.current;
				// A biblioteca pode chegar depois do limite: nesse caso o erro já foi mostrado.
				if (!container || failedRef.current || playerRef.current) return;

				// O iframe fica fora do controle do React.
				const iframe = document.createElement("iframe");
				iframe.src = vimeoEmbedUrl(videoId, { controls: withControls });
				iframe.title = `Vídeo: ${title}`;
				iframe.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
				container.replaceChildren(iframe);

				const player = new VimeoPlayer(iframe);
				playerRef.current = player;
				iframeRef.current = iframe;
				positionRef.current = null;
				playAcceptedRef.current = false;

				player.on("timeupdate", ({ seconds }) => {
					positionRef.current = seconds;
				});
				player.on("play", () => {
					if (!primingRef.current) playAcceptedRef.current = true;
				});
				const markPlaying = () => {
					clearPlayFallback();
					pausedRef.current = false;
					startedRef.current = true;
					// Só depois de começar: fora da ordem do Tab. Antes disso (plano B) o iframe precisa ser
					// alcançável, porque o play é o botão do próprio Vimeo.
					iframe.tabIndex = -1;
					setPlayback("playing");
					setStatus("ready");
					setStarted(true);
					startTicking();
				};
				player.on("playing", () => {
					if (primingRef.current) {
						endPriming(player);
						return;
					}
					if (startedRef.current || nativeControlsRef.current) {
						markPlaying();
						return;
					}
					// iPhone: o play pedido pela página pode ser aceito sem som (o Vimeo toca mudo em vez de
					// recusar). Mudo no primeiro play: volta à capa pedindo outro toque, que toca com som.
					Promise.all([player.getMuted(), player.getVolume()])
						.then(([muted, volume]) => {
							if (playerRef.current !== player) return;
							if (muted || volume === 0) askForSound();
							else markPlaying();
						})
						.catch(() => {
							if (playerRef.current === player) markPlaying();
						});
				});
				player.on("bufferstart", () => {
					if (primingRef.current) return;
					playAcceptedRef.current = true;
					setPlayback("buffering");
					stopTicking();
				});
				player.on("bufferend", () => {
					if (!startedRef.current || pausedRef.current) return;
					setPlayback("playing");
					startTicking();
				});
				player.on("pause", () => {
					pausedRef.current = true;
					setPlayback("paused");
					stopTicking();
				});
				player.on("ended", () => {
					pausedRef.current = true;
					setPlayback("paused");
					stopTicking();
					// Assistiu até o fim: libera mesmo que o vídeo seja mais curto que unlockAtSeconds.
					unlock("watched");
				});
				player.on("error", error => {
					// Erros de um comando (ex.: play bloqueado) são tratados em quem o chamou.
					if (error.method) return;
					if (wantsPlayRef.current) {
						fail();
						return;
					}
					// Falhou no pré-carregamento: descarta em silêncio; o toque tenta de novo.
					if (playerRef.current === player) discardPlayer();
				});
				// O vídeo já tem a legenda editada; a automática do Vimeo (que o iPhone pode ligar sozinho) duplicaria.
				player.on("texttrackchange", ({ kind }) => {
					if (kind) player.disableTextTrack().catch(() => {});
				});

				player
					.ready()
					.then(() => {
						if (playerRef.current !== player) return;
						player.disableTextTrack().catch(() => {});
						playerReadyRef.current = true;
						if (!wantsPlayRef.current) {
							if (!withControls && isAppleTouchDevice()) prime(player);
							return;
						}
						if (!nativeControlsRef.current) {
							play();
							return;
						}
						// Plano B: mostra o player e deixa o play para o toque da pessoa. Um play pedido pela página
						// poderia tocar mudo de novo, com a nossa camada por cima dos controles do Vimeo.
						clearLoadTimeout();
						setStatus(current => (current === "loading" ? "ready" : current));
					})
					.catch(() => {
						if (playerRef.current !== player) return;
						if (wantsPlayRef.current) fail();
						else discardPlayer();
					});
			} catch {
				// Sem a biblioteca no pré-carregamento, o toque tenta de novo.
				if (wantsPlayRef.current) fail();
			} finally {
				creatingRef.current = false;
			}
		},
		[
			askForSound,
			clearLoadTimeout,
			clearPlayFallback,
			discardPlayer,
			endPriming,
			fail,
			play,
			prime,
			startTicking,
			stopTicking,
			title,
			unlock,
			videoId,
		],
	);

	useEffect(() => {
		createPlayerRef.current = createPlayer;
	}, [createPlayer]);

	// Pré-carrega o player depois de a página abrir: no toque, o vídeo começa quase na hora.
	useEffect(() => {
		if (!canPreloadPlayer()) return;
		return whenPageIdle(() => {
			// Já liberado em visita anterior: o mais provável é ir direto ao botão; economiza os dados.
			if (!unlockedRef.current) void createPlayer();
		});
	}, [createPlayer]);

	const start = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			if (status !== "idle") return;
			keepFocusRef.current = document.activeElement === event.currentTarget;
			wantsPlayRef.current = true;
			setStatus("loading");
			loadTimeoutRef.current = window.setTimeout(fail, LOAD_TIMEOUT_MS);
			// Pronto: toca já. Ainda carregando: toca quando ficar pronto. Sem player: cria agora.
			if (playerReadyRef.current) play();
			else void createPlayer();
		},
		[createPlayer, fail, play, status],
	);

	const togglePlayback = () => {
		const player = playerRef.current;
		if (!player) return;
		if (playback === "paused") player.play().catch(() => {});
		else player.pause().catch(() => {});
	};

	const warmUp = () => {
		preconnectVimeo();
		loadVimeoPlayer().catch(() => {});
	};

	return (
		<div className="w-full">
			<div
				ref={frameRef}
				tabIndex={-1}
				className="bg-ink shadow-brand-lg relative aspect-[9/16] w-full overflow-hidden rounded-[1.75rem] outline-none"
			>
				{/* inert enquanto a capa está por cima: o player pré-carregado fica fora do Tab e do leitor de tela. */}
				<div
					ref={containerRef}
					inert={status === "idle" || status === "loading"}
					className="absolute inset-0 [&_iframe]:size-full"
				/>

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

				{status === "idle" || status === "loading" ? (
					<button
						type="button"
						onClick={start}
						onPointerEnter={preconnectVimeo}
						onPointerDown={warmUp}
						onFocus={preconnectVimeo}
						// aria-disabled (e não disabled): desabilitar um botão com foco joga o foco para o topo.
						aria-disabled={status === "loading"}
						aria-label={`Assistir ao vídeo${askSound ? " com som" : ""}: ${title}`}
						className="group focus-visible:ring-ring absolute inset-0 cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-inset"
					>
						<Image
							src={posterSrc}
							alt=""
							fill
							preload
							fetchPriority="high"
							sizes="(min-width: 640px) 400px, 100vw"
							className="object-cover"
						/>
						<span className="bg-ink/15 group-hover:bg-ink/5 absolute inset-0 flex flex-col items-center justify-center gap-3 transition-colors">
							<span className="text-ink shadow-brand-lg grid size-20 place-items-center rounded-full border-[3px] border-transparent transition-transform [background:linear-gradient(#fff,#fff)_padding-box,var(--rainbow)_border-box] group-hover:scale-105 motion-reduce:transition-none">
								{status === "loading" ? (
									<LoaderCircle aria-hidden="true" className="size-8 animate-spin" />
								) : (
									<Play aria-hidden="true" className="ml-1 size-8 fill-current" />
								)}
							</span>
							{askSound && status === "idle" ? (
								<span className="text-ink shadow-brand-lg inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold">
									<Volume2 aria-hidden="true" className="size-4" />
									Assistir com som
								</span>
							) : null}
						</span>
					</button>
				) : null}

				{status === "ready" && started ? (
					<button
						ref={overlayRef}
						type="button"
						onClick={togglePlayback}
						aria-label={playback === "paused" ? "Continuar vídeo" : "Pausar vídeo"}
						className="focus-visible:ring-ring absolute inset-0 grid cursor-pointer place-items-center outline-none focus-visible:ring-4 focus-visible:ring-inset"
					>
						{playback === "paused" ? (
							<span className="text-ink shadow-brand-lg grid size-20 place-items-center rounded-full bg-white/95">
								<Play aria-hidden="true" className="ml-1 size-8 fill-current" />
							</span>
						) : null}
						{playback === "buffering" ? (
							<span className="bg-ink/60 grid size-16 place-items-center rounded-full text-white">
								<LoaderCircle aria-hidden="true" className="size-8 animate-spin" />
							</span>
						) : null}
					</button>
				) : null}
			</div>

			<noscript>
				<p className="mt-3 text-sm font-semibold">Ative o JavaScript para assistir ao vídeo.</p>
			</noscript>
		</div>
	);
}
