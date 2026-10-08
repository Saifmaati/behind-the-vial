# Anatomy assets: license and credits

`body.glb` and `landmarks.json` in this folder are **adapted material** built by
`tools/build-anatomy.mjs` from three openly licensed anatomical datasets. All three are licensed
under **Creative Commons Attribution 4.0 International (CC BY 4.0)**,
https://creativecommons.org/licenses/by/4.0/ . The adapted files are shared under the same
license, CC BY 4.0. No non-commercial, no-derivatives or login-gated material is used.

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
- Used for: neck, head, arm, hand, leg and foot vessels and the iliac arteries in `arteries` / `veins`; skull, arm, wrist, hand and foot bones in `skeleton`.

## What was changed
- Selection of structures; merging into the named meshes listed in `docs/ARCHITECTURE.md`.
- HRA organs and SIO label masks re-meshed as single closed outer shells (voxel union + Surface Nets + Taubin smoothing).
- SIO aligned to the HRA body with a similarity transform fitted to 10 organ centroids (RMS 3.8 mm; both come from the same Visible Human Male).
- BodyParts3D (a different man, arms hanging) warped into the HRA body with a thin-plate spline fitted to ~400 landmark pairs (spine, pelvis and leg bones, organ centroids, skin cross-sections, fingertips, vessel junctions); warped vertices that landed outside the skin pushed just inside it.
- Six short tubes added where BodyParts3D has no geometry (cervical internal carotid arteries, origins of the vertebral arteries, upper internal jugular veins).
- Scaled uniformly to 1.75 m, re-centred (feet at y = 0, facing +Z), simplified with meshoptimizer, normals recomputed, UVs and textures dropped, quantized and compressed (EXT_meshopt_compression, KHR_mesh_quantization).
- `landmarks.json` (organ centres, injection sites, flow paths) was computed from these meshes for this project.
