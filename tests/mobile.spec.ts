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
  const table = page.getByRole('region', { name: '国保：11地域は葬祭費50,000円。青木村は20,000円、小海町は町に確認の表', exact: true });
  await expect(table).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(13);
  await expect(table.locator('thead th')).toHaveText(['故人が加入していた国保', '葬祭費', '申請・相談する窓口']);
  await expect(table.locator('tbody tr td:first-of-type')).toHaveText([...Array(8).fill('50,000円'), '町の案内に記載なし', '50,000円', '20,000円', ...Array(2).fill('50,000円')]);
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
  await expect(page.locator('.article-list > li')).toHaveCount(28);
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

const phone = { width: 390, height: 844 };

test('the home first screen on a phone serves a family in a hurry: urgent guides, then every municipality', async ({ page }) => {
  await isolateAnalytics(page);
  await page.setViewportSize(phone);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('大切な人をおくる、その前に。');
  const bottomOf = async (selector: string) => {
    const box = await page.locator(selector).boundingBox();
    return box!.y + box!.height;
  };
  await expect(page.getByRole('heading', { level: 2, name: 'いま、家族が亡くなった方へ' })).toBeInViewport();
  const urgent = page.locator('.urgent-list a');
  await expect(urgent).toHaveCount(4);
  expect(await urgent.evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(['/guides/hospital-transport/', '/guides/home-death/', '/guides/first-day/', '/guides/funeral-flow/']);
  expect(await bottomOf('.urgent')).toBeLessThan(phone.height * 0.6);
  // 地域から探す and all ten municipalities fit on the first screen; the photograph comes after them.
  await expect(page.getByRole('heading', { level: 2, name: '地域から探す' })).toBeInViewport();
  const regionLinks = page.locator('.home-regions .region-directory a');
  await expect(regionLinks).toHaveCount(13);
  expect(await bottomOf('.home-regions')).toBeLessThanOrEqual(phone.height);
  expect((await page.locator('.home-top picture.editorial-image').boundingBox())!.y).toBeGreaterThanOrEqual(await bottomOf('.home-regions'));
  for (const box of await regionLinks.evaluateAll(links => links.map(link => link.getBoundingClientRect().toJSON()))) {
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(120);
  }
  await expect(page.locator('.home-regions .map-figure')).toBeHidden();
  await regionLinks.filter({ hasText: '安中市' }).click();
  await expect(page).toHaveURL('/regions/annaka/');
});

test('text is at least 16px for reading and 14px elsewhere, and controls are at least 44px tall on a phone', async ({ page }) => {
  await isolateAnalytics(page);
  await page.setViewportSize(phone);
  for (const path of ['/', '/guides/', '/regions/', '/guides/hospital-transport/', '/guides/funeral-benefit/', '/guides/grave-closure/', '/regions/annaka/', '/search/', '/operator/', '/about/', '/privacy/']) {
    await page.goto(path);
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
      const reading = Array.from(document.querySelectorAll('.prose-section p, .prose-section li, .article-lead, .key-points li, .quick-facts dd, .faq summary, .faq p, .editorial-prose p, .editorial-prose li, .urgent-when, .region-directory a'))
        .filter(element => parseFloat(getComputedStyle(element).fontSize) < 16).map(element => element.className || element.tagName);
      const lineHeight = Array.from(document.querySelectorAll('.prose-section p')).map(element => parseFloat(getComputedStyle(element).lineHeight) / parseFloat(getComputedStyle(element).fontSize));
      return { small, reading, lineHeight };
    });
    expect(sizes.small, path).toEqual([]);
    expect(sizes.reading, path).toEqual([]);
    for (const ratio of sizes.lineHeight) { expect(ratio).toBeGreaterThanOrEqual(1.85); expect(ratio).toBeLessThanOrEqual(1.95); }
    const short = await page.locator('.brand, .mobile-menu summary, .breadcrumbs a, .urgent-list a, .region-directory a, .article-list li, .text-link, .toc--inline summary, .toc--inline a, .referral-top a, .referral-inline a, .referral-card a, .quick-facts a, .faq summary, .source-note summary, .source-note a, .site-footer a, .primary-button, .search-form input, .search-form select, .topic-navigation a')
      .evaluateAll(controls => controls.filter(control => control.getClientRects().length).map(control => ({ control: `${control.tagName}.${control.className} ${control.textContent?.trim().slice(0, 16)}`, height: control.getBoundingClientRect().height })).filter(item => item.height < 44));
    expect(short, path).toEqual([]);
    await expectNoHorizontalOverflow(page);
  }
});

