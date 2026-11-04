import { describe, expect, it } from "vitest";
import { readUnlocked, saveUnlocked, unlockStorageKey } from "./unlock-storage";

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
};

const brokenStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("unlock-storage", () => {
  it("lembra a liberação do mesmo vídeo", () => {
    const storage = memoryStorage();
    expect(readUnlocked("abcDEF12_-3", storage)).toBe(false);
    saveUnlocked("abcDEF12_-3", storage);
    expect(readUnlocked("abcDEF12_-3", storage)).toBe(true);
  });

  it("trocar o vídeo volta a exigir que ele seja assistido", () => {
    const storage = memoryStorage();
    saveUnlocked("abcDEF12_-3", storage);
    expect(readUnlocked("zzzzzzzzzzz", storage)).toBe(false);
  });

  it("ignora valores diferentes do esperado", () => {
    const storage = memoryStorage();
    storage.setItem(unlockStorageKey("abcDEF12_-3"), "true");
    expect(readUnlocked("abcDEF12_-3", storage)).toBe(false);
  });

  it("não quebra sem storage ou com storage bloqueado", () => {
    expect(readUnlocked("abcDEF12_-3", null)).toBe(false);
    expect(readUnlocked("abcDEF12_-3", brokenStorage)).toBe(false);
    expect(() => saveUnlocked("abcDEF12_-3", brokenStorage)).not.toThrow();
  });

  it("não quebra fora do navegador (sem window)", () => {
    expect(readUnlocked("abcDEF12_-3")).toBe(false);
    expect(() => saveUnlocked("abcDEF12_-3")).not.toThrow();
  });
});
