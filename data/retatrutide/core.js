// PeptideScope: retatrutide core facts (status, what it is, how it works,
// where it acts, timing after a shot, and how it gets from under the skin
// into the blood).
//
// Every text object cites `sources` and lists the fact-checked ledger claims
// it is based on (`ledger`, ids in research/claims.json). Check with:
//   node tools/trace.mjs data/retatrutide/core.js
//
// Education only. Nothing here is a dose, an amount, a schedule or an
// instruction. Trial dose groups appear only as labels on fixed trial facts.
// `tDays` and `intervalDays` are model fields for the timeline (js/pk.js).

// ---- source ids (data/sources.js) ----
const NEJM_PH2 = 'new-england-2023-triple-hormone-receptor-agonist';
const NEJM_T1 = 'new-england-2026-retatrutide-triple-hormone-receptor-2';
const NEJM_T1_MAIN = 'new-england-2026-retatrutide-triple-hormone-receptor-3';
const NEJM_T1_APP = 'new-england-2026-supplementary-appendix-retatrutide-triple';
const LANCET_T2 = 'lancet-via-2026-retatrutide-adults-obesity-type';
const LILLY_T3 = 'eli-lilly-2026-lilly-s-triple-agonist-3';
const WILEY_USERS = 'john-wiley-2026-detection-excretion-profile-retatrutide';
const DOM_PH3 = 'diabetes-obesity-2025-retatrutide-treatment-obesity-obstruct';
const DOM_GE = 'diabetes-obesity-2023-novel-gip-glp-1';
const CELL_SAD = 'cell-metabolism-2022-ly3437943-novel-triple-glucagon-2';
const CELL_MICE = 'cell-metabolism-2022-ly3437943-novel-triple-glucagon';
const LANCET_MAD = 'lancet-elsevier-2022-ly3437943-novel-triple-gip';
const LANCET_MAD_2 = 'lancet-elsevier-2022-ly3437943-novel-triple-gip-2';
const LANCET_MAD_APP = 'lancet-elsevier-2022-supplementary-appendix-urva-et';
const BIOMOL = 'biomolecules-mdpi-2025-retatrutide-a-game-changer';
const NATMED = 'nature-medicine-2024-triple-hormone-receptor-agonist';
const MOLMET = 'molecular-metabolism-2019-glucagon-like-peptide-1';
const ENDOJ = 'endocrine-journal-2025-physiology-clinical-applications-gip';
const PHARMRES = 'pharmacological-research-2025-iuphar-review-foe-friend';
const DIABETOLOGIA = 'diabetologia-springer-2023-100-years-glucagon-100';
const JCI = 'jci-insight-2020-semaglutide-lowers-body-weight';
const NAUNYN = 'naunyn-schmiedeberg-2025-contractile-effects-retatrutide-iso';
const AAPS = 'aaps-journal-2012-mechanistic-determinants-biotherapeutics-a';
const EJPB = 'european-journal-2024-lymphatic-uptake-lipidated-non';
const FRONT_LIRA = 'frontiers-endocrinology-2019-discovery-development-liragluti';
const LILLY_FAQ = 'eli-lilly-2026-what-know-about-retatrutide';
const LILLY_BLA = 'eli-lilly-2026-lilly-s-triple-agonist-2';
const TGA = 'therapeutic-goods-2026-tga-tests-counterfeit-retatrutide';
const FDA = 'u-s-2026-fda-s-concerns-unapproved';
const CTG_ACCESS = 'clinicaltrials-gov-2026-clinicaltrials-gov-nct07629401-pre';
const CTG_SITES = 'clinicaltrials-gov-2024-clinicaltrials-gov-nct05959096-effec';
const CTG_ADME = 'clinicaltrials-gov-2023-clinicaltrials-gov-nct05757531-dispo';
const ZEP_LABEL = 'eli-lilly-2026-zepbound-tirzepatide-injection-prescribing';
const WEGOVY_LABEL = 'novo-nordisk-2026-wegovy-semaglutide-prescribing-information';
const WEGOVY = 'novo-nordisk-2026-wegovy-semaglutide-injection';

