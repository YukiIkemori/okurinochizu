import { expect, type Page } from '@playwright/test';
import { googleMeasurementHosts, mockHeader } from './fixtures';

export const measurementId = 'G-YH2YL4ZMCH';
export const consentKey = 'okurinochizu.analytics.v1';

/** Answer the Google tag with an empty stand-in and abort every other request to Google.
 *  Returns the tag URLs the page asked for. */
export async function mockGoogleTag(page: Page) {
  const tagRequests: string[] = [];
  await page.route(googleMeasurementHosts, route => route.abort());
  // Registered last, so it is matched first for the tag itself.
  await page.route(/^https:\/\/www\.googletagmanager\.com\/gtag\/js\?/, async route => {
    tagRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'application/javascript', headers: { [mockHeader]: '1' }, body: '/* Google tag intentionally mocked in browser verification. */' });
  });
  return tagRequests;
}

/** Exercise the analytics code on the test host without sending anything to Google.
 *  The site starts analytics on okurinochizu.jp only; this sets the test-only flag that
 *  src/scripts/analytics.ts accepts on a loopback host, and mocks the Google tag as above.
 *  A page that does not call this starts no analytics at all, and tests/fixtures.ts aborts
 *  requests to Google for every test regardless. */
export async function isolateAnalytics(page: Page) {
  await page.addInitScript(() => { window.__okurinochizuAnalyticsTest = true; });
  return mockGoogleTag(page);
}

/** Serve the local build under another origin, to check how the pages behave on that hostname.
 *  Every request to the origin is answered from the local preview; nothing reaches the real host. */
export async function serveLocalBuildAs(page: Page, origin: string, baseURL: string) {
  await page.route(origin + '/**', async route => {
    const url = new URL(route.request().url());
    await route.fulfill({ response: await route.fetch({ url: baseURL + url.pathname + url.search }) });
  });
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
