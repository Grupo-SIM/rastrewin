/**
 * Lembra no navegador que a pessoa já liberou o botão, para mostrá-lo direto na próxima visita.
 * A chave inclui o ID do vídeo: trocar o vídeo volta a exigir que ele seja assistido.
 * Qualquer falha (aba anônima, storage bloqueado) só faz o botão não ser lembrado.
 */

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

export const unlockStorageKey = (videoId: string) => `rw-vsl:v1:${videoId}`;

function browserStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readUnlocked(videoId: string, storage = browserStorage()): boolean {
  try {
    return storage?.getItem(unlockStorageKey(videoId)) === "1";
  } catch {
    return false;
  }
}

export function saveUnlocked(videoId: string, storage = browserStorage()): void {
  try {
    storage?.setItem(unlockStorageKey(videoId), "1");
  } catch {
    // Sem storage disponível: o botão só não será lembrado.
  }
}
