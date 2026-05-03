# Library Nexus

## О проекте

**Library Nexus** — учебный полнофункциональный веб-сервис электронной библиотеки: отдельный **REST API** на Node.js и **одностраничное приложение (SPA)** в браузере. Данные хранятся в **PostgreSQL**; доступ к API для залогиненных пользователей по **JWT**.

**С точки зрения пользователя сервис позволяет:**

- Просматривать **общий каталог** книг с поиском, фильтром по жанру, сортировкой и подгрузкой при прокрутке.
- **Регистрироваться и входить** под ролью **читатель** или **библиотекарь** (для библиотекаря может потребоваться код приглашения).
- Вести **личную библиотеку**: свои загруженные книги, **избранное** из общего каталога, публикация в общий фонд (для ролей с правами).
- **Читать текст** книги в модальном окне в браузере и **скачивать** его в виде `.txt`; смотреть **обложки** (в т.ч. по URL или data URI).
- Администратору — **управление пользователями** и служебными сущностями (в рамках заложенной в проект модели прав).

**С точки зрения архитектуры:** фронтенд обращается к бэкенду по HTTP; бэкенд валидирует входные данные (**Zod**), работает с БД через **Prisma**, выдаёт JSON и потоки для текстов/обложек. Служебный администратор с фиксированным `id=1` создаётся при старте API (**bootstrap**), чтобы система всегда была управляема после чистой установки.

Импорт демонстрационного наполнения каталога выполняется **скриптами** (Gutendex / Open Library) — это не часть UI, а отдельные команды после поднятия БД и сида.

## Стек

Vite 5 + TypeScript · Express 5 + Prisma 6 + Zod 4 · PostgreSQL 16 · JWT · Docker Compose.

**URL при запуске через Compose:** API `http://localhost:4000/api` · SPA **http://localhost:5173** (nginx в контейнере `library-frontend`).

## Файл `backend/.env` и раздел «Перед первым docker compose»

**Зачем вообще `.env`:** бэкенду для работы нужны как минимум строка подключения к БД (**`DATABASE_URL`**) и секрет для подписи токенов (**`JWT_SECRET`**). Они не хранятся в репозитории в открытом виде; шаблон значений лежит в **`backend/.env.example`**, рабочая копия — в **`backend/.env`** (файл обычно в `.gitignore`).

**Когда нужен именно шаг «скопировать `.env.example` → `.env`»:**

- Если вы поднимаете проект через **`docker compose`**: в `docker-compose.yml` у сервиса `backend` указано **`env_file: ./backend/.env`**. Без этого файла (или с пустым/чужим содержимым) контейнер API не получит корректные переменные — миграции, Prisma и JWT не заведутся как задумано. Для Compose в **`DATABASE_URL`** хост БД должен быть **`db`** (имя сервиса Postgres в той же сети), логин/пароль/имя БД — как в `docker-compose.yml`: `library_user` / `library_pass` / `library_db`. **`JWT_SECRET`** замените на свою длинную случайную строку (в примере стоит заглушка `CHANGE_ME_FOR_PRODUCTION`).

**Почему вы могли «этого не делать» и при этом всё работало:**

- Запускали **без Docker** (раздел «Без Docker»): тогда вы всё равно создавали **`backend/.env` вручную** или копировали example один раз раньше — просто не по инструкции из заголовка «Перед первым docker compose».
- Файл **`.env` уже существовал** у вас локально (скопирован с другой машины, не удалялся между ветками и т.д.).
- Пользовались только **тестами** (`npm test` в `backend`/`frontend`): там Prisma и API **мокируются**, поднятая Postgres для Docker не обязательна — к шагу с `.env` для Compose это не привязывается.

Итого: блок **«Перед первым `docker compose`»** — это чеклист для тех, кто **впервые** поднимает стек в Docker; если вы не используете Compose или `.env` у вас уже настроен, формально «копировать example» повторно не требуется.

## Перед первым `docker compose`

1. Скопировать `backend/.env.example` → `backend/.env`.
2. В **`DATABASE_URL`** для Compose хост БД — **`db`**, пользователь / пароль / имя БД как в `docker-compose.yml` (`library_user` / `library_pass` / `library_db`). В примере из `.env.example` это уже так.
3. Задать свой **`JWT_SECRET`** (не оставлять заглушку для реального деплоя).
4. При необходимости поправить **`CORS_ORIGIN`** под ваши URL фронта (в примере указаны localhost).

