import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, isolateAnalytics } from './helpers';

test('small-screen navigation, reading and table layouts remain usable', async ({ page }) => {
  await isolateAnalytics(page);
  await page.goto('/');
  await expectNoHorizontalOverflow(page);
  const menu = page.locator('.mobile-menu');
  await expect(menu).toBeVisible();
  await menu.locator('summary').click();
  await expect(menu.locator('nav')).toBeVisible();
  await menu.getByRole('link', { name: '記事一覧', exact: true }).click();
  await expect(page).toHaveURL('/guides/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('記事一覧');
  await page.getByRole('link', { name: '葬祭費と埋葬料', exact: true }).click();
  await expect(page).toHaveURL('/guides/funeral-benefit/');
  await expectNoHorizontalOverflow(page);
  const table = page.getByRole('region', { name: '自治体ごとの国保の葬祭費の比較表', exact: true });
  await expect(table).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(6);
  const question = page.locator('.faq details').first();
  await question.locator('summary').click();
  await expect(question.locator('p')).toBeVisible();
  await page.locator('.region-directory').getByRole('link', { name: '安中市', exact: true }).click();
  await expect(page).toHaveURL('/regions/annaka/');
  await expectNoHorizontalOverflow(page);
  await page.locator('.related-articles .directory-heading').getByRole('link', { name: '記事一覧', exact: true }).click();
  await expect(page).toHaveURL('/guides/');
  await expect(page.locator('.article-list > li')).toHaveCount(24);
});

test('a 320-pixel viewport provides accessible controls without horizontal page overflow', async ({ page }) => {
  await isolateAnalytics(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/search/');
  await expectNoHorizontalOverflow(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});
