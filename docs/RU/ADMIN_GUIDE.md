# Инструкция администратора TaskTime

Установка, настройка, учётные записи, резервное копирование, логи и аудит, рекомендации по безопасности.

---

## Установка и переменные окружения

Основные шаги развёртывания описаны в [DEPLOY.md](../DEPLOY.md). Операционные процедуры и rollback описаны в [OPERATIONS_RUNBOOK.md](../OPERATIONS_RUNBOOK.md).

Основные переменные (см. также `backend/.env.example`):

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | Строка подключения к PostgreSQL |
| `JWT_SECRET` | Секрет подписи access token |
| `JWT_REFRESH_SECRET` | Секрет подписи refresh token |
| `JWT_EXPIRES_IN` | Срок жизни access token |
| `JWT_REFRESH_EXPIRES_IN` | Срок жизни refresh token |
| `PORT` | Порт backend внутри контейнера |
| `CORS_ORIGIN` | Разрешённый origin frontend |
| `REDIS_URL` | Подключение к Redis |

---

## Учётные записи и роли

- Учётные записи создаются скриптом начального заполнения БД (например `backend/scripts/seed.js`) или через API регистрации (если доступен).
- Роли: **admin**, **manager**, **user**. Разграничение прав:
  - **admin** — полный доступ ко всем задачам и действиям.
  - **manager** — полный доступ ко всем задачам.
  - **user** — доступ только к задачам, где пользователь является автором (creator) или исполнителем (assignee): просмотр, изменение, удаление, запуск/остановка таймера только по ним.

Подробнее об учётках и формате логинов/паролей: [ACCOUNTS.md](../ACCOUNTS.md).

---

## Схема БД и миграции

- Источник истины по схеме БД: `backend/src/prisma/schema.prisma`.
- Продовые и staging-изменения схемы применяются только через Prisma Migrate:
  `npx prisma migrate deploy`
- Базовые миграции хранятся в `backend/src/prisma/migrations/` и должны попадать в git.
- Если старая БД была создана до внедрения tracked migrations, перед первым rollout нужен baseline через
  `npx prisma migrate resolve --applied 20260312222000_init`
  после ручной сверки схемы.
- `prisma db push` допускается только для локальных временных сценариев, но не для staging/prod.

---

## Резервное копирование

- Рекомендуется делать nightly backup через `deploy/scripts/backup-postgres.sh`.
- Восстановление делайте через `deploy/scripts/restore-postgres.sh` сначала на staging.
- Храните копии в безопасном месте и регулярно проводите restore drill.

Подробнее о деплое и командах: [DEPLOY.md](../DEPLOY.md).

---

## Журнал аудита и логи

- Приложение пишет события в таблицу **audit_log** (логин, регистрация, создание/изменение/удаление задач, старт/стоп таймера). Поля: дата/время, пользователь, действие, сущность, уровень, детали, IP, User-Agent.
- Логи контейнеров смотреть через `docker compose ... logs -f backend|web|postgres`.
- Для передачи событий в SIEM можно экспортировать данные из `audit_log` (например выгрузкой или стримингом); формат и интеграция описываются отдельно при необходимости.

---

## HTTPS и безопасность на деплое

- Доступ к приложению из интернета должен осуществляться **только по HTTPS** (ТЗ: защита при передаче по открытым каналам, TLS).
- Внутри deploy-стека используется Nginx-контейнер для frontend/static + proxy `/api`.
- Внешний HTTPS должен завершаться на edge-прокси или host-level TLS c автоматическим продлением сертификатов.
- Секреты (JWT_SECRET, пароли БД) не передавайте по незашифрованным каналам и не храните в открытом виде в репозитории. Используйте `.env` с ограниченными правами доступа.

---

## Переменные окружения Sprint 4

Добавлены в `backend/.env.example`:

