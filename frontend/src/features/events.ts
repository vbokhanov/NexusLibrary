// @ts-nocheck
import { apiRequest, fetchBookPlainText } from "../api/http";
import { canManageCatalog, state } from "../core/state";
import { validateBook, validateLogin, validatePersonalBook, validateRegister } from "../core/validators";
import { notify, renderCatalogGrid, renderPersonalLists, syncReadModal } from "../ui/render";

let catalogObserver = null;
let searchDebounceTimer = null;
let readModalEscapeHandler = null;
let lastCatalogInfiniteFetch = 0;

function catalogPageSize() {
  if (typeof window === "undefined") return 10;
  const w = window.innerWidth;
  if (w < 520) return 6;
  if (w < 960) return 9;
  return 12;
}

export function bindEvents({ page, navigate, rerender }) {
  bindNavigation(navigate);
  bindLogout(rerender);
  bindReadModalChrome();
  if (page === "/") bindHome(navigate);
  if (page === "/auth") bindAuth(navigate, rerender);
  if (page === "/library") bindLibrary(rerender);
  if (page === "/personal") bindPersonal(navigate, rerender);
}

function bindNavigation(navigate) {
  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(link.getAttribute("href"));
    });
  });
}

function bindLogout(rerender) {
  document.querySelector("#logout")?.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("userId");
    localStorage.removeItem("userFullName");
    state.token = "";
    state.role = "GUEST";
    state.userId = null;
    state.userFullName = "";
    state.editingId = null;
    state.editingCatalogId = null;
    notify("Вы вышли из аккаунта", "info");
    rerender();
  });
}

function bindReadModalChrome() {
  const backdrop = document.querySelector("#readBackdrop");
  if (!backdrop) return;
  backdrop.addEventListener("click", onReadBackdropClick);
  if (readModalEscapeHandler) document.removeEventListener("keydown", readModalEscapeHandler);
  readModalEscapeHandler = (e) => {
    if (e.key === "Escape" && state.readModalOpen) {
      e.preventDefault();
      closeReadModal();
    }
  };
  document.addEventListener("keydown", readModalEscapeHandler);
}

function onReadBackdropClick(e) {
  const backdrop = e.currentTarget;
  if (e.target.closest("#readClose")) {
    e.preventDefault();
    e.stopPropagation();
    closeReadModal();
    return;
  }
  if (e.target === backdrop) {
    closeReadModal();
  }
}

function closeReadModal() {
  state.readModalOpen = false;
  state.readModalBookId = null;
  state.readModalTitle = "";
  state.readModalText = "";
  syncReadModal();
}

async function openReadModal(bookId) {
  const id = Number(bookId);
  if (!id) return;
  let title = "Книга";
  try {
    const meta = await apiRequest(`/books/${id}`, { method: "GET" }, state.token || "");
    if (meta?.title) title = meta.title;
  } catch (_) {
    /* ignore */
  }
  try {
    const text = await fetchBookPlainText(id);
    state.readModalBookId = id;
    state.readModalTitle = title;
    state.readModalText = text;
    state.readModalOpen = true;
    syncReadModal();
  } catch (error) {
    notify(parseApiError(error, "Не удалось загрузить текст (возможно, для книги не указан URL текста)"), "error");
  }
}

function bindHome(navigate) {
  document.querySelector("#startNow")?.addEventListener("click", () => navigate("/auth"));
}

