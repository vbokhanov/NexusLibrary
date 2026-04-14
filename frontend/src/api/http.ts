const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export async function apiRequest(endpoint: string, options: RequestInit, token = "") {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }

  if (response.status === 204) return null;
  return response.json();
}
