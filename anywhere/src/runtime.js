  // Local resources include inherited game timers/frames: no global monkey patches.
  function resources() {
    const controller = new AbortController(), timeouts = new Set(), intervals = new Set(), frames = new Set();
    let closed = false;
    return {
      signal: controller.signal,
      setTimeout(fn, ms, ...args) {
        if (closed) return 0;
        const id = window.setTimeout(() => { timeouts.delete(id); if (!closed) fn(...args); }, ms);
        timeouts.add(id); return id;
      },
      clearTimeout(id) { window.clearTimeout(id); timeouts.delete(id); },
      setInterval(fn, ms, ...args) {
        if (closed) return 0;
        const id = window.setInterval(() => { if (!closed) fn(...args); }, ms); intervals.add(id); return id;
      },
      clearInterval(id) { window.clearInterval(id); intervals.delete(id); },
      requestAnimationFrame(fn) {
        if (closed) return 0;
        const id = window.requestAnimationFrame(t => { frames.delete(id); if (!closed) fn(t); }); frames.add(id); return id;
      },
      cancelAnimationFrame(id) { window.cancelAnimationFrame(id); frames.delete(id); },
      clearTimers() {
        timeouts.forEach(id => window.clearTimeout(id)); timeouts.clear();
        intervals.forEach(id => window.clearInterval(id)); intervals.clear();
        frames.forEach(id => window.cancelAnimationFrame(id)); frames.clear();
      },
      dispose() { closed = true; controller.abort(); this.clearTimers(); },
    };
  }
  const APP_KEY = 'gacha_minigames_me';
  window[APP_KEY]?.dispose?.();
  const lifetime = resources();
  const { setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame, cancelAnimationFrame } = lifetime;
  function focusedElement() {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
  }
  const editable = node => !!node?.closest?.('textarea,input,select,[contenteditable]:not([contenteditable="false"])');
  function gameKeyAllowed(event, target) {
    const panel = target.closest?.('.gfx-load-games');
    const active = focusedElement();
    return !!panel && panel.isConnected && !panel.closest('[hidden]') && panel.contains(active)
      && !editable(active) && !event.composedPath().some(editable);
  }
  function listen(scope, target, type, fn, opts = {}) {
    target.addEventListener(type, event => {
      if ((type === 'keydown' || type === 'keyup') && !gameKeyAllowed(event, target)) return;
      fn(event);
    }, { ...opts, signal: scope.signal });
  }
  // Keep shared SD images only when already in memory. External URLs must never trigger a request.
  const safeFace = value => typeof value === 'string' && (
    /^data:image\/(png|jpeg|gif|webp);base64,/i.test(value) || value.startsWith(`blob:${location.origin}/`)
  );
