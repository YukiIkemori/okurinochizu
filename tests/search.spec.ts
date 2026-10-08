import { expect, test } from '@playwright/test';
import { isolateAnalytics } from './helpers';

test.beforeEach(async ({ page }) => { await isolateAnalytics(page); });

test('search discovers all articles and restores keyword and regional filters from the URL', async ({ page }) => {
  await page.goto('/search/');
  await expect(page.locator('#search-count')).toHaveText('32件の記事・地域案内');
  await expect(page.locator('[data-search-entry]:visible')).toHaveCount(32);
  await page.getByLabel('キーワード', { exact: true }).fill('樹木葬');
  await page.getByLabel('地域', { exact: true }).selectOption('miyota');
  await page.getByRole('button', { name: '記事を探す', exact: true }).click();
  await expect(page).toHaveURL(/q=.*&region=miyota/);
  await expect(page.locator('#search-empty')).toBeHidden();
  await expect(page.locator('#search-results a[href="/guides/local-tree-burial/"]')).toBeVisible();
  await expect(page.locator('#search-results a[href="/regions/miyota/"]')).toBeVisible();
  const filteredCount = await page.locator('[data-search-entry]:visible').count();
  expect(filteredCount).toBeGreaterThan(0);
  expect(filteredCount).toBeLessThan(32);
  await page.reload();
  await expect(page.getByLabel('キーワード', { exact: true })).toHaveValue('樹木葬');
  await expect(page.getByLabel('地域', { exact: true })).toHaveValue('miyota');
  await expect(page.locator('[data-search-entry]:visible')).toHaveCount(filteredCount);
});

test('theme filtering and an empty result provide useful recovery', async ({ page }) => {
  await page.goto('/search/?region=annaka&topic=region');
  await expect(page.locator('[data-search-entry]:visible')).toHaveCount(1);
  await expect(page.locator('#search-results a[href="/regions/annaka/"]')).toBeVisible();
  await page.getByLabel('キーワード', { exact: true }).fill('該当しない検索語xyz987');
  await page.getByRole('button', { name: '記事を探す', exact: true }).click();
  await expect(page.locator('#search-count')).toHaveText('0件の記事・地域案内');
  await expect(page.locator('#search-empty')).toBeVisible();
  await expect(page.locator('#search-empty a')).toHaveAttribute('href', '/guides/');
});

test('unknown filter values cannot hide the article collection', async ({ page }) => {
  await page.goto('/search/?region=unknown&topic=unknown');
  await expect(page.getByLabel('地域', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('テーマ', { exact: true })).toHaveValue('');
  await expect(page.locator('[data-search-entry]:visible')).toHaveCount(32);
});
