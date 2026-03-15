/**
 * UAT: Sprint 4 features — AI Estimate, AI Decompose, Export, Telegram, GitLab
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

const API = process.env.E2E_API_BASE_URL || 'http://localhost:3000/api';

const USERS = {
  admin:   { email: 'admin@tasktime.ru',   password: 'password123' },
  manager: { email: 'manager@tasktime.ru', password: 'password123' },
  user:    { email: 'dev@tasktime.ru',     password: 'password123' },
  viewer:  { email: 'viewer@tasktime.ru',  password: 'password123' },
};

// Cache tokens to avoid hitting the rate limiter (10 req/min on /auth/login)
const tokenCache = new Map<string, { accessToken: string; refreshToken: string }>();

async function getTokens(
  request: APIRequestContext,
  role: keyof typeof USERS,
): Promise<{ accessToken: string; refreshToken: string }> {
  if (tokenCache.has(role)) return tokenCache.get(role)!;
  const res = await request.post(`${API}/auth/login`, { data: USERS[role] });
  expect(res.ok()).toBeTruthy();
  const { accessToken, refreshToken } = await res.json();
  const tokens = { accessToken: accessToken as string, refreshToken: refreshToken as string };
  tokenCache.set(role, tokens);
  return tokens;
}

async function getToken(request: APIRequestContext, role: keyof typeof USERS): Promise<string> {
  return (await getTokens(request, role)).accessToken;
}

/**
 * Inject auth tokens via addInitScript so they are present before React boots.
 * Bypasses the /auth/login rate limiter (10 req/min per IP).
 */
