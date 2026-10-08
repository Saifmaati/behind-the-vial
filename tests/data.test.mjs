// Validates the content data against the contract in docs/ARCHITECTURE.md.
//   node --test tests/                       (fails while any sample: true remains)
//   BTV_ALLOW_SAMPLES=1 node --test tests/   (schema checks only, samples allowed)
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { SOURCES } = await import('../data/sources.js');
const { PEPTIDES } = await import('../data/peptides.js');
const { RISK_ITEMS } = await import('../data/riskitems.js');
const { GRAY } = await import('../data/graymarket.js');

const ALLOW_SAMPLES = process.env.BTV_ALLOW_SAMPLES === '1';

const ORGANS = new Set(['brain', 'thyroid', 'heart', 'lungs', 'liver', 'gallbladder', 'stomach', 'pancreas', 'spleen',
  'small_intestine', 'large_intestine', 'kidneys', 'bladder', 'skin', 'fat', 'injection_site', 'muscle', 'eyes', 'blood']);
const SOURCE_TYPES = new Set(['journal', 'regulator', 'label', 'company', 'trial-registry', 'nonprofit', 'testing-lab', 'news', 'health-service']);
const STATUS = new Set(['approved', 'in-trials', 'research-only']);
const SEVERITY = new Set(['common', 'notable', 'serious']);
const EVIDENCE = new Set(['anecdote', 'animal', 'small-human', 'large-trial']);
const VERDICTS = new Set(['supported', 'partly', 'not-supported', 'unknown']);
const STEP_IDS = new Set(['depot', 'capillary', 'lymph', 'blood', 'distribution']);
const SITES = ['abdomen', 'thigh', 'arm'];
const REQUIRED_RISK = ['heart-rhythm', 'pancreatitis', 'gallbladder', 'thyroid-mtc', 'pregnancy', 'diabetes-meds', 'kidney',
  'diabetic-eye', 'mood', 'surgery', 'gastroparesis', 'birth-control', 'moles-melanoma', 'eating-disorder'];
// Keys whose string value makes an object a "claim" that needs citations.
const TEXT_KEYS = ['text', 'effect', 'sign', 'claim', 'oneLine', 'detail', 'note', 'evidence', 'summary', 'intro'];

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Full entries (ready peptides) loaded through the catalog, exactly as the app does.
const ENTRIES = [];
for (const p of PEPTIDES.filter((x) => x.ready && typeof x.load === 'function')) {
  const mod = await p.load();
  ENTRIES.push(mod.default);
}

/** Depth-first walk yielding { value, path, key, parent }. */
function* walk(value, path = '$', key = null, parent = null) {
  yield { value, path, key, parent };
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) yield* walk(value[i], `${path}[${i}]`, i, value);
  }
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) if (typeof v !== 'function') yield* walk(v, `${path}.${k}`, k, value);
  }
}

const DATASETS = () => [
  ['SOURCES', SOURCES],
  ['PEPTIDES', PEPTIDES],
  ['RISK_ITEMS', RISK_ITEMS],
  ['GRAY', GRAY],
  ...ENTRIES.map((e) => [`entry:${e.id}`, e]),
];

function resolves(ids, where, problems) {
  if (!Array.isArray(ids) || !ids.length) { problems.push(`${where}: missing sources`); return; }
  for (const id of ids) if (!SOURCES[id]) problems.push(`${where}: unknown source "${id}"`);
}

test('sources registry is well formed', () => {
  const problems = [];
  for (const [id, s] of Object.entries(SOURCES)) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) problems.push(`${id}: id must be lowercase-kebab`);
    for (const k of ['title', 'publisher', 'date']) if (!isStr(s[k])) problems.push(`${id}: missing ${k}`);
    if (!/^https?:\/\//.test(s.url || '')) problems.push(`${id}: url must be http(s)`);
    if (!SOURCE_TYPES.has(s.type)) problems.push(`${id}: bad type "${s.type}"`);
    if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(s.date || '')) problems.push(`${id}: date must be YYYY, YYYY-MM or YYYY-MM-DD`);
  }
  assert.deepEqual(problems, []);
});

test('every sources array anywhere in the data resolves', () => {
  const problems = [];
  for (const [name, data] of DATASETS()) {
    if (name === 'SOURCES') continue;
    for (const { value, path, key } of walk(data, name)) {
      if (key === 'sources') resolves(value, path, problems);
    }
  }
  assert.deepEqual(problems, []);
});

test('every text-bearing object carries sources', () => {
  const problems = [];
  for (const [name, data] of DATASETS()) {
    if (name === 'SOURCES' || name === 'RISK_ITEMS') continue; // registry entries and checklist labels are not claims
    for (const { value, path, key } of walk(data, name)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      if (key === 'timing') continue; // display window derived from frequency/pk, not a separate claim
      if (TEXT_KEYS.some((k) => isStr(value[k]))) resolves(value.sources, path, problems);
    }
  }
  assert.deepEqual(problems, []);
});

