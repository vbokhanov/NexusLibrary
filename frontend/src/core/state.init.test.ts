import { describe, it, expect, beforeEach, vi } from "vitest";

describe("state — инициализация модуля (readUserId / readEmailFromToken / loadFavorites)", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it("некорректный userId при наличии токена → null", async () => {
    localStorage.setItem("token", "x");
    localStorage.setItem("role", "READER");
    localStorage.setItem("userId", "not-a-number");
    const { state } = await import("./state");
    expect(state.userId).toBeNull();
  });

  it("userId 0 при токене → null", async () => {
    localStorage.setItem("token", "x");
    localStorage.setItem("role", "READER");
    localStorage.setItem("userId", "0");
    const { state } = await import("./state");
    expect(state.userId).toBeNull();
  });

  it("валидный userId при токене", async () => {
    localStorage.setItem("token", "x");
    localStorage.setItem("role", "READER");
    localStorage.setItem("userId", "42");
    const { state } = await import("./state");
    expect(state.userId).toBe(42);
  });

  it("битый JWT в localStorage → пустой email", async () => {
    localStorage.setItem("token", "a.b!!!");
    const { state } = await import("./state");
    expect(state.userEmail).toBe("");
  });

  it("loadFavorites: битый JSON → []", async () => {
    localStorage.setItem("favorites:guest", "{not-json");
    const { loadFavoritesForSession } = await import("./state");
    expect(loadFavoritesForSession("", null)).toEqual([]);
  });

  it("loadFavorites: не массив → []", async () => {
    localStorage.setItem("favorites:guest", JSON.stringify({ a: 1 }));
    const { loadFavoritesForSession } = await import("./state");
    expect(loadFavoritesForSession("", null)).toEqual([]);
  });

  it("JWT с валидным payload — email из токена", async () => {
    const payload = btoa(JSON.stringify({ email: "fromjwt@example.com" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    localStorage.setItem("token", `h.${payload}.sig`);
    localStorage.removeItem("userEmail");
    const { state } = await import("./state");
    expect(state.userEmail).toBe("fromjwt@example.com");
  });

  it("JWT с битым JSON в payload — пустой email", async () => {
    const bad = btoa("not-json").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    localStorage.setItem("token", `h.${bad}.s`);
    const { state } = await import("./state");
    expect(state.userEmail).toBe("");
  });

  it("JWT JSON без email — пустая строка", async () => {
    const payload = btoa(JSON.stringify({ sub: "x" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    localStorage.setItem("token", `h.${payload}.s`);
    const { state } = await import("./state");
    expect(state.userEmail).toBe("");
  });
});
