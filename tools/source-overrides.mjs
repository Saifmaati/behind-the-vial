// Corrections applied by tools/build-sources.mjs on top of research/sources.json (the ledger is
// not edited by hand). Each override names why it exists; see docs/decisions/fix.md.
//
//   drop:  source ids never shipped (no fact cites them, and their URLs name sellers)
//   patch: fields replaced in a shipped source record
export const SOURCE_OVERRIDES = {
  drop: [
    // Finnrick certificate pages: the URL path names the seller of each tested vial. No fact on the
    // site cites them (the vial facts cite the results database and the methodology page).
    'finnrick-2026-retatrutide-lab-test-certificate',
    'finnrick-2026-retatrutide-lab-test-certificate-2',
    'finnrick-2026-retatrutide-lab-test-certificate-3',
    // FDA warning letters addressed to individual sellers: the title and URL are the seller's name.
    // No fact cites them (the enforcement facts cite FDA's warning-letter index), so they never ship.
    'u-s-2024-warning-letter-summit-research',
    'u-s-2025-warning-letter-darmerica-llc',
    'u-s-2025-warning-letter-genlabmeds-marcs',
    'u-s-2025-warning-letter-glp-1',
    'u-s-2026-warning-letter-genogenix-llc',
    'u-s-2026-warning-letter-lovega-llc',
    'u-s-2026-warning-letter-peptide-partners',
    'u-s-2026-warning-letter-royal-peptides',
  ],
  patch: {
    // The results database page lists sellers with star ratings and a price column, so it is never
    // linked from a page for teens. The record keeps the figures' origin and points at Finnrick's
    // methodology page (no seller list) instead; the Sources panel says the link is withheld.
    'finnrick-2026-retatrutide-safety-testing-results': {
      title: 'Retatrutide test results database',
      url: 'https://www.finnrick.com/methodology',
      linkWithheld: 'Link withheld: the results page lists sellers and prices. The link goes to Finnrick’s methodology page instead.',
    },
    // Ledger checkers (gap-pk-peak-and-steady-state-primary-phase2-belly-only, -sad-gi-timing): the
    // NCT04867785 document is protocol J1I-MC-GZBD(c) and the NCT04881760 document is J1I-MC-GZBF(b).
    // The ids stay as they are (facts cite them); only the visible titles are corrected.
    'eli-lilly-2022-protocol-j1i-mc-gzbf': {
      title: 'Protocol J1I-MC-GZBD(c): A Phase 2 Study of Once-Weekly LY3437943 in Participants With Type 2 Diabetes (NCT04867785), Prot_000',
    },
    'eli-lilly-2022-protocol-j1i-mc-gzbg': {
      title: 'Protocol J1I-MC-GZBF(b): A Study of LY3437943 in Participants Who Have Obesity or Are Overweight (NCT04881760), Prot_000',
    },
  },
};
