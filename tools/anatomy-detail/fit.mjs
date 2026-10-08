// Close-range fit of BodyParts3D muscles inside the HRA body (dev-only).
//
// The male build's thin-plate spline matches ~400 landmarks; between them the warped BodyParts3D skin still sits on
// average ~8 mm (up to ~6 cm at the hips and feet) off the HRA skin, which pushes superficial muscles through the HRA
// skin. A global spline refit on dense pairs was tried and rejected (conflicting pairs across armpits and finger gaps
// made it diverge). Instead a *local* offset field is used:
//   * skin pairs: warped BodyParts3D skin sample -> closest point on the HRA skin (accepted only when both surfaces
//     are near-parallel and the match is mutual), offset = HRA point - BodyParts3D point;
//   * bone pairs: warped BodyParts3D bone sample -> closest point on the bone that body.glb shows there (HRA spine,
//     pelvis and leg bones; SIO rib cage, clavicles and scapulae);
//   * anchors: BodyParts3D bones that body.glb itself takes from BodyParts3D (skull, arm, hand and foot bones) keep
//     offset 0, so muscles stay on the bones the visitor sees.
// The field at a point is a Gaussian-weighted (Shepard) average of nearby offsets that fades to 0 away from all
// samples. Muscles are moved by the field, then any vertex closer than `minDepth` to the HRA skin is pushed inward
// along the skin normal (correction smoothed over the mesh so the surface does not crease).
import * as M from '../anatomy/mesh.mjs';
import * as V from '../anatomy/voxel.mjs';
import { triGrid } from './spatial.mjs';
import { surfaceSamples } from './refine.mjs';

/** Gaussian-weighted offset field over scattered samples { p, o } (metres). */
export function offsetField(samples, { sigma = 0.015, cutoff = 3, prior = 2e-3 } = {}) {
  const R = sigma * cutoff; const cell = R; const map = new Map();
  const key = (i, j, k) => `${i},${j},${k}`;
  for (const s of samples) { const k = key(Math.floor(s.p[0] / cell), Math.floor(s.p[1] / cell), Math.floor(s.p[2] / cell)); let a = map.get(k); if (!a) map.set(k, (a = [])); a.push(s); }
  const inv2s2 = 1 / (2 * sigma * sigma), R2 = R * R;
  /** Offset at p and the total weight (support). */
  function at(p) {
    const ci = Math.floor(p[0] / cell), cj = Math.floor(p[1] / cell), ck = Math.floor(p[2] / cell);
    let sw = 0, x = 0, y = 0, z = 0;
    for (let k = ck - 1; k <= ck + 1; k++) for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
      const a = map.get(key(i, j, k)); if (!a) continue;
      for (const s of a) {
        const d2 = (p[0] - s.p[0]) ** 2 + (p[1] - s.p[1]) ** 2 + (p[2] - s.p[2]) ** 2; if (d2 > R2) continue;
        const w = Math.exp(-d2 * inv2s2) * (s.w ?? 1); sw += w; x += w * s.o[0]; y += w * s.o[1]; z += w * s.o[2];
      }
    }
    const den = sw + prior;
    return { o: [x / den, y / den, z / den], support: sw };
  }
  return { at, count: samples.length };
}

/**
 * Skin offset samples: warped BodyParts3D skin -> HRA skin, mutual nearest, near-parallel surfaces only.
 * @returns {{ samples: Array<{p,o}>, stats }}
 */
export function skinPairs(bpSkinW, hraSkinGrid, { spacing = 0.012, maxDist = 0.06, minCos = 0.7, mutualTol = 0.015 } = {}) {
  const bpGrid = triGrid(bpSkinW, 0.008);
  const vn = M.normals(bpSkinW); const P = bpSkinW.positions;
  const samples = []; let rejected = 0; let sum = 0;
  for (const i of surfaceSamples(bpSkinW, spacing)) {
    const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
    const c = hraSkinGrid.closest(p, maxDist); if (!c) { rejected++; continue; }
    const n = [vn[i * 3], vn[i * 3 + 1], vn[i * 3 + 2]];
    if (Math.abs(M.dot(n, c.n)) < minCos) { rejected++; continue; } // orientation-agnostic: BodyParts3D winding varies
    const back = bpGrid.closest(c.p, maxDist); if (!back || M.dist(back.p, p) > mutualTol) { rejected++; continue; }
    samples.push({ p, o: M.sub(c.p, p) }); sum += c.d;
  }
  return { samples, stats: { pairs: samples.length, rejected, meanGap_mm: +((sum / Math.max(1, samples.length)) * 1000).toFixed(1) } };
}