| Переменная | Описание |
|------------|----------|
| `ANTHROPIC_API_KEY` | API-ключ Anthropic для AI-функций (оценка, декомпозиция). Получить: console.anthropic.com |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота от @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Произвольная строка для верификации webhook-запросов от Telegram |
| `TELEGRAM_WEBHOOK_URL` | Публичный URL вашего backend для регистрации webhook (https://example.com/api/integrations/telegram/webhook) |
| `GITLAB_WEBHOOK_SECRET` | Секретный токен для верификации webhook-запросов от GitLab |
| `SWAGGER_ENABLED` | `true` для включения /api/docs в production |

---

## Настройка Telegram-бота

### 1. Создание бота

1. Откройте @BotFather в Telegram, отправьте `/newbot`.
2. Задайте имя и username бота (например `tasktime_notify_bot`).
3. Скопируйте токен и добавьте в `TELEGRAM_BOT_TOKEN`.

### 2. Регистрация webhook

Telegram должен знать, куда отправлять события. Зарегистрируйте webhook командой:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/api/integrations/telegram/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
  }'
```

Убедитесь, что URL доступен из интернета и использует HTTPS.

### 3. Проверка

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

Поле `url` должно совпадать с вашим `TELEGRAM_WEBHOOK_URL`, `pending_update_count` = 0.

### 4. Инструкция для пользователей

Сообщите пользователям: найти бота `@ваш_бот_username` в Telegram и нажать **Start**. Бот пришлёт chat ID. Этот ID нужно вставить в **Admin → Telegram Notifications → Your Telegram chat ID** и нажать **Connect**.

---

## Настройка GitLab-интеграции

### 1. Настройка webhook в GitLab

1. Перейдите в нужный GitLab-репозиторий → **Settings → Webhooks**.
2. URL: `https://your-domain.com/api/integrations/gitlab/webhook`
3. Secret token: значение из `GITLAB_WEBHOOK_SECRET`
4. Включите события: **Push events**, **Merge request events**
5. Нажмите **Add webhook**.

### 2. Привязка к проекту TaskTime

В разделе **Admin → GitLab Integration**:
1. Выберите проект TaskTime.
2. Введите GitLab URL репозитория и токен API (personal access token с правами `api`).
3. Введите webhook token (тот же, что в `GITLAB_WEBHOOK_SECRET`).
4. Нажмите **Save**.

### 3. Как работает автообновление статусов

| Событие GitLab | Статус TaskTime |
|---------------|----------------|
| Push-коммит с ключом задачи в сообщении | IN_PROGRESS |
| Открыт Merge Request | IN_PROGRESS |
| MR влит (merged) | REVIEW |
| MR закрыт (closed) | DONE |

Ключ задачи должен присутствовать в заголовке коммита или MR (например `PROJ-42`). Задачи в статусе DONE/CANCELLED не понижаются.

---

## AI-функции: производственные требования

- `ANTHROPIC_API_KEY` должен быть настроен. Без него эндпоинты `/api/ai/estimate` и `/api/ai/decompose` вернут 503.
- Модель: `claude-haiku-4-5-20251001` (быстрая и дешёвая, подходит для оценки).
- Сетевой доступ: backend должен иметь исходящий доступ к `api.anthropic.com:443`. Проверьте корпоративный прокси/файрвол.
- Сессии сохраняются в таблице `ai_sessions` для аудита.

---

## Обновления

- **Staging:** `Deploy Staging` запускается только после успешного `CI` и успешной публикации образов из `main`.
- **Production:** деплой выполняется только через manual dispatch workflow `Deploy Production` после approval в GitHub Environment.
- **Ручной запуск на сервере:** `./deploy/scripts/deploy.sh <staging|production> <image-tag>`.
- Prisma migrations применяются автоматически внутри deploy-скрипта через `prisma migrate deploy`.
- Рекомендуется применять обновления безопасности зависимостей (`npm audit`, обновление пакетов) в рамках регламента обслуживания.
- Подробности настройки автодеплоя (SSH-ключ, GitHub Secrets, sudoers): [DEPLOY.md](../DEPLOY.md) раздел «Деплой обновлений».
