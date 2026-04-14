// @ts-nocheck
import { ROLE_LABELS, canDeleteBooks, canManageBooks, state } from "../core/state";

export function notify(message, kind = "info") {
  const holder = document.querySelector("#alerts");
  if (!holder) return;
  const node = document.createElement("div");
  node.className = `alert ${kind}`;
  node.textContent = message;
  holder.appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

export function renderLayout(app, page) {
  app.innerHTML = `
  <main class="layout wide">
    <header class="topbar glass">
      <div class="brand">
        <span class="chip">Library Nexus</span>
        <small>Digital Library Platform</small>
      </div>
      <nav class="tabs">
          <a href="/" data-nav class="${page === "/" ? "active" : ""}">Главная</a>
          <a href="/auth" data-nav class="${page === "/auth" ? "active" : ""}">Вход</a>
          <a href="/library" data-nav class="${page === "/library" ? "active" : ""}">Библиотека</a>
      </nav>
      <div class="hero-actions">
        ${state.token ? `<button id="logout" class="secondary">Выйти</button>` : ""}
      </div>
    </header>
    <section id="alerts" class="alerts"></section>
    ${renderPage(page)}
  </main>`;
}

function renderPage(page) {
  if (page === "/") {
    return `<section class="welcome">
      <div class="welcome-intro glass split">
        <div>
          <h2>Современное решение для управления библиотекой</h2>
          <p>Library Nexus помогает быстро вести каталог, управлять доступом сотрудников и читателей, а также работать с фондом из единого интерфейса.</p>
          <button id="startNow">Начать работу</button>
        </div>
        <div class="hero-panel">
          <div class="hero-window">
            <div class="hero-row"><span>Каталог</span><span>12 480 книг</span></div>
            <div class="hero-row"><span>Пользователи</span><span>1 248 активных</span></div>
            <div class="hero-row"><span>Выдачи</span><span>352 сегодня</span></div>
          </div>
        </div>
      </div>
      <div class="knowledge glass">
        <h3>Что вы получаете</h3>
        <div class="knowledge-grid">
          <article><h4>Быстрый поиск</h4><p>Фильтрация по названию, автору и жанру в несколько кликов.</p></article>
          <article><h4>Доступность</h4><p>Работа с библиотекой с любого устройства и в любое время.</p></article>
          <article><h4>Систематизация</h4><p>Единая структура хранения материалов и истории выдач.</p></article>
          <article><h4>Контроль ролей</h4><p>Права операций по ролям: читатель, библиотекарь, администратор.</p></article>
        </div>
      </div>
      <div class="grid-3">
        <article class="glass feature"><h3>Легкость использования</h3><p>Понятный интерфейс и быстрый старт без долгого обучения.</p></article>
        <article class="glass feature"><h3>Совместная работа</h3><p>Сотрудники и читатели работают в единой системе.</p></article>
        <article class="glass feature"><h3>Мобильность</h3><p>Адаптивный интерфейс для компьютера, планшета и телефона.</p></article>
      </div>
      <section class="solutions glass">
        <h3>Возможности платформы</h3>
        <div class="solution-list">
          <article><h4>Учет фонда</h4><p>Полный учет книг, ISBN, жанров и остатков.</p></article>
          <article><h4>Операции выдачи</h4><p>Контроль выдач, сроков и возвратов по пользователям.</p></article>
          <article><h4>Сегментация ролей</h4><p>Гибкое разграничение прав и защищенные операции.</p></article>
          <article><h4>Отчетность</h4><p>Оперативные метрики по каталогу и активности.</p></article>
        </div>
      </section>
      <section class="faq glass">
        <h3>Частые вопросы</h3>
        <details><summary>Можно ли работать без авторизации?</summary><p>Просмотр каталога доступен, а управление книгами — только после входа.</p></details>
        <details><summary>Как добавить обложку?</summary><p>Можно вставить ссылку на изображение или загрузить файл прямо в форме.</p></details>
        <details><summary>Есть ли мобильная версия?</summary><p>Да, интерфейс полностью адаптивен для телефона и планшета.</p></details>
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
        <p>Для добавления и редактирования книг требуется авторизация с ролью библиотекаря или администратора.</p>
      </article>
    </section>`;
  }

  return `<section class="catalog glass">
    <div class="catalog-top">
      <h2>Каталог книг</h2>
      <span>Роль: ${ROLE_LABELS[state.role] || ROLE_LABELS.GUEST}</span>
    </div>
    <div class="library-stats">
      <article><strong>${state.books.length}</strong><span>Всего книг</span></article>
      <article><strong>${state.favorites.length}</strong><span>Избранное</span></article>
      <article><strong>${state.books.filter((b) => b.inStock > 0).length}</strong><span>Доступно сейчас</span></article>
    </div>
    <div class="catalog-tools">
      <input id="searchInput" placeholder="Поиск по названию, автору, жанру" value="${state.search}" />
      ${customSelect(
        "genreFilter",
        state.genreFilter === "all" ? "Все жанры" : state.genreFilter,
        [{ value: "all", label: "Все жанры" }, ...[...new Set(state.books.map((b) => b.genre).filter(Boolean))].map((genre) => ({ value: genre, label: genre }))],
        state.genreFilter
      )}
      ${customSelect(
        "sortBy",
        sortLabel(state.sortBy),
        [
          { value: "newest", label: "Сначала новые" },
          { value: "oldest", label: "Сначала старые" },
          { value: "title", label: "По названию" },
          { value: "stock", label: "По наличию" }
        ],
        state.sortBy
      )}
      <button id="loadBooks">Обновить каталог</button>
    </div>
    <div class="grid-two">
      <article class="card glass">${bookForm()}</article>
      <article class="card glass"><div id="bookList" class="book-list"></div></article>
    </div>
  </section>`;
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
            `<button type="button" class="custom-option ${opt.value === currentValue ? "is-selected" : ""}" data-select-option data-value="${opt.value}">${opt.label}</button>`
        )
        .join("")}
    </div>
  </div>`;
}

function sortLabel(value) {
  if (value === "oldest") return "Сначала старые";
  if (value === "title") return "По названию";
  if (value === "stock") return "По наличию";
  return "Сначала новые";
}

function loginForm() {
  return `<form id="loginForm">
    <input name="email" type="email" placeholder="Email" required />
    <input name="password" type="password" placeholder="Пароль" required minlength="8" />
    <button type="submit">Войти</button>
  </form>`;
}

function registerForm() {
  return `<form id="registerForm">
    <input name="fullName" placeholder="ФИО" required minlength="3" />
    <input name="email" type="email" placeholder="Email" required />
    <input name="password" type="password" placeholder="Пароль" required minlength="8" />
    <select name="role"><option value="READER">Читатель</option><option value="LIBRARIAN">Библиотекарь</option></select>
    <button type="submit">Создать аккаунт</button>
  </form>`;
}

function bookForm() {
  return `<h3>${state.editingId ? "Редактировать книгу" : "Добавить книгу"}</h3>
  <form id="bookForm">
    <input name="title" placeholder="Название" required />
    <input name="author" placeholder="Автор" required />
    <input name="isbn" placeholder="ISBN" required />
    <input name="year" type="number" min="1800" max="${new Date().getFullYear()}" required />
    <input name="genre" placeholder="Жанр" required />
    <input name="coverUrl" type="url" placeholder="Ссылка на обложку (https://...)" />
    <label class="file-label">
      Загрузить обложку
      <input name="coverFile" id="coverFile" type="file" accept="image/*" />
    </label>
    <div id="coverPreview" class="cover-preview ${state.coverDraft ? "has-image" : ""}">
      ${state.coverDraft ? `<img src="${state.coverDraft}" alt="Предпросмотр обложки" />` : "<span>Предпросмотр обложки</span>"}
    </div>
    <input name="inStock" type="number" min="0" max="999" required />
    <div class="inline-actions">
      <button type="submit">${state.editingId ? "Сохранить изменения" : "Добавить книгу"}</button>
      <button type="button" id="cancelEdit" class="secondary">Сбросить</button>
    </div>
  </form>`;
}

export function renderBooks() {
  const list = document.querySelector("#bookList");
  if (!list) return;
  const q = state.search.trim().toLowerCase();
  const filtered = state.books
    .filter((book) => !q || [book.title, book.author, book.genre].join(" ").toLowerCase().includes(q))
    .filter((book) => state.genreFilter === "all" || book.genre === state.genreFilter)
    .sort((a, b) => {
      if (state.sortBy === "oldest") return a.year - b.year;
      if (state.sortBy === "title") return String(a.title).localeCompare(String(b.title), "ru");
      if (state.sortBy === "stock") return b.inStock - a.inStock;
      return b.id - a.id;
    });
  if (!filtered.length) return (list.innerHTML = `<p class="empty">Ничего не найдено.</p>`);
  list.innerHTML = filtered.map((book) => `
    <article class="book-card">
      ${book.coverUrl ? `<img class="book-cover" src="${book.coverUrl}" alt="Обложка ${book.title}" />` : ""}
      <h3>${book.title}</h3><p>${book.author} • ${book.genre}</p><p>ISBN: ${book.isbn}</p>
      <p>Год: ${book.year} • В наличии: ${book.inStock}</p>
      <div class="inline-actions">
        <button data-action="favorite" data-id="${book.id}" class="${state.favorites.includes(book.id) ? "active" : "secondary"}">${state.favorites.includes(book.id) ? "В избранном" : "В избранное"}</button>
        <button data-action="edit" data-id="${book.id}" ${!canManageBooks() ? "disabled" : ""}>Редактировать</button>
        <button data-action="delete" data-id="${book.id}" class="secondary" ${!canDeleteBooks() ? "disabled" : ""}>Удалить</button>
      </div>
    </article>`).join("");
}
