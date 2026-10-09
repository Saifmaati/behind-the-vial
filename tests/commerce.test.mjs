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

const SELLERS = /\b(Prime Peptides|Swisschems|Xcel Research|Summit Research|Pink Pony|Gram Peptides|Prime Sciences|Mile High Compounds|Peak Performance Peptides|Royal Peptides|NuScience|Peptide Partners|TXP Innovations|Darmerica|GenoGenix|Aesthetic Envy|Astra Peptides|Legendary Peptides|INDR Labs|BiotechPeptides|SemaSpace|USChemLabs|Peptide Gurus|VertexBio|Reta-Peptide|Loti Labs|Maddox Research|Lumira|Forever Young Pharmacy|Injectify)\b/gi;

test('no seller names (only regulators, labs, journals and the manufacturer are named)', () => {
  assert.deepEqual(hitsFor(new RegExp(SELLERS.source, 'gi')), []);
});

// The source registry ships too (data/sources.js, generated): a citation must never become a
// buyer's guide one tap away. Titles may not name sellers, vendors or prices; URLs may not point at
// product, vendor, seller, price or per-seller certificate pages. The one allowed "/products/" path is
// the manufacturer's medical-information Q&A (medical.lilly.com/…/products/answers/…), which sells nothing.
test('source records (titles and URLs) name no seller and link no product, vendor or price page', async () => {
  const { SOURCES } = await import(join(ROOT, 'data/sources.js'));
  const bad = [];
  for (const [id, s] of Object.entries(SOURCES)) {
    const title = String(s.title || '');
    const url = String(s.url || '');
    let host = '';
    try { host = new URL(url).host; } catch { bad.push(`${id}: bad url`); }
    if (new RegExp(SELLERS.source, 'i').test(`${title} ${url}`)) bad.push(`${id}: names a seller`);
    if (/vendor|price/i.test(title)) bad.push(`${id}: title "${title}"`);
    if (/vendor|seller|price|testing-certificate/i.test(url)) bad.push(`${id}: url ${url}`);
    if (/\/products\//i.test(url) && !(host === 'medical.lilly.com' && /\/products\/answers\//.test(url))) bad.push(`${id}: product page ${url}`);
  }
  assert.deepEqual(bad, []);
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
