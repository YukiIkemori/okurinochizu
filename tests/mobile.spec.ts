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
  await page.getByRole('link', { name: '葬祭費・埋葬料はいくらもらえる？', exact: true }).click();
  await expect(page).toHaveURL('/guides/funeral-benefit/');
  await expectNoHorizontalOverflow(page);
  const table = page.getByRole('region', { name: '国保：8地域とも葬祭費は50,000円の表', exact: true });
  await expect(table).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(8);
  await expect(table.locator('thead th')).toHaveText(['故人が加入していた国保', '葬祭費', '申請・相談する窓口']);
  await expect(table.locator('tbody tr td:first-of-type')).toHaveText(Array(8).fill('50,000円'));
  await table.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => table.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await expect(table.locator('tbody tr').filter({ hasText: '御代田町の国保' }).getByRole('link')).toHaveAttribute('href', 'https://www.town.miyota.nagano.jp/category/kokumihoken/2179.html');
  await page.locator('#documents').getByRole('link', { name: '葬儀後の手続き', exact: true }).click();
  await expect(page).toHaveURL('/guides/death-procedures/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('死亡後の手続きは何から始める？');
  await page.goBack();
  await expect(page.locator('.faq')).toHaveCount(0);
  await page.locator('.region-directory').getByRole('link', { name: '安中市', exact: true }).click();
  await expect(page).toHaveURL('/regions/annaka/');
  await expectNoHorizontalOverflow(page);
  await page.locator('.related-articles .directory-heading').getByRole('link', { name: '記事一覧', exact: true }).click();
  await expect(page).toHaveURL('/guides/');
  await expect(page.locator('.article-list > li')).toHaveCount(24);
  await page.getByRole('link', { name: '墓じまいは何から始める？', exact: true }).click();
  const question = page.locator('.faq details').first();
  await question.locator('summary').click();
  await expect(question.locator('p')).toBeVisible();
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

test('mobile header follows reading direction and keeps menu and keyboard navigation usable', async ({ page }) => {
  await isolateAnalytics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/guides/hospital-transport/');
  const header = page.locator('.site-header');
  const top = async () => (await header.boundingBox())?.y ?? 0;
  const bottom = async () => {
    const box = await header.boundingBox();
    return box ? box.y + box.height : 1;
  };
  await expect.poll(top).toBe(0);
  expect((await header.boundingBox())?.height).toBeLessThanOrEqual(60);
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect.poll(bottom).toBeLessThanOrEqual(0);
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect.poll(top).toBe(0);

  const menu = page.locator('.mobile-menu');
  await menu.locator('summary').click();
  await expect(menu.getByRole('link', { name: '記事一覧', exact: true })).toBeInViewport();
  const nav = await menu.locator('nav').boundingBox();
  const box = await header.boundingBox();
  expect(nav!.y).toBeGreaterThanOrEqual(box!.y + box!.height - 1);
  await page.evaluate(() => window.scrollTo(0, 1000));
  await expect.poll(top).toBe(0);
  await expect(menu.getByRole('link', { name: '地域の案内', exact: true })).toBeInViewport();
  await menu.locator('summary').click();
  await page.evaluate(() => window.scrollTo(0, 1200));
  await expect.poll(bottom).toBeLessThanOrEqual(0);

  // Keyboard access reveals navigation that was hidden during touch scrolling.
  await page.keyboard.press('Shift+Tab');
  await expect.poll(top).toBe(0);
  await expect(header.locator('.brand')).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(menu.getByRole('link', { name: '記事一覧', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open', '');
  await expect(menu.locator('summary')).toBeFocused();

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(top).toBe(0);
  await expect(header.locator('.desktop-nav')).toBeVisible();
  await page.setViewportSize({ width: 320, height: 740 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(top).toBe(0);
  await expectNoHorizontalOverflow(page);
});
