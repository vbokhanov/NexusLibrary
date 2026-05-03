const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function requestMethodUpper(options: RequestInit) {
  return String(options?.method || "GET").toUpperCase();
}

/** Повтор только для безопасных методов: после перезапуска API первый fetch часто падает, пока порт не готов. */
function shouldRetryTransientOnMethod(method: string) {
  return method === "GET" || method === "HEAD";
}

function isTransientNetworkFailure(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const name = String((err as Error).name || "");
  const msg = String((err as Error).message || "");
  if (name !== "TypeError") return false;
  return (
    msg.includes("Failed to fetch") ||
    msg.includes("Load failed") ||
    msg.includes("NetworkError") ||
    msg.includes("Network request failed")
  );
}

async function doFetch(endpoint: string, options: RequestInit, token: string) {
  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
}

export async function apiRequest(endpoint: string, options: RequestInit, token = "") {
  const method = requestMethodUpper(options);
  const maxAttempts = shouldRetryTransientOnMethod(method) ? 3 : 1;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await doFetch(endpoint, options, token);

      if (!response.ok) {
        const text = await response.text();
        const error = new Error(text || "Request failed");
        // @ts-ignore status is attached for consumers in plain JS mode
        error.status = response.status;
        throw error;
      }

      if (response.status === 204) return null;
      return response.json();
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts - 1 && isTransientNetworkFailure(e)) {
        await sleep(280 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

export function bookTextUrl(bookId: number, download: boolean) {
  return `${API_BASE}/books/${bookId}/text${download ? "?download=1" : ""}`;
}

/** Обложка через API: браузер не ходит на сторонний домен (лучше для инкогнито / блокировок). */
export function bookCoverUrl(bookId: number) {
  return `${API_BASE}/books/${bookId}/cover`;
}

export async function fetchBookPlainText(bookId: number) {
  const url = bookTextUrl(bookId, false);
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(url);
    if (response.ok) return response.text();
    const text = await response.text();
    if (response.status === 504 && attempt === 0) {
      await sleep(900);
      continue;
    }
    throw new Error(text || "Не удалось загрузить текст");
  }
  throw new Error("Не удалось загрузить текст");
}
