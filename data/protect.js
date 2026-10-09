// PeptideScope: protective sections shown for EVERY peptide (ready or coming soon), v4.
// Rendered by js/ui/protect.js:
//   ifYouHaveOne:   "If you have one": don't use it, tell a trusted adult, ask a doctor or
//                   pharmacist, when to call Poison Help / 911, and how to get rid of it safely.
//   realVsInternet: "Real medicine vs. internet vial": regulator-cited differences.
//
// Hard rule (brief + DECISIONS.md 14): nothing here describes using, preparing, storing or
// handling a product, how much to take or for how long. Disposal and first aid only.
//
// Every object with `sources` traces to usable claims in research/claims.json through `ledger`
// (check: node tools/trace.mjs data/protect.js PROTECT). Framing text is `editorial: true` with
// no sources and no digits. The two helplines (911, 1-800-222-1222) come from protect-real-23.
// Wording: plain, for ages 12+, never commercial (tests/commerce.test.mjs). Sources whose titles
// name a seller are not cited (docs/decisions/data-wording.md 7; docs/decisions/protect-data.md).

// Source ids (see data/sources.js)
const FDA_CONCERNS = 'u-s-2026-fda-s-concerns-unapproved';
const FDA_APPROVAL = 'u-s-2022-development-approval-process-drugs';
const FDA_LABELING = 'u-s-2024-frequently-asked-questions-about';
const FDA_COUNTERFEIT = 'u-s-2025-counterfeit-medicine';
const FDA_DISPOSAL = 'u-s-2024-disposal-unused-medicines-what';
const FDA_TAKEBACK = 'u-s-2024-drug-disposal-drug-take';
const FDA_SHARPS_BEST = 'u-s-2023-best-way-get-rid';
const FDA_SHARPS_SAFE = 'u-s-2021-safely-using-sharps-needles';
const FDA_SHARPS_DOS = 'u-s-2021-dos-don-ts-proper';
const HEALTH_CANADA = 'health-canada-2026-think-twice-before-injecting';
const MEDLINE_POISON = 'medlineplus-u-2025-poisoning-first-aid-medlineplus';
const MHRA_GLP1 = 'medicines-healthcare-2026-glp-1-medicines-weight';
const MHRA_RETA = 'medicines-healthcare-2026-no-summer-shortcut-safe';
const LILLY_FAQ = 'eli-lilly-2026-what-know-about-retatrutide';

