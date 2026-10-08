// Uniform-grid triangle index: exact closest-point queries, ray parity (inside/outside) and signed depth
// against a triangle mesh. Used to measure alignment (skin_hi vs body.glb skin), keep warped muscles
// a set depth under the skin, and test faces for enclosure. Dev-only, plain JS, memory ~ 12 B per cell entry.

/** Build a grid over triangles. cell in metres (about 2-3x the mean edge length works well). */
export function triGrid(m, cell = 0.006) {
  const P = m.positions, I = m.indices, nt = I.length / 3;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let a = 0; a < 3; a++) { const v = P[i + a]; if (v < min[a]) min[a] = v; if (v > max[a]) max[a] = v; }
  for (let a = 0; a < 3; a++) { min[a] -= cell; max[a] += cell; }
  const nx = Math.ceil((max[0] - min[0]) / cell), ny = Math.ceil((max[1] - min[1]) / cell), nz = Math.ceil((max[2] - min[2]) / cell);
  const cid = (i, j, k) => i + nx * (j + ny * k);
  const ci = (v, a) => Math.min([nx, ny, nz][a] - 1, Math.max(0, Math.floor((v - min[a]) / cell)));
  // two passes: count, then fill (CSR)
  const count = new Uint32Array(nx * ny * nz + 1);
  const range = (t) => {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    const lo = [0, 1, 2].map((k) => ci(Math.min(P[a + k], P[b + k], P[c + k]), k));
    const hi = [0, 1, 2].map((k) => ci(Math.max(P[a + k], P[b + k], P[c + k]), k));
    return [lo, hi];
  };
  for (let t = 0; t < nt; t++) { const [lo, hi] = range(t); for (let k = lo[2]; k <= hi[2]; k++) for (let j = lo[1]; j <= hi[1]; j++) for (let i = lo[0]; i <= hi[0]; i++) count[cid(i, j, k) + 1]++; }
  for (let i = 1; i < count.length; i++) count[i] += count[i - 1];
  const items = new Uint32Array(count[count.length - 1]); const fill = count.slice(0, -1);
  for (let t = 0; t < nt; t++) { const [lo, hi] = range(t); for (let k = lo[2]; k <= hi[2]; k++) for (let j = lo[1]; j <= hi[1]; j++) for (let i = lo[0]; i <= hi[0]; i++) items[fill[cid(i, j, k)]++] = t; }
  // per-triangle unit normals (for signed distance)
  const fn = new Float32Array(nt * 3);
  for (let t = 0; t < nt; t++) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx; const l = Math.hypot(x, y, z) || 1; fn[t * 3] = x / l; fn[t * 3 + 1] = y / l; fn[t * 3 + 2] = z / l;
  }
  // vertex normals (angle-free area weighting) for pseudo-normal sign tests at vertices/edges
  const vn = new Float32Array(P.length);
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) { const v = I[t * 3 + k] * 3; vn[v] += fn[t * 3]; vn[v + 1] += fn[t * 3 + 1]; vn[v + 2] += fn[t * 3 + 2]; }
  for (let i = 0; i < vn.length; i += 3) { const l = Math.hypot(vn[i], vn[i + 1], vn[i + 2]) || 1; vn[i] /= l; vn[i + 1] /= l; vn[i + 2] /= l; }
  const stamp = new Uint32Array(nt); let epoch = 0;

  /** Closest point on the mesh within maxR (metres). Returns { d, p:[x,y,z], tri, n:[outward normal at p] } or null. */
  function closest(q, maxR = 0.05) {
    epoch++; if (epoch === 0xffffffff) { stamp.fill(0); epoch = 1; }
    let best = null, bd = maxR * maxR;
    const c0 = [0, 1, 2].map((a) => ci(q[a], a));
    const rings = Math.ceil(maxR / cell);
    for (let r = 0; r <= rings; r++) {
      if (best && (r - 1) * cell > Math.sqrt(bd)) break;
      for (let k = c0[2] - r; k <= c0[2] + r; k++) { if (k < 0 || k >= nz) continue;
        for (let j = c0[1] - r; j <= c0[1] + r; j++) { if (j < 0 || j >= ny) continue;
          for (let i = c0[0] - r; i <= c0[0] + r; i++) { if (i < 0 || i >= nx) continue;
            if (Math.max(Math.abs(i - c0[0]), Math.abs(j - c0[1]), Math.abs(k - c0[2])) !== r) continue; // shell only
            const id = cid(i, j, k);
            for (let s = count[id]; s < count[id + 1]; s++) {
              const t = items[s]; if (stamp[t] === epoch) continue; stamp[t] = epoch;
              const r2 = closestOnTri(q, P, I, t);
              if (r2.d2 < bd) { bd = r2.d2; best = { t, p: r2.p, region: r2.region, v: r2.v }; }
            }
          }
        }
      }
    }
    if (!best) return null;
    // outward normal: face normal inside the face; vertex/edge pseudo-normals at the border regions
    let n;
    if (best.region === 0) n = [fn[best.t * 3], fn[best.t * 3 + 1], fn[best.t * 3 + 2]];
    else { const vs = best.v; n = [0, 0, 0]; for (const v of vs) { n[0] += vn[v * 3]; n[1] += vn[v * 3 + 1]; n[2] += vn[v * 3 + 2]; } const l = Math.hypot(...n) || 1; n = n.map((x) => x / l); }
    return { d: Math.sqrt(bd), p: best.p, tri: best.t, n };
  }

  /** Signed depth: positive inside (below the surface), negative outside. Uses the closest point's pseudo-normal. */
  function depth(q, maxR = 0.05) {
    const c = closest(q, maxR); if (!c) return null;
    const s = (q[0] - c.p[0]) * c.n[0] + (q[1] - c.p[1]) * c.n[1] + (q[2] - c.p[2]) * c.n[2];
    return { depth: s > 0 ? -c.d : c.d, ...c };
  }

  /** Number of crossings of the ray q + t*dir (t > 0) with the mesh. */
  function rayCount(q, dir) {
    // 3D DDA through the grid
    let n = 0; epoch++; if (epoch === 0xffffffff) { stamp.fill(0); epoch = 1; }
    let i = ci(q[0], 0), j = ci(q[1], 1), k = ci(q[2], 2);
    const step = dir.map((d) => (d > 0 ? 1 : d < 0 ? -1 : 0));
    const next = [0, 1, 2].map((a) => { if (!step[a]) return Infinity; const b = min[a] + ([i, j, k][a] + (step[a] > 0 ? 1 : 0)) * cell; return (b - q[a]) / dir[a]; });
    const dt = dir.map((d) => (d ? Math.abs(cell / d) : Infinity));
    while (i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz) {
      const id = cid(i, j, k);
      for (let s = count[id]; s < count[id + 1]; s++) { const t = items[s]; if (stamp[t] === epoch) continue; stamp[t] = epoch; if (rayTri(q, dir, P, I, t)) n++; }
      if (next[0] < next[1] && next[0] < next[2]) { i += step[0]; next[0] += dt[0]; } else if (next[1] < next[2]) { j += step[1]; next[1] += dt[1]; } else { k += step[2]; next[2] += dt[2]; }
    }
    return n;
  }
  /** Inside test by majority vote of 3 skewed ray parities (robust to grazing hits). */
  function inside(q) {
    const dirs = [[0.577, 0.611, 0.542], [-0.62, 0.21, 0.756], [0.31, -0.83, -0.46]];
    let v = 0; for (const d of dirs) if (rayCount(q, d) % 2 === 1) v++;
    return v >= 2;
  }
  return { closest, depth, rayCount, inside, cell, triNormals: fn, vertexNormals: vn };
}

