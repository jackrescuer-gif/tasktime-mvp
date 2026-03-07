# Установка VS Code и визуализации Pixel Agents

Пошаговая установка VS Code и расширения Pixel Agents для визуализации ИИ-агентов в виртуальном офисе.

---

## Шаг 1. Установить VS Code

### Вариант A: С официального сайта (рекомендуется)

1. Откройте в браузере: **https://code.visualstudio.com/**
2. Нажмите **Download for macOS** (или вашу ОС).
3. Скачайте установщик, откройте его и перетащите **Visual Studio Code** в папку **Applications**.

### Вариант B: Через Homebrew (если установлен)

```bash
brew install --cask visual-studio-code
```

После установки VS Code можно запустить из **Applications** или из терминала командой `code`.

---

## Шаг 2. Установить расширение Pixel Agents

1. Запустите **Visual Studio Code**.
2. Откройте панель расширений: **View → Extensions** или сочетание **Cmd+Shift+X** (macOS) / **Ctrl+Shift+X** (Windows/Linux).
3. В поиске введите: **Pixel Agents**.
4. Найдите расширение **Pixel Agents** (автор: pablodelucca) и нажмите **Install**.

Либо из терминала (если VS Code в PATH):

```bash
code --install-extension pablodelucca.pixel-agents
```

---

## Шаг 3. Claude Code CLI (для работы агентов в VS Code)

Pixel Agents визуализирует **Claude Code** терминалы. Нужен установленный и настроенный Claude Code CLI:

- Сайт: **https://claude.com/code** (или актуальная ссылка из документации Anthropic).
- Установка по инструкции для вашей ОС; после установки в VS Code при нажатии **+ Agent** в панели Pixel Agents будет создаваться терминал Claude Code и персонаж в офисе.

---

## Шаг 4. Как пользоваться

1. В VS Code откройте панель **Pixel Agents** (внизу, рядом с терминалом).
2. Нажмите **+ Agent** — создаётся новый терминал Claude Code и персонаж в виртуальном офисе.
3. Задавайте агенту задачи в терминале; персонаж будет анимироваться (печатает, читает, ждёт).
4. Кнопка **Layout** — редактор планировки офиса (пол, стены, мебель).

Подробнее: [github.com/pablodelucca/pixel-agents](https://github.com/pablodelucca/pixel-agents)

---

## Требования

- **VS Code** 1.109.0 или новее.
- **Claude Code CLI** установлен и настроен (для полноценной работы агентов в офисной визуализации).
