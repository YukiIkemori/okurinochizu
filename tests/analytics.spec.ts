import { expect, test } from '@playwright/test';
import { consentKey, isolateAnalytics, layer, measurementId, preventExternalNavigation } from './helpers';

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
