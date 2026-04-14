// @ts-nocheck
import "./style.css";
import { apiRequest } from "./api/http";

const app = document.querySelector("#app");
if (!app) throw new Error("App root not found");

const ROLE_LABELS = {
  ADMIN: "Администратор",
  LIBRARIAN: "Библиотекарь",
  READER: "Читатель",
  GUEST: "Гость"
};

const state = {
  token: localStorage.getItem("token") || "",
  role: localStorage.getItem("role") || "GUEST",
  books: [],
  search: "",
  editingId: null
};

function getCurrentPath() {
  const path = location.pathname || "/";
  if (path === "/auth" || path === "/library" || path === "/") return path;
  return "/";
}

function navigate(path) {
  if (location.pathname !== path) {
    history.pushState({}, "", path);
  }
  renderLayout();
  bindEvents();
}

function canManageBooks() {
  return ["ADMIN", "LIBRARIAN"].includes(state.role);
}

function canDeleteBooks() {
  return state.role === "ADMIN";
}

function notify(message, kind = "info") {
  const holder = document.querySelector("#alerts");
  if (!holder) return;
  const node = document.createElement("div");
  node.className = `alert ${kind}`;
  node.textContent = message;
  holder.appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

function validateBook(payload) {
  const errors = [];
  if (!payload.title || payload.title.trim().length < 2) errors.push("Название: минимум 2 символа");
  if (!payload.author || payload.author.trim().length < 2) errors.push("Автор: минимум 2 символа");
  if (!/^[0-9X-]{10,17}$/.test(payload.isbn || "")) errors.push("ISBN: формат 10-17 символов");
  if (!Number.isInteger(payload.year) || payload.year < 1800 || payload.year > new Date().getFullYear()) {
    errors.push("Год: некорректное значение");
  }
  if (!payload.genre || payload.genre.trim().length < 2) errors.push("Жанр: минимум 2 символа");
  if (!Number.isInteger(payload.inStock) || payload.inStock < 0 || payload.inStock > 999) {
    errors.push("Количество: от 0 до 999");
  }
  return errors;
}

function renderLayout() {
  const page = getCurrentPath();
  app.innerHTML = `
  <main class="layout wide">
    <header class="hero glass">
      <div>
        <p class="chip">Library Nexus</p>
        <h1>Управление библиотекой</h1>
        <p>Удобный портал для читателей и сотрудников: каталог, роли доступа, учет фонда и быстрый поиск.</p>
      </div>
      <div class="hero-actions">
        <nav class="tabs">
          <a href="/" data-nav class="${page === "/" ? "active" : ""}">Главная</a>
          <a href="/auth" data-nav class="${page === "/auth" ? "active" : ""}">Вход</a>
          <a href="/library" data-nav class="${page === "/library" ? "active" : ""}">Библиотека</a>
        </nav>
        <button id="logout" class="secondary">Выйти</button>
      </div>
    </header>
    <section id="alerts" class="alerts"></section>
    ${renderPage(page)}
  </main>`;
}

function renderPage(page) {
  if (page === "/") {
    return `
    <section class="welcome">
      <div class="welcome-intro glass">
        <h2>Добро пожаловать в Library Nexus</h2>
        <p>Электронная библиотека с современным интерфейсом, ролями доступа и единым каталогом для учебной организации.</p>
        <button id="startNow">Начать работу</button>
      </div>
      <div class="grid-3">
        <article class="glass feature"><h3>Легко использовать</h3><p>Понятный интерфейс для быстрого добавления и поиска книг.</p></article>
        <article class="glass feature"><h3>Быстрый доступ</h3><p>Разделение по страницам: главная, вход, библиотека.</p></article>
        <article class="glass feature"><h3>Совместная работа</h3><p>Разные роли пользователей и контроль действий в каталоге.</p></article>
      </div>
    </section>`;
  }

  if (page === "/auth") {
    return `
    <section class="grid-two">
      <article class="card glass">
        <h2>Авторизация</h2>
        <form id="loginForm">
          <input name="email" type="email" placeholder="Email" required />
          <input name="password" type="password" placeholder="Пароль" required minlength="8" />
          <button type="submit">Войти</button>
        </form>
      </article>
      <article class="card glass status-card">
        <h2>Статус доступа</h2>
        <p>Текущая роль: <b>${ROLE_LABELS[state.role] || ROLE_LABELS.GUEST}</b></p>
        <p>Для добавления и редактирования книг требуется авторизация с ролью библиотекаря или администратора.</p>
      </article>
    </section>`;
  }

  return `
  <section class="catalog glass">
    <div class="catalog-top">
      <h2>Каталог книг</h2>
      <span>Роль: ${ROLE_LABELS[state.role] || ROLE_LABELS.GUEST}</span>
    </div>
    <div class="catalog-tools">
      <input id="searchInput" placeholder="Поиск по названию, автору, жанру" value="${state.search}" />
      <button id="loadBooks">Обновить каталог</button>
    </div>
    <div class="grid-two">
      <article class="card glass">
        <h3>${state.editingId ? "Редактировать книгу" : "Добавить книгу"}</h3>
        <form id="bookForm">
          <input name="title" placeholder="Название" required />
          <input name="author" placeholder="Автор" required />
          <input name="isbn" placeholder="ISBN" required />
          <input name="year" type="number" min="1800" max="${new Date().getFullYear()}" required />
          <input name="genre" placeholder="Жанр" required />
          <input name="inStock" type="number" min="0" max="999" required />
          <div class="inline-actions">
            <button type="submit">${state.editingId ? "Сохранить изменения" : "Добавить книгу"}</button>
            <button type="button" id="cancelEdit" class="secondary">Сбросить</button>
          </div>
        </form>
      </article>
      <article class="card glass">
        <div id="bookList" class="book-list"></div>
      </article>
    </div>
  </section>`;
}

function renderBooks() {
  const list = document.querySelector("#bookList");
  if (!list) return;
  const filtered = state.books.filter((book) => {
    const q = state.search.trim().toLowerCase();
    if (!q) return true;
    return [book.title, book.author, book.genre].join(" ").toLowerCase().includes(q);
  });
  if (!filtered.length) {
    list.innerHTML = `<p class="empty">Ничего не найдено.</p>`;
    return;
  }
  list.innerHTML = filtered
    .map(
      (book) => `<article class="book-card">
      <h3>${book.title}</h3>
      <p>${book.author} • ${book.genre}</p>
      <p>ISBN: ${book.isbn}</p>
      <p>Год: ${book.year} • В наличии: ${book.inStock}</p>
      <div class="inline-actions">
        <button data-action="edit" data-id="${book.id}" ${!canManageBooks() ? "disabled" : ""}>Редактировать</button>
        <button data-action="delete" data-id="${book.id}" class="secondary" ${!canDeleteBooks() ? "disabled" : ""}>Удалить</button>
      </div>
      </article>`
    )
    .join("");
}

async function loadBooks() {
  try {
    const books = await apiRequest("/books", { method: "GET" }, state.token);
    state.books = books;
    renderBooks();
  } catch (error) {
    notify("Не удалось загрузить книги", "error");
  }
}

function bindCommonEvents() {
  document.querySelector("#logout")?.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    state.token = "";
    state.role = "GUEST";
    state.editingId = null;
    notify("Вы вышли из аккаунта", "info");
    renderLayout();
    bindEvents();
  });
}

