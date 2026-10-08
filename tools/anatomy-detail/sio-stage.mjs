// SIO (VOXEL-MAN Segmented Internal Organs of the Visible Human Male) stage of the close-up build.
// Re-fits the male build's SIO -> HRA similarity (same 10 organ-centroid pairs), meshes SIO labels, and builds a
// tissue-class volume used to place muscles at the real depth under the skin (subcutaneous fat from this same body).
import * as M from '../anatomy/mesh.mjs';
import * as V from '../anatomy/voxel.mjs';
import { loadSIO, labelTable } from '../anatomy/sio.mjs';
import { readXlsxRows } from '../anatomy/sources.mjs';
import { fitSimilarity } from '../anatomy/register.mjs';

export const CLS = { OUT: 0, SKIN: 1, SUBQ: 2, MUSCLE: 3, DEEP: 4, ARM: 5, BONE: 6 };

export function openSIO(labelDir, xlsx, regB, { log = () => {} } = {}) {
  const sio = loadSIO(labelDir);
  const LT = labelTable(readXlsxRows(xlsx));
  const L = (...names) => names.flatMap((n) => { const v = LT.get(n); if (!v) throw new Error(`SIO label missing: ${n}`); return v; });
  // identical pairs/labels to tools/build-anatomy.mjs step 3
  const regA = {
    liver: L('liver'), spleen: L('spleen'), 'kidney L': L('left kidney', 'left renal medulla'), 'kidney R': L('right kidney', 'right renal medulla'),
    heart: L('myocardium', 'left atrium', 'left ventricle', 'right atrium', 'right ventricle'), bladder: L('urinary bladder'), gallbladder: L('gallbladder'),
    pancreas: L('pancreas'), 'lung L': L('left lung'), 'lung R': L('right lung'),
  };
  const A = regB.map(([tag]) => sio.stats(regA[tag]).centroid), B = regB.map(([, c]) => c);
  const sim = fitSimilarity(A, B);
  // inverse: HRA metres -> SIO voxel index space
  const Rt = [[sim.R[0][0], sim.R[1][0], sim.R[2][0]], [sim.R[0][1], sim.R[1][1], sim.R[2][1]], [sim.R[0][2], sim.R[1][2], sim.R[2][2]]];
  const inv = (p) => { const d = [p[0] - sim.t[0], p[1] - sim.t[1], p[2] - sim.t[2]]; return [0, 1, 2].map((r) => (Rt[r][0] * d[0] + Rt[r][1] * d[1] + Rt[r][2] * d[2]) / sim.s); };
  log(`SIO -> HRA similarity: scale ${sim.s.toFixed(6)} m/voxel, RMS ${(sim.rms * 1000).toFixed(1)} mm`);

  /** Cropped binary grid of a label set (index space, h = 1 voxel), without allocating a full-volume mask. */
  function cropGrid(labels, pad = 2) {
    const lut = new Uint8Array(65536); for (const v of labels) lut[v] = 1;
    const { W, H, D, vol } = sio; let x0 = W, y0 = H, z0 = D, x1 = -1, y1 = -1, z1 = -1;
    for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) { const row = (z * H + y) * W; for (let x = 0; x < W; x++) if (lut[vol[row + x]]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; } }
    if (x1 < 0) return null;
    const nx = x1 - x0 + 1 + 2 * pad, ny = y1 - y0 + 1 + 2 * pad, nz = z1 - z0 + 1 + 2 * pad; const data = new Uint8Array(nx * ny * nz);
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (lut[vol[(z * H + y) * W + x]]) data[(x - x0 + pad) + nx * ((y - y0 + pad) + ny * (z - z0 + pad))] = 1;
    return { data, nx, ny, nz, origin: [x0 - pad, y0 - pad, z0 - pad], h: 1 };
  }
  /**
   * Smooth closed surface of a label set, in the HRA frame. keep = number of largest components to keep (0 = all);
   * close = morphological closing radius in voxels (bridges 1-2 mm slice-to-slice gaps of hand segmentation);
   * iso < 0.5 keeps 1-3 voxel thin sheets from breaking up after the blur.
   */
  function labelMesh(labels, { blurPasses = 1, iterations = 10, keep = 0, close = 0, iso = 0.5 } = {}) {
    let g = cropGrid(labels, 2 + close); if (!g) return null;
    if (close) g = V.erode(V.dilate(g, close), close);
    if (keep) g = V.largestComponent(g, keep);
    const m = V.surfaceNets(V.blur(g, blurPasses), iso);
    return M.orientOutward(M.taubin(M.mapVertices(m, (x, y, z) => sim.apply([x, y, z])), { iterations }));
  }
  return { sio, LT, L, sim, inv, cropGrid, labelMesh };
}

/**
 * Tissue classes per SIO voxel (Uint8, full volume): OUT, SKIN, SUBQ (subcutaneous tissue reached from the skin within
 * `maxDepth` voxels in the same axial slice), MUSCLE, DEEP (everything else inside), ARM (arm labels: SIO arms hang down
 * while the HRA arms are raised, so arm voxels are never used for placement), BONE.
 */
