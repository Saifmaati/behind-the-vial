// Behind the Vial: source registry.
//
// SAMPLE FILE. Every entry below is a schema-complete placeholder (sample: true)
// so the UI can be built and tested before the verified research lands. The
// research pass REPLACES this whole file with real, checked sources.
// tests/data.test.mjs fails while any sample remains (unless BTV_ALLOW_SAMPLES=1).
//
// Shape: { title, publisher, url, date, type, note?, unverified? }
//   type: journal | regulator | label | company | trial-registry | nonprofit |
//         testing-lab | news | health-service
//   date: 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD' (placeholders use 0000)
//   unverified: true → listed under "Not yet confirmed"

const S = (type, n, title, publisher, extra = {}) => ({
  title: `Sample ${title} (placeholder ${n})`,
  publisher: `Sample ${publisher}`,
  url: `https://example.org/sample/${type}-${n}`,
  date: '0000-00-00',
  type,
  sample: true,
  ...extra,
});

export const SOURCES = {
  'sample-journal-1': S('journal', 1, 'phase 2 trial report', 'Medical Journal'),
  'sample-journal-2': S('journal', 2, 'phase 3 trial report', 'Medical Journal'),
  'sample-journal-3': S('journal', 3, 'pharmacology study', 'Clinical Pharmacology Journal'),
  'sample-journal-4': S('journal', 4, 'review article on receptor biology', 'Review Journal'),
  'sample-journal-5': S('journal', 5, 'animal study', 'Laboratory Science Journal'),
  'sample-regulator-1': S('regulator', 1, 'drug safety communication', 'Drug Regulator'),
  'sample-regulator-2': S('regulator', 2, 'warning letter summary', 'Drug Regulator'),
  'sample-label-1': S('label', 1, 'prescribing information for a related approved medicine', 'Drug Label Database'),
  'sample-company-1': S('company', 1, 'trial results press release', 'Drug Developer'),
  'sample-registry-1': S('trial-registry', 1, 'trial registration record', 'Trial Registry'),
  'sample-nonprofit-1': S('nonprofit', 1, 'consumer safety report', 'Consumer Health Nonprofit'),
  'sample-lab-1': S('testing-lab', 1, 'independent vial test results', 'Independent Testing Lab'),
  'sample-lab-2': S('testing-lab', 2, 'second independent vial test batch', 'Independent Testing Lab'),
  'sample-health-1': S('health-service', 1, 'patient information page', 'National Health Service'),
  'sample-news-1': S('news', 1, 'news report on online peptide sales', 'News Outlet', {
    unverified: true,
    note: 'Sample note: could not be matched to a primary source yet.',
  }),
};

export const SOURCE_TYPES = ['journal', 'regulator', 'label', 'company', 'trial-registry', 'nonprofit', 'testing-lab', 'news', 'health-service'];
