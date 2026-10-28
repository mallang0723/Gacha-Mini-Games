import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { root } from '../scripts/verify-original.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
test('루트 원본 및 BRIEF 여섯 파일의 기록된 해시를 모두 대조한다', () => {
  const records = readFileSync(resolve(root, 'qa/root-files.sha256'), 'utf8').trim().split('\n');
  assert.equal(records.length, 6);
  for (const record of records) {
    const [, expected, file] = record.match(/^(\S+)\s+(.+)$/);
    assert.equal(sha(readFileSync(resolve(root, '..', file))), expected, file);
  }
});
test('ZIP 루트의 네 파일 내용·해시와 결정적 재빌드를 검증한다', () => {
  const buildZip = () => {
    const result = spawnSync(process.execPath, [resolve(root, 'scripts/package.mjs')], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return readFileSync(resolve(root, 'gacha_minigames_me.personal-extension.zip'));
  };
  const zip = buildZip(), files = new Map();
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(zip.readUInt16LE(offset + 8), 8);
    const size = zip.readUInt32LE(offset + 18), nameSize = zip.readUInt16LE(offset + 26), extraSize = zip.readUInt16LE(offset + 28);
    const name = zip.subarray(offset + 30, offset + 30 + nameSize).toString('utf8');
    const start = offset + 30 + nameSize + extraSize;
    files.set(name, inflateRawSync(zip.subarray(start, start + size))); offset = start + size;
  }
  assert.deepEqual([...files.keys()], ['manifest.json', 'extension.js', 'README.md', 'NOTICE']);
  const report = JSON.parse(readFileSync(resolve(root, 'qa/package.json')));
  assert.equal(sha(zip), report.sha256);
  for (const [name, data] of files) {
    const path = ['manifest.json', 'extension.js'].includes(name) ? `dist/${name}` : name;
    assert.deepEqual(data, readFileSync(resolve(root, path))); assert.equal(sha(data), report.files[name]);
  }
  for (const name of ['README.md', 'NOTICE']) {
    assert.match(files.get(name).toString(), /lemonpie601/);
    assert.match(files.get(name).toString(), /https:\/\/github.com\/lemonpie601\/Gacha-Mini-Games/);
  }
  assert.deepEqual(buildZip(), zip);
});
