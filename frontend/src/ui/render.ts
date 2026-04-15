// @ts-nocheck
import { ROLE_LABELS, canEditThisBook, canDeleteThisBook, canManageCatalog, state } from "../core/state";
import { bookTextUrl } from "../api/http";

export function notify(message, kind = "info") {
  const holder = document.querySelector("#alerts");
  if (!holder) return;
  const node = document.createElement("div");
  node.className = `alert ${kind}`;
  node.textContent = message;
  holder.appendChild(node);
  setTimeout(() => node.remove(), 4200);
}

export function renderLayout(app, page) {
  const authed = Boolean(state.token);
  app.innerHTML = `
  <main class="layout wide">
    <header class="topbar glass">
      <div class="brand">
        <span class="chip">Library Nexus</span>
        <small>Digital Library Platform</small>
      </div>
      <nav class="tabs">
          <a href="/" data-nav class="${page === "/" ? "active" : ""}">Главная</a>
          <a href="/auth" data-nav class="${page === "/auth" ? "active" : ""}">${authed ? "Аккаунт" : "Вход"}</a>
          <a href="/library" data-nav class="${page === "/library" ? "active" : ""}">Библиотека</a>
          ${authed ? `<a href="/personal" data-nav class="${page === "/personal" ? "active" : ""}">Личная библиотека</a>` : ""}
      </nav>
      <div class="hero-actions">
        ${authed ? `<button id="logout" class="secondary">Выйти</button>` : ""}
      </div>
    </header>
    <section id="alerts" class="alerts"></section>
    ${renderPage(page)}
    ${readModalMarkup()}
  </main>`;
}

function readModalMarkup() {
  return `<div id="readBackdrop" class="read-backdrop" hidden>
    <div class="read-dialog glass" role="dialog" aria-modal="true">
      <div class="read-toolbar">
        <h3 id="readTitle">Чтение</h3>
        <div class="read-toolbar-actions">
          <a id="readDownload" class="button-link" href="#" target="_blank" rel="noopener">Скачать .txt</a>
          <button type="button" id="readClose" class="secondary">Закрыть</button>
        </div>
      </div>
      <pre id="readBody" class="read-body"></pre>
    </div>
  </div>`;
}

function renderPage(page) {
  if (page === "/") {
    return `<section class="welcome">
      <div class="welcome-intro glass split">
        <div>
          <h2>Современное решение для управления библиотекой</h2>
          <p>Library Nexus помогает вести электронный каталог, сохранять избранное и читать материалы прямо в браузере.</p>
          <button id="startNow">Начать работу</button>
        </div>
        <div class="hero-panel">
          <div class="hero-window">
            <div class="hero-row"><span>Каталог</span><span>Электронные издания</span></div>
            <div class="hero-row"><span>Пользователи</span><span>Роли и доступ</span></div>
            <div class="hero-row"><span>Чтение</span><span>В браузере и скачивание</span></div>
          </div>
        </div>
      </div>
      <div class="knowledge glass">
        <h3>Что вы получаете</h3>
        <div class="knowledge-grid">
          <article><h4>Быстрый поиск</h4><p>Фильтрация по названию, автору и жанру.</p></article>
          <article><h4>Доступность</h4><p>Работа с каталогом с любого устройства.</p></article>
          <article><h4>Личный кабинет</h4><p>Свои книги, избранное и загрузки в одной вкладке.</p></article>
          <article><h4>Контроль ролей</h4><p>Библиотекарь ведёт фонд, читатель пользуется каталогом.</p></article>
        </div>
      </div>
      <div class="grid-3">
        <article class="glass feature"><h3>Легкость использования</h3><p>Понятный интерфейс и быстрый старт.</p></article>
        <article class="glass feature"><h3>Электронный фонд</h3><p>Без «количества на полке» — только цифровые копии.</p></article>
        <article class="glass feature"><h3>Мобильность</h3><p>Адаптивная вёрстка для телефона и планшета.</p></article>
      </div>
      <section class="faq glass">
        <h3>Частые вопросы</h3>
        <details><summary>Где добавить свою книгу?</summary><p>После входа откройте вкладку «Личная библиотека».</p></details>
        <details><summary>Как читать?</summary><p>Кнопка «Читать» открывает текст; «Скачать» сохраняет файл.</p></details>
        <details><summary>Кто может править каталог?</summary><p>Редактирование фонда — у библиотекаря и администратора.</p></details>
      </section>
    </section>`;
  }

  if (page === "/auth") {
    return `<section class="grid-two">
      <article class="card glass">
        <h2>Авторизация</h2>
        <div class="auth-tabs">
          <button type="button" id="tabLogin" class="${state.authTab === "login" ? "active" : "secondary"}">Вход</button>
          <button type="button" id="tabRegister" class="${state.authTab === "register" ? "active" : "secondary"}">Регистрация</button>
        </div>
        ${state.authTab === "login" ? loginForm() : registerForm()}
      </article>
      <article class="card glass status-card">
        <h2>Статус доступа</h2>
        <p>Текущая роль: <b>${ROLE_LABELS[state.role] || ROLE_LABELS.GUEST}</b></p>
        <p>После входа доступна вкладка «Личная библиотека»: свои книги и избранное из каталога.</p>
      </article>
    </section>`;
  }

  if (page === "/personal") {
    return renderPersonalPage();
  }

  return renderLibraryPage();
}

