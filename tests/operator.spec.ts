import { expect, test } from '@playwright/test';
import { isolateAnalytics } from './helpers';

test('operator page shows the company, editorial policy and relationship, and every footer links to it', async ({ page }) => {
  await isolateAnalytics(page);
  const response = await page.goto('/operator/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('運営者情報');
  await expect(page.locator('main')).toContainText('おくりの地図は、株式会社tsamが運営しています。');
  await expect(page.getByRole('heading', { level: 2, name: '編集の方針' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '紹介している葬儀社との関係' })).toBeVisible();
  await expect(page.locator('#relationship')).toHaveText('当社代表の池森は、株式会社つばさ公益社に出資しています。');
  await expect(page.locator('main a[href="/guides/choose-funeral-company/"]')).toHaveText('葬儀社の選び方');
  await expect(page.locator('main [data-provider-link]')).toHaveCount(0);
  const organizations = (await page.locator('script[type="application/ld+json"]').allTextContents())
    .flatMap(text => [JSON.parse(text)].flat())
    .filter(item => item['@type'] === 'Organization');
  expect(organizations).toHaveLength(1);
  expect(organizations[0].founder).toMatchObject({ '@type': 'Person', name: '池森 裕毅', jobTitle: '代表取締役' });
  for (const path of ['/', '/guides/hospital-transport/', '/regions/saku/', '/privacy/']) {
    await page.goto(path);
    await expect(page.locator('.site-footer a[href="/operator/"]')).toHaveText('運営者情報');
    await expect(page.locator('#relationship')).toHaveCount(0);
  }
});
