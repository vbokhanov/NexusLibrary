// @ts-nocheck
import {
  ROLE_LABELS,
  canAccessAdminPanel,
  canEditThisBook,
  canDeleteThisBook,
  canManageCatalog,
  state
} from "../core/state";
import { bookTextUrl } from "../api/http";

const MAX_TOASTS = 3;
const TOAST_TTL_MS = 4200;

function ensureToastHost() {
  let host = document.querySelector("#toastHost");
  if (host) return host;
  host = document.createElement("div");
  host.id = "toastHost";
  host.className = "toast-host";
  host.setAttribute("aria-live", "polite");
  document.body.appendChild(host);
  return host;
}

function clearToastTimer(node) {
  if (node?._toastTimer) {
    window.clearTimeout(node._toastTimer);
    node._toastTimer = null;
  }
}

function removeToastNode(node) {
  if (!node?.parentNode) return;
  clearToastTimer(node);
  node.classList.remove("toast-in");
  node.classList.add("toast-out");
  const done = () => {
    node.removeEventListener("transitionend", done);
    node.remove();
  };
  node.addEventListener("transitionend", done, { once: true });
  window.setTimeout(() => {
    if (node.parentNode) node.remove();
  }, 320);
}

export function notify(message, kind = "info") {
  const host = ensureToastHost();
  const node = document.createElement("div");
  node.className = `toast-item alert ${kind}`;
  node.setAttribute("role", "status");
  node.textContent = message;

  const arm = (el) => {
    el._toastTimer = window.setTimeout(() => removeToastNode(el), TOAST_TTL_MS);
  };

  const mount = () => {
    host.appendChild(node);
    requestAnimationFrame(() => node.classList.add("toast-in"));
    arm(node);
  };

  if (host.children.length >= MAX_TOASTS) {
    const oldest = host.firstElementChild;
    if (!oldest) mount();
    else {
      clearToastTimer(oldest);
      let settled = false;
      const finishEvict = () => {
        if (settled) return;
        settled = true;
        oldest.remove();
        mount();
      };
      oldest.classList.remove("toast-in");
      oldest.classList.add("toast-out");
      oldest.addEventListener("transitionend", finishEvict, { once: true });
      window.setTimeout(finishEvict, 280);
    }
  } else mount();
}

export function renderLayout(app, page) {
  const authed = Boolean(state.token);
  const adminTab =
    authed && canAccessAdminPanel()
      ? `<a href="/admin" data-nav class="${page === "/admin" ? "active" : ""}">Управление</a>`
      : "";
  app.innerHTML = `
  <main class="layout wide">
    <section class="workspace-shell">
      <div class="workspace-surface">
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
              ${adminTab}
          </nav>
          <div class="hero-actions">
            ${authed ? `<button id="logout" class="danger">Выйти</button>` : ""}
          </div>
        </header>
        ${renderPage(page)}
        ${renderFooter(page)}
      </div>
    </section>
    ${readModalMarkup()}
    <button type="button" id="toTopBtn" class="to-top-btn" aria-label="Наверх" title="Наверх">↑</button>
  </main>`;
}

