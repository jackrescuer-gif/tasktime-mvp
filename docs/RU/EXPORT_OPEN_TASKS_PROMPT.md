# Промт для реализации: Export Open Tasks API

## Контекст

Ты работаешь в проекте TaskTime MVP — импортозамещение Jira для российского финтеха.
Стек: TypeScript, Express 4, Prisma 6, PostgreSQL 16, Zod для валидации.
Архитектура: модульный монолит, каждый модуль = router + service + dto.
Ветка: `claude/export-open-tasks-Z3iJt`

## Задача

Реализовать API для экспорта открытых задач (статусы OPEN, IN_PROGRESS, REVIEW) и приёма обратной связи от AI-агентов (план, результаты разработки, тесты, связи с коммитами/PR/merge).

## Что сделать (по шагам)

### Шаг 1: Prisma schema + миграция

Файл: `backend/src/prisma/schema.prisma`

1. Добавить в модель `Issue` три текстовых поля:
```prisma
aiPlan           String?  @map("ai_plan")
aiDevResult      String?  @map("ai_dev_result")
aiTestResult     String?  @map("ai_test_result")
```
И relation:
```prisma
devLinks DevLink[]
```

2. Добавить новую модель после `AuditLog`:
```prisma
model DevLink {
  id        String      @id @default(uuid())
  issueId   String      @map("issue_id")
  type      DevLinkType
  url       String
  title     String?
  sha       String?
  status    String?
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

3. Создать миграцию:
```bash
cd backend && npx prisma migrate dev --name add_ai_workflow_fields_and_dev_links
```

### Шаг 2: DTO

Создать файл `backend/src/modules/export/export.dto.ts`:

```typescript
import { z } from 'zod';

export const openTasksQueryDto = z.object({
  projectId: z.string().uuid().optional(),
  projectKey: z.string().max(20).optional(),
  onlyAiEligible: z.enum(['true', 'false']).optional(),
  assigneeType: z.enum(['HUMAN', 'AGENT', 'MIXED', 'ALL']).optional(),
  type: z.string().optional(), // comma-separated: EPIC,STORY,TASK
  priority: z.string().optional(), // comma-separated: CRITICAL,HIGH
  search: z.string().max(200).optional(),
});

export const updatePlanDto = z.object({
  plan: z.string().min(1).max(50000),
});

export const updateDevResultDto = z.object({
  devResult: z.string().min(1).max(100000),
  summary: z.string().max(2000).optional(),
});

export const updateTestResultDto = z.object({
  testResult: z.string().min(1).max(100000),
  passed: z.boolean().optional(),
  coverage: z.number().min(0).max(100).optional(),
});

export const addDevLinkDto = z.object({
  type: z.enum(['COMMIT', 'BRANCH', 'PULL_REQUEST', 'MERGE']),
  url: z.string().url().max(2000),
  title: z.string().max(500).optional(),
  sha: z.string().max(40).optional(),
  status: z.string().max(50).optional(),
});

export const updateExportAiStatusDto = z.object({
  aiExecutionStatus: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'FAILED']),
});

