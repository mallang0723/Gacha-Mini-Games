import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { derive, ANCHOR } from '../scripts/build.mjs';
import { verifyOriginal } from '../scripts/verify-original.mjs';
const original = verifyOriginal();
test('원본 SHA-256 기록과 고정된 v1.3.1 해시가 일치한다', () => {
  assert.equal(createHash('sha256').update(original).digest('hex'), 'd4dd0573dc25ef233b5840631997f53c8327c769cc6fa0154805f31247ba0c76');
});
test('마운트 앵커가 없거나 중복되면 빌드를 거절한다', () => {
  assert.throws(() => derive(original.replace(ANCHOR, 'changed')), /exactly once/);
  assert.throws(() => derive(original + ANCHOR), /exactly once/);
});
test('파생 패치도 1회만 적용하며 빌드 결과는 재현 가능하다', () => {
  const output = derive(original);
  assert.equal(output.patches.length, 10);
  assert.equal(output.source, readFileSync(new URL('../dist/extension.js', import.meta.url), 'utf8'));
  assert.throws(() => derive(original.replace('    return panel;\n  }', '')), /expected 1 anchor/);
  new Script(output.source);
});
test('개인 확장 매니페스트와 키, 시스템 폰트, 상태 확인 전용 경로', () => {
  const manifest = JSON.parse(readFileSync(new URL('../dist/manifest.json', import.meta.url)));
  assert.equal(manifest.kind, 'marinara.personal-extension');
  assert.equal(manifest.config.version, '0.2.0');
  assert.equal(JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version, '0.2.0');
  assert.equal(manifest.config.runtime, 'client');
  assert.deepEqual(manifest.config.capabilities, ['full_page_access']);
  assert.match(manifest.config.description, /gacha_minigames_me/);
  const source = derive(original).source;
  assert.doesNotMatch(source, /fonts\.googleapis|fonts\.gstatic|crypto\.randomUUID|(?:window|globalThis)\.fetch\s*=/);
  assert.match(source, /MARINARA\.fetch\(`\/api\/generate\/status\//);
});
