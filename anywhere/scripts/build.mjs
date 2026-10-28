import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { root, verifyOriginal } from './verify-original.mjs';
export const ANCHOR = '  /* Mounting: the games sit inside';
export function once(source, search, replacement, name = search.slice(0, 60)) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${name}: expected 1 anchor, got ${count}`);
  return source.replace(search, () => replacement);
}
export function derive(source) {
  if (source.split(ANCHOR).length !== 2) throw new Error('Mounting anchor must occur exactly once');
  let games = source.slice(0, source.indexOf(ANCHOR));
  const patches = [];
  const patch = (from, to, name) => { games = once(games, from, to, name); patches.push(name); };
  patch('  const KEY = "__GF_MINIGAMES_EXTENSION";\n  if (typeof window[KEY] === "function") {\n    try { window[KEY](); } catch {}\n  }',
    readFileSync(resolve(root, 'src/runtime.js'), 'utf8') + '\n  const KEY = "__GF_MINIGAMES_EXTENSION";', 'lifecycle and coexistence');
  patch('const on = (target, type, fn, opts = {}) => target.addEventListener(type, fn, { ...opts, signal: life.signal });',
    'const on = (target, type, fn, opts = {}) => listen(life, target, type, fn, opts);', 'keyboard guard');
  patch('  function makeLoadingGames(overlay) {', `  function makeLoadingGames(overlay) {
    const panelLife = resources();
    let suspended = false;
    const { setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame, cancelAnimationFrame } = panelLife;
    const on = (target, type, fn, opts = {}) => listen(panelLife, target, type, fn, opts);`, 'panel resources');
  patch('.filter(Boolean); } catch { return []; } };', '.filter(safeFace); } catch { return []; } };', 'offline sprites');
  patch('    return panel;\n  }', `    panel.pause = () => {
      if (suspended) return;
      stopTimers(); panelLife.clearTimers(); suspended = true;
      if (mode === 'memory') states[mode].game.hide();
    };
    panel.resume = () => { if (mode) show(mode); };
    panel.dispose = () => { stopTimers(); panelLife.dispose(); };
    return panel;
  }`, 'panel cleanup');
  // A paused panel still needs its elapsed-time ticker after reopening.
  patch('    const tick = setInterval(() => {\n      if (!panel.isConnected)', '    const paintTick = () => {\n      if (!panel.isConnected)', 'resumable ticker start');
  patch('    }, 250);\n    function show(next)', '    };\n    let tick = setInterval(paintTick, 250);\n    function show(next)', 'resumable ticker end');
  patch('panel.resume = () => { if (mode) show(mode); };', 'panel.resume = () => { clearInterval(tick); tick = setInterval(paintTick, 250); if (mode) show(mode); };', 'resume ticker');
  patch('      stopTimers(); mode = next;', '      if (!suspended) stopTimers(); suspended = false; mode = next;', 'preserve shop pause timestamp');
  patch('        tools.append(startBtn);', `        tools.append(startBtn);
        // Reopening a suspended sequence must replay it instead of leaving an unknowable round.
        if (st.started && !game.ended) { game.at = 0; setTimeout(play, 0); }`, 'replay suspended recipe');
  // Scoped <style> also works on HTTP and browsers without constructable stylesheets.
  const mount = readFileSync(resolve(root, 'src/mount.js'), 'utf8');
  const css = readFileSync(resolve(root, 'src/adapter.css'), 'utf8');
  return { source: '// Generated from upstream v1.3.1; see README.md and NOTICE.\n' + games
    + '\n  const ADAPTER_CSS = ' + JSON.stringify(css) + ';\n' + mount + '\n})();\n', patches };
}
export function build() {
  const result = derive(verifyOriginal());
  mkdirSync(resolve(root, 'dist'), { recursive: true });
  mkdirSync(resolve(root, 'qa'), { recursive: true });
  writeFileSync(resolve(root, 'dist/extension.js'), result.source);
  writeFileSync(resolve(root, 'dist/manifest.json'), readFileSync(resolve(root, 'manifest.json')));
  writeFileSync(resolve(root, 'qa/patches.json'), JSON.stringify(result.patches, null, 2) + '\n');
  console.log(`Build passed: mounting anchor 1/1, ${result.patches.length} counted patches; original SHA-256 verified`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) build();
