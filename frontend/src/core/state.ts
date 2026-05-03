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

function favoritesStorageKey(token, userId) {
  if (token && Number.isInteger(userId) && userId > 0) return `favorites:user:${userId}`;
  return "favorites:guest";
}

export function loadFavoritesForSession(token, userId) {
  const key = favoritesStorageKey(token, userId);
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n > 0);
  } catch (_) {
    return [];
  }
}

export function saveFavoritesForSession(token, userId, favorites) {
  const key = favoritesStorageKey(token, userId);
  localStorage.setItem(key, JSON.stringify(favorites));
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
  /** Вкладки на /personal: favorites | my | publish */
  personalTab: "favorites",
  authTab: "login",
  coverDraft: "",
  coverDraftCatalog: "",
  favorites: loadFavoritesForSession(localStorage.getItem("token") || "", readUserId()),
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
    favorites: loadFavoritesForSession(localStorage.getItem("token") || "", readUserId()).length,
    personalBooks: 0,
    catalogBooks: 0
  },
  profileStatsLoading: false,
  /** Панель администратора: список пользователей и выбор */
  adminUi: {
    items: [],
    total: 0,
    page: 1,
    limit: 12,
    pages: 1,
    q: "",
    kbIndex: 0,
    selectedId: null,
    loading: false,
    lastLibrarianCode: ""
  }
};

// Normalize stale localStorage state: no token means guest session.
if (!state.token) {
  state.role = "GUEST";
  state.userId = null;
  state.userFullName = "";
  state.userEmail = "";
  localStorage.removeItem("role");
  localStorage.removeItem("userId");
  localStorage.removeItem("userFullName");
  localStorage.removeItem("userEmail");
}

export function getCurrentPath() {
  const path = location.pathname || "/";
  const allowed = ["/", "/auth", "/library", "/personal", "/admin"];
  if (!allowed.includes(path)) return "/";
  if (path === "/admin" && state.role !== "ADMIN") return "/library";
  return path;
}

export function canAccessAdminPanel() {
  return state.role === "ADMIN";
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
