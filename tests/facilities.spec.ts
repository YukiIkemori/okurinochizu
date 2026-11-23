import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { readFileSync } from 'node:fs';
import { expectNoHorizontalOverflow, isolateAnalytics, layer, preventExternalNavigation } from './helpers';

type Fact = { label: string; value: string; href?: string };
type Section = { id: string; heading: string; table?: { headers: string[]; rows: string[][] } };
type Facility = {
  slug: string; name: string; region: string; regions: string[]; phone: string; postalCode: string; prefecture: string; locality: string; street: string;
  pageTitle: string; heading: string; description: string; summary: string; keyPoints: string[]; quickFacts: Fact[]; sections: Section[];
  sources: string[]; related: string[]; publishedAt: string; updatedAt: string;
};
type Region = { slug: string; name: string; referral: { href: string; label: string } };
type Source = { id: string; title: string; url: string; checkedAt: string };
const read = (file: string) => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const content = read('../src/data/content.json') as { facilities: Facility[]; regions: Region[] };
const registry = new Map((read('../src/data/sources.json') as Source[]).map(source => [source.id, source]));
const region = (slug: string) => content.regions.find(item => item.slug === slug)!;
const usedIn = (slug: string) => content.facilities.filter(facility => facility.regions.includes(slug));
const japaneseDate = (date: string) => { const [y, m, d] = date.split('-').map(Number); return `${y}年${m}月${d}日`; };
const linkText = 'つばさ公益社のページを見る';
const phone = { width: 390, height: 844 };

test.beforeEach(async ({ page }) => { await isolateAnalytics(page); });

test('the first facility page is published', () => {
  expect(content.facilities.map(facility => facility.slug)).toContain('sakudaira-saijo');
  for (const facility of content.facilities) expect(facility.regions, facility.slug).toContain(facility.region);
});

test('every facility page shows the summary, quick facts, contents and one header photograph, like a region page', async ({ page }) => {
  for (const facility of content.facilities) {
    const response = await page.goto(`/facilities/${facility.slug}/`);
    expect(response?.status(), `${facility.name} must have a published page`).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(facility.heading);
    await expect(page).toHaveTitle(`${facility.pageTitle}｜おくりの地図`);
    expect(facility.pageTitle.startsWith(facility.name), 'the title leads with the facility name').toBe(true);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', facility.description);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://okurinochizu.jp/facilities/${facility.slug}/`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /^index, follow/);
    await expect(page.locator('.breadcrumbs a[href="/facilities/"]')).toHaveText('斎場・火葬場の案内');

    // Same order as a region page, without the top consultation row.
    const order = await page.locator('.article-body').evaluate(body => Array.from(body.children).slice(0, 4).map(node => node.className.split(' ')[0]));
    expect(order).toEqual(['key-points', 'quick-facts', 'toc', 'editorial-image']);
    const summary = page.locator('.article-body > .key-points:first-child');
    await expect(summary.getByRole('heading', { level: 2 })).toHaveText('まず知っておきたいこと');
    await expect(summary.locator('li')).toHaveText(facility.keyPoints);
    await expect(page.locator('.article-lead')).toHaveCount(0);

    const panel = page.locator('.article-body > section.quick-facts');
    await expect(panel.getByRole('heading', { level: 2 })).toHaveText('早見表');
    await expect(panel.locator('dt')).toHaveText(facility.quickFacts.map(fact => fact.label));
    await expect(panel.locator('dd')).toHaveText(facility.quickFacts.map(fact => fact.value));
    // The only phone link is the public facility's own number, printed in the body as well.
    const phones = page.locator('a[href^="tel:"]');
    await expect(phones).toHaveCount(1);
    await expect(phones).toHaveText(facility.phone);
    await expect(phones).toHaveAttribute('href', 'tel:' + facility.phone.replaceAll('-', ''));
    await expect(phones).not.toHaveAttribute('data-provider-link');
    await expect(page.locator('.quick-facts a[href^="tel:"]')).toHaveCount(1);
    await expect(page.locator('.prose-section').filter({ hasText: facility.phone })).not.toHaveCount(0);
    // Other quick-fact links lead to the page's recorded sources.
    const sourceUrls = facility.sources.map(id => registry.get(id)!.url);
    for (const fact of facility.quickFacts.filter(item => item.href && !item.href.startsWith('tel:'))) {
      expect(sourceUrls, fact.label).toContain(fact.href);
      await expect(panel.getByRole('link', { name: fact.value, exact: true })).toHaveAttribute('href', fact.href!);
    }

    const toc = page.locator('.article-body > details.toc--inline');
    await expect(toc).not.toHaveAttribute('open');
    await expect(page.locator('.article-side nav.toc--side a')).toHaveText(facility.sections.map(section => section.heading));
    await expect(page.locator('.prose-section > h2')).toHaveText(facility.sections.map(section => section.heading));

    const photographs = page.locator('picture.editorial-image img');
    await expect(photographs).toHaveCount(1);
    await expect(photographs).toHaveAttribute('loading', 'lazy');
    await expect(photographs).toHaveAttribute('alt', '');
    await expect(page.locator('.article-body > .toc--inline ~ picture.editorial-image--header ~ .prose-section').first()).toBeVisible();
    await expect(page.locator('figcaption, .faq')).toHaveCount(0);

    // Structured data: the page and the facility's published name, address and phone number only.
    const schemas = await page.locator('script[type="application/ld+json"]').evaluateAll(nodes => nodes.flatMap(node => JSON.parse(node.textContent || '[]')));
    const webPage = schemas.find(schema => schema['@type'] === 'WebPage');
    expect(webPage).toMatchObject({
      name: facility.pageTitle, description: facility.description, url: `https://okurinochizu.jp/facilities/${facility.slug}/`, datePublished: facility.publishedAt, dateModified: facility.updatedAt,
      about: { '@type': 'Crematorium', name: facility.name, telephone: facility.phone, address: { postalCode: facility.postalCode, addressRegion: facility.prefecture, addressLocality: facility.locality, streetAddress: facility.street } },
    });
    expect(JSON.stringify(schemas)).not.toMatch(/Review|AggregateRating|ratingValue|つばさ/);
  }
});