export type OpenTasksQueryDto = z.infer<typeof openTasksQueryDto>;
export type UpdatePlanDto = z.infer<typeof updatePlanDto>;
export type UpdateDevResultDto = z.infer<typeof updateDevResultDto>;
export type UpdateTestResultDto = z.infer<typeof updateTestResultDto>;
export type AddDevLinkDto = z.infer<typeof addDevLinkDto>;
export type UpdateExportAiStatusDto = z.infer<typeof updateExportAiStatusDto>;
```

### Шаг 3: Service

Создать файл `backend/src/modules/export/export.service.ts`:

Функции:
- `getOpenTasks(filters: OpenTasksQueryDto)` — список открытых задач с фильтрами. WHERE status IN (OPEN, IN_PROGRESS, REVIEW). Include: project, assignee, creator, parent, children (select), sprint, _count (comments, timeLogs, devLinks). Формировать `key` как `project.key + '-' + number`. OrderBy: [priority desc, status asc, createdAt asc]. Возвращать `{ tasks, meta: { total, filters } }`.
- `getOpenTaskDetail(id: string)` — полная карточка. Включает всё из getOpenTasks + comments (take 20, orderBy createdAt desc), timeLogs (take 10), devLinks (orderBy createdAt desc). Выбросить 404 если задача не найдена или имеет статус DONE/CANCELLED.
- `updatePlan(id, dto)` — обновить issue.aiPlan. Если aiExecutionStatus === NOT_STARTED, поставить IN_PROGRESS.
- `updateDevResult(id, dto)` — обновить issue.aiDevResult.
- `updateTestResult(id, dto)` — обновить issue.aiTestResult.
- `addDevLink(id, dto)` — создать запись DevLink, связанную с issue.
- `updateAiStatus(id, dto)` — обновить aiExecutionStatus. Если DONE — также можно ставить issue.status = REVIEW.

Все мутации должны проверять существование задачи (404 если нет).

### Шаг 4: Router

Создать файл `backend/src/modules/export/export.router.ts`:

```
GET  /export/open-tasks          — getOpenTasks (authenticate)
GET  /export/open-tasks/:id      — getOpenTaskDetail (authenticate)
PATCH /export/tasks/:id/plan     — updatePlan (authenticate + requireRole ADMIN, MANAGER)
PATCH /export/tasks/:id/dev-result — updateDevResult (authenticate + requireRole ADMIN, MANAGER)
PATCH /export/tasks/:id/test-result — updateTestResult (authenticate + requireRole ADMIN, MANAGER)
POST  /export/tasks/:id/dev-links  — addDevLink (authenticate + requireRole ADMIN, MANAGER)
PATCH /export/tasks/:id/ai-status  — updateAiStatus (authenticate + requireRole ADMIN, MANAGER)
```

Все мутации логируют через `logAudit(req, action, 'issue', id, body)`:
- `issue.plan_updated`
- `issue.dev_result_updated`
- `issue.test_result_updated`
- `issue.dev_link_added`
- `issue.ai_status_updated`

### Шаг 5: Регистрация в app.ts

Добавить импорт и `app.use('/api', exportRouter);` в `backend/src/app.ts` — после aiSessionsRouter.

### Шаг 6: Проверка

- Запустить `npx prisma migrate dev` — миграция применена
- Запустить `npx tsc --noEmit` — нет ошибок типов
- Проверить что сервер стартует: `npm run dev`

## Важные правила

1. Следовать паттернам существующих модулей (issues, ai-sessions):
   - Импорты: `import { prisma } from '../../prisma/client.js';`
   - Ошибки: `import { AppError } from '../../shared/middleware/error-handler.js';`
   - Auth: `import { authenticate } from '../../shared/middleware/auth.js';`
   - RBAC: `import { requireRole } from '../../shared/middleware/rbac.js';`
   - Validate: `import { validate } from '../../shared/middleware/validate.js';`
   - Audit: `import { logAudit } from '../../shared/middleware/audit.js';`
   - Types: `import type { AuthRequest } from '../../shared/types/index.js';`

2. Не модифицировать существующие модули (issues.router.ts, issues.service.ts и т.д.)

3. JS extension в импортах: `.js` (ESM)

4. Все строки — одинарные кавычки, trailing comma, 2 spaces indent (как в проекте)

5. Enum значения — строками (как в Prisma), не числами

## Ожидаемый результат

Новые файлы:
- `backend/src/modules/export/export.dto.ts`
- `backend/src/modules/export/export.service.ts`
- `backend/src/modules/export/export.router.ts`
- `backend/src/prisma/migrations/YYYYMMDDHHMMSS_add_ai_workflow_fields_and_dev_links/migration.sql`

Изменённые файлы:
- `backend/src/prisma/schema.prisma` (новые поля + модель DevLink)
- `backend/src/app.ts` (подключение роутера)
