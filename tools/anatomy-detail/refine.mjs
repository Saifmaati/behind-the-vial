// Skin-and-bone fit refinement for BodyParts3D geometry that is already warped into the HRA body by the male build's
// thin-plate spline. The male TPS matches ~400 landmarks; between them the BodyParts3D skin still deviates from the
// HRA skin by ~1 cm on average (up to 3-4 cm at the hips and feet), which pushes muscles through the skin.
// Each round samples the warped BodyParts3D skin and leg/pelvis/spine bones, pairs every sample with the closest point
// on the HRA skin or the matching HRA bone, and fits a regularised TPS on those pairs (non-rigid ICP). The composed
// map is applied to muscles, eyes and BodyParts3D bones of the detail layer.
import * as M from '../anatomy/mesh.mjs';
import { fitTPS } from '../anatomy/register.mjs';
import { triGrid } from './spatial.mjs';

/** Roughly uniform surface samples: one vertex per occupied cell of a `spacing` grid (closest to the cell centre). */
export function surfaceSamples(m, spacing, filter = null) {
  const P = m.positions; const best = new Map();
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2]; if (filter && !filter(x, y, z)) continue;
    const ix = Math.floor(x / spacing), iy = Math.floor(y / spacing), iz = Math.floor(z / spacing); const key = `${ix},${iy},${iz}`;
    const d = (x / spacing - ix - 0.5) ** 2 + (y / spacing - iy - 0.5) ** 2 + (z / spacing - iz - 0.5) ** 2;
    const b = best.get(key); if (!b || d < b.d) best.set(key, { d, i: i / 3 });
  }
  return [...best.values()].map((b) => b.i);
}

/**
 * @param {object} o
 * @param {(p:number[])=>number[]} o.map0  initial map (BP3D mm -> HRA m), i.e. the male warp
 * @param {object} o.bpSkin   BodyParts3D skin (raw BP3D frame)
 * @param {object} o.hraSkin  HRA skin
 * @param {Array<[object, object]>} o.bonePairs  [BP3D bone (raw), HRA bone] meshes
 */
export function refineMap({ map0, bpSkin, hraSkin, bonePairs, rounds = 3, skinSpacing = 0.035, boneSpacing = 0.02, lambda = 0.02, maxDist = 0.06, log = () => {} }) {
  const skinGrid = triGrid(hraSkin, 0.006);
  const boneGrids = bonePairs.map(([, h]) => triGrid(h, 0.004));
  const stages = []; // TPS stack
  const apply = (p) => { let q = map0(p); for (const s of stages) q = s.apply(q); return q; };
  const mapMesh = (m) => M.mapVertices(m, (x, y, z) => apply([x, y, z]));
  const stats = [];
  let skinW = M.weld(mapMesh(bpSkin), 1e-7);
  let bonesW = bonePairs.map(([b]) => mapMesh(b));
  const skinErr = () => { const P = skinW.positions; let s = 0, n = 0, mx = 0; for (let i = 0; i < P.length; i += 3 * 5) { const c = skinGrid.closest([P[i], P[i + 1], P[i + 2]], 0.1); if (!c) continue; s += c.d; n++; mx = Math.max(mx, c.d); } return { mean: s / n, max: mx }; };
  const e0 = skinErr(); stats.push({ round: 0, skinMean_mm: +(e0.mean * 1000).toFixed(1), skinMax_mm: +(e0.max * 1000).toFixed(1) });
  log(`refine round 0: BP3D skin to HRA skin mean ${(e0.mean * 1000).toFixed(1)} mm, max ${(e0.max * 1000).toFixed(1)} mm`);
  for (let r = 1; r <= rounds; r++) {
    const src = [], dst = [];
    const vn = M.normals(skinW); const P = skinW.positions;
    let rejected = 0;
    for (const i of surfaceSamples(skinW, skinSpacing)) {
      const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]; const c = skinGrid.closest(p, maxDist);
      if (!c) { rejected++; continue; }
      const n = [vn[i * 3], vn[i * 3 + 1], vn[i * 3 + 2]];
      if (M.dot(n, c.n) < 0.6) { rejected++; continue; } // facing surfaces only (no matches across finger gaps, armpits)
      src.push(p); dst.push(c.p);
    }
    const nSkin = src.length;
    bonePairs.forEach((bp, k) => {
      const m = bonesW[k]; const Q = m.positions;
      for (const i of surfaceSamples(m, boneSpacing)) { const p = [Q[i * 3], Q[i * 3 + 1], Q[i * 3 + 2]]; const c = boneGrids[k].closest(p, maxDist); if (c) { src.push(p); dst.push(c.p); } }
    });
    const tps = fitTPS(src, dst, { lambda });
    stages.push(tps);
    skinW = M.weld(mapMesh(bpSkin), 1e-7); bonesW = bonePairs.map(([b]) => mapMesh(b));
    const e = skinErr();
    stats.push({ round: r, pairs: src.length, skinPairs: nSkin, bonePairs: src.length - nSkin, rejected, skinMean_mm: +(e.mean * 1000).toFixed(1), skinMax_mm: +(e.max * 1000).toFixed(1) });
    log(`refine round ${r}: ${nSkin} skin + ${src.length - nSkin} bone pairs (${rejected} rejected); BP3D skin to HRA skin mean ${(e.mean * 1000).toFixed(1)} mm, max ${(e.max * 1000).toFixed(1)} mm`);
  }
  return { apply, mapMesh, stats };
}
