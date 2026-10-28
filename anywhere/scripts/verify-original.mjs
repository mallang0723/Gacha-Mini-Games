import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export const root = fileURLToPath(new URL('../', import.meta.url));
export function verifyOriginal() {
  const source = readFileSync(resolve(root, '../extension.js'));
  const expected = readFileSync(resolve(root, 'ORIGINAL.sha256'), 'utf8').trim().split(/\s+/)[0];
  const actual = createHash('sha256').update(source).digest('hex');
  if (actual !== expected) throw new Error(`원본 SHA-256 불일치: ${actual}`);
  return source.toString('utf8');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyOriginal(); console.log('원본 extension.js SHA-256 일치');
}
