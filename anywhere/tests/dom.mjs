import { dependency } from './dependencies.mjs';
import { readFileSync } from 'node:fs';
const { JSDOM, VirtualConsole } = dependency('jsdom');
export const source = readFileSync(new URL('../dist/extension.js', import.meta.url), 'utf8');
export const upstream = readFileSync(new URL('../../extension.js', import.meta.url), 'utf8');
export async function setup(options = {}) {
  const errors = [], console = new VirtualConsole(); console.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM('<!doctype html><html><body><textarea id="chat"></textarea></body></html>', {
    url: options.url || 'http://test.invalid/?chatId=chat-one', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console,
  });
  const w = dom.window, d = w.document;
  Object.defineProperty(w, 'innerHeight', { value: 640, writable: true });
  Object.defineProperty(w, 'innerWidth', { value: 360, writable: true });
  Object.defineProperty(w, 'crypto', { value: undefined });
  let now = 100, nextId = 1;
  const pending = new Map();
  const add = (fn, ms, interval, args) => { const id = nextId++; pending.set(id, { fn, at: now + Math.max(1, ms || 0), interval, args }); return id; };
  w.setTimeout = (fn, ms, ...args) => add(fn, ms, 0, args);
  w.setInterval = (fn, ms, ...args) => add(fn, ms, Math.max(1, ms || 0), args);
  w.clearTimeout = w.clearInterval = id => pending.delete(id);
  w.requestAnimationFrame = fn => add(() => fn(now), 16, 0, []);
  w.cancelAnimationFrame = id => pending.delete(id);
  Object.defineProperty(w.performance, 'now', { value: () => now });
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  const advance = async ms => {
    const end = now + ms;
    for (;;) {
      const entry = [...pending.entries()].filter(([, t]) => t.at <= end).sort((a,b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      const [id, timer] = entry; now = timer.at;
      if (timer.interval) timer.at += timer.interval; else pending.delete(id);
      timer.fn(...timer.args); await flush();
    }
    now = end; await flush();
  };
  const ctx = new Proxy({}, { get(target, key) {
    if (key in target) return target[key];
    if (key === 'measureText') return () => ({ width: 20 });
    if (key === 'createLinearGradient') return () => ({ addColorStop() {} });
    return () => {};
  } });
  w.HTMLCanvasElement.prototype.getContext = () => ctx;
  w.CSSStyleSheet.prototype.replaceSync = function () {};
  if (options.storageBlocked) Object.defineProperty(w, 'localStorage', { get() { throw new Error('blocked'); } });
  else {
    if (options.settings) w.localStorage.setItem('gacha_minigames_me.settings', JSON.stringify(options.settings));
    if (options.position !== undefined) w.localStorage.setItem('gacha_minigames_me.position', JSON.stringify(options.position));
  }
  let state = { activeChatId: 'chat-one', isStreaming: false, streamingChatId: null, ...options.state };
  const subscriptions = new Set();
  const store = {
    getState: () => state,
    subscribe: fn => { subscriptions.add(fn); return () => subscriptions.delete(fn); },
  };
  if (!options.noStore) w.__MARINARA_HOST__ = { stores: { chat: store } };
  const calls = [], cleanups = [];
  w.marinara = {
    onCleanup: fn => cleanups.push(fn),
    fetch: async (url, init) => { calls.push({ url, init }); return options.fetch ? options.fetch(url, init) : { ok: true, json: async () => ({ active: false }) }; },
  };
  const fetchOriginal = w.fetch;
  if (options.before) options.before(w);
  w.eval(source); await flush();
  const root = d.getElementById('gacha_minigames_me').shadowRoot;
  const update = patch => { state = { ...state, ...patch }; subscriptions.forEach(fn => fn(state)); };
  const pointer = (type, y, x = 340) => {
    const e = new w.Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, { pointerId: 1, clientY: y, clientX: x, button: 0 }); root.getElementById('gacha-minigames-launcher').dispatchEvent(e);
  };
  const keyboard = (target, key) => {
    const e = new w.KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }); target.dispatchEvent(e); return e;
  };
  const cleanup = () => { cleanups.forEach(fn => fn()); };
  return { w, d, dom, root, errors, advance, pending, flush, calls, store, subscriptions, update, pointer, keyboard,
    fetchOriginal, cleanup, close: () => { cleanup(); dom.window.close(); },
    games: () => root.querySelector('[data-anywhere-game]')?.shadowRoot,
  };
}
