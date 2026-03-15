# Sprint 4 — AI + Интеграции + Polish

**Дата старта:** 2026-03-15
**Ветка:** `claude/display-sprint-4-tasks-1rXtx`
**Цель:** Добавить AI-модуль, внешние интеграции и довести продукт до production-ready состояния.

---

## Статус задач

| # | Задача | Статус | Приоритет |
|---|--------|--------|-----------|
| 4.1 | AI: оценка трудоёмкости | ✅ DONE | P0 |
| 4.2 | AI: декомпозиция требований | ✅ DONE | P0 |
| 4.3 | Telegram-бот: нотификации | ✅ DONE | P1 |
| 4.4 | GitLab webhook: автообновление статусов | ✅ DONE | P1 |
| 4.5 | Экспорт отчётов (CSV, PDF) | ✅ DONE | P1 |
| 4.6 | Performance optimization | ✅ DONE | P2 |
| 4.7 | Security audit | ✅ DONE | P2 |
| 4.8 | Deployment scripts (production) | 🔲 TODO | P2 |
| 4.9 | Документация API (Swagger) | 🔲 TODO | P3 |
| 4.10 | User guide обновление | 🔲 TODO | P3 |

Легенда: 🔲 TODO · 🔄 IN PROGRESS · ✅ DONE

---

## 4.1 — AI: оценка трудоёмкости

**Цель:** По описанию задачи (title + description) AI предлагает оценку в часах с обоснованием.

### Backend

**Что уже есть:** скелет `ai-sessions.service.ts` (логирование AI-сессий в `AiSession` + `TimeLog`).

**Что нужно реализовать:**

1. **`backend/src/modules/ai/ai-estimate.service.ts`**
   - Функция `estimateIssue(issueId, userId)`:
     - Загружает задачу из БД (title, description, type, priority, subtasks)
     - Формирует prompt для Claude API
     - Вызывает `@anthropic-ai/sdk` (модель `claude-haiku-4-5-20251001`)
     - Парсит ответ: `{ hours: number, confidence: 'low'|'medium'|'high', reasoning: string }`
     - Сохраняет результат в `Issue.estimatedHours` + запись в `AiSession`
   - Prompt-шаблон: учитывать тип (EPIC/STORY/TASK/SUBTASK/BUG), приоритет, объём описания

2. **`backend/src/modules/ai/ai.router.ts`** — добавить endpoint:
   ```
   POST /api/ai/estimate/:issueId
   ```
   - Auth required, роли: MANAGER, USER, ADMIN
   - Response: `{ hours, confidence, reasoning, sessionId }`

3. **Prisma:** убедиться, что поле `Issue.estimatedHours` существует (уже есть в schema.prisma)

### Frontend

4. **`frontend/src/components/issues/AiEstimateButton.tsx`**
   - Кнопка «AI оценка» на странице задачи (`IssueDetailPage`)
   - Состояния: idle → loading → результат (часы + уверенность + обоснование)
   - Ant Design: `Button` + `Tooltip` + `Spin` + `Alert`

5. **`frontend/src/api/ai.ts`** — добавить `estimateIssue(issueId)`

### Критерии готовности
- [ ] POST `/api/ai/estimate/:issueId` возвращает оценку
- [ ] Результат сохраняется в `Issue.estimatedHours`
- [ ] Кнопка в UI работает, показывает результат
- [ ] AI-сессия логируется в `AiSession`
- [ ] Тест: `backend/tests/ai.test.ts` (мок Claude API)

---

## 4.2 — AI: декомпозиция требований

**Цель:** По описанию EPIC/STORY AI предлагает список дочерних задач для создания одним кликом.

### Backend

1. **`backend/src/modules/ai/ai-decompose.service.ts`**
   - Функция `decomposeIssue(issueId, userId)`:
     - Загружает задачу (должна быть EPIC или STORY)
     - Формирует prompt: «разбей на подзадачи типа TASK»
     - Вызывает Claude API (модель `claude-haiku-4-5-20251001`)
     - Парсит ответ: `{ tasks: Array<{ title, description, estimatedHours }> }`
     - Возвращает предложения (НЕ создаёт автоматически — пользователь подтверждает)

2. **`backend/src/modules/ai/ai.router.ts`** — добавить endpoint:
   ```
   POST /api/ai/decompose/:issueId
   ```
   - Response: `{ suggestions: Task[], sessionId }`
   - Валидация: issue.type должен быть EPIC или STORY

