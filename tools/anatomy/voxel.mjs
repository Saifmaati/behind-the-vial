// Voxel utilities: solid voxelization of (nearly) closed meshes, smoothing, and Surface Nets meshing.
// Used to turn segmentation labels (SIO) and multi-part HRA organs into single clean outer shells
// (no internal walls), which matters for translucent rendering.

/** Grid = { data: Float32Array|Uint8Array, nx, ny, nz, origin:[x,y,z], h } ; index = x + nx*(y + ny*z) */
export function makeGrid(min, max, h, pad = 2) {
  const origin = [min[0] - pad * h, min[1] - pad * h, min[2] - pad * h];
  const nx = Math.ceil((max[0] - min[0]) / h) + 2 * pad + 1;
  const ny = Math.ceil((max[1] - min[1]) / h) + 2 * pad + 1;
  const nz = Math.ceil((max[2] - min[2]) / h) + 2 * pad + 1;
  return { data: new Uint8Array(nx * ny * nz), nx, ny, nz, origin, h };
}

/** Mark every voxel touched by the surface (dense barycentric sampling at h/2 spacing). */
export function rasterizeSurface(grid, m) {
  const { nx, ny, nz, origin, h, data } = grid; const p = m.positions, I = m.indices;
  const mark = (x, y, z) => {
    const i = Math.floor((x - origin[0]) / h), j = Math.floor((y - origin[1]) / h), k = Math.floor((z - origin[2]) / h);
    if (i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz) data[i + nx * (j + ny * k)] = 1;
  };
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const lab = Math.hypot(p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]);
    const lac = Math.hypot(p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]);
    const lbc = Math.hypot(p[c] - p[b], p[c + 1] - p[b + 1], p[c + 2] - p[b + 2]);
    const n = Math.max(1, Math.ceil(Math.max(lab, lac, lbc) / (h * 0.5)));
    for (let u = 0; u <= n; u++) for (let v = 0; v <= n - u; v++) {
      const s = u / n, r = v / n, q = 1 - s - r;
      mark(q * p[a] + s * p[b] + r * p[c], q * p[a + 1] + s * p[b + 1] + r * p[c + 1], q * p[a + 2] + s * p[b + 2] + r * p[c + 2]);
    }
  }
  return grid;
}

export function dilate(grid, iterations = 1) {
  const { nx, ny, nz } = grid; let src = grid.data;
  for (let it = 0; it < iterations; it++) {
    const dst = new Uint8Array(src);
    for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const id = i + nx * (j + ny * k); if (src[id]) continue;
      if (src[id - 1] || src[id + 1] || src[id - nx] || src[id + nx] || src[id - nx * ny] || src[id + nx * ny]) dst[id] = 1;
    }
    src = dst;
  }
  return { ...grid, data: src };
}

export function erode(grid, iterations = 1) {
  const { nx, ny, nz } = grid; let src = grid.data;
  for (let it = 0; it < iterations; it++) {
    const dst = new Uint8Array(src);
    for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const id = i + nx * (j + ny * k); if (!src[id]) continue;
      if (!src[id - 1] || !src[id + 1] || !src[id - nx] || !src[id + nx] || !src[id - nx * ny] || !src[id + nx * ny]) dst[id] = 0;
    }
    src = dst;
  }
  return { ...grid, data: src };
}

/** Everything not reachable from the grid border through empty voxels becomes solid. */
export function fillInterior(grid) {
  const { nx, ny, nz, data } = grid; const N = nx * ny * nz;
  const outside = new Uint8Array(N); const queue = new Int32Array(N); let qh = 0, qt = 0;
  const push = (id) => { if (!data[id] && !outside[id]) { outside[id] = 1; queue[qt++] = id; } };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1) push(i + nx * (j + ny * k));
  while (qh < qt) {
    const id = queue[qh++]; const i = id % nx, j = Math.floor(id / nx) % ny, k = Math.floor(id / (nx * ny));
    if (i > 0) push(id - 1); if (i < nx - 1) push(id + 1);
    if (j > 0) push(id - nx); if (j < ny - 1) push(id + nx);
    if (k > 0) push(id - nx * ny); if (k < nz - 1) push(id + nx * ny);
  }
  const solid = new Uint8Array(N); for (let i = 0; i < N; i++) solid[i] = outside[i] ? 0 : 1;
  return { ...grid, data: solid };
}

