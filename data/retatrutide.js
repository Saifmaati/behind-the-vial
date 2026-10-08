// Retatrutide: the full PeptideScope entry, assembled from verified parts.
// Every fact object carries `sources` (ids in data/sources.js) and `ledger` (claim ids in
// research/claims.json); tests/traceability.test.mjs checks that every number it shows appears in
// the fact-checked claims it cites. Edit the parts, not this file:
//   retatrutide/core.js          identity, status, mechanism, targets, timing, absorption
//   retatrutide/side-effects.js  side effects with organ, frequency, why, how to reduce, timing
//   retatrutide/safety.js        red flags, too much / overdose, personal-history warnings
//   retatrutide/evidence.js      fixed trial facts by studied group, evidence ladder, creator claims
import core from './retatrutide/core.js';
import sideEffects from './retatrutide/side-effects.js';
import safety from './retatrutide/safety.js';
import evidence from './retatrutide/evidence.js';

export default {
  ...core,
  sideEffects,
  ...safety,
  ...evidence,
};
