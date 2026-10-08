# Anatomy pipeline: decisions

One line each: decision, then why. Pipeline: `node tools/build-anatomy.mjs` (Node 20; `cd tools && npm install` first; needs the `unzip` CLI).

## Sources
1. **HRA United Male v1.9 is the backbone (skin, 12 organs, torso vessels, spine/pelvis/legs)**, because it is one coherent, already-aligned Visible Human Male set in metres with +Y up, +Z front and the person's left at +X, which is exactly the contract frame, under CC BY 4.0.
2. **Used the single `3d-vh-m-united.glb` (238 MB) rather than the per-organ GLBs**, because the united file already places every organ in the common body, so no placement data has to be re-applied.
3. **HRA has no stomach and no thyroid gland, so both come from the VOXEL-MAN SIO label volume (CC BY 4.0, Zenodo 2025)**, because SIO was segmented from the same Visible Human Male: a similarity fit on 10 organ centroids lands within 3.8 mm RMS, so the stomach and thyroid sit in the HRA body without guesswork.
4. **BodyParts3D 4.0 (CC BY 4.0 since its 2025-02-27 license update) supplies limb, neck and head vessels and the skull/arm/hand/foot bones**, because HRA's vasculature stops at the torso and HRA has no arm bones or skull; BodyParts3D is the only free, derivative-friendly whole-body vascular tree.
5. **The BodyParts3D OBJ headers still say CC BY-SA 2.1 JP; we rely on the licensor's current database license page (CC BY 4.0) and record both**, because the licensor re-licensed the whole database and the page is authoritative.
6. **MakeHuman and Z-Anatomy were not used**: MakeHuman's skin would need re-alignment while HRA's Visible Human skin is already aligned, and Z-Anatomy is Blender-only and itself derived from BodyParts3D.
7. **The SIO arm skin/muscle labels were not used for the arms**, because the HRA skin has re-posed (abducted) arms while SIO keeps the cadaver's arms-down pose.

## Geometry
8. **Organs are rebuilt as single closed shells** (voxel union at 1.2–2.5 mm, flood fill, Surface Nets on a blurred mask, Taubin smoothing), because HRA organs are many open surface patches and segments whose internal walls show through translucent materials.
9. **Hollow intestine and bladder tubes are capped before voxelization** so their lumens fill, giving solid organs instead of double-walled tubes.
10. **BodyParts3D is mapped with a 3D thin-plate spline on ~400 landmark pairs** (24 vertebrae + sacrum, hip and leg-bone ends, 15 organ centroids, radial samples on neck/torso/head/leg/arm cross-sections of both skins, 5 fingertips + palm per hand, 8 vessel junctions), because the two bodies differ in build and arm pose and a rigid fit was off by 15–30 mm along the spine alone.
11. **Vessel junction landmarks** (aortic arch branch origins, aortic bifurcation, both venous angles, both inguinal external iliac veins) make BodyParts3D vessels start exactly where the HRA torso vessels end.
12. **HRA's short supra-aortic stubs (brachiocephalic trunk, left common carotid, left subclavian) are replaced by the full BodyParts3D vessels**, joined at the stub origins, so the neck and arm arteries are continuous.
13. **Six procedural tubes bridge gaps that are missing in BodyParts3D 4.0** (cervical internal carotid arteries, vertebral-artery origins, upper internal jugular veins; cubic Hermite, end radii matched), because without them the carotids stop 6 cm below the skull.
14. **Warped vertices that land outside the HRA skin are pushed just inside it** (inside-field gradient, nearest-inside fallback), because superficial veins and fingers otherwise poke through the translucent skin; the build reports 100 % of organ and vessel vertices inside the skin.
15. **Vessel colour classes follow blood oxygenation (textbook convention)**: pulmonary arteries are in `veins` (blue) and pulmonary veins in `arteries` (red); this is also written into the GLB scene extras.
16. **Uniform scale 0.9593 from the 1.824 m Visible Human Male to the contract's 1.75 m**, centred on the skin's bounding box in x and z, feet at y = 0; anatomy proportions are unchanged.
17. **Skeleton (optional mesh) is a composite**: HRA spine, pelvis and legs; SIO ribs, costal cartilages, sternum, clavicles, scapulae; BodyParts3D skull, arms, wrists, hands and feet. Eyes, teeth and intervertebral discs are omitted to stay in budget.
18. **Simplification budgets**: skin 60k, organs 3k–12k each, arteries 60k + veins 60k, skeleton 60k triangles (348k total); vessels use an absolute 0.2 mm error bound so thin vessels keep their tube shape.
19. **Quantization uses one scene-wide volume**: every mesh node carries the same dequantization transform (scale 0.875, y-offset 0.875), so world-space positions come from the node's world matrix (GLTFLoader and `Box3.setFromObject` handle this automatically).
20. **Dev dependencies pinned to versions older than two weeks** (`@gltf-transform/*` 4.5.0, `meshoptimizer` 1.2.0) rather than the newest 4.5.1 / 1.3.0.

