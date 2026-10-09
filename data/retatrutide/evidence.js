// PeptideScope: retatrutide, verified content for three sections:
//   doseFacts  -> #dose-facts  (js/ui/dosefacts.js)
//   evidence   -> #evidence    (js/ui/evidence.js)
//   claims     -> #claims      (js/ui/claims.js)
//
// Every object that carries `sources` also carries `ledger`: the ids of the
// fact-checked claims in research/claims.json that its text rests on. `sources`
// is exactly the set of sourceIds of those claims. Check with:
//   node tools/trace.mjs data/retatrutide/evidence.js
//
// Education only. Studied dose groups appear only as labels for fixed trial
// groups. Nothing here is a dose, an amount to inject, a schedule or a technique.
// Where a peer-reviewed paper and a company release both report a number, the
// paper's number is used. Company-only figures are labelled as such.

const doseFacts = {
  intro: 'In each trial, adults were assigned at random to a study group. Each group is named for the weekly dose of retatrutide it was assigned, and one group got a placebo (a dummy shot with no drug). The tables show what happened in each group. In most of these trials, stomach side effects, and the share of people who stopped because of side effects, were higher in the higher-dose groups. TRIUMPH-2 was the exception for stopping: more people stopped for good because of side effects or death in its 9 mg group than in its 12 mg group.',
  caveat: 'These are fixed results from trials run under medical supervision. In the TRIUMPH trials, study teams checked people with physical exams, pulse checks, heart tracings (ECGs) and blood tests throughout. Nothing here tells anyone what to take, and nothing here can be adjusted.',
  sources: [
    'new-england-2026-retatrutide-triple-hormone-receptor-2',
    'new-england-2023-triple-hormone-receptor-agonist-2',
    'eli-lilly-2026-lilly-s-triple-agonist',
    'lancet-via-2026-retatrutide-adults-obesity-type',
    'diabetes-obesity-2025-retatrutide-treatment-obesity-obstruct-4',
  ],
  ledger: [
    'trials-triumph1-enrolled',
    'trials-ph2-obesity-design',
    'trials-ph2-gi-dose-related',
    'trials-triumph1-gi',
    'trials-triumph2-nausea',
    'trials-cross-discontinuation-dose-response',
    'trials-triumph2-discontinuation-lancet',
    'gap-personal-history-trial-exclusions-ecg-monitoring-program',
  ],
  trials: [
    {
      id: 'triumph-1',
      name: 'TRIUMPH-1: adults with obesity or overweight, no diabetes',
      design: 'Final-stage (phase 3) trial of 2,339 adults without diabetes who had obesity, or overweight with a weight-related health problem, vs placebo. Nausea, vomiting and skin-feeling figures are from Lilly\'s results release, not the journal; the rest are from the peer-reviewed paper and its appendix',
      timepoint: 'Results at week 80',
      columns: [
        'Study group',
        'Average weight change, counting everyone who started',
        'Stopped because of side effects',
        'Nausea',
        'Vomiting',
        'Odd skin feelings (dysesthesia)',
        'Had a serious medical problem (any cause)',
        'Heart rate change at week 80 (beats per minute)',
      ],
      rows: [
        { arm: 'Placebo (dummy shot)', cells: ['−3.9%', '4.6%', '14.8%', '4.8%', '0.9%', '5.5%', '−0.3'] },
        { arm: '4 mg group', cells: ['−17.6%', '4.1%', '28.6%', '10.6%', '5.1%', '7.7%', '+1.5'] },
        { arm: '9 mg group', cells: ['−23.7%', '6.5%', '38.4%', '22.8%', '12.3%', '7.7%', '+2.7'] },
        { arm: '12 mg group', cells: ['−25.0%', '11.2%', '42.4%', '25.3%', '12.5%', '10.5%', '+2.6'] },
      ],
      sources: [
        'new-england-2026-retatrutide-triple-hormone-receptor-2',
        'new-england-2026-retatrutide-triple-hormone-receptor-3',
        'new-england-2026-supplementary-appendix-retatrutide-triple',
        'eli-lilly-2026-lilly-s-triple-agonist',
      ],
      ledger: [
        'trials-triumph1-enrolled',
        'trials-triumph1-weight-itt',
        'gap-phase3-serious-ae-rates-and-heart-rate-t1-discontinuation-nejm-table',
        'trials-triumph1-gi',
        'trials-triumph1-dysesthesia',
        'gap-phase3-serious-ae-rates-and-heart-rate-t1-serious-ae',
        'gap-phase3-serious-ae-rates-and-heart-rate-t1-pulse-week80',
      ],
    },
    {
      id: 'triumph-2',
      name: 'TRIUMPH-2: adults with obesity or overweight and type 2 diabetes',
      design: 'Final-stage (phase 3) trial of 1,152 adults vs placebo. All figures are from the peer-reviewed paper in The Lancet and its appendix',
      timepoint: 'Results at week 80',
      columns: [
        'Study group',
        'Average weight change, counting everyone who started',
        'Stopped for good because of side effects or death',
        'Nausea',
        'Diarrhea',
        'Odd skin feelings (dysesthesia)',
        'Low blood pressure',
        'Heart rate change at week 80 (beats per minute)',
      ],
      rows: [
        { arm: 'Placebo (dummy shot)', cells: ['−5.1%', '5%', '8%', '13%', '1%', 'under 1%', '−1.0'] },
        { arm: '4 mg group', cells: ['−11.9%', '4%', '14%', '27%', '4%', '1%', '+0.3'] },
        { arm: '9 mg group', cells: ['−16.8%', '12%', '21%', '34%', '6%', '5%', '+1.0'] },
        { arm: '12 mg group', cells: ['−18.8%', '8%', '28%', '34%', '7%', '6%', '+1.5'] },
      ],
      sources: [
        'lancet-via-2026-retatrutide-adults-obesity-type',
        'lancet-elsevier-2026-supplementary-appendix-bellido-v',
      ],
      ledger: [
        'trials-triumph2-design',
        'trials-triumph2-weight-lancet',
        'trials-triumph2-discontinuation-lancet',
        'trials-triumph2-nausea',
        'trials-triumph2-diarrhea',
        'trials-triumph2-dysesthesia-lancet',
        'trials-triumph2-hypotension',
        'gap-phase3-serious-ae-rates-and-heart-rate-t2-pulse-week80',
      ],
    },
    {
      id: 'triumph-4',
      name: 'TRIUMPH-4: adults with obesity or overweight and knee arthritis',
      design: 'Final-stage (phase 3) trial of 445 adults vs placebo. Figures are from Lilly\'s press release, not a peer-reviewed paper. Some people who stopped because of side effects felt they were losing too much weight, and stopping for any reason was similar across the groups',
      timepoint: 'Results at week 68',
      columns: [
        'Study group',
        'Average weight change, counting everyone who started',
        'Stopped because of side effects',
        'Nausea',
        'Vomiting',
        'Odd skin feelings (dysesthesia)',
      ],
      rows: [
        { arm: 'Placebo (dummy shot)', cells: ['−4.6%', '4.0%', '10.7%', '0.0%', '0.7%'] },
        { arm: '9 mg group', cells: ['−20.0%', '12.2%', '38.1%', '20.4%', '8.8%'] },
        { arm: '12 mg group', cells: ['−23.7%', '18.2%', '43.2%', '20.9%', '20.9%'] },
      ],
      sources: ['eli-lilly-2025-lilly-s-triple-agonist'],
      ledger: [
        'trials-triumph4-design',
        'trials-triumph4-weight-treatment-regimen',
        'trials-triumph4-ae-discontinuation',
        'trials-triumph4-discontinuation-weightloss',
        'trials-triumph4-gi',
        'trials-triumph4-dysesthesia',
      ],
    },
    {
      id: 'phase-2-obesity',
      name: 'Phase 2 obesity trial: adults with obesity or overweight, no diabetes',
      design: 'Mid-stage (phase 2) trial of 338 adults vs placebo, peer-reviewed in NEJM. The 4 mg and 8 mg doses were each tested in two separate groups, shown as A and B. Unlike the tables above, the weight figures here count only time on the drug',
      timepoint: 'Weight at week 48, heart rate at week 24',
      columns: [
        'Study group',
        'Average weight change at week 48, counting only time on the drug',
        'Stopped because of side effects',
        'Nausea',
        'Vomiting',
        'Odd skin feelings (sensitive skin and similar)',
        'Heart rate change at week 24, on a 24-hour monitor (beats per minute)',
      ],
      rows: [
        { arm: 'Placebo (dummy shot)', cells: ['−2.1%', '0%', '11%', '1%', '1.4%', '+0.8'] },
        { arm: '1 mg group', cells: ['−8.7%', '7%', '14%', '3%', '1.4%', '+0.7'] },
        { arm: '4 mg, group A', cells: ['−17.1% (A and B together)', '6%', '18%', '12%', '6.1%', '+4.2'] },
        { arm: '4 mg, group B', cells: ['−17.1% (A and B together)', '9%', '36%', '12%', '6.1%', '+2.2'] },
        { arm: '8 mg, group A', cells: ['−22.8% (A and B together)', '14%', '17%', '6%', '2.9%', '+5.7'] },
        { arm: '8 mg, group B', cells: ['−22.8% (A and B together)', '6%', '60%', '26%', '14.3%', '+6.0'] },
        { arm: '12 mg group', cells: ['−24.2%', '16%', '45%', '19%', '12.9%', '+9.2'] },
      ],
      sources: [
        'new-england-2023-triple-hormone-receptor-agonist-2',
        'new-england-2023-triple-hormone-receptor-agonist',
        'new-england-2023-supplementary-appendix-table-s8',
      ],
      ledger: [
        'trials-ph2-obesity-design',
        'trials-ph2-weight-48wk',
        'trials-ph2-ae-discontinuation',
        'trials-ph2-nausea-by-arm',
        'trials-ph2-vomiting-by-arm',
        'trials-ph2-skin-sensation-by-arm',
        'trials-ph2-heart-rate-24wk',
      ],
    },
  ],
};

