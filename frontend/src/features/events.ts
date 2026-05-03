// @ts-nocheck
import { apiRequest, fetchBookPlainText } from "../api/http";
import { canManageCatalog, loadFavoritesForSession, saveFavoritesForSession, state } from "../core/state";
import { validateBook, validateLogin, validatePersonalBook, validateRegister } from "../core/validators";
import {
  notify,
  renderCatalogGrid,
  renderPersonalFavoritesListOnly,
  renderPersonalLists,
  renderPersonalMyBooksListOnly,
  syncReadModal
} from "../ui/render";

let catalogObserver = null;
let searchDebounceTimer = null;
let readModalEscapeHandler = null;
let lastCatalogInfiniteFetch = 0;
let catalogScrollListener = null;
let outsideSelectClickHandler = null;
let toTopScrollHandler = null;
let dropdownKbHandler = null;

const customSelectHandlers = new Map();

function visibleMenuOptions(menu, selector) {
  if (!menu) return [];
  return [...menu.querySelectorAll(selector)].filter((el) => el.offsetParent !== null);
}

function syncCustomSelectKbHighlight(root) {
  const menu = root.querySelector("[data-select-menu]");
  const opts = visibleMenuOptions(menu, "[data-select-option]");
  opts.forEach((o) => o.classList.remove("is-kb-active"));
  const preferred = opts.findIndex((o) => o.classList.contains("is-selected"));
  const idx = preferred >= 0 ? preferred : 0;
  if (opts[idx]) opts[idx].classList.add("is-kb-active");
}

function syncComboKbHighlight(menu) {
  const opts = visibleMenuOptions(menu, "[data-combo-option]");
  opts.forEach((o) => o.classList.remove("is-kb-active"));
  if (opts[0]) opts[0].classList.add("is-kb-active");
}

function catalogPageSize() {
  if (typeof window === "undefined") return 10;
  const w = window.innerWidth;
  if (w < 520) return 6;
  if (w < 960) return 9;
  return 12;
}

let confirmResolve = null;

function isConfirmModalOpen() {
  const root = document.getElementById("confirmModalRoot");
  return Boolean(root && !root.hasAttribute("hidden"));
}

function hideConfirmModal() {
  const root = document.getElementById("confirmModalRoot");
  if (root) root.setAttribute("hidden", "");
}

function finishConfirm(value) {
  const r = confirmResolve;
  confirmResolve = null;
  hideConfirmModal();
  if (r) r(value);
}

