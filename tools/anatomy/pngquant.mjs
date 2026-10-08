// Tiny dependency-free PNG palette quantizer (dev-only), used to keep docs/anatomy-previews/*.png under 250 KB.
// Usage: node tools/anatomy/pngquant.mjs <in.png> <out.png> [colors=256] [--dither]
// Supports 8-bit RGB/RGBA non-interlaced PNGs (what headless Chrome writes). Median-cut palette + k-means refinement.
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8, w, h, depth, ctype, interlace; const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('latin1', off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || interlace || (ctype !== 2 && ctype !== 6)) throw new Error(`unsupported PNG (depth ${depth}, type ${ctype}, interlace ${interlace})`);
  const bpp = ctype === 6 ? 4 : 3; const raw = inflateSync(Buffer.concat(idat)); const stride = w * bpp;
  const out = new Uint8Array(w * h * 3); const prev = new Uint8Array(stride); const cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0; let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 0xff;
    }
    for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) out[(y * w + x) * 3 + k] = cur[x * bpp + k];
    prev.set(cur);
  }
  return { w, h, rgb: out };
}

function medianCut(rgb, n) {
  // histogram of 5-bit colours
  const hist = new Map();
  for (let i = 0; i < rgb.length; i += 3) { const k = ((rgb[i] >> 3) << 10) | ((rgb[i + 1] >> 3) << 5) | (rgb[i + 2] >> 3); hist.set(k, (hist.get(k) || 0) + 1); }
  const cols = [...hist.entries()].map(([k, c]) => ({ r: ((k >> 10) & 31) * 8 + 4, g: ((k >> 5) & 31) * 8 + 4, b: (k & 31) * 8 + 4, c }));
  let boxes = [cols];
  while (boxes.length < n) {
    let bi = -1, best = -1, axis = 'r';
    boxes.forEach((bx, i) => {
      if (bx.length < 2) return;
      for (const ax of ['r', 'g', 'b']) { let lo = 255, hi = 0, wsum = 0; for (const c of bx) { lo = Math.min(lo, c[ax]); hi = Math.max(hi, c[ax]); wsum += c.c; } const score = (hi - lo) * Math.sqrt(wsum); if (score > best) { best = score; bi = i; axis = ax; } }
    });
    if (bi < 0) break;
    const bx = boxes[bi].sort((a, b) => a[axis] - b[axis]); const total = bx.reduce((s, c) => s + c.c, 0); let acc = 0, cut = 1;
    for (let i = 0; i < bx.length; i++) { acc += bx[i].c; if (acc >= total / 2) { cut = Math.max(1, Math.min(bx.length - 1, i + 1)); break; } }
    boxes.splice(bi, 1, bx.slice(0, cut), bx.slice(cut));
  }
  return boxes.map((bx) => { const t = bx.reduce((s, c) => s + c.c, 0); return [bx.reduce((s, c) => s + c.r * c.c, 0) / t, bx.reduce((s, c) => s + c.g * c.c, 0) / t, bx.reduce((s, c) => s + c.b * c.c, 0) / t]; });
}

export function quantize({ w, h, rgb }, n = 256, { dither = false, iterations = 4 } = {}) {
  let pal = medianCut(rgb, n);
  const cache = new Map();
  const nearest = (r, g, b) => { let bi = 0, bd = Infinity; for (let i = 0; i < pal.length; i++) { const p = pal[i]; const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };
  const lookup = (r, g, b) => { const k = (r << 16) | (g << 8) | b; let v = cache.get(k); if (v === undefined) { v = nearest(r, g, b); cache.set(k, v); } return v; };
  for (let it = 0; it < iterations; it++) { // k-means refinement on all pixels
    cache.clear(); const sum = pal.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < rgb.length; i += 3) { const k = lookup(rgb[i], rgb[i + 1], rgb[i + 2]); const s = sum[k]; s[0] += rgb[i]; s[1] += rgb[i + 1]; s[2] += rgb[i + 2]; s[3]++; }
    pal = pal.map((p, i) => (sum[i][3] ? [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]] : p));
  }
  cache.clear();
  const idx = new Uint8Array(w * h);
  if (!dither) for (let i = 0; i < w * h; i++) idx[i] = lookup(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
  else {
    const err = new Float32Array(w * h * 3); for (let i = 0; i < rgb.length; i++) err[i] = rgb[i];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; const r = Math.max(0, Math.min(255, Math.round(err[i * 3]))), g = Math.max(0, Math.min(255, Math.round(err[i * 3 + 1]))), b = Math.max(0, Math.min(255, Math.round(err[i * 3 + 2])));
      const k = lookup(r, g, b); idx[i] = k; const e = [err[i * 3] - pal[k][0], err[i * 3 + 1] - pal[k][1], err[i * 3 + 2] - pal[k][2]];
      const spread = (dx, dy, f) => { const xx = x + dx, yy = y + dy; if (xx < 0 || xx >= w || yy >= h) return; const j = (yy * w + xx) * 3; for (let c = 0; c < 3; c++) err[j + c] += e[c] * f; };
      spread(1, 0, 7 / 16); spread(-1, 1, 3 / 16); spread(0, 1, 5 / 16); spread(1, 1, 1 / 16);
    }
  }
  return { w, h, palette: pal.map((p) => p.map((v) => Math.round(v))), idx };
}

export function encodeIndexed({ w, h, palette, idx }) {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'latin1'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 3; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w + 1)] = 0; raw.set(idx.subarray(y * w, (y + 1) * w), y * (w + 1) + 1); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('PLTE', Buffer.from(palette.flat())), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [inp, out, n = '256'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const img = decodePNG(readFileSync(inp));
  const png = encodeIndexed(quantize(img, +n, { dither: process.argv.includes('--dither') }));
  writeFileSync(out, png);
  console.log(`${out}: ${img.w}x${img.h}, ${n} colours, ${(png.length / 1024).toFixed(0)} KB`);
}
