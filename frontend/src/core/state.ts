// @ts-nocheck
export const ROLE_LABELS = {
  ADMIN: "Администратор",
  LIBRARIAN: "Библиотекарь",
  READER: "Читатель",
  GUEST: "Гость"
};

export const state = {
  token: localStorage.getItem("token") || "",
  role: localStorage.getItem("role") || "GUEST",
  books: [],
  search: "",
  genreFilter: "all",
  sortBy: "newest",
  editingId: null,
  authTab: "login",
  coverDraft: "",
  favorites: JSON.parse(localStorage.getItem("favorites") || "[]")
};

export function getCurrentPath() {
  const path = location.pathname || "/";
  return ["/", "/auth", "/library"].includes(path) ? path : "/";
}

export function canManageBooks() {
  return ["ADMIN", "LIBRARIAN"].includes(state.role);
}

export function canDeleteBooks() {
  return state.role === "ADMIN";
}