test('on a phone the table of contents is a closed details that opens without scripts and jumps to a section', async ({ page, browser }) => {
  await isolateAnalytics(page);
  await page.setViewportSize(phone);
  await page.goto('/guides/hospital-transport/');
  const toc = page.locator('.article-body > details.toc--inline');
  await expect(toc).not.toHaveAttribute('open');
  await expect(toc.locator('summary')).toHaveText('目次');
  await expect(page.locator('.toc--side')).toBeHidden();
  expect((await toc.boundingBox())!.height).toBeLessThanOrEqual(60);
  // The answer comes first: summary box, then the consultation row, then the contents, then the photograph.
  const order = await page.locator('.article-body').evaluate(body => Array.from(body.children).slice(0, 4).map(node => node.className.split(' ')[0]));
  expect(order).toEqual(['key-points', 'referral-top', 'toc', 'editorial-image']);
  await toc.locator('summary').click();
  await expect(toc.locator('a')).toHaveText(['病院では、迎えに来てもらう場所と時刻を確かめる', '葬儀社への電話は、搬送と安置の相談からでよい', '安置先は、自宅か安置施設から選ぶ', '搬送を頼む前に、最初にかかる費用を聞く']);
  await toc.getByRole('link', { name: '安置先は、自宅か安置施設から選ぶ', exact: true }).click();
  await expect(page).toHaveURL(/#place$/);
  await expect(page.locator('#place h2')).toBeInViewport();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);

  const context = await browser.newContext({ javaScriptEnabled: false, viewport: phone });
  const fallback = await context.newPage();
  await fallback.goto('/regions/annaka/');
  const plain = fallback.locator('.article-body > details.toc--inline');
  await plain.locator('summary').click();
  await expect(plain.locator('a').first()).toBeVisible();
  await plain.locator('a').nth(1).click();
  await expect(fallback).toHaveURL(/#procedures$/);
  await context.close();
});

test('the region page reads well at 390 and 320 pixels: summary, quick facts and phone links without overflow', async ({ page }) => {
  await isolateAnalytics(page);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/regions/annaka/');
    await expectNoHorizontalOverflow(page);
    await expect(page.locator('.key-points')).toBeInViewport();
    const rows = page.locator('.quick-facts dl > div');
    await expect(rows).toHaveCount(9);
    for (const box of await rows.evaluateAll(all => all.map(row => ({ row: row.getBoundingClientRect().toJSON(), label: row.querySelector('dt')!.getBoundingClientRect().toJSON(), value: row.querySelector('dd')!.getBoundingClientRect().toJSON() })))) {
      // Label column on the left, value column on the right, both inside the row.
      expect(box.label.right).toBeLessThanOrEqual(box.value.left);
      expect(box.value.right).toBeLessThanOrEqual(box.row.right + 0.5);
      expect(box.value.width).toBeGreaterThan(box.label.width);
    }
    await expect(page.locator('.quick-facts a[href="tel:0273821111"]')).toHaveText('027-382-1111');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  }
  for (const path of ['/', '/guides/', '/regions/', '/guides/hospital-transport/', '/guides/funeral-cost/']) {
    await page.goto(path);
    await expectNoHorizontalOverflow(page);
  }
});
