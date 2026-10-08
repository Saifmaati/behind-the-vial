// Skin "rings": corresponding radial sample points on body cross-sections, used as landmarks for a
// thin-plate-spline warp between two different bodies (BodyParts3D -> HRA / Visible Human Male).
// Both skins must already be in the same axis convention (metres, +Y up, +Z front, +X person's left).
import { slice, loopStats } from './slice.mjs';
import { sub, add, scale, dot, cross, norm, dist } from './mesh.mjs';

const Y = [0, 1, 0];

/** Loops of a horizontal slice at height y, with stats. */
export function hLoops(skin, y) {
  return slice(skin, [0, y, 0], Y).filter((l) => l.closed && l.points.length > 8).map((l) => ({ ...l, ...loopStats(l.points, Y) }));
}

function pointInPoly2(pts, p, ax = 0, az = 2) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][ax], zi = pts[i][az], xj = pts[j][ax], zj = pts[j][az];
    if ((zi > p[az]) !== (zj > p[az]) && p[ax] < ((xj - xi) * (p[az] - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

/** Distance from c along unit direction d (in the loop plane) to the loop boundary (farthest crossing). */
function rayToLoop(points, c, d) {
  let best = null;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    // solve c + t d = a + s (b - a), least squares in 3D (coplanar)
    const e = sub(b, a), w = sub(a, c);
    const n = cross(d, e); const nn = dot(n, n); if (nn < 1e-18) continue;
    const t = dot(cross(w, e), n) / nn; const s = dot(cross(w, d), n) / nn;
    if (s >= 0 && s <= 1 && t > 0 && (best === null || t > best)) best = t;
  }
  return best;
}

/** Radial samples on a loop: k directions, angle 0 = `ref` projected into the plane with normal n. */
export function ringSamples(loop, center, n, ref, k = 12, frac = 0.9) {
  const u = norm(sub(ref, scale(n, dot(ref, n)))); const v = cross(n, u);
  const out = [];
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2; const d = add(scale(u, Math.cos(a)), scale(v, Math.sin(a)));
    const t = rayToLoop(loop.points, center, d);
    out.push(t == null ? null : add(center, scale(d, t * frac)));
  }
  return out;
}

/** Horizontal ring through the loop that contains point p (x,z) at height y. */
export function ringAt(skin, y, p, k = 12, frac = 0.9) {
  const loops = hLoops(skin, y);
  let loop = loops.find((l) => pointInPoly2(l.points, [p[0], y, p[2]]));
  if (!loop) loop = loops.sort((a, b) => dist(a.centroid, [p[0], y, p[2]]) - dist(b.centroid, [p[0], y, p[2]]))[0];
  if (!loop) return null;
  return { center: loop.centroid, area: loop.area, samples: ringSamples(loop, loop.centroid, Y, [0, 0, 1], k, frac) };
}

/** Highest y (scanning down from yTop) where a separate loop exists whose centroid satisfies pred. */
export function findSplitHeight(skin, yTop, yBottom, pred, step = 0.004) {
  for (let y = yTop; y > yBottom; y -= step) {
    const loops = hLoops(skin, y);
    if (loops.some((l) => pred(l.centroid) && l.area > 1e-4)) return y;
  }
  return null;
}

/** Slice perpendicular to direction d at point q; return the loop nearest q. */
export function limbLoop(skin, q, d) {
  const loops = slice(skin, q, d).filter((l) => l.closed && l.points.length > 8).map((l) => ({ ...l, ...loopStats(l.points, d) }));
  if (!loops.length) return null;
  return loops.sort((a, b) => dist(a.centroid, q) - dist(b.centroid, q))[0];
}

/**
 * Trace a limb from a root point toward a tip point. Returns the centreline (refined) and rings at the given
 * fractions of the root->tip distance. Ring angle 0 = anterior (+Z).
 */
export function traceLimb(skin, root, tip, fractions, { k = 8, frac = 0.9 } = {}) {
  const L = dist(root, tip); let d = norm(sub(tip, root));
  const centers = [];
  // first pass: centroids along the straight root->tip line
  const ts = Array.from({ length: 21 }, (_, i) => 0.05 + (0.9 * i) / 20);
  for (const t of ts) { const q = add(root, scale(d, t * L)); const lp = limbLoop(skin, q, d); centers.push(lp ? lp.centroid : q); }
  const rings = [];
  for (const f of fractions) {
    // local tangent from neighbouring first-pass centres
    const i = Math.max(1, Math.min(ts.length - 2, Math.round(((f - 0.05) / 0.9) * 20)));
    const tan = norm(sub(centers[i + 1], centers[i - 1]));
    const q0 = add(root, scale(d, f * L));
    // project q0 onto the local centre line
    const q = add(centers[i], scale(tan, dot(sub(q0, centers[i]), tan)));
    const lp = limbLoop(skin, q, tan);
    if (!lp) { rings.push(null); continue; }
    rings.push({ f, center: lp.centroid, area: lp.area, normal: tan, samples: ringSamples(lp, lp.centroid, tan, [0, 0, 1], k, frac) });
  }
  return { centers, rings };
}

/**
 * Hand landmarks beyond the wrist plane: five fingertips (thumb first, then index..little) found as local maxima of the
 * distance from the wrist centre, plus the palm centre.
 */
export function handLandmarks(skin, wrist, axis, { maxReach = 0.3, localR = 0.012, mergeR = 0.01, order = 'thumbDistance' } = {}) {
  const p = skin.positions; const I = skin.indices;
  const V = (i) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]];
  // candidate vertices beyond the wrist plane, then keep only the surface connected to the wrist ring (the hand),
  // which excludes nearby thigh/hip skin that also lies beyond the plane
  const cand = new Uint8Array(p.length / 3);
  for (let i = 0; i < p.length / 3; i++) { const d = sub(V(i), wrist); if (dot(d, axis) > 0 && Math.hypot(...d) < maxReach) cand[i] = 1; }
  const adj = new Map();
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2]; if (!cand[a] || !cand[b] || !cand[c]) continue;
    for (const [x, y] of [[a, b], [b, c], [c, a]]) { if (!adj.has(x)) adj.set(x, []); if (!adj.has(y)) adj.set(y, []); adj.get(x).push(y); adj.get(y).push(x); }
  }
  const seen = new Uint8Array(p.length / 3); const queue = [];
  for (const i of adj.keys()) { const d = sub(V(i), wrist); if (dot(d, axis) < 0.01 && Math.hypot(...d) < 0.06) { seen[i] = 1; queue.push(i); } }
  for (let h = 0; h < queue.length; h++) for (const j of adj.get(queue[h]) || []) if (!seen[j]) { seen[j] = 1; queue.push(j); }
  const ids = queue;
  const dW = new Map(ids.map((i) => [i, dist(V(i), wrist)]));
  const cell = localR; const grid = new Map(); const key = (q) => `${Math.floor(q[0] / cell)},${Math.floor(q[1] / cell)},${Math.floor(q[2] / cell)}`;
  for (const i of ids) { const k = key(V(i)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); }
  const near = (q) => { const out = []; const [a, b, c] = key(q).split(',').map(Number); for (let x = a - 1; x <= a + 1; x++) for (let y = b - 1; y <= b + 1; y++) for (let z = c - 1; z <= c + 1; z++) for (const j of grid.get(`${x},${y},${z}`) || []) if (dist(V(j), q) < localR) out.push(j); return out; };
  let tips = ids.filter((i) => near(V(i)).every((j) => dW.get(j) <= dW.get(i)));
  tips.sort((a, b) => dW.get(b) - dW.get(a));
  const kept = [];
  for (const t of tips) if (!kept.some((k) => dist(V(k), V(t)) < mergeR)) kept.push(t);
  const five = kept.slice(0, 5).map(V);
  if (five.length < 5) return null;
  five.sort((a, b) => dist(a, wrist) - dist(b, wrist));
  const thumb = five[0];
  // 'thumbDistance' (default): index..little by distance from the thumb tip. 'lateral': by position across the hand,
  // from the thumb side, which stays right when a curled little finger lies closer to the thumb than the ring finger.
  let rest;
  if (order === 'lateral') {
    const tw = sub(thumb, wrist); const u = norm(sub(tw, scale(axis, dot(tw, axis))));
    rest = five.slice(1).sort((a, b) => dot(sub(b, wrist), u) - dot(sub(a, wrist), u));
  } else rest = five.slice(1).sort((a, b) => dist(a, thumb) - dist(b, thumb));
  const maxAlong = Math.max(...ids.map((i) => dot(sub(V(i), wrist), axis)));
  const palmIds = ids.filter((i) => dot(sub(V(i), wrist), axis) < 0.4 * maxAlong);
  const palm = palmIds.reduce((s, i) => add(s, V(i)), [0, 0, 0]).map((x) => x / palmIds.length);
  return { tips: [thumb, ...rest], palm };
}