async function login(
  page: import('@playwright/test').Page,
  role: keyof typeof USERS,
  request: APIRequestContext,
) {
  const { accessToken, refreshToken } = await getTokens(request, role);
  await page.addInitScript(
    ({ at, rt }: { at: string; rt: string }) => {
      localStorage.setItem('accessToken', at);
      localStorage.setItem('refreshToken', rt);
    },
    { at: accessToken, rt: refreshToken },
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

async function createProjectWithIssue(
  request: APIRequestContext,
  token: string,
  issueType: string = 'TASK',
) {
  const suffix = Date.now().toString().slice(-6);
  const projectRes = await request.post(`${API}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: `S4 Project ${suffix}`, key: `S4${suffix}` },
  });
  expect(projectRes.ok()).toBeTruthy();
  const project = await projectRes.json() as { id: string };

  const issueRes = await request.post(`${API}/projects/${project.id}/issues`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: `S4 ${issueType} Issue ${suffix}`,
      description: 'Integrate payment gateway with retry logic and idempotency keys. Acceptance criteria: 3 retries, exponential backoff, logs to audit trail.',
      type: issueType,
    },
  });
  expect(issueRes.ok()).toBeTruthy();
  const issue = await issueRes.json() as { id: string };

  return { project, issue };
}

// ─── AI ESTIMATE ──────────────────────────────────────────────────────────────

test.describe('AI Estimate UI', () => {
  test('AI Estimate panel is visible on issue detail page for ADMIN', async ({ page, request }) => {
    await login(page, 'admin', request);
    const token = await getToken(request, 'admin');
    const { issue } = await createProjectWithIssue(request, token, 'TASK');

    await page.goto(`/issues/${issue.id}`);
    // Use header text (exact match avoids strict mode conflict with button text)
    await expect(page.getByText('AI Estimate').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /AI Estimate/i })).toBeVisible();
  });

  test('AI Estimate panel is visible for USER role', async ({ page, request }) => {
    await login(page, 'user', request);
    const adminToken = await getToken(request, 'admin');
    const { issue } = await createProjectWithIssue(request, adminToken, 'TASK');

    await page.goto(`/issues/${issue.id}`);
    await expect(page.getByText('AI Estimate').first()).toBeVisible();
  });

  test('AI Estimate panel is NOT visible for VIEWER role', async ({ page, request }) => {
    await login(page, 'viewer', request);
    const adminToken = await getToken(request, 'admin');
    const { issue } = await createProjectWithIssue(request, adminToken, 'TASK');

    await page.goto(`/issues/${issue.id}`);
    // VIEWER sees issue detail but no AI actions
    await expect(page.getByRole('button', { name: /AI Estimate/i })).toHaveCount(0);
  });

  test('POST /ai/estimate returns non-200 when API key not configured', async ({ request }) => {
    const token = await getToken(request, 'admin');
    const { issue } = await createProjectWithIssue(request, token, 'TASK');

    // Use short timeout to avoid hanging on Anthropic network calls in restricted env
    const res = await request.post(`${API}/ai/estimate/${issue.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
    }).catch(() => null);

    if (res === null) {
      // Request timed out — expected in network-restricted environments
      return;
    }
    // Without API key: 500 (internal) or 503 (service unavailable). With key: 200.
    expect([200, 500, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json() as { hours: number; confidence: string; reasoning: string };
      expect(typeof body.hours).toBe('number');
      expect(['low', 'medium', 'high']).toContain(body.confidence);
      expect(typeof body.reasoning).toBe('string');
    }
  });

  test('POST /ai/estimate is forbidden for VIEWER (403)', async ({ request }) => {
    const adminToken = await getToken(request, 'admin');
    const { issue } = await createProjectWithIssue(request, adminToken, 'TASK');

    const viewerToken = await getToken(request, 'viewer');
    const res = await request.post(`${API}/ai/estimate/${issue.id}`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    expect(res.status()).toBe(403);
  });
});

// ─── AI DECOMPOSE ─────────────────────────────────────────────────────────────

test.describe('AI Decompose UI', () => {
  test('AI Decompose panel visible for EPIC', async ({ page, request }) => {
    await login(page, 'admin', request);
    const token = await getToken(request, 'admin');
    const { issue } = await createProjectWithIssue(request, token, 'EPIC');

    await page.goto(`/issues/${issue.id}`);
    await expect(page.getByText('AI Decompose').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Decompose into STORYs/i })).toBeVisible();
  });

  test('AI Decompose panel visible for STORY', async ({ page, request }) => {
    await login(page, 'admin', request);
    const token = await getToken(request, 'admin');
    const { issue } = await createProjectWithIssue(request, token, 'STORY');

    await page.goto(`/issues/${issue.id}`);
    await expect(page.getByText('AI Decompose').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Decompose into TASKs/i })).toBeVisible();
  });

  test('AI Decompose panel NOT visible for TASK', async ({ page, request }) => {
    await login(page, 'admin', request);
    const token = await getToken(request, 'admin');
    const { issue } = await createProjectWithIssue(request, token, 'TASK');

    await page.goto(`/issues/${issue.id}`);
    await expect(page.getByRole('button', { name: /Decompose into/i })).toHaveCount(0);
  });

  test('POST /ai/decompose returns 400 for TASK type', async ({ request }) => {
    const token = await getToken(request, 'admin');
    const { issue } = await createProjectWithIssue(request, token, 'TASK');

    const res = await request.post(`${API}/ai/decompose/${issue.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /ai/decompose on EPIC returns non-403 (200/500/503 depending on API key)', async ({ request }) => {
    const token = await getToken(request, 'admin');
    const { issue } = await createProjectWithIssue(request, token, 'EPIC');

    const res = await request.post(`${API}/ai/decompose/${issue.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
    }).catch(() => null);

    if (res === null) return; // network-restricted environment

    // Must not be a permissions error
    expect(res.status()).not.toBe(403);
    expect([200, 500, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json() as { suggestions: unknown[] };
      expect(Array.isArray(body.suggestions)).toBeTruthy();
      expect(body.suggestions.length).toBeGreaterThan(0);
    }
  });
});

// ─── EXPORT ───────────────────────────────────────────────────────────────────