function bindAuth(navigate, rerender) {
  document.querySelector("#tabLogin")?.addEventListener("click", () => {
    state.authTab = "login";
    rerender();
  });
  document.querySelector("#tabRegister")?.addEventListener("click", () => {
    state.authTab = "register";
    rerender();
  });
  setupCustomSelect("registerRole", (value, option) => {
    const roleInput = document.querySelector("#registerRole");
    if (roleInput) roleInput.value = value;
    const labelNode = document.querySelector('[data-custom-select="registerRole"] [data-select-trigger] span');
    if (labelNode) labelNode.textContent = option?.textContent || "Читатель";
  });

  document.querySelector("#loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.currentTarget));
    const err = validateLogin(payload);
    if (err) return notify(err, "warning");
    try {
      const data = await apiRequest("/auth/login", { method: "POST", body: JSON.stringify(payload) });
      persistUser(data);
      notify("Вход выполнен", "success");
      navigate("/library");
    } catch (error) {
      notify(parseApiError(error, "Ошибка входа: проверьте данные"), "error");
    }
  });

  document.querySelector("#registerForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.currentTarget));
    payload.role = String(payload.role || "READER").toUpperCase();
    const err = validateRegister(payload);
    if (err) return notify(err, "warning");
    try {
      const data = await apiRequest("/auth/register", { method: "POST", body: JSON.stringify(payload) });
      persistUser(data);
      notify("Регистрация успешна", "success");
      navigate("/library");
    } catch (error) {
      notify(parseApiError(error, "Не удалось зарегистрироваться"), "error");
    }
  });
}

function updateCatalogSentinel() {
  const el = document.querySelector("#catalogSentinel");
  if (!el) return;
  if (state.catalogLoading) el.innerHTML = "<span>Загрузка…</span>";
  else if (state.catalogHasMore) el.innerHTML = "<span>Прокрутите вниз — подгрузим ещё</span>";
  else el.innerHTML = "<span>Все книги загружены</span>";
}

async function fetchCatalogPage(reset) {
  if (state.catalogLoading) return;
  if (reset) {
    lastCatalogInfiniteFetch = 0;
    state.catalogItems = [];
    state.catalogSkip = 0;
    state.catalogHasMore = true;
  } else if (!state.catalogHasMore) return;

  state.catalogLoading = true;
  updateCatalogSentinel();
  try {
    const params = new URLSearchParams({
      take: String(catalogPageSize()),
      skip: String(state.catalogSkip),
      sort: state.sortBy,
      q: state.search.trim(),
      genre: state.genreFilter
    });
    const data = await apiRequest(`/books?${params}`, { method: "GET" }, "");
    const items = Array.isArray(data.items) ? data.items : [];
    state.catalogTotal = typeof data.total === "number" ? data.total : state.catalogTotal;
    if (reset) state.catalogItems = items;
    else state.catalogItems = state.catalogItems.concat(items);
    state.catalogSkip = state.catalogItems.length;
    state.catalogHasMore = Boolean(data.hasMore);
  } catch (error) {
    notify(parseApiError(error, "Не удалось загрузить книги"), "error");
  } finally {
    state.catalogLoading = false;
    updateCatalogSentinel();
  }
}

function wireCatalogObserver() {
  catalogObserver?.disconnect();
  const sentinel = document.querySelector("#catalogSentinel");
  if (!sentinel) return;
  catalogObserver = new IntersectionObserver(
    async (entries) => {
      if (!entries[0]?.isIntersecting) return;
      const now = Date.now();
      if (now - lastCatalogInfiniteFetch < 480) return;
      lastCatalogInfiniteFetch = now;
      const prevLen = state.catalogItems.length;
      await fetchCatalogPage(false);
      if (state.catalogItems.length !== prevLen) renderCatalogGrid();
    },
    { root: null, rootMargin: "0px 0px 180px 0px", threshold: 0.05 }
  );
  catalogObserver.observe(sentinel);
}

function bindLibrary(rerender) {
  document.querySelector("#reloadCatalog")?.addEventListener("click", async () => {
    await fetchCatalogPage(true);
    renderCatalogGrid();
  });

  document.querySelector("#searchInput")?.addEventListener("input", (event) => {
    state.search = event.target.value;
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(async () => {
      await fetchCatalogPage(true);
      renderCatalogGrid();
    }, 420);
  });

  setupCustomSelect("genreFilter", (value) => {
    state.genreFilter = value;
    rerender();
  });
  setupCustomSelect("sortBy", (value) => {
    state.sortBy = value;
    rerender();
  });

  document.querySelector("#bookList")?.addEventListener("click", onCatalogListClick);

  (async () => {
    try {
      if (!state.availableGenres.length) {
        state.availableGenres = await apiRequest("/books/meta/genres", { method: "GET" }, "");
        rerender();
        return;
      }
      await fetchCatalogPage(true);
      renderCatalogGrid();
      wireCatalogObserver();
    } catch (error) {
      notify(parseApiError(error, "Не удалось загрузить каталог"), "error");
    }
  })();
}

