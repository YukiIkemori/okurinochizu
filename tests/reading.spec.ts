import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { expectNoHorizontalOverflow, isolateAnalytics, layer, preventExternalNavigation } from './helpers';

type Fact = { label: string; value: string; href?: string };
type Item = { slug: string; lead: string; sections: { id: string; heading: string }[]; faq?: unknown[]; keyPoints?: string[]; quickFacts?: Fact[] };
const content = JSON.parse(readFileSync(new URL('../src/data/content.json', import.meta.url), 'utf8')) as { articles: Item[]; regions: Item[] };
const article = (slug: string) => content.articles.find(item => item.slug === slug)!;
const region = (slug: string) => content.regions.find(item => item.slug === slug)!;

test.beforeEach(async ({ page }) => { await isolateAnalytics(page); });

test('every guide and region page opens with the summary box in place of the lead paragraph', async ({ page }) => {
  for (const item of [...content.articles, ...content.regions]) {
    expect(item.keyPoints?.length ?? 0, item.slug).toBeGreaterThanOrEqual(3);
    expect(item.keyPoints!.length, item.slug).toBeLessThanOrEqual(5);
  }
  for (const [path, item] of [
    ['/guides/hospital-transport/', article('hospital-transport')], ['/guides/funeral-cost/', article('funeral-cost')], ['/guides/family-funeral/', article('family-funeral')],
    ['/guides/home-death/', article('home-death')], ['/regions/annaka/', region('annaka')], ['/regions/saku/', region('saku')],
  ] as const) {
    await page.goto(path);
    const summary = page.locator('.article-body > .key-points:first-child');
    await expect(summary.getByRole('heading', { level: 2 })).toHaveText('まず知っておきたいこと');
    await expect(summary.locator('li')).toHaveText(item.keyPoints!);
    await expect(page.locator('.article-lead')).toHaveCount(0);
  }
});

test('the region quick-facts panel is a ruled list whose public-office phone numbers are tel links', async ({ page }) => {
  for (const item of content.regions) {
    const facts = item.quickFacts!;
    expect(facts.length, item.slug).toBeGreaterThanOrEqual(3);
    await page.goto(`/regions/${item.slug}/`);
    const panel = page.locator('.article-body > section.quick-facts');
    await expect(panel.getByRole('heading', { level: 2 })).toHaveText('早見表');
    await expect(panel.locator('dt')).toHaveText(facts.map(fact => fact.label));
    await expect(panel.locator('dd')).toHaveText(facts.map(fact => fact.value));
    const phones = facts.filter(fact => fact.href?.startsWith('tel:'));
    expect(phones.length, item.slug).toBeGreaterThan(0);
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(phones.length);
    for (const fact of phones) {
      const link = panel.getByRole('link', { name: fact.value, exact: true });
      await expect(link).toHaveAttribute('href', 'tel:' + fact.value.replaceAll('-', ''));
      await expect(link).not.toHaveAttribute('data-provider-link');
      // The same number is printed in the body, so the panel adds no new fact.
      await expect(page.locator('.prose-section').filter({ hasText: fact.value })).not.toHaveCount(0);
    }
    await expect(panel).not.toContainText('つばさ');
  }
  // Guide pages have no quick-facts panel and no phone link.
  await page.goto('/guides/hospital-transport/');
  await expect(page.locator('.quick-facts')).toHaveCount(0);
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
});

test('wide screens show the table of contents as a sticky side column listing every h2 section', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const item = article('grave-closure');
  await page.goto('/guides/grave-closure/');
  const side = page.locator('.article-side nav.toc--side');
  await expect(side).toBeVisible();
  await expect(page.locator('details.toc--inline')).toBeHidden();
  await expect(side.locator('a')).toHaveText([...item.sections.map(section => section.heading), 'よくある疑問']);
  const column = await page.locator('.article-body').boundingBox();
  const box = await side.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(column!.x + column!.width);
  await side.getByRole('link', { name: item.sections[2].heading, exact: true }).click();
  await expect(page).toHaveURL(new RegExp('#' + item.sections[2].id + '$'));
  await expect(page.locator(`#${item.sections[2].id} h2`)).toBeInViewport();
  // Still visible beside the text after jumping down the page.
  await expect(side).toBeInViewport();
  await expectNoHorizontalOverflow(page);
});