## Docker: поднять → сид → наполнить каталог → логи

Все команды из **корня репозитория** (где `docker-compose.yml`).

```bash
# Сборка и старт (миграции выполняются при старте backend: start:docker)
docker compose up --build -d

docker compose ps

# Демо-пользователи (один раз после первого запуска или после полного сброса тома БД)
docker compose exec backend npm run prisma:seed

# Импорт книг в ОБЩИЙ каталог (число — цель по строкам, фактически может быть меньше)
docker compose exec backend npm run prisma:import:gutendex -- 200

# Альтернатива: Open Library (число — цель; скрипт может создать admin@library.local — не путать с admin@nexus.local)
docker compose exec backend npm run prisma:import:real -- 100

# Логи API
docker compose logs -f backend

# Перезапуск только API после смены .env
docker compose restart backend
```

## Docker: чистка данных

**Только книги общего каталога** (`ownerUserId` пустой; связанные `Borrow` удалятся каскадом с книгой):

```bash
docker compose exec -T db psql -U library_user -d library_db -c "DELETE FROM \"Book\" WHERE \"ownerUserId\" IS NULL;"
```

**Все книги** (займы удалятся каскадом с книгами):

```bash
docker compose exec -T db psql -U library_user -d library_db -c "DELETE FROM \"Book\";"
```

**Одноразовые коды библиотекарей** (если забили таблицу тестами):

```bash
docker compose exec -T db psql -U library_user -d library_db -c "DELETE FROM \"LibrarianInviteCode\";"
```

**Полный сброс схемы под миграции** (пустые таблицы; потом снова сид):

```bash
docker compose exec backend npx prisma migrate reset --force
docker compose exec backend npm run prisma:seed
```

**Стоп контейнеров / стоп + удалить том Postgres (всё как с нуля):**

```bash
docker compose down
docker compose down -v
```

## Входы

| Кто | Email | Пароль |
|-----|-------|--------|
| Служебный админ `id=1` (bootstrap при старте API) | `admin@nexus.local` | `NexusAdmin2026!` |
| После `prisma:seed` | `librarian@library.local` | `Librarian123!` |
| После `prisma:seed` | `reader@library.local` | `Reader123!` |

## Без Docker (локально)

Нужны Node 20+ и свой Postgres. Порядок: `cd backend` → `npm install` → в `.env` свой `DATABASE_URL` → `npx prisma migrate deploy` → `npm run prisma:seed` → `npm run dev` · второй терминал: `cd frontend` → `npm install` → `npm run dev`. Импорт книг: `npm run prisma:import:gutendex -- 100` (из каталога `backend`).

## Тесты

В **Docker-образе backend нет папки `tests/`**, поэтому Jest, Vitest и Playwright запускаются **на машине разработчика**, не через `docker compose exec`. Нужны `npm install` в `backend/` и `frontend/`.

Если приглашение терминала уже показывает `...\frontend>`, **не** набирайте снова `cd frontend` (получится несуществующая вложенная папка). Строки ниже с префиксом `cd … &&` рассчитаны на запуск **из корня** репозитория (где лежат каталоги `backend` и `frontend`). Цепочки `&&` работают в **Git Bash**, **WSL**, **PowerShell 7+**; в **Windows PowerShell 5.1** выполняйте команды по одной строке.

### Все команды тестов

**Один раз (Playwright, из `frontend`):**

```bash
npm run playwright:install
```

