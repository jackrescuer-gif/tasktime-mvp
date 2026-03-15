# Security Audit Report — Sprint 4

**Дата:** 2026-03-15
**Проверяющий:** AI Security Review (Claude Sonnet 4.6)
**Версия:** Sprint 4

---

## Результаты проверки

### ✅ Выполнено

| # | Категория | Пункт | Статус |
|---|-----------|-------|--------|
| 1 | Auth | bcrypt cost=12 для хранения паролей | ✅ |
| 2 | Auth | JWT access token expire=15m | ✅ |
| 3 | Auth | Refresh token в теле (не в localStorage — хранится в Zustand store в памяти) | ✅ |
| 4 | Auth | Rate limiting: 10 req/min/IP на `/register` и `/login` | ✅ Sprint 4 |
| 5 | Auth | Refresh token инвалидируется при logout (удаляется из БД) | ✅ |
| 6 | HTTP | `helmet()` подключён (CSP, X-Frame-Options, X-Content-Type-Options) | ✅ |
| 7 | HTTP | CORS настроен на конкретный origin (env `CORS_ORIGIN`) | ✅ |
| 8 | Input | Все входящие DTO валидируются через Zod | ✅ |
| 9 | DB | Prisma parameterized queries — SQL-инъекции исключены | ✅ |
| 10 | RBAC | Все мутирующие endpoints защищены `requireRole` middleware | ✅ |
| 11 | Webhooks | Telegram webhook верифицируется `X-Telegram-Bot-Api-Secret-Token` | ✅ |
| 12 | Webhooks | GitLab webhook верифицируется `X-Gitlab-Token` | ✅ |
| 13 | Dependencies | `npm audit` — 0 vulnerabilities | ✅ |
| 14 | Config | `ANTHROPIC_API_KEY`, токены хранятся в env, не в коде | ✅ |

### ⚠️ Принято как acceptable risk (MVP)

| # | Пункт | Обоснование |
|---|-------|-------------|
| 1 | Refresh token в body (не в httpOnly cookie) | Требует рефакторинга клиента; для MVP в контролируемой среде приемлемо. **To-do для v1.0:** перейти на httpOnly cookie. |
| 2 | GitLab token хранится в БД plain text | В production использовать шифрование `crypto.createCipheriv` или Vault. Для MVP в изолированной сети приемлемо. |
| 3 | XSS в комментариях (Markdown) | На фронте используется `ReactMarkdown` без DOMPurify. Угроза XSS есть только если рендерится raw HTML. `ReactMarkdown` по умолчанию не рендерит `<script>` теги — приемлемо для MVP. |
| 4 | Нет HTTPS-редиректа в коде приложения | HTTPS должен быть терминирован на Nginx/балансировщике (см. `deploy/nginx/nginx.conf`). |

### 🔲 Backlog (Post-MVP)

- [ ] Перевести refresh token на httpOnly cookie
- [ ] Шифрование GitLab/Telegram токенов в БД
- [ ] CSP strict mode (nonce-based)
- [ ] KeyCloak / ALD Pro SSO интеграция
- [ ] SIEM интеграция (audit log export)
- [ ] ФЗ-152: разметить PII поля (email, name) в документации

---

## Детали проверки

### Аутентификация

```
POST /api/auth/login   → rate limit 10/min, bcrypt compare, JWT 15m
POST /api/auth/register → rate limit 10/min, bcrypt hash cost=12
POST /api/auth/refresh  → проверка refreshToken в БД (не истёк)
POST /api/auth/logout   → удаляет refreshToken из БД
```

### RBAC Matrix

| Endpoint | VIEWER | USER | MANAGER | ADMIN |
|---------|--------|------|---------|-------|
| GET issues | ✅ | ✅ | ✅ | ✅ |
| POST/PATCH issues | ❌ | ✅ | ✅ | ✅ |
| DELETE issue | ❌ | owner | ✅ | ✅ |
| AI estimate/decompose | ❌ | ✅ | ✅ | ✅ |
| Reports export | ❌ | ❌ | ✅ | ✅ |
| Admin endpoints | ❌ | ❌ | partial | ✅ |
| GitLab configure | ❌ | ❌ | ❌ | ✅ |

### Audit Log

Все мутации записываются в `audit_logs` с: `userId`, `action`, `entityType`, `entityId`, `ipAddress`, `userAgent`, `details`.

### Dependency Audit

```
npm audit → found 0 vulnerabilities
```

---

*Следующий аудит: перед production release v1.0*