function renderLibraryPage() {
  const genreOptions = [
    { value: "all", label: "Все жанры" },
    ...state.availableGenres.map((g) => ({ value: g, label: g }))
  ];
  return `<section class="catalog glass catalog-full">
    <div class="catalog-top">
      <h2>Каталог книг</h2>
      <span class="catalog-role">Роль: ${ROLE_LABELS[state.role] || ROLE_LABELS.GUEST}</span>
    </div>
    <div class="library-stats library-stats-2">
      <article><strong>${state.catalogTotal || state.catalogItems.length}</strong><span>Всего в каталоге</span></article>
      <article><strong>${state.catalogItems.length}</strong><span>Загружено на странице</span></article>
    </div>
    <div class="catalog-tools catalog-tools-row">
      <input id="searchInput" placeholder="Поиск по названию, автору, жанру" value="${escapeAttr(state.search)}" />
      ${customSelect(
        "genreFilter",
        state.genreFilter === "all" ? "Все жанры" : state.genreFilter,
        genreOptions,
        state.genreFilter
      )}
      ${customSelect(
        "sortBy",
        sortLabel(state.sortBy),
        [
          { value: "newest", label: "Сначала новые" },
          { value: "oldest", label: "Сначала старые" },
          { value: "title", label: "По названию" }
        ],
        state.sortBy
      )}
      <button type="button" id="reloadCatalog">Обновить каталог</button>
    </div>
    <div id="catalogScroll" class="catalog-scroll">
      <div id="bookList" class="book-grid"></div>
      <div id="catalogSentinel" class="catalog-sentinel" data-loading="${state.catalogLoading ? "1" : "0"}">
        ${state.catalogLoading ? "<span>Загрузка…</span>" : state.catalogHasMore ? "<span>Прокрутите вниз</span>" : "<span>Все книги загружены</span>"}
      </div>
    </div>
  </section>`;
}

function renderPersonalPage() {
  const catalogSection = canManageCatalog()
    ? `<article class="card glass personal-block">
        <h3>${state.editingCatalogId ? "Редактировать книгу фонда" : "Добавить в общий каталог"}</h3>
        <p class="hint">Только для библиотекаря: книга попадает в общий каталог (видна всем).</p>
        ${catalogBookForm()}
      </article>`
    : "";

  return `<section class="personal-page">
    <div class="catalog-top personal-header">
      <h2>Личная библиотека</h2>
      <span>${escapeAttr(state.userFullName || "")}</span>
    </div>
    <div class="personal-grid">
      <article class="card glass personal-block">
        <h3>Избранное из каталога</h3>
        <div id="favoriteList" class="book-grid personal-book-grid"></div>
      </article>
      <article class="card glass personal-block">
        <h3>Мои книги</h3>
        <p class="hint">Здесь только ваши загрузки; их можно править и удалять.</p>
        ${personalBookForm()}
        <div id="myBookList" class="book-grid personal-book-grid"></div>
      </article>
      ${catalogSection}
    </div>
  </section>`;
}

