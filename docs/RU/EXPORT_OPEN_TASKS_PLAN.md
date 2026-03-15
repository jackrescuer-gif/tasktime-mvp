# Фича: Export Open Tasks API (Agent Integration)

## Анализ текущего состояния

### Что уже есть

1. **Issue model** (`schema.prisma:72-116`) — полноценная модель задач:
   - Статусы: `OPEN`, `IN_PROGRESS`, `REVIEW`, `DONE`, `CANCELLED`
   - AI-поля: `aiEligible`, `aiExecutionStatus` (NOT_STARTED/IN_PROGRESS/DONE/FAILED), `aiAssigneeType` (HUMAN/AGENT/MIXED)
   - Иерархия: parent/children, типы EPIC→STORY→TASK→SUBTASK, BUG
   - Связи: project, sprint, assignee, creator, comments, timeLogs, aiSessions

2. **Existing endpoint** `GET /api/mvp-livecode/issues/active` — прототип для проекта LIVE, фильтрует по `OPEN/IN_PROGRESS/REVIEW`, но:
   - Привязан к хардкоду `LIVE` проекта
   - Не возвращает description, children, comments, time logs
   - Нет обратной связи (plan, results, commits)

3. **AiSession model** (`schema.prisma:243-264`) — уже есть модель сессий ИИ с привязкой к issue, но нет полей для плана, результатов, коммитов/PR.

4. **Prod-sync** (`prod-sync.ts`) — механизм синхронизации между средами, можно использовать паттерн snapshot для экспорта.

### Чего не хватает

1. **Dedicated export endpoint** — универсальный API для получения открытых задач по любому проекту в формате, удобном для агентов
2. **Поля обратной связи на Issue** — plan, devResult, testResult
3. **Модель DevLink** — связи задач с коммитами, PR, merge
4. **Endpoint для приёма результатов** — POST/PATCH для отправки плана, результатов разработки, тестов, связей с VCS

---

## План работ

### 1. Миграция БД — новые поля и модель DevLink

**Файл:** `backend/src/prisma/schema.prisma`

#### 1.1 Новые поля на Issue:
```prisma
// AI Agent workflow fields
aiPlan           String?  @map("ai_plan")          // План реализации от агента
aiDevResult      String?  @map("ai_dev_result")     // Результат разработки
aiTestResult     String?  @map("ai_test_result")    // Результат тестов
```

#### 1.2 Новая модель DevLink:
```prisma
model DevLink {
  id        String      @id @default(uuid())
  issueId   String      @map("issue_id")
  type      DevLinkType
  url       String
  title     String?
  sha       String?     // commit SHA
  status    String?     // merged, open, closed
  createdAt DateTime    @default(now()) @map("created_at")

  issue Issue @relation(fields: [issueId], references: [id], onDelete: Cascade)

  @@index([issueId])
  @@map("dev_links")
}

enum DevLinkType {
  COMMIT
  BRANCH
  PULL_REQUEST
  MERGE
}
```

#### 1.3 Добавить relation в Issue:
```prisma
devLinks DevLink[]
```

### 2. Backend — новый модуль `export`

**Путь:** `backend/src/modules/export/`

#### 2.1 Router (`export.router.ts`)

| Method | Path | Описание |
|--------|------|----------|
| `GET` | `/api/export/open-tasks` | Список открытых задач (все проекты или по projectId) |
| `GET` | `/api/export/open-tasks/:id` | Детальная задача для агента (с children, comments, time, devLinks) |
| `PATCH` | `/api/export/tasks/:id/plan` | Агент отправляет план реализации |
| `PATCH` | `/api/export/tasks/:id/dev-result` | Агент отправляет результат разработки |
| `PATCH` | `/api/export/tasks/:id/test-result` | Агент отправляет результат тестов |
| `POST` | `/api/export/tasks/:id/dev-links` | Агент привязывает commit/PR/merge |
| `PATCH` | `/api/export/tasks/:id/ai-status` | Агент обновляет статус выполнения |

#### 2.2 Service (`export.service.ts`)

**`getOpenTasks(filters)`** — выборка задач:
```typescript
where: {
  status: { in: ['OPEN', 'IN_PROGRESS', 'REVIEW'] },  // всё кроме DONE/CANCELLED
  projectId: filters.projectId,      // опционально
  aiEligible: filters.onlyAiEligible, // опционально
  aiAssigneeType: filters.assigneeType, // опционально
}
include: {
  project: { select: { key, name } },
  assignee: { select: { id, name, email } },
  creator: { select: { id, name } },
  parent: { select: { id, title, type, number } },
  children: { select: { id, title, type, status, number } },
  sprint: { select: { id, name, state } },
  _count: { select: { comments, timeLogs, devLinks } },
}
```

