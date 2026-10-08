#!/usr/bin/env node
// PeptideScope: close-up anatomy layer (dev-only, Node 20).
//
//   cd tools && npm install                    # dev dependencies only (same as tools/build-anatomy.mjs)
//   node tools/build-anatomy-detail.mjs        # -> assets/anatomy/detail-male.glb + assets/anatomy/atlas-male.json
//
// Flags: --fresh (recompute every cached stage), --fresh-sio, --fresh-muscles, --fresh-skeleton, --no-skeleton,
//        --skin-tris <n> (default 300000), --muscle-tris <n> (total muscle budget, default 280000)
//
// Never downloads anything: it reads the raw sources that tools/build-anatomy.mjs already fetched and verified into
// tools/.cache/anatomy-raw/ (HRA United Male v1.9 GLB, VOXEL-MAN SIO label slices, BodyParts3D 4.0 OBJ files) and that
// build's cached thin-plate-spline landmarks (tools/.cache/anatomy-build/warp-landmarks.json). Stage results are cached
// in tools/.cache/anatomy-detail/ so the 8 GB development machine never holds more than one source at a time.
//
// Output (docs/ARCHITECTURE.md "v3 additions"): the same frame as body.glb (metres, +Y up, feet at y = 0, facing +Z,
// centred on x = 0, z = 0, person's left = +X, 1.75 m), meshopt-compressed + quantized like body.glb:
//   skin_hi            HRA Visible Human Male skin, simplified from 829k to ~300k triangles (vertex positions
//                      re-optimised by the simplifier), so the app can swap it in for `skin` when the camera is close
//   eyes               HRA eyeballs (sclera, iris, pupil), per-vertex colours
//   muscle_<slug>      named muscles / muscle groups (both sides in one mesh), BodyParts3D 4.0 warped into the HRA
//                      body with the male build's thin-plate spline + a local offset field, kept under the skin;
//                      abdominal wall, iliopsoas, diaphragm and pelvic floor from SIO (same Visible Human Male)
//   skeleton_hi        the body.glb skeleton composite (HRA + SIO + BodyParts3D) at higher resolution, plus the teeth
//                      and the hyoid bone (BodyParts3D)
// atlas-male.json lists every named mesh of body.glb and detail-male.glb: { id, name, plain, system, center, file }.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MeshoptSimplifier } from 'meshoptimizer';
import * as M from './anatomy/mesh.mjs';
import { BP3D } from './anatomy/bp3d.mjs';
import { insideField, clampInside } from './anatomy/vessels.mjs';
import { extractHRA, EYE_PARTS } from './anatomy-detail/hra-stage.mjs';
import { openSIO } from './anatomy-detail/sio-stage.mjs';
import { buildMaleWarp } from './anatomy-detail/warp.mjs';
import { triGrid } from './anatomy-detail/spatial.mjs';
import { offsetField, skinPairs, bonePairs, anchorSamples, applyField, keepUnderSkin, containment, principalAxis, depthAt, withDeepTest } from './anatomy-detail/fit.mjs';
import { MUSCLES, expandConcepts } from './anatomy-detail/muscles.mjs';
import { BODY_STRUCTURES, DETAIL_STRUCTURES } from './anatomy-detail/atlas.mjs';
import { writeDetailGLB, readGLBMeshes } from './anatomy-detail/glb.mjs';

