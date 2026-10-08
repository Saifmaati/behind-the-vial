// PeptideScope must never read like a peptide seller: no prices, no buy/shop/discount language,
// no seller names, and no links anywhere except the cited authoritative sources and project pages.
// Scans what ships to visitors: index.html, 404.html, js/, data/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(html|js|mjs)$/.test(n)) out.push(p);
  }
  return out;
}
const files = [join(ROOT, 'index.html'), join(ROOT, '404.html'), ...walk(join(ROOT, 'js')), ...walk(join(ROOT, 'data'))]
  .filter(existsSync).map(p => ({ path: relative(ROOT, p), text: readFileSync(p, 'utf8') }));
// data/sources.js holds citation metadata (titles of FDA letters etc.), checked separately below.
const content = files.filter(f => f.path !== 'data/sources.js');
const hitsFor = (re, list = content) => list.flatMap(f => [...f.text.matchAll(re)].map(m => `${f.path}: …${f.text.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')}…`));

test('no prices or currency amounts', () => {
  assert.deepEqual(hitsFor(/[$€£]\s?\d|\b\d+(?:\.\d+)?\s?(?:USD|EUR|GBP|AUD|dollars?|euros?)\b/gi), []);
});

test('no buy, shop, discount or checkout language', () => {
  assert.deepEqual(hitsFor(/\b(buy|buys|buying|bought|purchas\w*|shop|shops|shopping|discount\w*|coupon\w*|promo(?:tion(?:al)?)? codes?|add to cart|checkout|order now|best price|cheap\w*)\b/gi), []);
});

test('no seller names (only regulators, labs, journals and the manufacturer are named)', () => {
  const sellers = /\b(Prime Peptides|Swisschems|Xcel Research|Summit Research|Pink Pony|Gram Peptides|Prime Sciences|Mile High Compounds|Peak Performance Peptides|Royal Peptides|NuScience|Peptide Partners|TXP Innovations|Darmerica|GenoGenix|Aesthetic Envy|Astra Peptides|Legendary Peptides|INDR Labs|BiotechPeptides|SemaSpace|USChemLabs|Peptide Gurus|VertexBio|Reta-Peptide|Loti Labs|Maddox Research|Lumira|Forever Young Pharmacy|Injectify)\b/gi;
  assert.deepEqual(hitsFor(sellers), []);
});

test('every external link points to a cited source host or a project page', async () => {
  const { SOURCES } = await import(join(ROOT, 'data/sources.js'));
  const allowed = new Set(Object.values(SOURCES).map(s => { try { return new URL(s.url).host; } catch { return ''; } }));
  for (const h of ['github.com', 'saifmaati.github.io', 'creativecommons.org', '988lifeline.org', 'poisoncenters.org', 'www.poison.org']) allowed.add(h);
  const urls = content.flatMap(f => [...f.text.matchAll(/https?:\/\/[^\s"'`<>)]+/g)].map(m => ({ f: f.path, u: m[0] })));
  const bad = urls.filter(({ u }) => { try { return !allowed.has(new URL(u).host); } catch { return true; } })
    .filter(({ u }) => !/^https?:\/\/(www\.)?w3\.org\//.test(u)) // SVG/XML namespaces
    .map(({ f, u }) => `${f}: ${u}`);
  assert.deepEqual(bad, []);
});
