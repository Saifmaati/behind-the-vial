// PeptideScope: "What's really in the vial" (v4): what independent labs found inside
// vials sold online, contamination and sterility, reported harms and enforcement.
// Core message (the summary): with these products you cannot know how much you are getting.
//
// No charts. The vial tests are drawn as a row of glass vials: each vial's fill shows
// the share of the label amount the lab found, a thin line marks the label amount, and a
// vial where none of the labeled drug was found is drawn empty with a ∅ mark. The exact
// figure is printed under every vial; each vial's lab note opens in a row underneath.
// Label amounts in mg are never shown: only "% of the label".
import { html, raw, uid, plural } from './util.js';
import { icon } from './icons.js';
import { summary, group, more } from './blocks.js';

// ---------------------------------------------------------------------------
// shared summary (also used by #too-much)

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Plain-language summary computed from the vial data (no invented thresholds). */
export function graySummary(gray, { lead } = {}) {
  const tests = gray?.vialTests || [];
  const measured = tests.map((t) => t.pctOfLabel).filter(isNum);
  const none = tests.filter((t) => t.pctOfLabel == null).length;
  if (!tests.length) return { n: 0, sentence: '' };
  const lo = measured.length ? Math.min(...measured) : null;
  const hi = measured.length ? Math.max(...measured) : null;
  const parts = [];
  if (measured.length > 1) parts.push(`the amount of the labeled drug ranged from ${fmtPct(lo)} to ${fmtPct(hi)} of what the label claimed`);
  else if (measured.length === 1) parts.push(`one vial held ${fmtPct(lo)} of what the label claimed`);
  if (none) parts.push(`${none === tests.length ? 'none' : plural(none, 'vial')} held none of the labeled drug at all`);
  const intro = lead || `In these ${plural(tests.length, 'vial test')}`;
  const sentence = parts.length ? `${intro}, ${parts.join(', and ')}.` : '';
  return { n: tests.length, lo, hi, none, sentence };
}

/** 51.3 → "51.3%", 165 → "165%" (the published figure, never rounded). */
function fmtPct(v) { return `${String(v)}%`; }

// ---------------------------------------------------------------------------
// the glass vial (inline SVG, colors from CSS classes so both themes work)

const VB_W = 96;
const VB_H = 200;
const FILL_BOTTOM = 187.5;   // inside of the glass floor
const FILL_TOP = 60;         // highest fill line that stays below the shoulder
const GLASS = 'M31 30V36C31 42 14 44 14 54V178Q14 190 26 190H70Q82 190 82 178V54C82 44 65 42 65 36V30Z';
const INSIDE = 'M33.5 31V36.5C33.5 43.5 16.5 45.5 16.5 55V177.5Q16.5 187.5 26.5 187.5H69.5Q79.5 187.5 79.5 177.5V55C79.5 45.5 62.5 43.5 62.5 36.5V31Z';
const f1 = (n) => (Math.round(n * 10) / 10).toString();

/** Fill height scale: the fullest vial plus headroom, at least twice the label amount. */
function scaleMaxFor(tests) {
  const top = Math.max(100, ...tests.map((t) => (isNum(t.pctOfLabel) ? t.pctOfLabel : 0)));
  return Math.max(200, Math.ceil((top * 1.04) / 50) * 50);
}

