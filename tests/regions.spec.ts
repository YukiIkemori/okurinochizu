import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { readFileSync } from 'node:fs';
import { isolateAnalytics } from './helpers';
const content = JSON.parse(readFileSync(new URL('../src/data/content.json', import.meta.url), 'utf8')) as {
  articles: { slug: string; category: string; faq: unknown[]; inlineReferralAfter?: string; keyPoints?: string[] }[];
  regions: { slug: string; keyPoints?: string[]; inlineReferralAfter?: string; referral: { href: string; topLabel?: string } }[];
};

const regions = [
  ['saku', '佐久市'], ['ueda', '上田市'], ['komoro', '小諸市'], ['tomi', '東御市'], ['karuizawa', '軽井沢町'],
  ['miyota', '御代田町'], ['tateshina', '立科町'], ['sakuho', '佐久穂町'], ['koumi', '小海町'], ['nagawa', '長和町'], ['aoki', '青木村'], ['annaka', '安中市'], ['tomioka', '富岡市'],
];
const linkText = 'つばさ公益社のページを見る';
// The top row of a region page names what its destination shows (README「相談先の表示」).
// 「◯◯の式場」: the provider's regional page lists a hall inside the municipality; 「◯◯周辺の式場」: only
// halls in neighbouring municipalities; 安中市 leads to the page of one hall in 富岡市.
const topLabels: Record<string, string> = {
  saku: '佐久市の式場と費用を見る（つばさ公益社）', ueda: '上田市の式場と費用を見る（つばさ公益社）',
  komoro: '小諸市の式場と費用を見る（つばさ公益社）', tomi: '東御市の式場と費用を見る（つばさ公益社）',
  karuizawa: '軽井沢町周辺の式場と費用を見る（つばさ公益社）', miyota: '御代田町周辺の式場と費用を見る（つばさ公益社）',
  tateshina: '立科町周辺の式場と費用を見る（つばさ公益社）', sakuho: '佐久穂町周辺の式場と費用を見る（つばさ公益社）',
  koumi: '小海町周辺の式場と費用を見る（つばさ公益社）', nagawa: '長和町周辺の式場と費用を見る（つばさ公益社）',
  aoki: '青木村周辺の式場と費用を見る（つばさ公益社）',
  annaka: 'つばさホール富岡の案内を見る（つばさ公益社）', tomioka: '富岡市の式場と費用を見る（つばさ公益社）',
};
// Region pages with the one-sentence in-article note, and the section it follows.
const inlineNotes: Record<string, string> = { saku: 'family-funeral', ueda: 'family-funeral', tomioka: 'family-funeral' };

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
async function expectTopRow(page: Page, expected: boolean, hasKeyPoints: boolean, text = linkText) {
  const row = page.locator('.article-body > p.referral-top');
  await expect(row).toHaveCount(expected ? 1 : 0);
  if (!expected) return;
  await expect(page.locator(`.article-body > ${hasKeyPoints ? '.key-points' : 'p.article-lead'} + p.referral-top`)).toHaveCount(1);
  await expect(row.locator('a')).toHaveCount(1);
  await expect(row.locator('a')).toHaveText(text);
  await expect(row).toHaveText('葬儀の相談先' + text);
  await expect(row.locator('a')).toHaveAttribute('data-placement', 'article-top');
  await expect(row.locator('img, svg, button')).toHaveCount(0);
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

test('all thirteen regional guides show the top row with a concrete label, the end block and at most one in-article note, with no phone or floating element', async ({ page }) => {
  await isolateAnalytics(page);
  expect(Object.fromEntries(content.regions.map(region => [region.slug, region.referral.topLabel]))).toEqual(topLabels);
  expect(Object.fromEntries(content.regions.filter(region => region.inlineReferralAfter).map(region => [region.slug, region.inlineReferralAfter]))).toEqual(inlineNotes);
  for (const [slug, name] of regions) {
    const response = await page.goto(`/regions/${slug}/`);
    expect(response?.status(), `${name} must have a published page`).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
    await expect(page.locator('#sources-heading, .sources')).toHaveCount(0);
    const officialLinks = page.locator('[data-provider-link]');
    const noteAfter = inlineNotes[slug];
    await expect(officialLinks).toHaveCount(noteAfter ? 3 : 2);
    await expectTopRow(page, true, Boolean(content.regions.find(region => region.slug === slug)?.keyPoints?.length), topLabels[slug]);
    // The note is the same quiet sentence as on guides, directly after the venue section.
    const note = page.locator('.referral-inline');
    await expect(note).toHaveCount(noteAfter ? 1 : 0);
    if (noteAfter) {
      await expect(page.locator(`.article-body > #${noteAfter} + p.referral-inline`)).toHaveText('葬儀についての相談は、つばさ公益社へ。');
      await expect(page.locator(`#${noteAfter} h2`)).toContainText('家族葬');
      await expect(note.locator('a')).toHaveCount(1);
      await expect(note.locator('a')).toHaveText('つばさ公益社');
      await expect(note.locator('a')).toHaveAttribute('data-placement', 'in-article');
    }
    await expectEndBlockBeforeNavigation(page);
    await expectNoPhoneOrPushyElements(page);
    expect(await page.locator('.article-head').textContent()).not.toContain('つばさ');
    expect(await page.locator('.prose-section, .key-points, .quick-facts, .toc').allTextContents()).not.toEqual(expect.arrayContaining([expect.stringContaining('つばさ')]));
    const hrefs = await officialLinks.evaluateAll(links => links.map(link => (link as HTMLAnchorElement).href));
    for (const href of hrefs) expect(['so-gi.com', 'www.so-gi.com']).toContain(new URL(href).hostname);
    // Every link leads to the same recorded destination; only the placement differs.
    expect([...new Set(hrefs.map(href => new URL(href).origin + new URL(href).pathname))]).toEqual([content.regions.find(region => region.slug === slug)!.referral.href]);
    expect(hrefs.map(href => new URL(href).searchParams.get('utm_content'))).toEqual([`${slug}-article-top`, ...(noteAfter ? [`${slug}-in-article`] : []), `${slug}-article-end`]);
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
