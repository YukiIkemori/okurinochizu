import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import { listFiles, fingerprintDist } from './lib/build-fingerprint.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
process.chdir(ROOT);
const origin = 'https://okurinochizu.jp';
const problems = [];
const warnings = [];
const fail = (page, message) => problems.push({ page, message });
const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const validDate = date => datePattern.test(date || '') && !Number.isNaN(Date.parse(date)) && date <= today;
const hasCredentialParameter = url => [...url.searchParams.keys()].some(key => /(?:token|secret|password|api[_-]?key|credential)/i.test(key));
const content = JSON.parse(await readFile('src/data/content.json', 'utf8'));
const sources = JSON.parse(await readFile('src/data/sources.json', 'utf8'));
const registry = Array.isArray(sources) ? sources : sources.sources;
if (!Array.isArray(registry)) throw new Error('src/data/sources.json must contain a source array.');
const bySource = new Map(registry.map(s => [s.id, s]));
const articleBySlug = new Map(content.articles.map(a => [a.slug, a]));
const regionBySlug = new Map(content.regions.map(r => [r.slug, r]));
const categorySlugs = ['urgent', 'funeral', 'cost', 'cemetery', 'planning', 'procedures'];
const expectedIndexable = new Set([
  '/', '/guides/', '/regions/', '/about/', '/privacy/',
  ...content.articles.map(a => `/guides/${a.slug}/`),
  ...content.regions.map(r => `/regions/${r.slug}/`),
]);
const expectedPages = new Set([...expectedIndexable, '/search/', '/404.html']);
const sourceURLs = new Set(registry.map(s => new URL(s.url).origin + new URL(s.url).pathname));
const privacyURLs = new Set([
  'https://policies.google.com/technologies/partner-sites',
  'https://tools.google.com/dlpage/gaoptout',
]);
const providerHosts = new Set(['so-gi.com', 'www.so-gi.com']);
const prohibitedHosts = ['mitsuwa-sougi.co.jp', 'soogi.jp', 'ansinsougi.jp', 'e-ohaka.com', 'lifedot.jp', 'e-sogi.com', 'osohshiki.jp'];

for (const [kind, rows] of [['articles', content.articles], ['regions', content.regions], ['sources', registry]]) {
  const keys = rows.map(row => kind === 'sources' ? row.id : row.slug);
  if (new Set(keys).size !== keys.length) fail(kind, 'Duplicate IDs or slugs.');
}
for (const source of registry) {
  if (!source.id || !source.title || !validDate(source.checkedAt)) fail(source.id, 'Source needs a title and a real, non-future check date.');
  const url = new URL(source.url);
  if (url.protocol !== 'https:') fail(source.id, 'Source URL must use HTTPS.');
  if (url.username || url.password || hasCredentialParameter(url)) fail(source.id, 'A source URL contains credential-like information.');
}
for (const item of [...content.articles, ...content.regions]) {
  if (!item.sections?.length || !item.sources?.length) fail(item.slug, 'Editorial content must have sections and primary sources.');
  if (!validDate(item.updatedAt) || (item.publishedAt && (!validDate(item.publishedAt) || item.publishedAt > item.updatedAt))) fail(item.slug, 'Publication/update dates are invalid.');
  if (item.category && !categorySlugs.includes(item.category)) fail(item.slug, 'Unknown category.');
  for (const source of item.sources || []) if (!bySource.has(source)) fail(item.slug, `Unknown source ID: ${source}`);
  for (const slug of item.related || []) if (!articleBySlug.has(slug)) fail(item.slug, `Unknown related article: ${slug}`);
  for (const slug of item.regions || []) if (!regionBySlug.has(slug)) fail(item.slug, `Unknown region: ${slug}`);
  const sectionIds = item.sections.map(s => s.id);
  if (new Set(sectionIds).size !== sectionIds.length) fail(item.slug, 'Duplicate section IDs.');
  if (!providerHosts.has(new URL(item.referral.href).hostname)) fail(item.slug, 'Referral destination is not Tsubasa.');
}
// Detect exactly duplicated region bodies even if only the eight place names differ.
const regionBodyKeys = new Map();
const placeNames = content.regions.map(r => r.name).sort((a, b) => b.length - a.length);
for (const region of content.regions) {
  let body = normalize(region.sections.map(s => [s.heading, ...s.paragraphs, ...(s.bullets || [])].join(' ')).join(' '));
  for (const name of placeNames) body = body.replaceAll(name, '[地域]');
  if (regionBodyKeys.has(body)) fail(region.slug, `Region body repeats ${regionBodyKeys.get(body)} with only place names changed.`);
  regionBodyKeys.set(body, region.slug);
}

