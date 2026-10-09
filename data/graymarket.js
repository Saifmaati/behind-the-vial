// PeptideScope: gray-market reality (independent vial tests, enforcement,
// harm reports, contamination and sterility).
//
// Every object with `sources` traces to usable claims in research/claims.json
// through `ledger` (check: node tools/trace.mjs data/graymarket.js GRAY).
//
// vialTests[].pctOfLabel: measured amount as a % of what the label claims;
//   null means none of the labeled drug was found. Label amounts in mg are
//   deliberately left out: the UI only ever shows "% of the label".
//   The study vials are numbered as in the paper (its samples 1, 2 and 3).
// contamination[]: { id, title, text, sources, ledger }, rendered as cards by
//   js/ui/graymarket.js.
// Wording: neutral, never commercial (tests/commerce.test.mjs), and no citation
//   of a source whose title or URL names a seller (docs/decisions/data-wording.md).

// Source ids (see data/sources.js)
const FDA_WL_INDEX = 'u-s-2026-fda-warning-letters-index';
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
const BMJ_CASE = 'bmj-case-2026-emerging-risks-health-optimisation';
const CUREUS_CASE = 'cureus-springer-2026-online-sourced-retatrutide-complicating';
const DAR_STUDY = 'wiley-drug-2026-composition-labelling-accuracy-products';
const JMIR_SEMA = 'journal-medical-2024-multifactor-quality-safety-analysis';
const FINNRICK = 'finnrick-2026-retatrutide-safety-testing-results';
const FINNRICK_METHOD = 'finnrick-2026-methodology';

