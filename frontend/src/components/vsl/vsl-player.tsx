"use client";

import { LoaderCircle, Play } from "lucide-react";
import Image from "next/image";
import { type MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { advanceWatchProgress, initialWatchProgress } from "@/lib/watch-progress";
import {
  canPreloadPlayer,
  loadYouTubeApi,
  preconnectYouTube,
  whenPageIdle,
  YOUTUBE_EMBED_HOST,
} from "@/lib/youtube-api";

const TICK_MS = 250;
/** Sem player pronto nesse tempo (rede travada, bloqueador), mostra o erro e libera o botão. */
const LOAD_TIMEOUT_MS = 15_000;
/** Play pedido e o vídeo não começou nesse tempo (ex.: iPhone bloqueia): mostra o play do próprio YouTube. */
const PLAY_FALLBACK_MS = 2000;

export type UnlockReason = "watched" | "error";

type Status = "idle" | "loading" | "ready" | "error";
/** "buffering": travou para baixar; mostra carregamento em vez do ícone de play. */
type Playback = "playing" | "buffering" | "paused";

type VslPlayerProps = {
  youtubeId: string;
  unlockAtSeconds: number;
  posterSrc: string;
  title: string;
  /** Já liberado (ex.: visita anterior): não precisa mais contar o tempo. */
  unlocked: boolean;
  onUnlock: (reason: UnlockReason) => void;
};

export function VslPlayer({
  youtubeId,
  unlockAtSeconds,
  posterSrc,
  title,
  unlocked,
  onUnlock,
}: VslPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLButtonElement>(null);
  const errorLinkRef = useRef<HTMLAnchorElement>(null);
  /** O foco estava na capa ao dar play: acompanha o player para não voltar ao topo da página. */
  const keepFocusRef = useRef(false);
  const playerRef = useRef<YT.Player | null>(null);
  const tickRef = useRef<number | null>(null);
  const lastTickAtRef = useRef(0);
  const loadTimeoutRef = useRef<number | null>(null);
  const playFallbackRef = useRef<number | null>(null);
  const failedRef = useRef(false);
  /** A pessoa tocou na capa: o player toca assim que estiver pronto. */
  const wantsPlayRef = useRef(false);
  const playerReadyRef = useRef(false);
  const creatingRef = useRef(false);
  const progressRef = useRef(initialWatchProgress);
  const unlockedRef = useRef(unlocked);
  const onUnlockRef = useRef(onUnlock);
  const [status, setStatus] = useState<Status>("idle");
  const [started, setStarted] = useState(false);
  const [playback, setPlayback] = useState<Playback>("paused");

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
      const player = playerRef.current;
      if (!player) return;
      const now = performance.now();
      const elapsedSeconds = (now - lastTickAtRef.current) / 1000;
      lastTickAtRef.current = now;
      progressRef.current = advanceWatchProgress(
        progressRef.current,
        player.getCurrentTime(),
        elapsedSeconds,
      );
      if (progressRef.current.watchedSeconds >= unlockAtSeconds) {
        stopTicking();
        unlock("watched");
      }
    }, TICK_MS);
  }, [stopTicking, unlock, unlockAtSeconds]);

  // Se o vídeo falhar, libera o botão para não travar o funil.
  const fail = useCallback(() => {
    failedRef.current = true;
    clearLoadTimeout();
    clearPlayFallback();
    stopTicking();
    playerRef.current?.destroy();
    playerRef.current = null;
    setStatus("error");
    unlock("error");
  }, [clearLoadTimeout, clearPlayFallback, stopTicking, unlock]);

  useEffect(
    () => () => {
      clearLoadTimeout();
      clearPlayFallback();
      stopTicking();
      playerRef.current?.destroy();
      playerRef.current = null;
    },
    [clearLoadTimeout, clearPlayFallback, stopTicking],
  );

  const play = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    clearLoadTimeout();
    player.playVideo();
    playFallbackRef.current = window.setTimeout(() => {
      playFallbackRef.current = null;
      setStatus((current) => (current === "loading" ? "ready" : current));
    }, PLAY_FALLBACK_MS);
  }, [clearLoadTimeout]);

  useEffect(() => {
    if (!keepFocusRef.current) return;
    if (status === "ready" && started) {
      overlayRef.current?.focus({ preventScroll: true });
      keepFocusRef.current = false;
    } else if (status === "ready") {
      // Autoplay ainda não começou (ou foi bloqueado): foco dentro do player, perto do play do YouTube.
      (playerRef.current?.getIframe() ?? frameRef.current)?.focus({ preventScroll: true });
    } else if (status === "error") {
      errorLinkRef.current?.focus({ preventScroll: true });
      keepFocusRef.current = false;
    }
  }, [status, started]);

  /**
   * Cria o player uma única vez: no pré-carregamento (escondido atrás da capa, sem tocar)
   * ou no toque, se o pré-carregamento não rodou ou falhou.
   */
  const createPlayer = useCallback(async () => {
    if (playerRef.current || creatingRef.current) return;
    creatingRef.current = true;
    try {
      const api = await loadYouTubeApi();
      const container = containerRef.current;
      // A API pode chegar depois do limite: nesse caso o erro já foi mostrado.
      if (!container || failedRef.current) return;

      // O YouTube troca este elemento por um iframe; ele fica fora do controle do React.
      const mount = document.createElement("div");
      container.replaceChildren(mount);

      playerRef.current = new api.Player(mount, {
        host: YOUTUBE_EMBED_HOST,
        videoId: youtubeId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: wantsPlayRef.current ? 1 : 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          // Sem origin explícito, os eventos do player não chegam quando o host é youtube-nocookie.
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            playerReadyRef.current = true;
            event.target.getIframe().title = `Vídeo: ${title}`;
            if (wantsPlayRef.current) play();
          },
          onStateChange: (event) => {
            const { PLAYING, BUFFERING, ENDED } = api.PlayerState;
            const isPlaying = event.data === PLAYING;
            setPlayback(isPlaying ? "playing" : event.data === BUFFERING ? "buffering" : "paused");
            if (isPlaying) {
              clearPlayFallback();
              // Só depois de começar: fora da ordem do Tab, para os links do YouTube (título, canal)
              // não tirarem a pessoa do funil. Antes disso o iframe precisa ser alcançável, porque
              // com autoplay bloqueado o play é o botão do próprio YouTube.
              event.target.getIframe().tabIndex = -1;
              setStatus("ready");
              setStarted(true);
              startTicking();
            } else {
              stopTicking();
            }
            // Assistiu até o fim: libera mesmo que o vídeo seja mais curto que unlockAtSeconds.
            if (event.data === ENDED) unlock("watched");
          },
          onError: () => {
            if (wantsPlayRef.current) {
              fail();
              return;
            }
            // Falhou no pré-carregamento: descarta em silêncio; o toque tenta de novo.
            playerRef.current?.destroy();
            playerRef.current = null;
            playerReadyRef.current = false;
          },
        },
      });
    } catch {
      // Sem a API no pré-carregamento, o toque tenta de novo.
      if (wantsPlayRef.current) fail();
    } finally {
      creatingRef.current = false;
    }
  }, [clearPlayFallback, fail, play, startTicking, stopTicking, title, unlock, youtubeId]);

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
      // Pronto: toca já. Ainda carregando: toca no onReady. Sem player: cria agora.
      if (playerReadyRef.current) play();
      else void createPlayer();
    },
    [createPlayer, fail, play, status],
  );

  const togglePlayback = () => {
    const player = playerRef.current;
    if (!player) return;
    if (playback === "paused") player.playVideo();
    else player.pauseVideo();
  };

  const warmUp = () => {
    preconnectYouTube();
    loadYouTubeApi().catch(() => {});
  };

  const watchOnYouTube = `https://www.youtube.com/watch?v=${youtubeId}`;

  return (
    <div className="w-full">
      <div
        ref={frameRef}
        tabIndex={-1}
        className="relative aspect-[9/16] w-full overflow-hidden rounded-[1.75rem] bg-ink shadow-brand-lg outline-none"
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
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink p-6 text-white"
          >
            <p className="font-semibold">Não foi possível carregar o vídeo.</p>
            <a
              ref={errorLinkRef}
              href={watchOnYouTube}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink outline-offset-4 focus-visible:outline-2 focus-visible:outline-white"
            >
              Assistir no YouTube
            </a>
          </div>
        ) : null}

        {status === "idle" || status === "loading" ? (
          <button
            type="button"
            onClick={start}
            onPointerEnter={preconnectYouTube}
            onPointerDown={warmUp}
            onFocus={preconnectYouTube}
            // aria-disabled (e não disabled): desabilitar um botão com foco joga o foco para o topo.
            aria-disabled={status === "loading"}
            aria-label={`Assistir ao vídeo: ${title}`}
            className="group absolute inset-0 cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-inset"
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
            <span className="absolute inset-0 grid place-items-center bg-ink/15 transition-colors group-hover:bg-ink/5">
              <span className="grid size-20 place-items-center rounded-full border-[3px] border-transparent text-ink shadow-brand-lg transition-transform [background:linear-gradient(#fff,#fff)_padding-box,var(--rainbow)_border-box] group-hover:scale-105 motion-reduce:transition-none">
                {status === "loading" ? (
                  <LoaderCircle aria-hidden="true" className="size-8 animate-spin" />
                ) : (
                  <Play aria-hidden="true" className="ml-1 size-8 fill-current" />
                )}
              </span>
            </span>
          </button>
        ) : null}

        {status === "ready" && started ? (
          <button
            ref={overlayRef}
            type="button"
            onClick={togglePlayback}
            aria-label={playback === "paused" ? "Continuar vídeo" : "Pausar vídeo"}
            className="absolute inset-0 grid cursor-pointer place-items-center outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-inset"
          >
            {playback === "paused" ? (
              <span className="grid size-20 place-items-center rounded-full bg-white/95 text-ink shadow-brand-lg">
                <Play aria-hidden="true" className="ml-1 size-8 fill-current" />
              </span>
            ) : null}
            {playback === "buffering" ? (
              <span className="grid size-16 place-items-center rounded-full bg-ink/60 text-white">
                <LoaderCircle aria-hidden="true" className="size-8 animate-spin" />
              </span>
            ) : null}
          </button>
        ) : null}
      </div>

      <noscript>
        <a href={watchOnYouTube} className="mt-3 inline-block text-sm font-semibold underline">
          Assistir no YouTube
        </a>
      </noscript>
    </div>
  );
}
