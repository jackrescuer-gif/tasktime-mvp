# TaskTime — Claude Gatekeeper MCP Server

Валидирует каждый запрос разработчика перед выполнением в Cursor.

## Что делает

- ✅ Проверяет соответствие архитектуре TaskTime
- ✅ Проверяет что изменения не ломают существующее
- ✅ Пишет улучшенный промпт для Cursor с полным контекстом
- ✅ Предлагает edge cases которые нужно учесть
- 🚫 Блокирует опасные запросы (DROP TABLE, DELETE без WHERE, role из req.body и др.)

## Установка

### 1. Скопируй папку в удобное место
```bash
cp -r mcp-gatekeeper ~/mcp-gatekeeper
cd ~/mcp-gatekeeper
npm install
```

### 2. Получи API ключ Anthropic
Иди на https://console.anthropic.com → API Keys → Create Key

### 3. Добавь MCP сервер в Cursor
Cursor → Settings → MCP → добавь конфиг:

```json
{
  "mcpServers": {
    "tasktime-gatekeeper": {
      "command": "node",
      "args": ["/Users/ВАШ_ИМЯ/mcp-gatekeeper/server.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-ВАШ_КЛЮЧ"
      }
    }
  }
}
```

Замени:
- `/Users/ВАШ_ИМЯ/mcp-gatekeeper/server.js` → реальный путь к server.js
- `sk-ant-ВАШ_КЛЮЧ` → твой API ключ

### 4. Перезапусти Cursor

## Использование

В Cursor Agent теперь доступны три инструмента:

### `validate_and_improve`
Основной инструмент. Cursor вызывает его автоматически перед каждым запросом.

Пример — ты пишешь в Cursor:
```
Хочу добавить комментарии к задачам
```

Cursor → вызывает validate_and_improve → Claude проверяет → возвращает:
```
✅ ЗАПРОС ОДОБРЕН

🔍 Edge cases для учёта
- Комментарии должны записываться в audit_log
- Нужна проверка прав: user видит только комментарии своих задач
- Максимальная длина комментария (например 2000 символов)
- Soft delete или hard delete при удалении комментария?

📋 Улучшенный промпт для Cursor

Добавить таблицу task_comments в schema.sql (idempotent):
  id, task_item_id → task_items(CASCADE), author_id → users,
  content TEXT NOT NULL, created_at, updated_at, deleted_at (soft delete)

Роуты в server.js:
  GET  /api/task-items/:id/comments — список (с проверкой прав на родительскую задачу)
  POST /api/task-items/:id/comments — создать (audit: 'comment.created')
  DELETE /api/task-items/:id/comments/:cid — soft delete (только автор или admin)

Frontend: секция комментариев в модальном окне задачи...
```

### `check_schema`
Проверяет SQL перед применением.

### `get_context`
Возвращает контекст проекта по теме: auth / database / roles / frontend / api / all

## Настройка автоматического вызова

Добавь в `.cursorrules` в корень репозитория:
```
RULE: Before writing ANY code, call tasktime-gatekeeper validate_and_improve
with the user's request. Use the improved_prompt as the actual task.
If approved: false — stop and explain to user. Do not write code.
```

Это заставит Cursor автоматически валидировать каждый запрос.
