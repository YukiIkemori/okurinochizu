import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { isolateAnalytics } from './helpers';
const content = JSON.parse(readFileSync(new URL('../src/data/content.json', import.meta.url), 'utf8')) as {
  articles: { slug: string; category: string; faq: unknown[]; inlineReferralAfter?: string; keyPoints?: string[] }[];
  regions: { slug: string; keyPoints?: string[] }[];
};

const regions = [
  ['saku', '佐久市'], ['ueda', '上田市'], ['komoro', '小諸市'], ['tomi', '東御市'], ['karuizawa', '軽井沢町'],
  ['miyota', '御代田町'], ['tateshina', '立科町'], ['sakuho', '佐久穂町'], ['koumi', '小海町'], ['nagawa', '長和町'], ['annaka', '安中市'], ['tomioka', '富岡市'],
];
const linkText = 'つばさ公益社のページを見る';

/** The end block: heading, one plain line, one link — after the body or FAQ and before related navigation. */
async function expectEndBlockBeforeNavigation(page: Page, hasFaq = false) {
  const block = page.locator('.article-body > section.referral-card');
  await expect(block).toHaveCount(1);
  await expect(block.getByRole('heading', { level: 2 })).toHaveText('葬儀の相談は、つばさ公益社へ');
  await expect(block.locator('a')).toHaveCount(1);
  await expect(block.locator('a')).toHaveText(linkText);
  await expect(block.locator('a')).toHaveAttribute('data-placement', 'article-end');
  await expect(block.locator('p:not(.referral-action)')).toHaveCount(1);
  await expect(page.locator(`.article-body > ${hasFaq ? '.faq' : '.prose-section'} + .referral-card`)).toHaveCount(1);
  // Only the collapsed source note may sit between the block and related navigation.
  await expect(page.locator('.article-body > .referral-card + .related-articles, .article-body > .referral-card + .source-note + .related-articles')).toHaveCount(1);
  const navigationOrderIsValid = await block.evaluate(element => {
    const siblings = Array.from(element.parentElement!.children);
    const index = siblings.indexOf(element);
    const after = siblings.slice(index + 1);
    if (after[0]?.classList.contains('source-note')) after.shift();
    return !siblings.slice(0, index).some(node => node.classList.contains('related-articles'))
      && after.length > 0 && after.every(node => node.classList.contains('related-articles'));
  });
  expect(navigationOrderIsValid, 'the consultation block must come before all related navigation').toBe(true);
}

/** The top row: one plain link directly after the summary box (or the lead), on region pages and urgent guides only. */
async function expectTopRow(page: Page, expected: boolean, hasKeyPoints: boolean) {
  const row = page.locator('.article-body > p.referral-top');
  await expect(row).toHaveCount(expected ? 1 : 0);
  if (!expected) return;
  await expect(page.locator(`.article-body > ${hasKeyPoints ? '.key-points' : 'p.article-lead'} + p.referral-top`)).toHaveCount(1);
  await expect(row.locator('a')).toHaveCount(1);
  await expect(row.locator('a')).toHaveText(linkText);
  await expect(row.locator('a')).toHaveAttribute('data-placement', 'article-top');
}

async function expectNoPhoneOrPushyElements(page: Page) {
  // The provider has no phone element, nothing sticky or floating, and no sponsored relation.
  await expect(page.locator('[data-provider-link][href^="tel:"], [data-placement="call"], [data-provider-link][rel~="sponsored"]')).toHaveCount(0);
  await expect(page.locator('.article-head [data-provider-link], .prose-section [data-provider-link], .key-points [data-provider-link], .quick-facts [data-provider-link], .site-header [data-provider-link], .site-footer [data-provider-link]')).toHaveCount(0);
  const floating = await page.locator('[data-provider-link]').evaluateAll(links => links.filter(link => {
    for (let node: Element | null = link; node && node !== document.body; node = node.parentElement) {
      if (['fixed', 'sticky'].includes(getComputedStyle(node).position)) return true;
    }
    return false;
  }).length);
  expect(floating, 'consultation links must scroll with the page').toBe(0);
}