function ensureConfirmModalDom() {
  let root = document.getElementById("confirmModalRoot");
  if (root) return root;
  root = document.createElement("div");
  root.id = "confirmModalRoot";
  root.className = "read-backdrop confirm-modal-overlay";
  root.setAttribute("hidden", "");
  root.innerHTML = `
    <div class="confirm-modal-panel glass" role="alertdialog" aria-modal="true" aria-labelledby="confirmModalMessage">
      <p id="confirmModalMessage" class="confirm-modal-message"></p>
      <div class="confirm-modal-actions">
        <button type="button" id="confirmModalCancel" class="secondary">Отмена</button>
        <button type="button" id="confirmModalOk" class="danger">Удалить</button>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  root.addEventListener("click", (e) => {
    if (e.target === root) finishConfirm(false);
  });
  root.querySelector("#confirmModalOk").addEventListener("click", () => finishConfirm(true));
  root.querySelector("#confirmModalCancel").addEventListener("click", () => finishConfirm(false));
  return root;
}

function openConfirmModal(message, confirmLabel = "Удалить") {
  const root = ensureConfirmModalDom();
  root.querySelector("#confirmModalMessage").textContent = message;
  root.querySelector("#confirmModalOk").textContent = confirmLabel;
  root.removeAttribute("hidden");
}

export function requestConfirm(message, confirmLabel = "Удалить") {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    openConfirmModal(message, confirmLabel);
  });
}

export function bindEvents({ page, navigate, rerender }) {
  bindNavigation(navigate);
  bindLogout(rerender);
  bindReadModalChrome();
  bindGlobalCustomSelectClose();
  bindDropdownKeyboard();
  bindToTopButton();
  if (page === "/") bindHome(navigate);
  if (page === "/auth") bindAuth(navigate, rerender);
  if (page === "/library") bindLibrary(rerender);
  if (page === "/personal") bindPersonal(navigate, rerender);
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("userId");
  localStorage.removeItem("userFullName");
  localStorage.removeItem("userEmail");
  state.token = "";
  state.role = "GUEST";
  state.userId = null;
  state.userFullName = "";
  state.userEmail = "";
  state.favorites = loadFavoritesForSession("", null);
  state.profileStats.favorites = state.favorites.length;
}

function isUnauthorizedError(error) {
  // @ts-ignore
  if (Number(error?.status) === 401) return true;
  const raw = String(error?.message || "");
  if (!raw) return false;
  if (raw.includes("Token invalid or expired") || raw.includes("No token provided")) return true;
  try {
    const parsed = JSON.parse(raw);
    const msg = String(parsed?.message || "");
    return msg.includes("Token invalid or expired") || msg.includes("No token provided");
  } catch (_) {
    return false;
  }
}

function handleUnauthorized(rerender, navigate) {
  clearSession();
  notify("Сессия истекла. Войдите в аккаунт снова.", "warning");
  if (typeof navigate === "function") navigate("/auth");
  else if (typeof rerender === "function") rerender();
  else window.dispatchEvent(new PopStateEvent("popstate"));
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
    clearSession();
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

function bindGlobalCustomSelectClose() {
  if (outsideSelectClickHandler) {
    document.removeEventListener("mousedown", outsideSelectClickHandler);
  }
  outsideSelectClickHandler = (event) => {
    if (event.button !== 0) return;
    const inside = event.target.closest(".custom-select") || event.target.closest(".combo-select");
    if (inside) return;
    document.querySelectorAll(".custom-select.open").forEach((item) => item.classList.remove("open"));
    document.querySelectorAll(".combo-select.open").forEach((item) => item.classList.remove("open"));
  };
  document.addEventListener("mousedown", outsideSelectClickHandler);
}

function bindDropdownKeyboard() {
  if (dropdownKbHandler) document.removeEventListener("keydown", dropdownKbHandler, true);
  dropdownKbHandler = (e) => {
    if (e.key === "Escape" && isConfirmModalOpen()) {
      e.preventDefault();
      e.stopPropagation();
      finishConfirm(false);
      return;
    }
    if (e.key === "Escape" && state.readModalOpen) return;
    const comboRoot = document.querySelector(".combo-select.open");
    const customRoot = document.querySelector(".custom-select.open");

    if (e.key === "Escape") {
      if (comboRoot) {
        e.preventDefault();
        comboRoot.classList.remove("open");
        return;
      }
      if (customRoot) {
        e.preventDefault();
        customRoot.classList.remove("open");
      }
      return;
    }

    if (!customRoot) return;

    const menu = customRoot.querySelector("[data-select-menu]");
    if (!menu) return;
    const opts = visibleMenuOptions(menu, "[data-select-option]");
    if (!opts.length) return;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      let activeIdx = opts.findIndex((o) => o.classList.contains("is-kb-active"));
      if (e.key === "ArrowDown") {
        if (activeIdx < 0) activeIdx = 0;
        else activeIdx = Math.min(opts.length - 1, activeIdx + 1);
      } else {
        if (activeIdx < 0) activeIdx = opts.length - 1;
        else activeIdx = Math.max(0, activeIdx - 1);
      }
      opts.forEach((o) => o.classList.remove("is-kb-active"));
      opts[activeIdx].classList.add("is-kb-active");
      opts[activeIdx].scrollIntoView({ block: "nearest" });
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      const active =
        opts.find((o) => o.classList.contains("is-kb-active")) ||
        opts.find((o) => o.classList.contains("is-selected"));
      if (!active) return;
      e.preventDefault();
      const id = customRoot.getAttribute("data-custom-select");
      const cb = customSelectHandlers.get(id);
      customRoot.classList.remove("open");
      opts.forEach((o) => o.classList.remove("is-kb-active", "is-selected"));
      active.classList.add("is-selected");
      if (cb) cb(active.dataset.value, active);
    }
  };
  document.addEventListener("keydown", dropdownKbHandler, true);
}

function bindToTopButton() {
  const btn = document.querySelector("#toTopBtn");
  const appRoot = document.querySelector("#app");
  if (!btn || !appRoot) return;
  btn.addEventListener("click", () => {
    appRoot.scrollTo({ top: 0, behavior: "smooth" });
  });
  if (toTopScrollHandler) {
    appRoot.removeEventListener("scroll", toTopScrollHandler);
  }
  toTopScrollHandler = () => {
    if (appRoot.scrollTop > 420) btn.classList.add("is-visible");
    else btn.classList.remove("is-visible");
  };
  appRoot.addEventListener("scroll", toTopScrollHandler, { passive: true });
  toTopScrollHandler();
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
  if (state.token) {
    loadProfileStats(rerender);
    document.querySelector("#goLibraryBtn")?.addEventListener("click", () => navigate("/library"));
    document.querySelector("#goPersonalBtn")?.addEventListener("click", () => navigate("/personal"));
    return;
  }
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
      if (isUnauthorizedError(error)) return handleUnauthorized(rerender, navigate);
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
      if (isUnauthorizedError(error)) return handleUnauthorized(rerender, navigate);
      notify(parseApiError(error, "Не удалось зарегистрироваться"), "error");
    }
  });
}

async function loadProfileStats(rerender) {
  if (state.profileStatsLoading || !state.token) return;
  state.profileStatsLoading = true;
  try {
    const [mine, countResp] = await Promise.all([
      apiRequest("/books/mine", { method: "GET" }, state.token),
      apiRequest("/books/meta/count", { method: "GET" }, "")
    ]);
    const nextStats = {
      favorites: state.favorites.length,
      personalBooks: Array.isArray(mine) ? mine.length : 0,
      catalogBooks: Number(countResp?.total || 0)
    };
    const changed =
      nextStats.favorites !== state.profileStats.favorites ||
      nextStats.personalBooks !== state.profileStats.personalBooks ||
      nextStats.catalogBooks !== state.profileStats.catalogBooks;
    state.profileStats = nextStats;
    if (changed) rerender();
  } catch (error) {
    if (isUnauthorizedError(error)) return handleUnauthorized(rerender, null);
  } finally {
    state.profileStatsLoading = false;
  }
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
    if (reset) state.catalogItems = items;
    else state.catalogItems = state.catalogItems.concat(items);
    state.catalogSkip = state.catalogItems.length;
    state.catalogHasMore = Boolean(data.hasMore);
  } catch (error) {
    if (isUnauthorizedError(error)) return handleUnauthorized(null, null);
    notify(parseApiError(error, "Не удалось загрузить книги"), "error");
  } finally {
    state.catalogLoading = false;
    updateCatalogSentinel();
  }
}

async function fetchCatalogTotal() {
  try {
    const data = await apiRequest("/books/meta/count", { method: "GET" }, "");
    if (typeof data?.total === "number") {
      state.catalogTotal = data.total;
    }
  } catch (_) {
    /* ignore count errors, grid can still load */
  }
}

function wireCatalogObserver() {
  catalogObserver?.disconnect();
  const sentinel = document.querySelector("#catalogSentinel");
  const appRoot = document.querySelector("#app");
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
    { root: appRoot || null, rootMargin: "0px 0px 220px 0px", threshold: 0.01 }
  );
  catalogObserver.observe(sentinel);
}

function ensureCatalogScrollFallback() {
  const appRoot = document.querySelector("#app");
  if (!appRoot) return;
  if (catalogScrollListener) {
    appRoot.removeEventListener("scroll", catalogScrollListener);
  }
  catalogScrollListener = async () => {
    if (state.catalogLoading || !state.catalogHasMore) return;
    const threshold = 220;
    const remain = appRoot.scrollHeight - (appRoot.scrollTop + appRoot.clientHeight);
    if (remain <= threshold) {
      const prevLen = state.catalogItems.length;
      await fetchCatalogPage(false);
      if (state.catalogItems.length !== prevLen) renderCatalogGrid();
    }
  };
  appRoot.addEventListener("scroll", catalogScrollListener, { passive: true });
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
      await fetchCatalogTotal();
      if (!state.availableGenres.length) {
        state.availableGenres = await apiRequest("/books/meta/genres", { method: "GET" }, "");
        rerender();
        return;
      }
      await fetchCatalogPage(true);
      renderCatalogGrid();
      wireCatalogObserver();
      ensureCatalogScrollFallback();
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
  if (action === "delete") return deleteCatalogBook(id, { refreshLibrary: true });
}

async function deleteCatalogBook(id, options = { refreshLibrary: true }) {
  if (!state.token || !canManageCatalog()) return notify("Удаление фонда доступно библиотекарю или администратору", "warning");
  if (!(await requestConfirm("Удалить книгу из общего каталога?", "Удалить"))) return;
  try {
    await apiRequest(`/books/${id}`, { method: "DELETE" }, state.token);
    notify("Книга удалена", "success");
    await fetchCatalogTotal();
    if (options.refreshLibrary) {
      await fetchCatalogPage(true);
      renderCatalogGrid();
    }
  } catch (error) {
    if (isUnauthorizedError(error)) return handleUnauthorized(null, null);
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
  setupComboSelect("personalGenre");
  document.querySelector("#profileMiniBtn")?.addEventListener("click", () => navigate("/auth"));

  (async () => {
    try {
      const favoritesNeedFetch = state.favorites.length > 0 && state.favoriteBooks.length === 0;
      await loadPersonalData({ mine: true, favorites: favoritesNeedFetch });
    } catch (error) {
      if (isUnauthorizedError(error)) return handleUnauthorized(rerender, navigate);
      notify(parseApiError(error, "Не удалось загрузить данные"), "error");
    }
  })();
}

async function loadPersonalData(options = { mine: true, favorites: true }) {
  const loadMine = options.mine !== false;
  const loadFav = options.favorites !== false;

  const tasks = [];
  if (loadMine) {
    tasks.push(
      (async () => {
        const mine = await apiRequest("/books/mine", { method: "GET" }, state.token);
        state.myBooks = Array.isArray(mine) ? mine : [];
      })()
    );
  }
  if (loadFav) {
    tasks.push(
      (async () => {
        const favIds = state.favorites;
        if (favIds.length) {
          const batch = await apiRequest(`/books/favorites/batch?ids=${favIds.join(",")}`, { method: "GET" }, state.token);
          state.favoriteBooks = Array.isArray(batch) ? batch : [];
          const validIds = state.favoriteBooks.map((b) => b.id);
          if (validIds.length !== favIds.length) {
            state.favorites = state.favorites.filter((id) => validIds.includes(id));
            saveFavoritesForSession(state.token, state.userId, state.favorites);
            state.profileStats.favorites = state.favorites.length;
          }
        } else state.favoriteBooks = [];
      })()
    );
  }
  await Promise.all(tasks);

  if (loadMine && state.editingCatalogId) {
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
  if (loadMine && state.editingId) {
    const b = state.myBooks.find((x) => x.id === state.editingId);
    if (b) queueMicrotask(() => fillPersonalForm(b));
    else state.editingId = null;
  }

  // Всегда перерисовываем оба списка из state (после полного rerender DOM пустой; без лишнего запроса избранного).
  renderPersonalFavoritesListOnly();
  renderPersonalMyBooksListOnly();
}

function resetPersonalBookFormAfterSave() {
  const form = document.querySelector("#personalBookForm");
  if (form) {
    form.reset();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = "Добавить";
  }
  const heading = document.querySelector("#personalFormHeading");
  if (heading) heading.textContent = "Добавить свою книгу";
  const genreHidden = document.querySelector("#personalGenre");
  if (genreHidden) genreHidden.value = "";
  const comboRoot = document.querySelector('[data-combo-select="personalGenre"]');
  comboRoot?.classList.remove("open");
  const comboInput = comboRoot?.querySelector("[data-combo-input]");
  if (comboInput) comboInput.value = "";
  const coverFile = document.querySelector("#personalCoverFile");
  if (coverFile) coverFile.value = "";
  state.coverDraft = "";
  updatePersonalPreview();
}

function fillPersonalForm(book) {
  const form = document.querySelector("#personalBookForm");
  if (!form) return;
  form.title.value = book.title;
  form.author.value = book.author;
  form.year.value = book.year;
  const genreHidden = document.querySelector("#personalGenre");
  if (genreHidden) genreHidden.value = book.genre || "";
  const combo = document.querySelector('[data-combo-select="personalGenre"]');
  const comboInput = combo?.querySelector("[data-combo-input]");
  if (comboInput) comboInput.value = book.genre || "";
  form.coverUrl.value = book.coverUrl || "";
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
    await loadPersonalData({ mine: false, favorites: true });
    return;
  }
  if (action === "edit-mine") {
    state.editingId = id;
    state.editingCatalogId = null;
    rerender();
    return;
  }
  if (action === "delete-mine") {
    if (!(await requestConfirm("Удалить вашу книгу?", "Удалить"))) return;
    try {
      await apiRequest(`/books/${id}`, { method: "DELETE" }, state.token);
      notify("Удалено", "success");
      if (state.editingId === id) {
        state.editingId = null;
        resetPersonalBookFormAfterSave();
      }
      await loadPersonalData({ mine: true, favorites: false });
    } catch (error) {
      if (isUnauthorizedError(error)) return handleUnauthorized(rerender, navigate);
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
    await loadPersonalData({ mine: true, favorites: true });
    rerender();
  }
}

async function submitPersonalBook(e, rerender) {
  e.preventDefault();
  if (!state.token) return notify("Нужна авторизация", "warning");
  const payload = Object.fromEntries(new FormData(e.currentTarget));
  payload.year = Number(payload.year);
  payload.coverUrl = state.coverDraft || String(payload.coverUrl || "").trim();
  // textUrl removed from personal library UI
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
    await loadPersonalData({ mine: true, favorites: false });
    resetPersonalBookFormAfterSave();
  } catch (error) {
    if (isUnauthorizedError(error)) return handleUnauthorized(rerender, null);
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
    await fetchCatalogTotal();
    state.editingCatalogId = null;
    state.coverDraftCatalog = "";
    rerender();
  } catch (error) {
    if (isUnauthorizedError(error)) return handleUnauthorized(rerender, null);
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
  customSelectHandlers.set(id, onChange);
  const trigger = root.querySelector("[data-select-trigger]");
  const menu = root.querySelector("[data-select-menu]");
  trigger?.addEventListener("click", () => {
    document.querySelectorAll(".custom-select.open").forEach((item) => {
      if (item !== root) item.classList.remove("open");
    });
    root.classList.toggle("open");
    if (root.classList.contains("open")) syncCustomSelectKbHighlight(root);
  });
  menu?.addEventListener("click", (event) => {
    const option = event.target.closest("[data-select-option]");
    if (!option) return;
    root.classList.remove("open");
    onChange(option.dataset.value, option);
  });
  menu?.addEventListener(
    "wheel",
    (event) => {
      const el = menu;
      if (!el) return;
      // Не даем скроллу "протекать" на основной #app, пока курсор внутри dropdown
      const delta = event.deltaY;
      const prevTop = el.scrollTop;
      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
      const nextTop = Math.min(maxTop, Math.max(0, prevTop + delta));
      el.scrollTop = nextTop;
      event.preventDefault();
      event.stopPropagation();
    },
    { passive: false }
  );
}

function setupComboSelect(id) {
  const root = document.querySelector(`[data-combo-select="${id}"]`);
  if (!root) return;
  const input = root.querySelector("[data-combo-input]");
  const menu = root.querySelector("[data-combo-menu]");
  const trigger = root.querySelector("[data-combo-trigger]");
  const hidden = document.querySelector(`#${id}`);
  if (!input || !menu || !hidden) return;

  let kbNavUsed = false;

  const open = () => root.classList.add("open");
  const close = () => root.classList.remove("open");

  const applyValue = (value) => {
    hidden.value = value;
    input.value = value;
    close();
  };

  const filter = () => {
    const q = String(input.value || "").trim().toLowerCase();
    const options = menu.querySelectorAll("[data-combo-option]");
    options.forEach((btn) => {
      const val = String(btn.dataset.value || "").toLowerCase();
      const match = !q || val.startsWith(q) || val.includes(q);
      btn.style.display = match ? "" : "none";
    });
    syncComboKbHighlight(menu);
  };

  trigger?.addEventListener("click", () => {
    root.classList.toggle("open");
    filter();
  });

  input.addEventListener("focus", () => {
    open();
    filter();
  });

  input.addEventListener("input", () => {
    kbNavUsed = false;
    open();
    filter();
    hidden.value = String(input.value || "");
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") return close();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!root.classList.contains("open")) return;
      kbNavUsed = true;
      const opts = visibleMenuOptions(menu, "[data-combo-option]");
      if (!opts.length) return;
      e.preventDefault();
      let activeIdx = opts.findIndex((o) => o.classList.contains("is-kb-active"));
      if (e.key === "ArrowDown") {
        if (activeIdx < 0) activeIdx = 0;
        else activeIdx = Math.min(opts.length - 1, activeIdx + 1);
      } else {
        if (activeIdx < 0) activeIdx = opts.length - 1;
        else activeIdx = Math.max(0, activeIdx - 1);
      }
      opts.forEach((o) => o.classList.remove("is-kb-active"));
      opts[activeIdx].classList.add("is-kb-active");
      opts[activeIdx].scrollIntoView({ block: "nearest" });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const typed = String(input.value || "").trim();
      if (kbNavUsed && root.classList.contains("open")) {
        const opts = visibleMenuOptions(menu, "[data-combo-option]");
        const active = opts.find((o) => o.classList.contains("is-kb-active"));
        kbNavUsed = false;
        if (active) applyValue(String(active.dataset.value || "").trim());
        else applyValue(typed);
      } else applyValue(typed);
    }
  });

  menu.addEventListener("click", (e) => {
    const opt = e.target.closest("[data-combo-option]");
    if (!opt) return;
    applyValue(opt.dataset.value);
  });

  // Wheel stays inside menu
  menu.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      menu.scrollTop += event.deltaY;
    },
    { passive: false }
  );
}

