// PeptideScope: gray-market reality (independent vial tests, enforcement,
// contamination and sterility).
//
// Every object with `sources` traces to usable claims in research/claims.json
// through `ledger` (check: node tools/trace.mjs data/graymarket.js GRAY).
//
// vialTests[].pctOfLabel: measured amount as a % of what the label claims;
//   null means none of the labeled drug was found. Label amounts in mg are
//   deliberately left out: the UI only ever shows "% of the label".
// contamination[]: { id, title, text, sources, ledger } (needs a renderer
//   block in js/ui/graymarket.js; not rendered yet).

// Source ids (see data/sources.js)
const FDA_WL_INDEX = 'u-s-2026-fda-warning-letters-index';
const FDA_WL_LOVEGA = 'u-s-2026-warning-letter-lovega-llc';
const FDA_CONCERNS = 'u-s-2026-fda-s-concerns-unapproved';
const OPENFDA = 'u-s-2026-openfda-drug-adverse-event';
const OPENFDA_NOTE = 'u-s-2026-openfda-drug-adverse-event-2';
const PUBLIC_CITIZEN = 'public-citizen-2026-miracle-drug-peptide-craze';
const LILLY_RELEASE = 'eli-lilly-2026-lilly-calls-online-platforms';
const LILLY_FAQ = 'eli-lilly-2026-what-know-about-retatrutide';
const MHRA_RAID = 'medicines-healthcare-2025-mhra-smashes-major-illicit';
const MHRA_WARNING = 'medicines-healthcare-2026-no-summer-shortcut-safe';
const TGA_TEST = 'therapeutic-goods-2026-tga-tests-counterfeit-retatrutide';
const TGA_CMO = 'therapeutic-goods-2026-concerns-regarding-public-health';
const TGA_TOPIC = 'therapeutic-goods-2026-peptide-products-topic-page';
const VIC_ALERT = 'department-health-2026-toxicity-linked-unapproved-peptide-2';
const DAR_STUDY = 'wiley-drug-2026-composition-labelling-accuracy-products';
const JMIR_SEMA = 'journal-medical-2024-multifactor-quality-safety-analysis';
const FINNRICK = 'finnrick-2026-retatrutide-safety-testing-results';
const FINNRICK_METHOD = 'finnrick-2026-methodology';
const FINNRICK_UNDER = 'finnrick-2026-retatrutide-lab-test-certificate';
const FINNRICK_OVER = 'finnrick-2026-retatrutide-lab-test-certificate-2';