test('all twelve regional guides show the top row and the end block, with no phone or floating element', async ({ page }) => {
  await isolateAnalytics(page);
  for (const [slug, name] of regions) {
    const response = await page.goto(`/regions/${slug}/`);
    expect(response?.status(), `${name} must have a published page`).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
    await expect(page.locator('#sources-heading, .sources')).toHaveCount(0);
    const officialLinks = page.locator('[data-provider-link]');
    await expect(officialLinks).toHaveCount(2);
    await expectTopRow(page, true, Boolean(content.regions.find(region => region.slug === slug)?.keyPoints?.length));
    await expectEndBlockBeforeNavigation(page);
    await expectNoPhoneOrPushyElements(page);
    expect(await page.locator('.article-head').textContent()).not.toContain('つばさ');
    expect(await page.locator('.prose-section, .key-points, .quick-facts, .toc').allTextContents()).not.toEqual(expect.arrayContaining([expect.stringContaining('つばさ')]));
    const hrefs = await officialLinks.evaluateAll(links => links.map(link => (link as HTMLAnchorElement).href));
    for (const href of hrefs) expect(['so-gi.com', 'www.so-gi.com']).toContain(new URL(href).hostname);
    // Both links lead to the same recorded destination; only the placement differs.
    expect(new Set(hrefs.map(href => new URL(href).origin + new URL(href).pathname)).size).toBe(1);
    expect(hrefs.map(href => new URL(href).searchParams.get('utm_content'))).toEqual([`${slug}-article-top`, `${slug}-article-end`]);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://okurinochizu.jp/regions/${slug}/`);
  }
});

test('all article guides keep the end block after their body or FAQ; only urgent guides add the top row', async ({ page }) => {
  await isolateAnalytics(page);
  expect(content.articles.filter(article => article.category === 'urgent').map(article => article.slug)).toEqual(expect.arrayContaining(['hospital-transport', 'home-death', 'first-day']));
  for (const article of content.articles) {
    const response = await page.goto(`/guides/${article.slug}/`);
    expect(response?.status(), `${article.slug} must have a published page`).toBe(200);
    const urgent = article.category === 'urgent';
    await expect(page.locator('[data-provider-link]'), article.slug).toHaveCount(1 + (urgent ? 1 : 0) + (article.inlineReferralAfter ? 1 : 0));
    if (article.inlineReferralAfter) {
      await expect(page.locator(`.article-body > #${article.inlineReferralAfter} + .referral-inline [data-provider-link]`)).toHaveAttribute('data-placement', 'in-article');
    }
    await expectTopRow(page, urgent, Boolean(article.keyPoints?.length));
    await expectEndBlockBeforeNavigation(page, article.faq.length > 0);
    await expectNoPhoneOrPushyElements(page);
  }
});

test('the home page ends with the same block and no other page links to the provider', async ({ page }) => {
  await isolateAnalytics(page);
  await page.goto('/');
  const block = page.locator('main .referral-card');
  await expect(page.locator('[data-provider-link]')).toHaveCount(1);
  await expect(block.getByRole('heading', { level: 2 })).toHaveText('葬儀の相談は、つばさ公益社へ');
  await expect(block.locator('a')).toHaveText(linkText);
  await expect(block.locator('a')).toHaveAttribute('data-placement', 'home-end');
  await expectNoPhoneOrPushyElements(page);
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  for (const path of ['/guides/', '/regions/', '/about/', '/privacy/', '/operator/', '/search/']) {
    await page.goto(path);
    await expect(page.locator('[data-provider-link]'), path).toHaveCount(0);
    await expect(page.locator('a[href^="tel:"]'), path).toHaveCount(0);
  }
});

test('missing content serves an actual noindex 404 page', async ({ page }) => {
  const response = await page.goto('/missing-guide-that-does-not-exist/');
  expect(response?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