function vialSvg(test, scaleMax) {
  const id = uid('vial');
  const y = (p) => FILL_BOTTOM - (p / scaleMax) * (FILL_BOTTOM - FILL_TOP);
  const y100 = f1(y(100));
  const none = !isNum(test.pctOfLabel);
  const yf = none ? FILL_BOTTOM : y(Math.max(0, test.pctOfLabel));
  let fill = '';
  if (!none && test.pctOfLabel > 0) {
    fill = `<g clip-path="url(#${id}-in)">
      <rect class="c-vial__fill" x="14" y="${f1(yf)}" width="68" height="${f1(FILL_BOTTOM - yf + 4)}" fill="url(#${id}-fill)"/>
      <ellipse class="c-vial__cake" cx="48" cy="${f1(yf)}" rx="31.5" ry="2.4"/>
    </g>`;
  }
  const mark = none
    ? `<g class="c-vial__none"><circle cx="48" cy="150" r="11"/><path d="M40.2 157.8 55.8 142.2"/></g>`
    : '';
  return raw(`<svg class="c-vial__svg" viewBox="0 0 ${VB_W} ${VB_H}" aria-hidden="true" focusable="false">
  <defs>
    <clipPath id="${id}-in"><path d="${INSIDE}"/></clipPath>
    <linearGradient id="${id}-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="c-vial__stop-a"/><stop offset="1" class="c-vial__stop-b"/>
    </linearGradient>
    <linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" class="c-vial__glass-a"/><stop offset=".45" class="c-vial__glass-b"/><stop offset="1" class="c-vial__glass-a"/>
    </linearGradient>
    <linearGradient id="${id}-metal" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" class="c-vial__metal-a"/><stop offset=".38" class="c-vial__metal-b"/><stop offset="1" class="c-vial__metal-a"/>
    </linearGradient>
  </defs>
  <ellipse class="c-vial__shadow" cx="48" cy="193" rx="34" ry="3"/>
  <path class="c-vial__glass" d="${GLASS}" fill="url(#${id}-glass)"/>
  ${fill}
  ${mark}
  <path class="c-vial__heel" d="M17 180.5Q17 187.5 26.5 187.5H69.5Q79 187.5 79 180.5"/>
  <path class="c-vial__shoulder" d="M30.5 40.5C24 43 18.5 46 17.6 53"/>
  <rect class="c-vial__hl" x="20" y="62" width="3.6" height="110" rx="1.8"/>
  <rect class="c-vial__hl c-vial__hl--thin" x="75" y="66" width="1.4" height="98" rx=".7"/>
  <path class="c-vial__edge" d="${GLASS}"/>
  <rect class="c-vial__crimp" x="28" y="14" width="40" height="17" rx="2.2" fill="url(#${id}-metal)"/>
  <path class="c-vial__crimpline" d="M28.5 19.5H67.5M28.5 26H67.5"/>
  <rect class="c-vial__flip" x="31" y="6" width="34" height="9" rx="2.6"/>
  <g class="c-vial__label">
    <path d="M5 ${y100}H91"/>
    <path d="M5 ${f1(y(100) - 3)}V${f1(y(100) + 3)}M91 ${f1(y(100) - 3)}V${f1(y(100) + 3)}"/>
  </g>
</svg>`);
}

const IDENTITY = { pass: 'Labeled drug found', fail: 'Labeled drug not found' };

function vialItem(t, scaleMax) {
  const none = !isNum(t.pctOfLabel);
  return html`
  <li class="c-vial${none ? ' c-vial--none' : ''}" data-vial="${t.id}">
    <div class="c-vial__art">${vialSvg(t, scaleMax)}</div>
    <p class="c-vial__fig">${none ? 'None' : fmtPct(t.pctOfLabel)}</p>
    <p class="c-vial__of">${none ? 'of the labeled drug found' : 'of the amount on the label'}</p>
    <p class="c-vial__name">${t.label}</p>
    <p class="c-vial__sold">Sold as retatrutide</p>
    ${!none && IDENTITY[t.identity] ? html`<p class="c-vial__id c-vial__id--${t.identity}"><span class="c-vial__idmark" aria-hidden="true"></span>${IDENTITY[t.identity]}</p>` : ''}
  </li>`;
}

function vialFigure(gray, ctx) {
  const tests = [...(gray.vialTests || [])].sort((a, b) => (isNum(a.pctOfLabel) ? a.pctOfLabel : -1) - (isNum(b.pctOfLabel) ? b.pctOfLabel : -1));
  if (!tests.length) return '';
  const scaleMax = scaleMaxFor(tests);
  const listLabel = uid('vials');
  const anyNone = tests.some((t) => !isNum(t.pctOfLabel));
  return html`
  <figure class="c-vials">
    <p class="c-sr" id="${listLabel}">Tested vials, drawn to scale, from the least to the most drug found</p>
    <ul class="c-vials__row" role="list" aria-labelledby="${listLabel}" style="--n: ${tests.length}">
      ${tests.map((t) => vialItem(t, scaleMax))}
    </ul>
    <figcaption>
      <ul class="c-vials__key" role="list" aria-label="How to read the vials">
        <li><span class="c-vials__swatch c-vials__swatch--fill" aria-hidden="true"></span>Fill: the labeled drug the lab found</li>
        <li><span class="c-vials__swatch c-vials__swatch--line" aria-hidden="true"></span>Thin line: what the label promised</li>
        ${anyNone ? html`<li><span class="c-vials__swatch c-vials__swatch--none" aria-hidden="true"></span>Empty with ∅: none of the labeled drug found</li>` : ''}
      </ul>
    </figcaption>
  </figure>
  <p class="c-kv__k c-vials__more">What the lab said about each vial</p>
  <div class="c-rows">
    ${tests.map((t) => more(
      html`<span class="c-row__name">${t.label}</span><span class="c-row__meta">${isNum(t.pctOfLabel) ? `${fmtPct(t.pctOfLabel)} of the label` : 'None of the labeled drug'}${ctx.mark(t)}</span>`,
      html`${IDENTITY[t.identity] ? html`<p class="c-kv__k">${IDENTITY[t.identity]}</p>` : ''}<p>${t.note || ''}${ctx.mark(t)}</p>`,
      { attrs: html` data-vial-note="${t.id}"` },
    ))}
  </div>`;
}

