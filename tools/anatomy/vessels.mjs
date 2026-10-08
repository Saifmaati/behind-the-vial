// Vessel helpers: tube ends, bridging tubes for gaps in the source data, and keeping warped
// geometry inside the skin.
import * as M from './mesh.mjs';
import * as V from './voxel.mjs';

const { sub, add, scale, dot, cross, norm, dist, lerp } = M;

export function endOf(m, dir, tol = 0.003) {
  const d = norm(dir); const p = m.positions; let mx = -Infinity;
  for (let i = 0; i < p.length; i += 3) mx = Math.max(mx, p[i] * d[0] + p[i + 1] * d[1] + p[i + 2] * d[2]);
  let n = 0; const c = [0, 0, 0];
  for (let i = 0; i < p.length; i += 3) if (p[i] * d[0] + p[i + 1] * d[1] + p[i + 2] * d[2] > mx - tol) { c[0] += p[i]; c[1] += p[i + 1]; c[2] += p[i + 2]; n++; }
  return c.map((v) => v / n);
}

/** Open end of a tube: centre, outward tangent and radius, for the extreme end along `dir`. */
export function tubeEnd(m, dir) {
  const tip = endOf(m, dir, 0.002); const p = m.positions;
  const ring = [], inner = [];
  for (let i = 0; i < p.length; i += 3) {
    const v = [p[i], p[i + 1], p[i + 2]]; const d = dist(v, tip);
    if (d < 0.012) ring.push(v); else if (d < 0.025) inner.push(v);
  }
  const c = ring.reduce((s, v) => add(s, v), [0, 0, 0]).map((x) => x / ring.length);
  const ci = inner.length ? inner.reduce((s, v) => add(s, v), [0, 0, 0]).map((x) => x / inner.length) : sub(c, scale(norm(dir), 0.01));
  const tangent = norm(sub(c, ci));
  const radius = ring.reduce((s, v) => s + M.len(sub(sub(v, c), scale(tangent, dot(sub(v, c), tangent)))), 0) / ring.length;
  return { center: c, tangent, radius: Math.max(0.0008, radius) };
}

