// PeptideScope: retatrutide side effects (data/retatrutide/side-effects.js).
// Shape: docs/ARCHITECTURE.md "Data contract" (sideEffects[]). Rendered by js/ui/sideeffects.js
// (cards by organ) and js/effects.js (cards that follow the timeline).
//
// Every fact object cites exactly the sources of the fact-checked claims listed in its ledger
// (research/claims.json). Check with: node tools/trace.mjs data/retatrutide/side-effects.js
//
// frequency: retatrutide trial numbers, naming the trial, population and group. Peer-reviewed
//   papers are named as such; company (Lilly) figures are labelled as Lilly's. Where no
//   retatrutide figure exists, the related approved drug is named.
// why / reduce: mechanism and "how to ease it or when it passes" from labels, regulators,
//   health services, reviews and trial reports. Related-drug evidence is named as such.
//   Never a dose change, never dosing or injection advice.
// timing: an illustrative window on the one-shot timeline (days after a shot). cumulative: true
//   means it follows repeated exposure (js/effects.js); a window that starts after the one-shot
//   view ends (hair) only appears in the weekly view. Display windows, not claims; no figures.

export default [
  {
    id: "nausea", name: "Nausea (feeling sick to your stomach)", organ: "stomach", alsoOrgans: ["brain"], severity: "common",
    frequency: {
      text: "In TRIUMPH-1 (adults with obesity or overweight, without diabetes), Lilly reports nausea in 42.4% of people in the 12 mg group, versus 14.8% on a dummy shot (placebo). In the peer-reviewed TRIUMPH-2 paper (adults with obesity and type 2 diabetes), it was 28% in the 12 mg group versus 8% on placebo. In the peer-reviewed phase 2 trial, stomach and gut side effects were mostly mild to moderate and became more common at higher doses.",
      sources: ["eli-lilly-2026-lilly-s-triple-agonist", "lancet-via-2026-retatrutide-adults-obesity-type", "new-england-2023-triple-hormone-receptor-agonist-2"],
      ledger: ["safety-gi-retatrutide-triumph1-rates", "trials-triumph2-nausea", "safety-gi-retatrutide-triumph2-peer-reviewed", "trials-ph2-gi-dose-related"],
    },
    why: {
      text: "Drugs in this family act on a 'sickness center' in the brainstem, which can cause nausea. They also slow how fast food leaves the stomach. For the related approved drug tirzepatide, this slowing is strongest after the very first shot and fades over time.",
      sources: ["dove-medical-2026-adverse-events-associated-incretin", "eli-lilly-2026-zepbound-tirzepatide-injection"],
      ledger: ["safety-gi-mechanism", "safety-gi-stomach-emptying-label"],
    },
    reduce: {
      text: "Experts' first tips are about food: eat smaller meals more often, choose low-fat food, skip fizzy drinks and fried or spicy food, and eat slowly. The NHS advises avoiding alcohol with the related drug tirzepatide, because it can make feeling sick worse. In the first single-shot study of retatrutide, stomach side effects started within 4 days of the shot and went away within a week of starting. In a later retatrutide trial in people with type 2 diabetes, Lilly said nausea and vomiting happened mostly during the period when doses were being raised.",
      sources: ["wiley-nutrition-2026-gastrointestinal-adverse-effects-glp", "nhs-nhs-2026-tirzepatide-medicine-manage-type", "eli-lilly-2022-protocol-j1i-mc-gzbg", "eli-lilly-2026-lilly-s-triple-agonist-4"],
      ledger: ["safety-gi-reduce-diet", "safety-gi-alcohol", "gap-pk-peak-and-steady-state-primary-sad-gi-timing", "trials-transcend1-gi"],
    },
    timing: { fromDays: 0.5, toDays: 7, text: "Usually starts in the first few days after a shot. In the first single-shot study it faded within about a week of starting." },
  },
  {
    id: "vomiting", name: "Vomiting (throwing up)", organ: "stomach", alsoOrgans: ["brain"], severity: "common",
    frequency: {
      text: "In TRIUMPH-1 (adults with obesity or overweight, without diabetes), Lilly reports vomiting in 25.3% of people in the 12 mg group, versus 4.8% on a dummy shot (placebo). In the smaller, peer-reviewed phase 2 trial (adults with obesity or overweight, without diabetes), it was 19% in the 12 mg group versus 1% on placebo.",
      sources: ["eli-lilly-2026-lilly-s-triple-agonist", "new-england-2023-triple-hormone-receptor-agonist", "new-england-2023-triple-hormone-receptor-agonist-2"],
      ledger: ["safety-gi-retatrutide-triumph1-rates", "trials-ph2-vomiting-by-arm", "trials-ph2-obesity-design"],
    },
    why: {
      text: "Drugs in this family act on the brainstem's 'sickness center', which sends signals that can lead to feeling and being sick. They also slow how fast food leaves the stomach, which can cause a heavy, overly full feeling.",
      sources: ["dove-medical-2026-adverse-events-associated-incretin"],
      ledger: ["safety-gi-mechanism"],
    },
    reduce: {
      text: "Throwing up can drain the body of fluid. The official patient guide for the related drug tirzepatide says drinking fluids helps lower that risk, and to tell a doctor if it does not stop. Contact a doctor right away if someone throws up 3 or more times in one day, cannot keep any liquids down for 12 hours or more, or has not peed for 8 hours or more. Call 911 if the vomit has blood in it or looks like dark coffee grounds.",
      sources: ["eli-lilly-2026-zepbound-tirzepatide-injection", "u-s-2025-nausea-vomiting"],
      ledger: ["gap-side-effect-mechanism-and-mitigation-hypo-mg-drink-fluids", "gap-red-flags-us-911-split-no-urine-8h-doctor-today", "gap-red-flags-us-911-split-vomiting-doctor-today", "gap-red-flags-us-911-split-vomiting-blood-911"],
    },
    timing: { fromDays: 1, toDays: 5, text: "Most likely in the first days after a shot, around the peak level." },
  },
  {
    id: "diarrhea", name: "Diarrhea", organ: "small_intestine", alsoOrgans: ["large_intestine"], severity: "common",
    frequency: {
      text: "In the peer-reviewed TRIUMPH-2 paper (adults with obesity and type 2 diabetes), 34% of people in the 12 mg group had diarrhea, versus 13% on a dummy shot (placebo). In TRIUMPH-1 (adults with obesity or overweight, without diabetes), Lilly reports 32.0% in the 12 mg group versus 13.5% on placebo.",
      sources: ["lancet-via-2026-retatrutide-adults-obesity-type", "eli-lilly-2026-lilly-s-triple-agonist"],
      ledger: ["trials-triumph2-diarrhea", "safety-gi-retatrutide-triumph2-peer-reviewed", "safety-gi-retatrutide-triumph1-rates"],
    },
    why: {
      text: "The sources we use do not pin down exactly why these drugs cause diarrhea. A review of this drug family says they act in two places: on the brain, and on the gut itself, where they slow how fast food leaves the stomach.",
      sources: ["dove-medical-2026-adverse-events-associated-incretin"],
      ledger: ["safety-gi-mechanism"],
    },
    reduce: {
      text: "Drink fluids: the official patient guide for the related drug tirzepatide says this lowers the risk of dehydration (losing too much body water). Tell a doctor if it does not stop. In tirzepatide studies, most diarrhea happened during the period when doses were being raised, and then got less over time.",
      sources: ["eli-lilly-2026-zepbound-tirzepatide-injection"],
      ledger: ["gap-side-effect-mechanism-and-mitigation-hypo-mg-drink-fluids", "safety-gi-when-it-passes"],
    },
    timing: { fromDays: 1, toDays: 6, text: "Most likely in the first days after a shot, around the peak level." },
  },
  {
    id: "constipation", name: "Constipation", organ: "large_intestine", alsoOrgans: [], severity: "common",
    frequency: {
      text: "In TRIUMPH-1 (adults with obesity or overweight, without diabetes), Lilly reports constipation in 26.1% of people in the 12 mg group, versus 10.9% on a dummy shot (placebo). In the peer-reviewed phase 2 trial, stomach and gut problems such as constipation were the most common side effects and were mostly mild to moderate.",
      sources: ["eli-lilly-2026-lilly-s-triple-agonist", "new-england-2023-triple-hormone-receptor-agonist-2"],
      ledger: ["safety-gi-retatrutide-triumph1-rates", "trials-ph2-gi-dose-related"],
    },
    why: {
      text: "Drugs in this family slow how fast food leaves the stomach. Doctors' guidance lists constipation as one possible sign that the stomach and gut are moving food along more slowly than usual.",
      sources: ["dove-medical-2026-adverse-events-associated-incretin", "surgical-endoscopy-2024-multi-society-clinical-practice"],
      ledger: ["safety-gi-mechanism", "gap-surgery-pregnancy-practical-guidance-ms2024-risk-symptoms"],
    },
    reduce: {
      text: "Experts start with simple steps: drink enough fluid every day and slowly add soluble fiber, before trying any laxative.",
      sources: ["wiley-nutrition-2026-gastrointestinal-adverse-effects-glp"],
      ledger: ["safety-constipation-reduce"],
    },
    timing: { fromDays: 2, toDays: 7, text: "Shown through the days after a shot, while the gut is slowed." },
  },
  {
    id: "indigestion", name: "Indigestion, burping or heartburn", organ: "stomach", alsoOrgans: [], severity: "common",
    frequency: {
      text: "The retatrutide trial reports we use give no separate figure. For the related approved drug tirzepatide, the FDA label lists indigestion in 9% to 10% of people across its dose groups (4% on a dummy shot, or placebo), burping in 4% to 5% (1% on placebo) and reflux, or heartburn, in 4% to 5% (2% on placebo).",
      sources: ["eli-lilly-2026-zepbound-tirzepatide-injection"],
      ledger: ["safety-reflux-belching-label-rates"],
    },
    why: {
      text: "Drugs in this family slow how fast food leaves the stomach. That can cause fullness, indigestion, reflux (stomach acid coming back up) and bloating.",
      sources: ["dove-medical-2026-adverse-events-associated-incretin"],
      ledger: ["safety-gi-mechanism"],
    },
    reduce: {
      text: "Experts' first tips: eat smaller meals more often, choose low-fat food, skip fizzy drinks and fried or spicy food, eat slowly, stay upright for 30 minutes after eating, and don't eat within 3 hours of bedtime.",
      sources: ["wiley-nutrition-2026-gastrointestinal-adverse-effects-glp"],
      ledger: ["safety-gi-reduce-diet"],
    },
    timing: { fromDays: 0.5, toDays: 5, text: "Shown in the first days after a shot, around the peak level." },
  },
  {
    id: "belly-pain", name: "Belly pain", organ: "stomach", alsoOrgans: ["small_intestine"], severity: "common",
    frequency: {
      text: "The retatrutide trial reports we use give no separate figure. For the related approved drug tirzepatide, the FDA label lists belly pain in 9% to 10% of people across its dose groups, versus 5% on a dummy shot (placebo). Severe stomach side effects affected 1.7% to 3.1% of people on tirzepatide, versus 1% on placebo.",
      sources: ["eli-lilly-2026-zepbound-tirzepatide-injection"],
      ledger: ["safety-abdominal-pain-and-severe-gi"],
    },
    why: {
      text: "Drugs in this family slow how fast food leaves the stomach. Doctors' guidance lists belly pain, along with nausea and constipation, as a possible sign that the stomach and gut are emptying more slowly.",
      sources: ["dove-medical-2026-adverse-events-associated-incretin", "surgical-endoscopy-2024-multi-society-clinical-practice"],
      ledger: ["safety-gi-mechanism", "gap-surgery-pregnancy-practical-guidance-ms2024-risk-symptoms"],
    },
    reduce: {
      text: "Belly pain can also be a warning sign. Contact a doctor right away for severe belly pain. Severe pain that will not go away, sometimes spreading to the back, with or without throwing up, can mean an inflamed pancreas. Call 911 for sudden, sharp belly pain or a belly that is hard and stiff to touch.",
      sources: ["u-s-2025-nausea-vomiting", "eli-lilly-2026-zepbound-tirzepatide-injection-prescribing", "u-s-2026-abdominal-pain-medlineplus-medical"],
      ledger: ["gap-red-flags-us-911-split-no-urine-8h-doctor-today", "gap-red-flags-us-911-split-label-pancreatitis-stop-call", "gap-red-flags-us-911-split-sudden-sharp-belly-pain-911"],
    },
    timing: { fromDays: 1, toDays: 5, text: "Shown in the first days after a shot, along with the other stomach side effects. Severe or sudden pain is a warning sign at any time." },
  },
  {
    id: "appetite", name: "Much less appetite", organ: "brain", alsoOrgans: ["stomach"], severity: "common",
    frequency: {
      text: "In TRIUMPH-4 (adults with obesity or overweight and knee arthritis), Lilly reports decreased appetite as a side effect in 18.2% of people in the 12 mg group, versus 9.4% on a dummy shot (placebo).",
      sources: ["eli-lilly-2025-lilly-s-triple-agonist"],
      ledger: ["safety-appetite-mechanism-and-rate", "trials-triumph4-design"],
    },
    why: {
      text: "A review of this drug family says they act on the brainstem and on the hypothalamus, a brain area that helps control hunger, which lowers appetite. In a phase 2 study of 275 adults with type 2 diabetes, people in the 8 mg and 12 mg groups said on questionnaires that they felt less hungry than people on a dummy shot (placebo), and people whose hunger dropped more tended to lose more weight.",
      sources: ["dove-medical-2026-adverse-events-associated-incretin", "endocrine-journal-2025-physiology-clinical-applications-gip", "diabetes-obesity-2025-appetite-eating-attitudes-eating"],
      ledger: ["safety-gi-mechanism", "pk-receptor-gipr-appetite-brain", "claims-8-eat-less"],
    },
    reduce: {
      text: "A review warns that eating much less can lower iron and other nutrients. Experts suggest strength exercise and enough protein to protect muscle while weight comes off. In TRIUMPH-4, some people who stopped because of side effects said they felt they were losing too much weight.",
      sources: ["obesity-pillars-2026-micronutrient-risk-glp-1", "dove-medical-2026-adverse-events-associated-incretin", "eli-lilly-2025-lilly-s-triple-agonist"],
      ledger: ["gap-side-effect-mechanism-and-mitigation-fatigue-possible-low-iron", "safety-lean-mass", "trials-triumph4-discontinuation-weightloss"],
    },
    timing: { fromDays: 0.5, toDays: 7, text: "Shown for most of the days after a shot, while the drug is active." },
  },
  {
    id: "injection-site", name: "Redness, itching or soreness where the shot went in", organ: "injection_site", alsoOrgans: ["skin"], severity: "common",
    frequency: {
      text: "In the peer-reviewed TRIUMPH-1 paper, reactions such as redness, itching, swelling or soreness where the shot went in affected 12.2% of people in the 12 mg group, versus 3.8% on a dummy shot (placebo), and were more common at higher doses. In the TRANSCEND-T2D-1 trial (adults with type 2 diabetes), they were uncommon: 1% on 12 mg and 1% on placebo.",
      sources: ["new-england-2026-retatrutide-triple-hormone-receptor-3", "lancet-elsevier-2026-supplementary-appendix-bajaj-hs", "lancet-via-2026-efficacy-safety-retatrutide-people"],
      ledger: ["gap-phase3-serious-ae-rates-and-heart-rate-t1-injection-site", "gap-phase3-serious-ae-rates-and-heart-rate-transcend-injection-site", "trials-transcend1-a1c"],
    },
    why: {
      text: "For the related approved drug tirzepatide, these reactions were much more common in people whose immune system made antibodies (proteins that latch onto the drug): 11.3%, versus 1% in people who did not. The label reports this link but does not say what causes the reactions.",
      sources: ["eli-lilly-2026-zepbound-tirzepatide-injection"],
      ledger: ["gap-side-effect-mechanism-and-mitigation-isr-zepbound-antibody-link"],
    },
    reduce: {
      text: "The NHS lists red or itchy skin where the shot goes in as a common side effect of the related drug semaglutide, and says to talk to a pharmacist or doctor if a side effect bothers you or does not go away. Products from unregulated sellers add a separate worry: Australia's medicines regulator says nobody knows whether they are sterile, and that non-sterile injectable products can cause infections.",
      sources: ["nhs-nhs-2026-semaglutide-medicine-manage-type", "therapeutic-goods-2026-concerns-regarding-public-health", "therapeutic-goods-2026-tga-tests-counterfeit-retatrutide"],
      ledger: ["gap-side-effect-mechanism-and-mitigation-fatigue-nhs-common-and-when-to-ask", "gap-gray-contaminant-sterility-data-tga-sterility-unknown", "gap-gray-contaminant-sterility-data-tga-nonsterile-infection-anaphylaxis"],
    },
    timing: { fromDays: 0, toDays: 2, text: "Shown in the first day or two after a shot, at the spot where it went in." },
  },
  {
    id: "heart-rate", name: "Faster heart rate", organ: "heart", alsoOrgans: [], severity: "notable",
    frequency: {
      text: "In the peer-reviewed phase 2 trial (adults with obesity or overweight, without diabetes), heart rate measured with a wearable monitor at week 24 was on average about 9 beats per minute higher than at the start in the 12 mg group, versus less than 1 beat per minute on a dummy shot (placebo). In the larger TRIUMPH-1 trial, by week 80 the rise had shrunk to 1.5 to 2.7 beats per minute on retatrutide, versus 0.3 below the start on placebo. A normal resting heart rate is 60 to 100 beats per minute.",
      sources: ["new-england-2023-supplementary-appendix-table-s8", "new-england-2023-triple-hormone-receptor-agonist-2", "new-england-2026-supplementary-appendix-retatrutide-triple"],
      ledger: ["trials-ph2-heart-rate-24wk", "trials-ph2-obesity-design", "gap-phase3-serious-ae-rates-and-heart-rate-t1-pulse-week80"],
    },
    why: {
      text: "Hormones like glucagon and GLP-1 can make the heart beat faster. In human and monkey heart tissue, GLP-1 receptors sit in the heart's natural pacemaker. In a lab study on mouse heart tissue, retatrutide made that pacemaker beat faster, working through the glucagon receptor. That was animal tissue, so it may not apply exactly to people.",
      sources: ["naunyn-schmiedeberg-2025-contractile-effects-retatrutide-iso", "molecular-metabolism-2019-glucagon-like-peptide-1"],
      ledger: ["safety-heart-rate-mechanism-glucagon", "pk-receptor-glp1r-heart"],
    },
    reduce: {
      text: "After a single shot in the first human study, heart-rate changes were back near normal by about day 29. With weekly shots in TRIUMPH-1, the rise was highest at about week 20 in the 9 mg and 12 mg groups, then slowly came back down. Lilly's conference slides show that in TRIUMPH-2, after people stopped treatment, average heart rate at the follow-up visit was below where it started. Tell a doctor if your heart races or pounds for several minutes. Call 911 if a racing heart comes with passing out, chest pain, trouble breathing, unusual sweating, or feeling dizzy or light-headed.",
      sources: ["eli-lilly-2022-protocol-j1i-mc-gzbg", "new-england-2026-retatrutide-triple-hormone-receptor-3", "eli-lilly-2026-triumph-2-easd-2026", "novo-nordisk-2026-wegovy-semaglutide-injection", "u-s-2026-heart-palpitations-medlineplus-medical"],
      ledger: ["gap-pk-peak-and-steady-state-primary-sad-gi-timing", "gap-phase3-serious-ae-rates-and-heart-rate-t1-pulse-peaked-week20", "gap-phase3-serious-ae-rates-and-heart-rate-t2-pulse-after-stopping", "safety-redflag-doctor-today-heart", "gap-red-flags-us-911-split-palpitations-plus-symptoms-911"],
    },
    timing: { fromDays: 1, toDays: 28, cumulative: true, text: "After one shot in an early study, heart rate rose and was back near normal after about four weeks. With repeated shots it builds up. In large trials it was highest after several months of treatment, then eased." },
  },
  {
    id: "irregular-heartbeat", name: "Irregular heartbeat", organ: "heart", alsoOrgans: [], severity: "notable",
    frequency: {
      text: "In the peer-reviewed phase 2 trial (adults with obesity or overweight, without diabetes), irregular-heartbeat type events (arrhythmias) were reported in 11% of people in the 12 mg group, versus about 3% on a dummy shot (placebo). Most were mild to moderate, and the groups were small. In the much larger TRIUMPH-1 trial, serious or severe heart-rhythm problems were rare and no more common than on placebo: 0.9% in the 12 mg group and 0.9% on placebo.",
      sources: ["new-england-2023-supplementary-appendix-table-s8", "new-england-2023-triple-hormone-receptor-agonist-3", "new-england-2023-triple-hormone-receptor-agonist-2", "new-england-2026-retatrutide-triple-hormone-receptor-3"],
      ledger: ["trials-ph2-arrhythmia", "safety-arrhythmia-retatrutide-phase2", "trials-ph2-obesity-design", "gap-phase3-serious-ae-rates-and-heart-rate-t1-arrhythmia-serious"],
    },
    why: {
      text: "The trial reports we use do not give a cause for these events. A lab study on mouse heart tissue found retatrutide made the heart's natural pacemaker beat faster. Whether that is linked to rhythm problems in people is not known.",
      sources: ["new-england-2023-supplementary-appendix-table-s8", "naunyn-schmiedeberg-2025-contractile-effects-retatrutide-iso"],
      ledger: ["trials-ph2-arrhythmia", "safety-heart-rate-mechanism-glucagon"],
    },
    reduce: {
      text: "If you think your heart rhythm is off and there are no emergency signs, see a doctor so it can be checked with tests. Call 911 if a pounding or racing heart comes with passing out, chest pain, trouble breathing, unusual sweating, or feeling dizzy or light-headed.",
      sources: ["american-heart-2024-symptoms-diagnosis-monitoring-arrhythmia", "u-s-2026-heart-palpitations-medlineplus-medical"],
      ledger: ["gap-red-flags-us-911-split-aha-suspected-arrhythmia-see-professional", "gap-red-flags-us-911-split-palpitations-plus-symptoms-911"],
    },
    timing: { fromDays: 1, toDays: 7, text: "Not tied to a clear point after a shot in the trial reports. Shown while the drug is active." },
  },
  {
    id: "skin-burning", name: "Burning or tingling skin (dysesthesia)", organ: "skin", alsoOrgans: [], severity: "notable",
    frequency: {
      text: "In the peer-reviewed TRIUMPH-2 paper (adults with obesity and type 2 diabetes), 7% of people in the 12 mg group reported it, versus 1% on a dummy shot (placebo). In the peer-reviewed phase 2 trial (adults with obesity or overweight, without diabetes), skin-sensitivity effects were reported by about 13% of the 12 mg group, versus about 1% on placebo. Lilly's reports from other large trials give 12.5% in the 12 mg group of TRIUMPH-1 and 20.9% in the 12 mg group of TRIUMPH-4, each versus under 1% on placebo.",
      sources: ["lancet-via-2026-retatrutide-adults-obesity-type", "new-england-2023-supplementary-appendix-table-s8", "new-england-2023-triple-hormone-receptor-agonist-2", "eli-lilly-2026-lilly-s-triple-agonist", "eli-lilly-2025-lilly-s-triple-agonist"],
      ledger: ["trials-triumph2-dysesthesia-lancet", "safety-gi-retatrutide-triumph2-peer-reviewed", "trials-ph2-skin-sensation-by-arm", "trials-ph2-obesity-design", "trials-triumph1-dysesthesia", "trials-triumph4-dysesthesia"],
    },
    why: {
      text: "In the TRIUMPH trials, dysesthesia meant a burning feeling on the skin and similar odd skin sensations. Nobody knows exactly why it happens: European regulators reviewing the related drug semaglutide said the cause is unknown. One unproven idea is that these drugs change signals in the nerves that sense touch and pain, which carry GLP-1 and GIP receptors. With high-dose semaglutide it became more common as drug levels in the blood went up. In French safety reports on related drugs, it began 3 to 93 days after the first shot.",
      sources: ["eli-lilly-2026-was-dysesthesia-reported-as", "european-medicines-2025-wegovy---chmp", "springer-european-2026-dysesthesia-associated-glp-1", "novo-nordisk-2026-wegovy-semaglutide-injection"],
      ledger: ["gap-side-effect-mechanism-and-mitigation-dys-what-it-is-retatrutide-rates", "gap-side-effect-mechanism-and-mitigation-dys-ema-mechanism-unknown", "gap-side-effect-mechanism-and-mitigation-dys-mechanism-hypothesis-sensory-nerves", "gap-side-effect-mechanism-and-mitigation-dys-dose-and-blood-level-linked", "gap-side-effect-mechanism-and-mitigation-dys-onset-3-to-93-days-resolves-after-stopping"],
    },
    reduce: {
      text: "In TRIUMPH-1 and in the phase 2 trial, most cases were mild to moderate. For high-dose semaglutide, European regulators found that episodes that cleared on their own typically took about 2 months (63 days), and about 15% had not cleared when the studies ended. Experts say doctors handle it case by case, based on how much it affects daily life. Tell a doctor about burning or tingling skin, especially if it spreads or does not stop.",
      sources: ["eli-lilly-2026-lilly-s-triple-agonist", "new-england-2023-triple-hormone-receptor-agonist", "european-medicines-2025-wegovy---chmp", "springer-european-2026-dysesthesia-associated-glp-1"],
      ledger: ["trials-triumph1-dysesthesia-course", "trials-ph2-skin-sensation-mild", "gap-side-effect-mechanism-and-mitigation-dys-ema-median-recovery-no-change", "gap-side-effect-mechanism-and-mitigation-dys-ema-unrecovered-and-dose-dependent-recovery", "gap-side-effect-mechanism-and-mitigation-dys-management-depends-on-impact"],
    },
    timing: { fromDays: 3, toDays: 14, cumulative: true, text: "With high-dose semaglutide, a related drug, it was more common at higher drug levels in the blood. In reports on related drugs it began anywhere from days to about three months after the first shot, and episodes often lasted weeks to months." },
  },
  {
    id: "uti", name: "Bladder infection (UTI)", organ: "bladder", alsoOrgans: [], severity: "notable",
    frequency: {
      text: "In TRIUMPH-1 (adults with obesity or overweight, without diabetes), Lilly reports urinary tract infections in 8.4% of people in the 12 mg group, versus 5.3% on a dummy shot (placebo). Across the retatrutide groups it ranged from 7.5% to 8.8%.",
      sources: ["eli-lilly-2026-lilly-s-triple-agonist"],
      ledger: ["trials-triumph1-uti", "safety-gi-retatrutide-triumph1-rates"],
    },
    why: {
      text: "The trial reports we use do not explain why it was more common. In general, not drinking enough fluids is one thing that raises the risk of a UTI.",
      sources: ["eli-lilly-2026-lilly-s-triple-agonist", "nhs-nhs-2025-urinary-tract-infections-utis"],
      ledger: ["trials-triumph1-uti", "gap-side-effect-mechanism-and-mitigation-uti-general-prevention-fluids"],
    },
    reduce: {
      text: "Lilly said the UTIs in TRIUMPH-1 were mostly mild to moderate. General NHS advice, not specific to retatrutide: drinking plenty of fluids, mostly water, helps prevent UTIs. Tell a doctor about burning when you pee, needing to pee often, or a fever.",
      sources: ["eli-lilly-2026-lilly-s-triple-agonist", "nhs-nhs-2025-urinary-tract-infections-utis"],
      ledger: ["trials-triumph1-dysesthesia-course", "gap-side-effect-mechanism-and-mitigation-uti-general-prevention-fluids"],
    },
    timing: { fromDays: 3, toDays: 56, cumulative: true, text: "Not tied to a clear point after a shot. Shown across the weeks of treatment." },
  },
  {
    id: "low-blood-pressure", name: "Dizziness or low blood pressure", organ: "blood", alsoOrgans: ["brain", "heart"], severity: "notable",
    frequency: {
      text: "In the peer-reviewed TRIUMPH-2 paper (adults with obesity and type 2 diabetes), low blood pressure was reported by 6% of people in the 12 mg group, versus under 1% on a dummy shot (placebo). In the phase 2 trial's registry results (adults with obesity or overweight, without diabetes), dizziness was reported by about 8% of the 12 mg group, versus about 3% on placebo; those groups were small.",
      sources: ["lancet-via-2026-retatrutide-adults-obesity-type", "clinicaltrials-gov-2023-study-ly3437943-participants-who", "new-england-2023-triple-hormone-receptor-agonist-2"],
      ledger: ["trials-triumph2-hypotension", "safety-gi-retatrutide-triumph2-peer-reviewed", "gap-side-effect-mechanism-and-mitigation-dizzy-reta-phase2", "trials-ph2-obesity-design"],
    },
    why: {
      text: "Labels for the related drugs tirzepatide and semaglutide say some low-blood-pressure episodes came with stomach side effects and fluid loss (dehydration), and that they were more common in people also taking blood-pressure pills. In the first single-shot study of retatrutide, blood pressure dipped and was back near normal by about day 29.",
      sources: ["eli-lilly-2026-zepbound-tirzepatide-injection", "novo-nordisk-2026-wegovy-semaglutide-injection", "eli-lilly-2022-protocol-j1i-mc-gzbg"],
      ledger: ["gap-side-effect-mechanism-and-mitigation-hypo-zepbound-bp-meds-and-dehydration", "gap-side-effect-mechanism-and-mitigation-hypo-wegovy-volume-loss-bp-meds", "gap-pk-peak-and-steady-state-primary-sad-gi-timing"],
    },
    reduce: {
      text: "NHS tips for dizzy spells: lie down until it passes, then get up slowly, moving from lying to sitting to standing, and drink plenty of water. The NHS also says not to drive, ride a bike or use machinery while a medicine like this makes you dizzy. If low blood pressure keeps causing symptoms, a doctor may change your other medicines. That is a doctor's decision, not something to do on your own.",
      sources: ["nhs-nhs-2023-dizziness", "nhs-nhs-2023-low-blood-pressure-hypotension", "nhs-nhs-2026-tirzepatide-medicine-manage-type"],
      ledger: ["gap-side-effect-mechanism-and-mitigation-dizzy-nhs-selfcare", "gap-side-effect-mechanism-and-mitigation-hypo-nhs-stand-up-slowly", "gap-side-effect-mechanism-and-mitigation-dizzy-nhs-do-not-drive", "gap-side-effect-mechanism-and-mitigation-hypo-nhs-doctor-may-change-medicines"],
    },
    timing: { fromDays: 1, toDays: 10, text: "Most likely in the days after a shot, especially when stomach side effects cause fluid loss. In an early single-shot study, blood pressure was back near normal within about four weeks." },
  },
  {
    id: "fatigue", name: "Tiredness (fatigue)", organ: "muscle", alsoOrgans: ["blood"], severity: "common",
    frequency: {
      text: "In the phase 2 trial's registry results (adults with obesity or overweight, without diabetes), tiredness was reported by about 10% of people in the 12 mg group, versus about 4% on a dummy shot (placebo). The groups were small.",
      sources: ["clinicaltrials-gov-2023-study-ly3437943-participants-who", "new-england-2023-triple-hormone-receptor-agonist-2"],
      ledger: ["gap-side-effect-mechanism-and-mitigation-fatigue-reta-phase2", "trials-ph2-obesity-design"],
    },
    why: {
      text: "The cause is not proven. One possible contributor: eating much less can lower iron and other nutrients, and low iron (anemia, a shortage of healthy red blood cells) can show up as tiredness and getting out of breath easily.",
      sources: ["obesity-pillars-2026-micronutrient-risk-glp-1"],
      ledger: ["gap-side-effect-mechanism-and-mitigation-fatigue-possible-low-iron"],
    },
    reduce: {
      text: "General NHS advice: see a doctor if you have felt tired for a few weeks without knowing why, if it affects daily life, or if it comes with weight loss or mood changes. A doctor may check blood tests for things like anemia.",
      sources: ["nhs-nhs-2023-tiredness-fatigue"],
      ledger: ["gap-side-effect-mechanism-and-mitigation-fatigue-nhs-when-to-see-gp"],
    },
    timing: { fromDays: 1, toDays: 6, text: "Can come and go. Shown in the days after a shot, while the drug is active." },
  },
  {
    id: "headache", name: "Headache", organ: "brain", alsoOrgans: [], severity: "notable",
    frequency: {
      text: "In the phase 2 trial's registry results (adults with obesity or overweight, without diabetes), headache was reported by about 6% of people in the 12 mg group and by no one on a dummy shot (placebo). The groups were small.",
      sources: ["clinicaltrials-gov-2023-study-ly3437943-participants-who", "new-england-2023-triple-hormone-receptor-agonist-2"],
      ledger: ["gap-side-effect-mechanism-and-mitigation-headache-reta-phase2", "trials-ph2-obesity-design"],
    },
    why: {
      text: "No source gives a proven cause. Two common headache triggers are skipping meals and not drinking enough, and both can happen when a drug cuts appetite or causes vomiting or diarrhea. In people with type 2 diabetes, headache can also be a sign of low blood sugar.",
      sources: ["nhs-nhs-2024-headaches", "novo-nordisk-2026-wegovy-semaglutide-injection"],
      ledger: ["gap-side-effect-mechanism-and-mitigation-headache-nhs-causes-and-selfcare", "gap-side-effect-mechanism-and-mitigation-dizzy-headache-low-blood-sugar"],
    },
    reduce: {
      text: "The NHS suggests drinking plenty of water and not skipping meals. For the related drug semaglutide, it says to talk to a pharmacist or doctor if a side effect bothers you or does not go away.",
      sources: ["nhs-nhs-2024-headaches", "nhs-nhs-2026-semaglutide-medicine-manage-type"],
      ledger: ["gap-side-effect-mechanism-and-mitigation-headache-nhs-causes-and-selfcare", "gap-side-effect-mechanism-and-mitigation-fatigue-nhs-common-and-when-to-ask"],
    },
    timing: { fromDays: 1, toDays: 4, text: "Shown in the days after a shot, when stomach side effects and eating less are most likely." },
  },
  {
    id: "hair-loss", name: "Hair shedding", organ: "skin", alsoOrgans: [], severity: "notable",
    frequency: {
      text: "The retatrutide trials give no exact rate. Lilly's conference slides show hair loss was not on TRIUMPH-1's list of side effects that affected at least 5% of any group. For the related approved drug tirzepatide, the FDA label lists hair loss in 4% to 5% of people across its dose groups, versus 1% on a dummy shot (placebo), and it was much more common in women (7.1%) than in men (0.5%).",
      sources: ["eli-lilly-2026-first-phase-3-obesity", "eli-lilly-2026-zepbound-tirzepatide-injection"],
      ledger: ["gap-phase3-serious-ae-rates-and-heart-rate-t1-alopecia-not-common", "gap-side-effect-mechanism-and-mitigation-fatigue-zepbound-rates", "gap-side-effect-mechanism-and-mitigation-hair-zepbound-linked-to-weight-loss-women"],
    },
    why: {
      text: "The most likely reason is telogen effluvium: a stressful change, like fast weight loss, pushes many hairs into their resting phase at once, so they fall out together later. The tirzepatide label ties hair loss to weight loss, and dermatologists list losing 20 pounds or more as a common trigger.",
      sources: ["obesity-pillars-2026-micronutrient-risk-glp-1", "eli-lilly-2026-zepbound-tirzepatide-injection", "american-academy-2026-do-you-have-hair"],
      ledger: ["gap-side-effect-mechanism-and-mitigation-hair-mechanism-telogen-effluvium", "gap-side-effect-mechanism-and-mitigation-hair-zepbound-linked-to-weight-loss-women", "gap-side-effect-mechanism-and-mitigation-hair-aad-weight-loss-trigger"],
    },
    reduce: {
      text: "This shedding usually shows up a few months after the trigger; a dermatology review says about 3 months after starting a drug. It is usually temporary: experts say it stops once the weight loss stops, and hair usually looks full again within 6 to 9 months, though it can last longer if the stress continues. Dermatologists advise getting enough protein, vitamins and minerals. Whether hair regrows after stopping these drugs still needs more study.",
      sources: ["american-academy-2026-do-you-have-hair", "dermatology-therapy-2026-hair-loss-patients-glucagon"],
      ledger: ["gap-side-effect-mechanism-and-mitigation-hair-aad-starts-months-later", "gap-side-effect-mechanism-and-mitigation-hair-review-3-months-after-start", "gap-side-effect-mechanism-and-mitigation-hair-review-stops-when-weight-loss-stops", "gap-side-effect-mechanism-and-mitigation-hair-aad-recovers-6-to-9-months", "gap-side-effect-mechanism-and-mitigation-hair-review-protein-micronutrients"],
    },
    timing: { fromDays: 56, toDays: 70, cumulative: true, text: "Usually shows up a few months after fast weight loss begins. It follows weeks of weight loss, not any one shot." },
  },
  {
    id: "muscle-loss", name: "Losing muscle along with fat", organ: "muscle", alsoOrgans: ["fat"], severity: "notable",
    frequency: {
      text: "In a body-scan study from a phase 2 retatrutide trial in people with type 2 diabetes, some of the weight lost was lean tissue (muscle and other non-fat tissue), in about the same share as with other obesity treatments. Only 103 people had scans at the start and the end. Across this drug family, lean tissue typically makes up about 20 to 30% of the weight lost.",
      sources: ["lancet-diabetes-2025-effects-retatrutide-body-composition", "dove-medical-2026-adverse-events-associated-incretin"],
      ledger: ["claims-2-lean-mass-also-lost", "claims-2-small-diabetes-only-sample", "safety-lean-mass"],
    },
    why: {
      text: "When people lose weight on these drugs, some of what they lose is muscle and other lean tissue, not just fat. A review says the share is similar to dieting or weight-loss surgery.",
      sources: ["dove-medical-2026-adverse-events-associated-incretin"],
      ledger: ["safety-lean-mass"],
    },
    reduce: {
      text: "Strength exercise and enough protein are the main ways experts suggest to protect muscle. No retatrutide trial has shown that it builds muscle.",
      sources: ["dove-medical-2026-adverse-events-associated-incretin", "lancet-diabetes-2025-effects-retatrutide-body-composition"],
      ledger: ["safety-lean-mass", "claims-2-small-diabetes-only-sample"],
    },
    timing: { fromDays: 14, toDays: 56, cumulative: true, text: "Builds slowly over weeks to months as weight comes off, not after any one shot." },
  },
  {
    id: "low-blood-sugar", name: "Low blood sugar (with some diabetes medicines)", organ: "blood", alsoOrgans: ["pancreas", "brain"], severity: "notable",
    frequency: {
      text: "In the peer-reviewed TRANSCEND-T2D-1 trial, where people with type 2 diabetes took retatrutide on its own, blood sugar below 54 mg/dL happened in 1 of 136 people on 12 mg and none of 134 on a dummy shot (placebo), and no one had a severe low. In TRIUMPH-2 (people with type 2 diabetes), Lilly's conference slides show clinically important lows (below 54 mg/dL, or severe) in 3.1% of the 12 mg group, versus 1.7% on placebo. Among people also taking a sulfonylurea pill, it was 5.3% on 12 mg versus 1.4% on placebo. No one had a severe low that needed someone else's help.",
      sources: ["lancet-elsevier-2026-supplementary-appendix-bajaj-hs", "eli-lilly-2026-triumph-2-easd-2026"],
      ledger: ["gap-phase3-serious-ae-rates-and-heart-rate-transcend-hypoglycemia", "gap-phase3-serious-ae-rates-and-heart-rate-t2-hypoglycemia", "gap-phase3-serious-ae-rates-and-heart-rate-t2-hypoglycemia-sulfonylurea"],
    },
    why: {
      text: "The GLP-1 part of these drugs helps the pancreas release insulin, more so when blood sugar is high. Insulin and sulfonylurea pills (older diabetes pills that make the body release more insulin) also lower blood sugar, so using them together makes a low more likely.",
      sources: ["molecular-metabolism-2019-glucagon-like-peptide-1", "eli-lilly-2026-zepbound-tirzepatide-injection-prescribing", "eli-lilly-2026-triumph-2-easd-2026"],
      ledger: ["pk-receptor-glp1-actions", "gap-red-flags-us-911-split-low-sugar-risk-with-insulin", "gap-phase3-serious-ae-rates-and-heart-rate-t2-hypoglycemia-sulfonylurea"],
    },
    reduce: {
      text: "Warning signs include dizziness, sweating, shakiness, confusion, headache, blurred vision and a fast heartbeat. If signs do not get better after eating a snack with sugar, get a ride to the emergency room (do not drive yourself) or call 911. If someone passes out and no glucagon (an emergency sugar-raising medicine) is on hand, call 911 right away.",
      sources: ["eli-lilly-2026-zepbound-tirzepatide-injection-prescribing", "u-s-2026-low-blood-sugar-medlineplus", "american-diabetes-2026-low-blood-glucose-hypoglycemia"],
      ledger: ["gap-red-flags-us-911-split-low-sugar-signs-include-fast-heartbeat", "gap-red-flags-us-911-split-low-sugar-not-improving-er", "gap-red-flags-us-911-split-ada-unconscious-911"],
    },
    timing: { fromDays: 1, toDays: 5, text: "Can happen at any time, mainly in people who also use insulin or sulfonylurea pills. Shown here in the days after a shot, when drug levels are highest." },
  },
  {
    id: "diabetic-eye", name: "Diabetic eye damage getting worse for a while", organ: "eyes", alsoOrgans: [], severity: "notable",
    frequency: {
      text: "The retatrutide trial reports we use give no rate. The FDA label for the related drug tirzepatide reports temporary worsening in people with type 2 diabetes who already have eye damage (diabetic retinopathy).",
      sources: ["eli-lilly-2026-zepbound-tirzepatide-injection"],
      ledger: ["safety-retinopathy"],
    },
    why: {
      text: "When high blood sugar is brought down quickly, existing diabetic eye damage can get worse for a while.",
      sources: ["eli-lilly-2026-zepbound-tirzepatide-injection"],
      ledger: ["safety-retinopathy"],
    },
    reduce: {
      text: "Anyone with type 2 diabetes using these drugs should tell a doctor about any change in their vision. The NHS says not to drive, ride a bike or use machinery while a medicine like this causes vision problems.",
      sources: ["eli-lilly-2026-zepbound-tirzepatide-injection", "nhs-nhs-2026-tirzepatide-medicine-manage-type"],
      ledger: ["safety-retinopathy", "gap-side-effect-mechanism-and-mitigation-dizzy-nhs-do-not-drive"],
    },
    timing: { fromDays: 14, toDays: 56, cumulative: true, text: "Linked to blood sugar coming down quickly over weeks of treatment, in people with type two diabetes." },
  },
  {
    id: "dehydration-kidney", name: "Dehydration and kidney strain", organ: "kidneys", alsoOrgans: [], severity: "serious",
    frequency: {
      text: "Rare in the peer-reviewed TRIUMPH-1 paper: serious or severe sudden kidney problems affected 2 of 582 people (0.3%) in the 12 mg group and none on a dummy shot (placebo). In the TRIUMPH-2 paper's appendix, serious kidney or urinary-tract events affected 1 of 286 people on 12 mg and none on placebo.",
      sources: ["new-england-2026-retatrutide-triple-hormone-receptor-3", "lancet-elsevier-2026-supplementary-appendix-bellido-v"],
      ledger: ["gap-phase3-serious-ae-rates-and-heart-rate-t1-acute-renal", "gap-phase3-serious-ae-rates-and-heart-rate-t2-renal-sae"],
    },
    why: {
      text: "Throwing up, diarrhea and nausea can drain the body of fluid, and that dehydration can harm the kidneys. For the related drug tirzepatide, the label says this was sometimes bad enough to need dialysis (a machine that cleans the blood). The UK medicines regulator warns that stomach side effects of these drugs sometimes cause dehydration severe enough to need hospital care.",
      sources: ["eli-lilly-2026-zepbound-tirzepatide-injection", "medicines-healthcare-2026-glp-1-medicines-weight"],
      ledger: ["safety-dehydration-kidney", "gap-side-effect-mechanism-and-mitigation-hypo-mhra-dehydration-hospital"],
    },
    reduce: {
      text: "The official patient guide for the related drug tirzepatide says drinking fluids helps lower the risk, and to tell a doctor if stomach symptoms do not stop. Contact a doctor right away if someone has not peed for 8 hours or more or has thrown up 3 or more times in one day. Call 911 if a dehydrated person passes out, becomes confused or has a seizure.",
      sources: ["eli-lilly-2026-zepbound-tirzepatide-injection", "u-s-2025-nausea-vomiting", "u-s-2025-dehydration-medlineplus-medical-encyclopedia"],
      ledger: ["gap-side-effect-mechanism-and-mitigation-hypo-mg-drink-fluids", "gap-red-flags-us-911-split-no-urine-8h-doctor-today", "gap-red-flags-us-911-split-dehydration-911"],
    },
    timing: { fromDays: 1, toDays: 7, text: "Follows vomiting or diarrhea, so it is most likely in the days after a shot." },
  },
  {
    id: "gallbladder", name: "Gallbladder problems (such as gallstones)", organ: "gallbladder", alsoOrgans: ["liver"], severity: "serious",
    frequency: {
      text: "In the peer-reviewed TRIUMPH-1 paper, serious or severe gallbladder and bile-duct problems (such as gallstone attacks or an inflamed gallbladder) affected 0.7% of people in the 12 mg group and 0.7% on a dummy shot (placebo); the 4 mg group had the highest rate, 1.7%. In the TRANSCEND-T2D-1 trial (adults with type 2 diabetes), gallstones of any severity were reported in 3 of 136 people on 12 mg and none of 134 on placebo.",
      sources: ["new-england-2026-retatrutide-triple-hormone-receptor-3", "lancet-elsevier-2026-supplementary-appendix-bajaj-hs", "lancet-via-2026-efficacy-safety-retatrutide-people"],
      ledger: ["gap-phase3-serious-ae-rates-and-heart-rate-t1-gallbladder-serious", "gap-phase3-serious-ae-rates-and-heart-rate-transcend-cholelithiasis", "trials-transcend1-a1c"],
    },
    why: {
      text: "For the related drug tirzepatide, the FDA label links gallbladder problems to weight loss itself. Losing weight quickly loads bile (the digestive juice stored in the gallbladder) with cholesterol and makes the gallbladder squeeze less, so stones can form.",
      sources: ["eli-lilly-2026-zepbound-tirzepatide-injection", "dove-medical-2026-adverse-events-associated-incretin"],
      ledger: ["safety-gallbladder-rates-and-cause", "safety-gallbladder-mechanism"],
    },
    reduce: {
      text: "Tell a doctor right away about pain in the upper belly, fever, yellow skin or eyes, or pale, clay-colored poop. Call 911 or get help right away for sudden, sharp belly pain or a belly that is hard and stiff to touch.",
      sources: ["eli-lilly-2026-zepbound-tirzepatide-injection-prescribing", "u-s-2026-abdominal-pain-medlineplus-medical"],
      ledger: ["gap-red-flags-us-911-split-label-gallbladder-right-away", "gap-red-flags-us-911-split-sudden-sharp-belly-pain-911"],
    },
    timing: { fromDays: 14, toDays: 56, cumulative: true, text: "Linked to weight loss, so it is more likely after weeks to months of use than in the first days." },
  },
  {
    id: "pancreatitis", name: "Inflamed pancreas (pancreatitis)", organ: "pancreas", alsoOrgans: [], severity: "serious",
    frequency: {
      text: "Rare. In the peer-reviewed TRIUMPH-1 paper, an expert panel confirmed 4 cases among 582 people in the 12 mg group and 2 among 586 on a dummy shot (placebo), 10 in total across all groups. The researchers said that is too few to tell whether retatrutide raises the risk. In the phase 2 trial, one person in the 12 mg group had a serious case about two weeks after starting; the drug was stopped and the person recovered.",
      sources: ["new-england-2026-retatrutide-triple-hormone-receptor-3", "new-england-2023-triple-hormone-receptor-agonist"],
      ledger: ["gap-phase3-serious-ae-rates-and-heart-rate-t1-pancreatitis", "gap-phase3-serious-ae-rates-and-heart-rate-t1-pancreatitis-too-few", "trials-ph2-pancreatitis"],
    },
    why: {
      text: "The sources we use do not explain why these drugs might inflame the pancreas. Pancreatitis has happened with drugs in this family, and some cases reported after those drugs were approved ended in death. In TRIUMPH-1, lipase, an enzyme made by the pancreas, rose by 27.5% to 31.1% on retatrutide by week 80, versus 6.2% on placebo. A higher enzyme level on its own does not mean someone has pancreatitis.",
      sources: ["eli-lilly-2026-zepbound-tirzepatide-injection", "new-england-2026-supplementary-appendix-retatrutide-triple"],
      ledger: ["safety-pancreatitis-label", "gap-phase3-serious-ae-rates-and-heart-rate-t1-lipase-rise"],
    },
    reduce: {
      text: "Severe belly pain that will not go away, sometimes spreading to the back, with or without throwing up, can mean an inflamed pancreas. The official guide for the related drug tirzepatide says to stop that drug and call a doctor right away. Call 911 for sudden, sharp belly pain or a belly that is hard and stiff to touch.",
      sources: ["eli-lilly-2026-zepbound-tirzepatide-injection-prescribing", "u-s-2026-abdominal-pain-medlineplus-medical"],
      ledger: ["gap-red-flags-us-911-split-label-pancreatitis-stop-call", "gap-red-flags-us-911-split-sudden-sharp-belly-pain-911"],
    },
    timing: { fromDays: 2, toDays: 56, cumulative: true, text: "Rare, and it can happen at any point. In one trial case it began about two weeks after the first shot." },
  },
  {
    id: "allergy", name: "Serious allergic reaction", organ: "skin", alsoOrgans: ["lungs"], severity: "serious",
    frequency: {
      text: "Rare in the peer-reviewed TRIUMPH-1 paper, and no more common than on a dummy shot (placebo): serious or severe allergic-type reactions affected 1 of 582 people (0.2%) in the 12 mg group, versus 2 of 586 (0.3%) on placebo.",
      sources: ["new-england-2026-retatrutide-triple-hormone-receptor-3"],
      ledger: ["gap-phase3-serious-ae-rates-and-heart-rate-t1-hypersensitivity"],
    },
    why: {
      text: "Serious allergic reactions, including anaphylaxis (a sudden, life-threatening reaction), have been reported with the related drug tirzepatide. Australia's medicines regulator also warns that injectable products made in dirty or non-sterile conditions can cause dangerous allergic reactions.",
      sources: ["eli-lilly-2026-zepbound-tirzepatide-injection", "therapeutic-goods-2026-tga-tests-counterfeit-retatrutide"],
      ledger: ["safety-allergy-anaphylaxis", "gap-gray-contaminant-sterility-data-tga-nonsterile-infection-anaphylaxis"],
    },
    reduce: {
      text: "Call 911 for signs of a severe allergic reaction: swelling of the face, lips, tongue or throat, trouble breathing or swallowing, fainting, or a very fast heartbeat. It is an emergency.",
      sources: ["u-s-2026-anaphylaxis-medlineplus-medical-encyclopedia", "eli-lilly-2026-zepbound-tirzepatide-injection-prescribing"],
      ledger: ["safety-redflag-911-anaphylaxis", "gap-red-flags-us-911-split-allergy-signs-include-racing-heart"],
    },
    timing: { fromDays: 0, toDays: 2, text: "Shown right after a shot here, but it can happen at any time. Treat it as an emergency whenever it happens." },
  },
];
