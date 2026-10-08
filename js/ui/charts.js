// Behind the Vial: static, theme-aware SVG charts for the content sections.
//
// Charts are drawn as SVG strings at the container's real pixel width (so text
// stays crisp and readable at 360 px), first at a nominal width during render,
// then redrawn by hydrateCharts() whenever the container is resized.
// Nothing here is interactive: no controls, no inputs. Colors come from CSS
// classes that use the theme tokens, so light/dark switch without redrawing.
import { esc, uid } from './util.js';

const specs = new Map();       // chart element id → { kind, data }
let observers = [];

export function resetCharts() {
  observers.forEach((o) => o.disconnect());
  observers = [];
  specs.clear();
}

/** Returns the host markup for a chart; the SVG inside is drawn at `nominal` px wide. */
export function chartHost(kind, data, { nominal = 640, cls = '' } = {}) {
  const id = uid('chart');
  specs.set(id, { kind, data });
  return `<div class="c-chart ${cls}" id="${id}" data-chart-id="${id}">${draw(kind, data, nominal)}</div>`;
}

function draw(kind, data, width) {
  const w = Math.max(240, Math.round(width));
  if (kind === 'arms') return armBars(data, w);
  if (kind === 'vials') return vialColumns(data, w);
  return '';
}

export function hydrateCharts(root = document) {
  const els = [...(root.querySelectorAll ? root.querySelectorAll('[data-chart-id]') : [])];
  if (!els.length) return;
  const redraw = (el) => {
    const spec = specs.get(el.dataset.chartId);
    if (!spec) return;
    const w = Math.round(el.clientWidth);
    if (!w || Math.abs(w - (Number(el.dataset.drawnWidth) || 0)) < 4) return;
    el.dataset.drawnWidth = String(w);
    el.innerHTML = draw(spec.kind, spec.data, w);
  };
  els.forEach(redraw);
  if (typeof ResizeObserver === 'function') {
    let raf = 0;
    const pending = new Set();
    const ro = new ResizeObserver((entries) => {
      entries.forEach((e) => pending.add(e.target));
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { pending.forEach(redraw); pending.clear(); });
    });
    els.forEach((el) => ro.observe(el));
    observers.push(ro);
  }
}

// ---------------------------------------------------------------------------
// geometry helpers

const f = (n) => (Math.round(n * 10) / 10).toString();

/** Horizontal bar from x0 with a 4 px rounded data-end on the right, square at the baseline. */
function hbar(x0, y, len, h, r = 4) {
  if (len <= 0) return '';
  const rr = Math.min(r, len, h / 2);
  return `M${f(x0)} ${f(y)}H${f(x0 + len - rr)}A${rr} ${rr} 0 0 1 ${f(x0 + len)} ${f(y + rr)}V${f(y + h - rr)}A${rr} ${rr} 0 0 1 ${f(x0 + len - rr)} ${f(y + h)}H${f(x0)}Z`;
}
/** Vertical column from baseline yb up to height h with a 4 px rounded top. */
function vbar(x, yb, w, h, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  const yt = yb - h;
  return `M${f(x)} ${f(yb)}V${f(yt + rr)}A${rr} ${rr} 0 0 1 ${f(x + rr)} ${f(yt)}H${f(x + w - rr)}A${rr} ${rr} 0 0 1 ${f(x + w)} ${f(yt + rr)}V${f(yb)}Z`;
}

const niceCeil = (v, steps = [10, 20, 25, 50, 100]) => {
  if (!(v > 0)) return 10;
  for (const s of steps) if (v <= s) return s;
  return Math.ceil(v / 50) * 50;
};

// rough text width for 12–13 px Inter-like fonts (used only to avoid collisions)
const textW = (s, px = 12.5) => String(s).length * px * 0.56;

