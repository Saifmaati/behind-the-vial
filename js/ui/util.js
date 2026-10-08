// Behind the Vial: small shared helpers for the content UI.
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

export const prefersReducedMotion = () => {
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
  'in-trials': { label: 'In trials', tone: 'accent-2' },
  'research-only': { label: 'Research chemical only', tone: 'warn' },
};
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
  { id: 'abdomen', label: 'Abdomen', hint: 'Belly' },
  { id: 'thigh', label: 'Thigh', hint: 'Front of the leg' },
  { id: 'arm', label: 'Upper arm', hint: 'Back of the arm' },
];

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

/** First number in a cell like "−12.5%" or "33%" (Unicode minus aware). NaN when none. */
export function numberIn(text) {
  const m = /[-−–]?\d+(?:[.,]\d+)?/.exec(String(text ?? ''));
  return m ? Number(m[0].replace(/[−–]/, '-').replace(',', '.')) : NaN;
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Visible marker for placeholder data (sample: true). Never ships: tests fail while samples remain. */
export const sampleNote = () => html`<p class="c-sample" role="note"><span class="c-sample__tag">Sample data</span><span>Placeholder content for layout only. Verified, cited facts replace it before launch.</span></p>`;