const argv = process.argv.slice(2);
const args = new Set(argv);
const argVal = (name, def) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def; };
const SEX = argVal('--sex', 'male');
if (SEX !== 'male') throw new Error('build-anatomy-detail: only --sex male is built so far (the female set lacks cached eye geometry; see docs/decisions/anatomy-detail.md)');
const FRESH = args.has('--fresh');
const SKIN_TRIS = Number(argVal('--skin-tris', 300000));
const MUSCLE_TRIS = Number(argVal('--muscle-tris', 280000));
const SKELETON_TRIS = Number(argVal('--skeleton-tris', 200000));
const STATURE = 1.75;
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const RAW = join(ROOT, 'tools/.cache/anatomy-raw');
const BUILD = join(ROOT, 'tools/.cache/anatomy-build');
const WORK = join(ROOT, 'tools/.cache/anatomy-detail');
const OUT = join(ROOT, 'assets/anatomy');
const HRA_FILE = join(RAW, 'hra/glb/3d-vh-m-united-v1.9.glb');
const SIO_LABELS = join(RAW, 'sio/data/VOXEL-MAN_segmented-internal-organs/labels');
const SIO_XLSX = join(RAW, 'sio/zip/SIO_Object_Labels.xlsx');
mkdirSync(WORK, { recursive: true });
const T0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s]`, ...a);
const report = { generated: new Date().toISOString(), sex: SEX, stages: {}, meshes: {}, warnings: [] };
const warn = (msg) => { report.warnings.push(msg); log('WARN', msg); };
const rss = () => `${(process.memoryUsage().rss / 1e6).toFixed(0)} MB`;
for (const f of [HRA_FILE, SIO_XLSX, join(RAW, 'bp3d/meta/isa_element_parts.txt')]) if (!existsSync(f)) throw new Error(`missing cached source ${f}: run node tools/build-anatomy.mjs first (it downloads and verifies the sources)`);
await M.ready; await MeshoptSimplifier.ready;

/** Stage cache: { name: mesh } maps packed with tools/anatomy/mesh.mjs, plus a JSON sidecar with a version key. */
const cache = (name, version, fresh, build) => {
  const bin = join(WORK, `${name}.bin`), meta = join(WORK, `${name}.json`);
  if (!fresh && existsSync(bin) && existsSync(meta)) {
    const info = JSON.parse(readFileSync(meta, 'utf8'));
    if (info.version === version) { log(`  cached ${name} (${(statSync(bin).size / 1e6).toFixed(1)} MB); --fresh recomputes`); return { meshes: M.unpackMeshes(readFileSync(bin)), info }; }
  }
  return null;
};
const store = (name, version, meshes, info = {}) => {
  writeFileSync(join(WORK, `${name}.bin`), M.packMeshes(meshes));
  writeFileSync(join(WORK, `${name}.json`), JSON.stringify({ version, ...info }));
  return { meshes, info: { version, ...info } };
};

// ---------------------------------------------------------------------------------------------------------------
log('1/7 HRA United Male v1.9: full-resolution skin, eyes, bones, junction parts');
let hraX = cache('hra-extract', 'hra-extract-1', FRESH, null);
if (!hraX) {
  // the legacy sidecar (hra-extract.json) only held { regB }; re-extract when it is missing or unversioned
  const prev = existsSync(join(WORK, 'hra-extract.bin')) && existsSync(join(WORK, 'hra-extract.json')) && !FRESH ? JSON.parse(readFileSync(join(WORK, 'hra-extract.json'), 'utf8')) : null;
  if (prev && prev.regB && !prev.version) {
    hraX = { meshes: M.unpackMeshes(readFileSync(join(WORK, 'hra-extract.bin'))), info: { version: 'hra-extract-1', regB: prev.regB } };
    writeFileSync(join(WORK, 'hra-extract.json'), JSON.stringify(hraX.info));
    log('  reused hra-extract.bin (versioned its sidecar)');
  } else {
    const { meshes, info } = await extractHRA(HRA_FILE, { log: (m) => log('  ' + m) });
    hraX = store('hra-extract', 'hra-extract-1', meshes, info);
  }
}
const H = hraX.meshes; const regB = hraX.info.regB;
const skinHRA = H.skin;
// Contract frame: identical to tools/build-anatomy.mjs (bounds of the welded full-resolution skin, uniform scale to 1.75 m)
const skinBounds = M.bounds(skinHRA);
const k = STATURE / skinBounds.size[1];
const frameRef = join(BUILD, 'stage-meshes.bin.json');
if (existsSync(frameRef)) {
  const ref = JSON.parse(readFileSync(frameRef, 'utf8'));
  const dk = Math.abs(ref.k - k), dc = Math.max(...ref.skinBounds.min.map((v, i) => Math.abs(v - skinBounds.min[i])), ...ref.skinBounds.center.map((v, i) => Math.abs(v - skinBounds.center[i])));
  if (dk > 1e-9 || dc > 1e-9) throw new Error(`frame differs from the body.glb build (dk ${dk}, dc ${dc})`);
  log(`  frame matches body.glb build: scale ${k.toFixed(6)}`);
}
const toWorld = (p) => [(p[0] - skinBounds.center[0]) * k, (p[1] - skinBounds.min[1]) * k, (p[2] - skinBounds.center[2]) * k];
const W = (m) => M.mapVertices(m, (x, y, z) => toWorld([x, y, z]));
report.frame = { units: 'm', up: '+Y', front: '+Z', personLeft: '+X', scaleFromHRA: +k.toFixed(6), height_m: STATURE };
log(`  skin ${M.triCount(skinHRA)} tris; rss ${rss()}`);

// body.glb as published (decoded world positions), for alignment and containment checks
const body = await readGLBMeshes(join(OUT, 'body.glb'));
const bodySkinGrid = withDeepTest(triGrid(body.skin, 0.01), body.skin);

// ---------------------------------------------------------------------------------------------------------------
log(`2/7 skin_hi: simplify ${M.triCount(skinHRA)} -> ${SKIN_TRIS} triangles`);
let skinHi;
{
  const sw = W(skinHRA);
  const nrm = M.normals(sw);
  const pos = new Float32Array(sw.positions), att = new Float32Array(nrm), ind = new Uint32Array(sw.indices);
  // attribute-aware simplification with vertex position update (keeps the silhouette and creases; 'Regularize'
  // keeps triangles well shaped for smooth shading)
  const [n] = MeshoptSimplifier.simplifyWithUpdate(ind, pos, 3, att, 3, [0.3, 0.3, 0.3], null, SKIN_TRIS * 3, 0.002, ['Regularize']);
  skinHi = M.compact({ positions: pos, indices: ind.slice(0, n) });
  // alignment with body.glb `skin`: symmetric closest-point distances
  const hiGrid = triGrid(skinHi, 0.008);
  const dists = (from, grid, stride) => { const P = from.positions; const d = []; for (let i = 0; i < P.length; i += 3 * stride) { const c = grid.closest([P[i], P[i + 1], P[i + 2]], 0.05); d.push(c ? c.d : 0.05); } d.sort((a, b) => a - b); return d; };
  const a = dists(skinHi, bodySkinGrid, 3), b = dists(body.skin, hiGrid, 1);
  const st = (d) => ({ mean_mm: +((d.reduce((s, v) => s + v, 0) / d.length) * 1000).toFixed(2), p95_mm: +(d[Math.floor(d.length * 0.95)] * 1000).toFixed(2), max_mm: +(d[d.length - 1] * 1000).toFixed(2) });
  const fromFull = dists(sw, hiGrid, 7);
  report.stages.skin_hi = { triangles: M.triCount(skinHi), vertices: skinHi.positions.length / 3, toBodySkin: st(a), bodySkinToSkinHi: st(b), fullResToSkinHi: st(fromFull) };
  log(`  skin_hi ${M.triCount(skinHi)} tris; distance to body.glb skin ${JSON.stringify(st(a))}, body.glb skin to skin_hi ${JSON.stringify(st(b))}, full-res to skin_hi ${JSON.stringify(st(fromFull))}`);
  if (st(a).mean_mm >= 2 || st(b).mean_mm >= 2) warn('skin_hi mean distance to body.glb skin is not below 2 mm');
}

// ---------------------------------------------------------------------------------------------------------------
log('3/7 eyes: HRA sclera, iris and pupil (cornea, lens and conjunctiva left out: they are clear and would hide the iris in an opaque material)');
let eyes, eyeColors;
{
  const EYE_COLORS = { sclera: [233, 226, 216], iris: [92, 62, 42], pupil: [12, 9, 8] }; // sRGB; iris colour is illustrative
  const BUDGET = { sclera: 3000, iris: 3000, pupil: 300 };
  const parts = []; const cols = [];
  for (const side of ['L', 'R']) for (const p of ['sclera', 'iris', 'pupil']) {
    if (!EYE_PARTS.includes(p)) throw new Error(`eye part ${p} not extracted`);
    const m = M.simplify(W(H[`eye_${p}_${side}`]), BUDGET[p], { error: 0.00005, absolute: true });
    parts.push(m); const c = EYE_COLORS[p]; for (let i = 0; i < m.positions.length / 3; i++) cols.push(...c);
  }
  eyes = M.merge(parts); eyeColors = new Uint8Array(cols);
  report.stages.eyes = { triangles: M.triCount(eyes), note: 'HRA eyes sit about 12-14 mm under the closed eyelids of the scanned skin; they show in the muscle and skeleton views' };
  log(`  eyes ${M.triCount(eyes)} tris`);
}

// ---------------------------------------------------------------------------------------------------------------
log('4/7 SIO (VOXEL-MAN, same Visible Human Male): rib cage, shoulder girdle and trunk muscles');
const SIO_VERSION = `sio-detail-2:${JSON.stringify(MUSCLES.filter((m) => m.sio).map((m) => [m.slug, m.sioMesh]))}`;
const SIO_MUSCLES = MUSCLES.filter((m) => m.sio);
let sioX = cache('sio-detail', SIO_VERSION, FRESH || args.has('--fresh-sio'));
if (!sioX) {
  const S = openSIO(SIO_LABELS, SIO_XLSX, regB, { log: (m) => log('  ' + m) });
  const ORD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const meshes = {};
  const mk = (labels, opts) => S.labelMesh(S.L(...labels), opts);
  for (const s of ['left', 'right']) {
    meshes[`bone:ribs_${s}`] = mk([...ORD.map((i) => `${s} rib ${i}`), ...['1', '2', '3', '4', '5', '6-9'].map((i) => `${s} costal cartilage ${i}`)], { iterations: 6 });
    meshes[`bone:clavicle_${s}`] = mk([`${s} clavicle`, `${s} clavicular cartilage`], { iterations: 6 });
    meshes[`bone:scapula_${s}`] = mk([`${s} scapula`], { iterations: 6 });
  }
  meshes['bone:sternum'] = mk(['sternum'], { iterations: 6 });
  for (const m of SIO_MUSCLES) {
    meshes[`muscle:${m.slug}`] = mk(m.sio, m.sioMesh || { blurPasses: 1, iterations: 10 });
    log(`  SIO ${m.slug}: ${M.triCount(meshes[`muscle:${m.slug}`])} tris`);
  }
  sioX = store('sio-detail', SIO_VERSION, meshes, { rms_mm: +(S.sim.rms * 1000).toFixed(1), scale: S.sim.s });
}
report.stages.sio = { registrationRms_mm: sioX.info.rms_mm };
log(`  rss ${rss()}`);

// ---------------------------------------------------------------------------------------------------------------
log('5/7 muscles: BodyParts3D warp + local offset field, kept under the skin');
const po = new BP3D(join(RAW, 'bp3d'), 'partof');
const isa = new BP3D(join(RAW, 'bp3d'), 'isa');
const concept = (name) => (isa.has(name) ? isa : po.has(name) ? po : null);
const SIDES = ['left', 'right'];
const ORDW = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
const SKULL = ['frontal bone', 'occipital bone', 'sphenoid bone', 'ethmoid', 'vomer', 'mandible', ...SIDES.flatMap((s) => ['parietal bone', 'temporal bone', 'zygomatic bone', 'maxilla', 'nasal bone', 'lacrimal bone', 'palatine bone', 'inferior nasal concha'].map((n) => `${s} ${n}`))];
const CARPALS = ['scaphoid', 'lunate', 'triquetral', 'pisiform', 'trapezium', 'trapezoid', 'capitate', 'hamate'];
const bpMesh = (names) => { const parts = []; for (const n of names) { const t = concept(n); if (t) parts.push(t.mesh(n)); } return parts.length ? M.merge(parts) : null; };
let warpCtx = null;
const getWarp = () => warpCtx || (warpCtx = buildMaleWarp({ skinHRA, part: (n) => H[`part::${n}`], po, isa, cacheFile: join(BUILD, 'warp-landmarks.json'), log: (m) => log('  ' + m) }));
const skinGridHRA = withDeepTest(triGrid(skinHRA, 0.006), skinHRA);
const MUSCLE_VERSION = `muscles-fit-4:${createHash('sha1').update(JSON.stringify(MUSCLES) + SIO_VERSION).digest('hex').slice(0, 12)}`; // catalogue + SIO meshing
let musX = cache('muscles-fit', MUSCLE_VERSION, FRESH || args.has('--fresh-muscles') || args.has('--fresh-sio'));
if (!musX) {
  const { warp } = getWarp();
  log(`  male thin-plate spline: ${warp.count} landmark pairs, max residual ${(warp.maxResidual * 1000).toFixed(1)} mm`);
  const Wp = (m) => M.weld(warp.mapMesh(m), 1e-7);
  // (a) skin pairs
  const bpSkinW = Wp(po.mesh('skin'));
  const sp = skinPairs(bpSkinW, skinGridHRA);
  log(`  skin pairs: ${JSON.stringify(sp.stats)}`);
  // (b) bone pairs: BodyParts3D bone -> the bone body.glb shows there
  const vert = []; for (let i = 3; i <= 7; i++) vert.push(`${ORDW[i - 1]} cervical vertebra`); for (let i = 1; i <= 12; i++) vert.push(`${ORDW[i - 1]} thoracic vertebra`); for (let i = 1; i <= 5; i++) vert.push(`${ORDW[i - 1]} lumbar vertebra`);
  const S = sioX.meshes;
  const pairs = [['spine', Wp(po.mesh(...vert)), H.bone_spine], ['sacrum', Wp(po.mesh('sacrum')), H.bone_sacrum], ['sternum', Wp(bpMesh(['manubrium', 'body of sternum'])), S['bone:sternum']]];
  for (const [s, X] of [['left', 'L'], ['right', 'R']]) {
    for (const [b, h] of [['hip bone', 'hip'], ['femur', 'femur'], ['tibia', 'tibia'], ['fibula', 'fibula'], ['patella', 'patella']]) pairs.push([`${b} ${X}`, Wp(po.mesh(`${s} ${b}`)), H[`bone_${h}_${X}`]]);
    pairs.push([`ribs ${X}`, Wp(bpMesh([...ORDW.map((o) => `${s} ${o} rib`), ...ORDW.slice(0, 7).map((o) => `${s} ${o} costal cartilage`)])), S[`bone:ribs_${s}`]]);
    pairs.push([`clavicle ${X}`, Wp(po.mesh(`${s} clavicle`)), S[`bone:clavicle_${s}`]]);
    pairs.push([`scapula ${X}`, Wp(po.mesh(`${s} scapula`)), S[`bone:scapula_${s}`]]);
  }
  const bp = bonePairs(pairs, { maxDist: 0.03 });
  log(`  bone pairs: ${Object.entries(bp.stats).map(([t, v]) => `${t} ${v.pairs} (${v.meanGap_mm} mm)`).join(', ')}`);
  // (c) anchors: bones that body.glb takes from this same warp
  const anchorBones = [bpMesh(SKULL), ...SIDES.map((s) => bpMesh([`${s} humerus`, `${s} radius`, `${s} ulna`, ...CARPALS.map((c) => `${s} ${c}`), `${s} hand`, `${s} foot`]))].filter(Boolean).map(Wp);
  const an = anchorSamples(anchorBones);
  const field = offsetField([...sp.samples, ...bp.samples, ...an], { sigma: 0.015 });
  log(`  offset field: ${sp.samples.length} skin + ${bp.samples.length} bone + ${an.length} anchor samples; rss ${rss()}`);
  const fitInfo = { skinPairs: sp.stats, bonePairs: bp.stats, anchors: an.length, muscles: {} };
  const out = {};
  const depthStats = (m) => { const P = m.positions; let n = 0, outN = 0, worst = 0; for (let i = 0; i < P.length; i += 3 * 5) { n++; const d = depthAt(skinGridHRA, [P[i], P[i + 1], P[i + 2]]); if (!d) continue; if (d.depth < 0) { outN++; worst = Math.max(worst, -d.depth); } } return { outside: +(outN / Math.max(1, n)).toFixed(4), worstOutside_mm: +(worst * 1000).toFixed(1) }; };
  for (const mu of MUSCLES) {
    let mesh = null; let src;
    if (mu.bp) {
      const parts = []; const missing = [];
      // each concept is a closed surface: orient it outward on its own (merged parts could disagree)
      for (const c of expandConcepts(mu.bp)) { const t = concept(c.name); if (t) parts.push(M.orientOutward(M.weld(t.mesh(c.name), 1e-4))); else missing.push(c.name); }
      if (missing.length) warn(`${mu.slug}: BodyParts3D has no ${missing.join(', ')}`);
      if (!parts.length) continue;
      const warped = Wp(M.merge(parts));
      const before = depthStats(warped);
      mesh = applyField(warped, field);
      const mid = depthStats(mesh);
      const r = keepUnderSkin(mesh, skinGridHRA, { minDepth: 0.003 });
      mesh = r.mesh; src = 'bp3d';
      fitInfo.muscles[mu.slug] = { src, rawTris: M.triCount(warped), afterWarp: before, afterField: mid, pushed: r.moved, maxPush_mm: +(r.maxMove * 1000).toFixed(1) };
    } else if (mu.sio) {
      const m0 = S[`muscle:${mu.slug}`]; if (!m0) { warn(`${mu.slug}: no SIO mesh`); continue; }
      const before = depthStats(m0);
      const r = keepUnderSkin(m0, skinGridHRA, { minDepth: 0.003 });
      mesh = r.mesh; src = 'sio';
      fitInfo.muscles[mu.slug] = { src, rawTris: M.triCount(m0), afterWarp: before, pushed: r.moved, maxPush_mm: +(r.maxMove * 1000).toFixed(1) };
    } else { warn(`${mu.slug}: no source geometry in BodyParts3D 4.0 or SIO; omitted`); continue; }
    out[mu.slug] = mesh;
    const f = fitInfo.muscles[mu.slug];
    log(`  ${mu.slug.padEnd(22)} ${src} ${String(f.rawTris).padStart(6)} tris; outside skin: warp ${(f.afterWarp.outside * 100).toFixed(1)}%${f.afterField ? `, field ${(f.afterField.outside * 100).toFixed(1)}%` : ''}; pushed ${f.pushed} vertices (max ${f.maxPush_mm} mm)`);
  }
  musX = store('muscles-fit', MUSCLE_VERSION, out, fitInfo);
}
report.stages.muscles = musX.info;
log(`  rss ${rss()}`);

// ---------------------------------------------------------------------------------------------------------------
let skeletonHi = null;
if (!args.has('--no-skeleton')) {
  log('6/7 skeleton_hi: body.glb skeleton composite (HRA spine/pelvis/legs, SIO rib cage and shoulder girdle, BodyParts3D skull/arms/hands/feet) at higher resolution, plus teeth and hyoid');
  const SK_VERSION = 'skeleton-hi-2';
  let skX = cache('skeleton-hi', SK_VERSION, FRESH || args.has('--fresh-skeleton') || args.has('--fresh-sio'));
  if (!skX) {
    // identical recipe to tools/build-anatomy.mjs (same warp, same inside clamp), only the final budget differs
    const { warp } = getWarp();
    const field = insideField(skinHRA, 0.003);
    const keepInside = (m) => clampInside(m, field).mesh;
    const S = sioX.meshes;
    const sioBones = keepInside(M.merge(Object.entries(S).filter(([n]) => n.startsWith('bone:')).map(([, m]) => m)));
    const parts = [];
    for (const n of SKULL) { const t = po.has(n) ? po : isa; if (t.has(n)) parts.push(t.mesh(n)); }
    // beyond body.glb: the 28 permanent teeth (BodyParts3D has no third molars) and the hyoid bone
    for (const n of ['tooth', 'hyoid bone']) { const t = concept(n); if (t) parts.push(t.mesh(n)); else warn(`BodyParts3D: no "${n}"`); }
    for (const s of SIDES) {
      for (const n of ['humerus', 'radius', 'ulna', ...CARPALS]) { const nm = `${s} ${n}`; if (po.has(nm)) parts.push(po.mesh(nm)); else if (isa.has(nm)) parts.push(isa.mesh(nm)); }
      parts.push(po.mesh(`${s} hand`), po.mesh(`${s} foot`));
    }
    const bpBones = keepInside(M.weld(warp.mapMesh(M.merge(parts)), 1e-6));
    skX = store('skeleton-hi', SK_VERSION, { skeleton: M.weld(M.merge([H.hraBones, sioBones, bpBones]), 1e-6) });
  }
  skeletonHi = M.simplify(M.weld(W(skX.meshes.skeleton), 1e-6), SKELETON_TRIS, { error: 0.0002, absolute: true });
  // the low skin of body.glb cuts a little inside the full-resolution skin: keep the bones under it as well
  skeletonHi = keepUnderSkin(skeletonHi, bodySkinGrid, { minDepth: 0.0008, smooth: 2 }).mesh;
  report.stages.skeleton_hi = { triangles: M.triCount(skeletonHi) };
  log(`  skeleton_hi ${M.triCount(skeletonHi)} tris (body.glb skeleton: ${M.triCount(body.skeleton)})`);
}

// ---------------------------------------------------------------------------------------------------------------
log('7/7 contract frame, budgets, containment checks, GLB + atlas');
const musW = {};
// Budget by surface area (voxel-meshed SIO sheets have far more raw triangles than their size warrants), never more
// than the source has, with a floor so small muscles keep their shape.
const area = (m) => { const P = m.positions, I = m.indices; let a = 0; for (let t = 0; t < I.length; t += 3) { const i = I[t] * 3, j = I[t + 1] * 3, l = I[t + 2] * 3; a += M.len(M.cross([P[j] - P[i], P[j + 1] - P[i + 1], P[j + 2] - P[i + 2]], [P[l] - P[i], P[l + 1] - P[i + 1], P[l + 2] - P[i + 2]])) / 2; } return a; };
const areas = Object.fromEntries(Object.entries(musX.meshes).map(([s2, m]) => [s2, area(m)]));
const budgetFor = (slug, density) => Math.min(M.triCount(musX.meshes[slug]), Math.max(800, Math.round(areas[slug] * density)));
let density = MUSCLE_TRIS / Object.values(areas).reduce((a, b) => a + b, 0);
for (let it = 0; it < 40; it++) { const tot = Object.keys(areas).reduce((s2, slug) => s2 + budgetFor(slug, density), 0); density *= MUSCLE_TRIS / tot; }
report.muscleDensity_trisPerCm2 = +(density / 1e4).toFixed(2);
const hiGrid = withDeepTest(triGrid(skinHi, 0.008), skinHi);
report.containment = {};
for (const mu of MUSCLES) {
  const m0 = musX.meshes[mu.slug]; if (!m0) continue;
  let m = M.simplify(M.weld(W(m0), 1e-7), budgetFor(mu.slug, density), { error: 0.0002, absolute: true });
  // final guard in the published frame: under both the published low skin and skin_hi
  m = keepUnderSkin(m, bodySkinGrid, { minDepth: 0.0012, smooth: 2 }).mesh;
  m = keepUnderSkin(m, hiGrid, { minDepth: 0.0012, smooth: 2 }).mesh;
  musW[mu.slug] = m;
  const cb = containment(m, bodySkinGrid, { stride: 3 }), ch = containment(m, hiGrid, { stride: 3 });
  report.containment[`muscle_${mu.slug}`] = { insideBodySkin: +cb.share.toFixed(4), insideSkinHi: +ch.share.toFixed(4), minDepthBody_mm: Number.isFinite(cb.minDepth) ? +(cb.minDepth * 1000).toFixed(2) : '>30', minDepthHi_mm: Number.isFinite(ch.minDepth) ? +(ch.minDepth * 1000).toFixed(2) : '>30' };
  if (cb.share < 1 || ch.share < 1) warn(`muscle_${mu.slug}: ${((1 - Math.min(cb.share, ch.share)) * 100).toFixed(2)}% of sampled vertices outside the skin`);
}
const eyesC = containment(eyes, bodySkinGrid); report.containment.eyes = { insideBodySkin: +eyesC.share.toFixed(4) };
if (skeletonHi) { const c = containment(skeletonHi, bodySkinGrid, { stride: 5 }); report.containment.skeleton_hi = { insideBodySkin: +c.share.toFixed(4) }; }

const SRC = {
  hra: 'HRA 3D Reference Organ Set, United Male v1.9 (NIH HuBMAP; Visible Human Male), CC BY 4.0',
  sio: 'VOXEL-MAN Segmented Internal Organs of the Visible Human Male (Höhne et al., 2025), CC BY 4.0',
  bp3d: 'BodyParts3D 4.0, © The Database Center for Life Science, CC BY 4.0',
};
const sideCenters = (m) => {
  const P = m.positions; const acc = { left: [0, 0, 0, 0], right: [0, 0, 0, 0], all: [0, 0, 0, 0] };
  for (let i = 0; i < P.length; i += 3) { const t = P[i] >= 0 ? acc.left : acc.right; for (const a of [t, acc.all]) { a[0] += P[i]; a[1] += P[i + 1]; a[2] += P[i + 2]; a[3]++; } }
  const c = (a) => (a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : null);
  return { left: c(acc.left), right: c(acc.right), all: c(acc.all), leftShare: acc.left[3] / Math.max(1, acc.all[3]) };
};
const items = [];
items.push({ name: 'skin_hi', mesh: skinHi, color: [0.77, 0.56, 0.45], roughness: 0.5, extras: { system: 'integumentary', sources: [SRC.hra], swapFor: 'skin' } });
items.push({ name: 'eyes', mesh: eyes, colors: eyeColors, color: [1, 1, 1], roughness: 0.25, extras: { system: 'sensory', sources: [SRC.hra] } });
const MUSCLE_COLOR = [0.56, 0.18, 0.15];
for (const mu of MUSCLES) {
  const m = musW[mu.slug]; if (!m) continue;
  const src = musX.info.muscles[mu.slug]?.src;
  items.push({ name: `muscle_${mu.slug}`, mesh: m, color: MUSCLE_COLOR, roughness: 0.45, extras: { system: 'muscular', region: mu.region, layer: mu.layer || 'superficial', fiberAxis: principalAxis(m, (x) => x >= 0), sources: [src === 'sio' ? SRC.sio : SRC.bp3d] } });
}
if (skeletonHi) items.push({ name: 'skeleton_hi', mesh: skeletonHi, color: [0.91, 0.89, 0.82], roughness: 0.6, extras: { system: 'skeletal', swapFor: 'skeleton', sources: [SRC.hra, SRC.sio, SRC.bp3d] } });
for (const it of items) report.meshes[it.name] = { triangles: M.triCount(it.mesh), vertices: it.mesh.positions.length / 3 };
const glbName = `detail-${SEX}.glb`;
const glbPath = join(OUT, glbName);
await writeDetailGLB(glbPath, items, {
  copyright: 'Anatomy: HRA 3D Reference Organs (NIH HuBMAP, CC BY 4.0); VOXEL-MAN Segmented Internal Organs of the Visible Human Male (CC BY 4.0); BodyParts3D (DBCLS, CC BY 4.0). Adapted for PeptideScope.',
  extras: { frame: report.frame, license: 'CC BY 4.0 (adapted material; see assets/anatomy/LICENSE.md)', pairsWith: 'body.glb', atlas: `atlas-${SEX}.json` },
  positionBits: 14, normalBits: 10,
});
report.glbBytes = statSync(glbPath).size;
log(`  ${glbName} ${(report.glbBytes / 1e6).toFixed(2)} MB, ${items.length} meshes, ${items.reduce((s, i) => s + M.triCount(i.mesh), 0)} triangles`);
if (report.glbBytes > 8e6) warn(`${glbName} is ${(report.glbBytes / 1e6).toFixed(2)} MB (> 8 MB budget)`);

// atlas: every named mesh of body.glb and detail-<sex>.glb, centres in the published frame
const landmarks = JSON.parse(readFileSync(join(OUT, 'landmarks.json'), 'utf8'));
const r4 = (v) => v.map((x) => Math.round(x * 1e4) / 1e4);
const structures = [];
for (const id of Object.keys(body)) {
  const s = BODY_STRUCTURES[id]; if (!s) { warn(`atlas: no catalogue entry for body.glb mesh "${id}"`); continue; }
  const lm = landmarks.organs[id];
  const center = lm && !lm.anchor ? lm.center : M.surfaceCentroid(body[id]);
  const e = { id, name: s.name, plain: s.plain, system: s.system, center: r4(center), file: 'body.glb' };
  if (lm?.parts) e.sides = Object.fromEntries(Object.entries(lm.parts).map(([side, v]) => [side, r4(v.center)]));
  structures.push(e);
}
for (const it of items) {
  let s, extra = {};
  if (it.name.startsWith('muscle_')) {
    const mu = MUSCLES.find((m) => `muscle_${m.slug}` === it.name);
    s = { name: mu.name, plain: mu.plain, system: 'muscular' };
    extra = { region: mu.region, layer: mu.layer || 'superficial' };
  } else s = DETAIL_STRUCTURES[it.name];
  const c = sideCenters(it.mesh);
  // paired structures (muscles of both sides, the two eyes): centre on the person's left, both sides listed
  const paired = it.name.startsWith('muscle_') || it.name === 'eyes';
  const bilateral = paired && c.left && c.right && c.leftShare > 0.3 && c.leftShare < 0.7 && Math.abs(c.left[0]) > 0.02;
  const e = { id: it.name, name: s.name, plain: s.plain, system: s.system, center: r4(bilateral ? c.left : M.surfaceCentroid(it.mesh)), file: glbName, ...extra };
  if (bilateral) e.sides = { left: r4(c.left), right: r4(c.right) };
  structures.push(e);
}
const atlas = {
  version: 1, units: 'm', sex: SEX,
  frame: 'metres, +Y up, feet at y=0, body faces +Z, centred on x=0 z=0, person\'s left = +X (same as body.glb)',
  centers: 'surface or volume centroid in the published frame; for paired structures `center` is the person\'s left side (+X) and `sides` gives both',
  files: { 'body.glb': 'assets/anatomy/body.glb', [glbName]: `assets/anatomy/${glbName}` },
  attribution: 'Anatomy adapted from the HRA 3D Reference Organs (NIH HuBMAP, CC BY 4.0), the VOXEL-MAN Segmented Internal Organs of the Visible Human Male (Höhne et al., CC BY 4.0) and BodyParts3D (© DBCLS, CC BY 4.0).',
  structures,
};
writeFileSync(join(OUT, `atlas-${SEX}.json`), JSON.stringify(atlas, null, 1));
report.atlas = { structures: structures.length };
writeFileSync(join(WORK, `report-${SEX}.json`), JSON.stringify(report, null, 2));
log(`  atlas-${SEX}.json: ${structures.length} structures`);
console.log(JSON.stringify({ glbMB: +(report.glbBytes / 1e6).toFixed(3), skin_hi: report.stages.skin_hi, meshes: Object.keys(report.meshes).length, triangles: Object.values(report.meshes).reduce((s, m) => s + m.triangles, 0), warnings: report.warnings }, null, 2));