export const PROTECT = {
  ifYouHaveOne: {
    intro: {
      text: 'Have one, or know someone who does? Here is what to do.',
      sources: [],
      editorial: true,
    },
    steps: [
      {
        title: "Don't use it.",
        text: 'Don\'t inject it or give it to anyone. Health Canada says not to use peptides labelled "For Research Use Only – Not for Human Consumption". The FDA warns that weight-loss drugs sold with labels like that are of unknown quality and may harm your health.',
        sources: [HEALTH_CANADA, FDA_CONCERNS],
        ledger: ['protect-real-20', 'protect-real-07'],
      },
      {
        title: 'Tell a parent or another adult you trust.',
        text: "You don't have to deal with this alone. A parent, a school nurse or another adult you trust can help you get rid of it safely, and get help if someone feels sick.",
        sources: [],
        editorial: true,
      },
      {
        title: 'Ask a doctor or pharmacist.',
        text: 'Questions about a medicine? The FDA says to talk to your doctor. If someone used one of these unapproved peptides and feels unwell or is worried, Health Canada says to contact a doctor, nurse practitioner or pharmacist.',
        sources: [FDA_CONCERNS, HEALTH_CANADA],
        ledger: ['protect-real-15', 'protect-real-22'],
      },
      {
        title: 'Call Poison Help or 911.',
        text: "If someone used it and feels sick, get help now. If you think someone was poisoned, don't wait for symptoms. Call 911 (or your local emergency number) in an emergency, or Poison Help at 1-800-222-1222. It's free to call from anywhere in the U.S.",
        sources: [MEDLINE_POISON],
        ledger: ['protect-real-23', 'protect-real-24'],
      },
      {
        title: 'Get rid of it at a drug take-back site.',
        text: "The FDA says the best way to get rid of most unused medicines is a drug take-back site or a prepaid mail-back envelope. Take-back sites can be pharmacies or police stations, and some have a drop box. Everything dropped off there is destroyed. Don't flush medicine down the toilet unless it is on the FDA's Flush List.",
        sources: [FDA_DISPOSAL, FDA_TAKEBACK],
        ledger: ['protect-dispose-01', 'protect-dispose-02', 'protect-dispose-03', 'protect-dispose-08'],
      },
      {
        title: 'Needles go in a sharps container.',
        text: "Used needles go straight into a sharps container: a strong plastic box made to resist needle pokes. Pharmacies and doctors' offices usually have them. Never put loose needles in the trash or recycling, and never flush them. Where to drop off a sharps container depends on where you live, so check with your local health department or trash service.",
        sources: [FDA_SHARPS_BEST, FDA_SHARPS_SAFE],
        ledger: ['protect-dispose-11', 'protect-dispose-12', 'protect-dispose-13', 'protect-dispose-15'],
      },
      {
        // fix (safety review): no pen-sharing advice (that presumes someone is injecting)
        title: "Don't touch used needles.",
        text: "Used needles can spread serious infections, most often hepatitis B, hepatitis C and HIV. Found a used needle? Our advice: leave it and tell an adult (the FDA says never to try to remove, bend, break or recap a needle someone else used). If you get stuck, wash the spot right away with soap and water and get medical help right away.",
        sources: [FDA_SHARPS_SAFE, FDA_SHARPS_DOS],
        ledger: ['protect-dispose-14', 'protect-dispose-16', 'protect-dispose-17'],
      },
    ],
  },

  realVsInternet: {
    intro: {
      text: 'A vial from the internet can look a lot like real medicine. Here is what is actually different.',
      sources: [],
      editorial: true,
    },
    rows: [
      {
        aspect: "Checked before it's sold",
        real: 'Tested first. FDA experts review the results, and approval means they found its benefits outweigh its known and possible risks for the people it is meant for.',
        internet: "Unapproved products don't go through the FDA's review for safety, effectiveness and quality before they are sold.",
        sources: [FDA_APPROVAL, FDA_CONCERNS],
        ledger: ['protect-real-01', 'protect-real-02', 'protect-real-05'],
      },
      {
        aspect: 'Where it comes from',
        real: "A doctor's prescription, filled at a state-licensed pharmacy. That is what the FDA tells patients to do.",
        internet: 'Unregulated sellers, like social media accounts or beauty salons. The UK medicines regulator says GLP-1 medicines should not be obtained from sellers like these, or from anywhere without first consulting a healthcare professional.',
        sources: [FDA_CONCERNS, MHRA_GLP1],
        ledger: ['protect-real-04', 'protect-real-16'],
      },
      {
        aspect: 'The label',
        real: 'Official labeling that the FDA reviewed and approved, often with a part written for patients.',
        internet: 'May say "for research purposes" or "not for human consumption". The FDA says drugs like semaglutide, tirzepatide and retatrutide have been sold with these false labels, and Health Canada says a label like that does not make a product legal.',
        sources: [FDA_LABELING, FDA_CONCERNS, HEALTH_CANADA],
        ledger: ['protect-real-03', 'protect-real-06', 'protect-real-20'],
      },
      {
        aspect: "What's inside",
        real: "The FDA's review checks its quality before it is sold.",
        internet: 'May hold the wrong drug, too much or too little of it, or none at all. It may also hold contaminants like heavy metals, bits of glass or plastic, bacteria or fungi.',
        sources: [FDA_CONCERNS, LILLY_FAQ, FDA_COUNTERFEIT, HEALTH_CANADA],
        ledger: ['protect-real-05', 'protect-real-12', 'protect-real-13', 'protect-real-21'],
      },
      {
        // appliesTo: shown only for these peptides (js/ui/protect.js); rows without it apply to every peptide
        appliesTo: ['retatrutide', 'semaglutide', 'tirzepatide', 'cagrilintide'],
        aspect: 'What real ones look like (UK)',
        real: 'In the UK, real GLP-1 medicines come as pre-filled pens or tablets.',
        internet: 'GLP-1 products that come as a powder in a vial are not authorised in the UK, and the UK medicines regulator says they pose serious health risks.',
        sources: [MHRA_GLP1],
        ledger: ['protect-real-17'],
      },
      {
        appliesTo: ['retatrutide'],
        aspect: 'Retatrutide right now',
        real: 'No regulator has approved it. Lilly, which is developing it, says no one should take anything claiming to be retatrutide outside its clinical trials.',
        internet: "The UK medicines regulator says anyone selling it in the UK is breaking the law, and there's no guarantee it even contains retatrutide. The FDA says it has not been found safe and effective for any condition.",
        sources: [LILLY_FAQ, MHRA_RETA, FDA_CONCERNS],
        ledger: ['protect-real-11', 'protect-real-18', 'protect-real-10'],
      },
    ],
  },
};