const files = await listFiles('dist');
const htmlFiles = files.filter(file => file.endsWith('.html'));
const fileByRoute = new Map(files.map(file => {
  const relative = path.relative('dist', file).split(path.sep).join('/');
  return ['/' + relative, file];
}));
const routeOf = file => {
  const relative = path.relative('dist', file).split(path.sep).join('/');
  return relative === 'index.html' ? '/' : relative.endsWith('/index.html') ? '/' + relative.slice(0, -10) : '/' + relative;
};
const pages = new Map(htmlFiles.map(file => [routeOf(file), { file }]));
const resolveFile = pathname => {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return undefined; }
  if (decoded.includes('..') || decoded.includes('\\')) return undefined;
  return fileByRoute.get(decoded) || fileByRoute.get(decoded.replace(/\/$/, '') + '/index.html') || fileByRoute.get(decoded + '.html');
};
for (const page of pages.values()) {
  page.$ = load(await readFile(page.file, 'utf8'));
  page.ids = new Set(page.$('[id]').toArray().map(node => page.$(node).attr('id')));
}
for (const route of expectedPages) if (!pages.has(route)) fail(route, 'Expected page missing from dist.');
const titles = new Map();
const descriptions = new Map();
const outbound = new Set();
const schemas = (value) => Array.isArray(value) ? value.flatMap(schemas) : value && value['@graph'] ? schemas(value['@graph']) : [value];
for (const [route, { $, ids }] of pages) {
  if ($('html').attr('lang') !== 'ja') fail(route, 'HTML language must be ja.');
  if ($('h1').length !== 1) fail(route, 'Each page must have exactly one H1.');
  if ($('head > title').length !== 1 || !normalize($('head > title').text())) fail(route, 'Exactly one nonempty document title is required.');
  if ($('meta[name="description"]').length !== 1) fail(route, 'Exactly one description is required.');
  const title = normalize($('head > title').text());
  const description = normalize($('meta[name="description"]').attr('content'));
  if (description.length < 25 || description.length > 250) warnings.push({ page: route, message: `Review meta description length (${description.length} characters).` });
  if (expectedIndexable.has(route)) {
    if (titles.has(title)) fail(route, `Title repeats ${titles.get(title)}.`);
    if (descriptions.has(description)) fail(route, `Description repeats ${descriptions.get(description)}.`);
    titles.set(title, route); descriptions.set(description, route);
  }
  const canonical = route === '/404.html' ? origin + '/404/' : origin + route;
  if ($('link[rel="canonical"]').length !== 1 || $('link[rel="canonical"]').attr('href') !== canonical) fail(route, `Canonical must equal ${canonical}.`);
  for (const property of ['og:title', 'og:description', 'og:url', 'og:type', 'og:image']) if ($(`meta[property="${property}"]`).length !== 1) fail(route, `Missing or duplicate ${property}.`);
  if ($('meta[property="og:url"]').attr('content') !== canonical) fail(route, 'Open Graph URL differs from canonical.');
  if ($('meta[property="og:title"]').attr('content') !== title || $('meta[property="og:description"]').attr('content') !== description) fail(route, 'Open Graph title/description differ from document metadata.');
  const robots = $('meta[name="robots"]').attr('content') || '';
  if (['/search/', '/404.html'].includes(route) ? !robots.includes('noindex') : expectedIndexable.has(route) && /noindex|nofollow/.test(robots)) fail(route, 'Incorrect indexing policy.');
  const idList = $('[id]').toArray().map(node => $(node).attr('id'));
  if (new Set(idList).size !== idList.length) fail(route, 'Duplicate HTML IDs.');
  if (!ids.has('main')) fail(route, 'Skip link target #main is missing.');
  const bodyText = normalize($('main').text());
  if ($('.sources, #sources-heading, .disclosure').length || /出典|確認日|公式情報確認|無償(?:の)?送客|広告収入|紹介報酬|つばさ公益社との関係/.test(normalize($('body').text()))) fail(route, 'Removed source/disclosure copy remains in the public page.');
  if (route.startsWith('/guides/') && articleBySlug.has(route.split('/')[2]) || route.startsWith('/regions/') && regionBySlug.has(route.split('/')[2])) {
    if ($('[data-provider-link]').length !== 1 || $('.referral [data-provider-link]').length !== 1) fail(route, 'Guide/region must have only one provider link in its end note.');
    if (!$('.article-body').children().last().hasClass('referral')) fail(route, 'Provider note must appear at the end of the article.');
    if ($('.article-head [data-provider-link]').length || $('.referral h2, .referral .eyebrow').length) fail(route, 'Prominent provider promotion remains.');
    if (/つばさ|公益社/.test(normalize($('.article-head, .prose-section, .faq, .answer, .region-focus').text()))) fail(route, 'Provider name is woven into the editorial body.');
  }
  if (/\b(?:TODO|TBD|Lorem ipsum)\b|ここに(?:本文|文章|記事)を(?:入力|挿入)/i.test(bodyText)) fail(route, 'Unfinished placeholder text is visible.');
  for (const node of $('a[href],area[href],svg a[href],link[href],script[src],img[src],source[src],form[action]').toArray()) {
    const element = $(node);
    const raw = element.attr('href') ?? element.attr('src') ?? element.attr('action');
    if (!raw || /^(mailto:|tel:|data:)/i.test(raw)) continue;
    // Astro's error document is emitted as 404.html but owns the virtual /404/ URL.
    if (route === '/404.html' && element.attr('rel') === 'canonical') continue;
    let url;
    try { url = new URL(raw, canonical); } catch { fail(route, `Invalid URL: ${raw}`); continue; }
    if (url.username || url.password || hasCredentialParameter(url)) { fail(route, 'Credential-like information appears in a public URL.'); continue; }
    if (['javascript:', 'http:'].includes(url.protocol)) fail(route, `Unsafe/non-HTTPS URL: ${raw}`);
    if (!['http:', 'https:'].includes(url.protocol)) continue;
    if (url.origin === origin) {
      const file = raw.startsWith('#') ? pages.get(route).file : resolveFile(url.pathname);
      if (!file) fail(route, `Broken internal URL: ${raw}`);
      if (url.hash && file?.endsWith('.html')) {
        const destination = pages.get(routeOf(file));
        let id; try { id = decodeURIComponent(url.hash.slice(1)); } catch { id = ''; }
        if (id && !destination?.ids.has(id)) fail(route, `Broken fragment: ${raw}`);
      }
    } else if (node.name === 'a' || node.name === 'area') {
      outbound.add(url.origin + url.pathname + url.search);
      if (prohibitedHosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host))) fail(route, `Competing funeral/cemetery introduction is linked: ${url.hostname}`);
      if (providerHosts.has(url.hostname)) {
        if (element.attr('data-provider-link') === undefined) fail(route, `Unmeasured Tsubasa link: ${raw}`);
        if (!element.attr('data-placement') || !element.attr('data-intent')) fail(route, `Tsubasa link lacks placement/intent metadata: ${raw}`);
      } else if (element.attr('data-provider-link') !== undefined) fail(route, `Provider tracking is attached to a non-Tsubasa URL: ${raw}`);
      else if (!sourceURLs.has(url.origin + url.pathname) && !privacyURLs.has(url.origin + url.pathname)) fail(route, `External link is not a verified source or privacy resource: ${raw}`);
    }
  }
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage && !resolveFile(new URL(ogImage).pathname)) fail(route, 'Open Graph image does not exist.');
  let data = [];
  for (const node of $('script[type="application/ld+json"]').toArray()) {
    try { data.push(...schemas(JSON.parse($(node).text()))); } catch { fail(route, 'Invalid JSON-LD.'); }
  }
  if (!data.some(s => s?.['@type'] === 'WebSite' && s.url === origin && s.inLanguage === 'ja')) fail(route, 'WebSite JSON-LD is missing or inconsistent.');
  const breadcrumbs = data.filter(s => s?.['@type'] === 'BreadcrumbList');
  const visibleCrumbs = $('.breadcrumbs li').toArray().map(node => normalize($(node).text()));
  if (visibleCrumbs.length) {
    const crumbs = breadcrumbs[0]?.itemListElement || [];
    if (breadcrumbs.length !== 1 || crumbs.length !== visibleCrumbs.length) fail(route, 'Breadcrumb JSON-LD count differs from visible breadcrumbs.');
    crumbs.forEach((crumb, index) => {
      if (crumb.position !== index + 1 || normalize(crumb.name) !== visibleCrumbs[index]) fail(route, 'Breadcrumb name/position differs from visible navigation.');
      if (!crumb.item?.startsWith(origin) || !resolveFile(new URL(crumb.item, origin).pathname)) fail(route, 'Breadcrumb URL does not resolve.');
    });
  }
  const slug = route.match(/^\/guides\/([^/]+)\/$/)?.[1];
  const article = articleBySlug.get(slug);
  if (article) {
    const articleSchema = data.filter(s => s?.['@type'] === 'Article');
    if (articleSchema.length !== 1) fail(route, 'One Article schema is required for each guide.');
    const schema = articleSchema[0] || {};
    if (normalize(schema.headline) !== normalize($('h1').text()) || schema.description !== description || schema.mainEntityOfPage !== canonical) fail(route, 'Article JSON-LD headline/description/URL differs from visible metadata.');
    if (schema.datePublished !== article.publishedAt || schema.dateModified !== article.updatedAt) fail(route, 'Article JSON-LD dates differ from content.');
    for (const section of article.sections) if (!ids.has(section.id)) fail(route, `Article section not rendered: ${section.id}`);
    const questions = $('.faq details').toArray().map(node => ({ q: normalize($(node).find('summary').text()), a: normalize($(node).find('p').text()) }));
    const faqs = data.filter(s => s?.['@type'] === 'FAQPage');
    if (article.faq.length ? faqs.length !== 1 : faqs.length !== 0) fail(route, 'FAQ schema presence differs from visible FAQs.');
    const structuredFAQs = faqs[0]?.mainEntity || [];
    if (structuredFAQs.length !== questions.length) fail(route, 'FAQ JSON-LD count differs from visible FAQs.');
    structuredFAQs.forEach((faq, index) => { if (normalize(faq.name) !== questions[index]?.q || normalize(faq.acceptedAnswer?.text) !== questions[index]?.a) fail(route, 'FAQ JSON-LD differs from the visible answer.'); });
    if (schema.citation !== undefined) fail(route, 'Removed source citations remain in public structured data.');
  }
  for (const schema of data.filter(s => s?.['@type'] === 'CollectionPage')) {
    const items = schema.mainEntity?.itemListElement || [];
    items.forEach((item, index) => {
      if (item.position !== index + 1 || !resolveFile(new URL(item.url, origin).pathname)) fail(route, 'Collection list position/URL is invalid.');
      if (!$(`a[href="${new URL(item.url, origin).pathname}"]`).toArray().some(node => normalize($(node).text()).startsWith(normalize(item.name)))) fail(route, 'Collection JSON-LD item is not visible.');
    });
  }
}