test('peptide catalog: 21 entries, retatrutide first and ready, others coming soon', () => {
  assert.equal(PEPTIDES.length, 21);
  const ids = PEPTIDES.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate peptide ids');
  assert.equal(PEPTIDES[0].id, 'retatrutide');
  assert.equal(PEPTIDES[0].ready, true);
  assert.equal(typeof PEPTIDES[0].load, 'function');
  const problems = [];
  for (const p of PEPTIDES) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(p.id)) problems.push(`${p.id}: id must be lowercase-kebab`);
    if (!isStr(p.name)) problems.push(`${p.id}: name`);
    if (!Array.isArray(p.aka)) problems.push(`${p.id}: aka must be an array`);
    if (!STATUS.has(p.status)) problems.push(`${p.id}: status "${p.status}"`);
    if (!isStr(p.statusLabel)) problems.push(`${p.id}: statusLabel`);
    if (p.id !== 'retatrutide') {
      if (p.ready !== false) problems.push(`${p.id}: must be ready:false`);
      if (!isStr(p.oneLine)) problems.push(`${p.id}: oneLine`);
    }
  }
  assert.deepEqual(problems, []);
});

test('risk checklist covers the required history items', () => {
  const ids = RISK_ITEMS.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate risk ids');
  assert.deepEqual(REQUIRED_RISK.filter((id) => !ids.includes(id)), []);
  for (const r of RISK_ITEMS) {
    assert.ok(isStr(r.label), `${r.id}: label`);
    assert.ok(typeof r.hint === 'string', `${r.id}: hint`);
  }
});

test('gray-market data is well formed', () => {
  const problems = [];
  if (!isStr(GRAY.headline)) problems.push('headline');
  if (!isStr(GRAY.takeaway)) problems.push('takeaway');
  for (const [i, e] of (GRAY.enforcement || []).entries()) {
    if (!isStr(e.text) || !isStr(String(e.value ?? ''))) problems.push(`enforcement[${i}]: text/value`);
  }
  const vids = new Set();
  for (const [i, v] of (GRAY.vialTests || []).entries()) {
    if (!isStr(v.id) || vids.has(v.id)) problems.push(`vialTests[${i}]: id missing or duplicate`);
    vids.add(v.id);
    if (!isStr(v.label)) problems.push(`vialTests[${i}]: label`);
    if (!(v.pctOfLabel === null || (isNum(v.pctOfLabel) && v.pctOfLabel >= 0))) problems.push(`vialTests[${i}]: pctOfLabel must be a number >= 0 or null`);
    if (!['pass', 'fail'].includes(v.identity)) problems.push(`vialTests[${i}]: identity`);
    if (!(v.labeledMg === null || v.labeledMg === undefined || isNum(v.labeledMg))) problems.push(`vialTests[${i}]: labeledMg`);
  }
  if (!(GRAY.vialTests || []).length) problems.push('vialTests empty');
  assert.deepEqual(problems, []);
});

