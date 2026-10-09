import { expect, test } from '@playwright/test';
import { isolateAnalytics, expectNoHorizontalOverflow } from './helpers';

test('desktop navigation stays compact and visible while reading, including without JavaScript', async ({ page, browser }) => {
  await isolateAnalytics(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/guides/hospital-transport/');
  const header = page.locator('.site-header');
  for (const offset of [400, 1500]) {
    await page.evaluate(y => window.scrollTo(0, y), offset);
    await expect.poll(async () => (await header.boundingBox())?.y).toBe(0);
    expect((await header.boundingBox())?.height).toBeLessThanOrEqual(64);
    await expect(header.getByRole('link', { name: '記事一覧', exact: true })).toBeInViewport();
  }
  await page.goto('/guides/estimate-checklist/#variable');
  await expect.poll(async () => (await page.locator('#variable h2').boundingBox())?.y ?? 0).toBeGreaterThan(64);
  await expect(page.locator('#variable h2')).toBeInViewport();
  await expectNoHorizontalOverflow(page);

  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const fallback = await context.newPage();
  await fallback.goto('/guides/hospital-transport/');
  await fallback.mouse.wheel(0, 600);
  await expect.poll(() => fallback.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect.poll(async () => (await fallback.locator('.site-header').boundingBox())?.y).toBe(0);
  await context.close();
});

