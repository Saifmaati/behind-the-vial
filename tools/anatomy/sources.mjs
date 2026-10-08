// Source registry, download + verification + safe extraction for the anatomy pipeline.
// Everything downloaded is treated as untrusted data: stored under tools/.cache/anatomy-raw/<source>/,
// verified by SHA-256, extracted with `unzip` after a path-safety check, and only ever parsed (never run).
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const SOURCES = [
  {
    id: 'hra-united-male', dir: 'hra', file: 'glb/3d-vh-m-united-v1.9.glb',
    url: 'https://cdn.humanatlas.io/digital-objects/ref-organ/united-male/v1.9/assets/3d-vh-m-united.glb',
    sha256: '958fcb9ffebfbdf4df559bb329ceecb3858458cd2e7d5f3d57f96a40439a8274',
  },
  {
    id: 'hra-united-male-crosswalk', dir: 'hra', file: 'glb/crosswalk-united-male-v1.9.csv',
    url: 'https://cdn.humanatlas.io/digital-objects/ref-organ/united-male/v1.9/assets/crosswalk.csv',
    sha256: 'e20a005b73a65b498cbb0d21d3cf8897d5b90bd94012dc8dcada4dbf5cf7cb04',
  },
  {
    id: 'sio-labels-zip', dir: 'sio', file: 'zip/VOXEL-MAN_segmented-internal-organs.zip',
    url: 'https://zenodo.org/api/records/15882019/files/VOXEL-MAN_segmented-internal-organs.zip/content',
    md5: 'dbdfada24e69591bdf9650453918d9ef', // as published by Zenodo
    sha256: 'b45f2f965b7ed6577b3ab78dd74eb0cab3d44a52c6e8c97dd80981747c56120b',
  },
  {
    id: 'sio-label-table', dir: 'sio', file: 'zip/SIO_Object_Labels.xlsx',
    url: 'https://zenodo.org/api/records/15882019/files/SIO%20Object%20Labels.xlsx/content',
    md5: '3f996d6e1113a24e58304381b8e689e2',
    sha256: '964804656a7b4320bf103c96cadd115da05eb187d1ab0f638ca1b81bf73afac8',
  },
  {
    id: 'bp3d-partof', dir: 'bp3d', file: 'zip/partof_BP3D_4.0_obj_99.zip',
    url: 'https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/partof_BP3D_4.0_obj_99.zip',
    sha256: '9fbc713fffeee924a5a657d9813d84d7eb957bded63adb854931dd5e3eb61c97',
  },
  {
    id: 'bp3d-isa', dir: 'bp3d', file: 'zip/isa_BP3D_4.0_obj_99.zip',
    url: 'https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip',
    sha256: '40665852c49f218326590e204db91064a1ecfc3c6f8cbd7bbbcaac62c7cd409e',
  },
  { id: 'bp3d-partof-elements', dir: 'bp3d', file: 'meta/partof_element_parts.txt', url: 'https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/partof_element_parts.txt', sha256: '3f5f6df1028eb122b30de77c711597b6bb8e5541658e5985859fd228adbf88ea' },
  { id: 'bp3d-isa-elements', dir: 'bp3d', file: 'meta/isa_element_parts.txt', url: 'https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_element_parts.txt', sha256: 'a3de74423f943b0d724ae8f59b3a817f87c423a544f8db98113b1980817cbeaf' },
];

const hashFile = (file, algo) => createHash(algo).update(readFileSync(file)).digest('hex');

async function download(url, file, log) {
  mkdirSync(dirname(file), { recursive: true });
  log(`  downloading ${url}`);
  const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'behind-the-vial anatomy pipeline (dev tooling)' } });
  if (!res.ok) throw new Error(`download failed ${res.status} ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(file));
}

/** Ensure all raw sources exist and match their recorded hashes. Returns { [id]: absolutePath }. */
export async function ensureSources(rawRoot, { offline = false, log = console.log } = {}) {
  const out = {};
  for (const s of SOURCES) {
    const file = join(rawRoot, s.dir, s.file);
    if (!existsSync(file)) {
      if (offline) throw new Error(`missing source ${s.id} (${file}); run without --offline`);
      await download(s.url, file, log);
    }
    if (s.sha256) { const h = hashFile(file, 'sha256'); if (h !== s.sha256) throw new Error(`${s.id}: sha256 mismatch (${h}); the upstream file changed: review its license/version before updating the hash`); }
    if (s.md5) { const h = hashFile(file, 'md5'); if (h !== s.md5) throw new Error(`${s.id}: md5 mismatch (${h})`); }
    out[s.id] = file;
    log(`  ok ${s.id} (${(statSync(file).size / 1e6).toFixed(1)} MB)`);
  }
  return out;
}

/** List zip entries and refuse absolute paths or parent traversal before extracting with `unzip`. */
export function safeUnzip(zip, destDir, patterns = [], { marker } = {}) {
  if (marker && existsSync(join(destDir, marker))) return;
  const names = execFileSync('unzip', ['-Z1', zip], { maxBuffer: 64 * 1024 * 1024 }).toString().split('\n').filter(Boolean);
  for (const n of names) if (n.startsWith('/') || n.split(/[\\/]/).includes('..')) throw new Error(`unsafe path in ${zip}: ${n}`);
  mkdirSync(destDir, { recursive: true });
  execFileSync('unzip', ['-q', '-o', zip, ...patterns, '-d', destDir], { stdio: 'inherit' });
}

/** Read the first worksheet of an .xlsx (no formulas evaluated) as rows of {A:..., B:...}. */
export function readXlsxRows(xlsx) {
  const cat = (entry) => execFileSync('unzip', ['-p', xlsx, entry], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
  const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const strings = [...cat('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => unesc(m[1].replace(/<[^>]+>/g, '')));
  const sheet = cat('xl/worksheets/sheet1.xml');
  return [...sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((r) => {
    const row = {};
    for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>(?:<f>[\s\S]*?<\/f>)?<v>([\s\S]*?)<\/v><\/c>/g)) row[c[1]] = /t="s"/.test(c[2]) ? strings[+c[3]] : c[3];
    return row;
  });
}