function rayTri(o, d, P, I, t) {
  const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
  const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
  const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
  const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
  const det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-14) return false;
  const inv = 1 / det; const tx = o[0] - P[a], ty = o[1] - P[a + 1], tz = o[2] - P[a + 2];
  const u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) return false;
  const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
  const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (v < 0 || u + v > 1) return false;
  return (e2x * qx + e2y * qy + e2z * qz) * inv > 1e-9;
}

/** Closest point on triangle t to q (Ericson, Real-Time Collision Detection 5.1.5). region 0 = face interior. */
function closestOnTri(q, P, I, t) {
  const ia = I[t * 3], ib = I[t * 3 + 1], ic = I[t * 3 + 2];
  const a = [P[ia * 3], P[ia * 3 + 1], P[ia * 3 + 2]], b = [P[ib * 3], P[ib * 3 + 1], P[ib * 3 + 2]], c = [P[ic * 3], P[ic * 3 + 1], P[ic * 3 + 2]];
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], ap = [q[0] - a[0], q[1] - a[1], q[2] - a[2]];
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const out = (p, region, v) => ({ p, region, v, d2: (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2 });
  const d1 = dot(ab, ap), d2 = dot(ac, ap); if (d1 <= 0 && d2 <= 0) return out(a, 1, [ia]);
  const bp = [q[0] - b[0], q[1] - b[1], q[2] - b[2]]; const d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) return out(b, 1, [ib]);
  const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return out([a[0] + v * ab[0], a[1] + v * ab[1], a[2] + v * ab[2]], 2, [ia, ib]); }
  const cp = [q[0] - c[0], q[1] - c[1], q[2] - c[2]]; const d5 = dot(ab, cp), d6 = dot(ac, cp); if (d6 >= 0 && d5 <= d6) return out(c, 1, [ic]);
  const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return out([a[0] + w * ac[0], a[1] + w * ac[1], a[2] + w * ac[2]], 2, [ia, ic]); }
  const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return out([b[0] + w * (c[0] - b[0]), b[1] + w * (c[1] - b[1]), b[2] + w * (c[2] - b[2])], 2, [ib, ic]); }
  const den = 1 / (va + vb + vc); const v = vb * den, w = vc * den;
  return out([a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w], 0, [ia, ib, ic]);
}
