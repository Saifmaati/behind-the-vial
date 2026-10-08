// Partial (HTTP range) access to a large HRA "united" GLB (dev-only).
//
// The HRA United Female v1.10 GLB is 374.5 MB. The owner works on a phone hotspot, so instead of downloading
// all of it we fetch the GLB header + JSON chunk (0.94 MB), work out which byte ranges hold the index and
// POSITION data of the node subtrees we need, and fetch only those ranges into a sparse local copy of the file
// (same size and byte offsets as the original, holes everywhere else). The sparse file is then read by the
// ordinary glTF reader (hra.mjs); nodes we did not fetch are simply never collected.
//
// Every fetched range is hashed (SHA-256) and listed in a manifest that is committed with the pipeline
// (tools/anatomy/hra-female-ranges.json), so a rebuild verifies exactly the same bytes. The downloaded data is
// untrusted: it is only parsed as glTF (JSON + typed arrays), never executed.
//
// CLI (dev): node tools/anatomy/hra-ranged.mjs <glb-head.bin> [subtree]   prints the node tree with bytes needed
import { createHash } from 'node:crypto';
import { closeSync, existsSync, ftruncateSync, mkdirSync, openSync, readFileSync, readSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** Parse a GLB header + JSON chunk (the first bytes of the file). */
export function parseHead(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const total = buf.readUInt32LE(8); const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binLen = buf.readUInt32LE(20 + jsonLen);
  const binStart = 20 + jsonLen + 8; // absolute file offset of the BIN chunk data
  return { json, total, jsonLen, binLen, binStart, headLen: binStart };
}

function mul(a, b) { // column-major 4x4
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; }
  return o;
}
function localMatrix(n) {
  if (n.matrix) return n.matrix;
  const [tx, ty, tz] = n.translation || [0, 0, 0]; const [x, y, z, w] = n.rotation || [0, 0, 0, 1]; const [sx, sy, sz] = n.scale || [1, 1, 1];
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [(1 - 2 * (yy + zz)) * sx, 2 * (xy + wz) * sx, 2 * (xz - wy) * sx, 0, 2 * (xy - wz) * sy, (1 - 2 * (xx + zz)) * sy, 2 * (yz + wx) * sy, 0, 2 * (xz + wy) * sz, 2 * (yz - wx) * sz, (1 - 2 * (xx + yy)) * sz, 0, tx, ty, tz, 1];
}

/** Node index helpers over the glTF JSON. */
export function nodeTable(json) {
  const parent = new Int32Array(json.nodes.length).fill(-1);
  json.nodes.forEach((n, i) => (n.children || []).forEach((c) => { parent[c] = i; }));
  const world = new Array(json.nodes.length);
  const W = (i) => { if (world[i]) return world[i]; const L = localMatrix(json.nodes[i]); world[i] = parent[i] < 0 ? L : mul(W(parent[i]), L); return world[i]; };
  const byName = new Map(); json.nodes.forEach((n, i) => { if (!byName.has(n.name)) byName.set(n.name, i); });
  const subtree = (i, out = []) => { out.push(i); (json.nodes[i].children || []).forEach((c) => subtree(c, out)); return out; };
  return { parent, world: W, byName, subtree, roots: json.nodes.map((_, i) => i).filter((i) => parent[i] < 0) };
}

/** Byte ranges (absolute file offsets) of the index + POSITION accessors of the given primitives. */
function accessorRange(json, binStart, ai) {
  const a = json.accessors[ai]; const bv = json.bufferViews[a.bufferView];
  const comp = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[a.componentType]; const ncomp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const stride = bv.byteStride || comp * ncomp;
  const start = binStart + (bv.byteOffset || 0) + (a.byteOffset || 0);
  return [start, start + stride * (a.count - 1) + comp * ncomp];
}

/** Ranges needed for every mesh node in the subtrees of `names` (excluding names matching `exclude`). */
export function rangesFor(head, names, { exclude = [] } = {}) {
  const { json, binStart } = head; const T = nodeTable(json);
  const ex = exclude.map((e) => (e instanceof RegExp ? e : new RegExp(`^${e}$`)));
  const ranges = []; const missing = [];
  for (const name of names) {
    const i = T.byName.get(name); if (i === undefined) { missing.push(name); continue; }
    const visit = (k) => {
      const n = json.nodes[k]; if (ex.some((r) => r.test(n.name))) return;
      if (n.mesh !== undefined) for (const p of json.meshes[n.mesh].primitives) {
        if ((p.mode ?? 4) !== 4) continue;
        if (p.indices !== undefined) ranges.push(accessorRange(json, binStart, p.indices));
        ranges.push(accessorRange(json, binStart, p.attributes.POSITION));
      }
      (n.children || []).forEach(visit);
    };
    visit(i);
  }
  return { ranges, missing };
}

/** Merge ranges whose gap is below `gap` bytes. */
export function coalesce(ranges, gap = 65536) {
  const r = ranges.map((x) => x.slice()).sort((a, b) => a[0] - b[0]); const out = [];
  for (const x of r) { const last = out[out.length - 1]; if (last && x[0] <= last[1] + gap) last[1] = Math.max(last[1], x[1]); else out.push(x); }
  return out;
}

