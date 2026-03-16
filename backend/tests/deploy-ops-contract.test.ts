import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');

const syncScriptPath = path.resolve(repoRoot, 'deploy/scripts/sync-prod-to-dev.sh');
const deployScriptPath = path.resolve(repoRoot, 'deploy/scripts/deploy.sh');
const deployDocsPath = path.resolve(repoRoot, 'docs/DEPLOY.md');

async function withFakeNpm(
  run: (helpers: {
    logPath: string;
    makeEnvFile: (fileName: string, contents: string) => Promise<string>;
    readLogLines: () => Promise<string[]>;
    runSyncScript: (envFilePath: string, args?: string[]) => ReturnType<typeof spawnSync>;
  }) => Promise<void>,
) {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'tasktime-sync-test-'));
  const fakeNpmPath = path.join(tempDir, 'npm');
  const logPath = path.join(tempDir, 'npm.log');

  await writeFile(
    fakeNpmPath,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$FAKE_NPM_LOG"
`,
    'utf8',
  );
  await chmod(fakeNpmPath, 0o755);

  const makeEnvFile = async (fileName: string, contents: string) => {
    const envFilePath = path.join(tempDir, fileName);
    await writeFile(envFilePath, contents, 'utf8');
    return envFilePath;
  };

  const readLogLines = async () => {
    try {
      const log = await readFile(logPath, 'utf8');
      return log.split('\n').filter(Boolean);
    } catch {
      return [];
    }
  };

  const runSyncScript = (envFilePath: string, args: string[] = []) =>
    spawnSync(syncScriptPath, [envFilePath, ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${tempDir}:${process.env.PATH ?? ''}`,
        FAKE_NPM_LOG: logPath,
      },
    });

  try {
    await run({
      logPath,
      makeEnvFile,
      readLogLines,
      runSyncScript,
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function makeBackendEnvFile(overrides: Partial<Record<string, string>> = {}) {
  const values = {
    SOURCE_DATABASE_URL:
      'postgresql://readonly-user:secret@prod-db.internal:5432/tasktime?schema=public',
    DATABASE_URL: 'postgresql://tasktime:secret@dev-db.internal:5432/tasktime_dev?schema=public',
    NODE_ENV: 'development',
    ...overrides,
  };

  return `${Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`;
}

function makeQuotedBackendEnvFile(overrides: Partial<Record<string, string>> = {}) {
  const values = {
    SOURCE_DATABASE_URL:
      'postgresql://readonly-user:secret@prod-db.internal:5432/tasktime?schema=public&application_name=prod-sync',
    DATABASE_URL:
      'postgresql://tasktime:secret@dev-db.internal:5432/tasktime_dev?schema=public&application_name=dev-sync',
    NODE_ENV: 'development',
    ...overrides,
  };

  return `${Object.entries(values)
    .map(([key, value]) => `${key}='${value}'`)
    .join('\n')}\n`;
}

function getOutput(result: ReturnType<typeof spawnSync>) {
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

describe('deploy and prod-sync contract', () => {
  it('keeps deploy guidance pointed at a non-production sync target', async () => {
    const deployScript = await readFile(deployScriptPath, 'utf8');
    const deployDocs = await readFile(deployDocsPath, 'utf8');

    expect(deployScript).not.toContain('db:sync:prod-to-dev');
    expect(deployScript).not.toContain('backend.production.env --confirm-import');
    expect(deployScript).toContain('deploy/env/backend.staging.env --confirm-import');
    expect(deployDocs).toContain('./deploy/scripts/sync-prod-to-dev.sh deploy/env/backend.staging.env');
  });

  it('documents bootstrap, deploy, prod-to-dev sync, and rollback as separate concerns', async () => {
    const deployDocs = await readFile(deployDocsPath, 'utf8');

    expect(deployDocs).toContain('## Server Bootstrap');
    expect(deployDocs).toContain('## Deploy');
    expect(deployDocs).toContain('## Prod-to-Dev Sync');
    expect(deployDocs).toContain('## Rollback');
    expect(deployDocs).toContain('separate operation');
    expect(deployDocs).toContain('--confirm-import');
  });

  it('rejects obvious production target env files before invoking npm', async () => {
    await withFakeNpm(async ({ makeEnvFile, readLogLines, runSyncScript }) => {
      const envFilePath = await makeEnvFile('backend.production.env', makeBackendEnvFile());

      const result = runSyncScript(envFilePath);

      expect(result.status).toBe(1);
      expect(getOutput(result)).toContain('Refusing to run prod-to-dev sync against a production target env file');
      expect(await readLogLines()).toEqual([]);
    });
  });

  it('requires a prior dry-run review before confirm import', async () => {
    await withFakeNpm(async ({ makeEnvFile, readLogLines, runSyncScript }) => {
      const envFilePath = await makeEnvFile('backend.staging.env', makeBackendEnvFile());

      const result = runSyncScript(envFilePath, ['--confirm-import']);

      expect(result.status).toBe(1);
      expect(getOutput(result)).toContain('Run the dry-run first in a separate invocation and review the plan before confirming');
      expect(await readLogLines()).toEqual([]);
    });
  });

  it('runs dry-run and import in separate invocations', async () => {
    await withFakeNpm(async ({ makeEnvFile, readLogLines, runSyncScript }) => {
      const envFilePath = await makeEnvFile('backend.staging.env', makeBackendEnvFile());

      const dryRunResult = runSyncScript(envFilePath);
      expect(dryRunResult.status).toBe(0);
      expect(getOutput(dryRunResult)).toContain('Review the dry-run output, then re-run the command with --confirm-import');
      expect(await readLogLines()).toEqual(['run db:sync:prod-to-dev -- --dry-run']);

      const confirmResult = runSyncScript(envFilePath, ['--confirm-import']);
      expect(confirmResult.status).toBe(0);
      expect(await readLogLines()).toEqual([
        'run db:sync:prod-to-dev -- --dry-run',
        'run db:sync:prod-to-dev',
      ]);
    });
  });

  it('re-checks source and target safety before the real import', async () => {
    await withFakeNpm(async ({ makeEnvFile, readLogLines, runSyncScript }) => {
      const envFilePath = await makeEnvFile('backend.staging.env', makeBackendEnvFile());

      const dryRunResult = runSyncScript(envFilePath);
      expect(dryRunResult.status).toBe(0);
      expect(await readLogLines()).toEqual(['run db:sync:prod-to-dev -- --dry-run']);

      await writeFile(
        envFilePath,
        makeBackendEnvFile({
          SOURCE_DATABASE_URL:
            'postgresql://readonly-user:secret@same-host.internal:5432/tasktime?schema=public',
          DATABASE_URL:
            'postgresql://tasktime:secret@same-host.internal:5433/tasktime_dev?schema=public',
        }),
        'utf8',
      );

      const confirmResult = runSyncScript(envFilePath, ['--confirm-import']);

      expect(confirmResult.status).toBe(1);
      expect(getOutput(confirmResult)).toContain(
        'SOURCE_DATABASE_URL and DATABASE_URL must not point to the same database host',
      );
      expect(await readLogLines()).toEqual(['run db:sync:prod-to-dev -- --dry-run']);
    });
  });

  it('persists approval data safely for quoted URLs with shell-significant characters', async () => {
    await withFakeNpm(async ({ makeEnvFile, readLogLines, runSyncScript }) => {
      const envFilePath = await makeEnvFile(
        'backend.staging.env',
        makeQuotedBackendEnvFile(),
      );

      const dryRunResult = runSyncScript(envFilePath);
      expect(dryRunResult.status).toBe(0);
      expect(await readLogLines()).toEqual(['run db:sync:prod-to-dev -- --dry-run']);

      const confirmResult = runSyncScript(envFilePath, ['--confirm-import']);
      expect(confirmResult.status).toBe(0);
      expect(await readLogLines()).toEqual([
        'run db:sync:prod-to-dev -- --dry-run',
        'run db:sync:prod-to-dev',
      ]);
    });
  });
});
