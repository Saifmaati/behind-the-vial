// PeptideScope: personal-history checklist for the warnings-only risk check.
//
// These are checklist labels, not claims, so they carry no sources and no
// numbers. What each item MEANS for a given peptide lives in that peptide's
// entry under `risk` (e.g. data/retatrutide/safety.js), with citations. The
// check only ever shows warnings. It never says anyone is safe or cleared.
//
// Shape: { id, label, hint, hintWhenMapped? }

export const RISK_ITEMS = [
  { id: 'under-18', label: 'I’m under 18', hint: 'Teens and kids.' },
  { id: 'heart-rhythm', label: 'Heart rhythm problems', hint: 'A fast, slow or irregular heartbeat, such as atrial fibrillation (AFib).' },
  { id: 'pancreatitis', label: 'Past pancreatitis', hint: 'An inflamed pancreas, at any time in the past.' },
  { id: 'gallbladder', label: 'Gallbladder problems', hint: 'Gallstones, gallbladder attacks, or a gallbladder that was taken out.' },
  { id: 'thyroid-mtc', label: 'Medullary thyroid cancer or MEN syndrome, in you or your family', hint: 'A rare thyroid cancer, or an inherited condition called multiple endocrine neoplasia (MEN) type two.' },
  { id: 'pregnancy', label: 'Pregnant, trying to get pregnant, or breastfeeding', hint: 'Including if you might be pregnant.' },
  { id: 'diabetes-meds', label: 'Taking insulin or a sulfonylurea', hint: 'Diabetes medicines that lower blood sugar. Sulfonylureas include glipizide, glyburide and glimepiride.' },
  { id: 'kidney', label: 'Kidney disease', hint: 'Any long-term kidney problem, or kidneys that do not filter as well as they should.' },
  { id: 'diabetic-eye', label: 'Diabetic eye disease', hint: 'Damage to the back of the eye from diabetes, also called diabetic retinopathy.' },
  { id: 'mood', label: 'Depression or thoughts of suicide', hint: 'Now or in the past, including any other serious mental illness.' },
  { id: 'surgery', label: 'Surgery or sedation coming up', hint: 'Any procedure where you are put to sleep or deeply sedated, such as an endoscopy.' },
  { id: 'gastroparesis', label: 'Slow stomach emptying (gastroparesis)', hint: 'Food stays in the stomach longer than it should.' },
  { id: 'birth-control', label: 'Taking birth-control pills', hint: 'Hormonal birth control taken by mouth.' },
  // hintWhenMapped: the hint shows only for a peptide that has warnings mapped for this item
  { id: 'moles-melanoma', label: 'Many moles, or past melanoma', hint: 'Matters most for the tanning peptides.', hintWhenMapped: true },
  { id: 'eating-disorder', label: 'History of an eating disorder', hint: 'Such as anorexia, bulimia or binge eating disorder.' },
];
