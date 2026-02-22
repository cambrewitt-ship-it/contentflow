import fetch, { Headers, Response } from 'node-fetch';

type TestConfig = {
  baseUrl: string;
  unauthorizedProjectId: string;
  unauthorizedClientId: string;
  unauthorizedPostId: string;
  authToken: string;
  userId: string;
};

type TestResult = {
  name: string;
  passed: boolean;
  message?: string;
  error?: Error;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function resolveConfig(): TestConfig {
  const baseUrl = requireEnv('SECURITY_TEST_API_BASE_URL');
  const authToken = requireEnv('SECURITY_TEST_USER_TOKEN');
  const userId = requireEnv('SECURITY_TEST_USER_ID');
  const unauthorizedProjectId = requireEnv('SECURITY_TEST_FOREIGN_PROJECT_ID');
  const unauthorizedClientId = requireEnv('SECURITY_TEST_FOREIGN_CLIENT_ID');
  const unauthorizedPostId = requireEnv('SECURITY_TEST_FOREIGN_POST_ID');

  return {
    baseUrl,
    authToken,
    userId,
    unauthorizedProjectId,
    unauthorizedClientId,
    unauthorizedPostId,
  };
}

async function expectStatus(
  response: Response,
  expectedStatus: number,
  context: string
): Promise<void> {
  if (response.status !== expectedStatus) {
    const body = await response.text();
    throw new Error(
      `${context} expected status ${expectedStatus} but received ${response.status}.` +
        (body ? ` Response body: ${body}` : '')
    );
  }
}

async function testProjectAuth(config: TestConfig): Promise<void> {
  console.log("Testing: User cannot access other user's projects...");

  const url = `${config.baseUrl}/api/projects/${config.unauthorizedProjectId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.authToken}`,
      Accept: 'application/json',
    },
  });

  await expectStatus(response, 403, 'Project authorization');
}

async function testClientPostsAuth(config: TestConfig): Promise<void> {
  console.log("Testing: User cannot access other user's posts...");

  const url = `${config.baseUrl}/api/clients/${config.unauthorizedClientId}/posts`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.authToken}`,
      Accept: 'application/json',
    },
  });

  await expectStatus(response, 403, 'Client posts authorization');
}

async function buildCsrfHeaders(config: TestConfig): Promise<Headers> {
  const { generateCSRFToken } = await import('../lib/csrfProtection');
  const csrfToken = generateCSRFToken();
  const { origin } = new URL(config.baseUrl);
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${config.authToken}`);
  headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'application/json');
  headers.set('Origin', origin);
  headers.set('Referer', `${origin}/`);
  headers.set('x-csrf-token', csrfToken);
  headers.set('Cookie', `csrf-token=${csrfToken}`);
  return headers;
}

async function testPostEditAuth(config: TestConfig): Promise<void> {
  console.log("Testing: User cannot edit other user's posts...");

  const url = `${config.baseUrl}/api/posts-by-id/${config.unauthorizedPostId}`;
  const headers = await buildCsrfHeaders(config);
  const body = {
    caption: 'Unauthorized update attempt',
    edited_by_user_id: config.userId,
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });

  await expectStatus(response, 403, 'Post edit authorization');
}

async function testCalendarAuth(config: TestConfig): Promise<void> {
  console.log("Testing: User cannot access other user's calendar...");

  const searchParams = new URLSearchParams({
    clientId: config.unauthorizedClientId,
  });

  const url = `${config.baseUrl}/api/calendar/scheduled?${searchParams.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.authToken}`,
      Accept: 'application/json',
    },
  });

  await expectStatus(response, 403, 'Calendar authorization');
}

async function testCSRFProtection(): Promise<void> {
  console.log('Testing: CSRF secret is mandatory...');

  const originalSecret = process.env.CSRF_SECRET_KEY;
  delete process.env.CSRF_SECRET_KEY;

  try {
    await import(`../lib/csrfProtection?ts=${Date.now()}`);
    throw new Error('CSRF module did not throw when CSRF_SECRET_KEY was missing');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('CSRF_SECRET_KEY')) {
      throw error instanceof Error ? error : new Error(message);
    }
  } finally {
    if (originalSecret !== undefined) {
      process.env.CSRF_SECRET_KEY = originalSecret;
    }
  }
}

async function runTests(): Promise<void> {
  const results: TestResult[] = [];
  let config: TestConfig | undefined;

  try {
    config = resolveConfig();
  } catch (error) {
    console.error('Failed to load test configuration:', error);
    process.exitCode = 1;
    return;
  }

  const tests: Array<{ name: string; execute: (config: TestConfig) => Promise<void> }> = [
    { name: 'Project Authorization', execute: testProjectAuth },
    { name: 'Client Posts Authorization', execute: testClientPostsAuth },
    { name: 'Post Edit Authorization', execute: testPostEditAuth },
    { name: 'Calendar Authorization', execute: testCalendarAuth },
    {
      name: 'CSRF Protection',
      execute: async (config: TestConfig) => {
        void config;
        await testCSRFProtection();
      },
    },
  ];

  for (const test of tests) {
    try {
      if (test.name === 'CSRF Protection') {
        await test.execute(config);
      } else {
        await test.execute(config);
      }
      console.log(`✅ ${test.name} passed`);
      results.push({ name: test.name, passed: true });
    } catch (error) {
      console.error(`❌ ${test.name} failed`, error);
      results.push({
        name: test.name,
        passed: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  const failures = results.filter((result) => !result.passed);
  if (failures.length > 0) {
    console.error(`\n${failures.length} test(s) failed:`);
    for (const failure of failures) {
      console.error(`- ${failure.name}: ${failure.error?.message ?? 'Unknown error'}`);
    }
    process.exitCode = 1;
  } else {
    console.log('\nAll security verification tests passed ✅');
  }
}

runTests().catch((error) => {
  console.error('Security verification test run failed:', error);
  process.exitCode = 1;
});


