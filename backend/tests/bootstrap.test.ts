import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

import { comparePassword } from '../src/shared/utils/password.js';
import * as bootstrapModule from '../src/prisma/bootstrap.js';

const { BOOTSTRAP_USERS, bootstrapDefaultUsers } = bootstrapModule;

const prisma = new PrismaClient();
const testsDir = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(testsDir, '../package.json');
const seedScriptPath = path.resolve(testsDir, '../src/prisma/seed.ts');

async function clearDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.timeLog.deleteMany();
  await prisma.aiSession.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.sprint.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.project.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

beforeEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('bootstrapDefaultUsers', () => {
  it('creates the default users idempotently', async () => {
    await bootstrapDefaultUsers(prisma, 'password123');
    await bootstrapDefaultUsers(prisma, 'password123');

    const [users, projectCount, sprintCount, issueCount] = await Promise.all([
      prisma.user.findMany({
        orderBy: { email: 'asc' },
        select: {
          email: true,
          role: true,
          isActive: true,
          passwordHash: true,
        },
      }),
      prisma.project.count(),
      prisma.sprint.count(),
      prisma.issue.count(),
    ]);

    expect(users).toHaveLength(BOOTSTRAP_USERS.length);
    expect(users.map((user) => user.email)).toEqual(
      [...BOOTSTRAP_USERS].map((user) => user.email).sort(),
    );
    expect(users.every((user) => user.isActive)).toBe(true);
    expect(await comparePassword('password123', users[0]!.passwordHash)).toBe(true);
    expect(projectCount).toBe(0);
    expect(sprintCount).toBe(0);
    expect(issueCount).toBe(0);
  });

  it('makes bootstrap and seed responsibilities explicit', async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const seedScriptSource = await readFile(seedScriptPath, 'utf8');

    expect(bootstrapModule).not.toHaveProperty('BOOTSTRAP_RESPONSIBILITY');
    expect(packageJson.scripts?.['db:seed']).toBe('npm run db:seed:dev');
    expect(packageJson.scripts?.['db:seed:dev']).toBe('tsx src/prisma/seed.ts');
    expect(packageJson.scripts?.['db:sync:prod-to-dev']).toBeTruthy();
    expect(seedScriptSource).toContain('development/demo data');
    expect(seedScriptSource).toContain('not the production source of truth');
  });
});
