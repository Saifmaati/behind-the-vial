// Small indexed-triangle-mesh toolkit used by the anatomy pipeline (dev-only).
// A mesh is { positions: Float32Array (xyz...), indices: Uint32Array }.
import { MeshoptSimplifier } from 'meshoptimizer';

export const ready = MeshoptSimplifier.ready;

export function mesh(positions, indices) {
  return { positions: positions instanceof Float32Array ? positions : new Float32Array(positions), indices: indices instanceof Uint32Array ? indices : new Uint32Array(indices) };
}

export function triCount(m) { return m.indices.length / 3; }

export function merge(meshes) {
  meshes = meshes.filter((m) => m && m.indices.length);
  const nv = meshes.reduce((n, m) => n + m.positions.length, 0);
  const ni = meshes.reduce((n, m) => n + m.indices.length, 0);
  const positions = new Float32Array(nv), indices = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const m of meshes) {
    positions.set(m.positions, ov);
    const base = ov / 3;
    for (let i = 0; i < m.indices.length; i++) indices[oi + i] = m.indices[i] + base;
    ov += m.positions.length; oi += m.indices.length;
  }
  return { positions, indices };
}

/** Apply fn(x,y,z) -> [x,y,z] to every vertex (returns a new mesh). Flips winding if flip=true. */
export function mapVertices(m, fn, { flip = false } = {}) {
  const p = new Float32Array(m.positions.length);
  for (let i = 0; i < p.length; i += 3) {
    const r = fn(m.positions[i], m.positions[i + 1], m.positions[i + 2]);
    p[i] = r[0]; p[i + 1] = r[1]; p[i + 2] = r[2];
  }
  let idx = m.indices;
  if (flip) { idx = new Uint32Array(m.indices); for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } }
  return { positions: p, indices: idx };
}

/** 4x4 column-major matrix (glTF / three.js convention) applied to a mesh. */
export function applyMatrix(m, e) {
  const det = e[0] * (e[5] * e[10] - e[9] * e[6]) - e[4] * (e[1] * e[10] - e[9] * e[2]) + e[8] * (e[1] * e[6] - e[5] * e[2]);
  return mapVertices(m, (x, y, z) => [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]], { flip: det < 0 });
}

export function bounds(m) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const p = m.positions;
  for (let i = 0; i < p.length; i += 3) for (let a = 0; a < 3; a++) { const v = p[i + a]; if (v < min[a]) min[a] = v; if (v > max[a]) max[a] = v; }
  return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]], center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2] };
}

/** Area-weighted surface centroid (robust for open meshes). */
export function surfaceCentroid(m) {
  const p = m.positions, I = m.indices; let A = 0; const c = [0, 0, 0];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, d = I[t + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[d] - p[a], vy = p[d + 1] - p[a + 1], vz = p[d + 2] - p[a + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const area = Math.hypot(cx, cy, cz) / 2; A += area;
    for (let k = 0; k < 3; k++) c[k] += area * (p[a + k] + p[b + k] + p[d + k]) / 3;
  }
  return A > 0 ? c.map((v) => v / A) : bounds(m).center;
}

/** Signed volume and volume centroid (valid for closed, consistently wound meshes). */
export function volumeCentroid(m) {
  const p = m.positions, I = m.indices; let V = 0; const c = [0, 0, 0];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, d = I[t + 2] * 3;
    const v = (p[a] * (p[b + 1] * p[d + 2] - p[b + 2] * p[d + 1]) - p[a + 1] * (p[b] * p[d + 2] - p[b + 2] * p[d]) + p[a + 2] * (p[b] * p[d + 1] - p[b + 1] * p[d])) / 6;
    V += v;
    for (let k = 0; k < 3; k++) c[k] += v * (p[a + k] + p[b + k] + p[d + k]) / 4;
  }
  return { volume: V, centroid: Math.abs(V) > 1e-12 ? c.map((x) => x / V) : surfaceCentroid(m) };
}