export const GRAY = {
  headline: 'With these products, you cannot know how much you are actually getting.',
  intro: 'Retatrutide is not approved by any medicine regulator. Yet companies sell it labeled "for research purposes" or "not for human consumption". The FDA says those labels are false: the products are sold directly to ordinary people to use on themselves. The consumer group Public Citizen found that these sellers also use social media influencers as sales partners. One independent testing company, Finnrick, has logged 4,367 tests of vials sold as retatrutide, from 378 sellers, since December 2024.',

  enforcement: [
    // United States: regulator, watchdog, prosecutors and the developer
    {
      id: 'fda-letters',
      value: '21',
      text: 'FDA warning letters that mention retatrutide, sent between December 2024 and August 2026 (FDA list, as of October 2026). A warning letter is an official notice telling a company that it is breaking federal drug law. Of these, 19 went to companies selling or marketing it: 4 in December 2024, 6 in September 2025, 4 in March 2026 and 5 in August 2026. The other 2 went to a company that distributed the raw ingredient and a company that repackaged drugs.',
      sources: [FDA_WL_INDEX],
      ledger: ['gray-fda-letters-21-total'],
    },
    {
      id: 'public-citizen-letters',
      value: '14',
      text: 'FDA warning letters to retatrutide sellers, as counted by the consumer group Public Citizen in its June 2026 report. It said the warnings were not stopping sales: by May 2026, 11 of the 14 sellers still advertised retatrutide or other unapproved peptide drugs, and 8 were still selling retatrutide itself. The FDA sent 5 more letters to sellers in August 2026, after this count.',
      sources: [PUBLIC_CITIZEN, FDA_WL_INDEX],
      ledger: ['gray-fda-letters-14-public-citizen', 'gray-fda-letters-ignored-pc', 'gray-fda-letters-21-total'],
    },
    {
      id: 'no-compounding',
      value: 'None approved',
      text: 'There is no FDA-approved version of retatrutide, and US law does not allow pharmacies to "compound" (custom-mix) it. The FDA says it is not part of any approved medicine and has not been found safe and effective for any condition.',
      sources: [FDA_CONCERNS],
      ledger: ['gray-fda-cannot-compound'],
    },
    {
      id: 'pc-companies',
      value: '100+',
      text: 'Companies that appear to be selling retatrutide openly, according to Public Citizen\'s June 2026 report. It said the FDA had mostly sent only warning letters. In February 2026 the government charged a Florida man with selling retatrutide. A charge is an accusation, not proof of guilt.',
      sources: [PUBLIC_CITIZEN],
      ledger: ['gray-pc-100-companies'],
    },
    {
      id: 'lilly-lawsuits',
      value: '6',
      text: 'Lawsuits filed on August 12, 2026 by Eli Lilly, the company developing retatrutide, against US businesses it says were selling black-market versions. They include pharmacies, med spas and online sellers that Lilly says falsely call their products "research use only". Lilly also says it has reported more than 200 people and businesses to regulators, law enforcement and licensing boards, and more than 14,000 websites, ads, social media posts and listings in over 100 countries. These are Lilly\'s accusations, not court rulings.',
      sources: [LILLY_RELEASE],
      ledger: ['gray-lilly-six-lawsuits', 'gray-lilly-ruo-allegation', 'gray-lilly-referrals-200', 'gray-lilly-14000-listings'],
    },
    // United Kingdom
    {
      id: 'mhra-raid',
      value: '2,000+',
      text: 'Unlicensed retatrutide and tirzepatide (another weight-loss drug) pens seized in October 2025, when the UK medicines regulator (MHRA) raided the country\'s first known illegal weight-loss drug factory. It also found tens of thousands of empty pens waiting to be filled. In July 2026 the MHRA warned that anyone selling retatrutide in the UK is doing so illegally, that these products have not been tested for safety, quality or effectiveness, and that there is no guarantee they even contain retatrutide.',
      sources: [MHRA_RAID, MHRA_WARNING],
      ledger: ['gray-mhra-factory-raid', 'gray-core-mhra-no-guarantee'],
    },
    // Reports of harm
    {
      id: 'fda-reports',
      value: '44',
      text: 'Side-effect reports that mention retatrutide in the FDA\'s public database (data updated July 30, 2026). Leaving out 2 reports from medical studies, 16 of the other 42 involved a hospital stay and 6 were described as life-threatening. Reports rose fast: 26 came in from January to May 2026 alone, more than in all of 2025. Anyone can send a report, and the FDA does not confirm that the drug caused the problem. These are warning signs, not proof.',
      sources: [OPENFDA, OPENFDA_NOTE, PUBLIC_CITIZEN],
      ledger: ['gray-openfda-tally', 'gray-faers-unverified', 'gray-pc-ae-2026'],
    },
    {
      id: 'case-reports',
      value: 'Case reports',
      text: 'Doctors have published reports on single patients who got seriously ill after using products sold as retatrutide. In Switzerland, a woman in her mid-20s was hospitalized with nausea and vomiting that standard medicines could not stop, after a "life coach" with no medical training injected her with an unverified product; her doctors judged it a probable cause. In Scotland, a man with type 1 diabetes got vomiting, dangerous ketone levels (a buildup of acids in the blood) and kidney injury soon after using a product sold online. He also had a gut infection, so doctors could not be sure how much the product caused.',
      sources: [BMJ_CASE, CUREUS_CASE],
      ledger: ['gray-case-bmj-nausea', 'gray-case-cureus-t1d'],
    },
    // Australia
    {
      id: 'tga-test',
      value: '8×',
      text: 'About 8 times the amount of semaglutide (a different weight-loss drug) found in approved semaglutide products the regulator has checked. Australia\'s medicines regulator (TGA) found this in a vial sold as retatrutide. The vial held no retatrutide at all. The person who used it vomited so hard that their food pipe tore, and they needed hospital care. The TGA says any retatrutide from outside a clinical trial could be fake and should not be used.',
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
      text: 'People in Victoria, Australia, who got sudden liver damage after using an unapproved product labeled retatrutide, since January 2026 (state health alert, June 19, 2026). Officials say a contaminant may be involved and warn that all products sold under this name are at risk. The alert covers products labeled Retatrutide, Reta, R-10 or R-20, which people got online, through friends or through social media accounts.',
      sources: [VIC_ALERT],
      ledger: [
        'gap-gray-contaminant-sterility-data-vic-six-liver-cases',
        'gap-gray-contaminant-sterility-data-vic-contaminant-suspected',
        'gap-gray-contaminant-sterility-data-vic-product-names',
      ],
    },
    // Independent vial testing
    {
      id: 'finnrick-identity',
      value: '31 of 194',
      text: 'Vials where the lab could not find the labeled drug at all. These come from the 200 most recent retatrutide tests (September 15–25, 2026) logged by Finnrick, an independent testing company; 6 of the 200 were incomplete. In all, 63 of the 200 vials failed Finnrick\'s quality checks. Vials come from sellers and from people who mail them in for testing, so they are not a random sample of what is sold.',
      sources: [FINNRICK],
      ledger: ['gray-finnrick-recent-200', 'gray-finnrick-scale'],
    },
    {
      id: 'finnrick-range',
      value: '−76% to +45%',
      text: 'How far the amount of drug was from the label, in the 163 of those vials where it was measured: from 76% less than the label to 45% more. More than half (98 of the 163) were within 10% of the label either way. So even a vial that holds the right drug can hold much less or much more than its label says.',
      sources: [FINNRICK],
      ledger: ['gray-finnrick-recent-200'],
    },
  ],

  vialTests: [
    {
      id: 'tga',
      label: 'Australian regulator (TGA) test',
      pctOfLabel: null,
      identity: 'fail',
      note: 'No retatrutide found. The vial held a different weight-loss drug, semaglutide (the drug in Ozempic), at about 8 times the amount in approved semaglutide products the TGA has checked. The person who used it vomited so hard that their food pipe tore, and they needed hospital care.',
      sources: [TGA_TEST],
      ledger: [
        'gap-gray-contaminant-sterility-data-tga-semaglutide-instead',
        'gap-gray-contaminant-sterility-data-tga-semaglutide-8x',
        'gap-gray-contaminant-sterility-data-tga-torn-oesophagus',
      ],
    },
    {
      id: 's1',
      label: 'Australian study, vial 1',
      pctOfLabel: 51.3,
      identity: 'pass',
      note: 'Held about half the amount on its label. Lab tests found retatrutide in it (the molecule\'s weight matched the real drug), so the problem was the amount, not a swapped drug. A match like this cannot rule out other substances in the vial. From a journal study that tested only three vials, which may not reflect every product sold.',
      sources: [DAR_STUDY],
      ledger: [
        'gray-dar-per-vial',
        'gap-gray-contaminant-sterility-data-dar-identity-confirmed',
        'gap-gray-contaminant-sterility-data-dar-limits',
      ],
    },
    {
      id: 's3',
      label: 'Australian study, vial 3',
      pctOfLabel: 165.0,
      identity: 'pass',
      note: 'Held about 1.65 times the amount on its label. Lab tests found retatrutide in it.',
      sources: [DAR_STUDY],
      ledger: ['gray-dar-per-vial', 'gap-gray-contaminant-sterility-data-dar-identity-confirmed'],
    },
    {
      id: 's2',
      label: 'Australian study, vial 2',
      pctOfLabel: 190.0,
      identity: 'pass',
      note: 'Held almost double the amount on its label (1.9 times). Lab tests found retatrutide in it.',
      sources: [DAR_STUDY],
      ledger: ['gray-dar-per-vial', 'gap-gray-contaminant-sterility-data-dar-dose-content', 'gap-gray-contaminant-sterility-data-dar-identity-confirmed'],
    },
  ],

  contamination: [
    {
      id: 'not-tested',
      title: 'Germs and bacterial toxins are mostly not tested',
      text: 'Most lab test panels for these vials do not check for endotoxin, a toxin left behind by bacteria. Finnrick\'s public results table has no column for sterility (being free of germs) or endotoxin; those are optional add-on tests. The Australian journal study did not test for either. No peer-reviewed study has yet published sterility or endotoxin results for gray-market retatrutide. So a "pass" does not mean a vial is clean.',
      sources: [FINNRICK_METHOD, FINNRICK, DAR_STUDY],
      ledger: [
        'gray-finnrick-endotoxin-not-required',
        'gap-gray-contaminant-sterility-data-finnrick-public-table-columns',
        'gap-gray-contaminant-sterility-data-dar-sterility-endotoxin-not-tested',
      ],
    },
    {
      id: 'semaglutide-study',
      title: 'Online semaglutide vials: endotoxin reported in all three',
      text: 'A peer-reviewed study tested three "research use only" vials of semaglutide (the drug in Ozempic) from online sellers that asked for no prescription. It reports that endotoxin, a toxin left behind by bacteria, was found in all three, even though no live germs were found. For two of the three, the paper gives only an upper limit, so the amount there may have been very small. Each vial held about 29% to 39% more drug than its label said. Yet the drug made up only about 8% to 14% of what was in each vial, though the labels claimed 99% purity. This study tested semaglutide, not retatrutide.',
      sources: [JMIR_SEMA],
      ledger: ['gray-jmir-sema-endotoxin', 'gray-jmir-sema-purity', 'gray-jmir-sema-quantity'],
    },
    {
      id: 'sterility-unknown',
      title: 'Nobody knows if these injections are sterile',
      text: 'Australia\'s medicines regulator (TGA) says it is unknown whether unapproved injectable peptides are sterile or made in germ-free conditions, and that there is no assurance they are safe, correctly labeled or sterile. It warns that contaminated or non-sterile manufacturing can raise the risk of infection and harmful immune reactions, including anaphylaxis (a sudden, severe allergic reaction). The TGA and Australia\'s Chief Medical Officer say reports and hospital data have linked unapproved peptides in general to serious harms, including liver damage and severe allergic reactions.',
      sources: [TGA_CMO, TGA_TEST, TGA_TOPIC],
      ledger: [
        'gap-gray-contaminant-sterility-data-tga-sterility-unknown',
        'gap-gray-contaminant-sterility-data-tga-no-assurance-sterile',
        'gap-gray-contaminant-sterility-data-tga-nonsterile-infection-anaphylaxis',
        'gap-gray-contaminant-sterility-data-tga-harms-reported',
      ],
    },
    {
      id: 'liver-cluster',
      title: 'Liver damage in Victoria: a contaminant is suspected',
      text: 'In the Victorian liver cases, the way patients got sick made doctors suspect that other harmful substances in the vials may be adding to the liver damage. Blood tests showed signs of damaged liver cells. Testing of the vials\' contents was still going on when the alert came out. As of early October 2026, the alert had not been updated since June 19, 2026, and does not say what the contaminant might be. Australia\'s medicines regulator had not published lab results on vials linked to these cases, and no medical journal had reported on them.',
      sources: [VIC_ALERT, TGA_TOPIC, DAR_STUDY],
      ledger: [
        'gap-gray-contaminant-sterility-data-vic-clinical-pattern-contaminants',
        'gap-gray-contaminant-sterility-data-vic-blood-test-findings',
        'gap-gray-contaminant-sterility-data-vic-alert-not-updated',
        'gap-gray-contaminant-sterility-data-tga-no-cluster-test-published',
        'gap-gray-contaminant-sterility-data-no-published-case-series',
      ],
    },
    {
      id: 'metals',
      title: 'Toxic metals: one small study',
      text: 'The Australian journal study also checked for toxic metals. It found no arsenic, cadmium, chromium, nickel or mercury above the level the lab could measure. It found a trace of lead, just above that level, which the authors say was far below the limit used for injected medicines. Small amounts of copper and zinc were also found, at levels the authors call low. Metals are only one kind of contaminant: this study did not test for germs or bacterial toxins, and three vials may not reflect every product sold.',
      sources: [DAR_STUDY],
      ledger: [
        'gap-gray-contaminant-sterility-data-dar-heavy-metals-not-detected',
        'gap-gray-contaminant-sterility-data-dar-lead-trace',
        'gap-gray-contaminant-sterility-data-dar-copper-zinc',
        'gap-gray-contaminant-sterility-data-dar-sterility-endotoxin-not-tested',
        'gap-gray-contaminant-sterility-data-dar-limits',
      ],
    },
  ],

  takeaway: 'Even when a vial holds the right drug, the amount can be far from the label, so a person may get much less or much more than they think. Most lab test panels never check for endotoxin, a toxin from bacteria. Eli Lilly, the company developing retatrutide, warns that illegal versions may contain harmful contaminants or a different drug entirely. The FDA warns that these products are of unknown quality and may harm your health.',

  // Root citations cover the headline, intro and takeaway.
  sources: [LILLY_FAQ, FDA_CONCERNS, PUBLIC_CITIZEN, FINNRICK, DAR_STUDY, FINNRICK_METHOD],
  ledger: [
    'pk-regulatory-not-approved-lilly',
    'gray-fda-ruo-falsely-labeled',
    'gray-pc-ruo-disclaimer',
    'gray-finnrick-scale',
    'gray-core-fda-online-contents',
    'gray-dar-per-vial',
    'gray-dar-unknowing-dose',
    'gray-finnrick-endotoxin-not-required',
    'gray-core-lilly-faq-contents',
    'gray-core-fda-unknown-quality',
  ],
};