/** Solid voxelization of a (nearly) closed mesh: surface raster -> close small gaps -> flood fill -> undo dilation. */
export function voxelizeSolid(m, bounds, h, { close = 1 } = {}) {
  let g = rasterizeSurface(makeGrid(bounds.min, bounds.max, h, 2 + close), m);
  if (close) g = dilate(g, close);
  g = fillInterior(g);
  if (close) g = erode(g, close);
  return g;
}

/** Keep only the largest 6-connected solid component (removes specks). */
export function largestComponent(grid, keep = 1) {
  const { nx, ny, nz, data } = grid; const N = nx * ny * nz; const lab = new Int32Array(N); const sizes = [0];
  const queue = new Int32Array(N);
  for (let s = 0; s < N; s++) {
    if (!data[s] || lab[s]) continue;
    const id0 = sizes.length; sizes.push(0); let qh = 0, qt = 0; queue[qt++] = s; lab[s] = id0;
    while (qh < qt) {
      const id = queue[qh++]; sizes[id0]++;
      const i = id % nx, j = Math.floor(id / nx) % ny, k = Math.floor(id / (nx * ny));
      const nb = [i > 0 ? id - 1 : -1, i < nx - 1 ? id + 1 : -1, j > 0 ? id - nx : -1, j < ny - 1 ? id + nx : -1, k > 0 ? id - nx * ny : -1, k < nz - 1 ? id + nx * ny : -1];
      for (const q of nb) if (q >= 0 && data[q] && !lab[q]) { lab[q] = id0; queue[qt++] = q; }
    }
  }
  const order = sizes.map((s, i) => [s, i]).slice(1).sort((a, b) => b[0] - a[0]).slice(0, keep).map((x) => x[1]);
  const keepSet = new Set(order); const out = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (keepSet.has(lab[i])) out[i] = 1;
  return { ...grid, data: out, componentSizes: sizes.slice(1).sort((a, b) => b - a).slice(0, 8) };
}

/** Separable [1,2,1]/4 blur -> Float32 field in [0,1]; gives smoother iso-surfaces than raw binary masks. */
export function blur(grid, passes = 1) {
  const { nx, ny, nz } = grid; let f = Float32Array.from(grid.data);
  const tmp = new Float32Array(f.length);
  const strides = [1, nx, nx * ny], dims = [nx, ny, nz];
  for (let p = 0; p < passes; p++) for (let a = 0; a < 3; a++) {
    const s = strides[a];
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const id = i + nx * (j + ny * k); const c = [i, j, k][a];
      const l = c > 0 ? f[id - s] : f[id], r = c < dims[a] - 1 ? f[id + s] : f[id];
      tmp[id] = 0.25 * l + 0.5 * f[id] + 0.25 * r;
    }
    f.set(tmp);
  }
  return { ...grid, data: f };
}