function escapeAttr(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function customSelect(id, currentLabel, options, currentValue) {
  return `<div class="custom-select" data-custom-select="${id}">
    <button type="button" class="custom-select-trigger" data-select-trigger>
      <span>${currentLabel}</span>
      <span class="custom-caret"></span>
    </button>
    <div class="custom-select-menu" data-select-menu>
      ${options
        .map(
          (opt) =>
            `<button type="button" class="custom-option ${opt.value === currentValue ? "is-selected" : ""}" data-select-option data-value="${escapeAttr(opt.value)}">${opt.label}</button>`
        )
        .join("")}
    </div>
  </div>`;
}

function sortLabel(value) {
  if (value === "oldest") return "Сначала старые";
  if (value === "title") return "По названию";
  return "Сначала новые";
}

function loginForm() {
  return `<form id="loginForm">
    <input name="email" type="email" placeholder="Email" required autocomplete="username" />
    <input name="password" type="password" placeholder="Пароль" required minlength="8" autocomplete="current-password" />
    <button type="submit">Войти</button>
  </form>`;
}

function registerForm() {
  return `<form id="registerForm">
    <input name="fullName" placeholder="ФИО" required minlength="3" autocomplete="name" />
    <input name="email" type="email" placeholder="Email" required autocomplete="email" />
    <input name="password" type="password" placeholder="Пароль (от 8 символов)" required minlength="8" autocomplete="new-password" />
    <input type="hidden" name="role" id="registerRole" value="READER" />
    ${customSelect(
      "registerRole",
      "Читатель",
      [
        { value: "READER", label: "Читатель" },
        { value: "LIBRARIAN", label: "Библиотекарь" },
        { value: "ADMIN", label: "Администратор" }
      ],
      "READER"
    )}
    <button type="submit">Создать аккаунт</button>
  </form>`;
}

function personalBookForm() {
  return `<h4>${state.editingId ? "Редактировать мою книгу" : "Добавить свою книгу"}</h4>
  <form id="personalBookForm">
    <input name="title" placeholder="Название" required />
    <input name="author" placeholder="Автор" required />
    <input name="year" type="number" min="1800" max="${new Date().getFullYear()}" required />
    <input name="genre" placeholder="Жанр" required />
    <input name="coverUrl" type="url" placeholder="Ссылка на обложку (https://...)" />
    <label class="file-label">
      Загрузить обложку
      <input name="coverFile" id="personalCoverFile" type="file" accept="image/*" />
    </label>
    <div id="personalCoverPreview" class="cover-preview ${state.coverDraft ? "has-image" : ""}">
      ${state.coverDraft ? `<img src="${state.coverDraft}" alt="Предпросмотр" />` : "<span>Предпросмотр обложки</span>"}
    </div>
    <input name="textUrl" type="url" placeholder="Ссылка на полный текст (.txt), необязательно" />
    <textarea name="contentText" rows="6" placeholder="Или вставьте текст книги сюда (до ~250 тыс. символов)"></textarea>
    <div class="inline-actions">
      <button type="submit">${state.editingId ? "Сохранить" : "Добавить"}</button>
      <button type="button" id="cancelPersonalEdit" class="secondary">Сбросить</button>
    </div>
  </form>`;
}

function catalogBookForm() {
  return `<form id="catalogBookForm">
    <input name="title" placeholder="Название" required />
    <input name="author" placeholder="Автор" required />
    <input name="isbn" placeholder="ISBN" required />
    <input name="year" type="number" min="1800" max="${new Date().getFullYear()}" required />
    <input name="genre" placeholder="Жанр" required />
    <input name="coverUrl" type="url" placeholder="Ссылка на обложку (https://...)" />
    <label class="file-label">
      Загрузить обложку
      <input name="coverFile" id="catalogCoverFile" type="file" accept="image/*" />
    </label>
    <div id="catalogCoverPreview" class="cover-preview ${state.coverDraftCatalog ? "has-image" : ""}">
      ${state.coverDraftCatalog ? `<img src="${state.coverDraftCatalog}" alt="Предпросмотр" />` : "<span>Предпросмотр обложки</span>"}
    </div>
    <input name="textUrl" type="url" placeholder="Ссылка на полный текст (.txt), необязательно" />
    <textarea name="contentText" rows="4" placeholder="Или фрагмент/полный текст в каталоге"></textarea>
    <div class="inline-actions">
      <button type="submit">${state.editingCatalogId ? "Сохранить в фонде" : "Добавить в фонд"}</button>
      <button type="button" id="cancelCatalogEdit" class="secondary">Сбросить</button>
    </div>
  </form>`;
}

export function bookHasReadableText(book) {
  return Boolean((book.contentText && String(book.contentText).trim()) || (book.textUrl && String(book.textUrl).trim()));
}

export function buildBookCard(book, ctx) {
  const fav = state.favorites.includes(book.id);
  const canRead = bookHasReadableText(book);
  const readBtn = canRead
    ? `<button type="button" data-action="read" data-id="${book.id}" class="read-btn">Читать</button>`
    : `<button type="button" class="secondary" disabled title="Нет текста">Нет текста</button>`;
  const downloadBtn = canRead
    ? `<a class="button-link small" href="${bookTextUrl(book.id, true)}" target="_blank" rel="noopener">Скачать</a>`
    : "";

  const favBtn = `<button type="button" data-action="favorite" data-id="${book.id}" class="${fav ? "active" : "secondary"}">${fav ? "В избранном" : "В избранное"}</button>`;

  let actions = "";
  if (ctx === "catalog" || ctx === "favorites") {
    const showEdit = book.ownerUserId == null && canManageCatalog();
    const showDelete = showEdit;
    actions = `
      <div class="card-actions">
        ${readBtn}
        ${downloadBtn}
        ${favBtn}
        ${showEdit ? `<button type="button" data-action="edit" data-id="${book.id}">Редактировать</button>` : ""}
        ${showDelete ? `<button type="button" data-action="delete" data-id="${book.id}" class="secondary">Удалить</button>` : ""}
      </div>`;
  } else {
    actions = `
      <div class="card-actions">
        ${readBtn}
        ${downloadBtn}
        <button type="button" data-action="edit-mine" data-id="${book.id}">Редактировать</button>
        <button type="button" data-action="delete-mine" data-id="${book.id}" class="secondary">Удалить</button>
      </div>`;
  }

  return `<article class="book-card">
      ${book.coverUrl ? `<img class="book-cover" src="${book.coverUrl}" alt="" loading="lazy" />` : ""}
      <h3>${book.title}</h3>
      <p class="meta">${book.author} • ${book.genre}</p>
      <p class="meta small">ISBN: ${book.isbn}</p>
      <p class="meta small">Год: ${book.year}</p>
      ${actions}
    </article>`;
}

export function renderCatalogGrid() {
  const list = document.querySelector("#bookList");
  if (!list) return;
  if (!state.catalogItems.length) {
    list.innerHTML = `<p class="empty">Нет книг. Запустите импорт или обновите позже.</p>`;
    return;
  }
  list.innerHTML = state.catalogItems.map((b) => buildBookCard(b, "catalog")).join("");
}

export function renderPersonalLists() {
  const fav = document.querySelector("#favoriteList");
  const mine = document.querySelector("#myBookList");
  if (fav) {
    if (!state.favoriteBooks.length) fav.innerHTML = `<p class="empty">Пока пусто — добавьте книги в избранное в каталоге.</p>`;
    else fav.innerHTML = state.favoriteBooks.map((b) => buildBookCard(b, "favorites")).join("");
  }
  if (mine) {
    if (!state.myBooks.length) mine.innerHTML = `<p class="empty">Вы ещё не добавляли свои книги.</p>`;
    else mine.innerHTML = state.myBooks.map((b) => buildBookCard(b, "mine")).join("");
  }
}

export function syncReadModal() {
  const backdrop = document.querySelector("#readBackdrop");
  const titleEl = document.querySelector("#readTitle");
  const bodyEl = document.querySelector("#readBody");
  const dl = document.querySelector("#readDownload");
  if (!backdrop || !titleEl || !bodyEl) return;
  if (state.readModalOpen) {
    backdrop.removeAttribute("hidden");
    backdrop.hidden = false;
    titleEl.textContent = state.readModalTitle;
    bodyEl.textContent = state.readModalText;
    if (dl && state.readModalBookId) {
      dl.href = bookTextUrl(state.readModalBookId, true);
    }
  } else {
    backdrop.hidden = true;
    backdrop.setAttribute("hidden", "");
    bodyEl.textContent = "";
    if (dl) dl.setAttribute("href", "#");
  }
}
