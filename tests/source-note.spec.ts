import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { isolateAnalytics } from './helpers';

type Source = { id: string; title: string; url: string; checkedAt: string };
type Item = { slug: string; sources: string[] };
const read = (file: string) => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const content = read('../src/data/content.json') as { articles: Item[]; regions: Item[] };
const registry = new Map((read('../src/data/sources.json') as Source[]).map(source => [source.id, source]));
// The referred company's pages and competing introduction sites are never listed (README).
const unlisted = ['so-gi.com', 'e-sogi.com', 'mitsuwa-sougi.co.jp', 'soogi.jp', 'ansinsougi.jp', 'e-ohaka.com', 'lifedot.jp', 'osohshiki.jp'];
const listed = (item: Item) => item.sources.map(id => registry.get(id)!).filter(source => {
  const { hostname } = new URL(source.url);
  return !unlisted.some(host => hostname === host || hostname.endsWith('.' + host));
});
const japaneseDate = (date: string) => { const [y, m, d] = date.split('-').map(Number); return `${y}年${m}月${d}日`; };
const summaryFor = (sources: Source[]) => `出典と確認日（${sources.length}件・最終確認 ${japaneseDate(sources.map(s => s.checkedAt).sort().at(-1)!)}）`;
const pages = [
  ...content.articles.map(item => ({ path: `/guides/${item.slug}/`, sources: listed(item) })),
  ...content.regions.map(item => ({ path: `/regions/${item.slug}/`, sources: listed(item) })),
];

test('every article and region with recorded sources has one closed source note after the referral', async ({ page }) => {
  await isolateAnalytics(page);
  for (const { path, sources } of pages) {
    await page.goto(path);
    const note = page.locator('.source-note');
    await expect(note, path).toHaveCount(sources.length ? 1 : 0);
    if (!sources.length) continue;
    await expect(page.locator('.article-body > .referral + details.source-note'), path).toHaveCount(1);
    await expect(note, path).not.toHaveAttribute('open');
    await expect(note.locator('summary'), path).toHaveText(summaryFor(sources));
    await expect(note.locator('ul'), path).toBeHidden();
  }
});

test('the source note opens on click and lists links to the recorded sources with their check dates', async ({ page }) => {
  await isolateAnalytics(page);
  const region = pages.find(({ path }) => path === '/regions/annaka/')!;
  await page.goto(region.path);
  const note = page.locator('.source-note');
  await expect(note).not.toHaveAttribute('open');
  await note.locator('summary').click();
  await expect(note).toHaveAttribute('open', '');
  const items = note.locator('li');
  await expect(items).toHaveCount(region.sources.length);
  for (const [index, source] of region.sources.entries()) {
    const link = items.nth(index).getByRole('link', { name: source.title, exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', source.url);
    await expect(items.nth(index).locator('.source-note-date')).toHaveText(`確認日 ${japaneseDate(source.checkedAt)}`);
  }
  const results = await new AxeBuilder({ page }).include('.source-note').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test('the source note summary is reachable and operable from the keyboard', async ({ page }) => {
  await isolateAnalytics(page);
  const article = pages.find(({ path }) => path === '/guides/hospital-transport/')!;
  await page.goto(article.path);
  const note = page.locator('.source-note');
  const summary = note.locator('summary');
  await page.locator('.article-body > .referral a').focus();
  await page.keyboard.press('Tab');
  await expect(summary).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(note).toHaveAttribute('open', '');
  await expect(note.getByRole('link')).toHaveCount(article.sources.length);
});

test('home, collections, about, operator, privacy and search pages have no source note', async ({ page }) => {
  await isolateAnalytics(page);
  for (const path of ['/', '/guides/', '/regions/', '/about/', '/operator/', '/privacy/', '/search/']) {
    await page.goto(path);
    await expect(page.locator('.source-note'), path).toHaveCount(0);
  }
});
