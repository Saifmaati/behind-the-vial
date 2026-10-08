// VOXEL-MAN "Segmented Internal Organs of the Visible Human Male" (SIO) label volume reader.
// Label TIFFs are untrusted data: parsed here as plain uncompressed 16-bit rasters only.
// Volume index space: x = image column, y = image row, z = slice number - firstSlice; 1 mm isotropic voxels.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function readTiff16(file) {
  const b = readFileSync(file);
  const le = b.toString('latin1', 0, 2) === 'II';
  if (!le && b.toString('latin1', 0, 2) !== 'MM') throw new Error(`not a TIFF: ${file}`);
  const u16 = (o) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const u32 = (o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  if (u16(2) !== 42) throw new Error(`bad TIFF magic: ${file}`);
  const ifd = u32(4); const n = u16(ifd); const tags = {};
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12; const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
    const size = { 1: 1, 2: 1, 3: 2, 4: 4 }[type] || 4;
    const valOff = count * size <= 4 ? e + 8 : u32(e + 8);
    const vals = [];
    for (let k = 0; k < Math.min(count, 4096); k++) vals.push(type === 3 ? u16(valOff + k * 2) : type === 4 ? u32(valOff + k * 4) : b[valOff + k]);
    tags[tag] = vals;
  }
  const w = tags[256][0], h = tags[257][0], bits = tags[258][0], comp = (tags[259] || [1])[0];
  if (bits !== 16 || comp !== 1) throw new Error(`unsupported TIFF (bits=${bits}, compression=${comp}): ${file}`);
  const offs = tags[273], counts = tags[279];
  const out = new Uint16Array(w * h); let k = 0;
  for (let s = 0; s < offs.length; s++) {
    const end = offs[s] + counts[s];
    if (end > b.length) throw new Error(`truncated TIFF: ${file}`);
    for (let o = offs[s]; o < end && k < out.length; o += 2) out[k++] = u16(o);
  }
  return { w, h, data: out };
}

export function loadSIO(labelDir) {
  const files = readdirSync(labelDir).filter((f) => /^labels\d+\.tif$/.test(f)).sort();
  const nums = files.map((f) => +f.match(/\d+/)[0]);
  const first = nums[0];
  if (nums.some((n, i) => n !== first + i)) throw new Error('SIO: slice numbers are not consecutive');
  const s0 = readTiff16(join(labelDir, files[0]));
  const W = s0.w, H = s0.h, D = files.length;
  const vol = new Uint16Array(W * H * D);
  files.forEach((f, z) => { const s = z ? readTiff16(join(labelDir, f)) : s0; if (s.w !== W || s.h !== H) throw new Error('SIO: slice size mismatch'); vol.set(s.data, z * W * H); });
  return {
    W, H, D, firstSlice: first, vol,
    /** Binary mask (Uint8Array, same dims) of voxels whose label is in `labels`. */
    mask(labels) {
      const set = new Set(labels); const m = new Uint8Array(vol.length);
      for (let i = 0; i < vol.length; i++) if (set.has(vol[i])) m[i] = 1;
      return m;
    },
    /** Voxel centroid + count for a label set (index space). */
    stats(labels) {
      const set = new Set(labels); let n = 0, sx = 0, sy = 0, sz = 0;
      for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) { const row = (z * H + y) * W; for (let x = 0; x < W; x++) if (set.has(vol[row + x])) { n++; sx += x; sy += y; sz += z; } }
      return { count: n, centroid: n ? [sx / n, sy / n, sz / n] : null };
    },
  };
}

/** Map of label name -> label numbers, from the parsed "SIO Object Labels.xlsx" (labels.json rows {A:name,B..:numbers}). */
export function labelTable(rows) {
  const t = new Map();
  for (const r of rows) { const name = r.A; const nums = Object.entries(r).filter(([k]) => k !== 'A').map(([, v]) => +v).filter(Number.isFinite); if (name && nums.length) t.set(name, nums); }
  return t;
}
