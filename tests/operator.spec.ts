import { expect, test } from './fixtures';
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

test('every footer links to the operator, about and privacy pages as plain text links', async ({ page }) => {
  await isolateAnalytics(page);
  for (const path of ['/', '/guides/', '/regions/', '/guides/hospital-transport/', '/regions/saku/', '/about/', '/operator/', '/privacy/', '/search/', '/missing-guide-that-does-not-exist/']) {
    await page.goto(path);
    const footer = page.locator('.site-footer');
    await expect(footer.locator('.footer-operator h2 a'), path).toHaveText('運営者情報');
    const links = footer.locator('nav.footer-nav a');
    await expect(links, path).toHaveText(['このメディアについて', 'プライバシー']);
    expect(await links.evaluateAll(all => all.map(link => link.getAttribute('href'))), path).toEqual(['/about/', '/privacy/']);
    // The same quiet typographic style as the operator link: text only, no icon, pill or button.
    await expect(footer.locator('img, svg, button, [data-provider-link]'), path).toHaveCount(0);
    const styles = await links.evaluateAll(all => all.map(link => { const style = getComputedStyle(link); return { radius: style.borderRadius, background: style.backgroundColor, border: style.borderTopWidth, shadow: style.boxShadow, height: link.getBoundingClientRect().height }; }));
    for (const style of styles) {
      expect(style, path).toMatchObject({ radius: '0px', background: 'rgba(0, 0, 0, 0)', border: '0px', shadow: 'none' });
      expect(style.height, path).toBeGreaterThanOrEqual(44);
    }
    await expect(footer.locator('[aria-current="page"]'), path).toHaveCount(['/about/', '/operator/', '/privacy/'].includes(path) ? 1 : 0);
  }
  // Both pages are reachable from any page, here from a region page.
  await page.goto('/regions/saku/');
  await page.locator('.site-footer').getByRole('link', { name: 'このメディアについて', exact: true }).click();
  await expect(page).toHaveURL('/about/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('このメディアについて');
  await page.locator('.site-footer').getByRole('link', { name: 'プライバシー', exact: true }).click();
  await expect(page).toHaveURL('/privacy/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('プライバシー');
});
