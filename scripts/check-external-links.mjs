import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as http from 'node:http';
import { externalURLs, fingerprintURLs } from './lib/external-urls.mjs';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
// Honor managed environment proxies, including fetch, without exposing their URLs.
// Node 24's built-in helper preserves certificate verification and NO_PROXY.
http.setGlobalProxyFromEnv?.();
const input = process.argv.indexOf('--input');
const URLs = input === -1 ? await externalURLs() : JSON.parse(await readFile(process.argv[input + 1], 'utf8'));
if (!Array.isArray(URLs) || URLs.some(url => typeof url !== 'string' || new URL(url).protocol !== 'https:')) throw new Error('Expected an array of public HTTPS URLs.');
const unique = [...new Set(URLs)].sort();
const results = [];
let selected = unique;
if (process.argv.includes('--retry-failed')) {
  const previous = JSON.parse(await readFile('.local/external-link-report.json', 'utf8'));
  if (previous.urlsFingerprint !== fingerprintURLs(unique)) throw new Error('URL set changed; run the complete link check first.');
  results.push(...previous.results.filter(row => row.ok));
  selected = previous.results.filter(row => !row.ok).map(row => row.url);
}
const safeURL = raw => { const url = new URL(raw); return url.origin + url.pathname; };
async function checkURL(raw) {
  let current = raw;
  const redirects = [];
  const start = Date.now();
  try {
    for (let hop = 0; hop < 9; hop++) {
      const url = new URL(current);
      if (url.protocol !== 'https:' || url.username || url.password || /^(localhost|127\.|0\.|\[::1\])/.test(url.hostname)) throw new Error('Refused a non-public/HTTPS redirect.');
      if ([...url.searchParams.keys()].some(key => /(?:token|secret|password|api[_-]?key|credential)/i.test(key))) throw new Error('Refused a credential-like URL parameter.');
      // GET works on official sites that reject HEAD. Stop reading after headers;
      // this validates reachability without downloading every PDF or large page.
      const response = await fetch(url, {
        method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(20000),
        headers: { 'User-Agent': 'Okurinochizu-LinkCheck/1.0 (+https://okurinochizu.jp/about/)', Accept: 'text/html,application/pdf,text/plain;q=0.9,*/*;q=0.5' },
      });
      const status = response.status;
      const location = response.headers.get('location');
      const contentType = response.headers.get('content-type') || '';
      await response.body?.cancel();
      if (status >= 300 && status < 400 && location) {
        current = new URL(location, url).toString();
        redirects.push({ status, to: safeURL(current) });
        continue;
      }
      const result = { url: raw, finalURL: safeURL(current), status, redirects, contentType, durationMs: Date.now() - start, ok: status >= 200 && status < 300 };
      if (!result.ok) result.reason = [401, 403, 429].includes(status) ? 'restricted-or-rate-limited' : 'http-error';
      return result;
    }
    throw new Error('Too many redirects.');
  } catch (error) {
    // Never print credentials, headers, raw response bodies, or environment data.
    return { url: raw, finalURL: safeURL(current), status: null, redirects, durationMs: Date.now() - start, ok: false, reason: error.name === 'TimeoutError' ? 'timeout' : 'network-or-redirect-error' };
  }
}
const hostQueues = new Map();
async function serialForHost(raw, action) {
  const host = new URL(raw).hostname;
  const previous = hostQueues.get(host) || Promise.resolve();
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  hostQueues.set(host, previous.then(() => pending));
  await previous;
  try { return await action(); } finally { release(); }
}
let next = 0;
await Promise.all(Array.from({ length: Math.min(3, selected.length) }, async () => {
  while (next < selected.length) {
    const raw = selected[next++];
    await serialForHost(raw, async () => {
      let result = await checkURL(raw);
      // A single retry is justified only for transient server failures. Access
      // restrictions and rate limits are reported without repeated requests.
      if ([408, 425, 500, 502, 503, 504].includes(result.status)) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const retry = await checkURL(raw);
        retry.retryOfStatus = result.status;
        result = retry;
      }
      results.push(result);
      console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.status ?? result.reason} ${safeURL(raw)}${result.redirects.length ? ` (${result.redirects.length} redirects)` : ''}`);
    });
  }
}));
results.sort((a, b) => a.url.localeCompare(b.url));
const failed = results.filter(row => !row.ok);
const report = { checkedAt: new Date().toISOString(), urlsFingerprint: fingerprintURLs(unique), status: failed.length ? 'failed' : 'passed', total: results.length, passed: results.length - failed.length, failed: failed.length, results };
await mkdir('.local', { recursive: true });
await writeFile('.local/external-link-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(`External links ${report.status}: ${report.passed}/${report.total} reachable. Report: .local/external-link-report.json`);
if (failed.length) process.exitCode = 1;
