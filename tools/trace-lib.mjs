// Shared traceability checks for data/ (used by tests/traceability.test.mjs and tools/trace.mjs).
// See tests/traceability.test.mjs for the rules.
import { readFileSync } from 'node:fs';

const MODEL_FIELDS = new Set(['fromDays', 'toDays', 'tDays', 'intervalDays', 'order', 'sample', 'labeledMg']);
const SKIP_KEYS = new Set(['sources', 'ledger', 'id', 'organ', 'organs', 'alsoOrgans', 'level', 'severity', 'verdict', 'status', 'identity', 'type', 'url', 'receptors', 'kind', 'tone']);
const NAME_KEYS = new Set(['id', 'name', 'aka', 'developerCode']);
const HELPLINES = /\b(911|988|1-800-222-1222)\b/g;
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14, twenty: 20, half: 50, once: 1, twice: 2 };

const norm = s => String(s ?? '').replace(/(\d),(?=\d{3}\b)/g, '$1').replace(/[−–—]/g, '-');
export const numbersIn = s => [...norm(s).replace(HELPLINES, ' ').matchAll(/\d+(?:\.\d+)?/g)].map(m => m[0]);

function haystackNumbers(claims) {
  const text = claims.map(c => [c.statement, c.value, c.quote, c.checkerQuote, c.originalValue].join(' ')).join(' ');
  const set = new Set(numbersIn(text).flatMap(n => [n, String(Number(n))]));
  for (const [w, n] of Object.entries(WORDS)) if (new RegExp(`\\b${w}\\b`, 'i').test(text)) set.add(String(n));
  return set;
}

function ownContent(obj, strings = [], nums = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (SKIP_KEYS.has(k)) continue;
    if (typeof v === 'string') strings.push(v);
    else if (typeof v === 'number' && !MODEL_FIELDS.has(k)) nums.push(String(v));
    else if (v && typeof v === 'object') {
      for (const child of Array.isArray(v) ? v : [v]) {
        if (typeof child === 'string') strings.push(child);
        else if (typeof child === 'number') nums.push(String(child));
        else if (child && typeof child === 'object' && !Array.isArray(child.sources)) ownContent(child, strings, nums);
      }
    }
  }
  return { strings, nums };
}

function factObjects(root, path, out = []) {
  if (!root || typeof root !== 'object') return out;
  if (!Array.isArray(root) && Array.isArray(root.sources)) out.push({ path, obj: root });
  for (const [k, v] of Object.entries(root)) if (v && typeof v === 'object') factObjects(v, `${path}.${k}`, out);
  return out;
}

export function loadLedger(path) {
  return new Map(JSON.parse(readFileSync(path, 'utf8')).map(c => [c.id, c]));
}

export function checkRoot(name, root, claims, sourceIds) {
  const problems = [];
  for (const { path, obj } of factObjects(root, name)) {
    if (obj.sample) { problems.push(`${path}: still sample`); continue; }
    for (const s of obj.sources) if (sourceIds && !sourceIds.has(s)) problems.push(`${path}: source id ${s} is not in data/sources.js`);
    const { strings, nums } = ownContent(obj);
    if (obj.editorial) {
      const digits = strings.flatMap(numbersIn);
      if (digits.length) problems.push(`${path}: editorial text contains numbers ${digits.join(', ')}`);
      continue;
    }
    const ids = obj.ledger || [];
    if (!ids.length) { problems.push(`${path}: no ledger ids (add ledger or editorial: true)`); continue; }
    const used = [];
    for (const id of ids) {
      const c = claims.get(id);
      if (!c) problems.push(`${path}: unknown ledger id ${id}`);
      else if (!c.usable) problems.push(`${path}: ledger id ${id} is not usable (${c.verdict})`);
      else used.push(c);
    }
    const want = new Set(used.map(c => c.sourceId));
    const have = new Set(obj.sources);
    for (const s of have) if (!want.has(s)) problems.push(`${path}: cites ${s}, which none of its ledger claims use`);
    for (const s of want) if (!have.has(s)) problems.push(`${path}: missing source ${s} (from its ledger claims)`);
    if (used.some(c => c.unverified) && !obj.unverified) problems.push(`${path}: relies on an unverified claim but lacks unverified: true`);
    const hay = haystackNumbers(used);
    const missing = [...new Set([...strings.flatMap(numbersIn), ...nums])].filter(n => !hay.has(n) && !hay.has(String(Number(n))));
    if (missing.length) problems.push(`${path}: numbers not found in its ledger claims: ${missing.join(', ')}`);
  }
  (function uncited(node, path) {
    if (!node || typeof node !== 'object' || Array.isArray(node.sources)) return;
    for (const [k, v] of Object.entries(node)) {
      if (NAME_KEYS.has(k)) continue; // product names like "BPC-157" are names, not figures
      if (typeof v === 'string' && numbersIn(v).length) problems.push(`${path}.${k}: uncited text contains numbers ("${v.slice(0, 60)}")`);
      else if (v && typeof v === 'object') uncited(v, `${path}.${k}`);
    }
  })(root, name);
  return problems;
}
