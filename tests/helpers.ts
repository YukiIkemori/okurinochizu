import { expect, type Page } from '@playwright/test';

export const measurementId = 'G-YH2YL4ZMCH';
export const consentKey = 'okurinochizu.analytics.v1';

/** Keep browser checks from sending visitor information to Google. */
export async function isolateAnalytics(page: Page) {
  const tagRequests: string[] = [];
  await page.route('https://www.googletagmanager.com/**', async route => {
    tagRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* Google tag intentionally mocked in browser verification. */' });
  });
  await page.route(/https:\/\/(?:[^/]+\.)?google-analytics\.com\//, route => route.abort());
  return tagRequests;
}

export async function layer(page: Page) {
  return page.evaluate(() => (window.dataLayer || []).map(entry => Array.from(entry as ArrayLike<unknown>)));
}

export async function preventExternalNavigation(page: Page, selector: string) {
  await page.locator(selector).first().evaluate(element => element.addEventListener('click', event => event.preventDefault()));
}

export async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.scrollWidth, document: document.documentElement.scrollWidth }));
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1);
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
}