export const GRAY = {
  headline: 'With these products, you cannot know how much you are actually getting.',
  intro: 'Retatrutide is not approved by any medicine regulator. Yet online sellers offer vials of it, often labeled "for research purposes" or "not for human consumption". The FDA says those labels are false: the products are sold straight to ordinary people to use on themselves. Independent labs and regulators have tested what is actually inside. One testing company, Finnrick, has logged 4,367 tests of vials sold as retatrutide, from 378 sellers, since December 2024.',

  enforcement: [
    {
      id: 'fda-letters',
      value: '21',
      text: 'FDA warning letters that mention retatrutide, sent between December 2024 and August 2026 (FDA list, as of October 2026). A warning letter is an official notice that a company is breaking federal drug law. Of these, 19 went to companies selling or marketing it: 4 in December 2024, 6 in September 2025, 4 in March 2026 and 5 in August 2026.',
      sources: [FDA_WL_INDEX],
      ledger: ['gray-fda-letters-21-total'],
    },
    {
      id: 'public-citizen-letters',
      value: '14',
      text: 'FDA warning letters to retatrutide sellers, as counted by the consumer group Public Citizen in June 2026 (its count covers letters up to March 2026). It found the letters were not stopping sales: by May 2026, 8 of the 14 sellers were still selling retatrutide.',
      sources: [PUBLIC_CITIZEN],
      ledger: ['gray-fda-letters-14-public-citizen', 'gray-fda-letters-ignored-pc'],
    },
    {
      id: 'fda-reports',
      value: '44',
      text: 'Side-effect reports that mention retatrutide in the FDA\'s public database (data updated July 30, 2026). Of the 42 that did not come from medical studies, 16 involved a hospital stay and 6 were described as life-threatening. Reports rose fast: 12 in all of 2025, then 26 from January to May 2026. Anyone can send a report, and the FDA does not confirm that the drug caused the problem. These are warning signs, not proof.',
      sources: [OPENFDA, OPENFDA_NOTE],
      ledger: ['gray-openfda-tally', 'gray-faers-unverified'],
    },
    {
      id: 'lilly-lawsuits',
      value: '6',
      text: 'Lawsuits filed on August 12, 2026 by Eli Lilly, the company developing retatrutide, against US businesses it says were selling black-market versions. Lilly says it has also reported more than 200 people and businesses to the FDA, the Justice Department, state officials and licensing boards.',
      sources: [LILLY_RELEASE],
      ledger: ['gray-lilly-six-lawsuits', 'gray-lilly-referrals-200'],
    },
    {
      id: 'mhra-raid',
      value: '2,000+',
      text: 'Unlicensed retatrutide and tirzepatide pens seized in October 2025, when the UK medicines regulator (MHRA) raided the country\'s first known illegal weight-loss drug factory. It also found tens of thousands of empty pens waiting to be filled. The MHRA warns that these products have not been tested for safety or quality, and there is no guarantee they even contain retatrutide.',
      sources: [MHRA_RAID, MHRA_WARNING],
      ledger: ['gray-mhra-factory-raid', 'gray-core-mhra-no-guarantee'],
    },
    {
      id: 'tga-test',
      value: '8×',
      text: 'About 8 times the amount of semaglutide (a different weight-loss drug) found in approved semaglutide products the regulator has checked. Australia\'s medicines regulator (TGA) found this in a vial sold as retatrutide, after the person who used it vomited so hard that their food pipe tore and needed hospital care. The vial held no retatrutide at all. The TGA says any retatrutide from outside a clinical trial could be fake and should not be used.',
      sources: [TGA_TEST],
      ledger: [
        'gap-gray-contaminant-sterility-data-tga-semaglutide-instead',
        'gap-gray-contaminant-sterility-data-tga-semaglutide-8x',
        'gap-gray-contaminant-sterility-data-tga-torn-oesophagus',
        'claims-11-tga-trial-only',
      ],
    },
    {
      id: 'victoria-liver',
      value: '6',
      text: 'People in Victoria, Australia, with sudden liver damage since January 2026 after using unapproved products labeled retatrutide (also sold as Reta, R-10 or R-20), according to a state health alert on June 19, 2026. Officials think a contaminant may be involved and warn that all such products are at risk.',
      sources: [VIC_ALERT],
      ledger: [
        'gap-gray-contaminant-sterility-data-vic-six-liver-cases',
        'gap-gray-contaminant-sterility-data-vic-contaminant-suspected',
        'gap-gray-contaminant-sterility-data-vic-product-names',
      ],
    },
    {
      id: 'finnrick-identity',
      value: '31 of 194',
      text: 'Vials where the lab could not find the labeled drug at all, in the 200 most recent retatrutide tests (September 15–25, 2026) logged by Finnrick, an independent testing company. The other 6 tests were incomplete. In all, 63 of the 200 vials failed.',
      sources: [FINNRICK],
      ledger: ['gray-finnrick-recent-200'],
    },
    {
      id: 'finnrick-range',
      value: '−76% to +45%',
      text: 'How far the amount of drug was from the label, across the 163 vials in those same 200 Finnrick tests where the amount was measured: from 76% less than the label to 45% more. Two examples, both tested on September 23, 2026: one vial was 99.9% pure but held 76% less drug than its label said, and another was 99.9% pure but held 45% more. A pure vial can still hold the wrong amount.',
      sources: [FINNRICK, FINNRICK_UNDER, FINNRICK_OVER],
      ledger: ['gray-finnrick-recent-200', 'gray-finnrick-vial-underfill', 'gray-finnrick-vial-overfill'],
    },
  ],

  vialTests: [
    {
      id: 'tga',
      label: 'Australian regulator (TGA) test',
      pctOfLabel: null,
      identity: 'fail',
      note: 'No retatrutide found. The vial held a different weight-loss drug, semaglutide (the drug in Ozempic), at about 8 times the amount in approved semaglutide products the TGA has checked. The person who used it needed hospital care after vomiting tore their food pipe.',
      sources: [TGA_TEST],
      ledger: [
        'gap-gray-contaminant-sterility-data-tga-semaglutide-instead',
        'gap-gray-contaminant-sterility-data-tga-semaglutide-8x',
        'gap-gray-contaminant-sterility-data-tga-torn-oesophagus',
      ],
    },
    {
      id: 'a',
      label: 'Australian study, vial A',
      pctOfLabel: 51.3,
      identity: 'pass',
      note: 'Held about half the amount on the label. Lab tests confirmed it was real retatrutide: the problem was the amount, not a swapped drug. From a journal study that tested only three vials, so it may not reflect every product sold.',
      sources: [DAR_STUDY],
      ledger: [
        'gray-dar-per-vial',
        'gap-gray-contaminant-sterility-data-dar-identity-confirmed',
        'gap-gray-contaminant-sterility-data-dar-limits',
      ],
    },
    {
      id: 'b',
      label: 'Australian study, vial B',
      pctOfLabel: 165.0,
      identity: 'pass',
      note: 'Held about 1.65 times the amount on the label. Lab tests confirmed it was real retatrutide.',
      sources: [DAR_STUDY],
      ledger: ['gray-dar-per-vial', 'gap-gray-contaminant-sterility-data-dar-identity-confirmed'],
    },
    {
      id: 'c',
      label: 'Australian study, vial C',
      pctOfLabel: 190.0,
      identity: 'pass',
      note: 'Held almost double the amount on the label (1.9 times). Lab tests confirmed it was real retatrutide.',
      sources: [DAR_STUDY],
      ledger: ['gray-dar-per-vial', 'gap-gray-contaminant-sterility-data-dar-dose-content', 'gap-gray-contaminant-sterility-data-dar-identity-confirmed'],
    },
  ],

  contamination: [
    {
      id: 'not-tested',
      title: 'Germs and bacterial toxins are mostly not tested',
      text: 'Most lab tests of these vials do not check for endotoxin, a toxin left behind by bacteria that can cause dangerous reactions when injected. Finnrick\'s public results have no column for sterility (being free of germs) or endotoxin; those are optional extra tests. The journal study of three Australian vials did not test for either, and no peer-reviewed study has yet published germ or endotoxin results for black-market retatrutide. So a "pass" or a high purity result does not mean a vial is clean.',
      sources: [FINNRICK_METHOD, FINNRICK, DAR_STUDY],
      ledger: [
        'gray-finnrick-endotoxin-not-required',
        'gap-gray-contaminant-sterility-data-finnrick-public-table-columns',
        'gap-gray-contaminant-sterility-data-dar-sterility-endotoxin-not-tested',
      ],
    },
    {
      id: 'semaglutide-study',
      title: 'Online semaglutide vials: endotoxin in every one',
      text: 'A peer-reviewed study bought three "research use only" semaglutide vials (the drug in Ozempic) from online sellers that asked for no prescription. All three contained endotoxin, a toxin left behind by bacteria, even though no live germs were found. The drug made up only about 8% to 14% of what was in each vial, though the labels claimed 99% purity. Each vial also held about 29% to 39% more drug than its label said. This study tested semaglutide, not retatrutide.',
      sources: [JMIR_SEMA],
      ledger: ['gray-jmir-sema-endotoxin', 'gray-jmir-sema-purity', 'gray-jmir-sema-quantity'],
    },
    {
      id: 'sterility-unknown',
      title: 'Nobody knows if these injections are sterile',
      text: 'Australia\'s medicines regulator (TGA) says it is unknown whether these injectable products are sterile or made in germ-free conditions, and there is no assurance they are correctly labeled. It warns that dirty or non-sterile manufacturing can cause infections and harmful immune reactions, including anaphylaxis (a sudden, severe allergic reaction).',
      sources: [TGA_CMO, TGA_TEST, TGA_TOPIC],
      ledger: [
        'gap-gray-contaminant-sterility-data-tga-sterility-unknown',
        'gap-gray-contaminant-sterility-data-tga-nonsterile-infection-anaphylaxis',
        'gap-gray-contaminant-sterility-data-tga-no-assurance-sterile',
      ],
    },
    {
      id: 'injection-bypass',
      title: 'Injecting skips some of the body\'s defenses',
      text: 'The FDA warns that injected products skip some of the body\'s key defenses against germs and toxins. Anything dirty inside a vial goes straight in, and that can lead to serious, even life-threatening illness.',
      sources: [FDA_WL_LOVEGA],
      ledger: ['gray-fda-injectable-danger'],
    },
    {
      id: 'liver-cluster',
      title: 'Liver damage in Victoria: a contaminant is suspected',
      text: 'In the Victorian liver cases, the way patients got sick made doctors suspect that other harmful substances in the vials may be adding to the liver damage. Testing of the vials\' contents was still going on when the alert came out. As of early October 2026, the alert had not been updated since June 19, 2026, and does not say what the contaminant might be. Australia\'s medicines regulator had not published lab results on vials linked to these cases, and no medical journal had yet reported on them.',
      sources: [VIC_ALERT, TGA_TOPIC, DAR_STUDY],
      ledger: [
        'gap-gray-contaminant-sterility-data-vic-clinical-pattern-contaminants',
        'gap-gray-contaminant-sterility-data-vic-alert-not-updated',
        'gap-gray-contaminant-sterility-data-tga-no-cluster-test-published',
        'gap-gray-contaminant-sterility-data-no-published-case-series',
      ],
    },
    {
      id: 'metals',
      title: 'Toxic metals: checked in only three vials',
      text: 'The Australian journal study also tested its three vials for toxic metals. No arsenic, cadmium, chromium, nickel or mercury was found above the level the lab could measure. A trace of lead was found: the amount in a whole vial was about 0.14% of the daily exposure limit used for injected medicines. Metals are only one kind of contaminant: germs and bacterial toxins were not tested, and three vials may not reflect every product sold.',
      sources: [DAR_STUDY],
      ledger: [
        'gap-gray-contaminant-sterility-data-dar-heavy-metals-not-detected',
        'gap-gray-contaminant-sterility-data-dar-lead-trace',
        'gap-gray-contaminant-sterility-data-dar-sterility-endotoxin-not-tested',
        'gap-gray-contaminant-sterility-data-dar-limits',
      ],
    },
  ],

  takeaway: 'Even when a vial holds the right drug, the amount can be far from the label, so a person may get much less or much more than they think. Most lab tests never check for endotoxin, a toxin from bacteria. The drug\'s own maker warns that illegal versions may contain harmful contaminants or the wrong drug entirely. The FDA urges people not to buy these products: their quality is unknown, and they may harm your health.',

  // Root citations cover the headline, intro and takeaway.
  sources: [LILLY_FAQ, FDA_CONCERNS, FINNRICK, DAR_STUDY, FINNRICK_METHOD],
  ledger: [
    'pk-regulatory-not-approved-lilly',
    'gray-fda-ruo-falsely-labeled',
    'gray-finnrick-scale',
    'gray-core-fda-online-contents',
    'gray-dar-per-vial',
    'gray-dar-unknowing-dose',
    'gray-finnrick-endotoxin-not-required',
    'gray-core-lilly-faq-contents',
    'gray-core-fda-unknown-quality',
  ],
};
