import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';
import groups from './groups.json';

dotenv.config();
const artifacts = process.env.ARTIFACT_DIR || path.resolve('test-results');
const millis = (key: string, fallback: number) => Number(process.env[key] || fallback);

const slowMo = Number(process.env.PW_SLOW_MO) || 0;

const rateLimitBypassToken = process.env.RATE_LIMIT_BYPASS_TOKEN;
const extraHTTPHeaders = rateLimitBypassToken
  ? { 'rate-limit-bypass-token': rateLimitBypassToken }
  : undefined;

export default defineConfig({
  testDir: './tests',
  testMatch: process.env.OBP_E2E_GROUP && process.env.OBP_E2E_GROUP in groups
    ? groups[process.env.OBP_E2E_GROUP as keyof typeof groups].paths.map(p => '**/' + p + (p.endsWith('/') ? '**/*.spec.ts' : ''))
    : undefined,
  globalSetup: './src/config/global-setup.ts',
  outputDir: path.join(artifacts, 'playwright-output'),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: path.join(artifacts, 'playwright-html'), open: 'never' }],
    ['json', { outputFile: path.join(artifacts, 'playwright-results.json') }],
    ['list'],
  ],
  timeout: millis('PW_TEST_TIMEOUT_MS', 120_000),
  expect: { timeout: millis('PW_EXPECT_TIMEOUT_MS', 15_000) },
  use: {
    navigationTimeout: millis('PW_NAVIGATION_TIMEOUT_MS', 30_000),
    actionTimeout: millis('PW_ACTION_TIMEOUT_MS', 15_000),
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    launchOptions: { slowMo },
    extraHTTPHeaders,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