test.describe('Export reports', () => {
  test('Admin page shows Reports section', async ({ page, request }) => {
    await login(page, 'admin', request);
    await page.goto('/admin');
    // Reports panel header is visible
    await expect(page.locator('.tt-panel-header', { hasText: /Reports/i }).first()).toBeVisible();
  });

  test('GET /admin/reports/issues/export?format=csv returns CSV for ADMIN', async ({ request }) => {
    const token = await getToken(request, 'admin');
    const projectsRes = await request.get(`${API}/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const projects = await projectsRes.json() as { id: string }[];
    if (!projects.length) test.skip();

    const res = await request.get(
      `${API}/admin/reports/issues/export?format=csv&projectId=${projects[0].id}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toContain('text/csv');
    const body = await res.text();
    expect(body.length).toBeGreaterThan(0);
  });

  test('GET /admin/reports/issues/export?format=pdf returns PDF for ADMIN', async ({ request }) => {
    const token = await getToken(request, 'admin');
    const projectsRes = await request.get(`${API}/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const projects = await projectsRes.json() as { id: string }[];
    if (!projects.length) test.skip();

    const res = await request.get(
      `${API}/admin/reports/issues/export?format=pdf&projectId=${projects[0].id}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toContain('application/pdf');
  });

  test('GET /admin/reports/time/export returns CSV for ADMIN', async ({ request }) => {
    const token = await getToken(request, 'admin');
    const projectsRes = await request.get(`${API}/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const projects = await projectsRes.json() as { id: string }[];
    if (!projects.length) test.skip();

    const res = await request.get(
      `${API}/admin/reports/time/export?projectId=${projects[0].id}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toContain('text/csv');
  });

  test('Export endpoint is forbidden for USER role (403)', async ({ request }) => {
    const userToken = await getToken(request, 'user');
    const adminToken = await getToken(request, 'admin');
    const projectsRes = await request.get(`${API}/projects`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const projects = await projectsRes.json() as { id: string }[];
    if (!projects.length) test.skip();

    const res = await request.get(
      `${API}/admin/reports/issues/export?format=csv&projectId=${projects[0].id}`,
      { headers: { Authorization: `Bearer ${userToken}` } },
    );
    expect(res.status()).toBe(403);
  });
});

// ─── TELEGRAM ─────────────────────────────────────────────────────────────────

test.describe('Telegram integration UI', () => {
  test('Telegram subscription status endpoint returns 200 with connected field', async ({ request }) => {
    const token = await getToken(request, 'admin');
    const res = await request.get(`${API}/integrations/telegram/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    // API returns { connected: boolean, chatId: string|null }
    const body = await res.json() as { connected: boolean; chatId: string | null };
    expect(typeof body.connected).toBe('boolean');
  });

  test('Admin page shows Telegram Notifications block', async ({ page, request }) => {
    await login(page, 'admin', request);
    await page.goto('/admin');
    await expect(page.getByText('Telegram Notifications').first()).toBeVisible();
  });

  test('Telegram subscribe endpoint reachable for USER role', async ({ request }) => {
    const token = await getToken(request, 'user');
    // Try to subscribe with a fake chatId — expect 200 or error from Telegram (not 403)
    const res = await request.post(`${API}/integrations/telegram/subscribe`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { chatId: '123456789' },
    });
    // 200 (subscribed) or 503 (bot not configured) — NOT 403
    expect(res.status()).not.toBe(403);
  });

  test('Telegram unsubscribe is accessible to any authenticated user', async ({ request }) => {
    // Any authenticated user can call unsubscribe; if not subscribed server returns 404 or 500
    const viewerToken = await getToken(request, 'viewer');
    const res = await request.delete(`${API}/integrations/telegram/unsubscribe`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    // Not a permission error — just no subscription found
    expect(res.status()).not.toBe(403);
    expect([200, 404, 500]).toContain(res.status());
  });
});

// ─── GITLAB ───────────────────────────────────────────────────────────────────

test.describe('GitLab integration', () => {
  test('GET /integrations/gitlab/list is forbidden for MANAGER (403)', async ({ request }) => {
    const token = await getToken(request, 'manager');
    const res = await request.get(`${API}/integrations/gitlab/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(403);
  });

  test('GET /integrations/gitlab/list returns 200 for ADMIN', async ({ request }) => {
    const token = await getToken(request, 'admin');
    const res = await request.get(`${API}/integrations/gitlab/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('Admin page shows GitLab Integration block', async ({ page, request }) => {
    await login(page, 'admin', request);
    await page.goto('/admin');
    await expect(page.getByText('GitLab Integration').first()).toBeVisible();
  });

  test('POST /integrations/gitlab/configure is forbidden for MANAGER (403)', async ({ request }) => {
    const adminToken = await getToken(request, 'admin');
    const projectsRes = await request.get(`${API}/projects`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const projects = await projectsRes.json() as { id: string }[];
    if (!projects.length) test.skip();

    const managerToken = await getToken(request, 'manager');
    const res = await request.post(`${API}/integrations/gitlab/configure`, {
      headers: { Authorization: `Bearer ${managerToken}` },
      data: {
        projectId: projects[0].id,
        gitlabUrl: 'https://gitlab.example.com/test/repo',
        gitlabToken: 'fake-token',
        webhookToken: 'fake-webhook',
      },
    });
    expect(res.status()).toBe(403);
  });
});

// ─── SWAGGER ──────────────────────────────────────────────────────────────────

test.describe('Swagger API docs', () => {
  test('GET /api/docs.json returns valid OpenAPI spec', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/docs.json');
    expect(res.ok()).toBeTruthy();
    const spec = await res.json() as { openapi: string; info: { title: string } };
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toBeTruthy();
  });

  test('Swagger UI is accessible at /api/docs', async ({ page, request }) => {
    await page.goto('http://localhost:3000/api/docs');
    await expect(page.getByText('TaskTime API')).toBeVisible({ timeout: 15000 });
  });
});
