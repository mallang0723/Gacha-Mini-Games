import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, source } from './dom.mjs';

// Test the documented public selector contract without importing remote-control code.
const hostId = 'gacha_minigames_me', launcherId = 'gacha-minigames-launcher';
const savedSelector = `#${hostId} >>> #${launcherId}`;
function resolveSaved(document) {
  const [hostSelector, buttonSelector] = savedSelector.split(' >>> ');
  const hosts = document.querySelectorAll(hostSelector);
  assert.equal(hosts.length, 1);
  assert.equal(hosts[0].shadowRoot.mode, 'open');
  const matches = hosts[0].shadowRoot.querySelectorAll(buttonSelector);
  assert.equal(matches.length, 1);
  return matches[0];
}
const feature = (name, run) => test(name, async () => {
  const h = await setup();
  try { await run(h); assert.deepEqual(h.errors, []); } finally { h.close(); }
});

feature('리모콘: 고정 host/launcher id와 testid, 열린 shadow 및 선택 가능 상태', h => {
  const launcher = resolveSaved(h.d);
  assert.equal(launcher.dataset.testid, launcherId);
  assert.equal(h.d.getElementById(hostId).dataset.testid, hostId);
  assert.equal(h.root.querySelectorAll(`[data-testid="${launcherId}"]`).length, 1);
  assert.equal(launcher.localName, 'button');
  assert.equal(launcher.disabled, false);
  assert.equal(launcher.closest('[hidden],[inert],[aria-hidden="true"]'), null);
  assert.equal(h.d.getElementById(hostId).closest('[hidden],[inert],[aria-hidden="true"]'), null);
  assert.notEqual(h.w.getComputedStyle(launcher).visibility, 'hidden');
});

feature('리모콘: pointer 이벤트 없이 저장된 선택자의 click()만으로 반복 토글', h => {
  const panel = h.root.getElementById('panel');
  for (const expanded of [true, false, true, false]) {
    resolveSaved(h.d).click();
    assert.equal(panel.hidden, !expanded);
    assert.equal(resolveSaved(h.d).getAttribute('aria-expanded'), String(expanded));
  }
});

feature('리모콘: 드래그 직후 click 억제, 다음 원격 click 정상 처리', async h => {
  h.pointer('pointerdown', 400); h.pointer('pointermove', 100); h.pointer('pointerup', 100);
  resolveSaved(h.d).click();
  assert.equal(h.root.getElementById('panel').hidden, true);
  await h.advance(1);
  resolveSaved(h.d).click();
  assert.equal(h.root.getElementById('panel').hidden, false);
});

feature('리모콘: 드래그/취소가 click을 만들지 않아도 이후 원격 click은 삼키지 않음', async h => {
  for (const ending of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    h.pointer('pointerdown', 400); h.pointer('pointermove', 100); h.pointer(ending, 100);
    await h.advance(1);
    resolveSaved(h.d).click();
    assert.equal(h.root.getElementById('panel').hidden, false, ending);
    resolveSaved(h.d).click();
  }
});

for (const hiding of ['class', 'style']) {
  feature(`리모콘: 외부 숨김 ${hiding} 유지, 버튼 배치 조회 없이 숨김 상태 토글`, async h => {
    const launcher = resolveSaved(h.d), panel = h.root.getElementById('panel');
    const css = h.d.createElement('style');
    css.textContent = '.remote-hidden { display:none !important; }'; h.root.append(css);
    launcher.classList.add('remote-owned', 'remote-hidden');
    if (hiding === 'style') launcher.style.setProperty('display', 'none', 'important');
    // jsdom does not lay out Shadow DOM; real class-based visibility is checked in browser QA.
    launcher.getBoundingClientRect = launcher.getClientRects = () => { throw new Error('Launcher geometry must not position the panel'); };
    const classes = launcher.getAttribute('class');
    h.w.innerHeight = 460; h.w.dispatchEvent(new h.w.Event('resize'));
    h.keyboard(launcher, 'ArrowUp'); h.keyboard(launcher, 'Home');
    await h.advance(1000); // Includes the periodic theme update.
    launcher.click(); assert.equal(panel.hidden, false);
    h.root.getElementById('reset-position').click();
    launcher.click(); assert.equal(panel.hidden, true);
    assert.equal(launcher.getAttribute('class'), classes);
    if (hiding === 'style') {
      assert.equal(launcher.style.display, 'none');
      assert.equal(launcher.style.getPropertyPriority('display'), 'important');
    }
  });
}

feature('리모콘: 재주입/cleanup 후 재마운트에도 저장된 선택자 일치 1개', async h => {
  for (const cleanup of [false, true, false]) {
    const previous = resolveSaved(h.d);
    if (cleanup) h.cleanup();
    h.w.eval(source); await h.flush();
    const next = resolveSaved(h.d);
    assert.equal(previous.isConnected, false);
    assert.equal(next.dataset.testid, launcherId);
    previous.click();
    assert.equal(next.getRootNode().getElementById('panel').hidden, true);
    next.click();
    assert.equal(next.getRootNode().getElementById('panel').hidden, false);
    assert.equal(h.subscriptions.size, 1);
  }
});

feature('리모콘: 새 문서로 새로고침해도 같은 선택자 사용', async h => {
  const fresh = await setup();
  try {
    assert.equal(resolveSaved(h.d).id, resolveSaved(fresh.d).id);
    resolveSaved(fresh.d).click();
    assert.equal(fresh.root.getElementById('panel').hidden, false);
  } finally { fresh.close(); }
});