// ---------------------------------------------------------------------------
// enforcement items, grouped for reading (ids from data/graymarket.js; any new
// id falls into the enforcement group, so nothing is ever dropped)

const LAB_IDS = ['finnrick-identity', 'finnrick-range'];
const HARM_IDS = ['fda-reports', 'case-reports', 'tga-test', 'victoria-liver'];

function groupEnforcement(items = []) {
  const lab = [];
  const harm = [];
  const enforcement = [];
  for (const e of items) {
    if (!e) continue;
    if (LAB_IDS.includes(e.id)) lab.push(e);
    else if (HARM_IDS.includes(e.id)) harm.push(e);
    else enforcement.push(e);
  }
  return { lab, harm, enforcement };
}

const isWordValue = (v) => !/\d/.test(String(v || ''));

/** A value-first fact line: "21  FDA warning letters that mention retatrutide …". */
function factList(items, ctx, tone = '') {
  if (!items?.length) return '';
  return html`
  <ul class="c-facts-list${tone ? ` c-facts-list--${tone}` : ''}" role="list">
    ${items.map((e) => html`
    <li class="c-fact" data-fact="${e.id}">
      <p class="c-fact__value${isWordValue(e.value) ? ' is-word' : ''}">${e.value}</p>
      <p class="c-fact__text">${e.text}${ctx.mark(e)}</p>
    </li>`)}
  </ul>`;
}

function contaminationRows(items, ctx) {
  if (!items?.length) return '';
  return html`<div class="c-rows">${items.map((c) => more(
    html`<span class="c-row__name">${c.title}</span>`,
    html`<p>${c.text}${ctx.mark(c)}</p>`,
    { attrs: html` data-fact="${c.id}"` },
  ))}</div>`;
}

// ---------------------------------------------------------------------------

/**
 * All the vial tests and lab figures here are of vials sold as RETATRUTIDE. For any other peptide the
 * panel says so first (accuracy review: a reader must never think its own peptide was tested).
 */
export function renderGrayMarket(gray, ctx, { peptide = null } = {}) {
  if (!gray) return '';
  const { lab, harm, enforcement } = groupEnforcement(gray.enforcement);
  const other = peptide && peptide.id && peptide.id !== 'retatrutide' ? peptide : null;
  const sum = graySummary(gray, other ? { lead: `In the ${plural((gray.vialTests || []).length, 'vial')} sold as retatrutide that labs tested` } : {});
  const testSources = [...new Set((gray.vialTests || []).flatMap((t) => t.sources || []))];

  return html`
  <div class="c-panel c-panel--gray">
    ${other ? html`<p class="c-notice c-notice--info" role="note">${icon('info', { size: 20 })}<span><strong>No lab tests of ${other.name} vials are shown yet.</strong> The tests on this page are of vials sold as retatrutide, and they show the same problem: you can’t know what is inside a vial sold online.</span></p>` : ''}
    ${summary(html`${gray.headline}${sum.sentence ? html` ${sum.sentence}` : ''}${ctx.cite(testSources)}`)}
    ${group({
      title: 'What labs found inside vials sold as retatrutide',
      sub: 'Each vial is drawn to scale. The fill shows how much of the labeled drug the lab found; the thin line marks what the label promised.',
      id: uid('gvials'),
      body: vialFigure(gray, ctx),
    })}
    ${gray.intro ? group({ title: other ? 'How retatrutide vials are sold' : 'How these vials are sold', id: uid('gintro'), body: html`<p>${gray.intro}${ctx.cite(gray.sources)}</p>` }) : ''}
    ${group({ title: other ? 'More lab results (retatrutide vials)' : 'More lab results', id: uid('glab'), body: factList(lab, ctx) })}
    ${group({ title: 'Germs, toxins and other contaminants', id: uid('gcont'), body: contaminationRows(gray.contamination, ctx) })}
    ${group({ title: 'People who got hurt', id: uid('gharm'), tone: 'danger', body: factList(harm, ctx, 'danger') })}
    ${group({ title: 'What regulators are doing', id: uid('genf'), body: factList(enforcement, ctx) })}
    ${gray.takeaway ? html`<p class="c-callout c-callout--warn">${icon('alert', { size: 22 })}<span>${gray.takeaway}${ctx.cite(gray.sources)}</span></p>` : ''}
  </div>`;
}
