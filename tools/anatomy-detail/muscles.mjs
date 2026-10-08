// Muscle catalogue for the close-up layer: one mesh per named major muscle or group, both sides in one mesh.
// Sources: BodyParts3D 4.0 concept names (IS-A tree first, then PART-OF), `{s}` expands to "left"/"right";
// SIO (VOXEL-MAN Visible Human Male) label names for the muscles BodyParts3D 4.0 lacks (rectus abdominis, internal
// oblique, transversus abdominis, pelvic floor), for the external oblique (BodyParts3D's includes the aponeurosis, which
// would hide the rectus abdominis) and for iliopsoas and diaphragm (same body as the HRA organs).
// `sioMesh` sets the voxel meshing for SIO labels (see sio-stage.mjs labelMesh); `maleOnly` muscles are left out of the
// female layer (the SIO pelvic diaphragm is a male pelvic floor).
// `name` is the anatomical name; `plain` is the plain-language description shown under it (accurate, neutral, textbook
// location and action only).

export const MUSCLES = [
  // ---- head and neck ----
  { slug: 'sternocleidomastoid', name: 'Sternocleidomastoid', plain: 'The long neck muscle that turns and tilts the head', region: 'neck', bp: ['{s} sternocleidomastoid'] },
  { slug: 'platysma', name: 'Platysma', plain: 'Thin sheet of muscle just under the skin of the neck', region: 'neck', bp: ['{s} platysma'], thin: true },
  { slug: 'suprahyoid', name: 'Suprahyoid muscles', plain: 'Muscles of the floor of the mouth; lift the voice box when swallowing', region: 'neck', bp: ['{s} digastric', '{s} mylohyoid', '{s} stylohyoid', '{s} geniohyoid'] },
  { slug: 'infrahyoid', name: 'Infrahyoid muscles', plain: 'Strap muscles at the front of the neck; lower the voice box', region: 'neck', bp: ['{s} sternohyoid', '{s} omohyoid', '{s} thyrohyoid', '{s} sternothyroid'] },
  { slug: 'scalenes', name: 'Scalene muscles', plain: 'Muscles at the side of the neck; lift the top ribs during deep breathing', region: 'neck', bp: ['{s} scalenus anterior', '{s} scalenus medius', '{s} scalenus posterior'] },
  { slug: 'prevertebral', name: 'Longus colli and longus capitis', plain: 'Deep muscles at the front of the neck; bend the neck forward', region: 'neck', bp: ['{s} longus capitis', 'superior oblique part of {s} longus colli', 'vertical intermediate part of {s} longus colli', 'inferior oblique part of {s} longus colli'], layer: 'deep' },
  { slug: 'splenius', name: 'Splenius capitis and cervicis', plain: 'Muscle at the back of the neck; turns and extends the head', region: 'neck', bp: ['{s} splenius capitis', '{s} splenius cervicis'] },
  { slug: 'semispinalis', name: 'Semispinalis', plain: 'Deep muscles along the back of the neck and upper spine; extend the head and spine', region: 'back', bp: ['{s} semispinalis capitis', '{s} semispinalis cervicis', '{s} semispinalis thoracis'], layer: 'deep' },
  { slug: 'suboccipital', name: 'Suboccipital muscles', plain: 'Small muscles just under the base of the skull', region: 'neck', bp: ['{s} rectus capitis posterior major', '{s} rectus capitis posterior minor', '{s} obliquus capitis superior', '{s} obliquus capitis inferior'], layer: 'deep' },
  { slug: 'levator_scapulae', name: 'Levator scapulae', plain: 'Lifts the shoulder blade', region: 'neck', bp: ['{s} levator scapulae'] },
  // ---- shoulder girdle and back ----
  { slug: 'trapezius', name: 'Trapezius', plain: 'The large diamond-shaped muscle of the upper back and neck; moves the shoulder blades', region: 'back', bp: ['descending part of {s} trapezius', 'transverse part of {s} trapezius', 'ascending part of {s} trapezius'] },
  { slug: 'deltoid', name: 'Deltoid', plain: 'The rounded shoulder muscle; lifts the arm', region: 'shoulder', bp: ['clavicular part of {s} deltoid', 'acromial part of {s} deltoid', 'spinal part of {s} deltoid'] },
  // latissimus dorsi: not in BodyParts3D 4.0 and not a separate SIO label (it is inside 'unclassified muscles'); omitted
  // rather than drawn by hand (docs/decisions/anatomy-detail.md)
  { slug: 'rhomboids', name: 'Rhomboid major and minor', plain: 'Muscles between the spine and the shoulder blade; pull the shoulder blades together', region: 'back', bp: ['{s} rhomboid major', '{s} rhomboid minor'], layer: 'deep' },
  { slug: 'supraspinatus', name: 'Supraspinatus', plain: 'Rotator cuff muscle above the shoulder blade spine; starts lifting the arm', region: 'shoulder', bp: ['{s} supraspinatus'], layer: 'deep' },
  { slug: 'infraspinatus', name: 'Infraspinatus', plain: 'Rotator cuff muscle on the back of the shoulder blade; turns the arm outward', region: 'shoulder', bp: ['{s} infraspinatus muscle'] },
  { slug: 'teres_minor', name: 'Teres minor', plain: 'Small rotator cuff muscle; turns the arm outward', region: 'shoulder', bp: ['{s} teres minor'] },
  { slug: 'teres_major', name: 'Teres major', plain: 'Runs from the lower shoulder blade to the arm; pulls the arm in and back', region: 'shoulder', bp: ['{s} teres major'] },
  { slug: 'subscapularis', name: 'Subscapularis', plain: 'Rotator cuff muscle on the rib side of the shoulder blade; turns the arm inward', region: 'shoulder', bp: ['{s} subscapularis'], layer: 'deep' },
  { slug: 'erector_spinae', name: 'Erector spinae', plain: 'The long muscle columns either side of the spine; keep the back upright', region: 'back', bp: ['{s} iliocostalis cervicis', '{s} iliocostalis thoracis', '{s} iliocostalis lumborum', '{s} longissimus capitis', '{s} longissimus cervicis', '{s} longissimus thoracis', '{s} spinalis thoracis'] },
  { slug: 'serratus_posterior', name: 'Serratus posterior superior and inferior', plain: 'Thin back muscles attached to the ribs', region: 'back', bp: ['{s} serratus posterior superior', '{s} serratus posterior inferior'], layer: 'deep', thin: true },
  // ---- chest ----
  { slug: 'pectoralis_major', name: 'Pectoralis major', plain: 'The large chest muscle; pulls the arm across the body', region: 'chest', bp: ['clavicular part of {s} pectoralis major', 'sternocostal part of {s} pectoralis major', 'abdominal part of {s} pectoralis major'] },
  { slug: 'pectoralis_minor', name: 'Pectoralis minor', plain: 'Thin chest muscle under the pectoralis major; steadies the shoulder blade', region: 'chest', bp: ['{s} pectoralis minor'], layer: 'deep' },
  { slug: 'subclavius', name: 'Subclavius', plain: 'Small muscle under the collarbone', region: 'chest', bp: ['{s} subclavius'], layer: 'deep' },
  { slug: 'serratus_anterior', name: 'Serratus anterior', plain: 'Finger-like muscle on the side of the rib cage; holds the shoulder blade to the ribs', region: 'chest', bp: ['{s} serratus anterior'] },
  { slug: 'intercostals', name: 'Intercostal muscles', plain: 'Muscles between the ribs; help breathing', region: 'chest', bp: ['external intercostal muscle', 'internal intercostal muscle'], layer: 'deep', thin: true },
  { slug: 'diaphragm', name: 'Diaphragm', plain: 'Dome-shaped main breathing muscle under the lungs', region: 'trunk', sio: ['diaphragm'], layer: 'deep', thin: true, sioMesh: { close: 1, blurPasses: 1, iso: 0.4, iterations: 12 } },
  // ---- abdominal wall and pelvis (SIO: segmented from this same Visible Human Male) ----
  { slug: 'rectus_abdominis', name: 'Rectus abdominis', plain: 'The "six-pack" muscle down the front of the belly', region: 'abdomen', sio: ['left rectus abdominis', 'right rectus abdominis'], sioMesh: { close: 2, blurPasses: 1, iterations: 14 } },
  { slug: 'external_oblique', name: 'External oblique', plain: 'Outer layer of the side of the belly; twists and bends the trunk', region: 'abdomen', sio: ['left external oblique', 'right external oblique'], thin: true, sioMesh: { close: 1, blurPasses: 1, iso: 0.4, iterations: 14 } },
  { slug: 'internal_oblique', name: 'Internal oblique', plain: 'Middle layer of the belly wall, under the external oblique', region: 'abdomen', sio: ['left internal oblique', 'right internal oblique'], layer: 'deep', thin: true, sioMesh: { close: 1, blurPasses: 1, iso: 0.35, iterations: 12 } },
  { slug: 'transversus_abdominis', name: 'Transversus abdominis', plain: 'Deepest belly-wall layer; wraps around like a corset', region: 'abdomen', sio: ['left transversus abdominis', 'right transversus abdominis'], layer: 'deep', thin: true, sioMesh: { close: 1, blurPasses: 1, iso: 0.35, iterations: 12 } },
  { slug: 'iliopsoas', name: 'Iliopsoas (psoas major and iliacus)', plain: 'Deep hip flexor running from the lower spine and pelvis to the thigh bone', region: 'pelvis', sio: ['left psoas', 'right psoas', 'left iliacus', 'right iliacus'], layer: 'deep', sioMesh: { close: 1, blurPasses: 1, iterations: 12 } },
  { slug: 'pelvic_floor', name: 'Pelvic diaphragm (levator ani and coccygeus)', plain: 'A sling that supports the pelvic organs', region: 'pelvis', sio: ['pelvic diaphragm'], layer: 'deep', thin: true, maleOnly: true, sioMesh: { close: 1, blurPasses: 1, iso: 0.35, iterations: 12 } },
  // ---- arm ----
  { slug: 'biceps_brachii', name: 'Biceps brachii', plain: 'Front of the upper arm; bends the elbow and turns the palm up', region: 'arm', bp: ['long head of {s} biceps brachii', 'short head of {s} biceps brachii'] },
  { slug: 'triceps_brachii', name: 'Triceps brachii', plain: 'Back of the upper arm; straightens the elbow', region: 'arm', bp: ['long head of {s} triceps brachii', 'lateral head of {s} triceps brachii', 'medial head of {s} triceps brachii'] },
  { slug: 'brachialis', name: 'Brachialis', plain: 'Under the biceps; the main elbow-bending muscle', region: 'arm', bp: ['{s} brachialis'], layer: 'deep' },
  { slug: 'coracobrachialis', name: 'Coracobrachialis', plain: 'Small muscle on the inner upper arm', region: 'arm', bp: ['{s} coracobrachialis'], layer: 'deep' },
  { slug: 'brachioradialis', name: 'Brachioradialis', plain: 'Thumb-side forearm muscle; bends the elbow', region: 'forearm', bp: ['{s} brachioradialis'] },
  { slug: 'forearm_flexors', name: 'Forearm flexor-pronator group', plain: 'Forearm muscles on the palm side; bend the wrist and fingers', region: 'forearm', bp: ['{s} flexor carpi radialis', '{s} palmaris longus', 'humeral head of {s} flexor carpi ulnaris', 'ulnar head of {s} flexor carpi ulnaris', '{s} flexor digitorum superficialis', '{s} flexor digitorum profundus', '{s} flexor pollicis longus', 'humeral head of {s} pronator teres', 'ulnar head of {s} pronator teres', '{s} pronator quadratus'] },
  { slug: 'forearm_extensors', name: 'Forearm extensor-supinator group', plain: 'Forearm muscles on the back of the forearm; straighten the wrist and fingers', region: 'forearm', bp: ['{s} extensor carpi radialis longus', '{s} extensor carpi radialis brevis', '{s} extensor digitorum', '{s} extensor digiti minimi', '{s} extensor carpi ulnaris', '{s} anconeus', '{s} supinator', '{s} abductor pollicis longus', '{s} extensor pollicis brevis', '{s} extensor pollicis longus', '{s} extensor indicis'] },
  { slug: 'hand_intrinsic', name: 'Intrinsic muscles of the hand', plain: 'Small muscles of the thumb pad, little-finger pad and between the hand bones; fine finger movements', region: 'hand', bp: ['{s} abductor pollicis brevis', '{s} flexor pollicis brevis', '{s} opponens pollicis', 'oblique head of {s} adductor pollicis', 'transverse head of {s} adductor pollicis', 'abductor digiti minimi of {s} hand', 'flexor digiti minimi brevis of {s} hand', 'opponens digiti minimi of {s} hand', 'set of dorsal interossei of {s} hand', 'set of palmar interossei of {s} hand', 'set of lumbricals of {s} hand'] },
  // ---- hip and thigh ----
  { slug: 'gluteus_maximus', name: 'Gluteus maximus', plain: 'The large buttock muscle; extends the hip', region: 'hip', bp: ['{s} gluteus maximus'] },
  { slug: 'gluteus_medius', name: 'Gluteus medius', plain: 'Upper outer buttock; keeps the pelvis level when walking', region: 'hip', bp: ['{s} gluteus medius'] },
  { slug: 'gluteus_minimus', name: 'Gluteus minimus', plain: 'Smallest, deepest buttock muscle', region: 'hip', bp: ['{s} gluteus minimus'], layer: 'deep' },
  { slug: 'tensor_fasciae_latae', name: 'Tensor fasciae latae', plain: 'Front-outer hip; steadies the hip and knee', region: 'hip', bp: ['{s} tensor fasciae latae'] },
  { slug: 'deep_hip_rotators', name: 'Deep lateral rotators of the hip', plain: 'Deep buttock muscles (piriformis and its neighbours); turn the thigh outward', region: 'hip', bp: ['{s} piriformis', '{s} obturator internus', '{s} obturator externus', '{s} gemellus superior', '{s} gemellus inferior', '{s} quadratus femoris'], layer: 'deep' },
  { slug: 'sartorius', name: 'Sartorius', plain: 'Long strap muscle crossing the front of the thigh', region: 'thigh', bp: ['{s} sartorius'] },
  { slug: 'rectus_femoris', name: 'Rectus femoris', plain: 'Middle quadriceps muscle on the front of the thigh', region: 'thigh', bp: ['{s} rectus femoris'] },
  { slug: 'vastus_lateralis', name: 'Vastus lateralis', plain: 'Outer quadriceps muscle of the thigh', region: 'thigh', bp: ['{s} vastus lateralis'] },
  { slug: 'vastus_medialis', name: 'Vastus medialis', plain: 'Inner, teardrop-shaped quadriceps muscle above the knee', region: 'thigh', bp: ['{s} vastus medialis'] },
  { slug: 'vastus_intermedius', name: 'Vastus intermedius', plain: 'Deep quadriceps muscle, under the rectus femoris', region: 'thigh', bp: ['{s} vastus intermedius'], layer: 'deep' },
  { slug: 'adductors', name: 'Adductor group (adductor longus, brevis, magnus, minimus; pectineus)', plain: 'Inner-thigh muscles; pull the legs together', region: 'thigh', bp: ['{s} adductor longus', '{s} adductor brevis', '{s} adductor magnus', '{s} adductor minimus', '{s} pectineus'] },
  { slug: 'gracilis', name: 'Gracilis', plain: 'Thin strap muscle on the inner thigh', region: 'thigh', bp: ['{s} gracilis'] },
  { slug: 'biceps_femoris', name: 'Biceps femoris', plain: 'Outer hamstring at the back of the thigh; bends the knee', region: 'thigh', bp: ['long head of {s} biceps femoris', 'short head of {s} biceps femoris'] },
  { slug: 'semitendinosus', name: 'Semitendinosus', plain: 'Inner hamstring at the back of the thigh', region: 'thigh', bp: ['{s} semitendinosus'] },
  { slug: 'semimembranosus', name: 'Semimembranosus', plain: 'Deep inner hamstring at the back of the thigh', region: 'thigh', bp: ['{s} semimembranosus'] },
  // ---- leg and foot ----
  { slug: 'gastrocnemius', name: 'Gastrocnemius', plain: 'The two-headed calf muscle; points the foot', region: 'leg', bp: ['medial head of {s} gastrocnemius', 'lateral head of {s} gastrocnemius'] },
  { slug: 'soleus', name: 'Soleus', plain: 'Flat calf muscle under the gastrocnemius', region: 'leg', bp: ['{s} soleus'] },
  { slug: 'tibialis_anterior', name: 'Tibialis anterior', plain: 'Front of the shin; lifts the foot', region: 'leg', bp: ['{s} tibialis anterior'] },
  { slug: 'toe_extensors', name: 'Extensor digitorum longus and extensor hallucis longus', plain: 'Long muscles at the front of the shin; lift the toes', region: 'leg', bp: ['{s} extensor digitorum longus', '{s} extensor hallucis longus'] },
  { slug: 'fibularis', name: 'Fibularis (peroneus) longus, brevis and tertius', plain: 'Muscles on the outer side of the lower leg; turn the foot outward', region: 'leg', bp: ['{s} fibularis longus', '{s} fibularis brevis', '{s} fibularis tertius'] },
  { slug: 'deep_calf', name: 'Deep posterior leg muscles', plain: 'Deep calf muscles; support the arch and curl the toes', region: 'leg', bp: ['{s} tibialis posterior', '{s} flexor digitorum longus', '{s} flexor hallucis longus', '{s} popliteus', '{s} plantaris'], layer: 'deep' },
  { slug: 'foot_intrinsic', name: 'Intrinsic muscles of the foot', plain: 'Small muscles of the sole and top of the foot; support the arch and move the toes', region: 'foot', bp: ['{s} abductor hallucis', '{s} flexor digitorum brevis', 'abductor digiti minimi of {s} foot', '{s} flexor accessorius', 'medial head of {s} flexor hallucis brevis', 'lateral head of {s} flexor hallucis brevis', 'flexor digiti minimi brevis of {s} foot', '{s} extensor hallucis brevis', 'first lumbrical of {s} foot', 'second lumbrical of {s} foot', 'third lumbrical of {s} foot', 'fourth lumbrical of {s} foot'] },
];

/** Expand `{s}` concept templates; generic names (no `{s}`) are returned once with side null. */
export function expandConcepts(templates) {
  const out = [];
  for (const t of templates) {
    if (t.includes('{s}')) for (const s of ['left', 'right']) out.push({ name: t.replace('{s}', s), side: s });
    else out.push({ name: t, side: null });
  }
  return out;
}
