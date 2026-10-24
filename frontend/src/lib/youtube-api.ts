declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YOUTUBE_API_SRC = "https://www.youtube.com/iframe_api";
export const YOUTUBE_EMBED_HOST = "https://www.youtube-nocookie.com";

const PRECONNECT_ORIGINS = ["https://www.youtube.com", YOUTUBE_EMBED_HOST, "https://i.ytimg.com"];

let preconnected = false;

/** Abre as conexões com o YouTube antes do clique (quando o dedo/mouse chega na capa). */
export function preconnectYouTube() {
  if (preconnected) return;
  preconnected = true;
  for (const href of PRECONNECT_ORIGINS) {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    document.head.append(link);
  }
}

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

/** Economia de dados ligada ou rede 2G: não pré-carrega o player (carrega só no toque). */
export function canPreloadPlayer(): boolean {
  const { connection } = navigator as Navigator & { connection?: NetworkInformation };
  if (!connection) return true;
  return (
    !connection.saveData &&
    connection.effectiveType !== "2g" &&
    connection.effectiveType !== "slow-2g"
  );
}

/**
 * Roda `callback` depois de a página terminar de abrir e o navegador ficar ocioso,
 * para o pré-carregamento não disputar banda nem CPU com título, capa e fontes. Devolve o cancelamento.
 */
export function whenPageIdle(callback: () => void): () => void {
  let idleId: number | null = null;
  let timeoutId: number | null = null;
  const schedule = () => {
    // Safari não tem requestIdleCallback.
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(callback, { timeout: 2000 });
    } else {
      timeoutId = window.setTimeout(callback, 200);
    }
  };

  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });

  return () => {
    window.removeEventListener("load", schedule);
    if (idleId !== null) window.cancelIdleCallback(idleId);
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  };
}

let apiPromise: Promise<typeof YT> | null = null;

/** Carrega a IFrame API uma única vez (no pré-carregamento do player ou no toque). */
export function loadYouTubeApi(): Promise<typeof YT> {
  if (window.YT?.Player) return Promise.resolve(window.YT);

  apiPromise ??= new Promise<typeof YT>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve(window.YT);
    };

    const script = document.createElement("script");
    script.src = YOUTUBE_API_SRC;
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      script.remove();
      reject(new Error("Falha ao carregar a API do YouTube."));
    };
    document.head.append(script);
  });

  return apiPromise;
}
