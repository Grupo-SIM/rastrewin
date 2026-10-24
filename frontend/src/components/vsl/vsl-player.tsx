"use client";

import { LoaderCircle, Play } from "lucide-react";
import Image from "next/image";
import { type MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { advanceWatchProgress, initialWatchProgress } from "@/lib/watch-progress";
import { loadYouTubeApi, preconnectYouTube, YOUTUBE_EMBED_HOST } from "@/lib/youtube-api";

const TICK_MS = 250;
/** Sem player pronto nesse tempo (rede travada, bloqueador), mostra o erro e libera o botão. */
const LOAD_TIMEOUT_MS = 15_000;

export type UnlockReason = "watched" | "error";

type Status = "idle" | "loading" | "ready" | "error";

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
  const loadTimeoutRef = useRef<number | null>(null);
  const failedRef = useRef(false);
  const progressRef = useRef(initialWatchProgress);
  const unlockedRef = useRef(unlocked);
  const onUnlockRef = useRef(onUnlock);
  const [status, setStatus] = useState<Status>("idle");
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);

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

  const startTicking = useCallback(() => {
    if (tickRef.current !== null || unlockedRef.current) return;
    tickRef.current = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      progressRef.current = advanceWatchProgress(progressRef.current, player.getCurrentTime());
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
    stopTicking();
    playerRef.current?.destroy();
    playerRef.current = null;
    setStatus("error");
    unlock("error");
  }, [clearLoadTimeout, stopTicking, unlock]);

  useEffect(
    () => () => {
      clearLoadTimeout();
      stopTicking();
      playerRef.current?.destroy();
      playerRef.current = null;
    },
    [clearLoadTimeout, stopTicking],
  );

  useEffect(() => {
    if (!keepFocusRef.current) return;
    if (status === "ready" && started) {
      overlayRef.current?.focus({ preventScroll: true });
      keepFocusRef.current = false;
    } else if (status === "ready") {
      frameRef.current?.focus({ preventScroll: true });
    } else if (status === "error") {
      errorLinkRef.current?.focus({ preventScroll: true });
      keepFocusRef.current = false;
    }
  }, [status, started]);

  const start = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      if (status !== "idle") return;
      keepFocusRef.current = document.activeElement === event.currentTarget;
      setStatus("loading");
      loadTimeoutRef.current = window.setTimeout(fail, LOAD_TIMEOUT_MS);

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
            autoplay: 1,
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
              clearLoadTimeout();
              event.target.getIframe().title = `Vídeo: ${title}`;
              event.target.playVideo();
              setStatus("ready");
            },
            onStateChange: (event) => {
              const isPlaying = event.data === api.PlayerState.PLAYING;
              setPlaying(isPlaying);
              if (isPlaying) {
                setStarted(true);
                startTicking();
              } else {
                stopTicking();
              }
              // Assistiu até o fim: libera mesmo que o vídeo seja mais curto que unlockAtSeconds.
              if (event.data === api.PlayerState.ENDED) unlock("watched");
            },
            onError: fail,
          },
        });
      } catch {
        fail();
      }
    },
    [clearLoadTimeout, fail, startTicking, status, stopTicking, title, unlock, youtubeId],
  );

  const togglePlayback = () => {
    const player = playerRef.current;
    if (!player) return;
    if (playing) player.pauseVideo();
    else player.playVideo();
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
        <div ref={containerRef} className="absolute inset-0 [&_iframe]:size-full" />

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
            aria-label={playing ? "Pausar vídeo" : "Continuar vídeo"}
            className="absolute inset-0 grid cursor-pointer place-items-center outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-inset"
          >
            {playing ? null : (
              <span className="grid size-20 place-items-center rounded-full bg-white/95 text-ink shadow-brand-lg">
                <Play aria-hidden="true" className="ml-1 size-8 fill-current" />
              </span>
            )}
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