function renderFooter(page) {
  const year = new Date().getFullYear();
  const scope =
    page === "/"
      ? "Главная"
      : page === "/auth"
        ? "Аккаунт"
        : page === "/personal"
          ? "Личная библиотека"
          : page === "/admin"
            ? "Управление"
            : "Каталог";
  return `<footer class="footer glass">
    <div class="footer-row">
      <div class="footer-brand">
        <strong>Library Nexus</strong>
        <span>Электронная библиотека • ${scope}</span>
      </div>
      <div class="footer-meta">
        <span>© ${year} Курсовой проект</span>
      </div>
    </div>
  </footer>`;
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
    if (isAuthed()) {
      return `<section class="grid-two profile-grid">
        <article class="card glass profile-card">
          <div class="profile-hero">
            <div class="profile-avatar">${profileInitials(state.userFullName)}</div>
            <div class="profile-title">
              <h2>${escapeAttr(state.userFullName || "Пользователь")}</h2>
              <p>${ROLE_LABELS[state.role] || ROLE_LABELS.GUEST}</p>
            </div>
          </div>
          <div class="profile-meta">
            <div class="profile-item"><span>Email</span><strong>${escapeAttr(state.userEmail || "—")}</strong></div>
            <div class="profile-item"><span>ID</span><strong>${profileGameId(state.userId)}</strong></div>
          </div>
          <div class="profile-stats-grid">
            <div class="profile-stat"><strong>${state.profileStats.catalogBooks}</strong><span>Книг в каталоге</span></div>
            <div class="profile-stat"><strong>${state.profileStats.personalBooks}</strong><span>Личных книг</span></div>
            <div class="profile-stat"><strong>${state.profileStats.favorites}</strong><span>В избранном</span></div>
          </div>
          <h3 class="profile-subheading">Сменить пароль</h3>
          <form id="changePasswordForm" class="change-password-form">
            <input name="currentPassword" type="password" placeholder="Текущий пароль" required minlength="8" autocomplete="current-password" />
            <input name="newPassword" type="password" placeholder="Новый пароль" required minlength="8" autocomplete="new-password" />
            <input name="newPassword2" type="password" placeholder="Повтор нового пароля" required minlength="8" autocomplete="new-password" />
            <button type="submit">Обновить пароль</button>
          </form>
          <div class="inline-actions">
            <button type="button" id="goLibraryBtn">Открыть библиотеку</button>
            <button type="button" id="goPersonalBtn" class="secondary">Личная библиотека</button>
            ${canAccessAdminPanel() ? `<button type="button" id="goAdminBtn" class="secondary">Управление</button>` : ""}
          </div>
        </article>
        <article class="card glass status-card profile-side">
          <h2>Аккаунт активен</h2>
          <p>Вы уже авторизованы и можете пользоваться каталогом, чтением и личной библиотекой.</p>
          <p>Для выхода используйте кнопку «Выйти» в шапке.</p>
        </article>
      </section>`;
    }
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

  if (page === "/admin") {
    return renderAdminPage();
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
    <div class="library-stats library-stats-single">
      <article><strong>${state.catalogTotal}</strong><span>Всего в каталоге</span></article>
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
        <h3>${state.editingCatalogId ? "Редактировать публикацию" : "Опубликовать книгу"}</h3>
        <p class="hint">Книга появится в общем каталоге для всех читателей. После сохранения обновите страницу каталога или откройте «Библиотека» — запись подтянется с сервера.</p>
        ${catalogBookForm()}
      </article>`
    : "";

  return `<section class="personal-page">
    <div class="catalog-top personal-header">
      <h2>Личная библиотека</h2>
      <button type="button" id="profileMiniBtn" class="profile-mini" title="Открыть аккаунт">
        <div class="profile-mini-avatar">${profileInitials(state.userFullName)}</div>
        <span>${escapeAttr(state.userFullName || "Пользователь")}</span>
      </button>
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

function renderAdminPage() {
  if (!canAccessAdminPanel()) {
    return `<section class="personal-page"><p class="empty">Доступно только администратору.</p></section>`;
  }
  return `<section class="personal-page admin-page">
    <div class="catalog-top personal-header">
      <h2>Управление</h2>
      <button type="button" id="profileMiniBtn" class="profile-mini" title="Открыть аккаунт">
        <div class="profile-mini-avatar">${profileInitials(state.userFullName)}</div>
        <span>${escapeAttr(state.userFullName || "Пользователь")}</span>
      </button>
    </div>
    <div class="admin-grid">
      <article class="card glass admin-block">
        <h3>Пользователи</h3>
        <p class="hint">Стрелки вверх/вниз и Enter — выбор в списке. Сгенерируйте код и передайте его будущему библиотекарю для регистрации.</p>
        <div class="admin-toolbar">
          <input id="adminUserSearch" type="search" placeholder="Поиск по email или ФИО" autocomplete="off" />
          <button type="button" id="adminGenCodeBtn" class="secondary">Новый код (10 цифр)</button>
        </div>
        <p id="adminLibrarianCodeLine" class="admin-code-line hint" aria-live="polite"></p>
        <div id="adminUserList" class="admin-user-list" tabindex="0" role="listbox" aria-label="Список пользователей"></div>
        <div class="admin-pagination">
          <span id="adminPageLabel" class="admin-page-label"></span>
          <div class="admin-pag-buttons">
            <button type="button" id="adminPrevPage" class="secondary">Назад</button>
            <button type="button" id="adminNextPage" class="secondary">Вперёд</button>
          </div>
        </div>
      </article>
      <article class="card glass admin-block" id="adminDetailCard">
        <h3>Данные пользователя</h3>
        <p class="hint" id="adminDetailPlaceholder">Выберите строку в списке слева.</p>
        <form id="adminUserForm" class="admin-user-form" hidden>
          <input type="hidden" id="adminFormUserId" name="userId" value="" />
          <label class="admin-field"><span>ФИО</span><input name="fullName" id="adminFormFullName" type="text" required /></label>
          <label class="admin-field"><span>Email</span><input name="email" id="adminFormEmail" type="email" required /></label>
          <label class="admin-field"><span>Роль</span>
            <select name="role" id="adminFormRole">
              <option value="READER">Читатель</option>
              <option value="LIBRARIAN">Библиотекарь</option>
              <option value="ADMIN">Администратор</option>
            </select>
          </label>
          <div class="admin-ban-block">
            <p class="admin-ban-line" id="adminBanLine">Статус: <span id="adminBanStateText">—</span></p>
            <div class="admin-ban-actions">
              <button type="button" id="adminBlockUser" class="admin-btn-block">Заблокировать</button>
              <button type="button" id="adminUnblockUser" class="admin-btn-unblock secondary">Разблокировать</button>
            </div>
          </div>
          <div class="admin-field">
            <span>Новый пароль (задаёт админ)</span>
            <input name="newAdminPassword" id="adminFormNewPass" type="password" minlength="8" autocomplete="new-password" placeholder="Оставьте пустым, если не менять пароль" />
          </div>
          <div class="admin-form-actions">
            <button type="submit">Сохранить изменения</button>
            <button type="button" id="adminDeleteUser" class="danger">Удалить аккаунт</button>
          </div>
        </form>
      </article>
    </div>
  </section>`;
}

function isAuthed() {
  return Boolean(state.token);
}

function profileInitials(fullName) {
  const clean = String(fullName || "").trim();
  if (!clean) return "U";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "U";
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function profileGameId(userId) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return "—";
  return `607080${id}`;
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
        { value: "LIBRARIAN", label: "Библиотекарь" }
      ],
      "READER"
    )}
    <div id="registerLibrarianWrap" class="register-librarian-wrap" hidden>
      <label class="admin-field"><span>Код библиотекаря (10 цифр)</span>
        <input name="librarianCode" id="registerLibrarianCode" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="14" autocomplete="one-time-code" placeholder="0000000000" />
      </label>
    </div>
    <button type="submit">Создать аккаунт</button>
  </form>`;
}

function personalBookForm() {
  return `<h4 id="personalFormHeading">${state.editingId ? "Редактировать мою книгу" : "Добавить книгу в личную библиотеку"}</h4>
  <form id="personalBookForm">
    <input name="title" placeholder="Название" required />
    <input name="author" placeholder="Автор" required />
    <input name="year" class="input-year" type="number" min="500" max="${new Date().getFullYear()}" placeholder="Год" required />
    <input type="hidden" name="genre" id="personalGenre" value="" />
    ${comboSelect(
      "personalGenre",
      "Жанр (можно выбрать или ввести свой)",
      [
        "Роман",
        "Фантастика",
        "Фэнтези",
        "Детектив",
        "Приключения",
        "Научпоп",
        "Психология",
        "Философия",
        "История",
        "Бизнес",
        "Образование",
        "Поэзия",
        "Драма",
        "Классика"
      ]
    )}
    <div class="cover-url-wrap" id="personalCoverUrlWrap">
      <input name="coverUrl" id="personalCoverUrl" type="url" placeholder="Ссылка на обложку (https://...)" />
      <div class="cover-url-custom-tip" id="personalCoverUrlTip" role="tooltip" aria-hidden="true">
        Сначала удалите файл обложки, чтобы указать ссылку из интернета.
      </div>
    </div>
    <div class="file-block file-block-personal">
      <div class="file-block-heading">Загрузить обложку</div>
      <div class="file-personal-row-wrap" id="personalCoverFileRowWrap">
        <div class="file-personal-row">
          <label class="file-fake-btn file-fake-btn-row">
            <input name="coverFile" id="personalCoverFile" type="file" accept="image/*" class="input-file-overlay" />
            <span data-personal-file-btn-text>Выбрать файл</span>
          </label>
          <button type="button" id="personalCoverFileRemove" class="file-remove-btn secondary" hidden>Удалить файл</button>
        </div>
        <div class="cover-url-custom-tip file-cover-row-tip" id="personalCoverFileTip" role="tooltip" aria-hidden="true">
          Сначала очистите поле со ссылкой на обложку, чтобы загрузить файл с компьютера.
        </div>
      </div>
      <div id="personalCoverFileStatus" class="file-status-text" aria-live="polite"></div>
    </div>
    <div id="personalCoverPreview" class="cover-preview ${state.coverDraft ? "has-image" : ""}">
      ${state.coverDraft ? `<img src="${state.coverDraft}" alt="Предпросмотр" />` : "<span>Предпросмотр обложки</span>"}
    </div>
    <textarea name="contentText" rows="6" placeholder="Вставьте текст книги сюда (до ~250 тыс. символов)"></textarea>
    <div class="inline-actions">
      <button type="submit">${state.editingId ? "Сохранить" : "Добавить"}</button>
      <button type="button" id="cancelPersonalEdit" class="secondary">Сбросить</button>
    </div>
  </form>`;
}

function comboSelect(id, placeholder, options) {
  return `<div class="combo-select" data-combo-select="${id}">
    <div class="combo-input-wrap">
      <input type="text" class="combo-input" data-combo-input placeholder="${escapeAttr(placeholder)}" autocomplete="off" />
      <button type="button" class="combo-caret" data-combo-trigger aria-label="Открыть список"></button>
    </div>
    <div class="combo-menu" data-combo-menu>
      ${options
        .map(
          (label) =>
            `<button type="button" class="combo-option" data-combo-option data-value="${escapeAttr(label)}">${label}</button>`
        )
        .join("")}
    </div>
  </div>`;
}
function catalogBookForm() {
  return `<form id="catalogBookForm">
    <input name="title" placeholder="Название" required />
    <input name="author" placeholder="Автор" required />
    <input name="isbn" placeholder="ISBN" required />
    <input name="year" class="input-year" type="number" min="1800" max="${new Date().getFullYear()}" required />
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
    <textarea name="contentText" rows="4" placeholder="Фрагмент или полный текст в каталоге"></textarea>
    <div class="inline-actions">
      <button type="submit">${state.editingCatalogId ? "Сохранить публикацию" : "Опубликовать"}</button>
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