## Landmarks
21. **Navel = deepest dimple of the full-resolution anterior midline profile between L5 and L2** (1.2 mm deep, at 58.7 % of stature); the abdomen site is then 5.0 cm to the person's left and 1.5 cm below it, ray-cast onto the skin.
22. **Thigh site = front of the left thigh at the height halfway between the femur's ends** (HRA femur), ray-cast forward from the thigh's cross-section centroid.
23. **Arm site is traced on the skin**, because HRA has no arm bones and the warped humerus came out too short: axilla to fingertip centreline, ring 13 % along it (about 7 cm past the armpit fold, near mid-humerus), ray cast toward the back/outer (posterolateral) surface.
24. **Site normals are area-weighted skin normals within 15 mm**, so they are stable on the simplified skin.
25. **Flow paths walk the actual vessel meshes** (step 5–8 mm, re-centred on the lumen each step), then are resampled to about 1.8 cm, lightly smoothed, and every waypoint is checked inside the final skin (3-ray parity vote; 0 outside).
26. **Venous routes**: abdomen = superficial epigastric vein to the saphenofemoral junction; thigh = great saphenous vein; arm = cephalic vein to the axillary/subclavian veins; then external and common iliac veins and inferior vena cava, or brachiocephalic vein and superior vena cava, to the right atrium.
27. **Arterial `to_*` routes all start at the aortic valve** and follow the HRA aorta; branch-specific choices: brain via left common and internal carotid; thyroid via left subclavian, thyrocervical trunk and inferior thyroid artery; liver and gallbladder via celiac, common, proper and right hepatic (and cystic) arteries; spleen and pancreas via the splenic artery; stomach via the celiac trunk toward the lesser curvature (the left gastric artery is not in the mesh); kidneys via the left renal artery; small and large intestine via the superior and inferior mesenteric (left colic) arteries; heart muscle via the left coronary and anterior descending arteries; fat via iliac, femoral and superficial epigastric arteries to the fat under the abdomen site; muscle via the femoral artery to the left mid-thigh quadriceps; skin via the carotid toward the left cheek.
28. **Single-organ targets for paired organs go to the left side** (`to_kidneys` ends in the left kidney, the pulmonary loop uses the left lung), because a path is one waypoint array; `organs.kidneys.parts` / `organs.lungs.parts` give both sides.
29. **Anchor organs from the shared vocabulary are added to `landmarks.organs` with `anchor: true`**: `fat` (HRA subcutaneous abdominal adipose sample), `injection_site` (6 mm under the abdomen site), `muscle` (left mid-thigh quadriceps), `eyes`, `blood` (abdominal aorta), `skin` (left cheek surface, with `normal`).
30. **Previews are 256-colour PNGs** made with a small built-in quantizer (`tools/anatomy/pngquant.mjs`), to stay under 250 KB each without new dependencies.

## Contract requests
- **Please document the additive `landmarks.json` keys** in `docs/ARCHITECTURE.md`: `organs.<id>.parts.{left,right}` (lungs, kidneys), anchor entries `organs.{fat,injection_site,muscle,eyes,blood,skin}` with `anchor: true` (`skin` also has `normal`), `anchors.{navel,aortic_root,right_atrium,right_ventricle,left_atrium,left_ventricle,pulmonary_valve}` and `meta` (sources, attribution, checks). Nothing in the contract changed meaning.
- **Note for body3d (`anatomy.js`)**: mesh nodes carry the KHR_mesh_quantization transform; read world positions via `matrixWorld`, never raw `geometry.attributes.position`.
- **Note for body3d (`injection.js`)**: the arm site's normal points back and out (posterolateral), so camera framing for the arm should orbit toward the back-left of the body; the thigh and abdomen normals point forward.
- **Optional future keys** if the UI needs them: `to_kidneys_right`, `to_lungs_right`, and venous returns from organs (`liver_to_heart` via hepatic veins). Not built yet.

## Known limits
- The HRA umbilicus is shallow on the scanned skin; the navel is found from a 1.2 mm dimple, so treat the abdomen site as ±1 cm.
- The HRA transverse colon is large and low (as in the Visible Human Male), partly covering the stomach from the front.
- BodyParts3D's deep femoral artery is incomplete in mid-thigh, so `to_muscle` stays on the femoral artery and ends with a short muscular branch.
- Superficial BodyParts3D vessels in the hands and feet were moved up to ~4 cm to stay under the HRA skin; they read correctly at body scale but are approximate up close.
