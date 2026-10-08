// Guards the brief's HARD EXCLUSIONS and required safety furniture.
// Scans only what ships to visitors: index.html, 404.html, css/, js/, data/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SHIPPED_DIRS = ['js', 'data', 'css'];
const SHIPPED_FILES = ['index.html', '404.html'];

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(html|js|mjs|css|json)$/.test(name)) out.push(p);
  }
  return out;
}

const files = [
  ...SHIPPED_FILES.map(f => join(ROOT, f)).filter(existsSync),
  ...SHIPPED_DIRS.flatMap(d => walk(join(ROOT, d))),
].map(p => ({ path: relative(ROOT, p), text: readFileSync(p, 'utf8') }));

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
function findAll(re, { only } = {}) {
  const hits = [];
  for (const f of files) {
    if (only && !only.test(f.path)) continue;
    for (const m of f.text.matchAll(re)) hits.push(`${f.path}:${lineOf(f.text, m.index)}  ${m[0].slice(0, 120)}`);
  }
  return hits;
}

test('shipped files were found', () => {
  assert.ok(files.some(f => f.path === 'index.html'), 'index.html missing');
});

test('no numeric entry fields anywhere (nothing to type a dose, weight or lab value into)', () => {
  assert.deepEqual(findAll(/type\s*=\s*["'`]?number/gi), []);
  assert.deepEqual(findAll(/\.type\s*=\s*["'`]number["'`]/gi), []);
});

// The owner asked (2026-10-08) for an editable body: sex, height, weight, age. It is allowed ONLY
// as an appearance control in js/ui/bodyeditor.js, and it may never reach the timeline, PK model,
// effects, risk check or content.
const BODY_EDITOR = 'js/ui/bodyeditor.js';

test('range inputs exist only in the time scrubber and the appearance-only body editor', () => {
  const hits = findAll(/type\s*=\s*["'`]?range|\.type\s*=\s*["'`]range/gi)
    .filter(h => !h.startsWith('js/timeline.js') && !h.startsWith(BODY_EDITOR));
  assert.deepEqual(hits, []);
});

test('no input, select or textarea is named or labelled for dose, weight, sex or lab values (outside the body editor)', () => {
  const tagRe = /<(input|select|textarea)\b[^>]*>/gi;
  const bad = /\b(dose|dosage|dosing|mg|mcg|milligram|units?|weight|kg|lbs?|bmi|gender|sex|creatinine|egfr|a1c|bloodwork|amount|volume|ml)\b/i;
  const hits = findAll(tagRe).filter(h => !h.startsWith(BODY_EDITOR) && bad.test(h.replace(/aria-describedby="[^"]*"/, '')));
  assert.deepEqual(hits, []);
});

test('body editor is appearance-only: never mentions dose, carries the disclaimer, and only the 3D scene listens to it', () => {
  const editor = files.find(f => f.path === BODY_EDITOR);
  if (!editor) return; // not built yet
  assert.match(editor.text, /data-appearance-only/, 'body editor inputs must carry data-appearance-only');
  assert.match(editor.text, /never changes the timeline/i, 'body editor must say it never changes the timeline');
  assert.doesNotMatch(editor.text.replace(/suggests? a dose|never[^.]{0,80}dose/gi, ''), /\bdos(e|es|ing|age)\b|\bmg\b|\blevels?\b/i, 'body editor may not talk about doses or levels');
  assert.doesNotMatch(editor.text, /from ['"]\.\.?\/(?:\.\.\/)?(?:pk|timeline|effects)\.js['"]/, 'body editor may not import pk/timeline/effects');
  const listeners = findAll(/['"`]body:change['"`]/g).filter(h => !h.startsWith('js/scene/') && !h.startsWith(BODY_EDITOR) && !h.startsWith('js/bus.js'));
  assert.deepEqual(listeners, [], 'only js/scene/* may consume body:change');
  for (const f of files.filter(f => /^js\/(pk|timeline|effects)\.js$|^js\/ui\/(?!bodyeditor)/.test(f.path))) {
    assert.doesNotMatch(f.text, /heightCm|weightKg|bodyeditor/, `${f.path} must not read body editor state`);
  }
});

test('no dose calculators, safe-dose language, titration, reconstitution or technique wording', () => {
  const phrases = [
    /safe[\s-]+(dose|dosage|amount|range|zone)/gi,
    /dos(e|ing|age)[\s-]+calculat/gi,
    /calculate (your|a|the) dose/gi,
    /\byour dose (is|should)/gi,
    /\b(recommended|starting|maintenance|target) dose\b/gi,
    /titration (schedule|plan|protocol|chart)/gi,
    /reconstitut/gi,
    /bacteriostatic/gi,
    /\bmg\s*\/\s*kg\b|\bmg per (kg|kilogram|pound)\b|\bper kilogram\b/gi,
    /\bdraw (up|back)\b/gi,
    /\b\d+\s*-?\s*degree angle\b/gi,
    /\bpinch (the|your) skin\b/gi,
    /\byou(?:'| a)re (cleared|good to go)\b/gi,
    /\bsafe for you to\b/gi,
    /\byou can safely\b/gi,
    /\b(start|begin) (at|with) \d+(\.\d+)?\s*mg\b/gi,
    /(increase|escalate|step(?:ped)? up|go up)[^.]{0,60}\bevery \d+ (days?|weeks?)\b/gi,
  ];
  const hits = phrases.flatMap(re => findAll(re));
  assert.deepEqual(hits, []);
});

test('no "safe"-green success colours used for outcomes in status/verdict/risk styles', () => {
  const css = files.filter(f => f.path.startsWith('css/'));
  const hits = [];
  for (const f of css) {
    for (const m of f.text.matchAll(/\.(?:[\w-]*(?:safe|cleared|ok|pass|approved|supported|low-risk)[\w-]*)[^{]*\{[^}]*\}/gi)) {
      if (/#(?:2e7d32|4caf50|22c55e|16a34a|10b981|00c853|0f0|00ff00)\b|\bgreen\b|lime/i.test(m[0])) hits.push(`${f.path}:${lineOf(f.text, m.index)}`);
    }
  }
  assert.deepEqual(hits, []);
});

test('persistent disclaimer and pharmacist-review marker are on the page', () => {
  const html = files.find(f => f.path === 'index.html').text;
  assert.match(html, /id="disclaimer"/, '#disclaimer bar missing');
  const bar = html.slice(html.indexOf('id="disclaimer"'), html.indexOf('id="disclaimer"') + 800);
  for (const words of [/education/i, /not medical advice/i, /no dosing/i, /clinician/i]) assert.match(bar, words, `disclaimer bar lacks ${words}`);
  assert.match(html, /Pharmacist review:\s*pending/i);
});

test('every peptide named in the brief is in the catalog', async () => {
  const p = join(ROOT, 'data/peptides.js');
  if (!existsSync(p)) return assert.fail('data/peptides.js missing');
  const { PEPTIDES } = await import(p);
  const names = PEPTIDES.map(x => `${x.name} ${(x.aka || []).join(' ')}`.toLowerCase()).join(' | ');
  const want = ['retatrutide', 'semaglutide', 'tirzepatide', 'cagrilintide', 'tesamorelin', 'cjc-1295', 'ipamorelin', 'sermorelin', 'bpc-157', 'tb-500', 'ghk-cu', 'melanotan ii', 'melanotan i', 'pt-141', 'mots-c', 'ss-31', 'epitalon', 'semax', 'selank', 'thymosin alpha-1', 'kpv'];
  const missing = want.filter(w => !names.includes(w));
  assert.deepEqual(missing, []);
  assert.equal(PEPTIDES.filter(x => x.ready).map(x => x.id).join(), 'retatrutide');
});
