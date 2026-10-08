import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export async function listFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await listFiles(file));
    else if (entry.isFile()) result.push(file);
  }
  return result.sort();
}

/** Bind a verification report to every byte that will be deployed. */
export async function fingerprintDist(directory = 'dist') {
  const hash = createHash('sha256');
  for (const file of await listFiles(directory)) {
    const name = path.relative(directory, file).split(path.sep).join('/');
    hash.update(name).update('\0').update(await readFile(file)).update('\0');
  }
  return hash.digest('hex');
}
