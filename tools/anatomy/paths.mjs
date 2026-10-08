// Flow-path helpers: follow vessel meshes between anatomical anchor points and tidy waypoint lists.
import { sub, add, scale, dot, norm, dist, len, lerp } from './mesh.mjs';

/** Spatial hash of mesh vertices for radius queries. */
export function pointIndex(m, cell = 0.01) {
  const map = new Map(); const p = m.positions; const inv = 1 / cell;
  const key = (i, j, k) => `${i},${j},${k}`;
  for (let v = 0; v < p.length; v += 3) {
    const k = key(Math.floor(p[v] * inv), Math.floor(p[v + 1] * inv), Math.floor(p[v + 2] * inv));
    if (!map.has(k)) map.set(k, []); map.get(k).push(v);
  }
  return {
    near(q, r) {
      const out = []; const r2 = r * r;
      const i0 = Math.floor((q[0] - r) * inv), i1 = Math.floor((q[0] + r) * inv);
      const j0 = Math.floor((q[1] - r) * inv), j1 = Math.floor((q[1] + r) * inv);
      const k0 = Math.floor((q[2] - r) * inv), k1 = Math.floor((q[2] + r) * inv);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) {
        const b = map.get(key(i, j, k)); if (!b) continue;
        for (const v of b) { const dx = p[v] - q[0], dy = p[v + 1] - q[1], dz = p[v + 2] - q[2]; if (dx * dx + dy * dy + dz * dz <= r2) out.push([p[v], p[v + 1], p[v + 2]]); }
      }
      return out;
    },
  };
}

/** Nearest mesh vertex to q (brute force). */
export function nearestVertex(m, q) {
  const p = m.positions; let best = Infinity, bi = 0;
  for (let v = 0; v < p.length; v += 3) { const d = (p[v] - q[0]) ** 2 + (p[v + 1] - q[1]) ** 2 + (p[v + 2] - q[2]) ** 2; if (d < best) { best = d; bi = v; } }
  return [p[bi], p[bi + 1], p[bi + 2]];
}

/**
 * Walk from `from` toward `to`, re-centring each step on the vessel lumen: the centroid of vessel-wall
 * vertices inside a thin slab perpendicular to the walking direction and within `radius`.
 */
export function followVessel(index, from, to, { step = 0.006, radius = 0.012, inertia = 0.5 } = {}) {
  const pts = [from]; let p = from; let dir = norm(sub(to, from)); let guard = 0;
  while (dist(p, to) > step * 1.5 && guard++ < 2000) {
    const want = norm(sub(to, p));
    dir = norm(add(scale(dir, inertia), scale(want, 1 - inertia)));
    let q = add(p, scale(dir, step));
    const near = index.near(q, radius).filter((v) => Math.abs(dot(sub(v, q), dir)) < step * 0.75);
    if (near.length >= 6) {
      const c = near.reduce((s, v) => add(s, v), [0, 0, 0]).map((x) => x / near.length);
      const off = sub(c, q); q = add(q, sub(off, scale(dir, dot(off, dir))));
    }
    dir = norm(sub(q, p)); pts.push(q); p = q;
  }
  pts.push(to);
  return pts;
}

/** Resample a polyline at roughly uniform spacing (keeps endpoints). */
export function resample(pts, spacing) {
  const out = [pts[0]]; let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1]; const b = pts[i]; let seg = dist(a, b);
    while (acc + seg >= spacing) { const t = (spacing - acc) / seg; a = lerp(a, b, t); out.push(a); seg = dist(a, b); acc = 0; }
    acc += seg;
  }
  if (dist(out[out.length - 1], pts[pts.length - 1]) > spacing * 0.35) out.push(pts[pts.length - 1]); else out[out.length - 1] = pts[pts.length - 1];
  return out;
}

/** Light Laplacian smoothing of interior waypoints. */
export function smoothPath(pts, iterations = 2, k = 0.35) {
  let p = pts.map((q) => q.slice());
  for (let it = 0; it < iterations; it++) p = p.map((q, i) => (i === 0 || i === p.length - 1 ? q : add(q, scale(sub(scale(add(p[i - 1], p[i + 1]), 0.5), q), k))));
  return p;
}

/** Concatenate path segments, dropping duplicated joints. */
export function concat(...segs) {
  const out = [];
  for (const s of segs) for (const q of s) if (!out.length || dist(out[out.length - 1], q) > 1e-4) out.push(q);
  return out;
}

export const pathLength = (pts) => pts.slice(1).reduce((s, q, i) => s + dist(pts[i], q), 0);
export { len };
