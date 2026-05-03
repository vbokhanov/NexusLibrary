import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchBookPlainText } from "./http";

describe("fetchBookPlainText", () => {
  const orig = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = orig;
    vi.restoreAllMocks();
  });

  it("успех при первом ответе", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "plain"
    });
    const t = await fetchBookPlainText(1);
    expect(t).toBe("plain");
  });

  it("504 затем успех", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 504,
        text: async () => "wait"
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "ok"
      });
    vi.useFakeTimers();
    const p = fetchBookPlainText(1);
    await vi.advanceTimersByTimeAsync(950);
    const t = await p;
    vi.useRealTimers();
    expect(t).toBe("ok");
  });
});
