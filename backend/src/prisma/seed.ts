import { pathToFileURL } from 'node:url';

import { PrismaClient, Prisma, type User } from '@prisma/client';

import { BOOTSTRAP_USERS, bootstrapDefaultUsers } from './bootstrap.js';

const prisma = new PrismaClient();

export type SeedScope = 'FULL_DEV' | 'TTMP_ONLY';

type SeedActors = {
  admin: Pick<User, 'id' | 'email' | 'name' | 'role'>;
  owner: Pick<User, 'id' | 'email' | 'name' | 'role'>;
  manager: Pick<User, 'id' | 'email' | 'name' | 'role'>;
  dev: Pick<User, 'id' | 'email' | 'name' | 'role'>;
  viewer: Pick<User, 'id' | 'email' | 'name' | 'role'>;
};

type SeedOptions = {
  scope?: SeedScope;
  bootstrapPassword?: string;
};

export function resolveSeedActors(
  users: Pick<User, 'id' | 'email' | 'name' | 'role'>[],
): SeedActors {
  const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));

  const admin = usersByEmail.get('admin@tasktime.ru');
  const owner = usersByEmail.get('novak.pavel@tasktime.ru') ?? admin;
  const manager = usersByEmail.get('manager@tasktime.ru');
  const dev = usersByEmail.get('dev@tasktime.ru');
  const viewer = usersByEmail.get('viewer@tasktime.ru');

  if (!admin || !owner || !manager || !dev || !viewer) {
    throw new Error('Seed requires built-in bootstrap users to exist.');
  }

  return {
    admin,
    owner,
    manager,
    dev,
    viewer,
  };
}

function resolveSeedScope(env: NodeJS.ProcessEnv = process.env): SeedScope {
  return env.SEED_SCOPE?.trim().toUpperCase() === 'TTMP_ONLY'
    ? 'TTMP_ONLY'
    : 'FULL_DEV';
}