/** Surface Nets iso-surface of a scalar grid at `iso` (inside = value > iso). Outward-facing triangles. */
export function surfaceNets(grid, iso = 0.5) {
  const { nx, ny, nz, origin, h, data } = grid;
  const cellIndex = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cid = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const val = (i, j, k) => data[i + nx * (j + ny * k)];
  const pos = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { v[c] = val(i + corners[c][0], j + corners[c][1], k + corners[c][2]); if (v[c] > iso) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      const ia = v[a] > iso, ib = v[b] > iso; if (ia === ib) continue;
      const t = (iso - v[a]) / (v[b] - v[a]);
      sx += corners[a][0] + t * (corners[b][0] - corners[a][0]);
      sy += corners[a][1] + t * (corners[b][1] - corners[a][1]);
      sz += corners[a][2] + t * (corners[b][2] - corners[a][2]); n++;
    }
    cellIndex[cid(i, j, k)] = pos.length / 3;
    pos.push(origin[0] + (i + sx / n) * h, origin[1] + (j + sy / n) * h, origin[2] + (k + sz / n) * h);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) { const t = b; b = d; d = t; }
    // split along the shorter diagonal
    const P = (q) => [pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2]];
    const d1 = dist2(P(a), P(c)), d2 = dist2(P(b), P(d));
    if (d1 <= d2) idx.push(a, b, c, a, c, d); else idx.push(a, b, d, b, c, d);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const inside = val(i, j, k) > iso;
    // edge along +x from (i,j,k) to (i+1,j,k): surrounding cells vary in (j,k)
    if (i < nx - 1 && inside !== (val(i + 1, j, k) > iso)) quad(cellIndex[cid(i, j - 1, k - 1)], cellIndex[cid(i, j, k - 1)], cellIndex[cid(i, j, k)], cellIndex[cid(i, j - 1, k)], !inside);
    // edge along +y: cells vary in (k,i)
    if (j < ny - 1 && inside !== (val(i, j + 1, k) > iso)) quad(cellIndex[cid(i - 1, j, k - 1)], cellIndex[cid(i - 1, j, k)], cellIndex[cid(i, j, k)], cellIndex[cid(i, j, k - 1)], !inside);
    // edge along +z: cells vary in (i,j)
    if (k < nz - 1 && inside !== (val(i, j, k + 1) > iso)) quad(cellIndex[cid(i - 1, j - 1, k)], cellIndex[cid(i, j - 1, k)], cellIndex[cid(i, j, k)], cellIndex[cid(i - 1, j, k)], !inside);
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** Grid from a sub-box of a labelled volume mask (SIO). */
export function gridFromMask(mask, W, H, D, { pad = 2 } = {}) {
  let x0 = W, y0 = H, z0 = D, x1 = -1, y1 = -1, z1 = -1;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) { const row = (z * H + y) * W; for (let x = 0; x < W; x++) if (mask[row + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; } }
  if (x1 < 0) return null;
  const nx = x1 - x0 + 1 + 2 * pad, ny = y1 - y0 + 1 + 2 * pad, nz = z1 - z0 + 1 + 2 * pad;
  const data = new Uint8Array(nx * ny * nz);
  for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (mask[(z * H + y) * W + x]) data[(x - x0 + pad) + nx * ((y - y0 + pad) + ny * (z - z0 + pad))] = 1;
  return { data, nx, ny, nz, origin: [x0 - pad, y0 - pad, z0 - pad], h: 1 };
}

/**
 * Rebuild a clean, closed outer shell from a (possibly multi-part, patchy or tubular) mesh.
 * Returns { mesh, grid } with mesh in the input units.
 */
export function remeshSolid(m, h, { close = 1, keep = 0, blurPasses = 1, iso = 0.5 } = {}) {
  let b = boundsOf(m);
  let g = voxelizeSolid(m, b, h, { close });
  if (keep) g = largestComponent(g, keep);
  const f = blurPasses ? blur(g, blurPasses) : { ...g, data: Float32Array.from(g.data) };
  const out = surfaceNets(f, iso);
  return { mesh: out, grid: g };
}

function boundsOf(m) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; const p = m.positions;
  for (let i = 0; i < p.length; i += 3) for (let a = 0; a < 3; a++) { if (p[i + a] < min[a]) min[a] = p[i + a]; if (p[i + a] > max[a]) max[a] = p[i + a]; }
  return { min, max };
}

/** Fan-cap every boundary loop (closes open tube ends before voxelization). */
export function capBoundaries(m) {
  const I = m.indices; const nv = m.positions.length / 3; const half = new Map();
  for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) { const a = I[t + k], b = I[t + (k + 1) % 3]; half.set(a * nv + b, true); }
  const next = new Map();
  for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) { const a = I[t + k], b = I[t + (k + 1) % 3]; if (!half.has(b * nv + a)) next.set(b, a); }
  const pos = Array.from(m.positions); const idx = Array.from(I); const seen = new Set();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop = []; let v = start; let guard = 0;
    while (v !== undefined && !seen.has(v) && guard++ < 100000) { seen.add(v); loop.push(v); v = next.get(v); }
    if (loop.length < 3) continue;
    const c = [0, 0, 0]; for (const q of loop) { c[0] += pos[q * 3]; c[1] += pos[q * 3 + 1]; c[2] += pos[q * 3 + 2]; }
    const ci = pos.length / 3; pos.push(c[0] / loop.length, c[1] / loop.length, c[2] / loop.length);
    for (let i = 0; i < loop.length; i++) idx.push(loop[i], loop[(i + 1) % loop.length], ci);
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}