async function onCatalogListClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  const id = Number(target.dataset.id);
  if (!id) return;
  if (action === "read") return openReadModal(id);
  if (action === "favorite") return toggleFavorite(id);
  if (action === "edit") {
    state.editingCatalogId = id;
    state.editingId = null;
    history.pushState({}, "", "/personal");
    window.dispatchEvent(new PopStateEvent("popstate"));
    return;
  }
  if (action === "delete") return deleteCatalogBook(id);
}

async function deleteCatalogBook(id, options = { refreshLibrary: true }) {
  if (!state.token || !canManageCatalog()) return notify("Удаление фонда доступно библиотекарю или администратору", "warning");
  if (!window.confirm("Удалить книгу из общего каталога?")) return;
  try {
    await apiRequest(`/books/${id}`, { method: "DELETE" }, state.token);
    notify("Книга удалена", "success");
    if (options.refreshLibrary) {
      await fetchCatalogPage(true);
      renderCatalogGrid();
    }
  } catch (error) {
    notify(parseApiError(error, "Не удалось удалить"), "error");
  }
}

function bindPersonal(navigate, rerender) {
  if (!state.token) {
    notify("Войдите, чтобы открыть личную библиотеку", "warning");
    navigate("/auth");
    return;
  }

  document.querySelector("#personalBookForm")?.addEventListener("submit", (e) => submitPersonalBook(e, rerender));
  document.querySelector("#catalogBookForm")?.addEventListener("submit", (e) => submitCatalogBook(e, rerender));
  document.querySelector("#personalCoverFile")?.addEventListener("change", (event) =>
    onCoverFile(event, "personal")
  );
  document.querySelector("#catalogCoverFile")?.addEventListener("change", (event) =>
    onCoverFile(event, "catalog")
  );
  document.querySelector("#cancelPersonalEdit")?.addEventListener("click", () => {
    state.editingId = null;
    state.coverDraft = "";
    rerender();
  });
  document.querySelector("#cancelCatalogEdit")?.addEventListener("click", () => {
    state.editingCatalogId = null;
    state.coverDraftCatalog = "";
    rerender();
  });
  document.querySelector("#favoriteList")?.addEventListener("click", (e) => onPersonalListsClick(e, navigate, rerender));
  document.querySelector("#myBookList")?.addEventListener("click", (e) => onPersonalListsClick(e, navigate, rerender));

  (async () => {
    try {
      await loadPersonalData();
    } catch (error) {
      notify(parseApiError(error, "Не удалось загрузить данные"), "error");
    }
  })();
}

async function loadPersonalData() {
  const [mine, favIds] = await Promise.all([
    apiRequest("/books/mine", { method: "GET" }, state.token),
    Promise.resolve(state.favorites)
  ]);
  state.myBooks = Array.isArray(mine) ? mine : [];
  if (favIds.length) {
    const batch = await apiRequest(`/books/favorites/batch?ids=${favIds.join(",")}`, { method: "GET" }, state.token);
    state.favoriteBooks = Array.isArray(batch) ? batch : [];
  } else state.favoriteBooks = [];

  if (state.editingCatalogId) {
    const exists = state.catalogItems.find((b) => b.id === state.editingCatalogId);
    let book = exists;
    if (!book) {
      try {
        book = await apiRequest(`/books/${state.editingCatalogId}`, { method: "GET" }, state.token);
      } catch (_) {
        state.editingCatalogId = null;
      }
    }
    if (book) queueMicrotask(() => fillCatalogForm(book));
  }
  if (state.editingId) {
    const b = state.myBooks.find((x) => x.id === state.editingId);
    if (b) queueMicrotask(() => fillPersonalForm(b));
    else state.editingId = null;
  }

  renderPersonalLists();
}

