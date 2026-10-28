import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, source, upstream } from './dom.mjs';
const closed = h => h.root.getElementById('panel').hidden;
const launch = h => h.root.getElementById('launcher').click();
const start = h => h.update({ isStreaming: true, streamingChatId: 'chat-one' });
const stop = h => h.update({ isStreaming: false, streamingChatId: null });
const feature = (name, options, run) => test(name, async () => { const h = await setup(options); try { await run(h); assert.deepEqual(h.errors, []); } finally { h.close(); } });
feature('버튼 하나 생성, 수동 열기/닫기, HTTP 및 crypto 없음', {}, h => {
  assert.equal(h.d.querySelectorAll('#gacha_minigames_me').length, 1); assert.ok(closed(h));
  launch(h); assert.ok(!closed(h)); assert.equal(h.games().querySelectorAll('.gfx-game-tab').length, 12);
  h.root.getElementById('close').click(); assert.ok(closed(h));
});
feature('세로 드래그 상하 클램프, 수평 위치 유지, 저장과 클릭 억제', {}, h => {
  const button = h.root.getElementById('launcher');
  h.pointer('pointerdown', 400); h.pointer('pointermove', -400, 0); h.pointer('pointerup', -400); button.click();
  assert.equal(button.style.top, '12px'); assert.ok(closed(h)); assert.equal(button.style.left, '');
  h.pointer('pointerdown', 12); h.pointer('pointermove', 2000, 0); h.pointer('pointerup', 2000); button.click();
  assert.equal(button.style.top, '580px'); assert.equal(JSON.parse(h.w.localStorage.getItem('gacha_minigames_me.position')), 580);
});
feature('길게 누르기 초기화, pointercancel, 작은 높이와 리사이즈', { position: 20 }, async h => {
  h.pointer('pointerdown', 20); await h.advance(700); h.pointer('pointerup', 20); launch(h);
  assert.equal(h.root.getElementById('launcher').style.top, '384px'); assert.ok(closed(h));
  h.pointer('pointerdown', 384); h.pointer('pointercancel', 384); await h.advance(800); launch(h); assert.ok(closed(h));
  h.w.innerHeight = 100; h.w.dispatchEvent(new h.w.Event('resize')); assert.equal(h.root.getElementById('launcher').style.top, '40px');
});
feature('스토어 시작 → 2499ms 닫힘 → 2500ms 열림 → 끝 토스트/선택', {}, async h => {
  const editor = h.d.getElementById('chat'); editor.focus(); start(h);
  await h.advance(2499); assert.ok(closed(h)); await h.advance(1); assert.ok(!closed(h));
  assert.equal(h.d.activeElement, editor); stop(h);
  assert.equal(h.root.getElementById('toast').textContent, '응답 도착'); assert.ok(!h.root.getElementById('toast').hidden);
  assert.ok(!closed(h)); assert.ok(!h.root.getElementById('arrival').hidden);
  h.root.getElementById('continue').click(); assert.ok(h.root.getElementById('arrival').hidden);
  assert.equal(h.calls.length, 0); assert.equal(h.w.fetch, h.fetchOriginal);
});
feature('짧은 생성은 열지 않으며 새 생성은 새 2.5초를 기다림', {}, async h => {
  start(h); await h.advance(2000); stop(h); await h.advance(1000); assert.ok(closed(h));
  start(h); await h.advance(2499); assert.ok(closed(h)); await h.advance(1); assert.ok(!closed(h));
});
feature('자동 열기 끔, 자동 닫기 켬, 설정 저장', { settings: { autoOpen: false, autoClose: true } }, async h => {
  start(h); await h.advance(3000); assert.ok(closed(h)); launch(h); stop(h); assert.ok(closed(h));
  launch(h); const checkbox = h.root.getElementById('autoOpen'); checkbox.checked = true; checkbox.dispatchEvent(new h.w.Event('change'));
  assert.equal(JSON.parse(h.w.localStorage.getItem('gacha_minigames_me.settings')).autoOpen, true);
});
feature('저장소 접근 거절에도 기본 설정과 위치/설정 변경 가능', { storageBlocked: true }, async h => {
  launch(h); h.root.getElementById('reset-position').click();
  const checkbox = h.root.getElementById('autoClose'); checkbox.checked = true; checkbox.dispatchEvent(new h.w.Event('change'));
  start(h); await h.advance(2500); stop(h); assert.ok(closed(h));
});
feature('키 입력은 포커스된 게임만 처리, 채팅/input/contenteditable은 보호', {}, h => {
  launch(h); h.games().querySelector('[data-game=merge]').click(); const board = h.games().querySelector('.gfx-game-board');
  board.focus(); assert.ok(h.keyboard(board, 'ArrowLeft').defaultPrevented);
  const editor = h.d.getElementById('chat'); editor.focus();
  assert.ok(!h.keyboard(editor, 'ArrowLeft').defaultPrevented); assert.ok(!h.keyboard(board, 'ArrowLeft').defaultPrevented);
  for (const tag of ['input', 'textarea', 'div']) {
    const field = h.d.createElement(tag); if (tag === 'div') { field.contentEditable = 'true'; field.setAttribute('contenteditable', 'true'); field.tabIndex = 0; }
    board.append(field); field.focus(); assert.ok(!h.keyboard(field, 'ArrowRight').defaultPrevented); field.remove();
  }
  board.focus(); h.keyboard(board, 'Escape'); assert.ok(closed(h));
});
feature('12개 원본 게임 선택 및 닫기/다시 열기', {}, async h => {
  launch(h);
  for (const tab of h.games().querySelectorAll('.gfx-game-tab')) {
    tab.click(); assert.ok(h.games().querySelector('.gfx-game-board'), tab.dataset.game); await h.advance(20);
  }
  h.root.getElementById('close').click(); launch(h); assert.ok(h.games().querySelector('.gfx-game-board'));
});
feature('테마 프리셋과 색을 따르며 테마 제거 시 기본으로 복귀', { before(w) {
  const theme = w.document.createElement('div'); theme.id = 'theme'; theme.setAttribute('data-gfx-preset', 'night'); theme.style.setProperty('--gfx-accent', '#123456'); w.document.body.append(theme);
} }, async h => {
  launch(h); assert.equal(h.games().querySelector('.gfx-load-games').dataset.theme, 'night');
  assert.equal(h.d.getElementById('gacha_minigames_me').style.getPropertyValue('--gfx-accent'), '#123456');
  h.d.getElementById('theme').remove(); await h.advance(1000); assert.equal(h.games().querySelector('.gfx-load-games').dataset.theme, 'cream');
});
feature('외부 SD URL 제외, 이미 메모리에 있는 이미지만 사용', { before(w) {
  w.__GFX_SD_FACES = () => ['https://external.invalid/sprite.png', '//external.invalid/a.png', '/api/image.png', 'data:image/png;base64,AAAA'];
} }, h => {
  launch(h); h.games().querySelector('[data-game=memory]').click();
  const images = [...h.games().querySelectorAll('img')]; assert.ok(images.length > 0); assert.ok(images.every(img => img.src.startsWith('data:image/png;')));
});
feature('중복 주입은 이전 인스턴스와 구독 정리 후 하나만 생성', {}, h => {
  h.w.eval(source); assert.equal(h.d.querySelectorAll('#gacha_minigames_me').length, 1); assert.equal(h.subscriptions.size, 1);
});
feature('cleanup은 타이머/프레임/리스너/구독/DOM 모두 해제하며 재호출 안전', {}, async h => {
  launch(h); h.games().querySelector('[data-game=pinball]').click(); start(h); h.pointer('pointerdown', 400);
  const button = h.root.getElementById('launcher'); h.cleanup(); h.cleanup();
  assert.equal(h.pending.size, 0); assert.equal(h.subscriptions.size, 0); assert.equal(h.d.getElementById('gacha_minigames_me'), null);
  button.click(); h.pointer('pointermove', 20); start(h); await h.advance(10000); assert.equal(h.pending.size, 0);
  assert.equal(h.w.gacha_minigames_me, undefined); assert.equal(h.w.__GF_MINIGAMES_EXTENSION, undefined);
});
function forge(w) {
  const h = w.document.createElement('marinara-capability-gacha-forge'); h._boot = 'ready'; h._hudView = 'forge'; h._chapterWritten = () => false;
  const root = h.attachShadow({ mode: 'open' }); const center = w.document.createElement('div'); center.className = 'forge-center'; center.textContent = 'Generating story…'; center.style.position = 'static'; center.getClientRects = () => [1]; root.append(center); w.document.body.append(h);
}
feature('원본 없이 Forge 생성 지연/마운트/센터 교체/완료 해제', { before: forge }, async h => {
  const forgeHost = h.d.querySelector('marinara-capability-gacha-forge'), root = forgeHost.shadowRoot;
  await h.advance(2400); assert.equal(root.querySelector('[data-gfx-minigames]'), null);
  await h.advance(200); const wrap = root.querySelector('[data-gfx-minigames]'); assert.ok(wrap);
  const old = root.querySelector('.forge-center'); const next = h.d.createElement('div'); next.className = 'forge-center'; next.textContent = 'Generating story…'; next.getClientRects = () => [1]; old.replaceWith(next);
  await h.advance(200); assert.equal(next.querySelector('[data-gfx-minigames]'), wrap); assert.equal(old.style.position, 'static');
  next.firstChild.textContent = 'Finished'; await h.advance(200); assert.equal(next.querySelector('[data-gfx-minigames]'), null);
});
feature('Forge 부팅과 이미 작성된 챕터는 마운트하지 않음', { before: forge }, async h => {
  const f = h.d.querySelector('marinara-capability-gacha-forge'); f._boot = 'loading'; await h.advance(4000); assert.equal(f.shadowRoot.querySelector('[data-gfx-minigames]'), null);
  f._boot = 'ready'; f._chapterWritten = () => true; await h.advance(4000); assert.equal(f.shadowRoot.querySelector('[data-gfx-minigames]'), null);
});
feature('원본이 나중에 설치되어도 어디서나는 유지, Forge 소유권은 하나', { before: forge }, async h => {
  await h.advance(2600); h.w.eval(upstream); await h.advance(2800);
  assert.ok(h.d.getElementById('gacha_minigames_me')); assert.equal(h.d.querySelector('marinara-capability-gacha-forge').shadowRoot.querySelectorAll('[data-gfx-minigames]').length, 1);
  launch(h); assert.ok(!closed(h)); h.w.__GF_MINIGAMES_EXTENSION();
});
feature('원본 먼저 설치 시 이전 정리 함수 호출 후 어디서나가 소유', { before(w) { forge(w); w.eval(upstream); } }, async h => {
  await h.advance(2800); assert.equal(h.d.querySelector('marinara-capability-gacha-forge').shadowRoot.querySelectorAll('[data-gfx-minigames]').length, 1);
});
feature('짝 맞추기 오답 대기 중 닫고 열어도 뒤집기가 막히지 않음', {}, h => {
  launch(h); h.games().querySelector('[data-game=memory]').click();
  const cards = [...h.games().querySelectorAll('.gfx-game-board > button')];
  const first = cards[0], other = cards.find(c => c.querySelector('.face').textContent !== first.querySelector('.face').textContent);
  first.click(); other.click(); h.root.getElementById('close').click(); launch(h);
  const fresh = [...h.games().querySelectorAll('.gfx-game-board > button')];
  assert.equal(fresh.filter(c => c.dataset.open === 'true').length, 0);
  fresh[0].click(); assert.equal(fresh[0].dataset.open, 'true');
});
feature('반복 닫기 뒤 쿠키 가게 재개 시 숨겨진 시간이 경과 시간에 더해지지 않음', {}, async h => {
  launch(h); h.games().querySelector('[data-game=shop]').click();
  h.games().querySelector('.gfx-shop-oven').click(); await h.advance(1000);
  h.root.getElementById('close').click(); await h.advance(5000); h.root.getElementById('close').click(); launch(h);
  const clock = [...h.games().querySelectorAll('.gfx-game-stats span')].find(s => s.textContent.startsWith('⏱'));
  assert.equal(clock.textContent, '⏱ 0:01');
});
feature('레시피 재개는 현재 순서를 다시 보여줌', {}, async h => {
  launch(h); h.games().querySelector('[data-game=recipe]').click();
  h.games().querySelector('.gfx-game-hint').click(); await h.advance(100);
  h.root.getElementById('close').click(); launch(h); await h.advance(1);
  assert.match(h.games().querySelector('.gfx-game-info').textContent, /잘 보세요/);
});
feature('자동 열기 대기 중 수동으로 닫으면 같은 생성에서 다시 열지 않음', {}, async h => {
  start(h); await h.advance(1000); launch(h); h.root.getElementById('close').click();
  await h.advance(3000); assert.ok(closed(h)); stop(h); start(h); await h.advance(2500); assert.ok(!closed(h));
});
