# Anatomy assets: license and credits

Every file in this folder is **adapted material** built from openly licensed anatomical datasets,
all licensed under **Creative Commons Attribution 4.0 International (CC BY 4.0)**,
https://creativecommons.org/licenses/by/4.0/ . The adapted files are shared under the same
license, CC BY 4.0. No non-commercial, no-derivatives or login-gated material is used.

| File | Built by | Body | Sources |
|---|---|---|---|
| `body.glb`, `landmarks.json` | `node tools/build-anatomy.mjs` | Visible Human Male, 1.75 m | 1, 2, 3 |
| `body-female.glb`, `landmarks-female.json` | `node tools/build-anatomy.mjs --sex female` | Visible Human Female, 1.62 m | 4, 2, 3 (and 1 as the registration reference) |
| `detail-male.glb`, `atlas-male.json` | `node tools/build-anatomy-detail.mjs` | Visible Human Male, 1.75 m (same frame as `body.glb`) | 1, 2, 3 |
| `detail-female.glb`, `atlas-female.json` | `node tools/build-anatomy-detail.mjs --sex female` | Visible Human Female, 1.62 m (same frame as `body-female.glb`) | 4, 2, 3 (and 1 as the registration reference) |

## Attribution line (site footer)

> Anatomy adapted from the HRA 3D Reference Organs (NIH HuBMAP, Visible Human Project data, CC BY 4.0), the VOXEL-MAN Segmented Internal Organs of the Visible Human Male (Höhne et al., CC BY 4.0) and BodyParts3D (© The Database Center for Life Science, CC BY 4.0). Modified: merged, re-meshed, aligned, simplified.

## Sources