export async function seedDatabase(seedPrisma: PrismaClient, options: SeedOptions = {}) {
  const scope = options.scope ?? resolveSeedScope();
  const isFullDevSeed = scope === 'FULL_DEV';

  if (isFullDevSeed) {
    console.log('Seeding development/demo data...');
    console.log('This seed script provides development/demo data and is not the production source of truth.');
  } else {
    console.log('Seeding TTMP project data only...');
    console.log('This mode creates only the TTMP project, its historical sprints, and implementation tasks.');
  }

  const defaultPassword = options.bootstrapPassword ?? 'password123';
  if (isFullDevSeed) {
    await bootstrapDefaultUsers(seedPrisma, defaultPassword);
  }

  const users = await seedPrisma.user.findMany({
    where: {
      email: {
        in: BOOTSTRAP_USERS.map((user) => user.email),
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });
  const { admin, owner, manager, dev, viewer } = resolveSeedActors(users);

  // Create projects
  const project = isFullDevSeed
    ? await seedPrisma.project.upsert({
        where: { key: 'DEMO' },
        update: {},
        create: { name: 'Demo Project', key: 'DEMO', description: 'Demo project for testing' },
      })
    : null;

  const backendProject = isFullDevSeed
    ? await seedPrisma.project.upsert({
        where: { key: 'BACK' },
        update: {},
        create: { name: 'Backend Services', key: 'BACK', description: 'Backend microservices' },
      })
    : null;

  const mvpProject = await seedPrisma.project.upsert({
    where: { key: 'TTMP' },
    update: {},
    create: {
      name: 'TaskTime MVP (vibe-code)',
      key: 'TTMP',
      description: 'MVP системы управления проектами и задачами на vibe-code',
    },
  });

  const liveCodeProject = isFullDevSeed
    ? await seedPrisma.project.upsert({
        where: { key: 'LIVE' },
        update: {},
        create: {
          name: 'TaskTime MVP LiveCode',
          key: 'LIVE',
          description: 'Живой проект: задачи для разработки TaskTime MVP (vibe-code) самим TaskTime и агентами',
        },
      })
    : null;

  // Historical sprints for TaskTime MVP (TTMP)
  const sprint0 = await seedPrisma.sprint.upsert({
    where: { projectId_name: { projectId: mvpProject.id, name: 'Sprint 0 — Развертывание стенда' } },
    update: {},
    create: {
      projectId: mvpProject.id,
      name: 'Sprint 0 — Развертывание стенда',
      goal: 'Подготовка стенда, анализ и планирование MVP',
      startDate: new Date('2026-03-08T09:00:00Z'),
      endDate: new Date('2026-03-08T18:00:00Z'),
      state: 'CLOSED',
    },
  });

  const sprint1 = await seedPrisma.sprint.upsert({
    where: { projectId_name: { projectId: mvpProject.id, name: 'Sprint 1 — Фундамент системы' } },
    update: {},
    create: {
      projectId: mvpProject.id,
      name: 'Sprint 1 — Фундамент системы',
      goal: 'Backend/Frontend фундамент, Auth, Users, Projects, Issues',
      startDate: new Date('2026-03-09T09:00:00Z'),
      endDate: new Date('2026-03-10T18:00:00Z'),
      state: 'CLOSED',
    },
  });

  const sprint2 = await seedPrisma.sprint.upsert({
    where: { projectId_name: { projectId: mvpProject.id, name: 'Sprint 2 — Доски, спринты, время, комментарии' } },
    update: {},
    create: {
      projectId: mvpProject.id,
      name: 'Sprint 2 — Доски, спринты, время, комментарии',
      goal: 'Kanban Board, Sprints, Time tracking, Comments, Issue history',
      startDate: new Date('2026-03-10T09:00:00Z'),
      endDate: new Date('2026-03-10T18:00:00Z'),
      state: 'CLOSED',
    },
  });

  const sprint3 = await seedPrisma.sprint.upsert({
    where: { projectId_name: { projectId: mvpProject.id, name: 'Sprint 3 — Teams, Admin, Reports, Redis' } },
    update: {},
    create: {
      projectId: mvpProject.id,
      name: 'Sprint 3 — Teams, Admin, Reports, Redis',
      goal: 'Teams, Admin, отчёты и доработка Redis по плану Sprint 3',
      startDate: new Date('2026-03-11T09:00:00Z'),
      endDate: new Date('2026-03-11T18:00:00Z'),
      state: 'CLOSED',
    },
  });

  const sprint35 = await seedPrisma.sprint.upsert({
    where: { projectId_name: { projectId: mvpProject.id, name: 'Sprint 3.5 — UX/UI адаптация и багфиксинг' } },
    update: {},
    create: {
      projectId: mvpProject.id,
      name: 'Sprint 3.5 — UX/UI адаптация и багфиксинг',
      goal: 'Полиш UX/UI, UAT и стабилизация после Sprint 3',
      startDate: new Date('2026-03-12T09:00:00Z'),
      endDate: new Date('2026-03-12T18:00:00Z'),
      state: 'ACTIVE',
    },
  });

  if (isFullDevSeed) {
    const demoProject = project!;
    const metaProject = liveCodeProject!;

    // Create issues with hierarchy
    const epic = await prisma.issue.upsert({
    where: { projectId_number: { projectId: demoProject.id, number: 1 } },
    update: {},
    create: {
      projectId: demoProject.id, number: 1, title: 'User Authentication System',
      type: 'EPIC', priority: 'HIGH', creatorId: manager.id, assigneeId: dev.id,
    },
  });

  const story = await prisma.issue.upsert({
    where: { projectId_number: { projectId: demoProject.id, number: 2 } },
    update: {},
    create: {
      projectId: demoProject.id, number: 2, title: 'Login & Registration Flow',
      type: 'STORY', priority: 'HIGH', creatorId: manager.id, assigneeId: dev.id,
      parentId: epic.id, status: 'IN_PROGRESS',
    },
  });

    await prisma.issue.upsert({
    where: { projectId_number: { projectId: demoProject.id, number: 3 } },
    update: {},
    create: {
      projectId: demoProject.id, number: 3, title: 'Implement JWT token generation',
      type: 'TASK', priority: 'HIGH', creatorId: manager.id, assigneeId: dev.id,
      parentId: story.id, status: 'DONE',
    },
  });

    await prisma.issue.upsert({
    where: { projectId_number: { projectId: demoProject.id, number: 4 } },
    update: {},
    create: {
      projectId: demoProject.id, number: 4, title: 'Create login form UI',
      type: 'TASK', priority: 'MEDIUM', creatorId: manager.id, assigneeId: dev.id,
      parentId: story.id, status: 'IN_PROGRESS',
    },
  });

    await prisma.issue.upsert({
    where: { projectId_number: { projectId: demoProject.id, number: 5 } },
    update: {},
    create: {
      projectId: demoProject.id,
      number: 5,
      title: 'Fix password validation bug',
      type: 'BUG',
      priority: 'CRITICAL',
      creatorId: dev.id,
      parentId: epic.id,
    },
  });

    // MVP LiveCode meta issues (agent vs human work)
    await prisma.issue.upsert({
    where: { projectId_number: { projectId: metaProject.id, number: 1 } },
    update: {},
    create: {
      projectId: metaProject.id,
      number: 1,
      title: 'Настроить MVP LiveCode как мета-проект',
      type: 'EPIC',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      aiEligible: false,
      aiExecutionStatus: 'NOT_STARTED',
      aiAssigneeType: 'HUMAN',
    },
  });

    await prisma.issue.upsert({
    where: { projectId_number: { projectId: metaProject.id, number: 2 } },
    update: {},
    create: {
      projectId: metaProject.id,
      number: 2,
      title: 'Добавить флаг "делает агент" к задачам',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      aiEligible: true,
      aiExecutionStatus: 'NOT_STARTED',
      aiAssigneeType: 'AGENT',
    },
  });

    await prisma.issue.upsert({
    where: { projectId_number: { projectId: metaProject.id, number: 3 } },
    update: {},
    create: {
      projectId: metaProject.id,
      number: 3,
      title: 'Показать активные задачи MVP LiveCode через API',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      aiEligible: true,
      aiExecutionStatus: 'NOT_STARTED',
      aiAssigneeType: 'AGENT',
    },
  });

  }

  // Backlog (MVP project): EPIC — Исследование и планирование MVP
  const epicResearch = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 1 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint0.id,
      number: 1,
      title: 'Исследование и планирование MVP',
      type: 'EPIC',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
    },
  });

  const storyInterview = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 2 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint0.id,
      number: 2,
      title: 'Интервью по 8 блокам и сбор требований Jira Cut',
      type: 'STORY',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicResearch.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 3 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint0.id,
      number: 3,
      title: 'Сформировать требования по продукту, пользователям и сценариям',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyInterview.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 4 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint0.id,
      number: 4,
      title: 'Описать интеграции (GitLab, Confluence, Telegram-бот)',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyInterview.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 5 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint0.id,
      number: 5,
      title: 'Зафиксировать требования по безопасности (RBAC, audit log, ФЗ-152)',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyInterview.id,
    },
  });

  const storyStack = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 6 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint0.id,
      number: 6,
      title: 'Выбор и фиксация технологического стека',
      type: 'STORY',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicResearch.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 7 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint0.id,
      number: 7,
      title: 'Выбрать стек backend (Node 20, Express, TS, Prisma, PostgreSQL, Redis)',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyStack.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 8 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint0.id,
      number: 8,
      title: 'Выбрать стек frontend (React 18, Vite, Zustand, Ant Design)',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyStack.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 9 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint0.id,
      number: 9,
      title: 'Зафиксировать архитектуру модульного монолита и доменную модель',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyStack.id,
    },
  });

  const storyRebuildPlan = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 10 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint0.id,
      number: 10,
      title: 'План пересборки v2',
      type: 'STORY',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicResearch.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 11 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint0.id,
      number: 11,
      title: 'Написать документ REBUILD_PLAN_V2 с архитектурой, API, RBAC, спринтами и NFR',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyRebuildPlan.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 12 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint0.id,
      number: 12,
      title: 'Зафиксировать требования к ОС, браузерам и стратегии деплоя',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyRebuildPlan.id,
    },
  });

  // Backlog (MVP project): EPIC — Спринт 1 — Фундамент системы
  const epicSprint1 = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 13 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 13,
      title: 'Спринт 1 — Фундамент системы',
      type: 'EPIC',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
    },
  });

  const storyBackendInfra = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 14 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 14,
      title: 'Базовый backend и инфраструктура',
      type: 'STORY',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicSprint1.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 15 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 15,
      title: 'Инициализировать backend-проект (Express + TypeScript + ESLint/Prettier)',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyBackendInfra.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 16 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 16,
      title: 'Настроить Prisma 6 c PostgreSQL 16',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyBackendInfra.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 17 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      number: 17,
      title: 'Описать Prisma-схему (User, Project, Issue, Comment, AuditLog)',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyBackendInfra.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 18 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      number: 18,
      title: 'Реализовать middleware для ошибок и логирования',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyBackendInfra.id,
    },
  });

  const storyAuthModule = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 19 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 19,
      title: 'Модуль аутентификации (Auth)',
      type: 'STORY',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicSprint1.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 20 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 20,
      title: 'Реализовать API регистрации, логина, refresh, logout и me на JWT + refresh-токенах',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyAuthModule.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 21 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 21,
      title: 'Настроить хранение и проверку токенов, bcrypt-хэширование паролей',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyAuthModule.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 22 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      number: 22,
      title: 'Интегрировать RBAC-проверку в middleware',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyAuthModule.id,
    },
  });

  const storyUsersRbac = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 23 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 23,
      title: 'Пользователи и роли (Users + RBAC)',
      type: 'STORY',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicSprint1.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 24 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 24,
      title: 'Реализовать CRUD пользователей и смену ролей (Admin, Manager, User, Viewer)',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyUsersRbac.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 25 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 25,
      title: 'Реализовать RBAC по ролям на уровне middleware',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyUsersRbac.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 26 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      number: 26,
      title: 'Привязать аудит действий к пользователю и сущности',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyUsersRbac.id,
    },
  });

  const storyProjects = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 27 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 27,
      title: 'Проекты (Projects)',
      type: 'STORY',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicSprint1.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 28 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      number: 28,
      title: 'Реализовать CRUD проектов с ключами (DEMO, BACK и т.п.)',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyProjects.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 29 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      number: 29,
      title: 'Сделать API фильтрации и получения проектов по пользователю',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyProjects.id,
    },
  });

  const storyIssues = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 30 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 30,
      title: 'Задачи и иерархия (Issues)',
      type: 'STORY',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicSprint1.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 31 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 31,
      title: 'Описать модель задач с типами EPIC/STORY/TASK/SUBTASK/BUG',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyIssues.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 32 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 32,
      title: 'Реализовать статусы задач (OPEN, IN_PROGRESS, REVIEW, DONE, CANCELLED)',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyIssues.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 33 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 33,
      title: 'Описать связи родитель–потомок и генерацию ключа PROJECT_KEY-NUMBER',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyIssues.id,
    },
  });

  const storyAudit = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 34 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 34,
      title: 'Аудит и безопасность (AuditLog)',
      type: 'STORY',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicSprint1.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 35 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 35,
      title: 'Реализовать middleware аудита всех мутаций',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyAudit.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 36 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      number: 36,
      title: 'Привязать записи аудита к пользователю, ресурсу и действию',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyAudit.id,
    },
  });

  const storyFrontendShell = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 37 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 37,
      title: 'Frontend — базовая оболочка',
      type: 'STORY',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicSprint1.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 38 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 38,
      title: 'Инициализировать frontend (Vite + React + Ant Design + Zustand)',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyFrontendShell.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 39 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      number: 39,
      title: 'Настроить роутинг и базовый AppLayout',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyFrontendShell.id,
    },
  });

  const storyFrontendAuthNav = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 40 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 40,
      title: 'Frontend — аутентификация и навигация',
      type: 'STORY',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicSprint1.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 41 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 41,
      title: 'Реализовать LoginPage с интеграцией Auth API',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyFrontendAuthNav.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 42 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      number: 42,
      title: 'Настроить хранение auth-состояния и защиту маршрутов',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyFrontendAuthNav.id,
    },
  });

  const storyFrontendProjectsIssues = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 43 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 43,
      title: 'Frontend — проекты и задачи',
      type: 'STORY',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicSprint1.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 44 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 44,
      title: 'Реализовать ProjectsPage (список проектов)',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyFrontendProjectsIssues.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 45 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 45,
      title: 'Реализовать ProjectDetailPage со списком задач',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyFrontendProjectsIssues.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 46 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      number: 46,
      title: 'Реализовать форму создания/редактирования задач',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyFrontendProjectsIssues.id,
    },
  });

  const storySeedLocal = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 47 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 47,
      title: 'Seed-данные и локальный запуск',
      type: 'STORY',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicSprint1.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 48 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 48,
      title: 'Написать seed-скрипт (4 пользователя, 2 проекта, 5 задач)',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storySeedLocal.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 49 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint1.id,
      number: 49,
      title: 'Настроить Docker Compose (PostgreSQL 16 + Redis 7)',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storySeedLocal.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 50 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      number: 50,
      title: 'Настроить Makefile с целями setup, dev, backend, frontend',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storySeedLocal.id,
    },
  });

  // Backlog (MVP project): EPIC — Спринт 2 — Доски, спринты, время, комментарии
  const epicSprint2 = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 51 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint2.id,
      number: 51,
      title: 'Спринт 2 — Доски, спринты, время, комментарии',
      type: 'EPIC',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
    },
  });

  const storyBoard = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 52 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint2.id,
      number: 52,
      title: 'Kanban Board (backend + UI)',
      type: 'STORY',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicSprint2.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 53 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint2.id,
      number: 53,
      title: 'Реализовать API канбан-доски (колонки по статусам, порядок задач)',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyBoard.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 54 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint2.id,
      number: 54,
      title: 'Добавить drag-n-drop перемещение задач с сохранением порядка и статуса',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyBoard.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 55 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      number: 55,
      title: 'Реализовать UI доски проекта (BoardPage)',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyBoard.id,
    },
  });

  const storySprints = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 56 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint2.id,
      number: 56,
      title: 'Спринты (Sprints)',
      type: 'STORY',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicSprint2.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 57 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint2.id,
      number: 57,
      title: 'Реализовать модель и API спринтов (создание, старт, закрытие)',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storySprints.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 58 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint2.id,
      number: 58,
      title: 'Реализовать перенос задач между бэклогом и активным спринтом',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storySprints.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 59 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint2.id,
      number: 59,
      title: 'Обеспечить один ACTIVE-спринт на проект',
      type: 'TASK',
      priority: 'HIGH',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storySprints.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 60 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      number: 60,
      title: 'Реализовать UI спринтов (SprintsPage)',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storySprints.id,
    },
  });

  const storyTime = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 61 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint2.id,
      number: 61,
      title: 'Учёт времени (Time tracking)',
      type: 'STORY',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicSprint2.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 62 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint2.id,
      number: 62,
      title: 'Реализовать API таймера (старт/стоп) и ручного ввода времени',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyTime.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 63 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint2.id,
      number: 63,
      title: 'Логировать время по пользователю и задаче',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyTime.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 64 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      number: 64,
      title: 'Реализовать страницу My Time (TimePage) с агрегированными данными',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyTime.id,
    },
  });

  const storyComments = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 65 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint2.id,
      number: 65,
      title: 'Комментарии к задачам (Comments)',
      type: 'STORY',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicSprint2.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 66 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint2.id,
      number: 66,
      title: 'Реализовать API CRUD комментариев с проверкой прав',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyComments.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 67 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      number: 67,
      title: 'Добавить блок комментариев на IssueDetailPage',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyComments.id,
    },
  });

  const storyIssueCardHistory = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 68 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint2.id,
      number: 68,
      title: 'Карточка задачи и история изменений',
      type: 'STORY',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicSprint2.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 69 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint2.id,
      number: 69,
      title: 'Собрать полную карточку задачи (поля, иерархия, связи, время, комментарии)',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyIssueCardHistory.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 70 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      number: 70,
      title: 'Показать историю изменений задачи из audit_log на UI',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyIssueCardHistory.id,
    },
  });

  // Backlog (MVP project): EPIC — Admin, UAT и инженерные улучшения
  const epicAdminUat = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 71 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint3.id,
      number: 71,
      title: 'Admin, UAT и инженерные улучшения',
      type: 'EPIC',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
    },
  });

  const storyAdminModule = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 72 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint3.id,
      number: 72,
      title: 'Admin-модуль',
      type: 'STORY',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicAdminUat.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 73 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint3.id,
      number: 73,
      title: 'Реализовать admin.service и admin.router с доступом только для ADMIN',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyAdminModule.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 74 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      number: 74,
      title: 'Реализовать страницу AdminPage с основными административными секциями',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyAdminModule.id,
    },
  });

  const storyUatOnboarding = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 75 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint35.id,
      number: 75,
      title: 'UAT-тесты и онбординг',
      type: 'STORY',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicAdminUat.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 76 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint35.id,
      number: 76,
      title: 'Добавить данные UAT-тестов на backend и API для их получения',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyUatOnboarding.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 77 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      number: 77,
      title: 'Реализовать страницу UatTestsPage и оверлей UatOnboardingOverlay',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyUatOnboarding.id,
    },
  });

  const storyE2eUx = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 78 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint35.id,
      number: 78,
      title: 'E2E и UX-полиш',
      type: 'STORY',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicAdminUat.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 79 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint35.id,
      number: 79,
      title: 'Настроить Playwright (playwright.config.ts, main-flows.spec.ts) для основных флоу',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyE2eUx.id,
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 80 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      number: 80,
      title: 'Расширить styles.css под современный Linear-like UI',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyE2eUx.id,
    },
  });

  // ===== Bulk-update all Sprint 0–3.5 issues: status DONE, aiAssigneeType, aiEligible =====
  // Sprint 0 (#1-12): Research & planning — purely HUMAN (PO interviews, requirements gathering)
  const sprint0IssueNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  for (const num of sprint0IssueNumbers) {
    await prisma.issue.update({
      where: { projectId_number: { projectId: mvpProject.id, number: num } },
      data: {
        status: 'DONE',
        aiEligible: false,
        aiAssigneeType: 'HUMAN',
        aiExecutionStatus: 'NOT_STARTED',
      },
    });
  }

  // Sprint 1 (#13-50): Foundation — vibe-coding (HUMAN_AI), PO directed Claude
  // EPICs/STORYs = MIXED (planning HUMAN + code AGENT), TASKs = HUMAN_AI (vibe-coding)
  const sprint1Epics = [13]; // EPIC — coordination
  const sprint1Stories = [14, 19, 23, 27, 30, 34, 37, 40, 43, 47];
  const sprint1Tasks = [15, 16, 17, 18, 20, 21, 22, 24, 25, 26, 28, 29, 31, 32, 33, 35, 36, 38, 39, 41, 42, 44, 45, 46, 48, 49, 50];

  for (const num of sprint1Epics) {
    await prisma.issue.update({
      where: { projectId_number: { projectId: mvpProject.id, number: num } },
      data: { status: 'DONE', aiEligible: true, aiAssigneeType: 'MIXED', aiExecutionStatus: 'DONE' },
    });
  }
  for (const num of sprint1Stories) {
    await prisma.issue.update({
      where: { projectId_number: { projectId: mvpProject.id, number: num } },
      data: { status: 'DONE', aiEligible: true, aiAssigneeType: 'MIXED', aiExecutionStatus: 'DONE' },
    });
  }
  for (const num of sprint1Tasks) {
    await prisma.issue.update({
      where: { projectId_number: { projectId: mvpProject.id, number: num } },
      data: { status: 'DONE', aiEligible: true, aiAssigneeType: 'MIXED', aiExecutionStatus: 'DONE' },
    });
  }

  // Sprint 2 (#51-70): Boards, sprints, time, comments — vibe-coding (HUMAN_AI)
  const sprint2Epics = [51];
  const sprint2Stories = [52, 56, 61, 65, 68];
  const sprint2Tasks = [53, 54, 55, 57, 58, 59, 60, 62, 63, 64, 66, 67, 69, 70];

  for (const num of sprint2Epics) {
    await prisma.issue.update({
      where: { projectId_number: { projectId: mvpProject.id, number: num } },
      data: { status: 'DONE', aiEligible: true, aiAssigneeType: 'MIXED', aiExecutionStatus: 'DONE' },
    });
  }
  for (const num of sprint2Stories) {
    await prisma.issue.update({
      where: { projectId_number: { projectId: mvpProject.id, number: num } },
      data: { status: 'DONE', aiEligible: true, aiAssigneeType: 'MIXED', aiExecutionStatus: 'DONE' },
    });
  }
  for (const num of sprint2Tasks) {
    await prisma.issue.update({
      where: { projectId_number: { projectId: mvpProject.id, number: num } },
      data: { status: 'DONE', aiEligible: true, aiAssigneeType: 'MIXED', aiExecutionStatus: 'DONE' },
    });
  }

  // Sprint 3 (#71-74): Admin module — vibe-coding (HUMAN_AI)
  await prisma.issue.update({
    where: { projectId_number: { projectId: mvpProject.id, number: 71 } },
    data: { status: 'DONE', aiEligible: true, aiAssigneeType: 'MIXED', aiExecutionStatus: 'DONE' },
  });
  for (const num of [72]) {
    await prisma.issue.update({
      where: { projectId_number: { projectId: mvpProject.id, number: num } },
      data: { status: 'DONE', aiEligible: true, aiAssigneeType: 'MIXED', aiExecutionStatus: 'DONE' },
    });
  }
  for (const num of [73, 74]) {
    await prisma.issue.update({
      where: { projectId_number: { projectId: mvpProject.id, number: num } },
      data: { status: 'DONE', aiEligible: true, aiAssigneeType: 'MIXED', aiExecutionStatus: 'DONE' },
    });
  }

  // Sprint 3.5 (#75-80): UAT, E2E, UX polish — vibe-coding (HUMAN_AI)
  for (const num of [75, 78]) {
    await prisma.issue.update({
      where: { projectId_number: { projectId: mvpProject.id, number: num } },
      data: { status: 'DONE', aiEligible: true, aiAssigneeType: 'MIXED', aiExecutionStatus: 'DONE' },
    });
  }
  for (const num of [76, 77, 79, 80]) {
    await prisma.issue.update({
      where: { projectId_number: { projectId: mvpProject.id, number: num } },
      data: { status: 'DONE', aiEligible: true, aiAssigneeType: 'MIXED', aiExecutionStatus: 'DONE' },
    });
  }

  // ===== Realistic time logs for all TTMP tasks (Sprint 0–3.5) =====
  // Skip if time logs already populated (idempotent)
  const existingTtmpTimeLogs = await prisma.timeLog.count({
    where: { issue: { projectId: mvpProject.id, number: { lte: 80 } } },
  });

  if (existingTtmpTimeLogs <= 5) {
    // Helper: Sprint dates
    const S0_DATE = new Date('2026-03-08');
    const S1_DATE = new Date('2026-03-09');
    const S2_DATE = new Date('2026-03-10');
    const S3_DATE = new Date('2026-03-11');
    const S35_DATE = new Date('2026-03-12');

    // Issue lookup helper
    const issueByNumber = async (num: number) =>
      prisma.issue.findUniqueOrThrow({
        where: { projectId_number: { projectId: mvpProject.id, number: num } },
        select: { id: true },
      });

    // ──────────────────────────────────────────────
    // Sprint 0: Research (8 Mar) — 100% HUMAN (PO + analyst)
    // Total: ~9h across 3 people
    // ──────────────────────────────────────────────
    const s0TimeLogs: Array<{ num: number; userId: string; hours: number; note: string }> = [
      // EPIC #1 — no time (container)
      // STORY #2 — Interviews
      { num: 3, userId: owner.id, hours: 2.0, note: 'Интервью с PO: блоки 1-4 (продукт, пользователи, функции, интеграции)' },
      { num: 3, userId: manager.id, hours: 2.0, note: 'Участие в интервью, фиксация требований' },
      { num: 4, userId: owner.id, hours: 0.5, note: 'Описание интеграций GitLab/Confluence/Telegram' },
      { num: 5, userId: owner.id, hours: 1.0, note: 'Интервью блок 5: безопасность, RBAC, ФЗ-152' },
      { num: 5, userId: manager.id, hours: 1.0, note: 'Фиксация требований ИБ' },
      // STORY #6 — Stack
      { num: 7, userId: owner.id, hours: 0.5, note: 'Выбор backend-стека: Node/Express/Prisma/PG' },
      { num: 8, userId: owner.id, hours: 0.5, note: 'Выбор frontend-стека: React/Vite/AntD/Zustand' },
      { num: 9, userId: owner.id, hours: 0.75, note: 'Проектирование модульного монолита' },
      // STORY #10 — Rebuild plan
      { num: 11, userId: owner.id, hours: 1.5, note: 'Написание REBUILD_PLAN_V2 (800+ строк)' },
      { num: 12, userId: owner.id, hours: 0.5, note: 'Требования к ОС (Astra Linux, Red OS), браузерам, деплою' },
    ];

    for (const log of s0TimeLogs) {
      const issue = await issueByNumber(log.num);
      await prisma.timeLog.create({
        data: {
          issueId: issue.id,
          userId: log.userId,
          hours: new Prisma.Decimal(log.hours),
          note: log.note,
          logDate: S0_DATE,
          source: 'HUMAN',
        },
      });
    }

    // ──────────────────────────────────────────────
    // Sprint 1: Foundation (9-10 Mar) — vibe-coding with Claude
    // Total: ~20h HUMAN_AI + ~4h AI autonomous
    // Pattern: owner gives prompts, Claude generates, owner reviews
    // ──────────────────────────────────────────────
    const s1TimeLogs: Array<{ num: number; userId: string; hours: number; source: 'HUMAN_AI' | 'HUMAN'; note: string }> = [
      // Backend infra (#14-18)
      { num: 15, userId: owner.id, hours: 1.0, source: 'HUMAN_AI', note: 'Вайб-код: scaffold Express+TS+ESLint с Claude' },
      { num: 16, userId: owner.id, hours: 0.75, source: 'HUMAN_AI', note: 'Вайб-код: настройка Prisma 6 + PG16 с Claude' },
      { num: 17, userId: owner.id, hours: 1.5, source: 'HUMAN_AI', note: 'Вайб-код: Prisma schema (User, Project, Issue, Comment, AuditLog) с Claude' },
      { num: 18, userId: owner.id, hours: 0.5, source: 'HUMAN_AI', note: 'Вайб-код: error handling + logging middleware с Claude' },
      // Auth (#19-22)
      { num: 20, userId: owner.id, hours: 1.5, source: 'HUMAN_AI', note: 'Вайб-код: auth API (register/login/refresh/logout/me) с Claude' },
      { num: 21, userId: owner.id, hours: 0.75, source: 'HUMAN_AI', note: 'Вайб-код: JWT + refresh tokens + bcrypt с Claude' },
      { num: 22, userId: owner.id, hours: 0.5, source: 'HUMAN_AI', note: 'Вайб-код: RBAC middleware с Claude' },
      // Users (#23-26)
      { num: 24, userId: owner.id, hours: 1.0, source: 'HUMAN_AI', note: 'Вайб-код: CRUD users + role management с Claude' },
      { num: 25, userId: owner.id, hours: 0.5, source: 'HUMAN_AI', note: 'Вайб-код: RBAC middleware по ролям с Claude' },
      { num: 26, userId: owner.id, hours: 0.5, source: 'HUMAN_AI', note: 'Вайб-код: привязка audit к user/entity с Claude' },
      // Projects (#27-29)
      { num: 28, userId: owner.id, hours: 0.75, source: 'HUMAN_AI', note: 'Вайб-код: CRUD проектов с ключами с Claude' },
      { num: 29, userId: owner.id, hours: 0.5, source: 'HUMAN_AI', note: 'Вайб-код: API фильтрации проектов с Claude' },
      // Issues (#30-33)
      { num: 31, userId: owner.id, hours: 1.0, source: 'HUMAN_AI', note: 'Вайб-код: модель задач EPIC/STORY/TASK/SUBTASK/BUG с Claude' },
      { num: 32, userId: owner.id, hours: 0.75, source: 'HUMAN_AI', note: 'Вайб-код: статусы OPEN→IN_PROGRESS→REVIEW→DONE с Claude' },
      { num: 33, userId: owner.id, hours: 0.5, source: 'HUMAN_AI', note: 'Вайб-код: иерархия parent-child + key generation с Claude' },
      // Audit (#34-36)
      { num: 35, userId: owner.id, hours: 0.75, source: 'HUMAN_AI', note: 'Вайб-код: audit middleware для всех мутаций с Claude' },
      { num: 36, userId: owner.id, hours: 0.5, source: 'HUMAN_AI', note: 'Вайб-код: audit log привязка к user/resource/action с Claude' },
      // Frontend shell (#37-39)
      { num: 38, userId: owner.id, hours: 1.0, source: 'HUMAN_AI', note: 'Вайб-код: Vite+React+AntD+Zustand scaffold с Claude' },
      { num: 39, userId: owner.id, hours: 0.5, source: 'HUMAN_AI', note: 'Вайб-код: React Router + AppLayout с Claude' },
      // Frontend auth (#40-42)
      { num: 41, userId: owner.id, hours: 0.75, source: 'HUMAN_AI', note: 'Вайб-код: LoginPage + Auth API integration с Claude' },
      { num: 42, userId: owner.id, hours: 0.5, source: 'HUMAN_AI', note: 'Вайб-код: auth state + protected routes с Claude' },
      // Frontend projects (#43-46)
      { num: 44, userId: owner.id, hours: 0.75, source: 'HUMAN_AI', note: 'Вайб-код: ProjectsPage с Claude' },
      { num: 45, userId: owner.id, hours: 0.75, source: 'HUMAN_AI', note: 'Вайб-код: ProjectDetailPage + issues list с Claude' },
      { num: 46, userId: owner.id, hours: 0.75, source: 'HUMAN_AI', note: 'Вайб-код: issue create/edit form с Claude' },
      // Seed & local (#47-50)
      { num: 48, userId: owner.id, hours: 0.75, source: 'HUMAN_AI', note: 'Вайб-код: seed script (users, projects, issues) с Claude' },
      { num: 49, userId: owner.id, hours: 0.5, source: 'HUMAN_AI', note: 'Вайб-код: Docker Compose (PG16 + Redis 7) с Claude' },
      { num: 50, userId: owner.id, hours: 0.5, source: 'HUMAN_AI', note: 'Вайб-код: Makefile setup/dev/backend/frontend с Claude' },
      // Manager review
      { num: 13, userId: manager.id, hours: 1.0, source: 'HUMAN', note: 'Приёмка Sprint 1: проверка всех модулей и seed' },
    ];

    for (const log of s1TimeLogs) {
      const issue = await issueByNumber(log.num);
      await prisma.timeLog.create({
        data: {
          issueId: issue.id,
          userId: log.userId,
          hours: new Prisma.Decimal(log.hours),
          note: log.note,
          logDate: S1_DATE,
          source: log.source,
        },
      });
    }

    // ──────────────────────────────────────────────
    // Sprint 2: Boards, sprints, time, comments (10 Mar)
    // Total: ~15h HUMAN_AI + ~1h HUMAN review
    // ──────────────────────────────────────────────
    const s2TimeLogs: Array<{ num: number; userId: string; hours: number; source: 'HUMAN_AI' | 'HUMAN'; note: string }> = [
      // Kanban board (#52-55)
      { num: 53, userId: owner.id, hours: 1.5, source: 'HUMAN_AI', note: 'Вайб-код: Board API (колонки, порядок задач) с Claude' },
      { num: 54, userId: owner.id, hours: 1.25, source: 'HUMAN_AI', note: 'Вайб-код: drag-n-drop + status/order save с Claude' },
      { num: 55, userId: owner.id, hours: 1.5, source: 'HUMAN_AI', note: 'Вайб-код: BoardPage UI с Claude' },
      // Sprints (#56-60)
      { num: 57, userId: owner.id, hours: 1.0, source: 'HUMAN_AI', note: 'Вайб-код: sprints API (create/start/close) с Claude' },
      { num: 58, userId: owner.id, hours: 0.75, source: 'HUMAN_AI', note: 'Вайб-код: перемещение задач backlog↔sprint с Claude' },
      { num: 59, userId: owner.id, hours: 0.5, source: 'HUMAN_AI', note: 'Вайб-код: one ACTIVE sprint constraint с Claude' },
      { num: 60, userId: owner.id, hours: 1.0, source: 'HUMAN_AI', note: 'Вайб-код: SprintsPage UI с Claude' },
      // Time tracking (#61-64)
      { num: 62, userId: owner.id, hours: 1.25, source: 'HUMAN_AI', note: 'Вайб-код: timer API (start/stop) + manual entry с Claude' },
      { num: 63, userId: owner.id, hours: 0.75, source: 'HUMAN_AI', note: 'Вайб-код: time log by user+issue с Claude' },
      { num: 64, userId: owner.id, hours: 1.5, source: 'HUMAN_AI', note: 'Вайб-код: TimePage (My Time) с агрегацией с Claude' },
      // Comments (#65-67)
      { num: 66, userId: owner.id, hours: 0.75, source: 'HUMAN_AI', note: 'Вайб-код: comments CRUD API с Claude' },
      { num: 67, userId: owner.id, hours: 0.5, source: 'HUMAN_AI', note: 'Вайб-код: comments block on IssueDetailPage с Claude' },
      // Issue card (#68-70)
      { num: 69, userId: owner.id, hours: 1.25, source: 'HUMAN_AI', note: 'Вайб-код: IssueDetailPage (fields, hierarchy, time, comments) с Claude' },
      { num: 70, userId: owner.id, hours: 1.0, source: 'HUMAN_AI', note: 'Вайб-код: issue history from audit_log с Claude' },
      // Manager review
      { num: 51, userId: manager.id, hours: 1.0, source: 'HUMAN', note: 'Приёмка Sprint 2: тестирование доски, спринтов, времени' },
    ];

    for (const log of s2TimeLogs) {
      const issue = await issueByNumber(log.num);
      await prisma.timeLog.create({
        data: {
          issueId: issue.id,
          userId: log.userId,
          hours: new Prisma.Decimal(log.hours),
          note: log.note,
          logDate: S2_DATE,
          source: log.source,
        },
      });
    }

    // ──────────────────────────────────────────────
    // Sprint 3: Teams, Admin, Reports (11 Mar)
    // Total: ~5h HUMAN_AI + ~0.5h HUMAN review
    // ──────────────────────────────────────────────
    const s3TimeLogs: Array<{ num: number; userId: string; hours: number; source: 'HUMAN_AI' | 'HUMAN'; note: string }> = [
      { num: 73, userId: owner.id, hours: 1.5, source: 'HUMAN_AI', note: 'Вайб-код: admin.service + admin.router (ADMIN only) с Claude' },
      { num: 74, userId: owner.id, hours: 1.5, source: 'HUMAN_AI', note: 'Вайб-код: AdminPage UI с Claude' },
      { num: 71, userId: manager.id, hours: 0.5, source: 'HUMAN', note: 'Приёмка Sprint 3: admin, teams, reports' },
    ];

    for (const log of s3TimeLogs) {
      const issue = await issueByNumber(log.num);
      await prisma.timeLog.create({
        data: {
          issueId: issue.id,
          userId: log.userId,
          hours: new Prisma.Decimal(log.hours),
          note: log.note,
          logDate: S3_DATE,
          source: log.source,
        },
      });
    }

    // ──────────────────────────────────────────────
    // Sprint 3.5: UAT, E2E, UX polish (12 Mar)
    // Total: ~6h HUMAN_AI + ~1h HUMAN review
    // ──────────────────────────────────────────────
    const s35TimeLogs: Array<{ num: number; userId: string; hours: number; source: 'HUMAN_AI' | 'HUMAN'; note: string }> = [
      { num: 76, userId: owner.id, hours: 1.0, source: 'HUMAN_AI', note: 'Вайб-код: UAT test data + API с Claude' },
      { num: 77, userId: owner.id, hours: 1.25, source: 'HUMAN_AI', note: 'Вайб-код: UatTestsPage + UatOnboardingOverlay с Claude' },
      { num: 79, userId: owner.id, hours: 1.5, source: 'HUMAN_AI', note: 'Вайб-код: Playwright config + main-flows.spec.ts с Claude' },
      { num: 80, userId: owner.id, hours: 1.25, source: 'HUMAN_AI', note: 'Вайб-код: Linear-like UI styles с Claude' },
      { num: 75, userId: manager.id, hours: 0.5, source: 'HUMAN', note: 'UAT приёмка: онбординг и тесты' },
      { num: 78, userId: manager.id, hours: 0.5, source: 'HUMAN', note: 'Визуальная приёмка UX polish' },
    ];

    for (const log of s35TimeLogs) {
      const issue = await issueByNumber(log.num);
      await prisma.timeLog.create({
        data: {
          issueId: issue.id,
          userId: log.userId,
          hours: new Prisma.Decimal(log.hours),
          note: log.note,
          logDate: S35_DATE,
          source: log.source,
        },
      });
    }
  }

  // ===== Sprint 4 — AI, Export API, Интеграции =====
  const sprint4 = await seedPrisma.sprint.upsert({
    where: { projectId_name: { projectId: mvpProject.id, name: 'Sprint 4 — AI, Export API, Интеграции' } },
    update: {},
    create: {
      projectId: mvpProject.id,
      name: 'Sprint 4 — AI, Export API, Интеграции',
      goal: 'Export Open Tasks API, 3-way time analytics (HUMAN/HUMAN_AI/AGENT), AI-интеграции, GitLab/Telegram',
      startDate: new Date('2026-03-15T09:00:00Z'),
      endDate: new Date('2026-03-17T18:00:00Z'),
      state: 'ACTIVE',
    },
  });

  // Close Sprint 3.5 now that Sprint 4 is active
  await seedPrisma.sprint.update({
    where: { id: sprint35.id },
    data: { state: 'CLOSED' },
  });

  const epicSprint4 = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 81 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint4.id,
      number: 81,
      title: 'Sprint 4 — AI-модуль, Export API, интеграции',
      type: 'EPIC',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      creatorId: manager.id,
      assigneeId: dev.id,
    },
  });

  const storyExportApi = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 82 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint4.id,
      number: 82,
      title: 'Export Open Tasks API для AI-агентов',
      type: 'STORY',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicSprint4.id,
      aiEligible: true,
      aiAssigneeType: 'AGENT',
    },
  });

  const taskExportEndpoints = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 83 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint4.id,
      number: 83,
      title: 'Реализовать 8 эндпоинтов Export API (open-tasks, plan, dev-result, test-result, dev-links, ai-status)',
      type: 'TASK',
      priority: 'HIGH',
      status: 'REVIEW',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyExportApi.id,
      aiEligible: true,
      aiExecutionStatus: 'DONE',
      aiAssigneeType: 'AGENT',
      aiPlan: '## План реализации Export API\n\n1. Prisma schema: DevLink model + aiPlan/aiDevResult/aiTestResult на Issue\n2. export.dto.ts — Zod-валидация для всех 8 эндпоинтов\n3. export.service.ts — бизнес-логика с time breakdown агрегацией\n4. export.router.ts — Express router + audit logging\n5. Регистрация в app.ts',
      aiDevResult: 'Реализованы 8 эндпоинтов:\n- GET /export/open-tasks (фильтры + time breakdown)\n- GET /export/open-tasks/:id (детали + comments + devLinks)\n- GET /export/tasks/:id/time-summary\n- PATCH plan/dev-result/test-result\n- POST dev-links\n- PATCH ai-status\n\n526 строк кода, 13 файлов изменено.',
      aiTestResult: 'Backend: `npx tsc --noEmit` — 0 ошибок.\nФронтенд: типы обновлены, компилируется (ошибки только из-за отсутствия node_modules в CI).',
    },
  });

  const taskTimeAnalytics = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 84 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint4.id,
      number: 84,
      title: 'Добавить HUMAN_AI в TimeSource + 3-way аналитику (Human / Human+AI / AI)',
      type: 'TASK',
      priority: 'HIGH',
      status: 'REVIEW',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyExportApi.id,
      aiEligible: true,
      aiExecutionStatus: 'DONE',
      aiAssigneeType: 'MIXED',
      aiPlan: '## 3-Way Time Analytics\n\n1. Расширить TimeSource enum: HUMAN | HUMAN_AI | AGENT\n2. time.dto — source в manualTimeDto\n3. time.service — передавать source, расширить groupBy\n4. time.domain — humanAiHours + humanAiCost в summary\n5. Frontend: 3 карточки, 3 бейджа, selector в модалке',
      aiDevResult: 'TimeSource расширен на HUMAN_AI.\nВсе summary-функции возвращают 3-way breakdown.\nUI: карточка Human+AI (cyan), selector source при ручном вводе.',
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 85 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint4.id,
      number: 85,
      title: 'Prisma migration: HUMAN_AI enum + DevLink model + Issue AI fields',
      type: 'SUBTASK',
      priority: 'HIGH',
      status: 'DONE',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: taskExportEndpoints.id,
      aiEligible: true,
      aiExecutionStatus: 'DONE',
      aiAssigneeType: 'AGENT',
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 86 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint4.id,
      number: 86,
      title: 'Frontend: TimePage 3-way cards + IssueDetailPage source selector',
      type: 'SUBTASK',
      priority: 'MEDIUM',
      status: 'DONE',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: taskTimeAnalytics.id,
      aiEligible: true,
      aiExecutionStatus: 'DONE',
      aiAssigneeType: 'AGENT',
    },
  });

  const storyIntegrations = await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 87 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint4.id,
      number: 87,
      title: 'GitLab webhook + Telegram-бот (нотификации)',
      type: 'STORY',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: epicSprint4.id,
      aiEligible: true,
      aiAssigneeType: 'AGENT',
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 88 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint4.id,
      number: 88,
      title: 'GitLab webhook: автообновление статуса задачи при push/merge',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyIntegrations.id,
      aiEligible: true,
      aiAssigneeType: 'AGENT',
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 89 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint4.id,
      number: 89,
      title: 'Telegram-бот: уведомления о смене статуса и назначениях',
      type: 'TASK',
      priority: 'LOW',
      status: 'OPEN',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyIntegrations.id,
      aiEligible: true,
      aiAssigneeType: 'AGENT',
    },
  });

  await prisma.issue.upsert({
    where: { projectId_number: { projectId: mvpProject.id, number: 90 } },
    update: {},
    create: {
      projectId: mvpProject.id,
      sprintId: sprint4.id,
      number: 90,
      title: 'Seed: демо-данные Sprint 4, HUMAN_AI логи, DevLinks',
      type: 'TASK',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      creatorId: manager.id,
      assigneeId: dev.id,
      parentId: storyExportApi.id,
      aiEligible: true,
      aiExecutionStatus: 'IN_PROGRESS',
      aiAssigneeType: 'MIXED',
    },
  });

  // ================================================================
  // AI SESSIONS — retroactive data for ALL sprints (Cursor + Claude Code)
  // ================================================================
  // Pricing: Sonnet 4.6 $3/1M in, $15/1M out; Haiku 4.5 $0.80/1M in, $4/1M out;
  //          Opus 4.6 $15/1M in, $75/1M out
  // Per hour Cursor vibe-coding: ~120K input, ~40K output → ~$0.96/h (Sonnet)
  // ================================================================
  if (isFullDevSeed) {
    const existingAiSessions = await prisma.aiSession.count();
    if (existingAiSessions === 0) {
      const issueByNum = async (num: number) =>
        prisma.issue.findUniqueOrThrow({
          where: { projectId_number: { projectId: mvpProject.id, number: num } },
          select: { id: true },
        });

      // ── Sprint 1 (9 Mar): 5 Cursor sessions, ~16.5h AI side ──
      // Session 1: Backend scaffold (Express+TS+Prisma+middleware) — 3h
      const s1sess1 = await prisma.aiSession.create({
        data: {
          issueId: (await issueByNum(15)).id,
          userId: owner.id,
          model: 'claude-sonnet-4-6',
          provider: 'anthropic',
          startedAt: new Date('2026-03-09T09:00:00Z'),
          finishedAt: new Date('2026-03-09T12:00:00Z'),
          tokensInput: 350000,
          tokensOutput: 120000,
          costMoney: new Prisma.Decimal(2.85),
          notes: 'Cursor auto: Express+TS scaffold, Prisma 6 schema (User/Project/Issue/Comment/AuditLog), error handling, Zod DTOs',
        },
      });

      // Session 2: Auth+RBAC+Users modules — 3.25h
      const s1sess2 = await prisma.aiSession.create({
        data: {
          issueId: (await issueByNum(20)).id,
          userId: owner.id,
          model: 'claude-sonnet-4-6',
          provider: 'anthropic',
          startedAt: new Date('2026-03-09T12:30:00Z'),
          finishedAt: new Date('2026-03-09T15:45:00Z'),
          tokensInput: 400000,
          tokensOutput: 140000,
          costMoney: new Prisma.Decimal(3.30),
          notes: 'Cursor auto: auth API (register/login/refresh/logout/me), JWT+refresh, bcrypt, RBAC middleware, users CRUD',
        },
      });

      // Session 3: Projects+Issues modules (hierarchy) — 3.5h
      const s1sess3 = await prisma.aiSession.create({
        data: {
          issueId: (await issueByNum(31)).id,
          userId: owner.id,
          model: 'claude-sonnet-4-6',
          provider: 'anthropic',
          startedAt: new Date('2026-03-09T16:00:00Z'),
          finishedAt: new Date('2026-03-09T19:30:00Z'),
          tokensInput: 450000,
          tokensOutput: 160000,
          costMoney: new Prisma.Decimal(3.75),
          notes: 'Cursor auto: projects CRUD+keys, issues CRUD, EPIC→STORY→TASK→SUBTASK/BUG hierarchy, statuses, key generation',
        },
      });

      // Session 4: Frontend scaffold + all pages — 5h
      const s1sess4 = await prisma.aiSession.create({
        data: {
          issueId: (await issueByNum(38)).id,
          userId: owner.id,
          model: 'claude-sonnet-4-6',
          provider: 'anthropic',
          startedAt: new Date('2026-03-09T20:00:00Z'),
          finishedAt: new Date('2026-03-10T01:00:00Z'),
          tokensInput: 600000,
          tokensOutput: 200000,
          costMoney: new Prisma.Decimal(4.80),
          notes: 'Cursor auto: Vite+React+AntD+Zustand scaffold, Router, LoginPage, Dashboard, Projects list/detail, Issue form',
        },
      });

      // Session 5: Seed+Docker+Makefile — 1.75h (Haiku — simpler tasks)
      const s1sess5 = await prisma.aiSession.create({
        data: {
          issueId: (await issueByNum(48)).id,
          userId: owner.id,
          model: 'claude-haiku-4-5',
          provider: 'anthropic',
          startedAt: new Date('2026-03-10T01:15:00Z'),
          finishedAt: new Date('2026-03-10T03:00:00Z'),
          tokensInput: 200000,
          tokensOutput: 80000,
          costMoney: new Prisma.Decimal(0.48),
          notes: 'Cursor auto (Haiku): seed script, Docker Compose (PG16+Redis7), Makefile',
        },
      });

      // ── Sprint 2 (10 Mar): 3 Cursor sessions, ~13h AI side ──
      // Session 1: Board API + drag-n-drop UI — 4.25h
      const s2sess1 = await prisma.aiSession.create({
        data: {
          issueId: (await issueByNum(53)).id,
          userId: owner.id,
          model: 'claude-sonnet-4-6',
          provider: 'anthropic',
          startedAt: new Date('2026-03-10T09:00:00Z'),
          finishedAt: new Date('2026-03-10T13:15:00Z'),
          tokensInput: 500000,
          tokensOutput: 170000,
          costMoney: new Prisma.Decimal(4.05),
          notes: 'Cursor auto: Board API (columns, ordering), drag-n-drop, status/order persistence, BoardPage UI',
        },
      });

      // Session 2: Sprints + Time tracking — 5.25h
      const s2sess2 = await prisma.aiSession.create({
        data: {
          issueId: (await issueByNum(57)).id,
          userId: owner.id,
          model: 'claude-sonnet-4-6',
          provider: 'anthropic',
          startedAt: new Date('2026-03-10T13:45:00Z'),
          finishedAt: new Date('2026-03-10T19:00:00Z'),
          tokensInput: 650000,
          tokensOutput: 220000,
          costMoney: new Prisma.Decimal(5.25),
          notes: 'Cursor auto: sprints API (create/start/close), backlog↔sprint, ACTIVE constraint, timer API (start/stop), manual entry, My Time UI',
        },
      });

      // Session 3: Comments + IssueDetailPage — 3.5h
      const s2sess3 = await prisma.aiSession.create({
        data: {
          issueId: (await issueByNum(66)).id,
          userId: owner.id,
          model: 'claude-sonnet-4-6',
          provider: 'anthropic',
          startedAt: new Date('2026-03-10T19:30:00Z'),
          finishedAt: new Date('2026-03-10T23:00:00Z'),
          tokensInput: 420000,
          tokensOutput: 150000,
          costMoney: new Prisma.Decimal(3.51),
          notes: 'Cursor auto: comments CRUD API+UI, IssueDetailPage (fields, hierarchy, time, comments, history)',
        },
      });

      // ── Sprint 3 (11 Mar): 1 Cursor session, Sonnet, ~3h ──
      const s3sess1 = await prisma.aiSession.create({
        data: {
          issueId: (await issueByNum(73)).id,
          userId: owner.id,
          model: 'claude-sonnet-4-6',
          provider: 'anthropic',
          startedAt: new Date('2026-03-11T09:00:00Z'),
          finishedAt: new Date('2026-03-11T12:00:00Z'),
          tokensInput: 360000,
          tokensOutput: 130000,
          costMoney: new Prisma.Decimal(3.03),
          notes: 'Cursor auto: admin.service + admin.router (ADMIN only), AdminPage UI, teams module',
        },
      });

      // ── Sprint 3.5 (12 Mar): 2 Cursor sessions — ~5h total ──
      // Session 1: UAT + Playwright — Sonnet (2.5h)
      const s35sess1 = await prisma.aiSession.create({
        data: {
          issueId: (await issueByNum(76)).id,
          userId: owner.id,
          model: 'claude-sonnet-4-6',
          provider: 'anthropic',
          startedAt: new Date('2026-03-12T09:00:00Z'),
          finishedAt: new Date('2026-03-12T11:30:00Z'),
          tokensInput: 300000,
          tokensOutput: 110000,
          costMoney: new Prisma.Decimal(2.55),
          notes: 'Cursor auto: UAT test data + API, UatTestsPage, UatOnboardingOverlay, Playwright config + main-flows.spec.ts',
        },
      });

      // Session 2: UX polish — Haiku (simpler CSS/style work, 2.5h)
      const s35sess2 = await prisma.aiSession.create({
        data: {
          issueId: (await issueByNum(80)).id,
          userId: owner.id,
          model: 'claude-haiku-4-5',
          provider: 'anthropic',
          startedAt: new Date('2026-03-12T12:00:00Z'),
          finishedAt: new Date('2026-03-12T14:30:00Z'),
          tokensInput: 280000,
          tokensOutput: 100000,
          costMoney: new Prisma.Decimal(0.62),
          notes: 'Cursor auto (Haiku): Linear-like UI styles, CSS polish, layout refinements',
        },
      });

      // ── Sprint 4 (15 Mar): Cursor + Claude Code CLI ──
      // Cursor session: Export API vibe-coding — Sonnet (5h combined)
      const s4sess1 = await prisma.aiSession.create({
        data: {
          issueId: taskExportEndpoints.id,
          userId: owner.id,
          model: 'claude-sonnet-4-6',
          provider: 'anthropic',
          startedAt: new Date('2026-03-15T08:00:00Z'),
          finishedAt: new Date('2026-03-15T13:00:00Z'),
          tokensInput: 580000,
          tokensOutput: 195000,
          costMoney: new Prisma.Decimal(4.67),
          notes: 'Cursor auto: Export API architecture + implementation, 3-way analytics design, DTO code review',
        },
      });

      // Claude Code CLI autonomous session — Opus (35 min)
      const s4sess2 = await prisma.aiSession.create({
        data: {
          issueId: taskExportEndpoints.id,
          userId: owner.id,
          model: 'claude-opus-4-6',
          provider: 'anthropic',
          startedAt: new Date('2026-03-15T10:00:00Z'),
          finishedAt: new Date('2026-03-15T10:35:00Z'),
          tokensInput: 45000,
          tokensOutput: 18000,
          costMoney: new Prisma.Decimal(2.03),
          notes: 'Claude Code CLI: Prisma migration + export module scaffold + time module extension',
        },
      });

      // ── Summary log ──
      const allSessions = [
        s1sess1, s1sess2, s1sess3, s1sess4, s1sess5,
        s2sess1, s2sess2, s2sess3,
        s3sess1,
        s35sess1, s35sess2,
        s4sess1, s4sess2,
      ];
      const totalCost = allSessions.reduce((sum, s) => sum + Number(s.costMoney), 0);
      const totalTokens = allSessions.reduce((sum, s) => sum + s.tokensInput + s.tokensOutput, 0);
      console.log(`AI sessions seeded: ${allSessions.length} sessions, ${totalTokens.toLocaleString()} tokens, $${totalCost.toFixed(2)} total cost`);

      // ── AGENT TimeLog for Sprint 4 autonomous session ──
      await prisma.timeLog.create({
        data: {
          issueId: taskExportEndpoints.id,
          userId: null,
          hours: new Prisma.Decimal(0.58),
          note: 'AI: автономная реализация Export API module (schema + dto + service + router)',
          logDate: new Date('2026-03-15'),
          source: 'AGENT',
          agentSessionId: s4sess2.id,
          startedAt: s4sess2.startedAt,
          stoppedAt: s4sess2.finishedAt,
          costMoney: new Prisma.Decimal(2.03),
        },
      });
    }

    // === HUMAN_AI demo time logs for Sprint 4 (vibe-coding sessions) ===
    const existingSprint4TimeLogs = await prisma.timeLog.count({
      where: { issue: { projectId: mvpProject.id, number: { gte: 81 } } },
    });
    if (existingSprint4TimeLogs === 0) {
      await prisma.timeLog.createMany({
        data: [
          {
            issueId: taskExportEndpoints.id,
            userId: owner.id,
            hours: new Prisma.Decimal(3.25),
            note: 'Вайб-код: обсуждение архитектуры Export API + совместная реализация с Claude',
            logDate: new Date('2026-03-15'),
            source: 'HUMAN_AI',
          },
          {
            issueId: taskTimeAnalytics.id,
            userId: owner.id,
            hours: new Prisma.Decimal(1.75),
            note: 'Вайб-код: проектирование 3-way аналитики HUMAN/HUMAN_AI/AGENT с Claude',
            logDate: new Date('2026-03-15'),
            source: 'HUMAN_AI',
          },
          {
            issueId: taskExportEndpoints.id,
            userId: dev.id,
            hours: new Prisma.Decimal(2.0),
            note: 'Вайб-код: code review Export API + доработка DTOs с Cursor',
            logDate: new Date('2026-03-15'),
            source: 'HUMAN_AI',
          },
          {
            issueId: taskExportEndpoints.id,
            userId: manager.id,
            hours: new Prisma.Decimal(0.5),
            note: 'Ревью плана и приёмка API-спецификации',
            logDate: new Date('2026-03-15'),
            source: 'HUMAN',
          },
        ],
      });
    }

    // === DevLink data for all sprints (Cursor + Claude sessions) ===
    const existingDevLinks = await prisma.devLink.count();
    if (existingDevLinks === 0) {
      const REPO = 'https://github.com/jackrescuer-gif/tasktime-mvp';

      // Helper to resolve issue IDs
      const issueId = async (num: number) =>
        (await prisma.issue.findUniqueOrThrow({
          where: { projectId_number: { projectId: mvpProject.id, number: num } },
          select: { id: true },
        })).id;

      // Sprint 0 — Research & planning (Cursor)
      const id10 = await issueId(10); // Plan v2
      const id11 = await issueId(11); // REBUILD_PLAN_V2

      // Sprint 1 — Foundation (Cursor: claude/mvp-project-management-hdAvd)
      const id13 = await issueId(13); // EPIC Sprint 1
      const id15 = await issueId(15); // Init backend
      const id17 = await issueId(17); // Prisma schema
      const id20 = await issueId(20); // Auth API
      const id38 = await issueId(38); // Init frontend
      const id48 = await issueId(48); // Seed script

      // Sprint 2 — Boards (Cursor)
      const id51 = await issueId(51); // EPIC Sprint 2
      const id53 = await issueId(53); // Board API
      const id57 = await issueId(57); // Sprints API
      const id62 = await issueId(62); // Time API
      const id69 = await issueId(69); // Issue detail

      // Sprint 3 — Admin (Cursor)
      const id71 = await issueId(71); // EPIC Admin
      const id73 = await issueId(73); // Admin service

      // Sprint 3.5 — UAT/UX (Cursor)
      const id76 = await issueId(76); // UAT tests
      const id79 = await issueId(79); // Playwright
      const id80 = await issueId(80); // Linear UI

      await prisma.devLink.createMany({
        data: [
          // ── Sprint 0: docs (Cursor) ──
          {
            issueId: id10,
            type: 'COMMIT',
            url: `${REPO}/commit/3c1a2fe`,
            title: 'docs: add comprehensive rebuild plan v2',
            sha: '3c1a2fe',
          },
          {
            issueId: id11,
            type: 'COMMIT',
            url: `${REPO}/commit/9847e42`,
            title: 'docs: add CLAUDE.md memory + update plan with OS/browser requirements',
            sha: '9847e42',
          },

          // ── Sprint 1: Foundation (Cursor → claude/mvp-project-management-hdAvd) ──
          {
            issueId: id13,
            type: 'BRANCH',
            url: `${REPO}/tree/claude/mvp-project-management-hdAvd`,
            title: 'claude/mvp-project-management-hdAvd',
          },
          {
            issueId: id15,
            type: 'COMMIT',
            url: `${REPO}/commit/9131e07`,
            title: 'feat: Sprint 1 — complete rebuild with TypeScript stack',
            sha: '9131e07',
          },
          {
            issueId: id17,
            type: 'COMMIT',
            url: `${REPO}/commit/9131e07`,
            title: 'feat: Sprint 1 — complete rebuild with TypeScript stack',
            sha: '9131e07',
          },
          {
            issueId: id20,
            type: 'COMMIT',
            url: `${REPO}/commit/9131e07`,
            title: 'feat: Sprint 1 — complete rebuild with TypeScript stack',
            sha: '9131e07',
          },
          {
            issueId: id38,
            type: 'COMMIT',
            url: `${REPO}/commit/9131e07`,
            title: 'feat: Sprint 1 — complete rebuild with TypeScript stack',
            sha: '9131e07',
          },
          {
            issueId: id48,
            type: 'COMMIT',
            url: `${REPO}/commit/b0d77cb`,
            title: 'feat: add local dev environment tooling',
            sha: 'b0d77cb',
          },

          // ── Sprint 2: Board, Sprints, Time, Comments (Cursor) ──
          {
            issueId: id51,
            type: 'COMMIT',
            url: `${REPO}/commit/c96a0c3`,
            title: 'feat: Sprint 2 — Board, Sprints, Time tracking, Comments, Issue detail',
            sha: 'c96a0c3',
          },
          {
            issueId: id53,
            type: 'COMMIT',
            url: `${REPO}/commit/c96a0c3`,
            title: 'feat: Sprint 2 — Board, Sprints, Time tracking, Comments, Issue detail',
            sha: 'c96a0c3',
          },
          {
            issueId: id57,
            type: 'COMMIT',
            url: `${REPO}/commit/c96a0c3`,
            title: 'feat: Sprint 2 — Board, Sprints, Time tracking, Comments, Issue detail',
            sha: 'c96a0c3',
          },
          {
            issueId: id62,
            type: 'COMMIT',
            url: `${REPO}/commit/c96a0c3`,
            title: 'feat: Sprint 2 — Board, Sprints, Time tracking, Comments, Issue detail',
            sha: 'c96a0c3',
          },
          {
            issueId: id69,
            type: 'COMMIT',
            url: `${REPO}/commit/c96a0c3`,
            title: 'feat: Sprint 2 — Board, Sprints, Time tracking, Comments, Issue detail',
            sha: 'c96a0c3',
          },

          // ── Sprint 3: Admin + Teams (Cursor) ──
          {
            issueId: id71,
            type: 'COMMIT',
            url: `${REPO}/commit/39b1dd4`,
            title: 'feat: Sprint 3 — teams and admin modules',
            sha: '39b1dd4',
          },
          {
            issueId: id73,
            type: 'COMMIT',
            url: `${REPO}/commit/39b1dd4`,
            title: 'feat: Sprint 3 — teams and admin modules',
            sha: '39b1dd4',
          },

          // ── Sprint 3 release (Cursor) ──
          {
            issueId: id71,
            type: 'COMMIT',
            url: `${REPO}/commit/3f5056b`,
            title: 'release 0.1 — merge Sprint 3 and admin/teams',
            sha: '3f5056b',
          },

          // ── Sprint 3.5: UAT + UX polish (Cursor) ──
          {
            issueId: id76,
            type: 'COMMIT',
            url: `${REPO}/commit/2c3340e`,
            title: 'fix: stabilize CI types and UAT flows',
            sha: '2c3340e',
          },
          {
            issueId: id79,
            type: 'COMMIT',
            url: `${REPO}/commit/62ad6bd`,
            title: 'test: add backend e2e flows and stabilize admin reports',
            sha: '62ad6bd',
          },
          {
            issueId: id80,
            type: 'COMMIT',
            url: `${REPO}/commit/70e3ed2`,
            title: 'feat: add AI sessions and sprints polish',
            sha: '70e3ed2',
          },
          {
            issueId: id76,
            type: 'COMMIT',
            url: `${REPO}/commit/dd9738d`,
            title: 'release 0.2 — add production deploy flow and sprint UX polish',
            sha: 'dd9738d',
          },

          // ── Sprint 4: Export API (Claude Code CLI) ──
          {
            issueId: taskExportEndpoints.id,
            type: 'BRANCH',
            url: `${REPO}/tree/claude/export-open-tasks-Z3iJt`,
            title: 'claude/export-open-tasks-Z3iJt',
          },
          {
            issueId: taskExportEndpoints.id,
            type: 'COMMIT',
            url: `${REPO}/commit/36d64ed`,
            title: 'feat: add Export Open Tasks API + 3-way time analytics',
            sha: '36d64ed',
          },
          {
            issueId: taskTimeAnalytics.id,
            type: 'COMMIT',
            url: `${REPO}/commit/36d64ed`,
            title: 'feat: add Export Open Tasks API + 3-way time analytics',
            sha: '36d64ed',
          },
        ],
      });
    }
  }

  console.log('Seed complete.');
  console.log(`Users: ${admin.email}, ${manager.email}, ${dev.email}, ${viewer.email}, ${owner.email}`);
  if (isFullDevSeed) {
    console.log(`Password for all: ${defaultPassword}`);
    console.log(`Projects: ${project!.key}, ${backendProject!.key}, ${liveCodeProject!.key}, ${mvpProject.key}`);
  } else {
    console.log(`Projects: ${mvpProject.key}`);
  }
}

async function main() {
  await seedDatabase(prisma);
}

const isExecutedDirectly = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isExecutedDirectly) {
  main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