export function renderPersonalFavoritesListOnly() {
  const fav = document.querySelector("#favoriteList");
  if (!fav) return;
  if (!state.favoriteBooks.length) fav.innerHTML = `<p class="empty">Пока пусто — добавьте книги в избранное в каталоге.</p>`;
  else fav.innerHTML = state.favoriteBooks.map((b) => buildBookCard(b, "favorites")).join("");
}

export function renderPersonalMyBooksListOnly() {
  const mine = document.querySelector("#myBookList");
  if (!mine) return;
  if (!state.myBooks.length) mine.innerHTML = `<p class="empty">Вы ещё не добавляли свои книги.</p>`;
  else mine.innerHTML = state.myBooks.map((b) => buildBookCard(b, "mine")).join("");
}

export function renderPersonalLists() {
  renderPersonalFavoritesListOnly();
  renderPersonalMyBooksListOnly();
}

export function renderAdminUserListDom() {
  const list = document.querySelector("#adminUserList");
  const label = document.querySelector("#adminPageLabel");
  const codeLine = document.querySelector("#adminLibrarianCodeLine");
  if (codeLine) {
    codeLine.textContent = state.adminUi.lastLibrarianCode
      ? `Код для регистрации библиотекаря: ${state.adminUi.lastLibrarianCode}`
      : "";
  }
  if (!list) return;
  const items = state.adminUi.items || [];
  if (!items.length) {
    list.innerHTML = state.adminUi.loading
      ? `<p class="empty">Загрузка…</p>`
      : `<p class="empty">Пользователи не найдены.</p>`;
  } else {
    list.innerHTML = items
      .map((u, idx) => {
        const same = Number(u.id) === Number(state.adminUi.selectedId);
        const sel = same ? " is-selected" : "";
        const kb = idx === state.adminUi.kbIndex ? " is-kb-active" : "";
        const roleRu = ROLE_LABELS[u.role] || u.role;
        return `<button type="button" class="admin-user-row${sel}${kb}" data-admin-user="${u.id}" role="option" aria-selected="${same}">
          <span class="au-name">${escapeAttr(u.fullName)}</span>
          <span class="au-email">${escapeAttr(u.email)}</span>
          <span class="au-meta">${escapeAttr(roleRu)}${u.banned ? " · заблокирован" : ""} · id ${u.id}</span>
        </button>`;
      })
      .join("");
  }
  if (label) {
    label.textContent = `Страница ${state.adminUi.page} из ${state.adminUi.pages || 1} · всего ${state.adminUi.total}`;
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
