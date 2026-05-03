import { describe, it, expect, vi, afterEach } from "vitest";
import { apiRequest, bookTextUrl, bookCoverUrl } from "./http";

describe("bookTextUrl / bookCoverUrl", () => {
  it("формируют URL относительно API", () => {
    expect(bookTextUrl(7, false)).toMatch(/\/books\/7\/text$/);
    expect(bookTextUrl(7, true)).toContain("download=1");
    expect(bookCoverUrl(3)).toMatch(/\/books\/3\/cover$/);
  });
});

describe("apiRequest", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("парсит JSON при 200", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true })
    });
    const data = await apiRequest("/health", { method: "GET" }, "");
    expect(data).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalled();
  });

  it("возвращает null при 204", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      text: async () => ""
    });
    const data = await apiRequest("/x", { method: "DELETE" }, "tok");
    expect(data).toBeNull();
  });

  it("пробрасывает ошибку с телом при 4xx", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ message: "Bad" })
    });
    await expect(apiRequest("/auth/login", { method: "POST", body: "{}" }, "")).rejects.toThrow();
  });

  it("GET: повтор при TypeError Failed to fetch, затем успех", async () => {
    vi.useFakeTimers();
    const err = Object.assign(new TypeError("Failed to fetch"), { name: "TypeError" });
    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: 1 })
      });
    const p = apiRequest("/health", { method: "GET" }, "");
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toEqual({ ok: 1 });
    expect(fetch).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("GET: Load failed / NetworkError / Network request failed — transient", async () => {
    vi.useFakeTimers();
    for (const msg of ["Load failed", "NetworkError", "Network request failed"]) {
      const e = Object.assign(new TypeError(msg), { name: "TypeError" });
      globalThis.fetch = vi.fn().mockRejectedValueOnce(e).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({})
      });
      const p = apiRequest(`/h-${msg}`, { method: "GET" }, "");
      await vi.advanceTimersByTimeAsync(500);
      await p;
    }
    vi.useRealTimers();
  });

  it("POST: без повторов при сетевой ошибке", async () => {
    const err = Object.assign(new TypeError("Failed to fetch"), { name: "TypeError" });
    globalThis.fetch = vi.fn().mockRejectedValue(err);
    await expect(apiRequest("/x", { method: "POST", body: "{}" }, "")).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("GET: reject примитив — не transient, без повтора", async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(42);
    await expect(apiRequest("/z", { method: "GET" }, "")).rejects.toBe(42);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("GET: TypeError по имени не срабатывает как transient", async () => {
    const err = Object.assign(new Error("Failed to fetch"), { name: "Error" });
    globalThis.fetch = vi.fn().mockRejectedValueOnce(err);
    await expect(apiRequest("/q", { method: "GET" }, "")).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("HEAD: повтор transient", async () => {
    vi.useFakeTimers();
    const err = Object.assign(new TypeError("Failed to fetch"), { name: "TypeError" });
    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ h: 1 }) });
    const p = apiRequest("/h", { method: "HEAD" }, "");
    await vi.advanceTimersByTimeAsync(400);
    await expect(p).resolves.toEqual({ h: 1 });
    vi.useRealTimers();
  });
});
