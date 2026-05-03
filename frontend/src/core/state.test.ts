import { describe, it, expect, beforeEach, vi } from "vitest";

const store: Record<string, string> = {};

function mockLocalStorage() {
  vi.stubGlobal(
    "localStorage",
    {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      }
    } as Storage
  );
}

describe("state helpers (без полного перезапуска модуля state)", () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    mockLocalStorage();
  });

  it("loadFavoritesForSession — пустой массив по умолчанию", async () => {
    const { loadFavoritesForSession } = await import("./state");
    expect(loadFavoritesForSession("", null)).toEqual([]);
  });

  it("loadFavoritesForSession — читает JSON", async () => {
    const { loadFavoritesForSession, saveFavoritesForSession } = await import("./state");
    saveFavoritesForSession("t", 1, [1, 2, 3]);
    expect(loadFavoritesForSession("t", 1)).toEqual([1, 2, 3]);
  });
});
