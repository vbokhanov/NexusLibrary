# Library Nexus - Курсовой проект

Клиент-серверное приложение для электронной библиотеки: общий каталог, личная библиотека пользователя, чтение книг в браузере и скачивание текстов.

## Стек
- **Frontend:** Vite + TypeScript + адаптивный CSS
- **Backend:** Node.js + Express + Prisma + JWT + Zod
- **DB:** PostgreSQL
- **Тесты:** Jest + Supertest + Fast-check (фаззинг)
- **DevOps:** Docker, docker-compose

## Структура проекта
```text
.
├── backend/
│   ├── src/              # API, middleware, controllers, validators
│   ├── prisma/           # schema + seed
│   ├── tests/            # integration + fuzz tests
│   └── Dockerfile
├── frontend/
│   ├── src/              # UI + API client
│   └── Dockerfile
├── docs/                 # анализ, UML, шаблоны отчётов
├── docker-compose.yml
└── README.md
```

## Функциональность
- Регистрация/вход, JWT-аутентификация, сохранение сессии после перезагрузки страницы
- Роли: `ADMIN`, `LIBRARIAN`, `READER`
- Общий каталог книг с поиском, фильтрами, сортировкой и бесконечной прокруткой
- Личная библиотека (доступна только после входа):
  - мои книги (добавление/редактирование/удаление владельцем)
  - избранное из общего каталога
- Ролевой доступ:
  - `READER` и `GUEST`: просмотр каталога, чтение, избранное
  - `LIBRARIAN`/`ADMIN`: управление общим каталогом
- Чтение книги в браузере (`/api/books/:id/text`) и скачивание `.txt`
- Импорт 1000+ реальных электронных книг (Gutendex / Project Gutenberg)
- Seed демо-данных и демо-текстов книг
- Интеграционные тесты + fuzz тест для auth-валидации

## Быстрый старт (Docker)
1. Создайте `backend/.env` на основе `backend/.env.example`.
2. Поднимите стек:

   - `docker compose up --build -d`
   - `docker compose up -d`
   - если меняли Dockerfile/зависимости: `docker compose up --build -d`

3. Примените миграции и заполните демо-данные:
   - `docker compose exec backend npx prisma migrate deploy`
   - `docker compose exec backend npm run prisma:seed`
4. (Опционально) Импортируйте 1000+ книг с реальными текстами:
   - `docker compose exec backend npm run prisma:import:gutendex -- 1200`
5. Откройте:
   - frontend: `http://localhost:5173`
   - backend health: `http://localhost:4000/api/health`

## Быстрый старт (локально без Docker frontend)
1. Установите зависимости:
   - `cd backend && npm install`
   - `cd ../frontend && npm install`
2. Поднимите postgres (например, Docker) и настройте `DATABASE_URL` в `backend/.env`.
3. Примените миграции и seed:
   - `cd backend && npx prisma migrate deploy`
   - `npm run prisma:seed`
4. Запустите backend и frontend:
   - `npm run dev` (в `backend`)
   - `npm run dev` (в `frontend`)

## Тесты
- Интеграция: `cd backend && npm test`
- Фаззинг: `cd backend && npm run test:fuzz`

## Команды для проверки исправлений

### 1) Проверка авторизации и регистрации
```bash
# Health-check
curl http://localhost:4000/api/health

# Регистрация
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"fullName\":\"Иван Тестов\",\"email\":\"ivan_test@example.com\",\"password\":\"Password123\",\"role\":\"READER\"}"

# Логин
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"ivan_test@example.com\",\"password\":\"Password123\"}"
```

### 2) Проверка каталога с пагинацией
```bash
curl "http://localhost:4000/api/books?take=24&skip=0&sort=newest&q=&genre=all"
curl "http://localhost:4000/api/books?take=24&skip=24&sort=newest&q=&genre=all"
curl "http://localhost:4000/api/books/meta/genres"
```

### 3) Проверка чтения/скачивания книги
```bash
# Чтение в браузере / plain text
curl "http://localhost:4000/api/books/1/text"

# Скачивание .txt
curl -OJ "http://localhost:4000/api/books/1/text?download=1"
```

### 4) Проверка личной библиотеки (нужен токен)
```bash
# Получите токен из /auth/login и подставьте в TOKEN
curl "http://localhost:4000/api/books/mine" \
  -H "Authorization: Bearer TOKEN"

curl -X POST "http://localhost:4000/api/books/personal" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Моя книга\",\"author\":\"Я\",\"year\":2025,\"genre\":\"Эссе\",\"contentText\":\"Текст книги\"}"
```


## Если ошибка Docker Hub (TLS handshake timeout)
- Сообщение вида `failed to fetch oauth token ... TLS handshake timeout` означает сетевую проблему доступа Docker daemon к Docker Hub.
- Для запуска уже собранного проекта без скачивания образов используйте:
  - `docker compose up -d`
- Для проверки, что всё поднялось:
  - `docker compose ps`
  - `curl http://localhost:4000/api/health`


## UML и аналитика
- Анализ предметной области: `docs/domain-analysis.md`
- UML архитектуры: `docs/uml-architecture.puml`
- Шаблон отчета фаззинга: `docs/fuzzing-report-template.md`

## Docker и облако (места под токены и логи)
- Шаблон облачного деплоя: `docs/cloud-deploy-template.md`
- Общие placeholders: `.env.example`

## Данные для демо
- admin: `admin@library.local` / `Admin123!`
- librarian: `librarian@library.local` / `Librarian123!`
- reader: `reader@library.local` / `Reader123!`