export function tissueClasses(S, { maxDepth = 45 } = {}) {
  const { sio, LT } = S; const { W, H, D, vol } = sio;
  const lut = new Uint8Array(65536).fill(CLS.DEEP); lut[0] = CLS.OUT;
  const set = (pred, c) => { for (const [n, vs] of LT) if (pred(n)) for (const v of vs) lut[v] = c; };
  set((n) => /^unclassified skin$/.test(n), CLS.SKIN);
  set((n) => /^unclassified tissue$/.test(n), CLS.SUBQ); // provisional: refined by the flood fill below
  set((n) => /unclassified muscles|rectus abdominis|external oblique|internal oblique|transversus abdominis|psoas|iliacus|obturator internus|diaphragm|ischiocavernosus/.test(n), CLS.MUSCLE);
  set((n) => /rib|vertebra|sternum|scapula|clavicle|hip bone|femur|sacrum|coccyx|humerus|radius|ulna|bones|costal cartilage|clavicular cartilage|unclassified cartilage/.test(n), CLS.BONE);
  set((n) => /of the (left|right) arm|of the (left|right) hand/.test(n), CLS.ARM);
  const cls = new Uint8Array(W * H * D);
  const queue = new Int32Array(W * H); const depth = new Uint8Array(W * H);
  for (let z = 0; z < D; z++) {
    const base = z * W * H;
    for (let i = 0; i < W * H; i++) cls[base + i] = lut[vol[base + i]];
    // 2D flood from the slice border through OUT -> SKIN -> unclassified tissue; tissue reached within maxDepth stays SUBQ
    depth.fill(255); let qh = 0, qt = 0;
    const push = (i, d) => { if (depth[i] !== 255) return; const c = cls[base + i]; if (c !== CLS.OUT && c !== CLS.SKIN && c !== CLS.SUBQ) return; if (c === CLS.SUBQ && d > maxDepth) return; depth[i] = Math.min(254, d); queue[qt++] = i; };
    for (let x = 0; x < W; x++) { push(x, 0); push((H - 1) * W + x, 0); }
    for (let y = 0; y < H; y++) { push(y * W, 0); push(y * W + W - 1, 0); }
    while (qh < qt) {
      const i = queue[qh++]; const x = i % W, y = (i / W) | 0; const c = cls[base + i]; const d = c === CLS.OUT ? 0 : depth[i] + 1;
      if (x > 0) push(i - 1, d); if (x < W - 1) push(i + 1, d); if (y > 0) push(i - W, d); if (y < H - 1) push(i + W, d);
    }
    for (let i = 0; i < W * H; i++) if (cls[base + i] === CLS.SUBQ && depth[i] === 255) cls[base + i] = CLS.DEEP; // fat not connected to the skin layer
  }
  const at = (p) => { // p in SIO index space
    const x = Math.round(p[0]), y = Math.round(p[1]), z = Math.round(p[2]);
    if (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) return 255;
    return cls[(z * H + y) * W + x];
  };
  return { cls, W, H, D, at };
}

/**
 * Field over the HRA frame whose value is ~1 where SIO says "deep tissue" (muscle, bone, organs) and ~0 in skin,
 * subcutaneous fat and outside; NaN (unknown) where SIO has no data (outside its slab, arm voxels).
 * Used with clampInside()-style gradient steps to pull superficial muscle vertices back under the real fat layer.
 */
export function deepField(S, T) {
  const { inv } = S; const { cls, W, H, D } = T;
  const val = (x, y, z) => { if (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) return NaN; const c = cls[(z * H + y) * W + x]; return c === CLS.ARM ? NaN : (c === CLS.MUSCLE || c === CLS.DEEP || c === CLS.BONE ? 1 : 0); };
  const sampleIdx = (q) => {
    const i = Math.floor(q[0]), j = Math.floor(q[1]), k = Math.floor(q[2]); const fx = q[0] - i, fy = q[1] - j, fz = q[2] - k; let v = 0;
    for (let c = 0; c < 8; c++) { const di = c & 1, dj = (c >> 1) & 1, dk = (c >> 2) & 1; const s = val(i + di, j + dj, k + dk); if (Number.isNaN(s)) return NaN; v += s * (di ? fx : 1 - fx) * (dj ? fy : 1 - fy) * (dk ? fz : 1 - fz); }
    return v;
  };
  const sample = (p) => sampleIdx(inv(p));
  const grad = (p) => { const e = 0.0012; const g = [0, 0, 0]; for (let a = 0; a < 3; a++) { const p1 = p.slice(), p0 = p.slice(); p1[a] += e; p0[a] -= e; g[a] = sample(p1) - sample(p0); } return M.norm(g); };
  const classAt = (p) => T.at(inv(p));
  return { sample, grad, classAt };
}
