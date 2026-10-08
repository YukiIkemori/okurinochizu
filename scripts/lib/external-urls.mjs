import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import { listFiles } from './build-fingerprint.mjs';

export async function externalURLs(directory = 'dist') {
  const result = new Set();
  for (const file of (await listFiles(directory)).filter(file => file.endsWith('.html'))) {
    const $ = load(await readFile(file, 'utf8'));
    for (const node of $('a[href],area[href]').toArray()) {
      const raw = $(node).attr('href');
      let url; try { url = new URL(raw, 'https://okurinochizu.jp'); } catch { continue; }
      if (url.protocol !== 'https:' || url.origin === 'https://okurinochizu.jp') continue;
      url.hash = '';
      // UTM campaign variations resolve to the same public resource.
      for (const key of [...url.searchParams.keys()]) if (key.startsWith('utm_')) url.searchParams.delete(key);
      if ([...url.searchParams.keys()].some(key => /(?:token|secret|password|api[_-]?key|credential)/i.test(key))) throw new Error('Credential-like parameter in a public URL.');
      result.add(url.toString());
    }
  }
  return [...result].sort();
}

export function fingerprintURLs(urls) {
  return createHash('sha256').update([...urls].sort().join('\n')).digest('hex');
}