// ---------------------------------------------------------------------------
// Dose-facts: one metric across the studied groups (single series).
// data: { title, rows: [{ arm, value, text, comparator }], max }
function armBars(data, W) {
  const rows = data.rows || [];
  const narrow = W < 460;
  const tid = uid('t');
  const max = data.max || niceCeil(Math.max(...rows.map((r) => (Number.isFinite(r.value) ? r.value : 0))));
  const valueRoom = 52;
  let labelW = narrow ? 0 : Math.min(220, Math.max(120, Math.max(...rows.map((r) => textW(r.arm))) + 16));
  const x0 = narrow ? 0 : labelW;
  const plotW = Math.max(60, W - x0 - valueRoom);
  const barH = narrow ? 10 : 14;
  const rowH = narrow ? 40 : 32;
  const top = 6;
  const H = top + rows.length * rowH + 6;
  let s = `<svg class="c-svg c-svg--arms" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${tid}"><title id="${tid}">${esc(data.title)}: ${rows.map((r) => `${esc(r.arm)} ${esc(r.text)}`).join('; ')}</title>`;
  // baseline
  s += `<line class="c-svg-axis" x1="${f(x0 + 0.5)}" x2="${f(x0 + 0.5)}" y1="${top - 2}" y2="${H - 4}"/>`;
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    const by = narrow ? y + 18 : y + (rowH - barH) / 2;
    const ly = narrow ? y + 11 : y + rowH / 2 + 4.5;
    s += `<text class="c-svg-label${r.comparator ? ' c-svg-label--muted' : ''}" x="${narrow ? 0 : labelW - 12}" y="${f(ly)}"${narrow ? '' : ' text-anchor="end"'}>${esc(r.arm)}</text>`;
    if (Number.isFinite(r.value)) {
      const len = Math.max(r.value > 0 ? 2 : 0, (r.value / max) * plotW);
      s += `<path class="c-svg-bar${r.comparator ? ' c-svg-bar--comparator' : ''}" d="${hbar(x0 + 1, by, len, barH)}"/>`;
      s += `<text class="c-svg-value" x="${f(x0 + 1 + len + 8)}" y="${f(by + barH / 2 + 4.3)}">${esc(r.text)}</text>`;
    } else {
      s += `<text class="c-svg-value c-svg-label--muted" x="${f(x0 + 8)}" y="${f(by + barH / 2 + 4.3)}">${esc(r.text || 'Not reported')}</text>`;
    }
  });
  return `${s}</svg>`;
}

// ---------------------------------------------------------------------------
// Gray market: one column per vial, % of label, with a 100 % reference line.
// data: { tests: [{ id, label, pctOfLabel|null }], title, desc }
function vialColumns(data, W) {
  const tests = data.tests || [];
  const n = tests.length || 1;
  const narrow = W < 480;
  const H = narrow ? 236 : 288;
  const m = { l: 42, r: 10, t: 26, b: 28 };
  const plotW = W - m.l - m.r;
  const plotH = H - m.t - m.b;
  const maxPct = Math.max(100, ...tests.map((t) => t.pctOfLabel ?? 0));
  const yMax = Math.max(150, Math.ceil((maxPct + 10) / 50) * 50);
  const y = (v) => m.t + plotH - (v / yMax) * plotH;
  const band = plotW / n;
  const bw = Math.max(4, Math.min(24, band * 0.62));
  const tid = uid('t');
  const did = uid('d');
  let s = `<svg class="c-svg c-svg--vials" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${tid} ${did}"><title id="${tid}">${esc(data.title)}</title><desc id="${did}">${esc(data.desc)}</desc>`;
  // grid every 50 %
  for (let v = 0; v <= yMax; v += 50) {
    if (v === 100) continue;
    s += `<line class="${v === 0 ? 'c-svg-axis' : 'c-svg-grid'}" x1="${m.l}" x2="${W - m.r}" y1="${f(y(v) - 0.5)}" y2="${f(y(v) - 0.5)}"/>`;
    s += `<text class="c-svg-tick" x="${m.l - 8}" y="${f(y(v) + 4)}" text-anchor="end">${v}%</text>`;
  }
  // columns
  tests.forEach((t, i) => {
    const cx = m.l + band * i + band / 2;
    const short = esc(String(t.id || i + 1).toUpperCase().slice(0, 3));
    const name = esc(t.label || `Vial ${short}`);
    if (t.pctOfLabel == null) {
      const yb = y(0) - 9;
      const k = Math.min(5, Math.max(3.5, bw / 2.6));
      s += `<g class="c-svg-none"><title>${name}: none of the drug detected</title><rect x="${f(cx - Math.max(bw, 12) / 2)}" y="${f(yb - 9)}" width="${f(Math.max(bw, 12))}" height="18" fill="transparent"/><path d="M${f(cx - k)} ${f(yb - k)}L${f(cx + k)} ${f(yb + k)}M${f(cx + k)} ${f(yb - k)}L${f(cx - k)} ${f(yb + k)}"/></g>`;
    } else {
      const h = (t.pctOfLabel / yMax) * plotH;
      s += `<path class="c-svg-bar c-svg-bar--vial" d="${vbar(cx - bw / 2, y(0) - 1, bw, Math.max(2, h - 1))}"><title>${name}: ${esc(t.pctOfLabel)}% of the label amount</title></path>`;
    }
    if (band >= 15) s += `<text class="c-svg-tick" x="${f(cx)}" y="${H - m.b + 17}" text-anchor="middle">${short}</text>`;
  });
  // 100 % reference line drawn last so it reads over the columns
  const y100 = f(y(100));
  s += `<line class="c-svg-ref" x1="${m.l}" x2="${W - m.r}" y1="${y100}" y2="${y100}"/>`;
  s += `<text class="c-svg-tick" x="${m.l - 8}" y="${f(y(100) + 4)}" text-anchor="end">100%</text>`;
  const refLabel = narrow ? 'Label amount' : 'Amount on the label (100%)';
  // Columns are sorted low → high, so the left end above the line is the free space.
  s += `<text class="c-svg-reflabel" x="${m.l + 6}" y="${f(y(100) - 8)}">${refLabel}</text>`;
  return `${s}</svg>`;
}