const evidence = {
  level: 'large-trial',
  summary: 'Retatrutide has reached the top rung of this ladder: large trials that compare it with a placebo. The four main final-stage (phase 3) TRIUMPH trials included more than 5,800 people. It is still an experimental drug. No regulator in the world has approved it, a consumer safety group says its full safety picture is not yet known, and the trial built to show whether it affects heart attacks, strokes and kidney failure is not expected to finish until around February 2029.',
  sources: [
    'diabetes-obesity-2025-retatrutide-treatment-obesity-obstruct-2',
    'eli-lilly-2026-lilly-s-triple-agonist-3',
    'public-citizen-2026-miracle-drug-peptide-craze',
    'clinicaltrials-gov-2026-effect-retatrutide-once-weekly',
  ],
  ledger: ['claims-8-trials-with-diet', 'trials-status-investigational', 'claims-4-full-safety-unknown', 'trials-unknown-cvot'],
  rungs: [
    {
      level: 'anecdote',
      text: 'A consumer watchdog group found hundreds of TikTok videos and Instagram posts calling retatrutide "a miracle" and "better than Ozempic". The maker warns that illegal versions may hold too much or too little of the drug, harmful contaminants or a different drug entirely, so a personal story can\'t show what was really in the vial.',
      sources: ['public-citizen-2026-miracle-drug-peptide-craze', 'eli-lilly-2026-what-know-about-retatrutide'],
      ledger: ['claims-3-claim-identified', 'gray-core-lilly-faq-contents'],
    },
    {
      level: 'anecdote',
      text: 'Doctors have also written up single patients. In one published case report, a man with type 1 diabetes developed severe vomiting, a dangerous build-up of ketones (acids in the blood) and kidney injury soon after injecting an online "retatrutide" product. The product was never tested, and he also had a gut infection, so the authors say the cause cannot be proven.',
      sources: ['cureus-springer-2026-online-sourced-retatrutide-complicating'],
      ledger: ['claims-4-case-report-dka'],
    },
    {
      level: 'anecdote',
      text: 'Health agencies also collect reports of harm. A consumer watchdog counted 26 reports tied to retatrutide sent to the FDA in the first five months of 2026, including 11 that needed a hospital stay. In the state of Victoria, Australia, six people had sudden liver injury after using products labelled retatrutide, and health officials think a contaminant may be to blame.',
      sources: ['public-citizen-2026-miracle-drug-peptide-craze', 'department-health-2026-toxicity-linked-unapproved-peptide-2'],
      ledger: ['claims-4-faers-reports', 'claims-5-victoria-liver-injury'],
    },
    {
      level: 'anecdote',
      text: 'Australia\'s medicines regulator received a report of a person whose vomiting was so severe it tore their food pipe after using a product sold as retatrutide. When the regulator tested the product, it held a different drug, semaglutide, and no retatrutide.',
      sources: ['therapeutic-goods-2026-tga-tests-counterfeit-retatrutide'],
      ledger: ['claims-4-tga-torn-oesophagus', 'claims-5-tga-no-retatrutide'],
    },
    {
      level: 'animal',
      text: 'In Lilly\'s early lab work in obese mice, retatrutide lowered body weight in two ways: the mice ate less, and its glucagon part made their bodies burn more calories. Results on calorie burning in people have not been published.',
      sources: ['cell-metabolism-2022-ly3437943-novel-triple-glucagon'],
      ledger: ['pk-receptor-gcgr-energy-expenditure-mice'],
    },
    {
      level: 'animal',
      text: 'In lab tests on mouse heart tissue, retatrutide made the heart\'s natural pacemaker beat faster, working through its glucagon part, but it did not make the heart muscle squeeze harder. This may help explain why heart rate rose in human trials, but animal tissue may not behave exactly like a person\'s heart.',
      sources: ['naunyn-schmiedeberg-2025-contractile-effects-retatrutide-iso', 'new-england-2023-triple-hormone-receptor-agonist-2'],
      ledger: ['safety-heart-rate-mechanism-glucagon', 'trials-ph2-heart-rate-peak'],
    },
    {
      level: 'small-human',
      text: 'The first studies in people were small. In Lilly\'s first study, 45 healthy volunteers got a single shot, and a review of that study reports that blood levels peaked half a day to 3 days later. A 12-week study in people with type 2 diabetes found it takes about 6 days for the amount in the blood to fall by half.',
      sources: ['biomolecules-mdpi-2025-retatrutide-a-game-changer', 'lancet-elsevier-2022-ly3437943-novel-triple-gip'],
      ledger: ['pk-tmax-single-dose-healthy', 'pk-half-life-6-days'],
    },
    {
      level: 'small-human',
      text: 'Mid-stage (phase 2) trials then tested it in a few hundred people. In 338 adults with obesity or overweight, the 12 mg group lost about 24% of their body weight on average by week 48 (counting only time on the drug), versus about 2% on placebo, and stomach problems were the most common side effects, more so at higher doses. In 281 adults with type 2 diabetes, the 12 mg group\'s HbA1c (a 3-month blood-sugar average) fell by about 2 points at 24 weeks.',
      sources: ['new-england-2023-triple-hormone-receptor-agonist-2', 'lancet-elsevier-2023-retatrutide-gip-glp-1'],
      ledger: ['trials-ph2-obesity-design', 'trials-ph2-weight-48wk', 'trials-ph2-gi-dose-related', 'trials-ph2-t2d-hba1c'],
    },
    {
      level: 'small-human',
      text: 'One small study took blood samples from 4 adults who injected retatrutide they got on their own, outside any trial. Levels usually peaked 1 to 2 days after the first shot and varied a lot from person to person. The researchers confirmed the material was retatrutide but did not check how much drug it held.',
      sources: ['john-wiley-2026-detection-excretion-profile-retatrutide'],
      ledger: ['pk-tmax-small-self-injection-study', 'gap-pk-peak-and-steady-state-primary-users-product-source'],
    },
    {
      level: 'large-trial',
      text: 'Large final-stage (phase 3) trials, each comparing retatrutide with a placebo, have now reported results. Three have been published in peer-reviewed journals: TRIUMPH-1 (2,339 adults with obesity or overweight and no diabetes, 80 weeks), TRIUMPH-2 (1,152 adults with obesity or overweight and type 2 diabetes, 80 weeks) and TRANSCEND-T2D-1 (537 adults with fairly new type 2 diabetes, 40 weeks).',
      sources: [
        'new-england-2026-retatrutide-triple-hormone-receptor-2',
        'lancet-via-2026-retatrutide-adults-obesity-type',
        'lancet-via-2026-efficacy-safety-retatrutide-people',
      ],
      ledger: ['trials-triumph1-enrolled', 'trials-triumph2-design', 'trials-transcend1-a1c'],
    },
    {
      level: 'large-trial',
      text: 'Lilly has also announced results from TRIUMPH-3 (1,949 adults with severe obesity and heart or blood-vessel disease) and TRIUMPH-4 (445 adults with obesity or overweight and knee arthritis). So far these two have been reported only in Lilly\'s press releases, not in peer-reviewed papers.',
      sources: ['eli-lilly-2026-lilly-s-triple-agonist-3', 'eli-lilly-2025-lilly-s-triple-agonist'],
      ledger: ['trials-triumph3-design', 'trials-triumph4-design'],
    },
  ],
  gaps: [
    {
      text: 'What happens after more than 2 years on it. In TRIUMPH-1, the comparison with placebo lasted 80 weeks. Results to 104 weeks come only from 532 people with a BMI (weight compared with height) of 35 or more who finished the main trial and handled their dose well, and in that extra time everyone got retatrutide.',
      sources: ['eli-lilly-2026-lilly-s-triple-agonist'],
      ledger: ['trials-unknown-longest-data'],
    },
    {
      text: 'Whether it raises or lowers the risk of heart attacks, strokes and kidney failure. The trial built to answer this, with about 10,000 people, is still running and is not expected to finish until around February 2029. In TRIUMPH-3, a trial in people who already had heart or blood-vessel disease, there were too few heart events to show either protection or harm.',
      sources: ['clinicaltrials-gov-2026-effect-retatrutide-once-weekly', 'eli-lilly-2026-lilly-s-triple-agonist-3'],
      ledger: ['trials-unknown-cvot', 'claims-13-heart-events-unclear'],
    },
    {
      text: 'How often more serious problems happen, such as pancreatitis (an inflamed pancreas) or gallbladder and bile-duct disease. A consumer safety group says this is not yet known. The TRIUMPH-1 researchers said its 10 pancreatitis cases were too few to tell whether retatrutide raises the risk.',
      sources: ['public-citizen-2026-miracle-drug-peptide-craze', 'new-england-2026-retatrutide-triple-hormone-receptor-3'],
      ledger: ['claims-4-full-safety-unknown', 'gap-phase3-serious-ae-rates-and-heart-rate-t1-pancreatitis-too-few'],
    },
    {
      text: 'What it does to a pregnancy or an unborn baby. Pregnant and breastfeeding women were kept out of the phase 2 obesity trial and of TRIUMPH-2 and TRIUMPH-3, and in the TRIUMPH trials getting pregnant was a reason to stop the drug.',
      sources: ['clinicaltrials-gov-2023-study-ly3437943-participants-who', 'eli-lilly-2025-protocol-j1i-mc-gzbk'],
      ledger: ['trials-unknown-pregnancy-excluded', 'gap-personal-history-trial-exclusions-pregnancy-breastfeeding'],
    },
    {
      text: 'Whether it makes birth-control pills less reliable. Lilly finished a study on this in July 2024, but as of October 2026 no results had been posted or published.',
      sources: ['clinicaltrials-gov-2024-phase-1-study-investigate'],
      ledger: ['gap-surgery-pregnancy-practical-guidance-reta-oc-ddi-no-results'],
    },
    {
      text: 'How it affects people who were kept out of the trials. All four TRIUMPH trials left out people with badly reduced kidney function, anyone who had ever attempted suicide, and anyone who had used a drug in the same family, such as semaglutide or tirzepatide, in the 3 months before. So switching straight from those drugs was not studied. TRIUMPH-1 also left out people who had ever had pancreatitis, or who had a personal or family history of medullary thyroid cancer (a rare thyroid cancer).',
      sources: ['diabetes-obesity-2025-retatrutide-treatment-obesity-obstruct-3', 'clinicaltrials-gov-2026-study-retatrutide-ly3437943-particip'],
      ledger: [
        'gap-personal-history-trial-exclusions-kidney-egfr-under-30',
        'gap-personal-history-trial-exclusions-suicide-attempt-ever',
        'gap-personal-history-trial-exclusions-recent-glp1-users',
        'trials-unknown-excluded-mtc-pancreatitis',
      ],
    },
    {
      text: 'How it affects children and teens. The TRIUMPH trials only included adults aged 18 or older, and there are no completed trials of retatrutide in anyone younger.',
      sources: ['new-england-2026-retatrutide-triple-hormone-receptor-2', 'diabetes-obesity-2025-retatrutide-treatment-obesity-obstruct-3'],
      ledger: ['trials-unknown-adults-only', 'gap-personal-history-trial-exclusions-adults-only'],
    },
    {
      text: 'What is really in the products sold online. Lilly says black-market retatrutide "is not a medicine", and UK regulators say these products haven\'t been tested for safety and may not even contain retatrutide. In an Australian study, three vials held from about half to almost double the amount on their labels, and a vial tested by Australia\'s medicines regulator held a different drug, semaglutide, and no retatrutide.',
      sources: [
        'eli-lilly-2026-lilly-calls-online-platforms',
        'medicines-healthcare-2026-no-summer-shortcut-safe',
        'wiley-drug-2026-composition-labelling-accuracy-products',
        'therapeutic-goods-2026-tga-tests-counterfeit-retatrutide',
      ],
      ledger: [
        'claims-5-lilly-not-medicine',
        'gray-core-mhra-no-guarantee',
        'gap-gray-contaminant-sterility-data-dar-dose-content',
        'gap-gray-contaminant-sterility-data-tga-semaglutide-instead',
      ],
    },
    {
      text: 'Whether online vials are free of germs and of endotoxins (toxic bits of dead bacteria). No peer-reviewed study has yet published these tests for gray-market retatrutide.',
      sources: ['wiley-drug-2026-composition-labelling-accuracy-products'],
      ledger: ['gap-gray-contaminant-sterility-data-dar-sterility-endotoxin-not-tested'],
    },
    {
      text: 'What happens to weight and health after people stop. A trial that switches some people to placebo (TRIUMPH-6) is still running until about 2028.',
      sources: ['clinicaltrials-gov-2026-clinicaltrials-gov-nct06859268-phase'],
      ledger: ['claims-9-retatrutide-stop-trial-running'],
    },
  ],
};

