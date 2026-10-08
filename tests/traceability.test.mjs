// "Do not invent numbers": every fact object in data/ must trace to usable claims in
// research/claims.json (the fact-checked ledger), cite exactly the sources behind those
// claims, and every number it shows must appear in those claims.
//
// Rules for objects that carry `sources` (text-bearing objects):
//   - `ledger: [claimId, ...]` lists the ledger claims the text is based on, or
//     `editorial: true` marks plain framing text with no facts (then it may not contain digits);
//   - every ledger id exists in research/claims.json and is usable (not refuted / disallowed);
//   - `sources` equals the set of sourceIds of its ledger claims (no extra, none missing),
//     and every source id exists in data/sources.js;
//   - if any ledger claim is unverified, the object carries `unverified: true`;
//   - every number in its strings (and numeric fields, except modelling fields such as the
//     timeline windows) appears in the text of its ledger claims;
//   - strings outside fact objects (labels, timing notes) contain no numbers at all.
// Per-file check while writing: node tools/trace.mjs data/<file>.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLedger, checkRoot } from '../tools/trace-lib.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LEDGER = `${ROOT}research/claims.json`;
const ready = existsSync(LEDGER);

test('every fact object traces to usable ledger claims, cites their sources, and invents no numbers', { skip: !ready && 'research/claims.json not generated yet' }, async () => {
  const claims = loadLedger(LEDGER);
  const { SOURCES } = await import(`${ROOT}data/sources.js`);
  const ids = new Set(Object.keys(SOURCES));
  const roots = {
    retatrutide: (await import(`${ROOT}data/retatrutide.js`)).default,
    graymarket: (await import(`${ROOT}data/graymarket.js`)).GRAY,
    peptides: (await import(`${ROOT}data/peptides.js`)).PEPTIDES.map(({ load, ...p }) => p),
  };
  const problems = Object.entries(roots).flatMap(([name, root]) => checkRoot(name, root, claims, ids));
  assert.deepEqual(problems, []);
});
