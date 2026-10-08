import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { isolateAnalytics } from './helpers';

for (const path of ['/', '/guides/hospital-transport/', '/regions/annaka/', '/search/', '/privacy/']) {
  test(`keyboard and WCAG A/AA access on ${path}`, async ({ page }) => {
    await isolateAnalytics(page);
    await page.goto(path);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: '本文へ移動', exact: true })).toBeFocused();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
