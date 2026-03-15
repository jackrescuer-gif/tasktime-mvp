export type UatRole = 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER';

export interface UatStep {
  id: string;
  title: string;
  description: string;
  expectedResult?: string | null;
}

export interface UatTest {
  id: string;
  title: string;
  description: string;
  role: UatRole;
  startPath: string;
  steps: UatStep[];
}

export const UAT_TESTS: UatTest[] = [
  {
    id: 'admin-dashboard-overview',
    title: 'Обзор дашборда администратора',
    description: 'Проверка главного дашборда и базовых метрик системы глазами администратора.',
    role: 'ADMIN',
    startPath: '/',
    steps: [
      {
        id: 'step-1',
        title: 'Открыть дашборд',
        description: 'Убедись, что ты находишься на странице Dashboard после логина под ролью ADMIN.',
        expectedResult:
          'Видны карточки Projects и Total Issues, а также блоки Issues by Status / Issues by Assignee (если есть данные).',
      },
      {
        id: 'step-2',
        title: 'Проверить метрики пользователей и задач',
        description:
          'Проверь, что количество пользователей, проектов, задач и логов времени в дашборде выглядит ожидаемо для демо-данных.',
        expectedResult: 'Значения метрик не равны нулю и соответствуют ожидаемому количеству из seed-данных.',
      },
    ],
  },
  {
    id: 'manager-project-backlog',
    title: 'Работа с бэклогом проекта',
    description: 'Проверка страницы проекта и списка задач глазами менеджера.',
    role: 'MANAGER',
    startPath: '/projects',
    steps: [
      {
        id: 'step-1',
        title: 'Выбрать демо‑проект',
        description:
          'На странице Projects выбери один из демо‑проектов (например, DEMO или BACK) и перейди в его карточку.',
        expectedResult: 'Открыта страница Project Detail с ключом и названием выбранного проекта.',
      },
      {
        id: 'step-2',
        title: 'Посмотреть дашборд задач проекта',
        description:
          'Проверь блоки Issues by Status / Type / Priority и общее количество задач. Обрати внимание на наличие активного спринта.',
        expectedResult: 'Диаграммы и счётчики отображаются без ошибок, значения выглядят реалистично.',
      },
      {
        id: 'step-3',
        title: 'Отфильтровать задачи',
        description:
          'Используй фильтры по статусу, типу и приоритету, чтобы сузить список задач. Попробуй применить и сбросить фильтры.',
        expectedResult: 'Список задач обновляется в соответствии с выбранными фильтрами, кнопки Apply/Reset работают корректно.',
      },
    ],
  },
  {
    id: 'user-my-time',
    title: 'Учёт времени разработчика',
    description: 'Проверка страницы My Time глазами обычного пользователя.',
    role: 'USER',
    startPath: '/time',
    steps: [
      {
        id: 'step-1',
        title: 'Открыть страницу учёта времени',
        description: 'Перейди на вкладку My Time и убедись, что видишь свои логи времени и таймер.',
        expectedResult: 'История логов времени отображается без ошибок, элементы управления таймером доступны.',
      },
      {
        id: 'step-2',
        title: 'Запустить и остановить таймер',
        description:
          'Запусти таймер для одной из задач, подожди несколько секунд и останови его. Проверь, что лог времени появился в списке.',
        expectedResult: 'Создан новый лог времени с корректной продолжительностью и привязкой к задаче.',
      },
    ],
  },
  {
    id: 'viewer-read-only',
    title: 'Проверка read‑only доступа',
    description: 'Проверка, что роль VIEWER видит данные, но не может вносить изменения.',
    role: 'VIEWER',
    startPath: '/',
    steps: [
      {
        id: 'step-1',
        title: 'Проверить дашборд',
        description:
          'Зайди под ролью VIEWER и открой Dashboard. Убедись, что все метрики видны, но нет кнопок создания/редактирования.',
        expectedResult: 'На главной странице нет кнопок создания задач/проектов, только просмотр.',
      },
      {
        id: 'step-2',
        title: 'Открыть проект и задачи',
        description: 'Перейди в любой проект и попробуй изменить статус или создать задачу.',
        expectedResult:
          'Кнопки создания и редактирования недоступны, статус задач нельзя поменять (нет выпадающего списка).',
      },
    ],
  },
  // --- Sprint 4 ---
  {
    id: 'admin-ai-estimate',
    title: 'AI Estimate: оценка трудоёмкости задачи',
    description: 'Проверка AI-оценки в карточке задачи. Требует ANTHROPIC_API_KEY. Без ключа — ответ 503.',
    role: 'ADMIN',
    startPath: '/projects',
    steps: [
      {
        id: 'step-1',
        title: 'Открыть задачу с описанием',
        description:
          'Перейди в любой проект → открой задачу типа TASK или STORY с подробным описанием (хотя бы 2–3 предложения).',
        expectedResult: 'Открыта страница задачи. В правой панели виден блок AI Estimate.',
      },
      {
        id: 'step-2',
        title: 'Запустить AI-оценку',
        description: 'Нажми кнопку AI Estimate в правой панели. Подожди 3–10 секунд.',
        expectedResult: 'Появился результат: часы, confidence (high/medium/low) и краткое обоснование.',
      },
      {
        id: 'step-3',
        title: 'Проверить сохранение оценки',
        description: 'Обнови страницу задачи и проверь поле Estimated hours.',
        expectedResult: 'Поле Estimated hours заполнено числом из AI-оценки.',
      },
      {
        id: 'step-4',
        title: 'Проверить confidence на задаче без описания',
        description: 'Открой задачу без описания и повтори AI Estimate.',
        expectedResult: 'Confidence = low, обоснование указывает на недостаток информации.',
      },
    ],
  },
  {
    id: 'manager-ai-decompose',
    title: 'AI Decompose: декомпозиция EPIC в задачи',
    description: 'Проверка AI-декомпозиции для EPIC и STORY. Доступна ролям ADMIN, MANAGER, USER.',
    role: 'MANAGER',
    startPath: '/projects',
    steps: [
      {
        id: 'step-1',
        title: 'Открыть EPIC',
        description: 'Найди или создай задачу типа EPIC с названием и описанием. Открой её страницу.',
        expectedResult: 'В правой панели виден блок AI Decompose с кнопкой "Decompose into STORYs".',
      },
      {
        id: 'step-2',
        title: 'Получить предложения по декомпозиции',
        description: 'Нажми "Decompose into STORYs". Дождись ответа (5–15 сек).',
        expectedResult: 'AI предложил список из 3–7 дочерних задач с названиями, описаниями и оценками часов.',
      },
      {
        id: 'step-3',
        title: 'Выбрать подзадачи и создать',
        description: 'Сними галочку с одной подзадачи. Нажми "Create selected (N)".',
        expectedResult: 'Задачи созданы, появилось уведомление об успешном создании.',
      },
      {
        id: 'step-4',
        title: 'Проверить иерархию',
        description: 'Обнови страницу EPIC. Проверь секцию Sub-issues.',
        expectedResult: 'Новые дочерние STORY задачи отображаются в иерархии EPIC.',
      },
      {
        id: 'step-5',
        title: 'Проверить TASK — декомпозиция недоступна',
        description: 'Открой задачу типа TASK.',
        expectedResult: 'Блок AI Decompose отсутствует на странице задачи типа TASK.',
      },
    ],
  },
  {
    id: 'admin-export-reports',
    title: 'Экспорт отчётов (CSV и PDF)',
    description: 'Проверка скачивания отчётов по задачам и времени. Доступно ADMIN и MANAGER.',
    role: 'ADMIN',
    startPath: '/admin',
    steps: [
      {
        id: 'step-1',
        title: 'Перейти в раздел Admin → Reports',
        description: 'Открой страницу Admin, найди блок Reports. Выбери проект из выпадающего списка.',
        expectedResult: 'После выбора проекта появились кнопки "Issues CSV", "Issues PDF", "Time CSV".',
      },
      {
        id: 'step-2',
        title: 'Скачать Issues CSV',
        description: 'Нажми "Issues CSV".',
        expectedResult: 'Файл issues.csv скачался. Открой его: должны быть колонки (ID, Title, Status, Type, Priority, Assignee, Created).',
      },
      {
        id: 'step-3',
        title: 'Скачать Issues PDF',
        description: 'Нажми "Issues PDF".',
        expectedResult: 'Файл issues.pdf скачался. Открой его: страница с заголовком проекта, таблица задач.',
      },
      {
        id: 'step-4',
        title: 'Скачать Time CSV',
        description: 'Нажми "Time CSV".',
        expectedResult: 'Файл time.csv скачался с логами времени (пользователь, задача, часы, дата).',
      },
      {
        id: 'step-5',
        title: 'Проверить роль USER',
        description: 'Войди как dev@tasktime.ru и открой /admin.',
        expectedResult: 'Страница Admin недоступна (403) или кнопки экспорта отсутствуют.',
      },
    ],
  },
  {
    id: 'user-telegram-connect',
    title: 'Подключение Telegram-нотификаций',
    description: 'Проверка UI подключения Telegram. Для реальных уведомлений нужен рабочий бот.',
    role: 'USER',
    startPath: '/admin',
    steps: [
      {
        id: 'step-1',
        title: 'Открыть блок Telegram Notifications',
        description: 'Перейди в Admin → найди блок Telegram Notifications.',
        expectedResult: 'Виден блок с инструкцией: найти бота в Telegram, получить chat ID.',
      },
      {
        id: 'step-2',
        title: 'Ввести chat ID',
        description: 'Введи произвольное число в поле "Your Telegram chat ID" и нажми Connect.',
        expectedResult:
          'Если TELEGRAM_BOT_TOKEN настроен — подключение прошло. Без токена — ошибка сервера (503).',
      },
      {
        id: 'step-3',
        title: 'Отключить Telegram',
        description: 'Нажми Disconnect.',
        expectedResult: 'Статус сброшен, кнопка вернулась в состояние "Connect".',
      },
    ],
  },
  {
    id: 'admin-gitlab-integration',
    title: 'Настройка GitLab-интеграции',
    description: 'Проверка формы GitLab Integration в Admin. Настройка доступна только ADMIN.',
    role: 'ADMIN',
    startPath: '/admin',
    steps: [
      {
        id: 'step-1',
        title: 'Открыть блок GitLab Integration',
        description: 'Перейди в Admin → найди блок GitLab Integration.',
        expectedResult: 'Видна форма: выбор проекта, поля GitLab URL, API Token, Webhook Token.',
      },
      {
        id: 'step-2',
        title: 'Попытаться настроить как MANAGER',
        description: 'Войди как manager@tasktime.ru и открой /admin.',
        expectedResult: 'Блок GitLab Integration отсутствует или кнопка Save возвращает 403.',
      },
    ],
  },
];