function fillPersonalForm(book) {
  const form = document.querySelector("#personalBookForm");
  if (!form) return;
  form.title.value = book.title;
  form.author.value = book.author;
  form.year.value = book.year;
  form.genre.value = book.genre;
  form.coverUrl.value = book.coverUrl || "";
  form.textUrl.value = book.textUrl || "";
  form.contentText.value = book.contentText || "";
  state.coverDraft = book.coverUrl || "";
  updatePersonalPreview();
}

function fillCatalogForm(book) {
  const form = document.querySelector("#catalogBookForm");
  if (!form) return;
  form.title.value = book.title;
  form.author.value = book.author;
  form.isbn.value = book.isbn;
  form.year.value = book.year;
  form.genre.value = book.genre;
  form.coverUrl.value = book.coverUrl || "";
  form.textUrl.value = book.textUrl || "";
  form.contentText.value = book.contentText || "";
  state.coverDraftCatalog = book.coverUrl || "";
  updateCatalogPreview();
}

async function onPersonalListsClick(event, navigate, rerender) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  const id = Number(target.dataset.id);
  if (!id) return;
  if (action === "read") return openReadModal(id);
  if (action === "favorite") {
    toggleFavorite(id);
    await loadPersonalData();
    return;
  }
  if (action === "edit-mine") {
    state.editingId = id;
    state.editingCatalogId = null;
    rerender();
    return;
  }
  if (action === "delete-mine") {
    if (!window.confirm("Удалить вашу книгу?")) return;
    try {
      await apiRequest(`/books/${id}`, { method: "DELETE" }, state.token);
      notify("Удалено", "success");
      state.editingId = null;
      await loadPersonalData();
      rerender();
    } catch (error) {
      notify(parseApiError(error, "Не удалось удалить"), "error");
    }
    return;
  }
  if (action === "edit") {
    state.editingCatalogId = id;
    state.editingId = null;
    rerender();
    return;
  }
  if (action === "delete") {
    await deleteCatalogBook(id, { refreshLibrary: false });
    await loadPersonalData();
    rerender();
  }
}

async function submitPersonalBook(e, rerender) {
  e.preventDefault();
  if (!state.token) return notify("Нужна авторизация", "warning");
  const payload = Object.fromEntries(new FormData(e.currentTarget));
  payload.year = Number(payload.year);
  payload.coverUrl = state.coverDraft || String(payload.coverUrl || "").trim();
  payload.textUrl = String(payload.textUrl || "").trim();
  payload.contentText = String(payload.contentText || "");
  const errors = validatePersonalBook(payload);
  if (errors.length) return notify(errors[0], "warning");
  try {
    if (state.editingId) {
      await apiRequest(`/books/${state.editingId}`, { method: "PATCH", body: JSON.stringify(payload) }, state.token);
      notify("Сохранено", "success");
    } else {
      await apiRequest("/books/personal", { method: "POST", body: JSON.stringify(payload) }, state.token);
      notify("Книга добавлена", "success");
    }
    state.editingId = null;
    state.coverDraft = "";
    e.currentTarget.reset();
    updatePersonalPreview();
    await loadPersonalData();
    rerender();
  } catch (error) {
    notify(parseApiError(error, "Не удалось сохранить"), "error");
  }
}