/** Bone offset samples: warped BodyParts3D bone -> closest point on the matching body.glb bone. */
export function bonePairs(pairs, { spacing = 0.01, maxDist = 0.04 } = {}) {
  const samples = []; const stats = {};
  for (const [tag, bpBoneW, target] of pairs) {
    const g = triGrid(target, 0.005); const P = bpBoneW.positions; let n = 0, s = 0;
    for (const i of surfaceSamples(bpBoneW, spacing)) {
      const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]; const c = g.closest(p, maxDist); if (!c) continue;
      samples.push({ p, o: M.sub(c.p, p) }); n++; s += c.d;
    }
    stats[tag] = { pairs: n, meanGap_mm: +((s / Math.max(1, n)) * 1000).toFixed(1) };
  }
  return { samples, stats };
}

/** Zero-offset anchors on bones that body.glb itself takes from the same warp. */
export function anchorSamples(meshes, { spacing = 0.012 } = {}) {
  const samples = [];
  for (const m of meshes) { const P = m.positions; for (const i of surfaceSamples(m, spacing)) samples.push({ p: [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], o: [0, 0, 0] }); }
  return samples;
}

/** Move a mesh by the offset field. */
export function applyField(m, field) {
  return M.mapVertices(m, (x, y, z) => { const { o } = field.at([x, y, z]); return [x + o[0], y + o[1], z + o[2]]; });
}

/**
 * Keep every vertex at least `minDepth` under the skin: inward push along the skin normal, smoothed over the mesh
 * (so neighbours follow and no crease forms), then a final exact clamp. Returns { mesh, moved, maxMove }.
 */
export function keepUnderSkin(m, skinGrid, { minDepth = 0.003, smooth = 4 } = {}) {
  const P = new Float32Array(m.positions); const n = P.length / 3;
  const corr = new Float32Array(n * 3); const hit = new Uint8Array(n);
  const measure = () => {
    let moved = 0;
    for (let i = 0; i < n; i++) {
      const q = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]; const d = depthAt(skinGrid, q);
      if (!d) continue; // more than 3 cm under the skin
      if (d.depth < minDepth) { const s = minDepth - d.depth; corr[i * 3] = -d.n[0] * s; corr[i * 3 + 1] = -d.n[1] * s; corr[i * 3 + 2] = -d.n[2] * s; hit[i] = 1; moved++; }
    }
    return moved;
  };
  const first = measure();
  if (first) {
    // spread the correction to neighbours (max-preserving blend), so the pushed patch keeps its shape
    const { offs, nb } = adjacency(m);
    for (let it = 0; it < smooth; it++) {
      const next = new Float32Array(corr);
      for (let i = 0; i < n; i++) {
        let x = 0, y = 0, z = 0, c = 0;
        for (let k = offs[i]; k < offs[i + 1]; k++) { const j = nb[k] * 3; x += corr[j]; y += corr[j + 1]; z += corr[j + 2]; c++; }
        if (!c) continue;
        x /= c; y /= c; z /= c;
        const l0 = corr[i * 3] ** 2 + corr[i * 3 + 1] ** 2 + corr[i * 3 + 2] ** 2;
        if (x * x + y * y + z * z > l0) { next[i * 3] = 0.5 * (corr[i * 3] + x); next[i * 3 + 1] = 0.5 * (corr[i * 3 + 1] + y); next[i * 3 + 2] = 0.5 * (corr[i * 3 + 2] + z); }
      }
      corr.set(next);
    }
    for (let i = 0; i < n * 3; i++) P[i] += corr[i];
    // exact pass: anything still shallower than minDepth goes straight to minDepth
    corr.fill(0);
    measure();
    for (let i = 0; i < n * 3; i++) P[i] += corr[i];
  }
  let maxMove = 0;
  for (let i = 0; i < n; i++) maxMove = Math.max(maxMove, Math.hypot(P[i * 3] - m.positions[i * 3], P[i * 3 + 1] - m.positions[i * 3 + 1], P[i * 3 + 2] - m.positions[i * 3 + 2]));
  return { mesh: { positions: P, indices: m.indices }, moved: first, maxMove };
}

/**
 * Signed depth under a closed surface (positive inside) with its closest point and outward normal, or null for points
 * more than `near` inside. A short search radius keeps deep queries cheap; far-outside points (rare) get a wide search.
 */