test('a facility page carries only the end consultation block of the region where it stands', async ({ page }) => {
  for (const facility of content.facilities) {
    const home = region(facility.region);
    await page.goto(`/facilities/${facility.slug}/`);
    const links = page.locator('[data-provider-link]');
    await expect(links).toHaveCount(1);
    await expect(page.locator('.referral-top, .referral-inline')).toHaveCount(0);
    const block = page.locator('.article-body > section.referral-card');
    await expect(block).toHaveCount(1);
    await expect(block.getByRole('heading', { level: 2 })).toHaveText(home.referral.label);
    await expect(block.locator('a')).toHaveCount(1);
    await expect(block.locator('a')).toHaveText(linkText);
    await expect(block.locator('a')).toHaveAttribute('data-placement', 'article-end');
    await expect(block.locator('p:not(.referral-action)')).toHaveCount(1);
    await expect(block.locator('img, svg, picture, button, form')).toHaveCount(0);
    // After the last section; only the collapsed source note sits between the block and related navigation.
    await expect(page.locator('.article-body > .prose-section + .referral-card')).toHaveCount(1);
    await expect(page.locator('.article-body > .referral-card + .source-note + .related-articles')).toHaveCount(1);
    const destination = new URL((await block.locator('a').getAttribute('href'))!);
    expect(destination.origin + destination.pathname).toBe(home.referral.href);
    expect(destination.searchParams.get('utm_content')).toBe(`${facility.slug}-article-end`);
    expect(destination.searchParams.get('utm_source')).toBe('okurinochizu');
    await expect(block.locator('a')).not.toHaveAttribute('rel', /sponsored/);

    // No phone element, nothing sticky or floating, and no provider name in the editorial parts.
    await expect(page.locator('[data-provider-link][href^="tel:"], [data-placement="call"], [data-provider-link][rel~="sponsored"]')).toHaveCount(0);
    const floating = await links.evaluateAll(all => all.filter(link => {
      for (let node: Element | null = link; node && node !== document.body; node = node.parentElement) if (['fixed', 'sticky'].includes(getComputedStyle(node).position)) return true;
      return false;
    }).length);
    expect(floating, 'the consultation link must scroll with the page').toBe(0);
    expect(await page.locator('.article-head').textContent()).not.toContain('つばさ');
    expect(await page.locator('.prose-section, .key-points, .quick-facts, .toc, .related-articles').allTextContents()).not.toEqual(expect.arrayContaining([expect.stringMatching(/つばさ|公益社/)]));
    // No reviews, ratings or supervision claims.
    await expect(page.locator('main')).not.toContainText(/監修|口コミ|レビュー|評価/);

    // The click is measured like a region page's end block.
    await preventExternalNavigation(page, '.referral-card [data-provider-link]');
    await block.locator('a').click();
    const events = (await layer(page)).filter(entry => entry[0] === 'event' && entry[1] === 'provider_referral_click');
    expect(events).toHaveLength(1);
    expect(events[0][2]).toMatchObject({ provider: 'tsubasa', content_slug: facility.slug, region: facility.region, intent: 'regional-funeral', placement: 'article-end', destination_url: destination.origin + destination.pathname });
    // The facility's own phone link is not a provider referral.
    await page.locator('.quick-facts a[href^="tel:"]').evaluate(element => { element.addEventListener('click', event => event.preventDefault()); (element as HTMLElement).click(); });
    expect((await layer(page)).filter(entry => entry[1] === 'provider_referral_click')).toHaveLength(1);
  }
});

