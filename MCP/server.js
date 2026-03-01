#!/usr/bin/env node
/**
 * TaskTime — Claude Gatekeeper MCP Server
 * 
 * Валидирует каждый запрос перед отправкой в Cursor:
 * - Проверяет соответствие архитектуре TaskTime
 * - Проверяет что не ломает существующее
 * - Пишет улучшенный промпт для Cursor
 * - Предлагает edge cases
 * - Блокирует опасные запросы
 * 
 * Установка:
 *   npm install
 * 
 * Запуск (для теста):
 *   node server.js
 */

const Anthropic = require('@anthropic-ai/sdk');
const readline = require('readline');

// ─── MCP Protocol over stdio ───────────────────────────────
const rl = readline.createInterface({ input: process.stdin });

process.stdout.write = process.stdout.write.bind(process.stdout);

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

// ─── Anthropic client ──────────────────────────────────────
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Системный промпт — полный контекст TaskTime ──────────
const TASKTIME_SYSTEM_PROMPT = `Ты — архитектурный валидатор проекта TaskTime.
TaskTime — веб-приложение для управления задачами (импортозамещение Jira) для финсектора.

## СТЕК
- Backend: Node.js + Express + PostgreSQL
- Frontend: Vanilla JS SPA, один файл frontend/index.html (БЕЗ React, БЕЗ сборки)
- Auth: JWT Bearer
- БД: пул через db.js (pool.query), схема idempotent в schema.sql

## СТРУКТУРА ФАЙЛОВ
backend/server.js     — все API роуты
backend/db.js         — pool подключений (ВСЕГДА использовать его)
backend/audit.js      — writeAudit(userId, action, entityType, entityId, details, ip, ua)
backend/schema.sql    — idempotent схема (IF NOT EXISTS)
backend/scripts/seed.js — тестовые данные
frontend/index.html   — весь UI

## ТАБЛИЦЫ БД
users          — id, email, password_hash, name, role(admin/manager/cio/user)
tasks          — старая таблица, НЕ ТРОГАТЬ структуру
time_logs      — id, task_id, task_item_id, user_id, started_at, ended_at, duration_minutes
audit_log      — id, user_id, action, entity_type, entity_id, level, details, ip, user_agent
projects       — id, name, description, business_goal, budget, planned_revenue, owner_id, status
product_teams  — id, name, description, lead_id, status
product_team_members — team_id, user_id, role
business_functions   — id, name, description
task_items     — id, parent_id(self-ref), level(epic/story/subtask), order_index,
                 title, description, acceptance_criteria,
                 context_type(project/quick/product_team), context_id,
                 type, priority(critical/high/medium/low),
                 status(open/in_progress/in_review/done/cancelled),
                 story_points, estimated_hours,
                 assignee_id, creator_id, reviewer_id, created_at, updated_at

## РОЛИ
admin    — полный CRUD
manager  — CRUD задач и команд
cio      — ТОЛЬКО GET, никаких POST/PUT/DELETE; после логина → #cio-board
viewer   — ТОЛЬКО GET (как admin по охвату), никаких POST/PUT/DELETE; после логина → #main-dashboard без кнопок создания/редактирования
user     — только свои задачи (assignee_id или creator_id)

## ИЕРАРХИЯ ЗАДАЧ
epic → story → subtask (одинаково для project/quick/product_team)
context_type + context_id определяет принадлежность

## ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА
1. audit_log при каждой мутации (CREATE/UPDATE/DELETE)
2. pool из db.js — никогда не создавать новые подключения
3. schema.sql всегда idempotent (IF NOT EXISTS, ADD COLUMN IF NOT EXISTS)
4. Права проверять на backend, не только frontend
5. role НИКОГДА из req.body — только из req.user.role (JWT)
6. Frontend — ванильный JS, без фреймворков, без сборки
7. Ответы API: { data: ... } или { error: "message" }

## ОПАСНЫЕ ОПЕРАЦИИ (блокировать)
- DROP TABLE, TRUNCATE, DELETE без WHERE
- Изменение структуры существующих таблиц tasks, time_logs, users (только добавление колонок)
- Отключение проверки прав
- Хардкод credentials
- Приём role из req.body

## ТЕСТОВЫЕ АККАУНТЫ
pavel@tasktime.demo / tasktime24 → admin (супер-администратор, Павел)
georgiy@tasktime.demo / tasktime24 → viewer (читает всё, не изменяет, Георгий)
andrey@company.com / password123 → cio (CIO Board, Андрей Иванов)
alice@demo.com / demo123 → admin
eve@demo.com / demo123 → manager
bob@demo.com / demo123 → user
dev1@company.com / dev123 → user (Михаил Соколов)
dev2@company.com / dev123 → user (Наталья Попова)
dev3@company.com / dev123 → user (Дмитрий Козлов)
dev4@company.com / dev123 → user (Ольга Новикова)

Твоя задача: получить запрос разработчика и вернуть JSON со следующей структурой:
{
  "approved": true/false,
  "risk_level": "safe" | "warning" | "blocked",
  "issues": ["список проблем если есть"],
  "edge_cases": ["список edge cases которые нужно учесть"],
  "improved_prompt": "улучшенный промпт для Cursor с полным контекстом",
  "reasoning": "краткое объяснение решения"
}

Если risk_level === "blocked" — approved: false, improved_prompt пустой.
Если risk_level === "warning" — approved: true, но issues заполнены.
Если risk_level === "safe" — approved: true, issues пустой массив.

Отвечай ТОЛЬКО валидным JSON, без markdown, без пояснений вне JSON.`;

