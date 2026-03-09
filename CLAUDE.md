# TaskTime MVP — Контекст проекта

## Что это

TaskTime — импортозамещение Jira для российского финансового сектора.
Конкуренты: Т1 Сфера, EVA, Diasoft.

## Текущее состояние (2026-03-09)

**Фаза:** Пересборка с нуля (v2). Старый прототип (vanilla JS + Express) сносится полностью.
**План:** утверждён в `docs/RU/REBUILD_PLAN_V2.md`
**Статус:** Ожидает финального утверждения PO, затем Sprint 1.

## Решения из интервью (8 блоков)

### Блок 1: Продукт
- Jira Cut — минимальная замена Jira для финтеха
- 50-200 пользователей на старте, масштаб до 5000-6000

### Блок 2: Пользователи
- PM, тимлиды, разработчики, аналитики, CIO (viewer)

### Блок 3: Функциональность
- Задачи с иерархией: EPIC -> STORY -> TASK -> SUBTASK, BUG
- Kanban-доски, спринты (Scrum + Kanban)
- Учёт времени (таймер + ручной ввод)
- Отчёты и аналитика
- Комментарии к задачам

### Блок 4: Интеграции
- GitLab (webhook, автообновление статусов)
- Confluence (база знаний)
- Telegram-бот (нотификации)

### Блок 5: Безопасность
- RBAC: Admin, Manager, User, Viewer
- Audit log для всех мутаций
- ФЗ-152 (персональные данные)
- HTTPS + TLS 1.2+
- JWT с refresh tokens
- Будущее: KeyCloak / ALD Pro SSO, SIEM, DLP интеграция

### Блок 6: Техническая стратегия
- AI-агент (Claude/Cursor) как основной разработчик
- PO выступает как валидатор
- Тесты закладываем с нуля (Vitest + Supertest, 60%+ coverage)

### Блок 7: Deployment
- Текущее: VPS Ubuntu
- MVP: облако в изолированной среде (если ИБ допустит)
- Целевое: on-premise
- Целевые ОС: Astra Linux SE 1.7+, Red OS 7.3+
- БД: PostgreSQL 14+ (целевой 16) на Linux

### Блок 8: Приоритеты
- ТОП-3 для MVP: управление проектами/задачами, аналитика, AI-модуль
- Главные боли: юридические риски, legacy-кастом, разные флоу в командах
- Это определяет: гибкие workflow, конфигурируемые поля (в будущем)

## Утверждённый стек

| Слой | Технология |
|------|-----------|
| Language | TypeScript 5.x |
| Frontend | React 18 + Vite 6 + Ant Design 5 |
| State | Zustand |
| Backend | Node.js 20 LTS + Express 4 |
| ORM | Prisma 6 |
| Validation | Zod |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Auth | JWT + refresh tokens |
| Tests | Vitest + Supertest |
| Linting | ESLint + Prettier |
| CI | GitHub Actions |

## Архитектура

Модульный монолит. Backend: 11 модулей (auth, users, projects, issues, comments, boards, sprints, time, teams, audit, admin). Каждый модуль: router -> service -> Prisma. Модули НЕ импортируют repository друг у друга.

## Иерархия задач

| Тип | Родитель для | Дочерний для |
|-----|-------------|-------------|
| EPIC | STORY, TASK | — (верхний) |
| STORY | TASK, SUBTASK | EPIC |
| TASK | SUBTASK | EPIC, STORY |
| SUBTASK | — (нижний) | STORY, TASK |
| BUG | SUBTASK | EPIC, STORY |

Статусы: OPEN -> IN_PROGRESS -> REVIEW -> DONE / CANCELLED
Приоритеты: CRITICAL, HIGH, MEDIUM, LOW
Issue key: PROJECT_KEY-NUMBER (например PROJ-42)

## План спринтов

1. **Sprint 1:** Auth + Users + Projects + Issues (с иерархией) — фундамент
2. **Sprint 2:** Kanban Board + Sprints + Time tracking + Comments
3. **Sprint 3:** Teams + Admin + Reports + Redis
4. **Sprint 4:** AI (оценка трудоёмкости, декомпозиция) + Интеграции (GitLab, Telegram) + Polish

## Совместимость браузеров

Chrome 139+, Yandex Browser 25+, Edge 139+, Safari 18+

## Требования к ОС

- **Astra Linux SE 1.7+** — ФСТЭК, мандатный контроль, ЗПС
- **Red OS 7.3+** — RPM-based, в реестре РФ ПО
- **Ubuntu 22.04 LTS** — dev/staging
- Деплой: Docker или .deb/.rpm пакеты, systemd, работа за корпоративным прокси

## Очистка репо перед пересборкой

Удалить ВСЁ кроме: docs/, ТЗ_JIRA_CUT.txt, CLAUDE.md, .gitignore, .git/
Весь код создаётся заново по плану из docs/RU/REBUILD_PLAN_V2.md

## Ветка разработки

`claude/mvp-project-management-hdAvd`

## NFR

- API < 200ms (p95)
- Page load < 2s
- 2500+ concurrent sessions
- 1M+ objects in DB
- 60%+ test coverage
