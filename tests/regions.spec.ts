import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { isolateAnalytics } from './helpers';
const content = JSON.parse(readFileSync(new URL('../src/data/content.json', import.meta.url), 'utf8')) as { articles: { slug: string; faq: unknown[] }[] };

const regions = [
  ['saku', '佐久市'], ['ueda', '上田市'], ['komoro', '小諸市'], ['karuizawa', '軽井沢町'],
  ['miyota', '御代田町'], ['tateshina', '立科町'], ['annaka', '安中市'], ['tomioka', '富岡市'],
];

async function expectReferralBeforeNavigation(page: Page, hasFaq = false) {
  const note = page.locator('.article-body > .referral');
  await expect(note).toHaveCount(1);
  await expect(page.locator(`.article-body > ${hasFaq ? '.faq' : '.prose-section'} + .referral`)).toHaveCount(1);
  await expect(page.locator('.article-body > .referral + .related-articles')).toHaveCount(1);
  await expect(note.locator('[data-provider-link]')).toHaveAttribute('data-placement', 'article-end');
  const navigationOrderIsValid = await note.evaluate(element => {
    const siblings = Array.from(element.parentElement!.children);
    const index = siblings.indexOf(element);
    return !siblings.slice(0, index).some(node => node.classList.contains('related-articles'))
      && siblings.slice(index + 1).every(node => node.classList.contains('related-articles'));
  });
  expect(navigationOrderIsValid, 'the quiet referral must come before all related navigation').toBe(true);
}

test('all eight regional guides keep one quiet Tsubasa referral after the body and before navigation', async ({ page }) => {
  await isolateAnalytics(page);
  for (const [slug, name] of regions) {
    const response = await page.goto(`/regions/${slug}/`);
    expect(response?.status(), `${name} must have a published page`).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
    await expect(page.locator('#sources-heading, .sources')).toHaveCount(0);
    const officialLinks = page.locator('[data-provider-link]');
    await expect(officialLinks).toHaveCount(1);
    await expect(page.locator('.article-head [data-provider-link]')).toHaveCount(0);
    await expectReferralBeforeNavigation(page);
    expect(await page.locator('.article-head').textContent()).not.toContain('つばさ');
    expect(await page.locator('.prose-section').allTextContents()).not.toEqual(expect.arrayContaining([expect.stringContaining('つばさ')]));
    for (const href of await officialLinks.evaluateAll(links => links.map(link => (link as HTMLAnchorElement).href))) {
      expect(['so-gi.com', 'www.so-gi.com']).toContain(new URL(href).hostname);
    }
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://okurinochizu.jp/regions/${slug}/`);
  }
});

test('all article guides keep the referral after their body or FAQ and before navigation', async ({ page }) => {
  await isolateAnalytics(page);
  for (const article of content.articles) {
    const response = await page.goto(`/guides/${article.slug}/`);
    expect(response?.status(), `${article.slug} must have a published page`).toBe(200);
    await expect(page.locator('[data-provider-link]')).toHaveCount(1);
    await expect(page.locator('.article-head [data-provider-link]')).toHaveCount(0);
    await expectReferralBeforeNavigation(page, article.faq.length > 0);
  }
});

test('missing content serves an actual noindex 404 page', async ({ page }) => {
  const response = await page.goto('/missing-guide-that-does-not-exist/');
  expect(response?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
