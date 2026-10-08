// Tiny synchronous event bus shared by every module (see docs/ARCHITECTURE.md, "Event bus").
//
//   import { bus } from './bus.js';
//   const off = bus.on('peptide:select', ({ id }) => { ... });
//   bus.emit('peptide:select', { id: 'retatrutide' });
//   off();
//
// Extras beyond the contract (additive, optional): bus.once(type, fn), bus.off(type, fn),
// bus.last(type) → the most recent detail emitted for `type` (or undefined), handy for a module
// that mounts late and needs the current state. Listener errors are caught and reported so one
// faulty subscriber can never break the emitter or the other subscribers.

const listeners = new Map(); // type → Set<fn>
const lastDetail = new Map(); // type → detail

function on(type, fn) {
  if (typeof fn !== 'function') throw new TypeError(`bus.on("${type}") needs a function`);
  let set = listeners.get(type);
  if (!set) listeners.set(type, (set = new Set()));
  set.add(fn);
  return () => off(type, fn);
}

function off(type, fn) {
  const set = listeners.get(type);
  if (set) {
    set.delete(fn);
    if (!set.size) listeners.delete(type);
  }
}

function once(type, fn) {
  const stop = on(type, (detail, t) => {
    stop();
    fn(detail, t);
  });
  return stop;
}

function emit(type, detail = {}) {
  lastDetail.set(type, detail);
  const set = listeners.get(type);
  if (!set) return;
  // Copy so listeners can unsubscribe (or subscribe) while we iterate.
  for (const fn of [...set]) {
    try {
      fn(detail, type);
    } catch (err) {
      console.error(`[bus] listener for "${type}" failed`, err);
    }
  }
}

function last(type) {
  return lastDetail.get(type);
}

export const bus = Object.freeze({ on, off, once, emit, last });
export default bus;