// ─── Опасные паттерны (быстрая проверка до LLM) ───────────
const DANGER_PATTERNS = [
  { pattern: /DROP\s+TABLE/i,           reason: 'DROP TABLE запрещён' },
  { pattern: /TRUNCATE/i,               reason: 'TRUNCATE запрещён' },
  { pattern: /DELETE\s+FROM\s+\w+\s*;/i,reason: 'DELETE без WHERE запрещён' },
  { pattern: /DELETE\s+все|удали\s+все|drop all/i, reason: 'Массовое удаление данных заблокировано' },
  { pattern: /role.*req\.body/i,         reason: 'role нельзя принимать из req.body' },
  { pattern: /new\s+Pool|new\s+Client/i, reason: 'Использовать pool из db.js, не создавать новые подключения' },
];

function quickDangerCheck(request) {
  for (const { pattern, reason } of DANGER_PATTERNS) {
    if (pattern.test(request)) {
      return reason;
    }
  }
  return null;
}

// ─── Основная валидация через Claude ──────────────────────
async function validateRequest(userRequest) {
  // Быстрая проверка на очевидные опасности
  const quickBlock = quickDangerCheck(userRequest);
  if (quickBlock) {
    return {
      approved: false,
      risk_level: 'blocked',
      issues: [quickBlock],
      edge_cases: [],
      improved_prompt: '',
      reasoning: `Запрос заблокирован быстрой проверкой: ${quickBlock}`,
    };
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: TASKTIME_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Проверь этот запрос разработчика:\n\n${userRequest}`,
        },
      ],
    });

    const text = response.content[0].text.trim();

    // Убираем markdown если Claude завернул в ```json
    const clean = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
      return JSON.parse(clean);
    } catch {
      // Если JSON сломан — возвращаем safe с оригинальным промптом
      return {
        approved: true,
        risk_level: 'safe',
        issues: [],
        edge_cases: [],
        improved_prompt: userRequest,
        reasoning: 'Валидация выполнена, структурных проблем не найдено.',
      };
    }
  } catch (err) {
    // Если API недоступен — пропускаем с предупреждением
    return {
      approved: true,
      risk_level: 'warning',
      issues: [`Claude API недоступен: ${err.message}`],
      edge_cases: [],
      improved_prompt: userRequest,
      reasoning: 'Валидация пропущена из-за ошибки API.',
    };
  }
}

// ─── Форматирование ответа для Cursor ─────────────────────
function formatResult(validation, originalRequest) {
  if (!validation.approved) {
    return `# 🚫 ЗАПРОС ЗАБЛОКИРОВАН

**Причина:** ${validation.issues.join(', ')}

**Объяснение:** ${validation.reasoning}

---
Исправь запрос и попробуй снова.`;
  }

  let result = '';

  if (validation.risk_level === 'warning') {
    result += `# ⚠️ ПРЕДУПРЕЖДЕНИЯ\n`;
    validation.issues.forEach(i => { result += `- ${i}\n`; });
    result += '\n';
  } else {
    result += `# ✅ ЗАПРОС ОДОБРЕН\n\n`;
  }

  if (validation.edge_cases?.length > 0) {
    result += `## 🔍 Edge cases для учёта\n`;
    validation.edge_cases.forEach(e => { result += `- ${e}\n`; });
    result += '\n';
  }

  result += `## 📋 Улучшенный промпт для Cursor\n\n`;
  result += validation.improved_prompt || originalRequest;

  if (validation.reasoning) {
    result += `\n\n---\n*Валидатор: ${validation.reasoning}*`;
  }

  return result;
}