или `npx playwright install chromium`. Если Chromium уже скачан в `%LOCALAPPDATA%\ms-playwright\`, вывода почти не будет — это нормально; проверка: `npm run test:e2e`.

**Backend (`backend/`):**

```bash
npm test
npm run test:coverage
npm run test:api
npm run test:unit
npm run test:fuzz
```

**Frontend (`frontend/`):**

```bash
npm test
npm run test:watch
npm run test:coverage
npm run playwright:install
npm run test:e2e
```

**Из корня репозитория:**

```bash
cd backend && npm test
cd backend && npm run test:coverage
cd backend && npm run test:api
cd backend && npm run test:unit
cd backend && npm run test:fuzz
cd frontend && npm test
cd frontend && npm run test:watch
cd frontend && npm run test:coverage
cd frontend && npm run playwright:install
cd frontend && npm run test:e2e
```

**Цепочка «всё подряд»** (корень репозитория; нужен shell с `&&`):

```bash
cd backend && npm test && cd ..
cd backend && npm run test:coverage && cd ..
cd frontend && npm test && cd ..
cd frontend && npm run test:coverage && cd ..
cd frontend && npm run test:e2e && cd ..
```

Команды `test:coverage` снова прогоняют те же тесты с инструментированием — так появляются отчёты в `backend/coverage/` и у Vitest.

**Быстрее, без отчётов покрытия:**

```bash
cd backend && npm test && cd ..
cd frontend && npm test && cd ..
cd frontend && npm run test:e2e && cd ..
```

### Только бэкенд — API

Интеграционные HTTP-тесты к приложению Express с **моком Prisma** (`api.integration.test.js`, `api.coverage.integration.test.js`).

Из `backend/`:

```bash
npm run test:api
```

Из корня:

```bash
cd backend && npm run test:api
```

Полный `npm test` по бэкенду **уже включает** эти API-тесты вместе с unit и fuzz.

### Только фронтенд

Из `frontend/`:

```bash
npm test
npm run test:watch
npm run test:coverage
npm run playwright:install
npm run test:e2e
```

Из корня:

```bash
cd frontend && npm test
cd frontend && npm run test:watch
cd frontend && npm run test:coverage
cd frontend && npm run playwright:install
cd frontend && npm run test:e2e
```

`npm run test:coverage` — Vitest + покрытие: **100%** statements / lines / functions по включённым `src/**/*.ts` (исключены `main.ts`, `ui/render.ts`, `features/events.ts`; сценарии UI дублирует E2E).

### Только фаззинг (property-based, только backend)

Из `backend/`:

```bash
npm run test:fuzz
```

Из корня:

```bash
cd backend && npm run test:fuzz
```

В `npm test` по бэкенду fuzz **уже входит**; отдельная команда — чтобы гонять только fuzz-файлы.

### Все тесты только для backend (`backend/`)

Выполнять из папки `backend` или с префиксом `cd backend && …` из корня.

| Команда | Что делает |
|---------|------------|
| `npm test` | Весь Jest: API (`api.integration`, `api.coverage.integration`), unit, fuzz и остальные `tests/**/*.test.js`. |
| `npm run test:coverage` | То же полное дерево тестов + отчёт покрытия в `backend/coverage/`. |
| `npm run test:api` | Только API-интеграция. |
| `npm run test:unit` | Только unit: валидаторы, `catalogBookQuery`, токены, error middleware, ensureAdmin, auth middleware. |
| `npm run test:fuzz` | Только fuzz: `fuzz.auth`, `fuzz.register`, `fuzz.book.validator`, `fuzz.catalogQuery`. |

Из корня:

```bash
cd backend && npm test
cd backend && npm run test:coverage
cd backend && npm run test:api
cd backend && npm run test:unit
cd backend && npm run test:fuzz
```

**Подряд весь бэкенд** (полный прогон + coverage):

```bash
cd backend && npm test && npm run test:coverage
```

`test:api`, `test:unit` и `test:fuzz` — **части** того же набора, что уже входит в `npm test`; их запускают отдельно, когда нужен узкий прогон.

### Вывод в терминале (чтобы не путать с ошибками)

**Backend (Jest):** при `npm test` / `npm run test:coverage` лог HTTP (`GET /api/…`) и `console.error` из кода **по умолчанию скрыты** (`silent: true` в `jest.config.js`, без `morgan` в `NODE_ENV=test`). Итог — только строки `Test Suites` / `Tests` и таблица coverage. Если нужна полная болтовня в консоли для отладки — временно поставьте **`silent: false`** в `backend/jest.config.js`.

**Frontend (Vitest):** строки **`Waiting for file changes…`** и **`No test files found`** — это не падение тестов. Так бывает, если запущен **режим наблюдения** (`npm run test:watch` или `vitest` без `run`) и в фильтре имён файлов (**клавиша `p`**) случайно оказался мусор (например кусок `npm run test:coverage`) — тогда шаблон не совпадает ни с одним `*.test.ts`. Нажмите **`q`**, запустите снова **`npm test`** (один прогон, процесс завершится сам). **`PASS`** в этой строке означает «последний прогон был успешным», а не новый запуск.

**Postman:** импорт `postman/*.json` — бьёт в **живой** API; автопроверки только у Health и Login (см. коллекцию).

## Документация курсового

`docs/domain-analysis.md`, `docs/uml-architecture.puml`, `docs/fuzzing-report-template.md`, `docs/cloud-deploy-template.md`.