const claims = [
  // fix (safety review): the safety and legality checks come first; the weight-loss claims follow.
  {
    claim: 'It\'s safe because it\'s in phase 3. It\'s basically approved.',
    verdict: 'not-supported',
    evidence: 'No regulator anywhere has approved it, and the FDA says it has not been found safe and effective for any condition. Phase 3 means it is still being tested, and Lilly has not yet asked the FDA for approval: it plans to apply in early 2027.',
    sources: [
      'eli-lilly-2026-lilly-calls-online-platforms',
      'u-s-2026-fda-s-concerns-unapproved-2',
      'eli-lilly-2026-lilly-s-triple-agonist-3',
    ],
    ledger: ['claims-4-not-approved-anywhere', 'claims-4-fda-not-found-safe', 'claims-4-application-2027'],
  },
  {
    claim: 'Research-grade vials are the same as the real drug. The lab certificate proves it.',
    verdict: 'not-supported',
    evidence: 'In an Australian study, three vials held from about half to almost double the amount on their labels, and a vial tested by Australia\'s regulator held a different drug and no retatrutide. According to the testing service Finnrick, most lab test panels skip endotoxins (toxins from bacteria), so a high-purity certificate doesn\'t show a vial is free of them.',
    sources: [
      'wiley-drug-2026-composition-labelling-accuracy-products',
      'therapeutic-goods-2026-tga-tests-counterfeit-retatrutide',
      'finnrick-2026-methodology',
    ],
    ledger: ['claims-5-australia-dose-range', 'claims-5-tga-no-retatrutide', 'claims-5-coa-skips-endotoxin'],
  },
  {
    claim: 'It\'s legal as long as it\'s labeled "for research use".',
    verdict: 'not-supported',
    evidence: 'The FDA says companies selling it labeled "for research purposes" or "not for human consumption" are selling it illegally. Lilly says it is legally available only through its clinical trials; the one narrow exception is a Lilly program that a doctor can request for certain adults with severe obesity who can\'t join a trial.',
    sources: ['u-s-2026-fda-s-concerns-unapproved-2', 'eli-lilly-2026-lilly-s-triple-agonist', 'clinicaltrials-gov-2026-clinicaltrials-gov-nct07629401-pre'],
    ledger: ['claims-11-fda-falsely-labeled', 'claims-11-lilly-only-trials', 'pk-regulatory-expanded-access'],
  },
  {
    claim: 'It\'s natural, just a peptide, so it\'s gentle.',
    verdict: 'not-supported',
    evidence: 'It is a lab-made molecule the body does not make, and it is built to last: in an early trial in people with type 2 diabetes, it took about 6 days for the amount in the blood to fall by half, so its effects, including side effects, do not wear off quickly. Side effects were common: in TRIUMPH-1, 42.4% of the 12 mg group had nausea versus 14.8% on placebo.',
    sources: [
      'diabetes-obesity-2025-retatrutide-treatment-obesity-obstruct-2',
      'naunyn-schmiedeberg-2025-inotropic-effects-retatrutide-isola',
      'lancet-elsevier-2022-ly3437943-novel-triple-gip',
      'eli-lilly-2026-lilly-s-triple-agonist',
    ],
    ledger: ['claims-12-synthetic', 'claims-12-not-made-by-body', 'claims-12-long-half-life', 'claims-3-gi-rates-triumph1'],
  },
  {
    claim: 'It has no effect on the heart.',
    verdict: 'not-supported',
    evidence: 'In the phase 2 trial it raised heart rate, more at higher doses; the rise peaked at 24 weeks and then went down. In TRIUMPH-2, low blood pressure was reported in 6% of the 12 mg group versus under 1% on placebo.',
    sources: ['new-england-2023-triple-hormone-receptor-agonist-2', 'lancet-via-2026-retatrutide-adults-obesity-type'],
    ledger: ['claims-13-heart-rate-rises', 'claims-13-low-blood-pressure'],
  },
  {
    claim: 'Microdosing it boosts energy, longevity and anti-aging.',
    verdict: 'not-supported',
    evidence: 'No registered retatrutide study tests longevity or anti-aging, and the biggest finished weight-loss trial tested set doses, not tiny "microdoses". Experts reviewing microdosing of drugs like semaglutide and tirzepatide say good-quality evidence for it is essentially absent.',
    sources: ['new-england-2026-retatrutide-triple-hormone-receptor-2', 'expert-opinion-2026-considerations-challenges-microdosing-gl'],
    ledger: ['claims-6-trials-tested-weight-not-aging', 'claims-6-microdosing-evidence-absent'],
  },
  {
    claim: 'It keeps or even builds muscle. Only fat comes off.',
    verdict: 'not-supported',
    evidence: 'In a small body-scan study of 103 people with type 2 diabetes, lean tissue (which includes muscle) was lost along with fat, in about the same share as with other obesity treatments. No retatrutide trial has shown it builds muscle.',
    sources: ['lancet-diabetes-2025-effects-retatrutide-body-composition'],
    ledger: ['claims-2-lean-mass-also-lost', 'claims-2-small-diabetes-only-sample'],
  },
  {
    claim: 'It works better than Ozempic or Mounjaro, with fewer side effects.',
    verdict: 'not-supported',
    evidence: 'No finished final-stage trial has compared them head to head, and the trial against tirzepatide (Mounjaro) is still running. Side effects were common: in TRIUMPH-1, 42.4% of the 12 mg group had nausea versus 14.8% on placebo, and a 2026 analysis that pooled 58 trials found people stopped retatrutide because of side effects more often than several other weight-loss drugs (low-certainty evidence).',
    sources: [
      'eli-lilly-2026-how-does-retatrutide-compare',
      'clinicaltrials-gov-2026-study-retatrutide-ly3437943-compared',
      'eli-lilly-2026-lilly-s-triple-agonist',
      'bmj-medicine-2026-comparative-efficacy-safety-glucagon',
    ],
    ledger: ['claims-3-no-head-to-head', 'claims-3-triumph5-pending', 'claims-3-gi-rates-triumph1', 'claims-3-nma-more-dropouts'],
  },
  {
    claim: 'The glucagon part burns fat, so you don\'t need to diet.',
    verdict: 'not-supported',
    evidence: 'The extra calorie-burning was shown in mice, and Lilly\'s study of calories burned in people has not posted results. In the four main TRIUMPH trials, everyone got healthy-eating and activity advice along with the drug or placebo.',
    sources: [
      'cell-metabolism-2022-ly3437943-novel-triple-glucagon',
      'clinicaltrials-gov-2025-effect-ly3437943-placebo-calorie',
      'diabetes-obesity-2025-retatrutide-treatment-obesity-obstruct-2',
    ],
    ledger: ['claims-8-energy-burn-in-mice', 'claims-8-human-burn-study-unreported', 'claims-8-trials-with-diet'],
  },
  {
    claim: 'It caused big weight loss in clinical trials.',
    verdict: 'supported',
    evidence: 'In the peer-reviewed TRIUMPH-1 trial, the 12 mg group lost 25.0% of their body weight on average over 80 weeks, versus 3.9% on placebo, counting everyone who started. Everyone in the main TRIUMPH trials also got healthy-eating and activity advice. These results are in adults, in a supervised trial, with the real product, not an internet vial.',
    sources: ['new-england-2026-retatrutide-triple-hormone-receptor-2', 'diabetes-obesity-2025-retatrutide-treatment-obesity-obstruct-2'],
    ledger: ['claims-1-nejm-everyone-counted', 'claims-8-trials-with-diet'],
  },
  {
    claim: 'You\'ll lose a quarter to almost a third of your body weight.',
    verdict: 'partly',
    evidence: 'Those are averages for the highest-dose trial groups, not what each person gets. In TRIUMPH-1\'s 12 mg group the average was 25.0% counting everyone who started, and fewer than half (45.3%) lost 30% or more even when figured as if everyone kept taking the drug. People with type 2 diabetes lost less: 18.8% in TRIUMPH-2\'s 12 mg group.',
    sources: [
      'new-england-2026-retatrutide-triple-hormone-receptor-2',
      'eli-lilly-2026-lilly-s-triple-agonist',
      'lancet-via-2026-retatrutide-adults-obesity-type',
    ],
    ledger: ['claims-1-nejm-everyone-counted', 'claims-1-not-everyone-30', 'claims-1-type2-diabetes-less'],
  },
  {
    claim: 'It reverses fatty liver.',
    verdict: 'partly',
    evidence: 'In a small study of 98 people with fatty liver, the 12 mg group\'s liver fat fell by about 82% from its own starting level after 24 weeks, while it did not change on placebo. But no liver biopsies were done, so the study could not show that liver damage or scarring was reversed.',
    sources: ['nature-medicine-2024-triple-hormone-receptor-agonist'],
    ledger: ['claims-7-liver-fat-drop', 'claims-7-no-biopsy-small'],
  },
  {
    claim: 'It fixes knee pain.',
    verdict: 'partly',
    evidence: 'The knee results come only from adults with excess weight and knee arthritis, and their pain also dropped a lot on placebo (by about 40% in Lilly\'s knee trial). In the peer-reviewed TRIUMPH-1 knee group, the extra benefit over placebo was about 1.6 to 1.8 points on a 10-point pain scale.',
    sources: ['eli-lilly-2025-lilly-s-triple-agonist', 'new-england-2026-retatrutide-triple-hormone-receptor-2'],
    ledger: ['claims-10-who-was-studied', 'claims-10-placebo-improved-too', 'claims-10-nejm-difference'],
  },
  {
    claim: 'The weight stays off after you stop.',
    verdict: 'unknown',
    evidence: 'There are no results yet on stopping retatrutide, and a trial testing this runs until about 2028. With the related drug tirzepatide, people switched to placebo regained 14% of their body weight within a year, but that is a different drug and does not prove what happens with retatrutide.',
    sources: ['clinicaltrials-gov-2026-clinicaltrials-gov-nct06859268-phase', 'jama-american-2024-continued-treatment-tirzepatide-maintenan'],
    ledger: ['claims-9-retatrutide-stop-trial-running', 'claims-9-tirzepatide-regain'],
  },
];

export default { doseFacts, evidence, claims };