3. **`backend/src/modules/ai/ai.router.ts`** — добавить endpoint для подтверждения:
   ```
   POST /api/ai/decompose/:issueId/apply
   ```
   - Body: `{ selectedIndexes: number[] }` — какие задачи из suggestions создать
   - Создаёт Issue записи через `issues.service`

### Frontend

4. **`frontend/src/components/issues/AiDecomposePanel.tsx`**
   - Панель «Декомпозиция AI» на `IssueDetailPage` (только для EPIC/STORY)
   - Кнопка «Разобрать» → список предложений с чекбоксами → «Создать выбранные»
   - Ant Design: `Collapse` + `Checkbox.Group` + `List` + `Button`

5. **`frontend/src/api/ai.ts`** — добавить `decomposeIssue(issueId)`, `applyDecompose(issueId, selectedIndexes)`

### Критерии готовности
- [ ] POST `/api/ai/decompose/:issueId` возвращает предложения
- [ ] POST `/api/ai/decompose/:issueId/apply` создаёт задачи
- [ ] UI показывает панель только для EPIC/STORY
- [ ] Пользователь может выбрать подмножество задач перед созданием
- [ ] Тест покрывает happy path + ошибку для неверного типа задачи

---

## 4.3 — Telegram-бот: нотификации

**Цель:** Пользователи получают уведомления в Telegram при изменении задач.

### Backend

