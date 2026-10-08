# Third-party assets and licenses

Everything the site ships that was not written for this project, with its license. Module-level
records (with build notes and hashes) live in `docs/assets/`; the anatomy's full credits are in
[`assets/anatomy/LICENSE.md`](assets/anatomy/LICENSE.md).

## Anatomy

The 3D body (`assets/anatomy/body.glb`) and its landmarks (`assets/anatomy/landmarks.json`) are
adapted from three openly licensed datasets, all under
[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
The adapted files are shared under CC BY 4.0 too.

> Anatomy adapted from the HRA 3D Reference Organs (NIH HuBMAP, Visible Human Project data, CC BY 4.0), the VOXEL-MAN Segmented Internal Organs of the Visible Human Male (Höhne et al., CC BY 4.0) and BodyParts3D (© The Database Center for Life Science, CC BY 4.0). Modified: merged, re-meshed, aligned, simplified.

| Asset | Used for | Source | Author | License | Changes |
|---|---|---|---|---|---|
| HRA 3D Reference Organ Set, United Male v1.9 | skin, brain, heart, lungs, liver, gallbladder, pancreas, spleen, intestines, kidneys, bladder; torso arteries and veins; spine, pelvis and leg bones | https://lod.humanatlas.io/ref-organ/united-male/v1.9 (DOI [10.48539/HBM884.QCWH.828](https://doi.org/10.48539/HBM884.QCWH.828)) | Kristen Browne, Heidi Schlehlein (NIH HuBMAP Human Reference Atlas), from the NLM Visible Human Male; brain from the Allen human brain reference atlas (Ding et al. 2016) | CC BY 4.0 | selected and merged, organs re-meshed as closed shells, scaled to 1.75 m, simplified, compressed |
| VOXEL-MAN Segmented Internal Organs of the Visible Human Male (SIO) | stomach, thyroid; ribs, sternum, clavicles, scapulae | https://zenodo.org/records/15882019 (DOI [10.5281/zenodo.15882019](https://doi.org/10.5281/zenodo.15882019)) | Höhne, Pflesser, Pommert, Riemer, Schiemann, Schubert, Schumacher, Tiede (VOXEL-MAN project) | CC BY 4.0 | iso-surfaces of selected labels, registered to the HRA body, simplified, compressed |
| BodyParts3D 4.0 | neck, head, arm, hand, leg and foot vessels; skull, arm, hand and foot bones | https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html (license page updated 2025-02-27) | © The Database Center for Life Science (DBCLS) | CC BY 4.0 ("BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International") | warped into the HRA body, six gap-bridging vessel tubes added, simplified, compressed |
| Visible Human Project | the underlying data of HRA and SIO | https://www.nlm.nih.gov/research/visible/visible_human.html | U.S. National Library of Medicine | credited as the origin of the HRA and SIO data | none directly |

The in-stage credit ("Anatomy: CC BY 4.0 (HRA, VOXEL-MAN, BodyParts3D)") and the site footer carry
this attribution and link here.

## Code

| Asset | Where it is used | Source | License | Changes |
|---|---|---|---|---|
| three.js r185.1: core plus the addons `loaders/GLTFLoader`, `libs/meshopt_decoder.module`, `controls/OrbitControls`, `environments/RoomEnvironment`, `postprocessing/{EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass, MaskPass, Pass, SMAAPass, FXAAPass}`, `shaders/*`, `utils/{BufferGeometryUtils, SkeletonUtils}`, `geometries/RoundedBoxGeometry` | 3D rendering (intro and body) | https://github.com/mrdoob/three.js (npm `three@0.185.1`) | MIT (`vendor/three/LICENSE`) | none, files copied as published |

## Fonts

| Asset | Files | Source | Author | License | Changes |
|---|---|---|---|---|---|
| Inter 4.1 variable (roman and italic) | `assets/fonts/InterVariable-latin.woff2`, `assets/fonts/InterVariable-Italic-latin.woff2` | https://github.com/rsms/inter/releases/tag/v4.1 | Rasmus Andersson and The Inter Project Authors | SIL Open Font License 1.1 (`assets/fonts/OFL.txt`) | subset to Latin and a few symbols; all features and both variable axes kept |

## Made for this project

No other third-party files are shipped. Drawn or generated in code for this project: the favicon,
vial mark and icon sprite, the site-picker body glyphs and content icons, every chart, the intro's
vasculature, blood cells and studio lighting, the procedural syringe (`js/scene/syringe.js`), and in
the body scene the tissue cross-section, capillary network, depot, flow lines, blood and drug
particles, floor rings and hotspots.

Dev-only tools (never shipped, `tools/package.json`): `puppeteer-core` (Apache-2.0),
`@gltf-transform/*` 4.5.0 (MIT) and `meshoptimizer` 1.2.0 (MIT).
