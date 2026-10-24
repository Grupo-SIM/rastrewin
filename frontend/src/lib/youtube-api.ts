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

let apiPromise: Promise<typeof YT> | null = null;

/** Carrega a IFrame API uma única vez. Só é chamada depois de a pessoa tocar no vídeo. */
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