/**
 * Low-memory reader with the same interface as openHRA() (hra.mjs): reads only the index and POSITION bytes of the
 * collected nodes straight from the (possibly sparse) GLB on disk, instead of loading the whole file. Used by the
 * female build for both HRA bodies.
 */
export function openRanged(file) {
  const fd = openSync(file, 'r');
  const h0 = Buffer.alloc(20); readSync(fd, h0, 0, 20, 0);
  const headLen = 28 + h0.readUInt32LE(12); const hb = Buffer.alloc(headLen); readSync(fd, hb, 0, headLen, 0);
  const head = parseHead(hb); const { json, binStart } = head; const T = nodeTable(json);
  const readAcc = (ai) => {
    const a = json.accessors[ai]; const bv = json.bufferViews[a.bufferView];
    const comp = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[a.componentType]; const ncomp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const stride = bv.byteStride || comp * ncomp; const start = binStart + (bv.byteOffset || 0) + (a.byteOffset || 0);
    const len = stride * (a.count - 1) + comp * ncomp; const buf = Buffer.alloc(len); readSync(fd, buf, 0, len, start);
    const out = a.componentType === 5126 ? new Float32Array(a.count * ncomp) : new Uint32Array(a.count * ncomp);
    const get = { 5121: (o) => buf.readUInt8(o), 5123: (o) => buf.readUInt16LE(o), 5125: (o) => buf.readUInt32LE(o), 5126: (o) => buf.readFloatLE(o) }[a.componentType];
    for (let i = 0; i < a.count; i++) for (let c = 0; c < ncomp; c++) out[i * ncomp + c] = get(i * stride + c * comp);
    return out;
  };
  const primMesh = (p, W) => {
    if ((p.mode ?? 4) !== 4 || p.attributes.POSITION === undefined) return null;
    const pos = readAcc(p.attributes.POSITION); let idx;
    if (p.indices !== undefined) idx = readAcc(p.indices); else { idx = new Uint32Array(pos.length / 3); for (let i = 0; i < idx.length; i++) idx[i] = i; }
    const det = W[0] * (W[5] * W[10] - W[9] * W[6]) - W[4] * (W[1] * W[10] - W[9] * W[2]) + W[8] * (W[1] * W[6] - W[5] * W[2]);
    const P = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i += 3) { const x = pos[i], y = pos[i + 1], z = pos[i + 2]; P[i] = W[0] * x + W[4] * y + W[8] * z + W[12]; P[i + 1] = W[1] * x + W[5] * y + W[9] * z + W[13]; P[i + 2] = W[2] * x + W[6] * y + W[10] * z + W[14]; }
    if (det < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    return { positions: P, indices: idx };
  };
  function collect(names, { exclude = [] } = {}) {
    const ex = exclude.map((e) => (e instanceof RegExp ? e : new RegExp(`^${e}$`)));
    const parts = [];
    const visit = (k) => {
      const n = json.nodes[k]; if (ex.some((r) => r.test(n.name))) return;
      if (n.mesh !== undefined) for (const p of json.meshes[n.mesh].primitives) { const m = primMesh(p, T.world(k)); if (m) parts.push(m); }
      (n.children || []).forEach(visit);
    };
    for (const name of [].concat(names)) { const i = T.byName.get(name); if (i === undefined) throw new Error(`HRA: node not found: ${name}`); visit(i); }
    const nv = parts.reduce((a, m) => a + m.positions.length, 0), ni = parts.reduce((a, m) => a + m.indices.length, 0);
    const positions = new Float32Array(nv), indices = new Uint32Array(ni); let ov = 0, oi = 0;
    for (const m of parts) { positions.set(m.positions, ov); for (let i = 0; i < m.indices.length; i++) indices[oi + i] = m.indices[i] + ov / 3; ov += m.positions.length; oi += m.indices.length; }
    return { positions, indices };
  }
  return { head, collect, has: (n) => T.byName.has(n), close: () => closeSync(fd) };
}

/**
 * Ensure a sparse local copy of `url` holds the head + the requested ranges.
 * @param {object} o
 * @param {string} o.url       remote GLB
 * @param {string} o.file      local sparse GLB path
 * @param {string} o.manifest  committed JSON manifest of ranges and SHA-256 hashes
 * @param {object} o.expect    { size, headSha256 } of the remote file
 * @param {string[]} o.names   node subtrees to fetch
 */
