// @ts-nocheck
export const ROLE_LABELS = {
  ADMIN: "Администратор",
  LIBRARIAN: "Библиотекарь",
  READER: "Читатель",
  GUEST: "Гость"
};

function readUserId() {
  const raw = localStorage.getItem("userId");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function readEmailFromToken() {
  const token = localStorage.getItem("token") || "";
  if (!token.includes(".")) return "";
  try {
    const payloadPart = token.split(".")[1] || "";
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    const payload = JSON.parse(decoded);
    return String(payload?.email || "");
  } catch (_) {
    return "";
  }
}

export const state = {
  token: localStorage.getItem("token") || "",
  role: localStorage.getItem("role") || "GUEST",
  userId: readUserId(),
  userFullName: localStorage.getItem("userFullName") || "",
  userEmail: localStorage.getItem("userEmail") || readEmailFromToken(),
  search: "",
  genreFilter: "all",
  sortBy: "newest",
  editingId: null,
  editingCatalogId: null,
  authTab: "login",
  coverDraft: "",
  coverDraftCatalog: "",
  favorites: JSON.parse(localStorage.getItem("favorites") || "[]"),
  availableGenres: [],
  catalogItems: [],
  catalogTotal: 0,
  catalogSkip: 0,
  catalogHasMore: true,
  catalogLoading: false,
  myBooks: [],
  favoriteBooks: [],
  readModalOpen: false,
  readModalBookId: null,
  readModalTitle: "",
  readModalText: "",
  profileStats: {
    favorites: JSON.parse(localStorage.getItem("favorites") || "[]").length,
    personalBooks: 0,
    catalogBooks: 0
  },
  profileStatsLoading: false
};

export function getCurrentPath() {
  const path = location.pathname || "/";
  return ["/", "/auth", "/library", "/personal"].includes(path) ? path : "/";
}

/** Каталог библиотеки: добавление / правка записей фонда */
export function canManageCatalog() {
  return ["ADMIN", "LIBRARIAN"].includes(state.role);
}

export function canEditThisBook(book) {
  if (!book) return false;
  if (book.ownerUserId != null && state.userId && book.ownerUserId === state.userId) return true;
  if (book.ownerUserId == null && canManageCatalog()) return true;
  return false;
}

export function canDeleteThisBook(book) {
  return canEditThisBook(book);
}

/** @deprecated используйте canManageCatalog */
export function canManageBooks() {
  return canManageCatalog();
}

/** @deprecated используйте canDeleteThisBook */
export function canDeleteBooks() {
  return canManageCatalog();
}
