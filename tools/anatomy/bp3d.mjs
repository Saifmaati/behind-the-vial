// BodyParts3D (DBCLS) loader: concept name / FMA id -> merged triangle soup from element OBJ files.
// Raw OBJ files are untrusted data: parsed as plain text numbers only, never executed.
// BP3D frame: millimetres, Z up (feet near z=0), -Y = anterior (front), +X = person's left.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export class BP3D {
  /** tree: 'partof' or 'isa' (element file ids are tree-specific: FJ1234 differs between trees). */
  constructor(rawDir, tree = 'partof') {
    if (!['partof', 'isa'].includes(tree)) throw new Error('BP3D: tree must be partof|isa');
    this.tree = tree;
    this.objDir = join(rawDir, 'obj', `${tree}_BP3D_4.0_obj_99`);
    this.byName = new Map();
    this.byFma = new Map();
    this.fmaOf = new Map();
    const lines = readFileSync(join(rawDir, 'meta', `${tree}_element_parts.txt`), 'utf8').split(/\r?\n/).slice(1);
    for (const l of lines) {
      const [fma, name, fj] = l.split('\t');
      if (!fj) continue;
      if (!this.fmaOf.has(name)) this.fmaOf.set(name, fma);
      if (!this.byName.has(name)) this.byName.set(name, new Set());
      this.byName.get(name).add(fj);
      if (!this.byFma.has(fma)) this.byFma.set(fma, new Set());
      this.byFma.get(fma).add(fj);
    }
    this.cache = new Map();
  }
  /**
   * Element files of a concept. In the IS-A tree a concept can list unrelated elements, so prefer the elements whose
   * OBJ header names this concept, and drop near-duplicate elements (same bounds within 2 mm).
   */
  elements(key) {
    const s = this.byName.get(key) || this.byFma.get(key);
    if (!s) throw new Error(`BP3D(${this.tree}): unknown concept "${key}"`);
    let list = [...s];
    const fma = this.fmaOf.get(key) || (key.startsWith('FMA') ? key : null);
    if (fma) { const own = list.filter((f) => this.readElement(f).concept === fma); if (own.length) list = own; }
    const kept = [];
    for (const f of list) {
      const b = this.readElement(f).bounds;
      if (b && kept.some((k) => { const c = this.readElement(k).bounds; return c && c.every((v, i) => Math.abs(v - b[i]) < 2); })) continue;
      kept.push(f);
    }
    return kept;
  }
  readElement(fj) {
    if (this.cache.has(fj)) return this.cache.get(fj);
    const file = join(this.objDir, `${fj}.obj`);
    if (!/^FJ\d+M?$/.test(fj) || !existsSync(file)) throw new Error(`BP3D: missing element ${fj}`);
    const pos = [], idx = []; let concept = null; let bounds = null;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (line.startsWith('# Concept ID')) concept = line.split(':')[1].trim();
      else if (line.startsWith('# Bounds')) bounds = (line.match(/-?\d+\.\d+/g) || []).map(Number);
      else if (line.startsWith('v ')) {
        const p = line.trim().split(/\s+/);
        pos.push(+p[1], +p[2], +p[3]);
      } else if (line.startsWith('f ')) {
        const p = line.trim().split(/\s+/).slice(1).map((t) => parseInt(t.split('/')[0], 10) - 1);
        for (let i = 1; i + 1 < p.length; i++) idx.push(p[0], p[i], p[i + 1]);
      }
    }
    const m = { positions: new Float32Array(pos), indices: new Uint32Array(idx), concept, bounds };
    if (m.positions.some((v) => !Number.isFinite(v))) throw new Error(`BP3D: bad number in ${fj}`);
    this.cache.set(fj, m);
    return m;
  }
  /** Merge all element meshes of one or more concepts into a single indexed mesh (BP3D frame, mm). */
  has(key) { return this.byName.has(key) || this.byFma.has(key); }
  mesh(...keys) {
    const fjs = [...new Set(keys.flatMap((k) => this.elements(k)))];
    const parts = fjs.map((f) => this.readElement(f));
    const nv = parts.reduce((n, p) => n + p.positions.length, 0);
    const ni = parts.reduce((n, p) => n + p.indices.length, 0);
    const positions = new Float32Array(nv), indices = new Uint32Array(ni);
    let ov = 0, oi = 0;
    for (const p of parts) {
      positions.set(p.positions, ov);
      for (let i = 0; i < p.indices.length; i++) indices[oi + i] = p.indices[i] + ov / 3;
      ov += p.positions.length; oi += p.indices.length;
    }
    return { positions, indices, elements: fjs };
  }
}