for (const e of ENTRIES) {
  test(`full entry "${e.id}" matches the contract`, () => {
    const p = [];
    const need = (cond, msg) => { if (!cond) p.push(msg); };
    for (const k of ['id', 'name', 'developer', 'route']) need(isStr(e[k]), `${k}`);
    need(Array.isArray(e.aka), 'aka array');
    need(STATUS.has(e.status?.level) && isStr(e.status?.label), 'status.level/label');
    need(Array.isArray(e.what) && e.what.length > 0, 'what[]');
    for (const [i, h] of (e.how || []).entries()) {
      need(isStr(h.receptor) && isStr(h.effect), `how[${i}] receptor/effect`);
      for (const o of h.organs || []) need(ORGANS.has(o), `how[${i}] organ "${o}"`);
    }
    need((e.how || []).length > 0, 'how[]');

    const pk = e.pk || {};
    need(isNum(pk.halfLifeDays) && pk.halfLifeDays > 0, 'pk.halfLifeDays');
    need(isNum(pk.tmaxDays) && pk.tmaxDays > 0, 'pk.tmaxDays');
    need(isNum(pk.halfLifeDays) && isNum(pk.tmaxDays) && pk.tmaxDays < pk.halfLifeDays / Math.LN2, 'pk.tmaxDays must be < halfLife/ln2 (absorption faster than elimination)');
    need(isNum(pk.intervalDays) && pk.intervalDays > 0, 'pk.intervalDays');
    need(Array.isArray(pk.phases) && pk.phases.length > 0, 'pk.phases');
    for (const [i, ph] of (pk.phases || []).entries()) need(isStr(ph.id) && isNum(ph.tDays) && ph.tDays >= 0 && isStr(ph.label), `pk.phases[${i}] id/tDays/label`);
    for (const id of ['onset', 'peak', 'clearance']) need((pk.phases || []).some((ph) => ph.id === id), `pk.phases has "${id}"`);

    for (const [i, s] of (e.absorption?.steps || []).entries()) need(STEP_IDS.has(s.id) && isStr(s.title) && isStr(s.text), `absorption.steps[${i}]`);
    for (const site of SITES) need(isStr(e.absorption?.sites?.[site]?.text), `absorption.sites.${site}`);

    for (const [i, t] of (e.targets || []).entries()) need(ORGANS.has(t.organ) && Array.isArray(t.receptors), `targets[${i}] organ/receptors`);

    const fxIds = new Set();
    for (const [i, fx] of (e.sideEffects || []).entries()) {
      need(isStr(fx.id) && !fxIds.has(fx.id), `sideEffects[${i}] id unique`);
      fxIds.add(fx.id);
      need(isStr(fx.name), `sideEffects[${i}] name`);
      need(ORGANS.has(fx.organ), `sideEffects[${i}] organ "${fx.organ}"`);
      for (const o of fx.alsoOrgans || []) need(ORGANS.has(o), `sideEffects[${i}] alsoOrgans "${o}"`);
      need(SEVERITY.has(fx.severity), `sideEffects[${i}] severity`);
      for (const k of ['frequency', 'why', 'reduce']) need(isStr(fx[k]?.text), `sideEffects[${i}].${k}.text`);
      need(isNum(fx.timing?.fromDays) && isNum(fx.timing?.toDays) && fx.timing.fromDays <= fx.timing.toDays, `sideEffects[${i}].timing from<=to`);
    }
    need(fxIds.size > 0, 'sideEffects[]');

    need((e.redFlags?.call911 || []).length > 0, 'redFlags.call911');
    need((e.redFlags?.doctorToday || []).length > 0, 'redFlags.doctorToday');
    for (const k of ['call911', 'doctorToday']) for (const [i, f] of (e.redFlags?.[k] || []).entries()) need(isStr(f.sign), `redFlags.${k}[${i}].sign`);

    need((e.tooMuch?.signs || []).length > 0 && (e.tooMuch?.whatToDo || []).length > 0, 'tooMuch signs/whatToDo');

    for (const [i, t] of (e.doseFacts?.trials || []).entries()) {
      need(isStr(t.id) && isStr(t.name), `doseFacts.trials[${i}] id/name`);
      const cols = t.columns || [];
      for (const [j, r] of (t.rows || []).entries()) {
        need(isStr(r.arm), `doseFacts.trials[${i}].rows[${j}].arm`);
        const n = (r.cells || []).length;
        need(n === cols.length || n === cols.length - 1, `doseFacts.trials[${i}].rows[${j}] cells (${n}) vs columns (${cols.length})`);
      }
      for (const c of t.chart?.columns || []) need(cols.includes(c), `doseFacts.trials[${i}].chart column "${c}" not in columns`);
    }

    need(EVIDENCE.has(e.evidence?.level), 'evidence.level');
    for (const [i, r] of (e.evidence?.rungs || []).entries()) need(EVIDENCE.has(r.level), `evidence.rungs[${i}].level`);

    for (const [i, c] of (e.claims || []).entries()) need(isStr(c.claim) && VERDICTS.has(c.verdict) && isStr(c.evidence), `claims[${i}]`);

    const riskIds = new Set(RISK_ITEMS.map((r) => r.id));
    for (const [k, list] of Object.entries(e.risk || {})) {
      need(riskIds.has(k), `risk key "${k}" is not in RISK_ITEMS`);
      for (const [i, w] of (list || []).entries()) need(ORGANS.has(w.organ) && isStr(w.title) && isStr(w.text), `risk.${k}[${i}] organ/title/text`);
    }
    assert.deepEqual(p, []);
  });
}

test('data text never reads as dosing instructions or a safety verdict', () => {
  const bad = [
    /\bmg\s*\/\s*kg\b/i, /\bper kilogram\b/i, /titrat/i, /reconstitut/i, /bacteriostatic/i,
    /\b(recommended|starting|maintenance|target|safe) (dose|dosage|amount)\b/i,
    /\bdraw (up|back)\b/i, /\bpinch (the|your) skin\b/i, /\bdegree angle\b/i,
    /\byou(?:'| a)re (safe|cleared|fine|ok)\b/i, /\bsafe for you to\b/i, /\byou can safely\b/i, /\blow risk for you\b/i,
  ];
  const hits = [];
  for (const [name, data] of DATASETS()) {
    for (const { value, path } of walk(data, name)) {
      if (typeof value !== 'string') continue;
      for (const re of bad) if (re.test(value)) hits.push(`${path}: ${value.slice(0, 80)}`);
    }
  }
  assert.deepEqual(hits, []);
});

test('no sample placeholders remain (set BTV_ALLOW_SAMPLES=1 to skip while building)', { skip: ALLOW_SAMPLES ? 'BTV_ALLOW_SAMPLES=1' : false }, () => {
  const samples = [];
  for (const [name, data] of DATASETS()) {
    for (const { value, path } of walk(data, name)) {
      if (value && typeof value === 'object' && !Array.isArray(value) && value.sample === true) samples.push(path);
    }
  }
  assert.equal(samples.length, 0, `${samples.length} sample objects remain, e.g.\n  ${samples.slice(0, 12).join('\n  ')}`);
});
