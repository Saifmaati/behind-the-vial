// PeptideScope: retatrutide, the full first entry.
//
// SAMPLE FILE. Schema-complete placeholder content so every renderer, the 3D
// body and the timeline can be built before the verified research lands. The
// research pass REPLACES this whole file. Rules for the samples:
//   - every object carries sample: true;
//   - numbers shown as text are obvious placeholders ("00%", "00 days");
//   - numbers that only drive chart/curve geometry use obviously artificial
//     repdigit steps (11, 22, 33...) so the layout can be checked. None of
//     them are real values.
// tests/data.test.mjs fails while any sample remains (unless BTV_ALLOW_SAMPLES=1).
//
// Not one field here is a dose, an amount to inject, or an instruction.

const SAMPLE = { sample: true };
const J1 = 'sample-journal-1';
const J2 = 'sample-journal-2';
const J3 = 'sample-journal-3';
const J4 = 'sample-journal-4';
const J5 = 'sample-journal-5';
const REG = 'sample-regulator-1';
const LABEL = 'sample-label-1';
const CO = 'sample-company-1';
const TR = 'sample-registry-1';
const HS = 'sample-health-1';
const NEWS = 'sample-news-1';

export default {
  id: 'retatrutide',
  name: 'Retatrutide',
  aka: ['LY3437943'],
  developer: 'Eli Lilly',
  route: 'Once-weekly injection under the skin',
  sample: true,

  status: {
    level: 'in-trials',
    label: 'Investigational: not approved anywhere',
    detail: 'Sample text. It is still being tested in clinical trials. No regulator has approved it, so anything sold online is not a licensed medicine.',
    sources: [REG, TR],
    ...SAMPLE,
  },

  what: [
    { text: 'Sample text. Retatrutide is a lab-made peptide, a short chain of amino acids, designed to copy several of the gut hormones your body releases after a meal.', sources: [J4], ...SAMPLE },
    { text: 'Sample text. It is being studied as a once-a-week shot for obesity, type 2 diabetes and related conditions. People in the trials took it under medical supervision.', sources: [J2, TR], ...SAMPLE },
  ],

  how: [
    { receptor: 'GLP-1', organs: ['brain', 'pancreas', 'stomach'], effect: 'Sample text. Turns down hunger, helps the pancreas release insulin when blood sugar is high, and slows how fast the stomach empties.', sources: [J4], ...SAMPLE },
    { receptor: 'GIP', organs: ['pancreas', 'fat'], effect: 'Sample text. Adds to the insulin response and changes how fat tissue stores energy.', sources: [J4], ...SAMPLE },
    { receptor: 'Glucagon', organs: ['liver', 'fat'], effect: 'Sample text. Pushes the liver to use more energy and may lower liver fat.', sources: [J4, J5], ...SAMPLE },
  ],

  pk: {
    // Artificial placeholder values: they only shape the normalized curve.
    halfLifeDays: 4.4,
    tmaxDays: 1.1,
    tmaxEstimate: true,
    intervalDays: 7,
    steadyStateDoses: 4,
    phases: [
      { id: 'onset', tDays: 0.22, label: 'Onset', display: '00 hours', text: 'Sample text. When the drug first reaches the blood in a meaningful amount.', sources: [J3], estimate: true, ...SAMPLE },
      { id: 'peak', tDays: 1.1, label: 'Peak', display: '00 days', text: 'Sample text. The highest level in the blood after one shot.', sources: [J3], estimate: true, ...SAMPLE },
      { id: 'halfLife', tDays: 5.5, label: 'Half-life', display: '00 days', text: 'Sample text. How long it takes for the level to fall by half.', sources: [J3], ...SAMPLE },
      { id: 'clearance', tDays: 22, label: 'Mostly cleared', display: '00 weeks', text: 'Sample text. Roughly when almost all of one shot has left the body.', sources: [J3], estimate: true, ...SAMPLE },
    ],
    sources: [J3],
    ...SAMPLE,
  },

  absorption: {
    steps: [
      { id: 'depot', title: 'A small pool forms under the skin', text: 'Sample text. The liquid settles in the fatty layer under the skin and forms a depot that releases the drug slowly.', sources: [J3], ...SAMPLE },
      { id: 'capillary', title: 'It seeps into tiny blood vessels', text: 'Sample text. Molecules move from the depot into nearby capillaries a little at a time.', sources: [J3], ...SAMPLE },
      { id: 'lymph', title: 'Some travels through the lymph', text: 'Sample text. Larger molecules can also drain through lymph vessels before reaching the blood.', sources: [J3], ...SAMPLE },
      { id: 'blood', title: 'It rides the bloodstream', text: 'Sample text. Once in the blood, it binds to a carrier protein that slows how fast the body clears it.', sources: [J3, J4], ...SAMPLE },
      { id: 'distribution', title: 'It reaches the organs it acts on', text: 'Sample text. The blood carries it to the brain, pancreas, stomach, liver and fat tissue, where its receptors are.', sources: [J4], ...SAMPLE },
    ],
    sites: {
      abdomen: { text: 'Sample text. How absorption from the belly compares with the other areas studied.', sources: [LABEL], ...SAMPLE },
      thigh: { text: 'Sample text. How absorption from the thigh compares with the other areas studied.', sources: [LABEL], ...SAMPLE },
      arm: { text: 'Sample text. How absorption from the upper arm compares with the other areas studied.', sources: [LABEL], ...SAMPLE },
    },
    ...SAMPLE,
  },

  targets: [
    { organ: 'brain', receptors: ['GLP-1', 'GIP'], effect: 'Sample text. Less hunger, feeling full sooner.', sources: [J4], ...SAMPLE },
    { organ: 'pancreas', receptors: ['GLP-1', 'GIP'], effect: 'Sample text. More insulin when blood sugar is high.', sources: [J4], ...SAMPLE },
    { organ: 'stomach', receptors: ['GLP-1'], effect: 'Sample text. Slower emptying, so food stays longer.', sources: [J4], ...SAMPLE },
    { organ: 'liver', receptors: ['Glucagon'], effect: 'Sample text. More energy use, less stored fat.', sources: [J4, J5], ...SAMPLE },
    { organ: 'fat', receptors: ['GIP', 'Glucagon'], effect: 'Sample text. Changes in how fat is stored and burned.', sources: [J4], ...SAMPLE },
    { organ: 'heart', receptors: ['Glucagon', 'GLP-1'], effect: 'Sample text. Resting heart rate can rise.', sources: [J2], ...SAMPLE },
  ],

  sideEffects: [
    {
      id: 'nausea', name: 'Nausea', organ: 'stomach', alsoOrgans: ['brain'], severity: 'common',
      frequency: { text: 'About 00 in 100 people in trials (sample)', sources: [J2], ...SAMPLE },
      why: { text: 'Sample text. The stomach empties more slowly and the brain\'s fullness signals get louder, which can feel like queasiness.', sources: [J4], ...SAMPLE },
      reduce: { text: 'Sample text. In trials it was most common early on and usually eased over the following weeks. Smaller meals and stopping eating when full may help.', sources: [J2, HS], ...SAMPLE },
      timing: { fromDays: 0.3, toDays: 4, text: 'Sample window: the first days after a shot' },
      ...SAMPLE,
    },
    {
      id: 'vomiting', name: 'Vomiting', organ: 'stomach', alsoOrgans: [], severity: 'common',
      frequency: { text: 'About 00 in 100 people in trials (sample)', sources: [J2], ...SAMPLE },
      why: { text: 'Sample text. When the stomach is slow to empty and full, the body may push food back up.', sources: [J4], ...SAMPLE },
      reduce: { text: 'Sample text. Sip fluids to avoid dehydration. Vomiting that will not stop needs a doctor the same day.', sources: [HS], ...SAMPLE },
      timing: { fromDays: 0.5, toDays: 3, text: 'Sample window: around the peak' },
      ...SAMPLE,
    },
    {
      id: 'diarrhea', name: 'Diarrhea', organ: 'small_intestine', alsoOrgans: ['large_intestine'], severity: 'common',
      frequency: { text: 'About 00 in 100 people in trials (sample)', sources: [J2], ...SAMPLE },
      why: { text: 'Sample text. Gut hormones change how fast the bowel moves and how much water it holds.', sources: [J4], ...SAMPLE },
      reduce: { text: 'Sample text. Usually short-lived. Drink enough fluids. See a doctor if it lasts or you feel dizzy.', sources: [HS], ...SAMPLE },
      timing: { fromDays: 0.5, toDays: 5, text: 'Sample window: the first week' },
      ...SAMPLE,
    },
    {
      id: 'constipation', name: 'Constipation', organ: 'large_intestine', alsoOrgans: [], severity: 'common',
      frequency: { text: 'About 00 in 100 people in trials (sample)', sources: [J2], ...SAMPLE },
      why: { text: 'Sample text. The whole gut slows down, and eating less means less bulk moving through.', sources: [J4], ...SAMPLE },
      reduce: { text: 'Sample text. Fluids, fiber and movement can help. Ask a pharmacist before taking a laxative.', sources: [HS], ...SAMPLE },
      timing: { fromDays: 2, toDays: 10, text: 'Sample window: later in the week' },
      ...SAMPLE,
    },
    {
      id: 'appetite', name: 'Much less appetite', organ: 'brain', alsoOrgans: [], severity: 'common',
      frequency: { text: 'About 00 in 100 people in trials (sample)', sources: [J2], ...SAMPLE },
      why: { text: 'Sample text. This is the main intended effect: hunger centers in the brain quiet down.', sources: [J4], ...SAMPLE },
      reduce: { text: 'Sample text. Eating too little can leave you short of protein and nutrients. A clinician can help you track this.', sources: [HS], ...SAMPLE },
      timing: { fromDays: 0.5, toDays: 7, text: 'Sample window: most of the week' },
      ...SAMPLE,
    },
    {
      id: 'heart-rate', name: 'Faster resting heart rate', organ: 'heart', alsoOrgans: [], severity: 'notable',
      frequency: { text: 'Sample text: average rise of 00 beats per minute', sources: [J2], ...SAMPLE },
      why: { text: 'Sample text. Some of the receptors it targets also act on the heart and blood vessels.', sources: [J4], ...SAMPLE },
      reduce: { text: 'Sample text. Usually mild. A racing or irregular heartbeat, chest pain or fainting needs urgent care.', sources: [LABEL], ...SAMPLE },
      timing: { fromDays: 0.8, toDays: 6, text: 'Sample window: while levels are high' },
      ...SAMPLE,
    },
    {
      id: 'skin-sensation', name: 'Tingling or sensitive skin', organ: 'skin', alsoOrgans: [], severity: 'notable',
      frequency: { text: 'About 00 in 100 people in trials (sample)', sources: [J2], ...SAMPLE, unverified: true },
      why: { text: 'Sample text. The cause is not yet clear from the published trials.', sources: [NEWS], ...SAMPLE, unverified: true },
      reduce: { text: 'Sample text. Reported as mostly mild. Tell a clinician if it spreads or does not go away.', sources: [J2], ...SAMPLE },
      timing: { fromDays: 1, toDays: 7, text: 'Sample window: unclear' },
      ...SAMPLE,
    },
    {
      id: 'injection-site', name: 'Redness or itching where the shot went in', organ: 'injection_site', alsoOrgans: ['skin'], severity: 'common',
      frequency: { text: 'About 00 in 100 people in trials (sample)', sources: [J2], ...SAMPLE },
      why: { text: 'Sample text. The skin reacts to the liquid and the small depot sitting under it.', sources: [LABEL], ...SAMPLE },
      reduce: { text: 'Sample text. Usually fades within days. Spreading redness, heat or pus can mean infection.', sources: [HS], ...SAMPLE },
      timing: { fromDays: 0, toDays: 2, text: 'Sample window: the first day or two' },
      ...SAMPLE,
    },
    {
      id: 'gallbladder', name: 'Gallbladder problems', organ: 'gallbladder', alsoOrgans: ['liver'], severity: 'serious',
      frequency: { text: 'Sample text: uncommon in trials (00 in 100)', sources: [J2], ...SAMPLE },
      why: { text: 'Sample text. Fast weight loss changes bile, which can form gallstones.', sources: [LABEL], ...SAMPLE },
      reduce: { text: 'Sample text. Pain in the upper right belly, fever, or yellow skin or eyes needs a doctor today.', sources: [LABEL], ...SAMPLE },
      timing: { fromDays: 3, toDays: 21, text: 'Sample window: weeks to months of use' },
      ...SAMPLE,
    },
    {
      id: 'pancreatitis', name: 'Inflamed pancreas (pancreatitis)', organ: 'pancreas', alsoOrgans: [], severity: 'serious',
      frequency: { text: 'Sample text: rare in trials (00 in 1,000)', sources: [J2], ...SAMPLE },
      why: { text: 'Sample text. Drugs in this family have been linked to pancreatitis; the exact cause is still studied.', sources: [LABEL, REG], ...SAMPLE },
      reduce: { text: 'Sample text. Severe belly pain that spreads to the back is an emergency. Call 911.', sources: [LABEL], ...SAMPLE },
      timing: { fromDays: 1, toDays: 21, text: 'Sample window: any time' },
      ...SAMPLE,
    },
    {
      id: 'low-sugar', name: 'Low blood sugar', organ: 'blood', alsoOrgans: ['pancreas', 'brain'], severity: 'serious',
      frequency: { text: 'Sample text: mostly in people also taking insulin or a sulfonylurea', sources: [LABEL], ...SAMPLE },
      why: { text: 'Sample text. More insulin plus other sugar-lowering medicines can push blood sugar too low.', sources: [LABEL], ...SAMPLE },
      reduce: { text: 'Sample text. Shakiness, sweating and confusion are warning signs. Severe confusion or passing out is an emergency.', sources: [HS], ...SAMPLE },
      timing: { fromDays: 0.5, toDays: 5, text: 'Sample window: while levels are high' },
      ...SAMPLE,
    },
    {
      id: 'dehydration', name: 'Dehydration and kidney strain', organ: 'kidneys', alsoOrgans: [], severity: 'notable',
      frequency: { text: 'Sample text: uncommon (00 in 100)', sources: [LABEL], ...SAMPLE },
      why: { text: 'Sample text. Losing fluid through vomiting or diarrhea can strain the kidneys.', sources: [LABEL], ...SAMPLE },
      reduce: { text: 'Sample text. Keep drinking fluids when sick. Peeing much less than usual needs a doctor today.', sources: [HS], ...SAMPLE },
      timing: { fromDays: 1, toDays: 6, text: 'Sample window: after stomach upset' },
      ...SAMPLE,
    },
  ],

  redFlags: {
    call911: [
      { sign: 'Severe belly pain that will not go away, sometimes spreading to your back', why: 'Sample text. Can be a sign of an inflamed pancreas.', sources: [LABEL], ...SAMPLE },
      { sign: 'Swelling of the face, lips, tongue or throat, or trouble breathing', why: 'Sample text. Signs of a severe allergic reaction.', sources: [LABEL], ...SAMPLE },
      { sign: 'Chest pain, fainting, or a racing or very irregular heartbeat', why: 'Sample text. The heart needs to be checked right away.', sources: [LABEL], ...SAMPLE },
      { sign: 'Confusion, seizure or passing out', why: 'Sample text. Can happen with very low blood sugar or severe dehydration.', sources: [HS], ...SAMPLE },
    ],
    doctorToday: [
      { sign: 'Vomiting or diarrhea that will not stop, or you cannot keep fluids down', why: 'Sample text. Risk of dehydration and kidney strain.', sources: [HS], ...SAMPLE },
      { sign: 'Pain in the upper right belly, fever, or yellow skin or eyes', why: 'Sample text. Possible gallbladder problem.', sources: [LABEL], ...SAMPLE },
      { sign: 'Peeing much less than usual, or very dark pee', why: 'Sample text. Possible dehydration or kidney problem.', sources: [HS], ...SAMPLE },
      { sign: 'A lump or swelling in the neck, trouble swallowing, or a hoarse voice that lasts', why: 'Sample text. Needs a thyroid check.', sources: [LABEL], ...SAMPLE },
      { sign: 'New changes in your vision', why: 'Sample text. Fast drops in blood sugar can affect the eyes in people with diabetes.', sources: [LABEL], ...SAMPLE },
      { sign: 'New or worse low mood, or thoughts of hurting yourself', why: 'Sample text. Tell someone today. In the US you can call or text 988 any time.', sources: [REG], ...SAMPLE },
    ],
    ...SAMPLE,
  },

  tooMuch: {
    intro: 'Sample text. Because a weekly shot lasts for days, taking too much does not wear off quickly. The effects below can build over several days.',
    signs: [
      { text: 'Sample text. Severe nausea and vomiting that keeps going.', sources: [LABEL], ...SAMPLE },
      { text: 'Sample text. Dizziness or fainting from losing fluids.', sources: [HS], ...SAMPLE },
      { text: 'Sample text. Shakiness, sweating, a pounding heart or confusion, which can mean low blood sugar.', sources: [HS], ...SAMPLE },
      { text: 'Sample text. Severe belly pain.', sources: [LABEL], ...SAMPLE },
    ],
    whatToDo: [
      { text: 'Sample text. Call Poison Control at 1-800-222-1222 (US). It is free, private and open all day and night.', sources: [HS], ...SAMPLE },
      { text: 'Sample text. If someone passes out, has trouble breathing, has chest pain or a seizure, call 911.', sources: [HS], ...SAMPLE },
      { text: 'Sample text. Tell them what product it was, when it was taken, and where it came from. Bring the vial or packaging.', sources: [HS], ...SAMPLE },
      { text: 'Sample text. Do not drive yourself if you feel faint or confused.', sources: [HS], ...SAMPLE },
    ],
    sources: [HS, LABEL],
    ...SAMPLE,
  },

  doseFacts: {
    intro: 'Sample text. In the trials, people were placed in fixed study groups, and each group stayed on the plan the researchers set. The tables show what happened in each group.',
    caveat: 'Sample text. These are fixed results from trials run under medical supervision, with checkups and testing. They are not instructions, and they do not tell anyone what to take.',
    sources: [J1, J2],
    trials: [
      {
        id: 'sample-trial-a',
        name: 'Sample phase 2 trial (placeholder)',
        design: 'Sample text: randomized, placebo-controlled, 000 adults',
        timepoint: 'Results at week 00',
        columns: ['Study group', 'Average weight change', 'Stopped because of side effects', 'Had nausea'],
        rows: [
          // Repdigit values are artificial placeholders that only exercise the chart.
          { arm: 'Placebo', cells: ['−00%', '11%', '11%'] },
          { arm: 'Studied group 1 (lowest)', cells: ['−00%', '22%', '33%'] },
          { arm: 'Studied group 2', cells: ['−00%', '33%', '44%'] },
          { arm: 'Studied group 3', cells: ['−00%', '44%', '55%'] },
          { arm: 'Studied group 4 (highest)', cells: ['−00%', '55%', '66%'] },
        ],
        chart: { columns: ['Stopped because of side effects', 'Had nausea'] },
        sources: [J1, CO],
        ...SAMPLE,
      },
      {
        id: 'sample-trial-b',
        name: 'Sample phase 3 trial (placeholder)',
        design: 'Sample text: randomized, placebo-controlled, 0,000 adults',
        timepoint: 'Results at week 00',
        columns: ['Study group', 'Stopped because of side effects', 'Had vomiting'],
        rows: [
          { arm: 'Placebo', cells: ['11%', '11%'] },
          { arm: 'Studied group 1 (lower)', cells: ['22%', '22%'] },
          { arm: 'Studied group 2 (higher)', cells: ['33%', '44%'] },
        ],
        chart: { columns: ['Stopped because of side effects'] },
        sources: [J2, CO],
        ...SAMPLE,
      },
    ],
    ...SAMPLE,
  },

  evidence: {
    level: 'large-trial',
    summary: 'Sample text. Retatrutide has been tested in people in controlled trials. Longer-term safety, and what happens after people stop, is still being studied.',
    sources: [J2, TR],
    rungs: [
      { level: 'anecdote', text: 'Sample text. Many social posts describe personal results with vials bought online. These cannot tell us what was in the vial.', sources: [NEWS], ...SAMPLE, unverified: true },
      { level: 'animal', text: 'Sample text. Early lab and animal studies showed the triple-receptor effect.', sources: [J5], ...SAMPLE },
      { level: 'small-human', text: 'Sample text. Early human studies looked at how it moves through the body and its common side effects.', sources: [J3, J1], ...SAMPLE },
      { level: 'large-trial', text: 'Sample text. Larger placebo-controlled trials have reported results.', sources: [J2, CO], ...SAMPLE },
    ],
    gaps: [
      { text: 'Sample text. Safety over many years of use.', sources: [J2], ...SAMPLE },
      { text: 'Sample text. What happens to weight and health after stopping.', sources: [J2], ...SAMPLE },
      { text: 'Sample text. Rare side effects that only show up once very many people use it.', sources: [REG], ...SAMPLE },
    ],
    ...SAMPLE,
  },

  claims: [
    { claim: 'It caused big weight loss in clinical trials.', verdict: 'supported', evidence: 'Sample text. Trial groups lost more weight on average than placebo groups, under medical supervision.', sources: [J2, CO], ...SAMPLE },
    { claim: 'It melts fat without changing anything else.', verdict: 'partly', evidence: 'Sample text. Trial participants also got diet and activity advice, and the drug works largely by reducing how much people eat.', sources: [J2], ...SAMPLE },
    { claim: 'Research vials online are the same drug used in the trials.', verdict: 'not-supported', evidence: 'Sample text. Online "research" products are not made or checked to medicine standards. Independent tests found wrong amounts and some with none of the drug.', sources: ['sample-lab-1', REG], ...SAMPLE },
    { claim: 'It is safer than older weight-loss shots because it is newer.', verdict: 'not-supported', evidence: 'Sample text. Newer does not mean safer. Its long-term safety is still being studied.', sources: [J2], ...SAMPLE },
    { claim: 'You keep the weight off after you stop.', verdict: 'unknown', evidence: 'Sample text. There is not enough published follow-up yet to say.', sources: [J2], ...SAMPLE },
  ],

  risk: {
    'heart-rhythm': [
      { organ: 'heart', title: 'It can raise your resting heart rate', text: 'Sample text. In trials, heart rate went up on average. With a rhythm problem, a faster rate may matter more.', sources: [J2], ...SAMPLE },
    ],
    pancreatitis: [
      { organ: 'pancreas', title: 'Drugs in this family are linked to pancreatitis', text: 'Sample text. People with past pancreatitis were left out of key trials, so the risk for them is not known.', sources: [LABEL, J2], ...SAMPLE },
    ],
    gallbladder: [
      { organ: 'gallbladder', title: 'Fast weight loss can trigger gallbladder problems', text: 'Sample text. Gallstone problems were reported in trials of similar drugs.', sources: [LABEL], ...SAMPLE },
    ],
    'thyroid-mtc': [
      { organ: 'thyroid', title: 'Thyroid tumor warning for this drug family', text: 'Sample text. Related approved drugs carry a warning for people with a personal or family history of medullary thyroid cancer or MEN2.', sources: [LABEL, REG], ...SAMPLE },
    ],
    pregnancy: [
      { organ: 'blood', title: 'Not studied in pregnancy', text: 'Sample text. Pregnant people were excluded from trials. Weight loss during pregnancy is not advised, and the effect on a baby is unknown.', sources: [LABEL], ...SAMPLE },
    ],
    'diabetes-meds': [
      { organ: 'blood', title: 'Higher chance of low blood sugar', text: 'Sample text. Combined with insulin or a sulfonylurea, blood sugar can drop too low.', sources: [LABEL], ...SAMPLE },
    ],
    kidney: [
      { organ: 'kidneys', title: 'Fluid loss can strain the kidneys', text: 'Sample text. Vomiting and diarrhea can lead to dehydration, which can worsen kidney function.', sources: [LABEL], ...SAMPLE },
    ],
    'diabetic-eye': [
      { organ: 'eyes', title: 'Eye disease can get worse when blood sugar drops fast', text: 'Sample text. A related drug showed more eye complications in people with diabetic retinopathy.', sources: [LABEL], ...SAMPLE },
    ],
    mood: [
      { organ: 'brain', title: 'Watch for mood changes', text: 'Sample text. Regulators have reviewed reports of low mood with drugs in this family. Tell someone if your mood gets worse.', sources: [REG], ...SAMPLE, unverified: true },
    ],
    surgery: [
      { organ: 'stomach', title: 'Food can stay in the stomach during sedation', text: 'Sample text. Slower stomach emptying can raise the risk of breathing in stomach contents while sedated. Tell your care team you use it.', sources: [REG], ...SAMPLE },
    ],
    gastroparesis: [
      { organ: 'stomach', title: 'It slows the stomach further', text: 'Sample text. People with severe stomach-emptying problems were left out of trials.', sources: [LABEL], ...SAMPLE },
    ],
    'birth-control': [
      { organ: 'stomach', title: 'Birth-control pills may work less well', text: 'Sample text. A related drug lowered how much of a pill is absorbed. Labels for it advise extra protection for a time.', sources: [LABEL], ...SAMPLE },
    ],
  },
};