test('each article and region page shows one header photograph after the summary, without layout shift', async ({ page }) => {
  for (const path of ['/guides/hospital-transport/', '/guides/family-funeral/', '/regions/annaka/', '/regions/saku/']) {
    await page.goto(path);
    const photographs = page.locator('picture.editorial-image img');
    await expect(photographs, path).toHaveCount(1);
    await expect(photographs).toHaveAttribute('loading', 'lazy');
    await expect(photographs).toHaveAttribute('alt', '');
    expect(Number(await photographs.getAttribute('width'))).toBeGreaterThan(0);
    expect(Number(await photographs.getAttribute('height'))).toBeGreaterThan(0);
    await expect(page.locator('.article-body > :is(.key-points, .article-lead) ~ picture.editorial-image--header ~ .prose-section').first()).toBeVisible();
    await expect(page.locator('.article-head picture, .prose-section picture, .editorial-image--interlude')).toHaveCount(0);
  }
  // The region page shows the schematic map with its own municipality marked.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/regions/annaka/');
  await expect(page.locator('.other-regions .map-region--current')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.other-regions .map-region--current')).toHaveAttribute('href', '/regions/annaka/');
});

test('the top row and the home block send provider_referral_click with their own placement', async ({ page }) => {
  for (const [path, selector, expected] of [
    ['/regions/annaka/', '.referral-top [data-provider-link]', { content_slug: 'annaka', region: 'annaka', intent: 'regional-funeral', placement: 'article-top' }],
    ['/guides/hospital-transport/', '.referral-top [data-provider-link]', { content_slug: 'hospital-transport', region: 'all', intent: 'urgent', placement: 'article-top' }],
    ['/guides/hospital-transport/', '.referral-inline [data-provider-link]', { content_slug: 'hospital-transport', intent: 'urgent', placement: 'in-article' }],
    ['/', '.referral-card [data-provider-link]', { content_slug: 'home', intent: 'regional-funeral', placement: 'home-end' }],
  ] as const) {
    await page.goto(path);
    const destination = new URL(await page.locator(selector).getAttribute('href') || '');
    expect(destination.searchParams.get('utm_content')).toBe(`${expected.content_slug}-${expected.placement}`);
    await preventExternalNavigation(page, selector);
    await page.locator(selector).click();
    const events = (await layer(page)).filter(entry => entry[0] === 'event' && entry[1] === 'provider_referral_click');
    expect(events, `${path} ${selector}`).toHaveLength(1);
    expect(events[0][2]).toMatchObject({ provider: 'tsubasa', ...expected, destination_url: destination.origin + destination.pathname });
  }
  // A public office's phone link is not a provider referral.
  await page.goto('/regions/annaka/');
  await page.locator('.quick-facts a[href^="tel:"]').first().evaluate(element => { element.addEventListener('click', event => event.preventDefault()); (element as HTMLElement).click(); });
  expect((await layer(page)).filter(entry => entry[1] === 'provider_referral_click')).toHaveLength(0);
});

test('home, collections and search use the ruled lists; guides are grouped by need', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 2, name: 'いま、家族が亡くなった方へ' })).toBeInViewport();
  await expect(page.locator('.urgent-list a')).toHaveCount(4);
  await expect(page.getByRole('heading', { level: 2, name: '地域から探す' })).toBeVisible();
  await expect(page.locator('.home-regions .region-directory a')).toHaveCount(10);
  await expect(page.locator('.home-regions .map-figure')).toBeVisible();
  await expect(page.locator('.home-guides .need-group h3')).toHaveText(['葬儀の前後', '費用とお金', '手続き', 'お墓と終活']);
  await page.locator('.home-guides .need-group').nth(1).locator('.need-label a').click();
  await expect(page).toHaveURL('/guides/#money');
  await expect(page.locator('.index-section .need-group h2')).toHaveText(['葬儀の前後', '費用とお金', '手続き', 'お墓と終活']);
  await expect(page.locator('#money h2')).toBeInViewport();
  await expect(page.locator('.article-list > li')).toHaveCount(28);
  // Every guide appears in exactly one group.
  expect(new Set(await page.locator('.article-list a').evaluateAll(links => links.map(link => link.getAttribute('href')))).size).toBe(28);
  await page.goto('/regions/');
  await expect(page.locator('.region-directory a')).toHaveCount(10);
  await expect(page.locator('.region-directory h2')).toHaveText(['長野県', '群馬県']);
  await page.locator('.region-directory').getByRole('link', { name: '富岡市', exact: true }).click();
  await expect(page).toHaveURL('/regions/tomioka/');
});

for (const path of ['/guides/', '/regions/', '/guides/funeral-cost/', '/guides/grave-closure/', '/about/']) {
  test(`WCAG A/AA on the redesigned ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
