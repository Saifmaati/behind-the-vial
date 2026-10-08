// Structure catalogue for assets/anatomy/atlas-<sex>.json: one entry per named mesh in body*.glb and detail-*.glb.
// `name` is the anatomical name, `plain` a short plain-language description (textbook location/role only, nothing
// that needs a citation beyond a standard anatomy text), `system` the body system used to group the layers panel.
// Muscles come from ./muscles.mjs.

export const SYSTEMS = ['integumentary', 'muscular', 'skeletal', 'nervous', 'sensory', 'endocrine', 'cardiovascular', 'respiratory', 'digestive', 'urinary', 'lymphatic', 'reproductive'];

/** body.glb / body-female.glb meshes (contract names, docs/ARCHITECTURE.md "3D world contract"). */
export const BODY_STRUCTURES = {
  skin: { name: 'Skin', plain: 'The body’s outer covering', system: 'integumentary' },
  brain: { name: 'Brain', plain: 'Controls thought, movement and the senses', system: 'nervous' },
  thyroid: { name: 'Thyroid gland', plain: 'Gland at the front of the neck that makes thyroid hormone', system: 'endocrine' },
  heart: { name: 'Heart', plain: 'Pumps blood around the body', system: 'cardiovascular' },
  lungs: { name: 'Lungs', plain: 'Take in oxygen and remove carbon dioxide', system: 'respiratory' },
  liver: { name: 'Liver', plain: 'Large organ under the right ribs; processes nutrients and makes bile', system: 'digestive' },
  gallbladder: { name: 'Gallbladder', plain: 'Small sac under the liver that stores bile', system: 'digestive' },
  stomach: { name: 'Stomach', plain: 'Holds and starts digesting food', system: 'digestive' },
  pancreas: { name: 'Pancreas', plain: 'Makes digestive enzymes and the hormones insulin and glucagon', system: 'digestive' },
  spleen: { name: 'Spleen', plain: 'Filters the blood and helps fight infection', system: 'lymphatic' },
  small_intestine: { name: 'Small intestine', plain: 'Small bowel; absorbs most nutrients from food', system: 'digestive' },
  large_intestine: { name: 'Large intestine (colon)', plain: 'Large bowel; absorbs water and forms stool', system: 'digestive' },
  kidneys: { name: 'Kidneys', plain: 'Filter the blood and make urine', system: 'urinary' },
  bladder: { name: 'Urinary bladder', plain: 'Stores urine', system: 'urinary' },
  uterus: { name: 'Uterus', plain: 'The womb', system: 'reproductive' },
  ovaries: { name: 'Ovaries', plain: 'Make eggs and the hormones estrogen and progesterone', system: 'reproductive' },
  arteries: { name: 'Arteries', plain: 'Vessels carrying oxygen-rich blood (shown red; includes the pulmonary veins)', system: 'cardiovascular' },
  veins: { name: 'Veins', plain: 'Vessels carrying oxygen-poor blood (shown blue; includes the pulmonary arteries)', system: 'cardiovascular' },
  skeleton: { name: 'Skeleton', plain: 'The bones that support and protect the body', system: 'skeletal' },
};

/** detail-*.glb meshes other than muscles. */
export const DETAIL_STRUCTURES = {
  skin_hi: { name: 'Skin (close-up surface)', plain: 'The body’s outer covering, in full detail for close-up views', system: 'integumentary' },
  eyes: { name: 'Eyeballs', plain: 'The eyes: white sclera, colored iris and the pupil', system: 'sensory' },
  skeleton_hi: { name: 'Skeleton (close-up bones)', plain: 'The bones that support and protect the body, in full detail for close-up views', system: 'skeletal' },
};
