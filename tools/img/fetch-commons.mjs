// Download the original of each intro photograph from Wikimedia Commons, together with a snapshot of
// its licence record (file-page wikitext + the API's extmetadata), into its own folder:
//   tools/.cache/photos/<name>/{original.<ext>, page.wikitext, meta.json}
// Downloads are untrusted data: they are only ever read as image bytes by tools/img/make-intro-photos.mjs.
//
// Usage: node tools/img/fetch-commons.mjs            (all photos in PHOTOS)
//        node tools/img/fetch-commons.mjs syringe     (one photo by name)
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHOTOS } from './photos.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CACHE = join(ROOT, 'tools', '.cache', 'photos');
const UA = 'PeptideScopeAssetBot/1.0 (https://saifmaati.github.io/peptidescope/; one-off licence check)';
const API = 'https://commons.wikimedia.org/w/api.php?';

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, as = 'json') {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 429) { await sleep(1000 * (Number(res.headers.get('retry-after')) || 30)); continue; }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return as === 'json' ? res.json() : Buffer.from(await res.arrayBuffer());
  }
  throw new Error(`rate-limited: ${url}`);
}

const only = process.argv[2];
for (const p of PHOTOS.filter(p => !only || p.name === only)) {
  const dir = join(CACHE, p.name);
  await mkdir(dir, { recursive: true });
  const q = new URLSearchParams({ action: 'query', format: 'json', titles: p.commons, prop: 'imageinfo|revisions',
    iiprop: 'url|size|sha1|mime|extmetadata', rvprop: 'content|timestamp|ids', rvslots: 'main' });
  const d = await get(API + q);
  const page = Object.values(d.query.pages)[0];
  const ii = page.imageinfo[0];
  const rev = page.revisions[0];
  const ext = extname(new URL(ii.url).pathname).toLowerCase() || '.jpg';
  const file = join(dir, `original${ext}`);
  const have = await stat(file).then(s => s.size === ii.size).catch(() => false);
  if (!have) await writeFile(file, await get(ii.url, 'buffer'));
  await writeFile(join(dir, 'page.wikitext'), rev.slots.main['*']);
  await writeFile(join(dir, 'meta.json'), JSON.stringify({
    title: page.title, filePage: ii.descriptionurl, original: ii.url, width: ii.width, height: ii.height,
    bytes: ii.size, sha1: ii.sha1, mime: ii.mime, pageRevision: rev.revid, pageRevisionTime: rev.timestamp,
    retrieved: new Date().toISOString(),
    extmetadata: Object.fromEntries(['LicenseShortName', 'LicenseUrl', 'UsageTerms', 'Artist', 'Credit', 'AttributionRequired', 'Copyrighted', 'Restrictions']
      .map(k => [k, ii.extmetadata?.[k]?.value ?? null])),
  }, null, 2));
  console.log(`${p.name}: ${page.title} ${ii.width}x${ii.height} ${(ii.size / 1024).toFixed(0)} KB ${have ? '(cached)' : ''} sha1 ${ii.sha1}`);
  await sleep(1500);
}