export async function ensureRanged({ url, file, manifest, expect, names, exclude = [], offline = false, log = console.log }) {
  mkdirSync(dirname(file), { recursive: true });
  const fetchRange = async (a, b) => {
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(url, { headers: { range: `bytes=${a}-${b - 1}`, 'user-agent': 'peptidescope anatomy pipeline (dev tooling)' } });
        if (res.status !== 206) throw new Error(`range request returned ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer()); if (buf.length !== b - a) throw new Error(`short range ${buf.length} != ${b - a}`);
        return buf;
      } catch (e) { if (attempt >= 4) throw e; log(`  retry ${attempt} for bytes ${a}-${b}: ${e.message}`); await new Promise((r) => setTimeout(r, 1500 * attempt)); }
    }
  };
  if (!existsSync(file)) { const fd = openSync(file, 'w'); ftruncateSync(fd, expect.size); closeSync(fd); }
  if (statSync(file).size !== expect.size) throw new Error(`${file}: size ${statSync(file).size} != ${expect.size}`);
  const fd = openSync(file, 'r+');
  const readAt = (a, b) => { const buf = Buffer.alloc(b - a); readSync(fd, buf, 0, b - a, a); return buf; };
  const man = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')) : { url, size: expect.size, headSha256: expect.headSha256, ranges: [] };
  let fetched = 0;
  try {
    // 1) head (GLB header + JSON chunk)
    const h0 = readAt(0, 20); let headLen = h0.readUInt32LE(0) === 0x46546c67 ? 28 + h0.readUInt32LE(12) : 0;
    if (!headLen || sha256(readAt(0, headLen)) !== expect.headSha256) {
      if (offline) throw new Error('HRA female head not cached; run without --offline');
      const first = await fetchRange(0, 20); headLen = 28 + first.readUInt32LE(12);
      const head = await fetchRange(0, headLen); writeSync(fd, head, 0, head.length, 0); fetched += head.length;
      if (sha256(head) !== expect.headSha256) throw new Error(`HRA female head sha256 mismatch (${sha256(head)}): the upstream file changed; review its version/license before updating`);
    }
    const head = parseHead(readAt(0, headLen));
    // 2) data ranges
    const { ranges, missing } = rangesFor(head, names, { exclude });
    if (missing.length) throw new Error(`HRA female: nodes not found: ${missing.join(', ')}`);
    const want = coalesce(ranges);
    const known = new Map(man.ranges.map((r) => [`${r[0]}-${r[1]}`, r[2]]));
    // a wanted range is satisfied if it lies inside a known (verified) range
    const covered = (a, b) => man.ranges.some((r) => r[0] <= a && r[1] >= b);
    const todo = want.filter(([a, b]) => !covered(a, b));
    if (todo.length) {
      if (offline && todo.length) throw new Error(`HRA female: ${todo.length} ranges not cached; run without --offline`);
      const bytes = todo.reduce((s, [a, b]) => s + b - a, 0);
      log(`  fetching ${todo.length} byte ranges of ${url.split('/').pop()} (${(bytes / 1e6).toFixed(1)} MB of ${(expect.size / 1e6).toFixed(1)} MB)`);
      for (const [a, b] of todo) {
        // split very large ranges so one failure does not lose everything
        for (let s = a; s < b; s += 16e6) { const e = Math.min(b, s + 16e6); const buf = await fetchRange(s, e); writeSync(fd, buf, 0, buf.length, s); fetched += buf.length; }
        man.ranges.push([a, b, sha256(readAt(a, b))]); known.set(`${a}-${b}`, man.ranges[man.ranges.length - 1][2]);
      }
      man.ranges.sort((x, y) => x[0] - y[0]);
      writeFileSync(manifest, JSON.stringify(man, null, 0).replace(/\],\[/g, '],\n[') + '\n');
    }
    // 3) verify every range listed in the manifest
    let verified = 0;
    for (const [a, b, h] of man.ranges) { if (sha256(readAt(a, b)) !== h) throw new Error(`HRA female: range ${a}-${b} sha256 mismatch; delete ${file} to refetch`); verified += b - a; }
    log(`  ok hra-united-female (sparse): ${man.ranges.length} ranges, ${(verified / 1e6).toFixed(1)} MB verified${fetched ? `, ${(fetched / 1e6).toFixed(1)} MB downloaded now` : ''}`);
    return { head, file };
  } finally { closeSync(fd); }
}

// ------------------------------------------------------------------------------------------------ CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const [headFile, sub] = process.argv.slice(2);
  const head = parseHead(readFileSync(headFile)); const { json } = head; const T = nodeTable(json);
  const bytesOf = (i) => { const { ranges } = rangesFor(head, [json.nodes[i].name]); return ranges.reduce((s, [a, b]) => s + b - a, 0); };
  const trisOf = (i) => T.subtree(i).reduce((s, k) => { const n = json.nodes[k]; if (n.mesh === undefined) return s; return s + json.meshes[n.mesh].primitives.reduce((t, p) => t + (p.indices !== undefined ? json.accessors[p.indices].count / 3 : 0), 0); }, 0);
  const print = (i, d, maxD) => { const n = json.nodes[i]; console.log(`${'  '.repeat(d)}${n.name} tris=${trisOf(i)} MB=${(bytesOf(i) / 1e6).toFixed(2)}${n.mesh !== undefined ? ' (mesh)' : ''}`); if (d < maxD) (n.children || []).forEach((c) => print(c, d + 1, maxD)); };
  if (sub) print(T.byName.get(sub), 0, 99); else T.roots.forEach((r) => print(r, 0, 99));
  console.log('size', head.total, 'json', head.jsonLen, 'bin', head.binLen, 'root matrices', T.roots.map((r) => localMatrix(json.nodes[r]).map((v) => +v.toFixed(4)).join(',')));
}
