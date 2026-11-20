import { appendFileSync } from 'node:fs';
import { test as base, expect, type BrowserContext } from '@playwright/test';

/** Google Analytics and Google Tag Manager, on any subdomain. */
export const googleMeasurementHosts = /^https?:\/\/(?:[^/]+\.)?(?:google-analytics\.com|googletagmanager\.com)(?::\d+)?\//;
/** Marks the stand-in for the Google tag served by isolateAnalytics (tests/helpers.ts). */
export const mockHeader = 'x-okurinochizu-test-mock';

/** Abort every request to Google's measurement hosts in this context and return the attempted URLs.
 *  A page-level route (isolateAnalytics) takes precedence, so only requests from pages that did not
 *  ask to exercise analytics are recorded here. */
export async function blockGoogleMeasurement(context: BrowserContext) {
  const attempts: string[] = [];
  await context.route(googleMeasurementHosts, route => { attempts.push(route.request().url()); return route.abort(); });
  return attempts;
}

/** Every spec imports `test` from this file (playwright.config.ts refuses a spec that does not).
 *  The automatic fixture is the second line of defence behind the host check in
 *  src/scripts/analytics.ts: no test can let a request reach Google, and a test fails when
 *  - a page that did not call isolateAnalytics tries to contact Google at all, or
 *  - any request to Google is answered by something other than the test's own stand-in or an abort. */
export const test = base.extend<{ googleMeasurementGuard: void }>({
  googleMeasurementGuard: [async ({ context }, use, testInfo) => {
    const unisolated = await blockGoogleMeasurement(context);
    const escaped: string[] = [];
    const log = (outcome: string, url: string) => {
      if (process.env.GOOGLE_REQUEST_LOG) appendFileSync(process.env.GOOGLE_REQUEST_LOG, [testInfo.project.name, testInfo.titlePath.slice(1).join(' › '), outcome, url].join('\t') + '\n');
    };
    context.on('response', response => {
      if (!googleMeasurementHosts.test(response.url())) return;
      const mocked = response.headers()[mockHeader] === '1';
      log(mocked ? 'answered-by-test-stand-in' : 'REAL-RESPONSE', response.url());
      if (!mocked) escaped.push(response.url());
    });
    context.on('requestfailed', request => {
      if (!googleMeasurementHosts.test(request.url())) return;
      const reason = request.failure()?.errorText || '';
      // route.abort() reports net::ERR_FAILED; any other failure means the request left the browser.
      const aborted = reason === 'net::ERR_FAILED';
      log(aborted ? 'aborted-before-network' : 'LEFT-BROWSER ' + reason, request.url());
      if (!aborted) escaped.push(request.url());
    });
    await use();
    expect(unisolated, 'a page without isolateAnalytics must not try to contact Google').toEqual([]);
    expect(escaped, 'no request to Google may leave the browser').toEqual([]);
  }, { auto: true }],
});
export { expect };
