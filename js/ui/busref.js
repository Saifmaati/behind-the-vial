// PeptideScope: guarded access to the shared event bus (js/bus.js, owned by
// foundation). If it is missing or fails to load (modules are built in
// parallel), fall back to a tiny compatible bus shared on globalThis so every
// content module still talks to the same instance.
let bus = null;
try {
  const mod = await import('../bus.js');
  bus = mod.bus || mod.default || null;
} catch (err) {
  console.warn('[content] js/bus.js unavailable, using a local fallback bus', err?.message || err);
}

if (!bus || typeof bus.on !== 'function' || typeof bus.emit !== 'function') {
  bus = globalThis.__psFallbackBus || (globalThis.__psFallbackBus = (() => {
    const map = new Map();
    return {
      on(type, fn) {
        if (!map.has(type)) map.set(type, new Set());
        map.get(type).add(fn);
        return () => map.get(type)?.delete(fn);
      },
      emit(type, detail) {
        for (const fn of [...(map.get(type) || [])]) {
          try { fn(detail); } catch (e) { console.error(`[bus] ${type} handler failed`, e); }
        }
      },
    };
  })());
}

export { bus };
