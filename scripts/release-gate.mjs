import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fingerprintDist } from './lib/build-fingerprint.mjs';
import { externalURLs, fingerprintURLs } from './lib/external-urls.mjs';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const problems = [];
async function report(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch { problems.push(`Missing verification report: ${file}`); return null; }
}
const fingerprint = await fingerprintDist();
const build = await report('.local/build-validation.json');
const links = await report('.local/external-link-report.json');
const browser = await report('.local/playwright-report.json');
if (build && (build.status !== 'passed' || build.fingerprint !== fingerprint)) problems.push('Build validation failed or belongs to a different build. Run npm run build.');
if (links && (links.status !== 'passed' || links.urlsFingerprint !== fingerprintURLs(await externalURLs()))) problems.push('External links have not all passed for the current URL set. Run npm run validate:links.');
if (links && Date.now() - Date.parse(links.checkedAt) > 7 * 86400000) problems.push('External-link verification is over seven days old. Run npm run validate:links.');
if (browser) {
  if (browser.config?.metadata?.buildFingerprint !== fingerprint) problems.push('Browser tests belong to a different build. Run npm test against the current dist.');
  if (!browser.stats?.expected || browser.stats.unexpected || browser.stats.flaky || browser.stats.skipped || browser.errors?.length) problems.push('Browser tests have failures, skips, retries, errors, or no passing tests. Run npm test.');
}
const home = await readFile('dist/index.html', 'utf8');
if (!/data-measurement-id="G-YH2YL4ZMCH"/.test(home)) problems.push('The published build does not contain the user-provided GA4 measurement ID.');
if (!process.env.FIREBASE_TOKEN?.trim()) problems.push('FIREBASE_TOKEN is not bound in this environment. Add the user-provided token as an environment secret; do not place it in source files.');
if (problems.length) {
  for (const message of problems) console.error(`BLOCKED: ${message}`);
  process.exitCode = 1;
} else console.log('Release gate passed: current build, external URLs, browser checks, GA4 ID and Firebase token binding verified.');
