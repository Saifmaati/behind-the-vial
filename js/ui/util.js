// PeptideScope: small shared helpers for the content UI.
// Safe HTML templating (auto-escapes every interpolated value), the organ
// vocabulary, status / severity / verdict vocabularies and formatters.

export class Safe {
  constructor(s) { this.s = String(s); }
  toString() { return this.s; }
}
export const raw = (s) => new Safe(s);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

function part(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Safe) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  return esc(v);
}

/** Tagged template: html`<p>${text}</p>` escapes text; Safe values and arrays of Safe pass through. */
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += part(vals[i]) + strings[i + 1];
  return new Safe(out);
}

let uidN = 0;
export const uid = (prefix = 'c') => `${prefix}-${(++uidN).toString(36)}`;

// html[data-motion] (set by main.js from the header toggle) wins over the OS setting.
export const prefersReducedMotion = () => {
  const attr = typeof document !== 'undefined' ? document.documentElement.dataset.motion : undefined;
  if (attr === 'reduce') return true;
  if (attr === 'full') return false;
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

// ---- organ vocabulary (shared with the 3D side; see docs/ARCHITECTURE.md) ----
export const ORGANS = [
  'brain', 'eyes', 'thyroid', 'heart', 'lungs', 'blood', 'liver', 'gallbladder', 'stomach',
  'pancreas', 'spleen', 'small_intestine', 'large_intestine', 'kidneys', 'bladder',
  'fat', 'muscle', 'skin', 'injection_site',
];
const ORGAN_LABELS = {
  brain: 'Brain', eyes: 'Eyes', thyroid: 'Thyroid', heart: 'Heart', lungs: 'Lungs', blood: 'Blood',
  liver: 'Liver', gallbladder: 'Gallbladder', stomach: 'Stomach', pancreas: 'Pancreas', spleen: 'Spleen',
  small_intestine: 'Small intestine', large_intestine: 'Large intestine', kidneys: 'Kidneys',
  bladder: 'Bladder', fat: 'Body fat', muscle: 'Muscle', skin: 'Skin', injection_site: 'Injection site',
};
export const organLabel = (id) => ORGAN_LABELS[id] || String(id || '').replace(/_/g, ' ');
export const organOrder = (id) => { const i = ORGANS.indexOf(id); return i < 0 ? 99 : i; };

// ---- vocabularies (no green anywhere: tones map to accent / warn / danger / neutral) ----
export const STATUS = {
  approved: { label: 'Approved', tone: 'accent' },
  'approved-abroad': { label: 'Approved outside the US', tone: 'accent' },
  'approved-narrow': { label: 'Approved for one narrow use', tone: 'accent' },
  'in-trials': { label: 'In trials', tone: 'accent-2' },
  'research-only': { label: 'Research chemical only', tone: 'warn' },
};

/**
 * Status key for the badge. An "approved" peptide approved only for one narrow use shows "Approved for
 * one narrow use". An "approved" peptide whose status label never affirms a US (FDA)
 * approval, e.g. "Registered as a medicine in Russia" or "Approved in some countries outside the
 * US ...; not FDA-approved", shows "Approved outside the US" instead of a bare "Approved".
 */
export function statusKey(level, statusLabel = '') {
  if (level !== 'approved') return level;
  const label = String(statusLabel || '');
  if (!label) return level;
  const affirmed = label
    .replace(/\bnot\s+(?:been\s+)?(?:part of any\s+)?FDA[-\s]approved(?:\s+medicine)?/gi, '')
    .replace(/\bno\s+FDA[-\s]approved\b[^;,.]*/gi, '')
    .replace(/\bnever\s+FDA[-\s]approved\b/gi, '');
  if (!/\bFDA[-\s]approved\b|\bapproved by the (?:US )?FDA\b/i.test(affirmed)) return 'approved-abroad';
  // "FDA-approved as Vyleesi, only for …": the badge says the approval is narrow (accuracy review),
  // so a bare "Approved" never reads as approval of what is sold online
  return /\bonly\b/i.test(label) ? 'approved-narrow' : 'approved';
}
export const SEVERITY = {
  common: { label: 'Common', tone: 'neutral', hint: 'Many people get this.' },
  notable: { label: 'Notable', tone: 'warn', hint: 'Less common, or worth watching for.' },
  serious: { label: 'Serious', tone: 'danger', hint: 'Rare, but can be dangerous. Get help fast.' },
};
export const VERDICT = {
  supported: { label: 'Supported', tone: 'accent' },
  partly: { label: 'Partly true', tone: 'warn' },
  'not-supported': { label: 'Not supported', tone: 'danger' },
  unknown: { label: 'Unknown', tone: 'neutral' },
};
export const EVIDENCE_LEVELS = ['anecdote', 'animal', 'small-human', 'large-trial'];
export const SITES = [
  { id: 'abdomen', label: 'Belly', sub: 'Abdomen' },
  { id: 'thigh', label: 'Thigh' },
  { id: 'arm', label: 'Upper arm' },
];

// ---- side effects tied to repeated use ----
/**
 * True for a side effect that comes with weeks to months of repeated use, not with any one shot
 * (safety review): its timing window is cumulative and starts two weeks or more after the first shot,
 * or the data marks it with timing.repeatedUse. These are left off the one-shot timeline under the
 * body and listed in the Side effects panel as "with repeated use".
 */
export function isRepeatedUse(fx) {
  const t = fx?.timing;
  if (!t) return false;
  if (typeof t.repeatedUse === 'boolean') return t.repeatedUse;
  return !!t.cumulative && Number(t.fromDays) >= 14;
}

// ---- formatters ----
/** Humanize a time in days for display ("about 18 hours", "about 5 days", "about 3 weeks"). */
export function fmtDays(t) {
  if (typeof t !== 'number' || !Number.isFinite(t)) return '';
  if (t < 2) { const h = Math.max(1, Math.round(t * 24)); return `about ${h} hour${h === 1 ? '' : 's'}`; }
  if (t < 21) { const d = Math.round(t); return `about ${d} days`; }
  const w = Math.round(t / 7); return `about ${w} weeks`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2025-06-23' → 'Jun 23, 2025'; '2025-06' → 'Jun 2025'; anything else is returned as given. */
export function fmtDate(d) {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(String(d || ''));
  if (!m || m[1] === '0000') return String(d || '');
  const [, y, mo, da] = m;
  const mi = Number(mo) - 1;
  if (!mo || !MONTHS[mi]) return y;
  if (!da || Number(da) === 0) return `${MONTHS[mi]} ${y}`;
  return `${MONTHS[mi]} ${Number(da)}, ${y}`;
}

/**
 * Source date with its qualifier: ('2026-10-07', 'accessed') → 'Accessed Oct 7, 2026';
 * ('2026-07-30', 'data last updated; accessed 2026-10-08') → 'Data last updated Jul 30, 2026; accessed Oct 8, 2026'.
 */
export function fmtSourceDate(date, note) {
  const d = fmtDate(date);
  const n = String(note || '').trim();
  if (!n) return d;
  const [first, ...rest] = n.split(/\s*;\s*/);
  const lead = first ? `${first.charAt(0).toUpperCase()}${first.slice(1)}${d ? ` ${d}` : ''}` : d;
  const tail = rest.map((r) => r.replace(/\b\d{4}-\d{2}(?:-\d{2})?\b/g, (m) => fmtDate(m)));
  return [lead, ...tail].filter(Boolean).join('; ');
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ---- plain-language helpers (v4: summaries are taken word for word from verified data) ----
/**
 * Split text into sentences. Splits after . ! ? when the next sentence starts with a capital,
 * a digit or an opening quote/bracket; decimals ("42.4%") and "vs." never split.
 */
export function sentences(text) {
  const s = String(text || '').trim();
  if (!s) return [];
  const out = [];
  let start = 0;
  const re = /[.!?]["”’)]?\s+(?=["“‘(]?[A-Z0-9])/g;
  let m;
  while ((m = re.exec(s))) {
    const end = m.index + m[0].trimEnd().length;
    const piece = s.slice(start, end).trim();
    if (/\b(?:vs|e\.g|i\.e|approx|Dr|St|No)\.$/i.test(piece)) continue;
    out.push(piece);
    start = re.lastIndex;
  }
  const tail = s.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

/** The first n sentences of a verified text, unchanged. */
export const firstSentences = (text, n = 1) => sentences(text).slice(0, n).join(' ');

/** "Inflamed pancreas (pancreatitis)" → "inflamed pancreas": a short name for running text. */
export function shortName(name) {
  const s = String(name || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return /^[A-Z][a-z]/.test(s) && !/^[A-Z]{2,}/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** ['a', 'b', 'c'] → "a, b and c". */
export function andList(items) {
  const a = items.filter(Boolean).map(String);
  if (a.length < 2) return a.join('');
  return `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
}