export function depthAt(grid, q, near = 0.03) {
  if (grid.deep && grid.deep(q)) return null;
  const d = grid.depth(q, near);
  if (d) return d;
  if (grid.inside(q)) return null;
  return grid.depth(q, 0.3);
}

/**
 * Attach a fast "deep inside" test to a triGrid of a closed surface: solid voxelization at `h`, then a breadth-first
 * erosion depth from the outside. A point whose voxel is >= `minVox` steps (6-neighbour) from any outside voxel is at
 * least about (minVox - 1.5) * h / sqrt(3) under the surface, so the exact (slow) queries can be skipped for it.
 */
export function withDeepTest(grid, surface, { h = 0.003, minVox = 5 } = {}) {
  const g = V.voxelizeSolid(surface, M.bounds(surface), h, { close: 1 });
  const { nx, ny, nz, origin, data } = g; const N = nx * ny * nz;
  const depth = new Uint8Array(N); const queue = new Int32Array(N); let qh = 0, qt = 0;
  for (let i = 0; i < N; i++) if (!data[i]) queue[qt++] = i; else depth[i] = 255;
  while (qh < qt) {
    const id = queue[qh++]; const d = id < 0 ? 0 : depth[id]; if (d >= minVox) continue;
    const i = id % nx, j = Math.floor(id / nx) % ny, k = Math.floor(id / (nx * ny));
    const nbs = [i > 0 ? id - 1 : -1, i < nx - 1 ? id + 1 : -1, j > 0 ? id - nx : -1, j < ny - 1 ? id + nx : -1, k > 0 ? id - nx * ny : -1, k < nz - 1 ? id + nx * ny : -1];
    for (const q of nbs) if (q >= 0 && depth[q] === 255) { depth[q] = d + 1; queue[qt++] = q; }
  }
  grid.deep = (p) => {
    const i = Math.floor((p[0] - origin[0]) / h), j = Math.floor((p[1] - origin[1]) / h), k = Math.floor((p[2] - origin[2]) / h);
    if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return false;
    return depth[i + nx * (j + ny * k)] >= minVox;
  };
  return grid;
}

/** Vertex adjacency (CSR). */
export function adjacency(m) {
  const n = m.positions.length / 3; const I = m.indices; const deg = new Uint32Array(n + 1);
  for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) deg[I[t + k] + 1] += 2;
  for (let i = 1; i <= n; i++) deg[i] += deg[i - 1];
  const nb = new Uint32Array(deg[n]); const fill = deg.slice(0, n);
  for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) { const a = I[t + k], b = I[t + (k + 1) % 3], c = I[t + (k + 2) % 3]; nb[fill[a]++] = b; nb[fill[a]++] = c; }
  return { offs: deg, nb };
}

/** Share of vertices strictly inside a closed surface (3-ray parity vote) and the shallowest signed depth. */
export function containment(m, grid, { stride = 1 } = {}) {
  const P = m.positions; let n = 0, inside = 0, minDepth = Infinity;
  for (let i = 0; i < P.length; i += 3 * stride) {
    const q = [P[i], P[i + 1], P[i + 2]]; n++;
    const d = depthAt(grid, q);
    if (!d || d.depth > 0) inside++; // (no hit = deeper than 3 cm)
    if (d) minDepth = Math.min(minDepth, d.depth);
  }
  return { share: inside / n, minDepth };
}

/** Principal axis (unit vector, +Y hemisphere) of a point set: power iteration on the covariance. */
export function principalAxis(m, filter = () => true) {
  const P = m.positions; const c = [0, 0, 0]; let n = 0;
  for (let i = 0; i < P.length; i += 3) if (filter(P[i], P[i + 1], P[i + 2])) { c[0] += P[i]; c[1] += P[i + 1]; c[2] += P[i + 2]; n++; }
  if (!n) return [0, 1, 0];
  c[0] /= n; c[1] /= n; c[2] /= n;
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < P.length; i += 3) {
    if (!filter(P[i], P[i + 1], P[i + 2])) continue;
    const d = [P[i] - c[0], P[i + 1] - c[1], P[i + 2] - c[2]];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += d[a] * d[b];
  }
  let v = [0.3, 1, 0.2];
  for (let it = 0; it < 60; it++) v = M.norm([0, 1, 2].map((a) => C[a][0] * v[0] + C[a][1] * v[1] + C[a][2] * v[2]));
  if (v[1] < 0) v = v.map((x) => -x);
  return v.map((x) => +x.toFixed(4));
}
