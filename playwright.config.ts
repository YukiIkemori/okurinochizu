import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { fingerprintDist } from './scripts/lib/build-fingerprint.mjs';

export default defineConfig({
  testDir: './tests',
  metadata: { buildFingerprint: await fingerprintDist() },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 6_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: '.local/playwright-report.json' }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4322',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      args: ['--no-sandbox'],
    },
  },
  projects: [
    { name: 'desktop', testIgnore: '**/mobile.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', testMatch: '**/mobile.spec.ts', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'ASTRO_TELEMETRY_DISABLED=1 npx astro preview --host 127.0.0.1 --port 4322 --ignore-lock',
    url: 'http://127.0.0.1:4322/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
