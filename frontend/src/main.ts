// @ts-nocheck
import "./style.css";
import { apiRequest } from "./api/http";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root not found");

const state = {
  token: localStorage.getItem("token") || "",
  role: localStorage.getItem("role") || "",
  books: []
};

function view() {
  app.innerHTML = `
  <main class="layout">
    <header class="hero glass">
      <div>
        <p class="chip">Library Nexus</p>
        <h1>Управление библиотекой</h1>
        <p>Адаптивная веб-панель с авторизацией, ролевым CRUD и быстрым поиском книг.</p>
      </div>
      <div class="hero-actions">
        <button id="loadBooks">Обновить каталог</button>
        <button id="logout" class="secondary">Выйти</button>
      </div>
    </header>
    <section class="grid">
      <article class="card glass">
        <h2>Авторизация</h2>
        <form id="loginForm">
          <input name="email" type="email" placeholder="email" required />
          <input name="password" type="password" placeholder="password" required />
          <button type="submit">Войти</button>
        </form>
      </article>
      <article class="card glass">
        <h2>Добавить книгу</h2>
        <form id="bookForm">
          <input name="title" placeholder="Название" required />
          <input name="author" placeholder="Автор" required />
          <input name="isbn" placeholder="ISBN" required />
          <input name="year" type="number" min="1800" max="2100" required />
          <input name="genre" placeholder="Жанр" required />
          <input name="inStock" type="number" min="0" max="999" required />
          <button type="submit">Сохранить</button>
        </form>
      </article>
    </section>
    <section class="catalog glass">
      <div class="catalog-top">
        <h2>Каталог книг</h2>
        <span>Роль: ${state.role || "guest"}</span>
      </div>
      <div id="bookList" class="book-list"></div>
    </section>
  </main>`;
}

async function loadBooks() {
  const books = await apiRequest("/books", { method: "GET" }, state.token);
  state.books = books;
  const list = document.querySelector<HTMLDivElement>("#bookList");
  if (!list) return;
  list.innerHTML = books
    .map(
      (book: any) => `<article class="book-card">
      <h3>${book.title}</h3>
      <p>${book.author} • ${book.genre}</p>
      <p>ISBN: ${book.isbn}</p>
      <p>В наличии: ${book.inStock}</p>
      </article>`
    )
    .join("");
}

function bindEvents() {
  document.querySelector<HTMLButtonElement>("#loadBooks")?.addEventListener("click", loadBooks);
  document.querySelector<HTMLButtonElement>("#logout")?.addEventListener("click", () => {
    localStorage.clear();
    location.reload();
  });

  document.querySelector<HTMLFormElement>("#loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const payload = Object.fromEntries(formData);
    const data = await apiRequest("/auth/login", { method: "POST", body: JSON.stringify(payload) });
    state.token = data.token;
    state.role = data.user.role;
    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.user.role);
    await loadBooks();
  });

  document.querySelector<HTMLFormElement>("#bookForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const payload = Object.fromEntries(formData);
    payload.year = Number(payload.year);
    payload.inStock = Number(payload.inStock);
    await apiRequest("/books", { method: "POST", body: JSON.stringify(payload) }, state.token);
    await loadBooks();
  });
}

view();
bindEvents();
loadBooks();
