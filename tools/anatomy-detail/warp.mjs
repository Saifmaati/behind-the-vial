// Rebuild the anatomy build's BodyParts3D -> HRA thin-plate splines exactly (same landmark pairs, same vessel-junction
// pairs, same pre-alignment) for the male and the female body, using only functions exported by tools/anatomy/*.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as M from '../anatomy/mesh.mjs';
import { preAlign, makeWarp, warpLandmarks } from '../anatomy/bp3d-warp.mjs';

const WARP_VERSION = 4; // must equal tools/build-anatomy.mjs WARP_VERSION

// Same helper as tools/build-anatomy.mjs (centroid of the extreme vertices along a direction).
const endOf = (m, dir, tol = 0.003) => {
  const d = M.norm(dir); const p = m.positions; let mx = -Infinity;
  for (let i = 0; i < p.length; i += 3) mx = Math.max(mx, p[i] * d[0] + p[i + 1] * d[1] + p[i + 2] * d[2]);
  let n = 0; const c = [0, 0, 0];
  for (let i = 0; i < p.length; i += 3) if (p[i] * d[0] + p[i + 1] * d[1] + p[i + 2] * d[2] > mx - tol) { c[0] += p[i]; c[1] += p[i + 1]; c[2] += p[i + 2]; n++; }
  return c.map((v) => v / n);
};

/**
 * @param {object} o
 * @param {object} o.skinHRA  full-resolution welded HRA skin (HRA frame)
 * @param {(name:string)=>object} o.part  HRA junction part mesh by node name
 * @param {object} o.po, o.isa  BP3D trees
 * @param {string} o.cacheFile  warp landmark cache (JSON); computed with o.hra when missing
 */
export function buildMaleWarp({ skinHRA, part, po, isa, cacheFile, hra = null, log = () => {} }) {
  const ringSkin = M.simplify(skinHRA, 150000, { error: 0.005 });
  let lmk = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : null;
  if (!lmk || lmk.version !== WARP_VERSION) {
    if (!hra) throw new Error('warp landmark cache missing: pass the open HRA handle to recompute it');
    lmk = { version: WARP_VERSION, ...warpLandmarks({ hra, po, isa, hraSkin: ringSkin, log }) };
    writeFileSync(cacheFile, JSON.stringify(lmk));
  }
  const pa = preAlign(po, ringSkin);
  const bpPre = (tree, name) => pa.preMesh(tree.mesh(name));
  const junctions = [
    ['brachiocephalic trunk origin', endOf(bpPre(isa, 'brachiocephalic artery'), [0, -1, 0]), endOf(part('VH_M_brachiocephalic_artery_a'), [0, -1, 0])],
    ['left common carotid origin', endOf(bpPre(isa, 'left common carotid artery'), [0, -1, 0]), endOf(part('VH_M_left_common_carotid_artery_a'), [0, -1, 0])],
    ['left subclavian origin', endOf(bpPre(isa, 'left subclavian artery'), [0, -1, 0]), endOf(part('VH_M_left_subclavian_artery_a'), [0, -1, 0])],
    ['aortic bifurcation', endOf(bpPre(isa, 'abdominal aorta'), [0, -1, 0]), endOf(part('VH_M_descending_aorta_b'), [0, -1, 0])],
    ['left venous angle', endOf(bpPre(isa, 'left brachiocephalic vein'), [1, 0.4, 0]), endOf(part('VH_M_brachiocephalic_vein_L'), [1, 0.4, 0])],
    ['right venous angle', endOf(bpPre(isa, 'right brachiocephalic vein'), [-1, 0.4, 0]), endOf(part('VH_M_brachiocephalic_vein_R'), [-1, 0.4, 0])],
    ['left external iliac vein (inguinal)', endOf(bpPre(isa, 'left external iliac vein'), [0.3, -1, 0.5]), endOf(part('VH_M_external_iliac_vein_L'), [0.3, -1, 0.5])],
    ['right external iliac vein (inguinal)', endOf(bpPre(isa, 'right external iliac vein'), [-0.3, -1, 0.5]), endOf(part('VH_M_external_iliac_vein_R'), [-0.3, -1, 0.5])],
  ];
  const warp = makeWarp(pa, lmk, junctions.map((j) => [j[1], j[2]]));
  return { warp, pa, lmk, junctions: junctions.map((j) => j[0]) };
}

/**
 * Rebuild the female build's BodyParts3D -> HRA female thin-plate spline exactly (tools/build-anatomy.mjs --sex female:
 * same cached landmark pairs and options, same 7 vessel-junction pairs, same pre-alignment).
 * @param {object} o.hra  openFemaleHRA() handle (logical male names are translated)
 */
export function buildFemaleWarp({ skinHRA, hra, po, isa, cacheFile, log = () => {} }) {
  const ringSkin = M.simplify(skinHRA, 150000, { error: 0.005 });
  const optsKey = 'hip=crest;sternum;mask=breasts;fingers=lateral';
  const lmk = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : null;
  if (!lmk || lmk.version !== WARP_VERSION || lmk.optsKey !== optsKey) throw new Error(`female warp landmarks not cached (${cacheFile}): run node tools/build-anatomy.mjs --sex female first`);
  const pa = preAlign(po, ringSkin);
  const bpPre = (tree, name) => pa.preMesh(tree.mesh(name));
  const hv = (n) => M.weld(hra.collect(n), 1e-6);
  const junctions = [
    ['brachiocephalic trunk origin', endOf(bpPre(isa, 'brachiocephalic artery'), [0, -1, 0]), endOf(hv('VH_M_brachiocephalic_artery_a'), [0, -1, 0])],
    ['left common carotid origin', endOf(bpPre(isa, 'left common carotid artery'), [0, -1, 0]), endOf(hv('VH_M_left_common_carotid_artery_a'), [0, -1, 0])],
    ['left subclavian origin', endOf(bpPre(isa, 'left subclavian artery'), [0, -1, 0]), endOf(hv('VH_M_left_subclavian_artery_a'), [0, -1, 0])],
    ['aortic bifurcation', endOf(bpPre(isa, 'abdominal aorta'), [0, -1, 0]), endOf(hv('VH_M_descending_aorta_b'), [0, -1, 0])],
    ['superior vena cava (brachiocephalic confluence)', endOf(bpPre(isa, 'superior vena cava'), [0, 1, 0]), endOf(hv('VH_M_superior_vena_cava'), [0, 1, 0])],
    ['left common iliac vein (distal end)', endOf(bpPre(isa, 'left common iliac vein'), [0.5, -1, 0.2]), endOf(hv('VH_M_common_iliac_vein_L'), [0.5, -1, 0.2])],
    ['right common iliac vein (distal end)', endOf(bpPre(isa, 'right common iliac vein'), [-0.5, -1, 0.2]), endOf(hv('VH_M_common_iliac_vein_R'), [-0.5, -1, 0.2])],
  ];
  const warp = makeWarp(pa, lmk, junctions.map((j) => [j[1], j[2]]));
  log(`female thin-plate spline: ${warp.count} pairs, max residual ${(warp.maxResidual * 1000).toFixed(1)} mm`);
  return { warp, pa, lmk, junctions: junctions.map((j) => j[0]) };
}