**`getOpenTaskDetail(id)`** — полная карточка:
```typescript
include: {
  // всё из getOpenTasks +
  comments: { orderBy: createdAt desc, take: 20 },
  timeLogs: { orderBy: logDate desc, take: 10 },
  devLinks: { orderBy: createdAt desc },
}
```

**`updatePlan(id, plan)`** — сохранение плана:
- Обновляет `issue.aiPlan`
- Ставит `aiExecutionStatus = IN_PROGRESS` если был `NOT_STARTED`
- Audit log

**`updateDevResult(id, result)`** — результат разработки

**`updateTestResult(id, result)`** — результат тестов

**`addDevLink(id, link)`** — добавление связи с VCS

**`updateAiExecutionStatus(id, status)`** — обновление статуса

#### 2.3 DTO (`export.dto.ts`)

```typescript
const updatePlanDto = z.object({
  plan: z.string().min(1).max(50000),
});

const updateDevResultDto = z.object({
  devResult: z.string().min(1).max(100000),
  summary: z.string().max(2000).optional(),
});

const updateTestResultDto = z.object({
  testResult: z.string().min(1).max(100000),
  passed: z.boolean().optional(),
  coverage: z.number().min(0).max(100).optional(),
});

const addDevLinkDto = z.object({
  type: z.enum(['COMMIT', 'BRANCH', 'PULL_REQUEST', 'MERGE']),
  url: z.string().url().max(2000),
  title: z.string().max(500).optional(),
  sha: z.string().max(40).optional(),
  status: z.string().max(50).optional(),
});
```

### 3. Регистрация маршрутов

**Файл:** `backend/src/app.ts`
- Импортировать и подключить `exportRouter` на `/api`

### 4. Формат ответа для агентов

```json
{
  "tasks": [
    {
      "id": "uuid",
      "key": "TTMP-42",
      "title": "Implement user notifications",
      "description": "...",
      "type": "TASK",
      "status": "OPEN",
      "priority": "HIGH",
      "project": { "key": "TTMP", "name": "TaskTime MVP" },
      "parent": { "key": "TTMP-10", "title": "Notifications epic", "type": "EPIC" },
      "children": [...],
      "sprint": { "name": "Sprint 4", "state": "ACTIVE" },
      "assignee": { "name": "AI Agent", "email": "..." },
      "creator": { "name": "PM" },
      "aiEligible": true,
      "aiAssigneeType": "AGENT",
      "aiExecutionStatus": "NOT_STARTED",
      "aiPlan": null,
      "aiDevResult": null,
      "aiTestResult": null,
      "estimatedHours": "4.00",
      "devLinksCount": 0,
      "commentsCount": 2,
      "timeLogsCount": 0,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "meta": {
    "total": 15,
    "filters": { "status": ["OPEN","IN_PROGRESS","REVIEW"] }
  }
}
```

### 5. RBAC

- `GET /export/open-tasks` — все авторизованные (VIEWER+)
- `PATCH /export/tasks/:id/*` и `POST /export/tasks/:id/dev-links` — ADMIN, MANAGER (агент работает от имени сервисного аккаунта с ролью MANAGER)

### 6. Audit

Все мутации логируются через `logAudit`:
- `issue.plan_updated`
- `issue.dev_result_updated`
- `issue.test_result_updated`
- `issue.dev_link_added`
- `issue.ai_status_updated`

---

## Порядок реализации

| # | Задача | Файлы |
|---|--------|-------|
| 1 | Prisma migration: новые поля + DevLink | `schema.prisma`, новая миграция |
| 2 | Export DTO (Zod schemas) | `modules/export/export.dto.ts` |
| 3 | Export service | `modules/export/export.service.ts` |
| 4 | Export router | `modules/export/export.router.ts` |
| 5 | Подключение в app.ts | `app.ts` |
| 6 | Seed: пример данных для DevLink | `prisma/seed.ts` (опционально) |
| 7 | Тесты | По необходимости |

---

## Зависимости

- Не ломает существующие модули (issues, ai-sessions)
- Эндпоинт `mvp-livecode/issues/active` остаётся как есть (deprecated в будущем)
- DevLink — новая таблица, zero downtime migration