function bindEvents() {
  bindCommonEvents();
  const page = getCurrentPath();

  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(link.getAttribute("href"));
    });
  });

  if (page === "/") {
    document.querySelector("#startNow")?.addEventListener("click", () => navigate("/auth"));
  }

  if (page === "/auth") {
    document.querySelector("#loginForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const payload = Object.fromEntries(formData);
      if (!String(payload.email).includes("@")) return notify("Введите корректный email", "warning");
      if (String(payload.password).length < 8) return notify("Пароль минимум 8 символов", "warning");
      try {
        const data = await apiRequest("/auth/login", { method: "POST", body: JSON.stringify(payload) });
        state.token = data.token;
        state.role = data.user.role || "READER";
        localStorage.setItem("token", state.token);
        localStorage.setItem("role", state.role);
        notify("Вход выполнен", "success");
        navigate("/library");
      } catch (error) {
        notify("Ошибка входа: проверьте данные", "error");
      }
    });
  }

  if (page === "/library") {
    document.querySelector("#loadBooks")?.addEventListener("click", loadBooks);
    document.querySelector("#searchInput")?.addEventListener("input", (event) => {
      state.search = event.target.value;
      renderBooks();
    });

    document.querySelector("#cancelEdit")?.addEventListener("click", () => {
      state.editingId = null;
      renderLayout();
      bindEvents();
      renderBooks();
    });

    document.querySelector("#bookForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.token || !canManageBooks()) {
        return notify("Без авторизации и нужной роли нельзя добавлять или редактировать книги", "warning");
      }
      const formData = new FormData(e.currentTarget);
      const payload = Object.fromEntries(formData);
      payload.year = Number(payload.year);
      payload.inStock = Number(payload.inStock);
      const errors = validateBook(payload);
      if (errors.length) return notify(errors[0], "warning");

      try {
        if (state.editingId) {
          await apiRequest(`/books/${state.editingId}`, { method: "PATCH", body: JSON.stringify(payload) }, state.token);
          notify("Книга обновлена", "success");
        } else {
          await apiRequest("/books", { method: "POST", body: JSON.stringify(payload) }, state.token);
          notify("Книга добавлена", "success");
        }
        state.editingId = null;
        e.currentTarget.reset();
        await loadBooks();
      } catch (error) {
        notify("Не удалось сохранить книгу", "error");
      }
    });

    document.querySelector("#bookList")?.addEventListener("click", async (event) => {
      const target = event.target;
      const action = target.dataset.action;
      const id = Number(target.dataset.id);
      if (!action || !id) return;

      if (action === "edit") {
        if (!state.token || !canManageBooks()) {
          return notify("Для редактирования нужна авторизация с нужной ролью", "warning");
        }
        const book = state.books.find((item) => item.id === id);
        if (!book) return;
        state.editingId = id;
        const form = document.querySelector("#bookForm");
        form.title.value = book.title;
        form.author.value = book.author;
        form.isbn.value = book.isbn;
        form.year.value = book.year;
        form.genre.value = book.genre;
        form.inStock.value = book.inStock;
        notify("Режим редактирования включен", "info");
        return;
      }

      if (action === "delete") {
        if (!state.token || !canDeleteBooks()) {
          return notify("Удаление доступно только администратору", "warning");
        }
        try {
          await apiRequest(`/books/${id}`, { method: "DELETE" }, state.token);
          notify("Книга удалена", "success");
          await loadBooks();
        } catch (error) {
          notify("Не удалось удалить книгу", "error");
        }
      }
    });

    loadBooks();
  }
}

window.addEventListener("popstate", () => {
  renderLayout();
  bindEvents();
});

renderLayout();
bindEvents();
