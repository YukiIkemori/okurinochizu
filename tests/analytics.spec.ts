import { expect, test } from './fixtures';
import { googleMeasurementHosts } from './fixtures';
import { consentKey, isolateAnalytics, layer, measurementId, mockGoogleTag, preventExternalNavigation, serveLocalBuildAs } from './helpers';

test('initial analytics uses the supplied property and measures an attributed provider click without private URL parameters', async ({ page }) => {
  const tags = await isolateAnalytics(page);
  await page.goto('/guides/family-funeral/?family=private-test#reading');
  await expect(page.locator('#consent-banner')).toHaveCount(0);
  await expect.poll(() => tags).toEqual(['https://www.googletagmanager.com/gtag/js?id=' + measurementId]);
  const config = (await layer(page)).find(entry => entry[0] === 'config');
  expect(config?.[1]).toBe(measurementId);
  expect(config?.[2]).toMatchObject({
    allow_google_signals: false, allow_ad_personalization_signals: false,
    page_location: 'http://127.0.0.1:4322/guides/family-funeral/',
  });
  const selector = '.referral [data-provider-link]';
  const destination = new URL(await page.locator(selector).getAttribute('href') || '');
  expect(destination.searchParams.get('utm_source')).toBe('okurinochizu');
  expect(destination.searchParams.get('utm_medium')).toBe('referral');
  await preventExternalNavigation(page, selector);
  await page.locator(selector).click();
  const events = (await layer(page)).filter(entry => entry[0] === 'event' && entry[1] === 'provider_referral_click');
  expect(events).toHaveLength(1);
  expect(events[0][2]).toMatchObject({
    provider: 'tsubasa', content_slug: 'family-funeral', region: 'all', intent: 'funeral', placement: 'article-end',
    destination_url: destination.origin + destination.pathname, transport_type: 'beacon',
  });
  await page.goto('/privacy/', { referer: page.url() });
  const nextConfig = (await layer(page)).find(entry => entry[0] === 'config');
  expect(nextConfig?.[2]).toMatchObject({ page_referrer: 'http://127.0.0.1:4322/guides/family-funeral/' });
});

