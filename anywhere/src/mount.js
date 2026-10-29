  const SETTINGS_KEY = `${APP_KEY}.settings`, POSITION_KEY = `${APP_KEY}.position`;
  const readLocal = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const writeLocal = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const saved = readLocal(SETTINGS_KEY);
  const settings = { autoOpen: saved?.autoOpen !== false, autoClose: saved?.autoClose === true };
  // Stable open-shadow host lets remote controls persist a selector across reloads.
  const host = el('div'); host.id = APP_KEY; host.dataset.testid = APP_KEY;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = el('style'); style.textContent = ADAPTER_CSS; shadow.append(style);
  const makeButton = (text, action, id) => {
    const button = el('button', '', text); button.type = 'button'; if (id) button.id = id;
    on(button, 'click', action); return button;
  };
  const launcher = makeButton('🎮', () => {
    if (suppressClick) { suppressClick = false; return; }
    panel.hidden ? openPanel(true) : closePanel();
  }, 'gacha-minigames-launcher');
  launcher.dataset.testid = 'gacha-minigames-launcher';
  launcher.title = '미니게임 열기 · 위아래로 이동 · 길게 눌러 위치 초기화';
  launcher.setAttribute('aria-label', launcher.title);
  launcher.setAttribute('aria-controls', 'panel'); launcher.setAttribute('aria-expanded', 'false');
  const panel = el('section'); panel.id = 'panel'; panel.hidden = true; panel.tabIndex = -1;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', '어디서나 미니게임');
  // Nonmodal by design: automatic opening must not steal the chat editor's focus.
  panel.setAttribute('aria-modal', 'false');
  const header = el('header'); header.append(el('strong', '', '🎮 어디서나 미니게임'));
  const close = makeButton('닫기', () => closePanel(), 'close'); header.append(close);
  const options = el('details'); options.id = 'settings';
  const summary = el('summary', '', '설정'); options.append(summary);
  function checkbox(key, label) {
    const row = el('label'), input = el('input'); input.type = 'checkbox'; input.id = key; input.checked = settings[key];
    on(input, 'change', () => {
      settings[key] = input.checked; writeLocal(SETTINGS_KEY, settings);
      if (key === 'autoOpen') { cancelOpening(); if (settings.autoOpen && streamingId) scheduleOpening(); }
    });
    row.append(input, el('span', '', label)); options.append(row);
  }
  checkbox('autoOpen', 'RP 생성 2.5초 뒤 자동 열기');
  checkbox('autoClose', '응답 도착 시 자동 닫기');
  options.append(makeButton('버튼 위치 초기화', resetPosition, 'reset-position'));
  const detectorStatus = el('p', '', '생성 감지 연결 중'); detectorStatus.id = 'detector-status'; options.append(detectorStatus);
  const arrival = el('div'); arrival.id = 'arrival'; arrival.hidden = true;
  arrival.append(el('span', '', '응답 도착'), makeButton('닫기', () => closePanel(), 'arrival-close'),
    makeButton('계속하기', () => { arrival.hidden = true; gameWrap?.shadowRoot.querySelector('.gfx-game-board')?.focus({ preventScroll: true }); }, 'continue'));
  const games = el('div'); games.id = 'games';
  panel.append(header, options, arrival, games);
  const toast = el('div'); toast.id = 'toast'; toast.hidden = true; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
  shadow.append(launcher, panel, toast); document.body.append(host);
  let gameWrap = null, gamePanel = null, previousFocus = null, toastTimer = 0;
  function createGames(wrap, anywhere = false) {
    wrap.setAttribute('data-gfx-minigames', '');
    if (anywhere) wrap.setAttribute('data-anywhere-game', '');
    const root = wrap.attachShadow({ mode: 'open' }), css = el('style');
    css.textContent = CSS + '\n' + ADAPTER_CSS;
    root.append(css);
    const content = makeLoadingGames(wrap); root.append(content); return content;
  }
  function openPanel(manual = false) {
    if (disposed || !panel.hidden) return;
    previousFocus = focusedElement(); panel.hidden = false; launcher.setAttribute('aria-expanded', 'true');
    if (!gamePanel) {
      gameWrap = el('div'); games.append(gameWrap); gamePanel = createGames(gameWrap, true);
    } else {
      gamePanel.resume();
      // Inherited games focus their board on resume; restore focus for automatic opening.
      if (!manual && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    }
    syncTheme();
    if (manual) close.focus({ preventScroll: true });
  }
  function closePanel(restore = true) {
    cancelOpening();
    const hadFocus = host === document.activeElement;
    panel.hidden = true; arrival.hidden = true; launcher.setAttribute('aria-expanded', 'false');
    gamePanel?.pause();
    if (restore && hadFocus) (previousFocus?.isConnected ? previousFocus : launcher).focus({ preventScroll: true });
  }
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePanel(); }
  }, { signal: life.signal, capture: true });

  // Right-edge vertical movement only. Pointer cancellation and a long press never open the panel.
  let position = readLocal(POSITION_KEY), drag = null, holdTimer = 0, suppressClick = false, suppressTimer = 0;
  const edge = 12, size = 48;
  function clampY(y) { return Math.max(edge, Math.min(Number.isFinite(y) ? y : innerHeight * .6, Math.max(edge, innerHeight - size - edge))); }
  function place(y, save = false) {
    // Own only the vertical position; preserve remote-control classes and hiding styles.
    position = clampY(y); launcher.style.top = `${position}px`;
    if (save) writeLocal(POSITION_KEY, position);
  }
  function resetPosition() { place(innerHeight * .6, true); }
  place(position);
  on(window, 'resize', () => place(position, true));
  on(launcher, 'pointerdown', event => {
    if (event.button !== 0 || drag) return;
    clearTimeout(suppressTimer);
    suppressClick = false; drag = { id: event.pointerId, y: event.clientY, start: position, moved: false };
    launcher.setPointerCapture?.(event.pointerId);
    holdTimer = setTimeout(() => { if (drag && !drag.moved) { resetPosition(); suppressClick = true; drag.reset = true; } }, 700);
  });
  on(launcher, 'pointermove', event => {
    if (!drag || drag.id !== event.pointerId || drag.reset) return;
    if (Math.abs(event.clientY - drag.y) > 5) { drag.moved = true; clearTimeout(holdTimer); suppressClick = true; }
    if (drag.moved) { event.preventDefault(); place(drag.start + event.clientY - drag.y); }
  });
  function endDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    clearTimeout(holdTimer);
    if (event.type !== 'pointerup') suppressClick = true;
    if (drag.moved) place(position, true);
    drag = null;
    // Ignore the click dispatched immediately after a drag/hold, but do not leave a
    // stale latch swallowing a later remote .click() when cancellation emits no click.
    if (suppressClick) suppressTimer = setTimeout(() => { suppressClick = false; }, 0);
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) on(launcher, type, endDrag);
  launcher.addEventListener('keydown', event => {
    if (event.key === 'Home') { event.preventDefault(); resetPosition(); }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault(); place(position + (event.key === 'ArrowUp' ? -20 : 20), true);
    }
  }, { signal: life.signal });

  const palettes = {
    cream: ['#FFFDF5', '#6B4528', '#5A3A24', '#FFF4D9', '#FFE17A', '#F0763A'],
    berry: ['#FFF8FA', '#7A2E45', '#6A2E45', '#FFE4EC', '#FFD3E0', '#F2557F'],
    mint: ['#F6FFFA', '#4A3424', '#3E2C1E', '#E1F7EC', '#BFEFD8', '#3FA57A'],
    lavender: ['#FCFBFF', '#4F3F85', '#43356F', '#EFE8FF', '#DCD0FF', '#8C6CF0'],
    night: ['#2A2E4D', '#14162A', '#F0EEFF', '#22253D', '#4A4F80', '#FFB84D'],
  };
  function syncTheme() {
    const source = [...document.querySelectorAll('[data-gfx-preset]')].find(node => node !== host)
      || document.querySelector(HOST_TAG) || document.documentElement;
    const preset = source.getAttribute('data-gfx-preset') || '';
    if (host.getAttribute('data-gfx-preset') !== preset) host.setAttribute('data-gfx-preset', preset);
    const computed = getComputedStyle(source);
    ['card', 'line', 'text', 'ink', 'pick', 'accent'].forEach((name, index) => {
      const key = `--gfx-${name}`, value = computed.getPropertyValue(key).trim();
      const color = value && CSSSupportsColor(value) ? value : (palettes[preset] || palettes.cream)[index];
      if (host.style.getPropertyValue(key) !== color) host.style.setProperty(key, color);
    });
    gamePanel?.retheme();
    mounted?.wrap.shadowRoot.querySelector('.gfx-load-games')?.retheme();
  }
  function CSSSupportsColor(value) { return window.CSS?.supports ? window.CSS.supports('color', value) : /^#[0-9a-f]{3,8}$/i.test(value); }

  // Preserve upstream Forge rules: 2.5 s uninterrupted generation, skip boot/cached chapters,
  // move the existing game into a replaced .forge-center, restore its positioning on release.
  let mounted = null, forgeSince = null, forgeEnabled = true;
  function releaseForge(remove = true) {
    if (!mounted) return;
    if (remove) { mounted.content.dispose(); mounted.wrap.remove(); }
    mounted.center.style.position = mounted.position; mounted = null;
  }
  function generating(h) {
    if (!writingLoad(h) || h._boot === 'idle' || h._boot === 'loading') return false;
    try { if (h._hudView === 'forge' && typeof h._chapterWritten === 'function' && h._chapterWritten()) return false; } catch {}
    return true;
  }
  function syncForge() {
    if (disposed || !forgeEnabled) return;
    const h = document.querySelector(HOST_TAG), now = performance.now();
    if (generating(h)) { if (forgeSince === null) forgeSince = now; } else forgeSince = null;
    const center = forgeSince !== null && (mounted || now - forgeSince >= 2500) ? h.shadowRoot.querySelector('.forge-center') : null;
    if (!center) { releaseForge(); return; }
    if (mounted && mounted.center !== center) {
      const { wrap, content } = mounted; releaseForge(false);
      mounted = { center, wrap, content, position: center.style.position };
    }
    if (!mounted) {
      const wrap = el('div'); const content = createGames(wrap);
      mounted = { center, wrap, content, position: center.style.position };
    }
    if (getComputedStyle(center).position === 'static') center.style.position = 'relative';
    if (mounted.wrap.parentNode !== center) { center.append(mounted.wrap); mounted.content.retheme(); }
  }
  // The original calls window[KEY]() before installing itself. Relinquish only Forge then;
  // the independent anywhere UI survives either installation order, with one Forge owner.
  function relinquishForge() { forgeEnabled = false; releaseForge(); }
  if (typeof window[KEY] === 'function') { try { window[KEY](); } catch {} }
  window[KEY] = relinquishForge;

  let streamingId = null, openingTimer = 0, startedAt = 0;
  function cancelOpening() { clearTimeout(openingTimer); openingTimer = 0; }
  function scheduleOpening() {
    cancelOpening();
    if (!settings.autoOpen || !streamingId) return;
    const id = streamingId;
    openingTimer = setTimeout(() => {
      openingTimer = 0;
      if (streamingId === id && settings.autoOpen) openPanel(false);
    }, Math.max(0, 2500 - (performance.now() - startedAt)));
  }
  function responseArrived() {
    toast.textContent = '응답 도착'; toast.hidden = false; clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 5000);
    if (!panel.hidden) {
      if (settings.autoClose) closePanel(); else arrival.hidden = false;
    }
  }
  function setGeneration(id, complete = true) {
    if (id === streamingId) return;
    const old = streamingId; streamingId = id; cancelOpening();
    if (old && !id && complete) responseArrived();
    if (id) { startedAt = performance.now(); arrival.hidden = true; scheduleOpening(); }
  }
  let store = null, unsubscribe = null, pollController = null, pollingId = null;
  function readState(candidate = globalThis.__MARINARA_HOST__?.stores?.chat) {
    try { return candidate?.getState?.() || null; } catch { return null; }
  }
  function activeChatId() {
    const state = readState();
    if (typeof state?.activeChatId === 'string' && state.activeChatId) return state.activeChatId;
    // URL fallback is conservative: explicit chatId/chat query or /chat(s)/:id (also hash routes).
    try {
      const url = new URL(location.href), hash = url.hash.slice(1);
      const route = new URL(hash.startsWith('/') ? hash : '/', url.origin);
      return url.searchParams.get('chatId') || url.searchParams.get('chat') || route.searchParams.get('chatId')
        || decodeURIComponent((url.pathname.match(/\/(?:chat|chats)\/([^/]+)/) || route.pathname.match(/\/(?:chat|chats)\/([^/]+)/))?.[1] || '') || null;
    } catch { return null; }
  }
  function consumeState(state) {
    if (!state || typeof state.isStreaming !== 'boolean') return;
    // marinara-engine-ref/packages/client/src/stores/chat.store.ts:199-201,505-517:
    // isStreaming and streamingChatId are updated together; a stop clears streamingChatId.
    const id = state.isStreaming ? (state.streamingChatId || state.activeChatId) : null;
    setGeneration(typeof id === 'string' && id ? id : null);
  }
  function abortPoll() { pollController?.abort(); pollController = null; }
  function connectStore() {
    // packages/client/src/lib/marinara-host.ts:52-55,87-103 exposes the Zustand store itself.
    const candidate = globalThis.__MARINARA_HOST__?.stores?.chat;
    if (candidate === store && unsubscribe) return true;
    if (unsubscribe) { unsubscribe(); unsubscribe = null; store = null; setGeneration(null, false); }
    if (typeof candidate?.subscribe !== 'function' || typeof readState(candidate)?.isStreaming !== 'boolean') return false;
    try {
      const off = candidate.subscribe(consumeState);
      if (typeof off !== 'function') return false;
      unsubscribe = off; store = candidate; abortPoll(); pollingId = null;
      detectorStatus.textContent = '생성 감지: 채팅 스토어'; consumeState(readState(store)); return true;
    } catch { return false; }
  }
  async function poll() {
    if (disposed || connectStore()) return;
    const id = activeChatId();
    if (id !== pollingId) { abortPoll(); pollingId = id; setGeneration(null, false); }
    if (!id || typeof MARINARA?.fetch !== 'function') {
      detectorStatus.textContent = '생성 감지 대기: 활성 채팅 정보가 필요합니다'; return;
    }
    if (pollController) return; // Never overlap requests; navigation can cancel the old one.
    const controller = new AbortController(); pollController = controller;
    const deadline = setTimeout(() => controller.abort(), 5000);
    detectorStatus.textContent = '생성 감지: 1초 간격 상태 확인';
    try {
      // PersonalExtensionInjector.tsx:317 supplies authorized same-origin marinara.fetch.
      // packages/server/src/routes/generate.routes.ts:14860-14867 returns { active, translating }.
      const response = await MARINARA.fetch(`/api/generate/status/${encodeURIComponent(id)}`, { method: 'GET', signal: controller.signal });
      if (!response.ok) throw new Error('status unavailable');
      const status = await response.json();
      if (disposed || controller.signal.aborted || store || id !== activeChatId()) return;
      if (typeof status.active !== 'boolean') throw new Error('invalid status');
      setGeneration(status.active ? id : null);
    } catch {
      if (!disposed && !controller.signal.aborted && !store) detectorStatus.textContent = '생성 상태를 확인할 수 없어 재시도합니다';
      // A failed request is not evidence of generation completion.
    } finally {
      clearTimeout(deadline); if (pollController === controller) pollController = null;
    }
  }
  // PersonalExtensionInjector.tsx:339-342 registers cleanup on disable/reload/removal.
  function dispose() {
    if (disposed) return;
    disposed = true; cancelOpening(); abortPoll(); unsubscribe?.(); unsubscribe = null;
    life.abort(); lifetime.dispose(); gamePanel?.dispose(); releaseForge(); host.remove();
    if (window[KEY] === relinquishForge) delete window[KEY];
    if (window[APP_KEY]?.dispose === dispose) delete window[APP_KEY];
  }
  window[APP_KEY] = { dispose };
  MARINARA?.onCleanup?.(dispose);
  setInterval(syncForge, 200); syncForge();
  setInterval(() => { syncTheme(); void poll(); }, 1000); syncTheme(); void poll();
