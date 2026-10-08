import { expect, test } from '@playwright/test';
import { consentKey, isolateAnalytics, layer, measurementId, preventExternalNavigation } from './helpers';

test('analytics requires explicit consent and preserves a refusal across visits', async ({ page }) => {
  const tags = await isolateAnalytics(page);
  await page.goto('/guides/family-funeral/');
  await expect(page.locator('#consent-banner')).toBeVisible();
  expect(tags).toEqual([]);
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
  await page.locator('[data-consent="denied"]').click();
  await expect(page.locator('#consent-banner')).toBeHidden();
  expect(await page.evaluate(key => localStorage.getItem(key), consentKey)).toBe('denied');
  const referral = '.referral [data-provider-link]';
  await preventExternalNavigation(page, referral);
  await page.locator(referral).click();
  expect((await layer(page)).filter(entry => entry[1] === 'provider_referral_click')).toHaveLength(0);
  await page.goto('/regions/saku/');
  await expect(page.locator('#consent-banner')).toBeHidden();
  expect(tags).toEqual([]);
  await page.getByRole('button', { name: 'アクセス解析の設定', exact: true }).click();
  await expect(page.locator('#consent-banner')).toBeVisible();
  await expect(page.locator('[data-consent="denied"]')).toBeFocused();
});

test('consent enables the supplied GA property and a meaningful provider referral event', async ({ page }) => {
  const tags = await isolateAnalytics(page);
  await page.goto('/guides/family-funeral/?family=private-test#reading');
  await page.locator('[data-consent="granted"]').click();
  await expect.poll(() => tags).toEqual([`https://www.googletagmanager.com/gtag/js?id=${measurementId}`]);
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
});

test('a regional end referral retains attribution, and revoking consent stops events', async ({ page }) => {
  await isolateAnalytics(page);
  await page.goto('/regions/saku/');
  await page.locator('[data-consent="granted"]').click();
  const referral = '.referral [data-provider-link][data-placement="article-end"]';
  await preventExternalNavigation(page, referral);
  await page.locator(referral).click();
  const events = (await layer(page)).filter(entry => entry[1] === 'provider_referral_click');
  expect(events).toHaveLength(1);
  expect(events[0][2]).toMatchObject({ content_slug: 'saku', region: 'saku', intent: 'regional-funeral', placement: 'article-end' });
  await page.getByRole('button', { name: 'アクセス解析の設定', exact: true }).click();
  await page.locator('[data-consent="denied"]').click();
  expect(await page.evaluate(id => (window as unknown as Record<string, unknown>)['ga-disable-' + id], measurementId)).toBe(true);
  await page.locator(referral).click();
  expect((await layer(page)).filter(entry => entry[1] === 'provider_referral_click')).toHaveLength(1);
  await page.reload();
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
});