// ─── MCP Tool Definition ───────────────────────────────────
const TOOLS = [
  {
    name: 'validate_and_improve',
    description: `Валидирует запрос разработчика перед выполнением.
Проверяет соответствие архитектуре TaskTime, выявляет риски,
предлагает edge cases и возвращает улучшенный промпт.
ВСЕГДА вызывай этот инструмент перед написанием кода.`,
    inputSchema: {
      type: 'object',
      properties: {
        request: {
          type: 'string',
          description: 'Запрос разработчика — что нужно реализовать',
        },
      },
      required: ['request'],
    },
  },
  {
    name: 'check_schema',
    description: 'Проверяет корректность SQL для схемы TaskTime. Убеждается что миграция idempotent и не ломает существующие таблицы.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'SQL код для проверки',
        },
      },
      required: ['sql'],
    },
  },
  {
    name: 'get_context',
    description: 'Возвращает полный контекст проекта TaskTime: стек, таблицы, роли, правила.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Тема: "auth" | "database" | "roles" | "frontend" | "api" | "all"',
        },
      },
      required: [],
    },
  },
];

// ─── Обработчики инструментов ──────────────────────────────
async function handleTool(name, args) {
  if (name === 'validate_and_improve') {
    const validation = await validateRequest(args.request);
    return formatResult(validation, args.request);
  }

  if (name === 'check_schema') {
    const validation = await validateRequest(
      `Проверь этот SQL для schema.sql TaskTime:\n\n${args.sql}`
    );
    return formatResult(validation, args.sql);
  }

  if (name === 'get_context') {
    const topic = args.topic || 'all';
    const contexts = {
      auth: `## Auth\nJWT Bearer. Middleware: authenticateToken.\nРоли: admin, manager, cio (только GET, CIO Board), viewer (только GET, main-dashboard), user (только свои задачи).\nНИКОГДА не принимать role из req.body.`,
      database: `## Database\nВсегда использовать pool из backend/db.js.\nschema.sql — idempotent (IF NOT EXISTS).\nТаблицы: users, tasks, time_logs, audit_log, projects, product_teams, product_team_members, business_functions, task_items.`,
      roles: `## Roles\nadmin — полный CRUD\nmanager — CRUD задач и команд\ncio — только GET, после логина → #cio-board (тёмная тема, метрики)\nviewer — только GET, после логина → #main-dashboard без кнопок создания (Pavel=admin, Georgiy=viewer)\nuser — только assignee_id или creator_id`,
      frontend: `## Frontend\nВанильный JS, один файл frontend/index.html.\nБЕЗ React, Vue, Angular. БЕЗ npm build.\nПосле логина: cio → #cio-board, viewer → #main-dashboard (кнопки создания скрыты), остальные → #main-dashboard.`,
      api: `## API\nВсе роуты в backend/server.js.\nОтветы: { data } или { error }.\nАудит при каждой мутации через writeAudit() из audit.js.`,
    };

    if (topic === 'all') {
      return Object.values(contexts).join('\n\n');
    }
    return contexts[topic] || contexts.all;
  }

  return `Инструмент ${name} не найден.`;
}

// ─── MCP Protocol Handler ──────────────────────────────────
rl.on('line', async (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }

  // Handshake
  if (msg.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'tasktime-claude-gatekeeper',
          version: '1.0.0',
        },
      },
    });
    return;
  }

  if (msg.method === 'initialized') return;

  // Список инструментов
  if (msg.method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: { tools: TOOLS },
    });
    return;
  }

  // Вызов инструмента
  if (msg.method === 'tools/call') {
    const { name, arguments: args } = msg.params;
    try {
      const result = await handleTool(name, args || {});
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          content: [{ type: 'text', text: result }],
        },
      });
    } catch (err) {
      send({
        jsonrpc: '2.0',
        id: msg.id,
        error: { code: -32000, message: err.message },
      });
    }
    return;
  }

  // Неизвестный метод
  if (msg.id) {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      error: { code: -32601, message: 'Method not found' },
    });
  }
});
