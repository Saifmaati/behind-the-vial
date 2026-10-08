// Behind the Vial: personal-history checklist for the warnings-only risk check.
//
// These are checklist labels, not claims, so they carry no sources. What each
// item MEANS for a given peptide lives in that peptide's entry under `risk`
// (data/<peptide>.js), with citations. The check only ever shows warnings.
//
// Shape: { id, label, hint }

export const RISK_ITEMS = [
  { id: 'heart-rhythm', label: 'Heart rhythm problems', hint: 'For example a fast, slow or irregular heartbeat, or atrial fibrillation.' },
  { id: 'pancreatitis', label: 'Past pancreatitis', hint: 'Inflammation of the pancreas, at any time in the past.' },
  { id: 'gallbladder', label: 'Gallbladder problems', hint: 'Gallstones, gallbladder attacks, or gallbladder removed.' },
  { id: 'thyroid-mtc', label: 'Medullary thyroid cancer or MEN2, in you or your family', hint: 'A rare thyroid cancer, or the inherited condition MEN2.' },
  { id: 'pregnancy', label: 'Pregnant, trying to get pregnant, or breastfeeding', hint: 'Including if you might be pregnant.' },
  { id: 'diabetes-meds', label: 'Taking insulin or a sulfonylurea', hint: 'Diabetes medicines that lower blood sugar, such as glipizide, glyburide or glimepiride.' },
  { id: 'kidney', label: 'Kidney disease', hint: 'Any long-term kidney problem, or reduced kidney function.' },
  { id: 'diabetic-eye', label: 'Diabetic eye disease', hint: 'Also called diabetic retinopathy.' },
  { id: 'mood', label: 'Depression or thoughts of suicide', hint: 'Now or in the past.' },
  { id: 'surgery', label: 'Surgery or sedation coming up', hint: 'Including procedures where you are put to sleep, such as an endoscopy.' },
  { id: 'gastroparesis', label: 'Slow stomach emptying (gastroparesis)', hint: 'Food stays in the stomach longer than it should.' },
  { id: 'birth-control', label: 'Taking birth-control pills', hint: 'Hormonal contraceptives taken by mouth.' },
  { id: 'moles-melanoma', label: 'Many moles, or past melanoma', hint: 'Matters most for the tanning peptides.' },
  { id: 'eating-disorder', label: 'History of an eating disorder', hint: 'Such as anorexia, bulimia or binge eating disorder.' },
];