test('a facility page keeps its sources in one closed note and links to the regions and guides it records', async ({ page }) => {
  for (const facility of content.facilities) {
    const sources = facility.sources.map(id => registry.get(id)!);
    await page.goto(`/facilities/${facility.slug}/`);
    const note = page.locator('.article-body > .referral + details.source-note');
    await expect(note).toHaveCount(1);
    await expect(page.locator('.source-note')).toHaveCount(1);
    await expect(note).not.toHaveAttribute('open');
    await expect(note.locator('summary')).toHaveText(`出典と確認日（${sources.length}件・最終確認 ${japaneseDate(sources.map(source => source.checkedAt).sort().at(-1)!)}）`);
    await expect(note.locator('ul')).toBeHidden();
    await note.locator('summary').click();
    const items = note.locator('li');
    await expect(items).toHaveCount(sources.length);
    for (const [index, source] of sources.entries()) {
      await expect(items.nth(index).getByRole('link', { name: source.title, exact: true })).toHaveAttribute('href', source.url);
      await expect(items.nth(index).locator('.source-note-date')).toHaveText(`確認日 ${japaneseDate(source.checkedAt)}`);
    }
    // Every external link in the body is one of the recorded official sources.
    const external = await page.locator('.prose-section a[href^="http"], .quick-facts a[href^="http"]').evaluateAll(links => links.map(link => link.getAttribute('href')));
    for (const href of external) expect(sources.map(source => source.url)).toContain(href);

    const regions = page.locator('.article-body > .related-articles.facility-regions');
    await expect(regions.getByRole('heading', { level: 2 })).toHaveText('この斎場を使う地域の案内');
    await expect(regions.locator('.region-directory a')).toHaveText(facility.regions.map(slug => region(slug).name));
    expect(await regions.locator('.region-directory a').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(facility.regions.map(slug => `/regions/${slug}/`));
    expect(await page.locator('.article-body > .related-articles:not(.facility-regions) .article-list a').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(facility.related.map(slug => `/guides/${slug}/`));
    await regions.locator('.region-directory').getByRole('link', { name: region(facility.region).name, exact: true }).click();
    await expect(page).toHaveURL(`/regions/${facility.region}/`);
  }
});

test('facility pages read well on a phone: fee tables fit, text and controls are large enough', async ({ page }) => {
  for (const facility of content.facilities) {
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/facilities/${facility.slug}/`);
      await expectNoHorizontalOverflow(page);
      await expect(page.locator('.key-points')).toBeInViewport();
      await expect(page.locator('.toc--side')).toBeHidden();
      // Label column on the left, value column on the right, both inside the row.
      for (const box of await page.locator('.quick-facts dl > div').evaluateAll(all => all.map(row => ({ row: row.getBoundingClientRect().toJSON(), label: row.querySelector('dt')!.getBoundingClientRect().toJSON(), value: row.querySelector('dd')!.getBoundingClientRect().toJSON() })))) {
        expect(box.label.right).toBeLessThanOrEqual(box.value.left);
        expect(box.value.right).toBeLessThanOrEqual(box.row.right + 0.5);
        expect(box.value.width).toBeGreaterThan(box.label.width);
      }
      // Fee tables show every column without scrolling sideways, and no cell is squeezed to a sliver.
      const tables = page.locator('.prose-section .table-scroll');
      await expect(tables).toHaveCount(facility.sections.filter(section => section.table).length);
      for (const table of await tables.evaluateAll(all => all.map(element => ({ client: element.clientWidth, scroll: element.scrollWidth, narrowest: Math.min(...Array.from(element.querySelectorAll('th, td')).map(cell => cell.getBoundingClientRect().width)) })))) {
        expect(table.scroll).toBeLessThanOrEqual(table.client + 1);
        expect(table.narrowest).toBeGreaterThanOrEqual(56);
      }
      await page.locator('details:not(.mobile-menu)').evaluateAll(all => all.forEach(details => { (details as HTMLDetailsElement).open = true; }));
      const sizes = await page.evaluate(() => {
        const small: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const element = node.parentElement;
          if (!element || !node.textContent?.trim() || element.closest('svg, script, style, noscript, .sr-only, .skip-link, [hidden]') || !element.getClientRects().length) continue;
          const size = parseFloat(getComputedStyle(element).fontSize);
          if (size < 14) small.push(`${size}px ${element.tagName}.${element.className}: ${node.textContent.trim().slice(0, 20)}`);
        }
        const reading = Array.from(document.querySelectorAll('.prose-section p, .prose-section li, .key-points li, .quick-facts dd, .region-directory a'))
          .filter(element => parseFloat(getComputedStyle(element).fontSize) < 16).map(element => element.className || element.tagName);
        return { small, reading };
      });
      expect(sizes.small, `${facility.slug} ${width}`).toEqual([]);
      expect(sizes.reading, `${facility.slug} ${width}`).toEqual([]);
      const short = await page.locator('.breadcrumbs a, .region-directory a, .article-list li, .text-link, .toc--inline summary, .toc--inline a, .referral-card a, .quick-facts a, .source-note summary, .source-note a')
        .evaluateAll(controls => controls.filter(control => control.getClientRects().length).map(control => ({ control: `${control.tagName}.${control.className} ${control.textContent?.trim().slice(0, 16)}`, height: control.getBoundingClientRect().height })).filter(item => item.height < 44));
      expect(short, `${facility.slug} ${width}`).toEqual([]);
      await expectNoHorizontalOverflow(page);
    }
    await page.setViewportSize(phone);
    await page.goto(`/facilities/${facility.slug}/`);
    const toc = page.locator('.article-body > details.toc--inline');
    await toc.locator('summary').click();
    await toc.getByRole('link', { name: facility.sections[2].heading, exact: true }).click();
    await expect(page).toHaveURL(new RegExp('#' + facility.sections[2].id + '$'));
    await expect(page.locator(`#${facility.sections[2].id} h2`)).toBeInViewport();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  }
});

test('facility pages pass keyboard and WCAG A/AA checks on a wide screen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const facility of content.facilities) {
    await page.goto(`/facilities/${facility.slug}/`);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: '本文へ移動', exact: true })).toBeFocused();
    const side = page.locator('.article-side nav.toc--side');
    await expect(side).toBeVisible();
    await expect(page.locator('details.toc--inline')).toBeHidden();
    const column = await page.locator('.article-body').boundingBox();
    expect((await side.boundingBox())!.x).toBeGreaterThanOrEqual(column!.x + column!.width);
    await expectNoHorizontalOverflow(page);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  }
});

