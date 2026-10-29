import { dependency } from '../tests/dependencies.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { root } from './verify-original.mjs';
const { chromium } = dependency('playwright');
const report = { status: 'running', rows: [], remote: [], failures: [] };
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.ANYWHERE_CHROMIUM || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const viewport of [{ width: 360, height: 640 }, { width: 360, height: 460 }, { width: 1280, height: 800 }]) {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', error => report.failures.push(error.message));
    page.on('request', request => report.failures.push(`Unexpected network request: ${request.url()}`));
    await page.route('**/*', route => route.abort());
    await page.setContent('<!doctype html><html><body style="margin:0"><textarea id="chat" style="height:44px"></textarea></body></html>');
    await page.evaluate(() => {
      Object.defineProperty(window, 'crypto', { value: undefined });
      let state = { activeChatId: 'test', isStreaming: false, streamingChatId: null };
      const listeners = new Set(); window.cleanups = [];
      window.__MARINARA_HOST__ = { stores: { chat: { getState: () => state, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } } } };
      window.setStreaming = value => { state = { ...state, isStreaming: value, streamingChatId: value ? 'test' : null }; listeners.forEach(fn => fn(state)); };
      window.marinara = { onCleanup: fn => cleanups.push(fn), fetch: () => { throw new Error('Unexpected fetch'); } };
    });
    await page.addScriptTag({ content: readFileSync(resolve(root, 'dist/extension.js'), 'utf8') });
    const remote = await page.evaluate(() => {
      const ui = document.getElementById('gacha_minigames_me').shadowRoot;
      const launcher = ui.getElementById('gacha-minigames-launcher'), panel = ui.getElementById('panel');
      const visibleForPicking = launcher.getClientRects().length > 0 && getComputedStyle(launcher).visibility !== 'hidden'
        && !launcher.closest('[inert],[aria-hidden="true"]');
      launcher.click();
      const normal = panel.getBoundingClientRect().toJSON();
      launcher.click();
      const style = document.createElement('style');
      style.textContent = '.remote-hidden { display:none !important; }'; ui.append(style);
      launcher.classList.add('remote-hidden');
      window.dispatchEvent(new Event('resize'));
      launcher.click();
      const hidden = panel.getBoundingClientRect().toJSON();
      const passed = visibleForPicking && launcher.dataset.testid === launcher.id
        && launcher.getClientRects().length === 0 && !panel.hidden && hidden.width > 0
        && JSON.stringify(normal) === JSON.stringify(hidden) && launcher.classList.contains('remote-hidden');
      launcher.click();
      const closed = panel.hidden;
      launcher.classList.remove('remote-hidden'); style.remove();
      return { passed: passed && closed, visibleForPicking };
    });
    report.remote.push({ viewport, ...remote });
    if (!remote.passed) report.failures.push({ viewport, remote });
    await page.locator('#gacha-minigames-launcher').click();
    const names = await page.locator('.gfx-game-tab').evaluateAll(tabs => tabs.map(t => t.dataset.game));
    for (const game of names) {
      await page.locator(`.gfx-game-tab[data-game="${game}"]`).click();
      const row = await page.evaluate(() => {
        const host = document.getElementById('gacha_minigames_me'), ui = host.shadowRoot;
        const panel = ui.getElementById('panel'), game = ui.querySelector('[data-anywhere-game]').shadowRoot;
        const targets = [...ui.querySelectorAll('button,summary,label'), ...game.querySelectorAll('button')].filter(e => {
          if (!e.getClientRects().length) return false;
          return !e.closest('[hidden]') && getComputedStyle(e).visibility !== 'hidden';
        });
        const small = targets.filter(e => { const box = e.getBoundingClientRect(); return box.width < 43.9 || box.height < 43.9; }).map(e => ({ text: e.textContent.slice(0, 30), cls: e.className, width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height }));
        const rect = panel.getBoundingClientRect();
        return { panel: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, pageOverflow: document.documentElement.scrollWidth > innerWidth,
          smallTargets: small, game: game.querySelector('.gfx-game-content').dataset.kind };
      });
      report.rows.push({ viewport, ...row });
      if (row.smallTargets.length || row.pageOverflow || row.panel.left < 0 || row.panel.right > viewport.width || row.panel.top < 0 || row.panel.bottom > viewport.height) report.failures.push({ viewport, ...row });
    }
    await page.locator('.gfx-game-tab[data-game="merge"]').click();
    await page.locator('#chat').focus();
    await page.keyboard.press('ArrowLeft');
    if (await page.locator('#chat').evaluate(e => document.activeElement !== e)) report.failures.push('Chat lost focus');
    await page.locator('#close').click();
    await page.locator('#chat').focus();
    await page.evaluate(() => window.setStreaming(true));
    await page.waitForTimeout(2600);
    if (!await page.locator('#panel').isVisible()) report.failures.push('Auto open failed');
    if (await page.locator('#chat').evaluate(e => document.activeElement !== e)) report.failures.push('Automatic reopen stole focus');
    await page.evaluate(() => window.setStreaming(false));
    if (!await page.locator('#arrival').isVisible()) report.failures.push('Arrival choices missing');
    if (viewport.width === 360 && viewport.height === 640) await page.screenshot({ path: resolve(root, 'qa/mobile-360.png') });
    await page.evaluate(() => window.cleanups.forEach(fn => fn()));
    if (await page.locator('#gacha_minigames_me').count()) report.failures.push('Cleanup left DOM');
    await page.close();
  }
  report.status = report.failures.length ? 'failed' : 'passed';
} catch (error) {
  report.status = 'blocked';
  const message = String(error.message);
  report.reason = /Operation not permitted/.test(message) ? 'Browser launch blocked: Operation not permitted'
    : /executable doesn.t exist/i.test(message) ? 'Browser executable unavailable'
    : message.split('\n')[0].replace(/\/(?:home|tmp)\/\S+/g, '[local path]');
} finally {
  await browser?.close(); mkdirSync(resolve(root, 'qa'), { recursive: true });
  writeFileSync(resolve(root, 'qa/browser.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ status: report.status, cases: report.rows.length, reason: report.reason, failures: report.failures.length }));
if (report.status !== 'passed') process.exitCode = 1;