function parseApiError(error, fallback) {
  const raw = String(error?.message || "").trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.details) && parsed.details.length > 0) {
      const issue = parsed.details[0];
      const field = Array.isArray(issue?.path) ? issue.path.join(".") : "";
      if (field === "email") return "Email указан неверно. Пример: name@mail.com";
      if (field === "password") return "Пароль слишком короткий. Минимум 8 символов.";
      if (field === "fullName") return "ФИО слишком короткое. Введите минимум 3 символа.";
      if (field === "role") return "Роль выбрана неверно. Выберите из списка.";
      return field ? `Ошибка в поле «${field}»: ${issue.message}` : `Ошибка: ${issue.message}`;
    }
    if (String(parsed?.message || "").includes("External text source timed out")) {
      return "Удаленный источник книги временно недоступен. Попробуйте еще раз: после успешной загрузки текст сохранится локально.";
    }
    if (String(parsed?.message || "").includes("Email is already used")) {
      return "Этот email уже зарегистрирован. Войдите или используйте другой email.";
    }
    return parsed?.message || fallback;
  } catch (_) {
    if (raw.includes("Email is already used")) {
      return "Этот email уже зарегистрирован. Войдите или используйте другой email.";
    }
    return raw || fallback;
  }
}

function persistUser(data) {
  state.token = data.token;
  state.role = data.user.role || "READER";
  state.userId = data.user.id ?? null;
  state.userFullName = data.user.fullName || "";
  state.userEmail = data.user.email || "";
  state.favorites = loadFavoritesForSession(state.token, state.userId);
  state.profileStats.favorites = state.favorites.length;
  localStorage.setItem("token", state.token);
  localStorage.setItem("role", state.role);
  if (data.user.id != null) localStorage.setItem("userId", String(data.user.id));
  localStorage.setItem("userFullName", state.userFullName);
  localStorage.setItem("userEmail", state.userEmail);
}

function toggleFavorite(id) {
  if (state.favorites.includes(id)) {
    state.favorites = state.favorites.filter((item) => item !== id);
    notify("Удалено из избранного", "info");
  } else {
    state.favorites = [...state.favorites, id];
    notify("Добавлено в избранное", "success");
  }
  saveFavoritesForSession(state.token, state.userId, state.favorites);
  state.profileStats.favorites = state.favorites.length;
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
