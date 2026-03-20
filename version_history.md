# Version History

Все значимые изменения в проекте. Для каждого изменения указана ссылка на задачу (если есть).

**Last version: 0.1**

---

## [0.1] [2026-03-21] feat(admin): управление публичной регистрацией пользователей

**Задача:** [TTADM-32](http://5.129.242.171) (история под эпиком TTADM-5 «Управление пользователями»)
**PR:** [#79](https://github.com/jackrescuer-gif/tasktime-mvp/pull/79)
**Ветка:** `claude/jack-ttadm-32-registration-toggle`

### Что изменилось

**Backend:**
- Новая модель `SystemSetting` в `schema.prisma` + миграция `20260321120000_add_system_settings`
- `GET /api/auth/registration-status` — публичный эндпоинт (без авторизации), читается страницей входа
- `GET /api/admin/settings/registration` — текущее состояние для авторизованных пользователей
- `PATCH /api/admin/settings/registration` — изменение настройки, только `SUPER_ADMIN`; создаёт запись в `audit_log` с действием `system.registration_toggled`
- `POST /api/auth/register` — возвращает `403 "Регистрация пользователей отключена"` если настройка выключена

**Frontend:**
- `AdminUsersPage`: Switch «Публичная регистрация» в шапке страницы — активен только для `SUPER_ADMIN`, `disabled` для остальных
- `LoginPage`: скрывает вкладку «Регистрация» если настройка выключена; показывает информационное сообщение

### Файлы
- `backend/src/prisma/schema.prisma`
- `backend/src/prisma/migrations/20260321120000_add_system_settings/`
- `backend/src/modules/admin/admin.router.ts`
- `backend/src/modules/admin/admin.service.ts`
- `backend/src/modules/auth/auth.router.ts`
- `frontend/src/api/admin.ts`
- `frontend/src/pages/admin/AdminUsersPage.tsx`
- `frontend/src/pages/LoginPage.tsx`