1. **`backend/src/modules/integrations/telegram/telegram.service.ts`**
   - Инициализация `node-telegram-bot-api` (webhook mode в production, polling в dev)
   - Функции: `sendNotification(chatId, text)`, `formatIssueEvent(event, issue)`
   - Env vars: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_URL`

2. **`backend/src/modules/integrations/telegram/telegram.router.ts`**
   - `POST /api/integrations/telegram/webhook` — приём обновлений от Telegram
   - `POST /api/integrations/telegram/subscribe` — привязка `chatId` к пользователю
   - `DELETE /api/integrations/telegram/unsubscribe` — отвязка

3. **Prisma — новая модель** `TelegramSubscription`:
   ```prisma
   model TelegramSubscription {
     id        Int      @id @default(autoincrement())
     userId    Int      @unique
     chatId    String
     active    Boolean  @default(true)
     createdAt DateTime @default(now())
     user      User     @relation(fields: [userId], references: [id])
   }
   ```

4. **Подписка на события** — в `issues.service.ts` при смене статуса/исполнителя вызывать `telegram.service.notifyAssignee(issue, event)`

5. **Типы событий для нотификаций:**
   - Задача назначена на пользователя
   - Статус задачи изменён
   - Добавлен комментарий
   - Приближается дедлайн (за 24ч, cron-job)

### Frontend

6. **`frontend/src/pages/ProfilePage.tsx`** или раздел в `AdminPage`
   - Блок «Telegram-нотификации»: инструкция по подключению + кнопка «Отвязать»
   - Показывает статус: подключён / не подключён

### Критерии готовности
- [ ] Бот отправляет сообщение при смене статуса задачи
- [ ] Пользователь может привязать/отвязать Telegram через UI
- [ ] Webhook защищён секретным токеном
- [ ] Миграция Prisma добавляет `TelegramSubscription`
- [ ] Env vars документированы в `.env.example`

---

## 4.4 — GitLab webhook: автообновление статусов

**Цель:** При создании MR/коммита в GitLab — статус связанной задачи обновляется автоматически.

### Backend

1. **`backend/src/modules/integrations/gitlab/gitlab.service.ts`**
   - Парсинг GitLab webhook payload (push, merge_request events)
   - Извлечение ключа задачи из commit message / MR title (regex: `[A-Z]+-\d+`)
   - Маппинг событий → статусы Issue:
     - MR opened → `IN_PROGRESS`
     - MR merged → `REVIEW`
     - MR merged + pipeline passed → `DONE`

2. **`backend/src/modules/integrations/gitlab/gitlab.router.ts`**
   - `POST /api/integrations/gitlab/webhook`
   - Верификация `X-Gitlab-Token` заголовка
   - `POST /api/integrations/gitlab/configure` — сохранить GitLab project URL + token (только ADMIN)
   - `GET /api/integrations/gitlab/status` — статус интеграции

3. **Prisma — новая модель** `GitLabIntegration`:
   ```prisma
   model GitLabIntegration {
     id           Int      @id @default(autoincrement())
     projectId    Int      @unique
     gitlabUrl    String
     gitlabToken  String
     webhookToken String
     active       Boolean  @default(true)
     createdAt    DateTime @default(now())
     project      Project  @relation(fields: [projectId], references: [id])
   }
   ```

### Frontend

4. **`frontend/src/pages/AdminPage.tsx`** — вкладка «Интеграции»
   - Форма настройки GitLab: URL репозитория + Secret Token
   - Инструкция: как настроить webhook в GitLab
   - Статус последнего события (timestamp + тип)

5. **`frontend/src/api/integrations.ts`** — `configureGitlab(data)`, `getGitlabStatus()`

### Критерии готовности
- [ ] Webhook принимает push и merge_request события
- [ ] Статус задачи меняется при открытии/мёрже MR
- [ ] Webhook защищён токеном (`X-Gitlab-Token`)
- [ ] Конфигурация через UI (только ADMIN)
- [ ] Ключ задачи извлекается из `fix PROJ-42: ...` и `PROJ-42` форматов
- [ ] Миграция Prisma

---

## 4.5 — Экспорт отчётов (CSV, PDF)

**Цель:** Менеджеры могут выгрузить отчёты по задачам и времени в CSV и PDF.

### Backend

1. **`backend/src/modules/reports/reports-export.service.ts`**
   - `exportIssuesCsv(projectId, filters)` → Buffer (CSV)
   - `exportIssuesPdf(projectId, filters)` → Buffer (PDF)
   - `exportTimeCsv(projectId, dateRange)` → Buffer
   - Зависимости: `csv-stringify`, `pdfkit`

2. **`backend/src/modules/reports/reports.router.ts`** — добавить endpoints:
   ```
   GET /api/reports/issues/export?format=csv&projectId=...
   GET /api/reports/issues/export?format=pdf&projectId=...
   GET /api/reports/time/export?format=csv&projectId=...&from=...&to=...
   ```
   - Заголовки ответа: `Content-Disposition: attachment; filename="..."`
   - Роли: ADMIN, MANAGER

3. **CSV структура для задач:**
   ```
   ID, Key, Title, Type, Status, Priority, Assignee, Sprint, EstimatedHours, LoggedHours, CreatedAt, UpdatedAt
   ```

4. **PDF структура:** таблица с теми же полями + заголовок с датой/проектом/фильтрами

### Frontend

5. **`frontend/src/pages/ReportsPage.tsx`** — добавить кнопки экспорта
   - «Выгрузить CSV» / «Выгрузить PDF» рядом с каждым отчётом
   - `download` через `a.href = blob URL`

### Критерии готовности
- [ ] CSV корректно открывается в Excel/LibreOffice
- [ ] PDF содержит таблицу с данными и заголовок
- [ ] Фильтры (проект, период, статус) применяются к экспорту
- [ ] Файл отдаётся с правильными заголовками (`Content-Type`, `Content-Disposition`)
- [ ] Доступно только ADMIN и MANAGER

---

## 4.6 — Performance optimization

**Цель:** API p95 < 200ms, загрузка страниц < 2s при 100+ задачах в проекте.

### Backend

1. **Redis-кэш для тяжёлых запросов:**
   - `GET /api/projects/:id/board` — кэш 30с, инвалидация при смене статуса
   - `GET /api/reports/*` — кэш 5 мин
   - Использовать `backend/src/shared/redis.ts`

2. **Индексы Prisma** — проверить и добавить:
   ```prisma
   @@index([projectId, status])   // Issue
   @@index([assigneeId, status])  // Issue
   @@index([sprintId])            // Issue
   @@index([issueId, logDate])    // TimeLog
   ```
   Добавить в `schema.prisma` + миграция

3. **Пагинация** для `GET /api/issues`:
   - Параметры `page`, `limit` (default 50, max 200)
   - Курсорная пагинация для Kanban (бесконечный скролл)

4. **N+1 запросы:** аудит основных endpoints, добавить `include` там где нужно

### Frontend

5. **React.memo / useMemo** для тяжёлых компонентов:
   - Kanban колонки (`BoardPage`)
   - Таблица задач (`ProjectDetailPage`)

6. **Виртуализация** для длинных списков (> 100 элементов):
   - Использовать Ant Design `Table` с `virtual` prop (AntD 5.x)

7. **Bundle analysis:** `npm run build -- --analyze`, убрать неиспользуемые зависимости

### Критерии готовности
- [ ] Lighthouse score > 85 на `/projects/:id`
- [ ] API `/board` отвечает < 100ms при кэше
- [ ] 1000 задач в проекте — UI не тормозит
- [ ] Индексы добавлены в schema.prisma

---

## 4.7 — Security audit

**Цель:** Устранить уязвимости OWASP Top 10, привести к ФЗ-152 requirements.

### Чеклист

**Аутентификация и авторизация:**
- [ ] Refresh tokens хранятся в httpOnly cookie (не localStorage)
- [ ] Access token expire ≤ 15 минут
- [ ] Rate limiting на `/api/auth/*` — не более 10 попыток/мин с IP
- [ ] Logout инвалидирует refresh token в Redis/БД
- [ ] Проверить: все мутирующие endpoints имеют RBAC middleware

**Валидация и инъекции:**
- [ ] Все входные данные проходят Zod-валидацию
- [ ] SQL-инъекции исключены (Prisma parameterized queries — ok по умолчанию)
- [ ] XSS: markdown/HTML в комментариях — санитизация через `DOMPurify` на фронте
- [ ] Path traversal в file upload/export — если применимо

**Конфигурация:**
- [ ] `helmet.js` подключён (CSP, X-Frame-Options, HSTS)
- [ ] CORS настроен на конкретные origins (не `*`)
- [ ] Secrets не логируются (проверить `console.log` в auth модуле)
- [ ] `.env` не попадает в Docker image (`.dockerignore`)

**Данные:**
- [ ] Пароли хранятся bcrypt (cost ≥ 12) — проверить текущий cost factor
- [ ] PII поля задокументированы (ФЗ-152): email, displayName

**Внешние интеграции:**
- [ ] Telegram webhook token хранится в env, не в коде
- [ ] GitLab token шифруется в БД (`crypto.createCipheriv`) или хранится в vault

### Реализация

1. **`backend/src/app.ts`** — добавить `helmet()`, настроить CORS whitelist
2. **`backend/src/modules/auth/auth.router.ts`** — добавить `express-rate-limit`
3. **`frontend/src/components/issues/CommentItem.tsx`** — санитизация HTML
4. Документ `docs/RU/SECURITY_AUDIT_REPORT.md` с результатами проверки

### Критерии готовности
- [ ] `npm audit` — 0 critical, 0 high уязвимостей
- [ ] Все пункты чеклиста закрыты или задокументированы как accepted risk
- [ ] Отчёт создан

---

## 4.8 — Deployment scripts (production)

**Цель:** Воспроизводимый деплой на Ubuntu 22.04 / Astra Linux / Red OS.

### Что создать

1. **`deploy/docker-compose.prod.yml`**
   - Добавить Nginx reverse proxy (порт 80/443)
   - `restart: unless-stopped` для всех сервисов
   - Healthchecks для PostgreSQL, Redis, backend
   - Volumes для данных PostgreSQL (named volume)
   - Убрать dev-только настройки

2. **`deploy/nginx/nginx.conf`**
   - Проксирование: `/ → frontend:3000`, `/api → backend:3001`
   - Gzip compression
   - Security headers
   - Заглушка для SSL (самоподписанный + Let's Encrypt инструкция)

3. **`deploy/scripts/deploy.sh`**
   ```bash
   # Сценарий:
   # 1. git pull origin main
   # 2. docker compose -f docker-compose.prod.yml build
   # 3. docker compose run backend npx prisma migrate deploy
   # 4. docker compose up -d
   # 5. Проверка healthcheck
   ```

4. **`deploy/scripts/backup.sh`**
   - `pg_dump` PostgreSQL в `/var/backups/tasktime/`
   - Ротация: хранить последние 7 дней
   - Cron-пример в комментарии

5. **`deploy/scripts/setup-server.sh`**
   - Установка Docker + Docker Compose на Ubuntu/Astra
   - Создание системного пользователя `tasktime`
   - Создание systemd unit (опционально, для bare-metal)

6. **`.env.production.example`** — все переменные с описанием

### Критерии готовности
- [ ] `docker compose -f deploy/docker-compose.prod.yml up -d` поднимает систему
- [ ] Nginx отдаёт фронт и проксирует API
- [ ] Скрипт deploy.sh идемпотентен (повторный запуск безопасен)
- [ ] backup.sh создаёт валидный дамп
- [ ] Инструкция в `docs/RU/ADMIN_GUIDE.md` обновлена

---

## 4.9 — Документация API (Swagger)

**Цель:** Интерактивная документация всех API endpoints.

### Реализация

1. **Зависимости:**
   ```bash
   npm install swagger-ui-express swagger-jsdoc
   npm install -D @types/swagger-ui-express @types/swagger-jsdoc
   ```

2. **`backend/src/shared/swagger.ts`**
   - Конфигурация `swagger-jsdoc`: title, version, servers
   - Базовые компоненты: `SecurityScheme` (Bearer JWT), общие схемы ответов

3. **Аннотации в роутерах** — JSDoc `@openapi` комментарии в ключевых endpoints:
   - Auth: register, login, refresh, me
   - Issues: CRUD + статусы
   - Sprints: create, start, close
   - AI: estimate, decompose

4. **`backend/src/app.ts`** — подключить:
   ```typescript
   app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
   ```
   Доступно только в non-production или с ADMIN токеном.

5. **`docs/RU/API.md`** — обновить ссылкой на `/api/docs`

### Критерии готовности
- [ ] `/api/docs` открывается в браузере
- [ ] Все endpoints Sprint 4 задокументированы
- [ ] Try-it-out работает с Bearer токеном
- [ ] В production Swagger закрыт за auth или отключён через env flag

---

## 4.10 — User guide обновление

**Цель:** Актуальная документация для конечных пользователей.

### Что обновить

1. **`docs/RU/USER_GUIDE.md`** — добавить разделы:
   - **AI-оценка задач:** как запустить, что означает уверенность (low/medium/high)
   - **Декомпозиция с AI:** пошаговая инструкция для PM
   - **Telegram-нотификации:** привязка аккаунта
   - **Экспорт отчётов:** форматы, фильтры, ограничения
   - **GitLab интеграция:** для тимлидов (как настроить в проекте)

2. **Скриншоты / мокапы** — описание интерфейса текстом (скриншоты добавит PO вручную)

3. **`docs/RU/ADMIN_GUIDE.md`** — добавить разделы:
   - Настройка Telegram-бота (получение токена, настройка webhook)
   - Настройка GitLab webhook
   - Production деплой (ссылка на deploy скрипты)
   - Бэкап и восстановление

### Критерии готовности
- [ ] USER_GUIDE содержит все функции Sprint 4
- [ ] ADMIN_GUIDE содержит инструкции по интеграциям и деплою
- [ ] Нет ссылок на несуществующие страницы/функции

---

## Порядок выполнения (рекомендуемый)

```
Неделя 1 (P0):
  4.1 AI estimate  →  4.2 AI decompose

Неделя 2 (P1):
  4.3 Telegram  ┐
  4.4 GitLab    ┘ параллельно
  4.5 Export

Неделя 3 (P2+P3):
  4.6 Performance
  4.7 Security audit
  4.8 Deploy scripts
  4.9 Swagger docs
  4.10 User guide
```

---

## Зависимости (npm пакеты к установке)

### Backend
```bash
# AI
npm install @anthropic-ai/sdk

# Telegram
npm install node-telegram-bot-api
npm install -D @types/node-telegram-bot-api

# Export
npm install csv-stringify pdfkit
npm install -D @types/pdfkit

# Swagger
npm install swagger-ui-express swagger-jsdoc
npm install -D @types/swagger-ui-express @types/swagger-jsdoc

# Security
npm install helmet express-rate-limit
```

### Frontend
```bash
# PDF preview (опционально)
npm install dompurify
npm install -D @types/dompurify
```

---

## Изменения Prisma schema

```prisma
// Добавить в schema.prisma:

model TelegramSubscription {
  id        Int      @id @default(autoincrement())
  userId    Int      @unique
  chatId    String
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}

model GitLabIntegration {
  id           Int      @id @default(autoincrement())
  projectId    Int      @unique
  gitlabUrl    String
  gitlabToken  String
  webhookToken String
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
  project      Project  @relation(fields: [projectId], references: [id])
}

// Индексы для Issue (добавить в существующую модель):
@@index([projectId, status])
@@index([assigneeId, status])
@@index([sprintId])

// Индекс для TimeLog:
@@index([issueId, logDate])
```

---

## Env переменные (добавить в .env.example)

```bash
# AI (Claude API)
ANTHROPIC_API_KEY=sk-ant-...

# Telegram Bot
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_URL=https://your-domain.com/api/integrations/telegram/webhook

# GitLab Integration
GITLAB_WEBHOOK_SECRET=...

# Swagger
SWAGGER_ENABLED=true   # false в production
```

---

*Документ создан: 2026-03-15. Обновлять по мере выполнения задач.*
