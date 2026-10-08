// Behind the Vial: citation registry.
//
// One context per rendered entry. Sources are numbered by FIRST use, in the
// order renderers call cite() (renderEntry walks sections in reading order),
// so the numbers in the text match the numbered list in #sources.
//
//   const ctx = createCiteContext(SOURCES);
//   ctx.cite(['id-a', 'id-b'])  → Safe '<sup class="cite"><a href="#src-id-a" aria-label="Source 1: …">1</a></sup>…'
//   ctx.chips(obj)              → "Unverified" / "Model estimate" chips for obj.unverified / obj.estimate
//   ctx.mark(obj)               → cite(obj.sources) + chips(obj)  (the usual trailer after a sentence)
//   ctx.register(ids)           → reserve numbers without printing (e.g. risk warnings shown later)
//   ctx.list()                  → [{ id, n, source, confirmed }] in number order
import { SOURCES as DEFAULT_SOURCES } from '../../data/sources.js';
import { esc, raw } from './util.js';

const toIds = (ids) => [...new Set((Array.isArray(ids) ? ids : ids ? [ids] : []).filter(Boolean))];

export function createCiteContext(sources = DEFAULT_SOURCES) {
  const byId = new Map();
  let next = 1;

  function reg(id, unverified) {
    let r = byId.get(id);
    if (!r) {
      const source = sources[id] || null;
      if (!source) console.warn(`[cite] unknown source id "${id}"`);
      r = { id, n: source ? next++ : 0, source, verifiedUse: false };
      byId.set(id, r);
    }
    if (!unverified) r.verifiedUse = true;
    return r;
  }

  function cite(ids, { unverified = false } = {}) {
    const out = toIds(ids).map((id) => {
      const r = reg(id, unverified);
      if (!r.source) return `<sup class="cite cite--missing"><span title="Source not found">?</span></sup>`;
      const label = `Source ${r.n}: ${r.source.title}`;
      return `<sup class="cite"><a href="#src-${esc(id)}" aria-label="${esc(label)}">${r.n}</a></sup>`;
    });
    return raw(out.join(''));
  }

  function chips(obj = {}) {
    let s = '';
    if (obj && obj.unverified) s += '<span class="c-chip c-chip--unverified" title="We could not confirm this against the original source yet."><span class="c-chip__mark" aria-hidden="true">?</span>Unverified</span>';
    if (obj && obj.estimate) s += '<span class="c-chip c-chip--estimate" title="Calculated from a model, not measured directly."><span class="c-chip__mark" aria-hidden="true">≈</span>Model estimate</span>';
    return raw(s);
  }

  const mark = (obj = {}) => raw(`${cite(obj.sources, { unverified: !!obj.unverified })}${chips(obj)}`);

  function register(ids, opts) { toIds(ids).forEach((id) => reg(id, opts?.unverified)); }

  function list() {
    return [...byId.values()]
      .filter((r) => r.source)
      .sort((a, b) => a.n - b.n)
      .map((r) => ({ id: r.id, n: r.n, source: r.source, confirmed: !r.source.unverified && r.verifiedUse }));
  }

  return { cite, chips, mark, register, list, sources };
}

/** Standalone helper for callers outside a render pass (numbers restart per call). */
export function cite(ids, sources = DEFAULT_SOURCES) {
  return createCiteContext(sources).cite(ids);
}