/** Cubic Hermite tube from end a (leaving along a.tangent) to end b (arriving against b.tangent). */
export function bridgeTube(a, b, { sides = 10, step = 0.004 } = {}) {
  const L = dist(a.center, b.center); const n = Math.max(4, Math.ceil(L / step));
  const t0 = scale(a.tangent, L), t1 = scale(b.tangent, -L);
  const P = (t) => { const t2 = t * t, t3 = t2 * t; const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2; return [0, 1, 2].map((k) => h00 * a.center[k] + h10 * t0[k] + h01 * b.center[k] + h11 * t1[k]); };
  const pts = Array.from({ length: n + 1 }, (_, i) => P(i / n));
  const pos = [], idx = [];
  const tan0 = norm(sub(pts[1], pts[0]));
  let u = norm(cross(tan0, Math.abs(tan0[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  for (let i = 0; i <= n; i++) {
    const tan = norm(sub(pts[Math.min(n, i + 1)], pts[Math.max(0, i - 1)]));
    u = norm(sub(u, scale(tan, dot(u, tan)))); const v = cross(tan, u); // parallel transport of the ring frame
    const r = a.radius + (b.radius - a.radius) * (i / n);
    for (let s = 0; s < sides; s++) { const ang = (s / sides) * Math.PI * 2; const q = add(pts[i], add(scale(u, Math.cos(ang) * r), scale(v, Math.sin(ang) * r))); pos.push(...q); }
  }
  for (let i = 0; i < n; i++) for (let s = 0; s < sides; s++) {
    const a0 = i * sides + s, a1 = i * sides + ((s + 1) % sides), b0 = a0 + sides, b1 = a1 + sides;
    idx.push(a0, b0, a1, a1, b0, b1);
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx), centerline: pts };
}

/** Smooth inside-ness field of a closed skin (1 inside, 0 outside, 0.5 at the surface). */
export function insideField(skin, h = 0.003, { band = 40 } = {}) {
  const b = M.bounds(skin);
  const solid = V.voxelizeSolid(skin, b, h, { close: 1 });
  const g = V.blur(solid, 1);
  const { nx, ny, nz, origin, data } = g;
  // Multi-source BFS from the solid voxels: for outside voxels within `band`, the nearest (BFS) solid voxel.
  const N = nx * ny * nz; const near = new Int32Array(N).fill(-1); const queue = new Int32Array(N); let qh = 0, qt = 0;
  const depth = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (solid.data[i]) { near[i] = i; queue[qt++] = i; }
  while (qh < qt) {
    const id = queue[qh++]; if (depth[id] >= band) continue;
    const i = id % nx, j = Math.floor(id / nx) % ny, k = Math.floor(id / (nx * ny));
    const nb = [i > 0 ? id - 1 : -1, i < nx - 1 ? id + 1 : -1, j > 0 ? id - nx : -1, j < ny - 1 ? id + nx : -1, k > 0 ? id - nx * ny : -1, k < nz - 1 ? id + nx * ny : -1];
    for (const q of nb) if (q >= 0 && near[q] < 0) { near[q] = near[id]; depth[q] = depth[id] + 1; queue[qt++] = q; }
  }
  const nearestInside = (p) => {
    const i = Math.round((p[0] - origin[0]) / h), j = Math.round((p[1] - origin[1]) / h), k = Math.round((p[2] - origin[2]) / h);
    if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return null;
    const id = near[i + nx * (j + ny * k)]; if (id < 0) return null;
    return [origin[0] + (id % nx) * h, origin[1] + (Math.floor(id / nx) % ny) * h, origin[2] + Math.floor(id / (nx * ny)) * h];
  };
  const at = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz ? 0 : data[i + nx * (j + ny * k)]);
  const sample = (p) => {
    const x = (p[0] - origin[0]) / h, y = (p[1] - origin[1]) / h, z = (p[2] - origin[2]) / h;
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z); const fx = x - i, fy = y - j, fz = z - k;
    let v = 0;
    for (let c = 0; c < 8; c++) { const di = c & 1, dj = (c >> 1) & 1, dk = (c >> 2) & 1; v += at(i + di, j + dj, k + dk) * (di ? fx : 1 - fx) * (dj ? fy : 1 - fy) * (dk ? fz : 1 - fz); }
    return v;
  };
  const grad = (p) => { const e = h * 0.75; return norm([sample(add(p, [e, 0, 0])) - sample(sub(p, [e, 0, 0])), sample(add(p, [0, e, 0])) - sample(sub(p, [0, e, 0])), sample(add(p, [0, 0, e])) - sample(sub(p, [0, 0, e]))]); };
  return { sample, grad, h, nearestInside };
}

/** Move vertices that lie outside or right at the skin inward (along the field gradient) until field >= minF. */
export function clampInside(m, field, { minF = 0.7, step = 0.0008, maxSteps = 80 } = {}) {
  const p = new Float32Array(m.positions); let moved = 0, maxMove = 0;
  for (let i = 0; i < p.length; i += 3) {
    let q = [p[i], p[i + 1], p[i + 2]]; const q0 = q; let f = field.sample(q); if (f >= minF) continue;
    if (f < 0.05) { const t = field.nearestInside(q); if (t) { q = t; f = field.sample(q); } } // far outside: jump to the nearest solid voxel first
    for (let s = 0; s < maxSteps && f < minF; s++) { const g = field.grad(q); if (!Number.isFinite(g[0])) break; q = add(q, scale(g, step)); f = field.sample(q); }
    p[i] = q[0]; p[i + 1] = q[1]; p[i + 2] = q[2]; moved++; maxMove = Math.max(maxMove, dist(q, q0));
  }
  return { mesh: { positions: p, indices: m.indices }, moved, maxMove };
}

/**
 * Contact resolution: move the vertices of mesh `m` that lie inside the closed shell `organ` to just outside it (nearest
 * exterior voxel by breadth-first search, plus `margin`). Used for an organ placed by a non-rigid fit (the female
 * stomach) so that it rests against its neighbours instead of passing through them.
 */
export function pushOutside(m, organ, { h = 0.002, margin = 0.001, maxMove = 0.05 } = {}) {
  const b = M.bounds(organ);
  const solid = V.voxelizeSolid(organ, b, h, { close: 1 });
  const { nx, ny, nz, origin, data } = solid; const N = nx * ny * nz;
  const near = new Int32Array(N).fill(-1); const queue = new Int32Array(N); let qh = 0, qt = 0;
  for (let i = 0; i < N; i++) if (!data[i]) { near[i] = i; queue[qt++] = i; }
  while (qh < qt) {
    const id = queue[qh++]; const i = id % nx, j = Math.floor(id / nx) % ny, k = Math.floor(id / (nx * ny));
    for (const q of [i > 0 ? id - 1 : -1, i < nx - 1 ? id + 1 : -1, j > 0 ? id - nx : -1, j < ny - 1 ? id + nx : -1, k > 0 ? id - nx * ny : -1, k < nz - 1 ? id + nx * ny : -1]) {
      if (q >= 0 && near[q] < 0) { near[q] = near[id]; queue[qt++] = q; }
    }
  }
  const c = (id) => [origin[0] + (id % nx) * h, origin[1] + (Math.floor(id / nx) % ny) * h, origin[2] + Math.floor(id / (nx * ny)) * h];
  const p = new Float32Array(m.positions); let moved = 0, maxD = 0;
  for (let v = 0; v < p.length; v += 3) {
    const q0 = [p[v], p[v + 1], p[v + 2]];
    const i = Math.round((q0[0] - origin[0]) / h), j = Math.round((q0[1] - origin[1]) / h), k = Math.round((q0[2] - origin[2]) / h);
    if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) continue;
    const id = i + nx * (j + ny * k); if (!data[id]) continue;
    const t = c(near[id]); const d = sub(t, q0); const L = M.len(d); if (L > maxMove) continue;
    const q = add(t, scale(norm(d), margin + h * 0.5));
    p[v] = q[0]; p[v + 1] = q[1]; p[v + 2] = q[2]; moved++; maxD = Math.max(maxD, dist(q, q0));
  }
  return { mesh: { positions: p, indices: m.indices }, moved, maxMove: maxD };
}
