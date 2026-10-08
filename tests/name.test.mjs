// The project is called PeptideScope (renamed 2026-10-08). No trace of the working title may remain
// anywhere in the repo: UI text, meta tags, code identifiers, storage keys, docs, tools or tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKIP = new Set(['.git', 'node_modules', '.cache', 'vendor']);
const TEXT = /\.(html|js|mjs|css|json|md|txt|svg|yml|yaml|webmanifest|cff)$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (TEXT.test(name)) out.push(p);
  }
  return out;
}

// Spelled out in pieces so this file does not match itself.
const OLD = new RegExp(['behind', '[ _-]?the[ _-]?', 'vial'].join(''), 'i');
const OLD_ABBR = new RegExp(['\\bb', 't', 'v[._-]|\\bB', 'T', 'V_'].join(''));

test('no reference to the old project name anywhere in the repo', () => {
  const hits = [];
  for (const p of walk(ROOT)) {
    const rel = relative(ROOT, p);
    if (rel === 'tests/name.test.mjs') continue;
    const lines = readFileSync(p, 'utf8').split('\n');
    lines.forEach((l, i) => { if (OLD.test(l) || OLD_ABBR.test(l)) hits.push(`${rel}:${i + 1}  ${l.trim().slice(0, 100)}`); });
  }
  assert.deepEqual(hits, []);
});

test('the name and tagline appear in the intro, header and footer', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /<title>PeptideScope/);
  const tagline = 'See what viral peptides really do inside your body.';
  assert.ok(html.split(tagline).length - 1 >= 3, 'tagline must appear in intro, header and footer');
  assert.match(html, /id="intro-title"[^>]*>PeptideScope</);
});
