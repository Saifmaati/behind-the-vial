// Build the web versions of the intro photographs from the downloaded originals.
//
//   node tools/img/fetch-commons.mjs        (once: originals + licence snapshots into tools/.cache/photos/)
//   node tools/img/make-intro-photos.mjs    (writes assets/img/intro-*.webp, prints a table)
//
// Every output is auto-oriented, cropped, resized with Lanczos3 and encoded as WebP with no metadata
// (no EXIF, GPS, XMP or ICC). Quality starts at 82 and steps down only if the file would exceed its
// byte budget (BUDGET in photos.config.mjs). Encoding uses sharp, which tools/node_modules already
// carries through @gltf-transform; nothing new is installed.
import { createRequire } from 'node:module';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHOTOS, BUDGET } from './photos.config.mjs';
import { removeScaleNumbers } from './retouch-syringe.mjs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'tools', '.cache', 'photos');
const OUT = join(ROOT, 'assets', 'img');

async function original(name) {
  const f = (await readdir(join(SRC, name))).find(n => n.startsWith('original.'));
  if (!f) throw new Error(`no original for ${name}; run tools/img/fetch-commons.mjs first`);
  return join(SRC, name, f);
}

// Pure-white studio background → transparent. Only near-white pixels connected to the frame edge are
// cleared (so white highlights inside the object stay), then a 2 px edge band is un-mixed from white.
function cutout({ data, info }) {
  const { width: W, height: H } = info;
  const C = 4, n = W * H;
  const white = i => Math.min(data[i * C], data[i * C + 1], data[i * C + 2]) >= 248;
  const bg = new Uint8Array(n);
  const stack = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const i = stack.pop();
    if (bg[i] || !white(i)) continue;
    bg[i] = 1;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) stack.push(i - 1); if (x < W - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - W); if (y < H - 1) stack.push(i + W);
  }
  const near = new Uint8Array(n);
  for (let pass = 0; pass < 2; pass++) {
    const src = pass === 0 ? bg : near.slice();
    for (let i = 0; i < n; i++) {
      if (bg[i] || near[i]) continue;
      const x = i % W;
      if ((x > 0 && src[i - 1]) || (x < W - 1 && src[i + 1]) || src[i - W] || src[i + W]) near[i] = 1;
    }
  }
  for (let i = 0; i < n; i++) {
    const o = i * C;
    if (bg[i]) { data[o + 3] = 0; continue; }
    if (!near[i]) { data[o + 3] = 255; continue; }
    // Edge pixel: treat it as the object colour mixed with white; recover alpha and the unmixed colour.
    const m = Math.min(data[o], data[o + 1], data[o + 2]);
    const a = Math.min(1, Math.max(0.15, (255 - m) / 255 * 1.6));
    for (let c = 0; c < 3; c++) data[o + c] = Math.max(0, Math.min(255, Math.round((data[o + c] - 255 * (1 - a)) / a)));
    data[o + 3] = Math.round(a * 255);
  }
  return sharp(data, { raw: { width: W, height: H, channels: 4 } });
}

async function encode(pipeline, budget, alpha) {
  for (let q = 82; q >= 50; q -= 4) {
    const buf = await pipeline.clone().webp({ quality: q, effort: 6, smartSubsample: true, alphaQuality: alpha ? 90 : 100 }).toBuffer();
    if (buf.length <= budget || q <= 50) return { buf, q };
  }
}

await mkdir(OUT, { recursive: true });
const rows = [];
// Retouch steps run on the full-size, oriented original before any crop (lossless PNG in memory).
async function retouched(file, kind) {
  if (kind !== 'syringe-scale') throw new Error(`unknown retouch ${kind}`);
  const { data, info } = await sharp(file).rotate().raw().toBuffer({ resolveWithObject: true });
  removeScaleNumbers(data, info.width, info.height, info.channels);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).png({ compressionLevel: 1 }).toBuffer();
}

for (const p of PHOTOS) {
  const file = p.retouch ? await retouched(await original(p.name), p.retouch) : await original(p.name);
  for (const o of p.outputs) {
    // Orient (EXIF), optional rotation, then crop the frame.
    let base = sharp(file).rotate();
    if (o.rotate) base = sharp(await base.toBuffer()).rotate(o.rotate, { background: o.fill || '#ffffff' });
    const oriented = await base.toBuffer();
    const { width: W, height: H } = await sharp(oriented).metadata();
    const fw = Math.round(o.crop.w * W);
    const fh = Math.round(fw * o.aspect[1] / o.aspect[0]);
    const left = Math.max(0, Math.min(W - fw, Math.round(o.crop.cx * W - fw / 2)));
    const top = Math.max(0, Math.min(H - fh, Math.round(o.crop.cy * H - fh / 2)));
    if (fw > W || fh > H) throw new Error(`${o.out}: frame ${fw}x${fh} larger than source ${W}x${H}`);
    let framed = sharp(oriented).extract({ left, top, width: fw, height: fh }).toColourspace('srgb');
    if (o.cutout) framed = cutout(await framed.ensureAlpha().raw().toBuffer({ resolveWithObject: true }));
    else framed = sharp(await framed.removeAlpha().toBuffer());
    for (const w of o.widths) {
      if (w > fw) throw new Error(`${o.out}: ${w}px would upscale a ${fw}px frame`);
      const resized = framed.clone().resize({ width: w, kernel: 'lanczos3' });
      const budget = w >= BUDGET.largeMinWidth ? BUDGET.large : BUDGET.small;
      const { buf, q } = await encode(resized, budget, !!o.cutout);
      const meta = await sharp(buf).metadata();
      const name = `${o.out}-${w}.webp`;
      await writeFile(join(OUT, name), buf);
      rows.push({ name, size: `${meta.width}x${meta.height}`, kb: (buf.length / 1024).toFixed(1), q, budget: budget / 1024,
        ok: buf.length <= budget, frame: `${fw}x${fh}@${left},${top}${o.rotate ? ` rot${o.rotate}` : ''}`,
        meta: [meta.exif && 'EXIF', meta.icc && 'ICC', meta.xmp && 'XMP'].filter(Boolean).join(',') || 'none' });
    }
  }
}
console.table(rows);
if (rows.some(r => !r.ok)) { console.error('Some files are over budget.'); process.exitCode = 1; }