const sitemap = load(await readFile('dist/sitemap.xml', 'utf8'), { xmlMode: true });
const locations = sitemap('url > loc').toArray().map(node => sitemap(node).text());
if (new Set(locations).size !== locations.length) fail('/sitemap.xml', 'Sitemap has duplicate URLs.');
const sitemapPaths = new Set();
for (const node of sitemap('url').toArray()) {
  const location = sitemap(node).find('loc').text();
  let url; try { url = new URL(location); } catch { fail('/sitemap.xml', `Invalid sitemap URL: ${location}`); continue; }
  sitemapPaths.add(url.pathname);
  if (url.origin !== origin || !expectedIndexable.has(url.pathname) || !pages.has(url.pathname)) fail('/sitemap.xml', `Sitemap URL is not an indexable, real page: ${location}`);
  const lastmod = sitemap(node).find('lastmod').text();
  if (lastmod && !validDate(lastmod)) fail('/sitemap.xml', `Invalid/future lastmod: ${location}`);
}
for (const route of expectedIndexable) if (!sitemapPaths.has(route)) fail('/sitemap.xml', `Indexable page is missing: ${route}`);
const robots = await readFile('dist/robots.txt', 'utf8');
if (!/^User-agent: \*$/m.test(robots) || !/^Allow: \/$/m.test(robots) || !robots.includes(`Sitemap: ${origin}/sitemap.xml`) || /^Disallow: \/$/m.test(robots)) fail('/robots.txt', 'Production robots policy is incorrect.');
const llms = await readFile('dist/llms.txt', 'utf8');
for (const item of [...content.articles.map(a => `/guides/${a.slug}/`), ...content.regions.map(r => `/regions/${r.slug}/`)]) if (!llms.includes(origin + item)) fail('/llms.txt', `Discovery index is missing ${item}`);
const firebase = JSON.parse(await readFile('firebase.json', 'utf8'));
if (firebase.hosting?.public !== 'dist' || firebase.hosting?.rewrites?.some(rule => rule.destination === '/index.html')) fail('firebase.json', 'Hosting must serve static pages with a real 404, without an SPA catch-all.');
for (const slug of categorySlugs) {
  for (const suffix of ['', '/']) {
    if (!firebase.hosting.redirects?.some(rule => rule.source === `/topics/${slug}${suffix}` && rule.destination === '/guides/' && rule.type === 301)) fail('firebase.json', `Retired category URL must redirect to the article collection: ${slug}${suffix}`);
  }
}
if (JSON.parse(await readFile('.firebaserc', 'utf8')).projects?.default !== 'okurinochizu') fail('.firebaserc', 'Unexpected Firebase project.');
for (const [name, width, height] of [['og-image.png', 1200, 630], ['apple-touch-icon.png', 180, 180]]) {
  try {
    const png = await readFile('dist/' + name);
    if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height) fail(name, `PNG must be ${width}×${height}.`);
  } catch { fail(name, 'Required public image is missing or invalid.'); }
}
for (const file of files.filter(file => /\.(?:html|js|css|json|xml|txt|svg)$/.test(file))) {
  const text = await readFile(file, 'utf8');
  if (/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|"private_key"\s*:|(?:ghp|gho|github_pat)_[A-Za-z0-9_]{20,}/.test(text)) fail('/' + path.relative('dist', file), 'Credential-like material appears in the public build.');
}
const report = { checkedAt: new Date().toISOString(), fingerprint: await fingerprintDist(), status: problems.length ? 'failed' : 'passed', htmlPages: pages.size, indexablePages: expectedIndexable.size, articles: content.articles.length, regions: content.regions.length, externalURLs: outbound.size, problems, warnings };
await mkdir('.local', { recursive: true });
await writeFile('.local/build-validation.json', JSON.stringify(report, null, 2) + '\n');
for (const problem of problems) console.error(`FAIL ${problem.page}: ${problem.message}`);
for (const warning of warnings) console.warn(`NOTE ${warning.page}: ${warning.message}`);
console.log(`Build validation ${report.status}: ${report.htmlPages} HTML pages, ${report.indexablePages} indexable pages, ${report.articles} guides, ${report.regions} regions, ${report.externalURLs} external URLs.`);
if (problems.length) process.exitCode = 1;
