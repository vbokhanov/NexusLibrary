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
    <div class="catalog-tools">
      <input id="searchInput" placeholder="Поиск по названию, автору, жанру" value="${state.search}" />
      <button id="loadBooks">Обновить каталог</button>
    </div>
    <div class="grid-two">
      <article class="card glass">${bookForm()}</article>
      <article class="card glass"><div id="bookList" class="book-list"></div></article>
    </div>
  </section>`;
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
  const filtered = state.books.filter((book) => !q || [book.title, book.author, book.genre].join(" ").toLowerCase().includes(q));
  if (!filtered.length) return (list.innerHTML = `<p class="empty">Ничего не найдено.</p>`);
  list.innerHTML = filtered.map((book) => `
    <article class="book-card">
      ${book.coverUrl ? `<img class="book-cover" src="${book.coverUrl}" alt="Обложка ${book.title}" />` : ""}
      <h3>${book.title}</h3><p>${book.author} • ${book.genre}</p><p>ISBN: ${book.isbn}</p>
      <p>Год: ${book.year} • В наличии: ${book.inStock}</p>
      <div class="inline-actions">
        <button data-action="edit" data-id="${book.id}" ${!canManageBooks() ? "disabled" : ""}>Редактировать</button>
        <button data-action="delete" data-id="${book.id}" class="secondary" ${!canDeleteBooks() ? "disabled" : ""}>Удалить</button>
      </div>
    </article>`).join("");
}
