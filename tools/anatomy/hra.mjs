// HRA (Human Reference Atlas, NIH HuBMAP) united-male GLB reader.
// Collects world-space triangle meshes for named node subtrees. The GLB is untrusted data:
// it is only parsed as glTF (JSON + binary buffers) by @gltf-transform/core, never executed.
// HRA frame (as published): metres, +Y up, +Z anterior (front), +X = the person's left.
import { NodeIO } from '@gltf-transform/core';
import { mesh as mk, merge, applyMatrix } from './mesh.mjs';

export async function openHRA(file) {
  const io = new NodeIO();
  const doc = await io.read(file);
  const nodes = new Map();
  for (const n of doc.getRoot().listNodes()) {
    const name = n.getName();
    if (!nodes.has(name)) nodes.set(name, []);
    nodes.get(name).push(n);
  }
  const primMesh = (prim, world) => {
    const pos = prim.getAttribute('POSITION');
    if (!pos || (prim.getMode() !== 4)) return null; // triangles only
    const arr = new Float32Array(pos.getCount() * 3);
    const el = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, el); arr[i * 3] = el[0]; arr[i * 3 + 1] = el[1]; arr[i * 3 + 2] = el[2]; }
    const ind = prim.getIndices();
    let idx;
    if (ind) idx = Uint32Array.from(ind.getArray()); else { idx = new Uint32Array(pos.getCount()); for (let i = 0; i < idx.length; i++) idx[i] = i; }
    return applyMatrix(mk(arr, idx), world);
  };
  /** Merged world-space mesh of every mesh node in the subtrees of the given node names. */
  function collect(names, { exclude = [] } = {}) {
    const out = [];
    const ex = exclude.map((e) => (e instanceof RegExp ? e : new RegExp(`^${e}$`)));
    const visit = (node) => {
      const nm = node.getName();
      if (ex.some((r) => r.test(nm))) return;
      const m = node.getMesh();
      if (m) for (const prim of m.listPrimitives()) { const pm = primMesh(prim, node.getWorldMatrix()); if (pm) out.push(pm); }
      for (const c of node.listChildren()) visit(c);
    };
    for (const name of [].concat(names)) {
      const list = nodes.get(name);
      if (!list) throw new Error(`HRA: node not found: ${name}`);
      visit(list[0]);
    }
    return merge(out);
  }
  /** Names of all descendants (incl. self) that carry a mesh. */
  function meshNodesUnder(name) {
    const res = [];
    const visit = (n) => { if (n.getMesh()) res.push(n.getName()); n.listChildren().forEach(visit); };
    visit(nodes.get(name)[0]);
    return res;
  }
  return { doc, nodes, collect, meshNodesUnder, has: (n) => nodes.has(n) };
}