test('stopping in privacy preserves the refusal, clears GA cookies and avoids tags and click events on later visits', async ({ page, context }) => {
  const tags = await isolateAnalytics(page);
  await page.goto('/privacy/');
  await expect(page.locator('#analytics-status')).toContainText('有効');
  await expect(page.getByRole('button', { name: 'アクセス解析を再開', exact: true })).toBeDisabled();
  await context.addCookies([{ name: '_ga', value: 'browser-test-only', url: 'http://127.0.0.1:4322/' }]);
  await page.getByRole('button', { name: 'アクセス解析を停止', exact: true }).click();
  await expect(page.locator('#analytics-status')).toContainText('停止');
  expect(await page.evaluate(key => localStorage.getItem(key), consentKey)).toBe('denied');
  expect(await page.evaluate(id => (window as unknown as Record<string, unknown>)['ga-disable-' + id], measurementId)).toBe(true);
  expect((await context.cookies()).filter(cookie => /^_ga(?:_|$)/.test(cookie.name))).toHaveLength(0);
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
  const tagsBeforeVisit = tags.length;
  await page.goto('/guides/family-funeral/');
  const selector = '.referral [data-provider-link]';
  await preventExternalNavigation(page, selector);
  await page.locator(selector).click();
  expect((await layer(page)).filter(entry => entry[1] === 'provider_referral_click')).toHaveLength(0);
  await page.reload();
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
  expect(tags).toHaveLength(tagsBeforeVisit);
  await page.goto('/privacy/');
  await expect(page.locator('#analytics-status')).toContainText('停止');
  await expect(page.getByRole('button', { name: 'アクセス解析を停止', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'アクセス解析を再開', exact: true }).click();
  await expect(page.locator('#analytics-status')).toContainText('有効');
  await expect.poll(() => tags.length).toBe(tagsBeforeVisit + 1);
  expect(await page.evaluate(key => localStorage.getItem(key), consentKey)).toBe('granted');
});

test('regional click attribution and stop/resume follow the privacy choice across open tabs', async ({ page, context }) => {
  await isolateAnalytics(page);
  await page.goto('/regions/saku/');
  const referral = '.referral [data-provider-link][data-placement="article-end"]';
  await preventExternalNavigation(page, referral);
  await page.locator(referral).click();
  let events = (await layer(page)).filter(entry => entry[1] === 'provider_referral_click');
  expect(events).toHaveLength(1);
  expect(events[0][2]).toMatchObject({ content_slug: 'saku', region: 'saku', intent: 'regional-funeral', placement: 'article-end' });
  const settings = await context.newPage();
  await isolateAnalytics(settings);
  await settings.goto('/privacy/');
  await settings.getByRole('button', { name: 'アクセス解析を停止', exact: true }).click();
  await expect.poll(() => page.evaluate(id => (window as unknown as Record<string, unknown>)['ga-disable-' + id], measurementId)).toBe(true);
  await page.locator(referral).click();
  expect((await layer(page)).filter(entry => entry[1] === 'provider_referral_click')).toHaveLength(1);
  await settings.getByRole('button', { name: 'アクセス解析を再開', exact: true }).click();
  await expect.poll(() => page.evaluate(id => (window as unknown as Record<string, unknown>)['ga-disable-' + id], measurementId)).toBe(false);
  await page.locator(referral).click();
  events = (await layer(page)).filter(entry => entry[1] === 'provider_referral_click');
  expect(events).toHaveLength(2);
  expect(events[1][2]).toMatchObject({ content_slug: 'saku', region: 'saku', placement: 'article-end' });
  await settings.close();
});

test('a host other than okurinochizu.jp starts no analytics: no tag, no data layer, no click event, no request to Google', async ({ page }) => {
  // No isolateAnalytics: this is a local preview, a CI browser run or any other visit to a test host.
  const requests: string[] = [];
  page.on('request', request => { if (googleMeasurementHosts.test(request.url())) requests.push(request.url()); });
  const state = () => page.evaluate(() => ({ dataLayer: typeof window.dataLayer, gtag: typeof window.gtag }));
  for (const path of ['/', '/regions/saku/', '/missing-guide-that-does-not-exist/']) {
    await page.goto(path);
    await expect(page.locator('script[data-analytics-tag], script[src*="googletagmanager.com"]'), path).toHaveCount(0);
    expect(await state(), path).toEqual({ dataLayer: 'undefined', gtag: 'undefined' });
  }
  await page.goto('/regions/saku/');
  for (const selector of ['.referral-top [data-provider-link]', '.referral-card [data-provider-link]']) {
    await preventExternalNavigation(page, selector);
    await page.locator(selector).click();
  }
  expect(await state()).toEqual({ dataLayer: 'undefined', gtag: 'undefined' });
  // The privacy controls still store the choice, but resuming starts nothing on this host.
  await page.goto('/privacy/');
  await page.getByRole('button', { name: 'アクセス解析を停止', exact: true }).click();
  await expect(page.locator('#analytics-status')).toContainText('停止');
  expect(await page.evaluate(key => localStorage.getItem(key), consentKey)).toBe('denied');
  await page.getByRole('button', { name: 'アクセス解析を再開', exact: true }).click();
  await expect(page.locator('#analytics-status')).toContainText('有効');
  await expect(page.locator('script[data-analytics-tag], script[src*="googletagmanager.com"]')).toHaveCount(0);
  expect(await state()).toEqual({ dataLayer: 'undefined', gtag: 'undefined' });
  expect(requests).toEqual([]);
});

test('the test flag is ignored on the Firebase default hosts, and okurinochizu.jp needs no flag', async ({ page, baseURL }) => {
  const tags = await isolateAnalytics(page);
  for (const origin of ['http://okurinochizu.web.app', 'http://okurinochizu.firebaseapp.com', 'http://www.okurinochizu.jp', 'http://okurinochizu.jp.example.com']) {
    await serveLocalBuildAs(page, origin, baseURL!);
    await page.goto(origin + '/guides/family-funeral/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => ({ flag: window.__okurinochizuAnalyticsTest, dataLayer: typeof window.dataLayer })), origin).toEqual({ flag: true, dataLayer: 'undefined' });
    await expect(page.locator('script[data-analytics-tag]'), origin).toHaveCount(0);
  }
  expect(tags).toEqual([]);
});

test('on the production hostname analytics starts by itself and measures a provider click', async ({ page, baseURL }) => {
  // The local build is served as okurinochizu.jp inside the browser; the Google tag is a stand-in
  // and no test flag is set, so this is the code path a real visitor runs.
  const tags = await mockGoogleTag(page);
  await serveLocalBuildAs(page, 'http://okurinochizu.jp', baseURL!);
  await page.goto('http://okurinochizu.jp/regions/saku/?private=value');
  expect(await page.evaluate(() => window.__okurinochizuAnalyticsTest)).toBeUndefined();
  await expect.poll(() => tags).toEqual(['https://www.googletagmanager.com/gtag/js?id=' + measurementId]);
  const config = (await layer(page)).find(entry => entry[0] === 'config');
  expect(config?.[1]).toBe(measurementId);
  expect(config?.[2]).toMatchObject({ send_page_view: true, page_location: 'http://okurinochizu.jp/regions/saku/' });
  const selector = '.referral-top [data-provider-link]';
  await preventExternalNavigation(page, selector);
  await page.locator(selector).click();
  const events = (await layer(page)).filter(entry => entry[0] === 'event' && entry[1] === 'provider_referral_click');
  expect(events).toHaveLength(1);
  expect(events[0][2]).toMatchObject({ provider: 'tsubasa', content_slug: 'saku', region: 'saku', intent: 'regional-funeral', placement: 'article-top' });
});
