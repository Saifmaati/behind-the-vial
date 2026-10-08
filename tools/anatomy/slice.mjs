// Plane slicing and ray casting against triangle meshes (dev-only geometry helpers).
import { sub, dot, cross, norm, add, scale } from './mesh.mjs';

/** Intersect mesh with plane (point o, normal n). Returns closed/open polylines (arrays of 3D points). */
export function slice(m, o, n) {
  const p = m.positions, I = m.indices; const nv = p.length / 3;
  const d = new Float64Array(nv);
  for (let i = 0; i < nv; i++) d[i] = (p[i * 3] - o[0]) * n[0] + (p[i * 3 + 1] - o[1]) * n[1] + (p[i * 3 + 2] - o[2]) * n[2];
  const segs = []; const key = (a, b) => (a < b ? a * nv + b : b * nv + a);
  const pt = (a, b) => { const t = d[a] / (d[a] - d[b]); return [p[a * 3] + t * (p[b * 3] - p[a * 3]), p[a * 3 + 1] + t * (p[b * 3 + 1] - p[a * 3 + 1]), p[a * 3 + 2] + t * (p[b * 3 + 2] - p[a * 3 + 2])]; };
  for (let t = 0; t < I.length; t += 3) {
    const v = [I[t], I[t + 1], I[t + 2]];
    const s = v.map((i) => (d[i] > 0 ? 1 : 0));
    const sum = s[0] + s[1] + s[2]; if (sum === 0 || sum === 3) continue;
    const e = [];
    for (let k = 0; k < 3; k++) { const a = v[k], b = v[(k + 1) % 3]; if (s[k] !== s[(k + 1) % 3]) e.push(key(a, b)); }
    if (e.length === 2) segs.push(e);
  }
  // chain segments through shared edge keys
  const byKey = new Map();
  segs.forEach((sg, i) => sg.forEach((k) => { if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(i); }));
  const used = new Uint8Array(segs.length); const loops = [];
  const kp = (k) => { const a = Math.floor(k / nv), b = k - a * nv; return pt(a, b); };
  for (let s0 = 0; s0 < segs.length; s0++) {
    if (used[s0]) continue; used[s0] = 1;
    const chain = [segs[s0][0], segs[s0][1]];
    let cur = segs[s0][1];
    for (;;) { const nx = (byKey.get(cur) || []).find((i) => !used[i]); if (nx === undefined) break; used[nx] = 1; const other = segs[nx][0] === cur ? segs[nx][1] : segs[nx][0]; chain.push(other); cur = other; if (cur === chain[0]) break; }
    loops.push({ points: chain.map(kp), closed: cur === chain[0] });
  }
  return loops;
}

/** Area-weighted centroid and area of a planar loop (plane normal n). */
export function loopStats(points, n) {
  // project to plane basis
  const u = norm(Math.abs(n[0]) < 0.9 ? cross(n, [1, 0, 0]) : cross(n, [0, 1, 0])); const v = cross(n, u);
  const o = points[0]; const P = points.map((q) => [dot(sub(q, o), u), dot(sub(q, o), v)]);
  let A = 0, cx = 0, cy = 0, per = 0;
  for (let i = 0; i < P.length; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length]; const c = x0 * y1 - x1 * y0;
    A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c; per += Math.hypot(x1 - x0, y1 - y0);
  }
  A /= 2; if (Math.abs(A) < 1e-12) { const m = points.reduce((s, q) => add(s, q), [0, 0, 0]); return { area: 0, centroid: scale(m, 1 / points.length), perimeter: per }; }
  cx /= 6 * A; cy /= 6 * A;
  return { area: Math.abs(A), centroid: add(o, add(scale(u, cx), scale(v, cy))), perimeter: per };
}

/** Möller–Trumbore: all hit distances of ray (o, unit d) with the mesh (t > eps), sorted. */
export function rayHits(m, o, d, { eps = 1e-7, withTri = false } = {}) {
  const p = m.positions, I = m.indices; const hits = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const e1 = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]], e2 = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
    const h = cross(d, e2); const det = dot(e1, h); if (Math.abs(det) < 1e-14) continue;
    const f = 1 / det; const s = [o[0] - p[a], o[1] - p[a + 1], o[2] - p[a + 2]];
    const uu = f * dot(s, h); if (uu < 0 || uu > 1) continue;
    const q = cross(s, e1); const vv = f * dot(d, q); if (vv < 0 || uu + vv > 1) continue;
    const tt = f * dot(e2, q); if (tt > eps) hits.push(withTri ? { t: tt, tri: t / 3, normal: norm(cross(e1, e2)) } : tt);
  }
  return withTri ? hits.sort((x, y) => x.t - y.t) : hits.sort((x, y) => x - y);
}

/** Point-in-closed-mesh by ray parity, voted over 3 skewed directions (robust to grazing hits). */
export function inside(m, o) {
  const dirs = [norm([0.31, 0.93, 0.17]), norm([-0.62, 0.21, 0.75]), norm([0.11, -0.47, -0.88])];
  let votes = 0; for (const d of dirs) if (rayHits(m, o, d).length % 2 === 1) votes++;
  return votes >= 2;
}