async function submitCatalogBook(e, rerender) {
  e.preventDefault();
  if (!state.token || !canManageCatalog()) return notify("Только библиотекарь или администратор", "warning");
  const payload = Object.fromEntries(new FormData(e.currentTarget));
  payload.year = Number(payload.year);
  payload.coverUrl = state.coverDraftCatalog || String(payload.coverUrl || "").trim();
  payload.textUrl = String(payload.textUrl || "").trim();
  payload.contentText = String(payload.contentText || "");
  payload.inStock = 1;
  const errors = validateBook(payload);
  if (errors.length) return notify(errors[0], "warning");
  try {
    if (state.editingCatalogId) {
      await apiRequest(`/books/${state.editingCatalogId}`, { method: "PATCH", body: JSON.stringify(payload) }, state.token);
      notify("Книга фонда обновлена", "success");
    } else {
      await apiRequest("/books", { method: "POST", body: JSON.stringify(payload) }, state.token);
      notify("Добавлено в фонд", "success");
    }
    state.editingCatalogId = null;
    state.coverDraftCatalog = "";
    e.currentTarget.reset();
    updateCatalogPreview();
    rerender();
  } catch (error) {
    notify(parseApiError(error, "Не удалось сохранить"), "error");
  }
}

async function onCoverFile(event, kind) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const dataUrl = await resizeImageToDataUrl(file, 420, 560);
    if (kind === "catalog") {
      state.coverDraftCatalog = dataUrl;
      updateCatalogPreview();
    } else {
      state.coverDraft = dataUrl;
      updatePersonalPreview();
    }
    notify("Обложка загружена", "success");
  } catch (error) {
    notify("Не удалось обработать изображение", "error");
  }
}

function updatePersonalPreview() {
  const block = document.querySelector("#personalCoverPreview");
  if (!block) return;
  if (!state.coverDraft) {
    block.classList.remove("has-image");
    block.innerHTML = "<span>Предпросмотр обложки</span>";
    return;
  }
  block.classList.add("has-image");
  block.innerHTML = `<img src="${state.coverDraft}" alt="" />`;
}

function updateCatalogPreview() {
  const block = document.querySelector("#catalogCoverPreview");
  if (!block) return;
  if (!state.coverDraftCatalog) {
    block.classList.remove("has-image");
    block.innerHTML = "<span>Предпросмотр обложки</span>";
    return;
  }
  block.classList.add("has-image");
  block.innerHTML = `<img src="${state.coverDraftCatalog}" alt="" />`;
}

function setupCustomSelect(id, onChange) {
  const root = document.querySelector(`[data-custom-select="${id}"]`);
  if (!root) return;
  const trigger = root.querySelector("[data-select-trigger]");
  const menu = root.querySelector("[data-select-menu]");
  trigger?.addEventListener("click", () => {
    document.querySelectorAll(".custom-select.open").forEach((item) => {
      if (item !== root) item.classList.remove("open");
    });
    root.classList.toggle("open");
  });
  menu?.addEventListener("click", (event) => {
    const option = event.target.closest("[data-select-option]");
    if (!option) return;
    root.classList.remove("open");
    onChange(option.dataset.value, option);
  });
}

function parseApiError(error, fallback) {
  const raw = String(error?.message || "").trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.details) && parsed.details.length > 0) {
      const issue = parsed.details[0];
      const field = Array.isArray(issue?.path) ? issue.path.join(".") : "";
      return field ? `Ошибка поля ${field}: ${issue.message}` : `Ошибка: ${issue.message}`;
    }
    return parsed?.message || fallback;
  } catch (_) {
    return raw || fallback;
  }
}

function persistUser(data) {
  state.token = data.token;
  state.role = data.user.role || "READER";
  state.userId = data.user.id ?? null;
  state.userFullName = data.user.fullName || "";
  localStorage.setItem("token", state.token);
  localStorage.setItem("role", state.role);
  if (data.user.id != null) localStorage.setItem("userId", String(data.user.id));
  localStorage.setItem("userFullName", state.userFullName);
}

function toggleFavorite(id) {
  if (state.favorites.includes(id)) {
    state.favorites = state.favorites.filter((item) => item !== id);
    notify("Удалено из избранного", "info");
  } else {
    state.favorites = [...state.favorites, id];
    notify("Добавлено в избранное", "success");
  }
  localStorage.setItem("favorites", JSON.stringify(state.favorites));
  renderCatalogGrid();
  renderPersonalLists();
}

function resizeImageToDataUrl(file, maxWidth, maxHeight) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
