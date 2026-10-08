import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, isolateAnalytics } from './helpers';

test('small-screen navigation, consent, reading and table layouts remain usable', async ({ page }) => {
  await isolateAnalytics(page);
  await page.goto('/');
  await expectNoHorizontalOverflow(page);
  await expect(page.locator('#consent-banner')).toBeVisible();
  await page.locator('[data-consent="denied"]').click();
  const menu = page.locator('.mobile-menu');
  await expect(menu).toBeVisible();
  await menu.locator('summary').click();
  await expect(menu.locator('nav')).toBeVisible();
  await menu.getByRole('link', { name: '記事を探す', exact: true }).click();
  await expect(page).toHaveURL('/search/');
  await expect(page.getByLabel('キーワード', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.goto('/guides/funeral-benefit/');
  await expectNoHorizontalOverflow(page);
  const toc = page.locator('.toc-mobile');
  await expect(toc).toBeVisible();
  await toc.locator('summary').click();
  await expect(toc.locator('ol')).toBeVisible();
  await toc.locator('a').first().click();
  expect(new URL(page.url()).hash.length).toBeGreaterThan(1);
  await page.goto('/regions/annaka/');
  await expectNoHorizontalOverflow(page);
});

test('a 320-pixel viewport provides accessible controls without horizontal page overflow', async ({ page }) => {
  await isolateAnalytics(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/search/');
  await expectNoHorizontalOverflow(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});