/** Merge vertices closer than eps (grid hashing), drop degenerate triangles. */
export function weld(m, eps = 1e-5) {
  const p = m.positions, n = p.length / 3;
  const map = new Map(), remap = new Uint32Array(n), out = [];
  const inv = 1 / eps;
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(p[i * 3] * inv)},${Math.round(p[i * 3 + 1] * inv)},${Math.round(p[i * 3 + 2] * inv)}`;
    let j = map.get(key);
    if (j === undefined) { j = out.length / 3; map.set(key, j); out.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); }
    remap[i] = j;
  }
  const idx = [];
  for (let t = 0; t < m.indices.length; t += 3) {
    const a = remap[m.indices[t]], b = remap[m.indices[t + 1]], c = remap[m.indices[t + 2]];
    if (a !== b && b !== c && a !== c) idx.push(a, b, c);
  }
  return { positions: new Float32Array(out), indices: new Uint32Array(idx) };
}

/** Remove vertices no longer referenced. */
export function compact(m) {
  const used = new Int32Array(m.positions.length / 3).fill(-1); const out = []; const idx = new Uint32Array(m.indices.length);
  for (let i = 0; i < m.indices.length; i++) {
    const v = m.indices[i];
    if (used[v] < 0) { used[v] = out.length / 3; out.push(m.positions[v * 3], m.positions[v * 3 + 1], m.positions[v * 3 + 2]); }
    idx[i] = used[v];
  }
  return { positions: new Float32Array(out), indices: idx };
}

/** Connected components by shared vertices (after weld). Returns array of index arrays (triangle ids). */
export function components(m) {
  const n = m.positions.length / 3; const parent = new Int32Array(n); for (let i = 0; i < n; i++) parent[i] = i;
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const I = m.indices;
  for (let t = 0; t < I.length; t += 3) { const a = find(I[t]), b = find(I[t + 1]), c = find(I[t + 2]); parent[b] = a; parent[find(c)] = a; }
  const groups = new Map();
  for (let t = 0; t < I.length / 3; t++) { const r = find(I[t * 3]); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(t); }
  return [...groups.values()].sort((a, b) => b.length - a.length);
}

export function subsetTriangles(m, tris) {
  const idx = new Uint32Array(tris.length * 3);
  tris.forEach((t, i) => { idx[i * 3] = m.indices[t * 3]; idx[i * 3 + 1] = m.indices[t * 3 + 1]; idx[i * 3 + 2] = m.indices[t * 3 + 2]; });
  return compact({ positions: m.positions, indices: idx });
}

/** Keep connected components with at least minTris triangles (or the largest `keep` components). */
export function dropSmallComponents(m, { minTris = 0, keep = Infinity, minFraction = 0 } = {}) {
  const comps = components(m); const total = m.indices.length / 3;
  const kept = comps.filter((c, i) => i < keep && c.length >= minTris && c.length >= minFraction * total);
  return subsetTriangles(m, kept.flat());
}

function adjacency(m) {
  const n = m.positions.length / 3; const sets = Array.from({ length: n }, () => new Set());
  const I = m.indices;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    sets[a].add(b); sets[a].add(c); sets[b].add(a); sets[b].add(c); sets[c].add(a); sets[c].add(b);
  }
  const offs = new Uint32Array(n + 1); for (let i = 0; i < n; i++) offs[i + 1] = offs[i] + sets[i].size;
  const nb = new Uint32Array(offs[n]); for (let i = 0; i < n; i++) { let k = offs[i]; for (const j of sets[i]) nb[k++] = j; }
  return { offs, nb };
}

/** Taubin lambda/mu smoothing: removes voxel stair-steps without shrinking. Optional per-vertex lock mask. */
export function taubin(m, { iterations = 10, lambda = 0.5, mu = -0.53, lock = null } = {}) {
  const { offs, nb } = adjacency(m);
  let p = new Float32Array(m.positions); const n = p.length / 3; const q = new Float32Array(p.length);
  const step = (f) => {
    for (let i = 0; i < n; i++) {
      const s = offs[i], e = offs[i + 1];
      if (e === s || (lock && lock[i])) { q[i * 3] = p[i * 3]; q[i * 3 + 1] = p[i * 3 + 1]; q[i * 3 + 2] = p[i * 3 + 2]; continue; }
      let x = 0, y = 0, z = 0;
      for (let k = s; k < e; k++) { const j = nb[k] * 3; x += p[j]; y += p[j + 1]; z += p[j + 2]; }
      const c = 1 / (e - s);
      q[i * 3] = p[i * 3] + f * (x * c - p[i * 3]); q[i * 3 + 1] = p[i * 3 + 1] + f * (y * c - p[i * 3 + 1]); q[i * 3 + 2] = p[i * 3 + 2] + f * (z * c - p[i * 3 + 2]);
    }
    p.set(q);
  };
  for (let it = 0; it < iterations; it++) { step(lambda); step(mu); }
  return { positions: p, indices: m.indices };
}

/** meshoptimizer simplification to a triangle budget. */
export function simplify(m, targetTris, { error = 0.02, flags = [], absolute = false } = {}) {
  if (m.indices.length / 3 <= targetTris) return m;
  const f = absolute ? [...flags, 'ErrorAbsolute'] : flags;
  let [idx] = MeshoptSimplifier.simplify(m.indices, m.positions, 3, targetTris * 3, error, f);
  if (idx.length / 3 > targetTris * 1.02) {
    // Raise the error bound until the budget is met.
    let e = error;
    for (let i = 0; i < 12 && idx.length / 3 > targetTris * 1.02; i++) { e *= 2; [idx] = MeshoptSimplifier.simplify(m.indices, m.positions, 3, targetTris * 3, e, f); }
  }
  return compact({ positions: m.positions, indices: idx });
}

/** Angle-weighted smooth vertex normals. */
export function normals(m) {
  const p = m.positions, I = m.indices; const nrm = new Float32Array(p.length);
  const v = (i) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]];
  for (let t = 0; t < I.length; t += 3) {
    const ids = [I[t], I[t + 1], I[t + 2]]; const P = ids.map(v);
    const fn = cross(sub(P[1], P[0]), sub(P[2], P[0])); const len = Math.hypot(...fn); if (!len) continue;
    for (let k = 0; k < 3; k++) {
      const a = sub(P[(k + 1) % 3], P[k]), b = sub(P[(k + 2) % 3], P[k]);
      const ang = Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (Math.hypot(...a) * Math.hypot(...b) || 1))));
      for (let c = 0; c < 3; c++) nrm[ids[k] * 3 + c] += (fn[c] / len) * ang;
    }
  }
  for (let i = 0; i < nrm.length; i += 3) { const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) || 1; nrm[i] /= l; nrm[i + 1] /= l; nrm[i + 2] /= l; }
  return nrm;
}

export function flipWinding(m) {
  const idx = new Uint32Array(m.indices);
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  return { positions: m.positions, indices: idx };
}

/** Make a closed mesh outward-facing (positive signed volume). */
export function orientOutward(m) { return volumeCentroid(m).volume < 0 ? flipWinding(m) : m; }

// --- tiny vector helpers ---
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const dist = (a, b) => len(sub(a, b));

/** Serialize a { name: mesh } map to a single binary file (dev cache). */
export function packMeshes(map) {
  const header = []; const bufs = []; let off = 0;
  for (const [name, m] of Object.entries(map)) {
    const p = Buffer.from(m.positions.buffer, m.positions.byteOffset, m.positions.byteLength);
    const i = Buffer.from(m.indices.buffer, m.indices.byteOffset, m.indices.byteLength);
    header.push({ name, pOff: off, pLen: m.positions.length, iOff: off + p.length, iLen: m.indices.length });
    bufs.push(p, i); off += p.length + i.length;
  }
  const h = Buffer.from(JSON.stringify(header)); const len = Buffer.alloc(4); len.writeUInt32LE(h.length);
  return Buffer.concat([len, h, ...bufs]);
}
export function unpackMeshes(buf) {
  const hl = buf.readUInt32LE(0); const header = JSON.parse(buf.subarray(4, 4 + hl).toString()); const base = 4 + hl; const out = {};
  for (const e of header) {
    const p = new Float32Array(e.pLen); Buffer.from(p.buffer).set(buf.subarray(base + e.pOff, base + e.pOff + e.pLen * 4));
    const i = new Uint32Array(e.iLen); Buffer.from(i.buffer).set(buf.subarray(base + e.iOff, base + e.iOff + e.iLen * 4));
    out[e.name] = { positions: p, indices: i };
  }
  return out;
}
