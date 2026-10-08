import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const mode = process.argv[2] || '--status';
if (!['--status', '--prepare'].includes(mode)) throw new Error('Use --status or --prepare.');
if (!process.env.FIREBASE_TOKEN?.trim()) throw new Error('FIREBASE_TOKEN is required in the environment.');
const config = resolve('.local/firebase-config');
await mkdir(config, { recursive: true, mode: 0o700 });
process.env.XDG_CONFIG_HOME = config;
process.env.FIREBASE_CLI_DISABLE_UPDATE_CHECK = '1';
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
const require = createRequire(import.meta.url);
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client } = require('firebase-tools/lib/apiv2');

try {
  await requireAuth({ project: 'okurinochizu', nonInteractive: true });
  const client = new Client({ urlPrefix: 'https://firebasehosting.googleapis.com', apiVersion: 'v1beta1', auth: true });
  const parent = '/projects/okurinochizu/sites/okurinochizu/customDomains';
  const list = await client.get(parent);
  const existing = new Set((list.body.customDomains || []).map(d => d.name.split('/').pop()));
  const results = [];
  for (const domain of ['okurinochizu.jp', 'www.okurinochizu.jp']) {
    if (mode === '--prepare' && !existing.has(domain)) {
      const body = { certPreference: 'GROUPED', ...(domain.startsWith('www.') ? { redirectTarget: 'okurinochizu.jp' } : {}) };
      const operation = await client.post(parent, body, { queryParams: { customDomainId: domain } });
      console.log(`Prepared custom domain: ${domain}; operation accepted: ${Boolean(operation.body.name)}`);
    }
    try {
      const response = await client.get(parent + '/' + domain);
      const { name, hostState, ownershipState, requiredDnsUpdates, cert, redirectTarget, issues, reconciling } = response.body;
      const result = { domain, name, hostState, ownershipState, redirectTarget, certState: cert?.state, dns: requiredDnsUpdates, issues, reconciling };
      results.push(result);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      if (error.status !== 404) throw error;
      results.push({ domain, pending: true });
      console.log(`Domain pending or not registered: ${domain}`);
    }
  }
  await writeFile('.local/firebase-domain-status.json', JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2) + '\n');
} catch (error) {
  // Avoid dumping auth context, request headers, and response objects.
  console.error(`Firebase domain operation failed. HTTP status: ${error.status || 'unknown'}. Inspect the Firebase Hosting custom-domain screen.`);
  process.exitCode = 1;
}
