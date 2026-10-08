import { expect, test } from '@playwright/test';
import { isolateAnalytics } from './helpers';

const regions = [
  ['saku', '佐久市'], ['ueda', '上田市'], ['komoro', '小諸市'], ['karuizawa', '軽井沢町'],
  ['miyota', '御代田町'], ['tateshina', '立科町'], ['annaka', '安中市'], ['tomioka', '富岡市'],
];

test('all eight regional guides offer official sources and a Tsubasa destination', async ({ page }) => {
  await isolateAnalytics(page);
  for (const [slug, name] of regions) {
    const response = await page.goto(`/regions/${slug}/`);
    expect(response?.status(), `${name} must have a published page`).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
    await expect(page.locator('#sources-heading')).toBeVisible();
    const officialLinks = page.locator('[data-provider-link]');
    expect(await officialLinks.count()).toBeGreaterThan(0);
    for (const href of await officialLinks.evaluateAll(links => links.map(link => (link as HTMLAnchorElement).href))) {
      expect(['so-gi.com', 'www.so-gi.com']).toContain(new URL(href).hostname);
    }
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://okurinochizu.jp/regions/${slug}/`);
  }
});

test('missing content serves an actual noindex 404 page', async ({ page }) => {
  const response = await page.goto('/missing-guide-that-does-not-exist/');
  expect(response?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