test('the facility index lists every facility as a plain ruled list, without photograph or consultation block', async ({ page }) => {
  const response = await page.goto('/facilities/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('斎場・火葬場の案内');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://okurinochizu.jp/facilities/');
  const rows = page.locator('main .facility-list > li');
  await expect(rows).toHaveCount(content.facilities.length);
  await expect(rows.locator('h2 a')).toHaveText(content.facilities.map(facility => facility.name));
  await expect(rows.locator('.article-summary')).toHaveText(content.facilities.map(facility => facility.summary));
  await expect(page.locator('[data-provider-link], a[href^="tel:"], picture, .source-note, .key-points, .quick-facts')).toHaveCount(0);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expectNoHorizontalOverflow(page);
    for (const height of await rows.evaluateAll(all => all.map(row => row.getBoundingClientRect().height))) expect(height).toBeGreaterThanOrEqual(44);
  }
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  await rows.first().getByRole('link').click();
  await expect(page).toHaveURL(`/facilities/${content.facilities[0].slug}/`);
});

test('the region index and the region pages that use a facility link to it from related navigation only', async ({ page }) => {
  await page.goto('/regions/');
  // The municipality index itself is unchanged; the facility list follows it.
  await expect(page.locator('.region-directory a')).toHaveCount(content.regions.length);
  const section = page.locator('main section.facility-index');
  await expect(section.getByRole('heading', { level: 2 })).toHaveText('斎場・火葬場の案内');
  await expect(section.locator('.directory-heading a')).toHaveAttribute('href', '/facilities/');
  await expect(section.locator('.facility-list a')).toHaveText(content.facilities.map(facility => facility.name));
  expect((await section.boundingBox())!.y).toBeGreaterThan((await page.locator('.region-directory').boundingBox())!.y);
  await expect(page.locator('[data-provider-link]')).toHaveCount(0);

  for (const item of content.regions) {
    const facilities = usedIn(item.slug);
    await page.goto(`/regions/${item.slug}/`);
    const block = page.locator('.article-body > .related-articles.related-facilities');
    await expect(block, item.slug).toHaveCount(facilities.length ? 1 : 0);
    // Never inside the body: the sections link to guides and official pages only.
    await expect(page.locator('.prose-section a[href^="/facilities/"], .key-points a, .quick-facts a[href^="/facilities/"]'), item.slug).toHaveCount(0);
    if (!facilities.length) continue;
    await expect(block.getByRole('heading', { level: 2 })).toHaveText('この地域の斎場・火葬場');
    expect(await block.locator('.facility-list a').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(facilities.map(facility => `/facilities/${facility.slug}/`));
    // After the consultation block and the source note, beside the other related lists.
    await expect(page.locator('.article-body > .referral-card ~ .related-facilities')).toHaveCount(1);
    await expect(page.locator('.article-body > .related-facilities ~ .prose-section, .article-body > .related-facilities ~ .referral-card')).toHaveCount(0);
  }
  await page.goto(`/regions/${content.facilities[0].region}/`);
  await page.locator('.related-facilities .facility-list a').first().click();
  await expect(page).toHaveURL(`/facilities/${content.facilities[0].slug}/`);
});

test('the home first screen is unchanged and facility pages are in the sitemap, the discovery index and search', async ({ page, request }) => {
  await page.setViewportSize(phone);
  await page.goto('/');
  // Nothing about facilities is added to the home page; its first screen keeps the urgent links and the region index.
  await expect(page.locator('a[href^="/facilities/"]')).toHaveCount(0);
  await expect(page.locator('.urgent-list a')).toHaveCount(4);
  const regions = await page.locator('.home-regions').boundingBox();
  expect(regions!.y + regions!.height).toBeLessThanOrEqual(phone.height);

  const sitemap = await (await request.get('/sitemap.xml')).text();
  const llms = await (await request.get('/llms.txt')).text();
  expect(sitemap).toContain('<loc>https://okurinochizu.jp/facilities/</loc>');
  for (const facility of content.facilities) {
    expect(sitemap).toContain(`<url><loc>https://okurinochizu.jp/facilities/${facility.slug}/</loc><lastmod>${facility.updatedAt}</lastmod></url>`);
    expect(llms).toContain(`https://okurinochizu.jp/facilities/${facility.slug}/`);
  }
  const first = content.facilities[0];
  await page.goto('/search/?q=' + encodeURIComponent(first.name));
  await expect(page.locator(`#search-results a[href="/facilities/${first.slug}/"]`)).toBeVisible();
  // A regional filter keeps the facility for a region that uses it and hides it for one that does not.
  await page.goto('/search/?region=' + first.regions[0]);
  await expect(page.locator(`#search-results a[href="/facilities/${first.slug}/"]`)).toBeVisible();
  const other = content.regions.find(item => !first.regions.includes(item.slug));
  if (other) {
    await page.goto('/search/?region=' + other.slug);
    await expect(page.locator(`#search-results a[href="/facilities/${first.slug}/"]`)).toBeHidden();
  }
});
