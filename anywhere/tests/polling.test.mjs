import test from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './dom.mjs';
const feature = (name, options, run) => test(name, async () => { const h = await setup(options); try { await run(h); assert.deepEqual(h.errors, []); } finally { h.close(); } });
feature('스토어 없으면 marinara.fetch GET 상태만 1초마다 폴링, 시작/완료 감지', { noStore: true, fetch: async () => ({ ok: true, json: async () => ({ active: true }) }) }, async h => {
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].url, '/api/generate/status/chat-one'); assert.equal(h.calls[0].init.method, 'GET');
  await h.advance(2499); assert.equal(h.calls.length, 3); assert.ok(h.root.getElementById('panel').hidden);
  await h.advance(1); assert.ok(!h.root.getElementById('panel').hidden);
  h.w.marinara.fetch = async () => ({ ok: true, json: async () => ({ active: false }) });
  await h.advance(500); assert.ok(!h.root.getElementById('toast').hidden); assert.equal(h.w.fetch, h.fetchOriginal);
});
feature('스토어가 늦게 생기면 폴링을 중단하고 구독으로 전환', { noStore: true }, async h => {
  h.w.__MARINARA_HOST__ = { stores: { chat: h.store } }; await h.advance(1000);
  assert.equal(h.subscriptions.size, 1); assert.equal(h.calls.length, 1);
  h.update({ isStreaming: true, streamingChatId: 'chat-one' }); await h.advance(2500); assert.ok(!h.root.getElementById('panel').hidden);
});
feature('구독 없는 스토어의 activeChatId 우선, URI 인코딩', { noStore: true, before(w) {
  w.__MARINARA_HOST__ = { stores: { chat: { getState: () => ({ activeChatId: '한글/a?b' }) } } };
} }, h => assert.equal(h.calls[0].url, '/api/generate/status/' + encodeURIComponent('한글/a?b')));
feature('URL 경로 및 hash 경로의 채팅 ID', { noStore: true, url: 'http://test.invalid/#/chats/hash-chat' }, h => {
  assert.equal(h.calls[0].url, '/api/generate/status/hash-chat');
});
feature('활성 채팅 ID가 없으면 폴링하지 않음', { noStore: true, url: 'http://test.invalid/' }, async h => {
  await h.advance(3000); assert.equal(h.calls.length, 0); assert.ok(h.root.getElementById('panel').hidden);
});
feature('채팅 이동은 이전 자동 열기 취소, 이전 요청의 응답 무시', { noStore: true, fetch: () => new Promise(() => {}) }, async h => {
  const first = h.calls[0]; h.w.history.replaceState({}, '', '/chat/chat-two'); await h.advance(1000);
  assert.ok(first.init.signal.aborted); assert.equal(h.calls[1].url, '/api/generate/status/chat-two');
  h.cleanup(); assert.ok(h.calls[1].init.signal.aborted); assert.equal(h.pending.size, 0);
});
feature('폴링 오류는 완료로 오인하지 않으며 후속 성공으로 복구', { noStore: true, fetch: async () => ({ ok: true, json: async () => ({ active: true }) }) }, async h => {
  h.w.marinara.fetch = async () => { throw new Error('offline'); }; await h.advance(3000);
  assert.ok(!h.root.getElementById('panel').hidden); assert.ok(h.root.getElementById('toast').hidden);
  h.w.marinara.fetch = async () => ({ ok: true, json: async () => ({ active: false }) }); await h.advance(1000);
  assert.ok(!h.root.getElementById('toast').hidden);
});
feature('정지된 요청 중첩 방지, 5초 타임아웃, cleanup abort', { noStore: true, fetch: (_url, init) => new Promise((_resolve, reject) => {
  init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
}) }, async h => {
  await h.advance(4999); assert.equal(h.calls.length, 1); await h.advance(1001); assert.ok(h.calls[0].init.signal.aborted); assert.ok(h.calls.length >= 2);
  h.cleanup(); assert.equal(h.pending.size, 0); assert.ok(h.calls.at(-1).init.signal.aborted);
});
feature('cleanup 뒤 도착하는 요청은 UI를 다시 만들지 않음', { noStore: true, before(w) { w.resolveStatus = null; }, fetch: null }, async h => {
  let resolve; h.w.marinara.fetch = () => new Promise(r => { resolve = r; }); await h.advance(1000); h.cleanup();
  resolve({ ok: true, json: async () => ({ active: true }) }); await h.flush(); await h.advance(5000);
  assert.equal(h.d.getElementById('gacha_minigames_me'), null); assert.equal(h.pending.size, 0);
});
