// Behind the Vial: peptide catalog.
//
// Retatrutide is the full entry (ready: true, loaded on demand). The other 20
// are "coming soon" stubs. SAMPLE FILE: statuses, status labels and one-liners
// below are placeholders (sample: true) until the verified research replaces
// this file. tests/data.test.mjs fails while any sample remains.
//
// Shape (ready):     { id, name, aka, status, statusLabel, ready: true, load }
// Shape (stub):      { id, name, aka, status, statusLabel, oneLine, sources, ready: false }
//   status: approved | in-trials | research-only

const soon = (id, name, aka, status, oneLine) => ({
  id,
  name,
  aka,
  status,
  statusLabel: 'Sample status label: not yet verified',
  oneLine,
  sources: ['sample-regulator-1', 'sample-journal-4'],
  ready: false,
  sample: true,
});

export const PEPTIDES = [
  {
    id: 'retatrutide',
    name: 'Retatrutide',
    aka: ['LY3437943'],
    status: 'in-trials',
    statusLabel: 'Investigational: not approved anywhere',
    ready: true,
    load: () => import('./retatrutide.js'),
    sample: true,
  },
  soon('semaglutide', 'Semaglutide', ['Ozempic', 'Wegovy', 'Rybelsus'], 'approved',
    'Sample one-liner: a weekly medicine for type 2 diabetes and weight, sold under brand names.'),
  soon('tirzepatide', 'Tirzepatide', ['Mounjaro', 'Zepbound'], 'approved',
    'Sample one-liner: a weekly medicine that acts on two gut-hormone receptors.'),
  soon('cagrilintide', 'Cagrilintide', ['CagriSema (with semaglutide)'], 'in-trials',
    'Sample one-liner: a long-acting copy of a hormone that helps you feel full, still being studied.'),
  soon('tesamorelin', 'Tesamorelin', ['Egrifta'], 'approved',
    'Sample one-liner: a prescription peptide that prompts the body to release growth hormone.'),
  soon('cjc-1295', 'CJC-1295', ['CJC-1295 with DAC', 'Mod GRF 1-29'], 'research-only',
    'Sample one-liner: a lab-made growth-hormone-releasing peptide sold online as a research chemical.'),
  soon('ipamorelin', 'Ipamorelin', [], 'research-only',
    'Sample one-liner: a lab-made peptide that triggers growth hormone release, sold online.'),
  soon('sermorelin', 'Sermorelin', ['GRF 1-29'], 'research-only',
    'Sample one-liner: a short copy of the brain signal that releases growth hormone.'),
  soon('bpc-157', 'BPC-157', ['Body Protection Compound 157'], 'research-only',
    'Sample one-liner: a lab-made peptide promoted for injury healing. Human evidence is very limited.'),
  soon('tb-500', 'TB-500', ['Thymosin beta-4 fragment'], 'research-only',
    'Sample one-liner: a lab-made fragment of a repair protein, promoted for recovery.'),
  soon('ghk-cu', 'GHK-Cu', ['Copper peptide'], 'research-only',
    'Sample one-liner: a small copper-binding peptide used in skin products and sold for injection.'),
  soon('melanotan-2', 'Melanotan II', ['MT-II'], 'research-only',
    'Sample one-liner: an unapproved tanning peptide that darkens skin and can change moles.'),
  soon('melanotan-1', 'Melanotan I', ['Afamelanotide'], 'research-only',
    'Sample one-liner: a tanning peptide; one approved medical form exists, online vials are not it.'),
  soon('pt-141', 'PT-141', ['Bremelanotide'], 'approved',
    'Sample one-liner: a peptide that acts on the brain to affect sexual desire.'),
  soon('mots-c', 'MOTS-c', [], 'research-only',
    'Sample one-liner: a peptide made by mitochondria, studied mostly in animals.'),
  soon('ss-31', 'SS-31', ['Elamipretide'], 'in-trials',
    'Sample one-liner: a peptide aimed at mitochondria, studied for rare diseases.'),
  soon('epitalon', 'Epitalon', ['Epithalon'], 'research-only',
    'Sample one-liner: a short peptide promoted for anti-aging with little human evidence.'),
  soon('semax', 'Semax', [], 'research-only',
    'Sample one-liner: a nasal peptide used in some countries, promoted online for focus.'),
  soon('selank', 'Selank', [], 'research-only',
    'Sample one-liner: a nasal peptide used in some countries, promoted online for anxiety.'),
  soon('thymosin-alpha-1', 'Thymosin alpha-1', ['Thymalfasin'], 'research-only',
    'Sample one-liner: an immune-signaling peptide approved in some countries, sold online elsewhere.'),
  soon('kpv', 'KPV', ['Lys-Pro-Val'], 'research-only',
    'Sample one-liner: a three-amino-acid fragment studied in the lab for inflammation.'),
];
