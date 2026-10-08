// Behind the Vial: gray-market reality (independent vial tests + enforcement).
//
// SAMPLE FILE. Placeholder content until the verified research replaces it.
// Vial results use obviously artificial repdigit percentages (11, 22, 33...)
// purely so the chart layout can be checked; they are NOT test results.
// tests/data.test.mjs fails while any sample remains.
//
// vialTests[].pctOfLabel: measured amount as a % of what the label claims;
//   null means none of the drug was detected.
// vialTests[].labeledMg is kept for the record only. The UI never shows it.

const LAB1 = 'sample-lab-1';
const LAB2 = 'sample-lab-2';
const REG2 = 'sample-regulator-2';

const vial = (id, pctOfLabel, identity, src = LAB1) => ({
  id,
  label: `Sample vial ${id.toUpperCase()}`,
  labeledMg: null,
  pctOfLabel,
  identity,
  note: pctOfLabel == null ? 'Sample note: none of the labeled drug found.' : 'Sample note: placeholder result.',
  sources: [src],
  sample: true,
});

export const GRAY = {
  headline: 'With these products, you cannot know how much you are actually getting.',
  intro: 'Sample text. Independent labs bought vials sold online as "research peptides" and measured what was inside. The results are all over the place.',
  enforcement: [
    { text: 'Sample stat: warning letters sent to online sellers', value: '00', sources: [REG2], sample: true },
    { text: 'Sample stat: websites or listings taken down', value: '000', sources: [REG2], sample: true },
    { text: 'Sample stat: import shipments stopped at the border', value: '00', sources: [REG2], sample: true },
  ],
  vialTests: [
    vial('a', 11, 'pass'),
    vial('b', 22, 'pass'),
    vial('c', null, 'fail'),
    vial('d', 33, 'pass'),
    vial('e', 44, 'pass'),
    vial('f', 55, 'pass', LAB2),
    vial('g', 66, 'pass', LAB2),
    vial('h', 77, 'pass'),
    vial('i', null, 'fail', LAB2),
    vial('j', 88, 'pass'),
    vial('k', 99, 'pass', LAB2),
    vial('l', 111, 'pass'),
    vial('m', 122, 'pass', LAB2),
    vial('n', 133, 'pass'),
  ],
  takeaway: 'Sample text. Even when a vial does contain the drug, the amount can be far from the label. Purity, sterility and what else is in the liquid are also unknown.',
  sources: [LAB1, LAB2, REG2],
  sample: true,
};
