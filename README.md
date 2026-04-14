# Library Nexus - Курсовой проект

Полноценное клиент-серверное CRUD приложение для управления библиотекой.

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
- Регистрация/вход пользователя
- JWT-аутентификация
- Ролевая модель: `ADMIN`, `LIBRARIAN`, `READER`
- CRUD книг с RBAC и валидацией
- Заполнение тестовыми данными (`prisma seed`)
- Фаззинг-валидация логина

## Быстрый старт (локально)
1. Создать `.env` в `backend/` на основе `backend/.env.example`.
2. Установить зависимости:
   - `cd backend && npm install`
   - `cd ../frontend && npm install`
3. Сгенерировать Prisma client:
   - `cd ../backend && npm run prisma:generate`
4. Поднять БД и сервисы:
   - `cd .. && docker compose up --build -d`
5. Заполнить БД:
   - `docker compose exec backend npm run prisma:seed`

## Тесты
- Интеграция: `cd backend && npm test`
- Фаззинг: `cd backend && npm run test:fuzz`

## UML и аналитика
- Анализ предметной области: `docs/domain-analysis.md`
- UML архитектуры: `docs/uml-architecture.puml`
- Шаблон отчета фаззинга: `docs/fuzzing-report-template.md`

## Docker и облако (места под токены и логи)
- Шаблон облачного деплоя: `docs/cloud-deploy-template.md`
- Общие placeholders: `.env.example`

## Данные для демо
- admin: `admin@library.local` / `Admin123!`
- reader: `reader@library.local` / `Reader123!`

