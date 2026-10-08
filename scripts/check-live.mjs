import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as http from 'node:http';
import { load } from 'cheerio';

http.setGlobalProxyFromEnv?.();
const origin = process.argv[2] || 'https://okurinochizu.jp';
const base = new URL(origin);
const allowed = ['okurinochizu.jp', 'www.okurinochizu.jp', 'okurinochizu.web.app', 'okurinochizu.firebaseapp.com'];
if (base.protocol !== 'https:' || !allowed.includes(base.hostname) || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('Use the public HTTPS site origin.');
const content = JSON.parse(await readFile('src/data/content.json', 'utf8'));
const paths = ['/', '/guides/hospital-transport/', '/guides/funeral-cost/', ...content.regions.map(r => '/regions/' + r.slug + '/'), '/search/', '/privacy/', '/about/', '/robots.txt', '/sitemap.xml', '/og-image.png', '/__okurinochizu_missing__/'];
const results = [];
let next = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (next < paths.length) {
    const path = paths[next++];
    const failures = [];
    try {
      const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(25000) });
      const expected = path === '/__okurinochizu_missing__/' ? 404 : 200;
      if (response.status !== expected) failures.push(`Expected ${expected}, got ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (path.endsWith('.png')) {
        if (!response.headers.get('content-type')?.startsWith('image/png')) failures.push('Image content type missing');
        if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) failures.push('Invalid PNG response');
      } else {
        const body = bytes.toString('utf8');
        const localPath = path === '/__okurinochizu_missing__/' ? 'dist/404.html' : path.endsWith('.txt') || path.endsWith('.xml') ? 'dist' + path : 'dist' + path + 'index.html';
        if (body !== await readFile(localPath, 'utf8')) failures.push('Response differs from the verified local build');
        if (path.endsWith('/')) {
          const $ = load(body);
          if (!$('h1').text()) failures.push('Article heading missing');
          if (!$('link[rel="canonical"]').attr('href')?.startsWith('https://okurinochizu.jp/')) failures.push('Formal canonical missing');
          if (response.headers.get('x-content-type-options') !== 'nosniff') failures.push('nosniff header missing');
          if (response.headers.get('x-frame-options') !== 'DENY') failures.push('frame protection missing');
          if (!response.headers.get('content-security-policy')?.includes("frame-ancestors 'none'")) failures.push('CSP missing');
          if (!response.headers.get('cache-control')?.includes('max-age=0')) failures.push('HTML revalidation missing');
          if ((path === '/search/' || expected === 404) && !($('meta[name="robots"]').attr('content') || '').includes('noindex')) failures.push('noindex missing');
        }
      }
      results.push({ path, status: response.status, passed: !failures.length, failures });
      console.log(`${failures.length ? 'FAIL' : 'PASS'} ${response.status} ${path}${failures.length ? ' ' + failures.join('; ') : ''}`);
    } catch {
      results.push({ path, status: null, passed: false, failures: ['HTTPS request failed; check DNS, domain connection, and environment network access'] });
      console.log(`FAIL request ${path}`);
    }
  }
}));
const report = { checkedAt: new Date().toISOString(), origin: base.origin, passed: results.every(r => r.passed), total: results.length, results: results.sort((a,b) => a.path.localeCompare(b.path)) };
await mkdir('.local', { recursive: true });
await writeFile('.local/live-' + base.hostname + '.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Live verification ${report.passed ? 'passed' : 'failed'}: ${results.filter(r => r.passed).length}/${results.length}.`);
if (!report.passed) process.exitCode = 1;