### 1. HRA 3D Reference Organ Set for United, Male, v1.9
- Creators: Kristen Browne and Heidi Schlehlein, Human Reference Atlas (HRA), NIH Human BioMolecular Atlas Program (HuBMAP).
- Citation: Browne, Kristen, and Heidi Schlehlein. *3D Reference Organ Set for Male, v1.9*. https://doi.org/10.48539/HBM884.QCWH.828
- Landing page: https://humanatlas.io/3d-reference-library ; dataset: https://lod.humanatlas.io/ref-organ/united-male/v1.9
- File: https://cdn.humanatlas.io/digital-objects/ref-organ/united-male/v1.9/assets/3d-vh-m-united.glb (237.7 MB, SHA-256 `958fcb9ffebfbdf4df559bb329ceecb3858458cd2e7d5f3d57f96a40439a8274`, dataset created 2026-06-08)
- Based on the Visible Human Male, U.S. National Library of Medicine (Spitzer et al. 1996, https://doi.org/10.1136/jamia.1996.96236280; Ackerman 1998, https://doi.org/10.1109/5.662875). The brain is the HRA brain reference organ (brain-male v1.4, https://doi.org/10.48539/HBM538.NKCT.649), made from the Allen human brain reference atlas (Ding et al. 2016) and resized to the Visible Human body; CC BY 4.0 since v1.3.
- License: CC BY 4.0 (stated on the dataset page).
- Used for: `skin`, `brain`, `heart`, `lungs`, `liver`, `gallbladder`, `pancreas`, `spleen`, `small_intestine`, `large_intestine`, `kidneys`, `bladder`; the torso parts of `arteries` and `veins` (aorta, coronary, renal, splenic, hepatic, cystic, mesenteric and colic vessels, venae cavae, brachiocephalic, portal, iliac and cardiac veins, pulmonary vessels); vertebrae, sacrum, coccyx, hip bones and leg bones in `skeleton`.

### 2. Segmented Internal Organs of the Visible Human Male (SIO, VOXEL-MAN)
- Creators: Karl Heinz Höhne, Bernhard Pflesser, Andreas Pommert, Martin Riemer, Thomas Schiemann, Rainer Schubert, Udo Schumacher, Ulf Tiede.
- Citation: Höhne KH et al. *Segmented Internal Organs of the Visible Human Male*. Zenodo, 2025. https://doi.org/10.5281/zenodo.15882019 (record 15882019, published 2025-08-11). Project page: https://www.virtual-body.org/segmented-internal-organs/
- Files: `VOXEL-MAN_segmented-internal-organs.zip` (395.1 MB, MD5 `dbdfada24e69591bdf9650453918d9ef`) and `SIO Object Labels.xlsx`, from https://zenodo.org/records/15882019
- Based on the Visible Human Male, U.S. National Library of Medicine.
- License: CC BY 4.0 (Zenodo record and project page).
- Used for: `stomach`, `thyroid`; ribs, costal cartilages, sternum, clavicles and scapulae in `skeleton`.

### 3. BodyParts3D 4.0
- Author: © The Database Center for Life Science (DBCLS), Research Organization of Information and Systems, Japan.
- Required credit: "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International".
- Pages: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html , license https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html (last updated 2025-02-27).
- Files: `isa_BP3D_4.0_obj_99.zip` (SHA-256 `40665852c49f218326590e204db91064a1ecfc3c6f8cbd7bbbcaac62c7cd409e`), `partof_BP3D_4.0_obj_99.zip` (SHA-256 `9fbc713fffeee924a5a657d9813d84d7eb957bded63adb854931dd5e3eb61c97`) and their element tables, from https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/
- License: CC BY 4.0 per the database license page. (The individual OBJ file headers, written in 2011–2013, still quote the older CC BY-SA 2.1 Japan license; the licensor now specifies CC BY 4.0 for the database.)
- Used for: neck, head, arm, hand, leg and foot vessels and the iliac arteries in `arteries` / `veins`; skull, arm, wrist, hand and foot bones in `skeleton`. In `body-female.glb` also the brachiocephalic and external iliac veins and the hip bones (the female HRA set has no such meshes). In `detail-male.glb`: the named muscles except those listed under source 2, and the skull, arm, hand and foot bones of `skeleton_hi`.

### 4. HRA 3D Reference Organ Set for United, Female, v1.10 (female body only)
- Creators: Kristen Browne and Heidi Schlehlein, Human Reference Atlas (HRA), NIH Human BioMolecular Atlas Program (HuBMAP).
- Citation: Browne, Kristen, and Heidi Schlehlein. *3D Reference Organ Set for Female, v1.10*. https://doi.org/10.48539/HBM637.DWBM.744
- Landing page: https://humanatlas.io/3d-reference-library ; dataset: https://lod.humanatlas.io/ref-organ/united-female/v1.10 (graph data created 2026-06-09)
- File: https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.10/assets/3d-vh-f-united.glb (374.5 MB, 374,505,632 bytes). Only the byte ranges of the needed meshes were fetched (HTTP range requests, 40.9 MB in 80 ranges); the GLB header and JSON chunk (939,536 bytes) are pinned by SHA-256 `42ecd1470c19e479cb80d445219e14b2fb3d2f9419d6e9ef03a8d6bc1ec68cc6` and every fetched range by its own SHA-256 in `tools/anatomy/hra-female-ranges.json`.
- Based on the Visible Human Female, U.S. National Library of Medicine (Spitzer and Whitlock, *The Anatomical Record* 253(2):49-57, https://doi.org/10.1002/(SICI)1097-0185(199804)253:2%3C49::AID-AR8%3E3.0.CO;2-9). The brain is the HRA brain reference organ (Allen human brain reference atlas), as in the male set.
- License: CC BY 4.0 (stated on the dataset page).
- Used for (`body-female.glb`): `skin`, `brain`, `heart`, `lungs`, `liver`, `gallbladder`, `pancreas`, `spleen`, `small_intestine`, `large_intestine`, `kidneys`, `bladder`, `uterus`, `ovaries`; the torso parts of `arteries` and `veins` (aorta, coronary, renal, splenic, hepatic, cystic, colic and uterine vessels, venae cavae, cardiac veins, pulmonary vessels); vertebrae, sacrum, coccyx, sternum, manubrium and leg bones in `skeleton`.
- The female body also uses source 2 (stomach, thyroid, ribs, costal cartilages, clavicles, scapulae), which was segmented from the Visible Human *Male*: those meshes are mapped SIO -> HRA male (similarity, 10 organ centroids) -> HRA female (thin-plate spline on 397 pairs of matching landmarks of the two bodies), so the HRA United Male v1.9 set (source 1) serves as the registration reference; none of its own geometry is in the female files.

## What was changed
- Selection of structures; merging into the named meshes listed in `docs/ARCHITECTURE.md`.
- HRA organs and SIO label masks re-meshed as single closed outer shells (voxel union + Surface Nets + Taubin smoothing).
- SIO aligned to the HRA body with a similarity transform fitted to 10 organ centroids (RMS 3.8 mm; both come from the same Visible Human Male).
- BodyParts3D (a different man, arms hanging) warped into the HRA body with a thin-plate spline fitted to ~400 landmark pairs (spine, pelvis and leg bones, organ centroids, skin cross-sections, fingertips, vessel junctions); warped vertices that landed outside the skin pushed just inside it.
- Six short tubes added where BodyParts3D has no geometry (cervical internal carotid arteries, origins of the vertebral arteries, upper internal jugular veins).
- Scaled uniformly to 1.75 m, re-centred (feet at y = 0, facing +Z), simplified with meshoptimizer, normals recomputed, UVs and textures dropped, quantized and compressed (EXT_meshopt_compression, KHR_mesh_quantization).
- `landmarks.json` (organ centres, injection sites, flow paths) was computed from these meshes for this project.

### Female body (`body-female.glb`, `landmarks-female.json`)
- Same steps as the male body, with the HRA United Female v1.10 set as the backbone, scaled uniformly to 1.62 m (scale 0.977212 from the 1.658 m Visible Human Female).
- SIO stomach, thyroid and rib cage mapped into the female body as described under source 4; where the mapped stomach overlapped the female liver, spleen, lungs, heart or colon, the overlapping vertices were moved just outside those organs and lightly smoothed.
- BodyParts3D warped straight into the female body with its own thin-plate spline (397 landmark pairs; ring samples over the breasts left out, because the BodyParts3D body is male); the female set's missing brachiocephalic and external iliac veins and hip bones supplied from BodyParts3D.
- Optional meshes `uterus` and `ovaries` added; `landmarks-female.json` has the same keys as `landmarks.json` plus `organs.uterus` and `organs.ovaries`.

### Close-up layer (`detail-male.glb`, `atlas-male.json`)
- `skin_hi`: the full-resolution HRA male skin (829,184 triangles) simplified to about 300,000 triangles in the `body.glb` frame.
- `eyes`: HRA sclera, iris and pupil, simplified, with flat per-part colours (the iris colour is illustrative).
- `muscle_<slug>`: BodyParts3D muscles warped into the HRA body with the same thin-plate spline as `body.glb`, then moved by a smooth local offset field (BodyParts3D skin to HRA skin, BodyParts3D bones to the bones shown in `body.glb`) and kept at least 3 mm under the skin; SIO abdominal wall, iliopsoas, diaphragm and pelvic floor meshed from the label slices and aligned with the same similarity transform as `body.glb`. Merged left and right, simplified.
- `skeleton_hi`: the `body.glb` skeleton recipe at a higher triangle budget.
- `atlas-male.json`: names, plain-language descriptions, body systems and centres written for this project.

### Close-up layer, female (`detail-female.glb`, `atlas-female.json`)
- The same recipe as the male close-up layer, on the HRA United Female v1.10 body (source 4) in the `body-female.glb` frame (1.62 m).
- `skin_hi`: the full-resolution HRA female skin (266,696 triangles), kept at full resolution.
- `muscle_<slug>`: BodyParts3D muscles (source 3) warped into the female body with the female build's thin-plate spline; SIO abdominal wall, iliopsoas and diaphragm (source 2) mapped in through the HRA male body as described under source 4. No pelvic floor (the SIO pelvic diaphragm is a male one) and no `eyes` (the female eye meshes were not fetched).
- `skeleton_hi`: the `body-female.glb` skeleton recipe at a higher triangle budget.
- `atlas-female.json`: names, plain-language descriptions, body systems and centres written for this project; it carries its own attribution line (HRA 3D Reference Organs, United Female; VOXEL-MAN SIO; BodyParts3D), which the footer line above also covers.