const G = 'gap-pk-peak-and-steady-state-primary-';
const P3 = 'gap-phase3-serious-ae-rates-and-heart-rate-';

export default {
  id: 'retatrutide',
  name: 'Retatrutide',
  aka: ['LY3437943'],
  developer: 'Eli Lilly',
  // fix (safety review): no frequency here; the trial-context sentence in what[] carries the schedule fact.
  route: 'A shot under the skin, in clinical trials',

  status: {
    level: 'in-trials',
    label: 'Investigational: not approved anywhere',
    detail: 'Retatrutide is still being tested in human trials. No medicine regulator has approved it, including the US FDA and Australia\'s TGA. The FDA says it has not been found safe and effective for any condition. It also says pharmacies cannot legally make their own versions of it (this is called compounding). Lilly says it is legally available only through its clinical trials. Australia\'s regulator warns that any retatrutide sold outside a trial could be fake. Lilly also lists a narrow program where a doctor can ask for it for one specific adult with severe obesity and serious complications who cannot join a trial. That is not an approval, and not a way for the public to get it. Lilly says it plans to ask the FDA for approval in the first three months of 2027. That is only a request: the FDA reviews it after that.',
    sources: [TGA, LILLY_FAQ, FDA, CTG_ACCESS, LILLY_BLA],
    ledger: ['pk-regulatory-not-approved-tga', 'pk-regulatory-not-approved-lilly', 'pk-regulatory-fda-no-compounding', 'pk-regulatory-expanded-access', 'pk-regulatory-submission-timing'],
  },

  what: [
    {
      text: 'Retatrutide is an experimental medicine made by the drug company Eli Lilly. In early research it was called LY3437943. It is a peptide: a chain of 39 amino acids (the building blocks of proteins), built on the pattern of the gut hormone GIP, with a fatty-acid tail attached.',
      sources: [NEJM_PH2, WILEY_USERS],
      ledger: ['pk-identity-developer-code', 'pk-structure-39-amino-acids-c20'],
    },
    {
      text: 'One molecule acts on three hormone "locks" (receptors) at once: GIP, GLP-1 and glucagon. Lilly calls it a "triple agonist", which means it switches on all three. In lab tests it was about 9 times stronger than the body\'s own GIP, and weaker than the body\'s own GLP-1 and glucagon.',
      sources: [NEJM_PH2, LILLY_FAQ],
      ledger: ['pk-identity-developer-code', 'pk-identity-lilly-description', 'pk-receptor-relative-potency'],
    },
    {
      text: 'In Lilly\'s large phase 3 trials, it is given once a week as a shot into the fatty layer just under the skin. These trials included adults with obesity or overweight, among them people with type 2 diabetes and people who already had heart or blood-vessel disease.',
      sources: [DOM_PH3, NEJM_T1, LANCET_T2, LILLY_T3],
      ledger: ['pk-route-once-weekly-subcutaneous', 'trials-triumph1-enrolled', 'trials-triumph2-design', 'trials-triumph3-design'],
    },
  ],

  how: [
    {
      receptor: 'GLP-1',
      organs: ['brain', 'pancreas', 'stomach', 'heart'],
      effect: 'Helps the pancreas release insulin, more so when blood sugar is high. Slows how fast the stomach empties and reduces how much people eat. In the brain, this receptor is found in the hypothalamus, an area that helps control hunger. Among heart muscle cells, it was found only in the heart\'s natural pacemaker (in monkey and human tissue). In lab tests, retatrutide is weaker here than the body\'s own GLP-1 (about 0.4 times as strong).',
      sources: [MOLMET, NEJM_PH2],
      ledger: ['pk-receptor-glp1-actions', 'pk-receptor-glp1r-pancreas', 'pk-receptor-glp1r-brain', 'pk-receptor-glp1r-stomach-not-liver', 'pk-receptor-glp1r-heart', 'pk-receptor-relative-potency'],
    },
    {
      receptor: 'GIP',
      organs: ['pancreas', 'brain', 'fat'],
      effect: 'Boosts insulin release from the pancreas. In mice, switching on nerve cells with GIP receptors in the hypothalamus (a brain area that controls hunger) made them eat less. Scientists are still working out how GIP affects appetite. In lab studies of human fat cells and mice, it helped fat tissue store fuel after meals; this has not been shown directly in people. In lab tests, retatrutide is about 9 times stronger here than the body\'s own GIP.',
      sources: [ENDOJ, NEJM_PH2],
      ledger: ['pk-receptor-gipr-beta-cells', 'pk-receptor-gipr-appetite-brain', 'pk-receptor-gipr-fat-tissue', 'pk-receptor-relative-potency'],
    },
    {
      receptor: 'Glucagon',
      organs: ['liver', 'heart'],
      effect: 'In rats, this receptor is found mostly in the liver. Switching it on pushes liver cells to burn fat and make less new fat; most of this evidence comes from animal and lab studies. In obese mice, retatrutide\'s glucagon part also raised the number of calories the body burns. Results on this in people have not been published. In mouse heart tissue, retatrutide sped up the heart\'s pacemaker region through this receptor. In lab tests, retatrutide is weaker here than the body\'s own glucagon (about 0.3 times as strong).',
      sources: [PHARMRES, CELL_MICE, NAUNYN, NEJM_PH2],
      ledger: ['pk-receptor-gcgr-liver-highest', 'pk-receptor-gcgr-liver-fat-burning', 'pk-receptor-gcgr-energy-expenditure-mice', 'pk-heart-rate-mechanism-mouse', 'pk-receptor-relative-potency'],
    },
  ],

  // Organs the drug acts on (drive the 3D distribution animation).
  targets: [
    {
      organ: 'brain',
      receptors: ['GLP-1', 'GIP'],
      effect: 'Eating less. In monkeys, GLP-1 receptors were strongest in the hypothalamus, a brain area that helps control hunger, and in the hindbrain. Signs of them have also been found in the human hypothalamus. Switching on GLP-1 receptors reduces how much people eat. In mice, switching on nerve cells with GIP receptors in the hypothalamus made them eat less too.',
      sources: [MOLMET, ENDOJ],
      ledger: ['pk-receptor-glp1r-brain', 'pk-receptor-glp1-actions', 'pk-receptor-gipr-appetite-brain'],
    },
    {
      organ: 'pancreas',
      receptors: ['GLP-1', 'GIP'],
      effect: 'More insulin, more so when blood sugar is high. Both receptors sit on the insulin-making beta cells of the pancreas.',
      sources: [MOLMET, ENDOJ],
      ledger: ['pk-receptor-glp1r-pancreas', 'pk-receptor-glp1-actions', 'pk-receptor-gipr-beta-cells'],
    },
    {
      organ: 'stomach',
      receptors: ['GLP-1'],
      effect: 'Slower emptying. GLP-1 receptors are found at low levels in the stomach, and switching them on slows how fast it empties. Glucagon has been shown to slow it too, in rodents and people; GIP does not seem to. In an early retatrutide study, the slowing was greatest after the first shot (checked about 24 hours later) and became weaker with later shots.',
      sources: [MOLMET, DOM_GE],
      ledger: ['pk-receptor-glp1r-stomach-not-liver', 'pk-receptor-glp1-actions', 'pk-gastric-emptying-which-receptors', 'pk-onset-gastric-emptying-first-dose', 'pk-gastric-emptying-fades'],
    },
    {
      organ: 'liver',
      receptors: ['Glucagon'],
      effect: 'More fat burning. Glucagon receptors are found mostly in the liver (shown in rats). Switching them on makes liver cells burn fat and make less new fat; this comes mostly from animal and lab studies. In the phase 2 obesity trial, a blood marker of fat burning rose 2 to 3 times in the 4 mg and higher groups, which fits this idea. In people with fatty liver in that trial, liver fat fell after 24 weeks by about 43% in the 1 mg group and about 82% in the 12 mg group, versus almost no change on placebo. The researchers said this may come from the weight loss, from glucagon acting on the liver, or both.',
      sources: [PHARMRES, NATMED],
      ledger: ['pk-receptor-gcgr-liver-highest', 'pk-receptor-gcgr-liver-fat-burning', 'pk-liver-fat-burning-marker', 'pk-liver-fat-reduction-phase2'],
    },
    {
      organ: 'fat',
      receptors: ['GIP'],
      effect: 'Changes in how fat is stored and used. GIP receptors have been reported in white and brown fat. In lab studies of human fat cells and mice, switching them on helped store fuel after meals and break down stored fat during fasting. This has not been shown directly in people. Whether human fat has glucagon receptors is uncertain: one expert review says it seems to have none.',
      sources: [ENDOJ, DIABETOLOGIA],
      ledger: ['pk-receptor-gipr-organs', 'pk-receptor-gipr-fat-tissue', 'pk-receptor-gcgr-human-fat-conflict'],
    },
    {
      organ: 'heart',
      receptors: ['GLP-1', 'Glucagon'],
      effect: 'Faster heartbeat. In TRIUMPH-1, a large trial in adults with obesity but no diabetes, average heart rate went up on retatrutide. In the 9 mg and 12 mg groups it was highest at about week 20, then slowly came back down. At week 80 it was 1.5 to 2.7 beats per minute above the start on retatrutide, versus 0.3 below on placebo. Among heart muscle cells, GLP-1 receptors were found only in the natural pacemaker (in monkey and human tissue). In mouse heart tissue, retatrutide sped up the pacemaker region through the glucagon receptor, but experts still debate whether the heart has glucagon receptors at all.',
      sources: [NEJM_T1_MAIN, NEJM_T1_APP, MOLMET, NAUNYN, DIABETOLOGIA],
      ledger: [P3 + 't1-pulse-peaked-week20', P3 + 't1-pulse-week80', 'pk-receptor-glp1r-heart', 'pk-heart-rate-mechanism-mouse', 'pk-receptor-gcgr-heart-uncertain'],
    },
  ],

  pk: {
    halfLifeDays: 6,
    tmaxDays: 1,
    tmaxEstimate: true, // typical peak times run from half a day to three days by dose group; one day is a typical value
    intervalDays: 7,
    // steadyStateDoses omitted: no measured value is published (only a protocol prediction, see the steadyState phase).
    phases: [
      {
        id: 'onset',
        tDays: 2 / 24,
        // fix (accuracy review): the 2-hour figure shows only that the drug was found in the blood; the first
        // measured effects were at about 24 hours (the text below), so this stop is "In the blood".
        label: 'In the blood',
        display: 'Within 2 hours (small study)',
        text: 'In a small study of 4 people who injected retatrutide they got on their own, it was found in everyone\'s blood 2 hours after the shot. Lilly\'s early studies already found effects 24 hours after the first shot: fasting insulin was at its highest, the body\'s own glucagon had dropped in the 4.5 mg and 6 mg groups, and the stomach emptied more slowly.',
        sources: [WILEY_USERS, CELL_SAD, BIOMOL, DOM_GE],
        ledger: ['pk-tmax-small-self-injection-study', G + 'sad-insulin-peak', 'pk-onset-glucagon-hormone-24h', 'pk-onset-gastric-emptying-first-dose'],
      },
      {
        id: 'peak',
        tDays: 1,
        label: 'Peak',
        display: '12 to 72 hours',
        text: 'In Lilly\'s first study, in 45 healthy adults, the level in the blood typically peaked half a day to 3 days after one shot, depending on the dose group. Single people ranged from 4 hours to about 5 days. In a 12-week study in people with type 2 diabetes, it typically peaked half a day to 2 days after each weekly shot.',
        sources: [CELL_SAD, LANCET_MAD_2],
        ledger: [G + 'sad-peak-window', G + 'sad-population', G + 'mad-tmax-text'],
      },
      {
        id: 'halfLife',
        tDays: 7.3,
        label: 'Half-life',
        // half-life counts from the peak, not from the shot (ledger checker, claims-12-long-half-life)
        display: 'About 6 days after the peak',
        text: 'Half-life is how long it takes for the amount in the blood to fall by half. In Lilly\'s first study it averaged about 6 days, and single people ranged from about 4 to 9 days. A 12-week study in people with type 2 diabetes also found about 6 days. A fatty-acid tail makes it stick to albumin, a common blood protein, which shields it from being cleared quickly.',
        sources: [CELL_SAD, LANCET_MAD],
        ledger: [G + 'sad-half-life', G + 'sad-half-life-hours', G + 'mad-half-life-abstract', G + 'albumin-mechanism'],
      },
      {
        id: 'clearance',
        tDays: 31.6,
        label: 'Mostly cleared',
        display: 'Several weeks',
        text: 'No official time for how long retatrutide stays in the body has been published. In a small study of 4 people who injected it on their own, it was still in everyone\'s blood 7 weeks after their last shot, the last time anyone checked. A Lilly study that tracked how the body gets rid of it finished in June 2023, with no results posted. For semaglutide, a related weekly drug with a half-life of about 1 week, the FDA label says it stays in the blood for about 5 to 7 weeks after the last shot.',
        sources: [WILEY_USERS, CTG_ADME, WEGOVY],
        ledger: [G + 'users-detectable-56-days', 'pk-clearance-adme-study-unpublished', 'pk-clearance-class-washout-semaglutide'],
        estimate: true,
      },
      {
        // fix (safety review): shown only in "How it works", never on the explorer timeline, and with no
        // schedule or number of weeks: the accumulation fact, nothing a reader could use as a plan.
        id: 'steadyState',
        tDays: 28,
        label: 'If shots are repeated',
        text: 'If shots are repeated, the drug builds up in the blood, because some of each shot is still there when the next one arrives. In Lilly\'s 12-week study in people with type 2 diabetes, the total drug in the blood of the group that stayed on one dose was about twice as high at the end of the study as after the first shot (worked out from the study\'s tables).',
        sources: [LANCET_MAD_APP, LANCET_MAD_2],
        ledger: [G + 'mad-accumulation-3mg', G + 'mad-steady-state-statement'],
      },
    ],
    sources: [CELL_SAD, LANCET_MAD, LANCET_MAD_2, LANCET_MAD_APP],
    ledger: [G + 'sad-half-life', G + 'sad-peak-window', G + 'mad-half-life-abstract', G + 'mad-tmax-text', G + 'mad-tmax-day1'],
  },

  absorption: {
    steps: [
      {
        id: 'depot',
        title: 'A small pool forms under the skin',
        text: 'A shot under the skin puts the drug into the mostly-fat layer between the skin and the muscle. It sits in the fluid between cells as a small pool, called a depot, and seeps into the blood slowly. In a small study of 4 people who injected retatrutide on their own, the scientists said the blood-level pattern fit this slow, depot-like release.',
        sources: [AAPS, FRONT_LIRA, WILEY_USERS],
        ledger: ['pk-absorption-subcutaneous-space', 'pk-depot-concept-self-assembly', 'pk-depot-retatrutide-profile'],
      },
      {
        id: 'capillary',
        title: 'It seeps slowly into the blood',
        text: 'From under the skin, a drug can reach the blood two ways: straight into tiny blood vessels called capillaries, or the slower way through lymph vessels. Molecules up to a certain size can use the capillaries; much bigger proteins mostly cannot. In rats, liraglutide, a related drug with a fatty tail, sent less than 0.5% of a shot through the lymph. Nobody has published this test for retatrutide. In a small study of 4 people who injected it on their own, retatrutide was found in the blood 2 hours after the shot.',
        sources: [AAPS, EJPB, WILEY_USERS],
        ledger: ['pk-absorption-capillaries-vs-lymph', 'pk-absorption-lipidated-peptide-lymph', 'pk-tmax-small-self-injection-study'],
      },
      {
        id: 'blood',
        title: 'It rides the bloodstream on albumin',
        text: 'In the blood, its fatty-acid tail makes it grab onto albumin, a protein that floats in the blood. The grip is strong but not permanent, so it can let go again. While it rides on albumin, the kidneys filter less of it out and enzymes break down less of it. That is why its half-life is about 6 days in people. By comparison, the body\'s own GLP-1 hormone has a half-life of about 1.5 minutes when it is put straight into a vein.',
        sources: [WILEY_USERS, CELL_SAD, FRONT_LIRA],
        ledger: ['pk-albumin-binding-retatrutide', G + 'albumin-mechanism', 'pk-native-glp1-short-half-life'],
      },
      {
        id: 'distribution',
        title: 'It reaches the organs with its receptors',
        text: 'It acts where its receptors are. GLP-1 and GIP receptors sit on the insulin-making cells of the pancreas. GLP-1 receptors are also in the hypothalamus (a brain area that helps control hunger), at low levels in the stomach, and in the heart\'s pacemaker. GIP receptors are reported in fat tissue. Glucagon receptors are found mostly in the liver (shown in rats). In rodents, the related drug semaglutide did not cross the brain\'s protective barrier; it reached the brain through special spots that have no such barrier. Nobody has published whether retatrutide does the same.',
        sources: [MOLMET, ENDOJ, PHARMRES, JCI],
        ledger: ['pk-receptor-glp1r-pancreas', 'pk-receptor-gipr-beta-cells', 'pk-receptor-glp1r-brain', 'pk-receptor-glp1r-stomach-not-liver', 'pk-receptor-glp1r-heart', 'pk-receptor-gipr-organs', 'pk-receptor-gcgr-liver-highest', 'pk-receptor-brain-access'],
      },
    ],
    sites: {
      abdomen: {
        // fix (safety review): the protocol instruction ("every shot was to go into…") is left out; only
        // what it means for the numbers stays.
        text: 'The peak and half-life numbers from Lilly\'s 12-week study come from shots in the belly area, not from the thigh or upper arm.',
        sources: [LANCET_MAD_APP],
        ledger: [G + 'mad-belly-only'],
      },
      thigh: {
        text: 'Lilly ran a study in 85 healthy adults with a high BMI (weight compared with height) to test whether thigh or upper-arm shots get into the blood differently from belly shots. It finished in July 2024, but as of October 2026 no results have been posted, and no published paper was found. For tirzepatide, a related drug, its FDA label says belly, thigh and upper-arm shots gave similar levels in the blood. That is tirzepatide data, not retatrutide.',
        sources: [CTG_SITES, ZEP_LABEL],
        ledger: [G + 'nct05959096-design', G + 'nct05959096-no-results', G + 'class-tirzepatide-sites'],
      },
      arm: {
        text: 'The same Lilly study also compared upper-arm shots with belly shots, and its results have not been posted. For semaglutide (Wegovy), a related weekly drug, the FDA label says belly, thigh and upper-arm shots give similar levels in the blood. That is semaglutide data, not retatrutide.',
        sources: [CTG_SITES, WEGOVY_LABEL],
        ledger: [G + 'nct05959096-design', G + 'nct05959096-no-results', G + 'class-semaglutide'],
      },
    },
  },
};
