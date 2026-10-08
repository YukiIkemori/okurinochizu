import { chmodSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Keep the requested Firebase token in the environment, never in command arguments.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requestedMode = process.argv[2] ?? '--deploy';
const modes = new Map([
  ['--check-auth', ['projects:list', '--non-interactive']],
  ['--check-hosting', ['hosting:sites:list', '--project', 'okurinochizu', '--non-interactive']],
  ['--deploy', ['deploy', '--only', 'hosting', '--project', 'okurinochizu', '--non-interactive']],
]);

if (process.argv.length > 3 || !modes.has(requestedMode)) {
  console.error('Usage: node scripts/deploy.mjs [--check-auth|--check-hosting|--deploy]');
  process.exit(2);
}

const token = process.env.FIREBASE_TOKEN;
if (!token?.trim()) {
  console.error('FIREBASE_TOKEN is not available in this process. Add the Firebase token as the FIREBASE_TOKEN secret in environment settings, save/publish the environment, and apply it to this runtime. Do not put the token in source files or chat.');
  process.exit(1);
}

const configDirectory = resolve(root, '.local', 'firebase-config');
mkdirSync(configDirectory, { recursive: true, mode: 0o700 });
chmodSync(configDirectory, 0o700);
const environment = {
  ...process.env,
  XDG_CONFIG_HOME: configDirectory,
  FIREBASE_CLI_DISABLE_UPDATE_CHECK: '1',
  ASTRO_TELEMETRY_DISABLED: '1',
};
// A previously supplied, empty service-account file must not override token auth.
delete environment.GOOGLE_APPLICATION_CREDENTIALS;

const result = spawnSync(process.execPath, [
  resolve(root, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js'),
  ...modes.get(requestedMode),
], {
  cwd: root,
  env: environment,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  timeout: 15 * 60 * 1000,
  maxBuffer: 16 * 1024 * 1024,
});

const redact = (output = '') => output
  .split(token).join('[REDACTED]')
  .replace(/(Bearer\s+)[\w.\-~+/=]+/gi, '$1[REDACTED]')
  .replace(/((?:refresh_token|access_token|id_token)["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, '$1[REDACTED]');

if (result.stdout) process.stdout.write(redact(result.stdout));
if (result.stderr) process.stderr.write(redact(result.stderr));
if (result.error) {
  console.error(`Firebase command did not finish: ${redact(result.error.message)}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
