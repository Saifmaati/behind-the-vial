// Turns the research workflow output into the claims ledger and the source registry.
//
//   node tools/ledger.mjs <research-result.json>
//
// Writes:
//   research/claims.json   every claim with its fact-check verdict applied
//   research/LEDGER.md     human-readable ledger (what was confirmed, corrected, dropped)
//   research/sources.json  unique sources used by usable claims, with stable ids
//
// Verdict rules: confirmed → usable as written; corrected → usable with the checker's
// corrected wording/value and evidence quote; unverifiable → usable only with an
// "Unverified" flag; refuted (or a disallowed source type) → never shown.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const groups = [...(raw.topics || []), ...(raw.gaps || [])];

const normUrl = u => {
  try {
    const x = new URL(String(u).trim());
    x.hash = '';
    for (const k of [...x.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/.test(k)) x.searchParams.delete(k);
    return x.toString().replace(/\/$/, '');
  } catch { return String(u || '').trim(); }
};
const slug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, ' ').trim().split(/\s+/)
  .filter(w => !/^(the|a|an|of|and|for|in|on|to|with|by|at|from|vs|versus)$/.test(w)).join('-');
const year = d => (String(d || '').match(/(19|20)\d\d/) || ['nd'])[0];

// STRICT SOURCE POLICY (owner, 2026-10-08: "don't use any sources that aren't incredibly accurate").
// Allowed: regulators and official registries, government health agencies, peer-reviewed journals
// (and their supplements), trial registries, the manufacturer's own official releases/documents,
// major national medical societies, Public Citizen, America's Poison Centers, WADA (doping status),
// and independent testing labs' own published results. Excluded: news outlets, press-release
// re-hosts, computed database properties, and any claim whose value was read off a chart.
const EXCLUDED_HOSTS = new Set(['www.abc.net.au', 'www.cbsnews.com', 'www.yahoo.com', 'www.cnbc.com', 'abcnews.com',
  'www.healio.com', 'www.raps.org', 'www.placera.se', 'www.biospace.com', 'pubchem.ncbi.nlm.nih.gov']);
const EXCLUDED_TYPES = new Set(['news']);
const host = u => { try { return new URL(u).host; } catch { return ''; } };
const policyReject = (c, url) => {
  if (EXCLUDED_TYPES.has(c.sourceType)) return 'news source';
  if (EXCLUDED_HOSTS.has(host(url))) return `excluded host ${host(url)}`;
  if (/chart read|read (?:off|from) (?:the )?(?:chart|figure|graph)|estimated from (?:a )?figure/i.test(`${c.value} ${c.notes}`)) return 'value read off a chart';
  if (c.status === 'unverified') return 'researcher could not open the source text';
  return '';
};

const claims = [];
for (const g of groups) {
  const verdicts = new Map((g.verdicts || []).map(v => [v.id, v]));
  for (const c of g.claims || []) {
    const v = verdicts.get(c.id);
    const verdict = v ? v.verdict : 'unchecked';
    const disallowed = v && v.sourceAllowed === false;
    const corrected = verdict === 'corrected';
    const evidenceUrl = v && v.evidenceUrl ? normUrl(v.evidenceUrl) : '';
    const sourceUrl = normUrl(c.sourceUrl);
    const rejected = policyReject(c, sourceUrl);
    // Only claims an independent checker confirmed (or corrected, with its own quote) are usable.
    const usable = !disallowed && !rejected && (verdict === 'confirmed' || corrected);
    claims.push({
      id: c.id,
      topic: g.topic,
      statement: corrected && v.correctedStatement ? v.correctedStatement : c.statement,
      value: corrected && v.correctedValue ? v.correctedValue : c.value,
      originalStatement: corrected ? c.statement : undefined,
      originalValue: corrected ? c.value : undefined,
      verdict,
      usable,
      unverified: false, // unusable claims are dropped outright under the strict policy
      rejected: rejected || (disallowed ? 'checker: source type not allowed' : undefined),
      source: { title: c.sourceTitle, publisher: c.sourcePublisher, url: sourceUrl, date: c.sourceDate, type: c.sourceType },
      evidenceUrl: evidenceUrl && evidenceUrl !== sourceUrl ? evidenceUrl : undefined,
      quote: c.quote,
      checkerQuote: v ? v.evidenceQuote : undefined,
      researcherStatus: c.status,
      notes: [c.notes, v && v.notes ? `CHECKER: ${v.notes}` : ''].filter(Boolean).join(' | '),
    });
  }
}

// Stable, readable source ids for every source a usable claim relies on.
const sources = new Map();
const ids = new Set();
for (const c of claims.filter(x => x.usable)) {
  const key = c.source.url;
  if (!sources.has(key)) {
    let base = [slug(c.source.publisher).split('-').slice(0, 2).join('-'), year(c.source.date), slug(c.source.title).split('-').slice(0, 4).join('-')].filter(Boolean).join('-').slice(0, 60).replace(/-+$/, '');
    let id = base, n = 2;
    while (ids.has(id)) id = `${base}-${n++}`;
    ids.add(id);
    sources.set(key, { id, ...c.source, usedBy: [] });
  }
  const s = sources.get(key);
  s.usedBy.push(c.id);
  c.sourceId = s.id;
}

mkdirSync(`${ROOT}research`, { recursive: true });
writeFileSync(`${ROOT}research/claims.json`, JSON.stringify(claims, null, 1));
writeFileSync(`${ROOT}research/sources.json`, JSON.stringify([...sources.values()], null, 1));

const count = k => claims.filter(c => c.verdict === k).length;
const lines = [
  '# Research ledger',
  '',
  'Every fact in the app traces to a row here. Researcher agents collected each claim with a verbatim quote from an allowed source; independent fact-checker agents re-opened the source and tried to refute it. Strict policy: only claims a checker confirmed or corrected are usable, and news outlets, press-release re-hosts, computed database values and chart-read values are excluded.',
  '',
  `Claims: ${claims.length}. Confirmed ${count('confirmed')}, corrected ${count('corrected')}, unverifiable ${count('unverifiable')}, refuted ${count('refuted')}, unchecked ${count('unchecked')}. Usable: ${claims.filter(c => c.usable).length}. Sources used: ${sources.size}.`,
  '',
  '| id | verdict | statement | value | source |',
  '|---|---|---|---|---|',
  ...claims.map(c => `| ${c.id} | ${c.verdict}${c.usable ? '' : ` (dropped${c.rejected ? `: ${c.rejected}` : ''})`} | ${String(c.statement).replace(/\|/g, '/').replace(/\n/g, ' ')} | ${String(c.value || '').replace(/\|/g, '/')} | [${String(c.source.publisher || c.source.title || 'link').replace(/[|\]]/g, ' ')}](${c.source.url}) |`),
  '',
  '## Open questions reported by researchers',
  ...groups.flatMap(g => (g.openQuestions || []).map(q => `- (${g.topic}) ${q}`)),
];
writeFileSync(`${ROOT}research/LEDGER.md`, lines.join('\n') + '\n');
console.log(JSON.stringify({ claims: claims.length, usable: claims.filter(c => c.usable).length, sources: sources.size, verdicts: { confirmed: count('confirmed'), corrected: count('corrected'), unverifiable: count('unverifiable'), refuted: count('refuted'), unchecked: count('unchecked') } }));
