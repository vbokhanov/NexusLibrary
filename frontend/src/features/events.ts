// @ts-nocheck
import { apiRequest } from "../api/http";
import { canDeleteBooks, canManageBooks, state } from "../core/state";
import { validateBook, validateLogin, validateRegister } from "../core/validators";
import { notify, renderBooks } from "../ui/render";

export async function loadBooks() {
  try {
    state.books = await apiRequest("/books", { method: "GET" }, state.token);
    renderBooks();
  } catch (error) {
    notify("Не удалось загрузить книги", "error");
  }
}

export function bindEvents({ page, navigate, rerender }) {
  bindNavigation(navigate);
  bindLogout(rerender);
  if (page === "/") bindHome(navigate);
  if (page === "/auth") bindAuth(navigate, rerender);
  if (page === "/library") bindLibrary(rerender);
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
    state.token = "";
    state.role = "GUEST";
    state.editingId = null;
    notify("Вы вышли из аккаунта", "info");
    rerender();
  });
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
      notify("Ошибка входа: проверьте данные", "error");
    }
  });

  document.querySelector("#registerForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.currentTarget));
    const err = validateRegister(payload);
    if (err) return notify(err, "warning");
    try {
      const data = await apiRequest("/auth/register", { method: "POST", body: JSON.stringify(payload) });
      persistUser(data);
      notify("Регистрация успешна", "success");
      navigate("/library");
    } catch (error) {
      notify("Не удалось зарегистрироваться", "error");
    }
  });
}

function bindLibrary(rerender) {
  document.querySelector("#loadBooks")?.addEventListener("click", loadBooks);
  document.querySelector("#searchInput")?.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderBooks();
  });
  document.querySelector("#cancelEdit")?.addEventListener("click", () => {
    state.editingId = null;
    rerender();
  });
  document.querySelector("#bookForm")?.addEventListener("submit", submitBook);
  document.querySelector("#bookList")?.addEventListener("click", onBookAction);
  loadBooks();
}

async function submitBook(e) {
  e.preventDefault();
  if (!state.token || !canManageBooks()) return notify("Без авторизации и нужной роли нельзя добавлять или редактировать книги", "warning");
  const payload = Object.fromEntries(new FormData(e.currentTarget));
  payload.year = Number(payload.year);
  payload.inStock = Number(payload.inStock);
  const errors = validateBook(payload);
  if (errors.length) return notify(errors[0], "warning");
  try {
    const endpoint = state.editingId ? `/books/${state.editingId}` : "/books";
    const method = state.editingId ? "PATCH" : "POST";
    await apiRequest(endpoint, { method, body: JSON.stringify(payload) }, state.token);
    notify(state.editingId ? "Книга обновлена" : "Книга добавлена", "success");
    state.editingId = null;
    e.currentTarget.reset();
    await loadBooks();
  } catch (error) {
    notify("Не удалось сохранить книгу", "error");
  }
}

async function onBookAction(event) {
  const target = event.target;
  const action = target.dataset.action;
  const id = Number(target.dataset.id);
  if (!action || !id) return;
  if (action === "edit") return enableEdit(id);
  if (action === "delete") return deleteBook(id);
}

function enableEdit(id) {
  if (!state.token || !canManageBooks()) return notify("Для редактирования нужна авторизация с нужной ролью", "warning");
  const book = state.books.find((item) => item.id === id);
  if (!book) return;
  state.editingId = id;
  const form = document.querySelector("#bookForm");
  form.title.value = book.title; form.author.value = book.author; form.isbn.value = book.isbn;
  form.year.value = book.year; form.genre.value = book.genre; form.coverUrl.value = book.coverUrl || "";
  form.inStock.value = book.inStock;
  notify("Режим редактирования включен", "info");
}

async function deleteBook(id) {
  if (!state.token || !canDeleteBooks()) return notify("Удаление доступно только администратору", "warning");
  try {
    await apiRequest(`/books/${id}`, { method: "DELETE" }, state.token);
    notify("Книга удалена", "success");
    await loadBooks();
  } catch (error) {
    notify("Не удалось удалить книгу", "error");
  }
}

function persistUser(data) {
  state.token = data.token;
  state.role = data.user.role || "READER";
  localStorage.setItem("token", state.token);
  localStorage.setItem("role", state.role);
}
