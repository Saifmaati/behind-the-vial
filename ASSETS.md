# Third-party assets and licenses

Everything PeptideScope ships that was not written for this project, with its license. Module-level
records (build notes, hashes, crops) live in `docs/assets/`; the anatomy's full credits are in
[`assets/anatomy/LICENSE.md`](assets/anatomy/LICENSE.md). The site footer carries the anatomy and photo
attribution lines below and links to this page.

## Anatomy

The 3D bodies, their close-up layers and landmarks (`assets/anatomy/*`) are adapted from openly
licensed datasets, all under
[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
The adapted files are shared under CC BY 4.0 too.

**Attribution line (site footer, from `assets/anatomy/LICENSE.md`):**

> Anatomy adapted from the HRA 3D Reference Organs (NIH HuBMAP, Visible Human Project data, CC BY 4.0), the VOXEL-MAN Segmented Internal Organs of the Visible Human Male (Höhne et al., CC BY 4.0) and BodyParts3D (© The Database Center for Life Science, CC BY 4.0). Modified: merged, re-meshed, aligned, simplified.

**BodyParts3D's required credit:** "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International".

| File | Body | Built from | License |
|---|---|---|---|
| `body.glb`, `landmarks.json` | male, Visible Human Male, 1.75 m | HRA United Male v1.9, VOXEL-MAN SIO, BodyParts3D 4.0 | CC BY 4.0 |
| `body-female.glb`, `landmarks-female.json` | female, Visible Human Female, 1.62 m | HRA United Female v1.10, VOXEL-MAN SIO, BodyParts3D 4.0 (HRA United Male v1.9 as the registration reference) | CC BY 4.0 |
| `detail-male.glb`, `atlas-male.json` | male close-up layer (high-resolution skin, eyes, named muscles, detailed skeleton) | HRA United Male v1.9, VOXEL-MAN SIO, BodyParts3D 4.0 | CC BY 4.0 |
| `detail-female.glb`, `atlas-female.json` | female close-up layer (high-resolution skin, named muscles, detailed skeleton) | HRA United Female v1.10, VOXEL-MAN SIO, BodyParts3D 4.0 | CC BY 4.0 |

| Source | Used for | Source page | Author | License | Changes |
|---|---|---|---|---|---|
| HRA 3D Reference Organ Set, United Male v1.9 | male skin, brain, heart, lungs, liver, gallbladder, pancreas, spleen, intestines, kidneys, bladder; torso arteries and veins; spine, pelvis and leg bones; male `skin_hi` and eyes | https://lod.humanatlas.io/ref-organ/united-male/v1.9 (DOI [10.48539/HBM884.QCWH.828](https://doi.org/10.48539/HBM884.QCWH.828)) | Kristen Browne, Heidi Schlehlein (NIH HuBMAP Human Reference Atlas), from the NLM Visible Human Male; brain from the Allen human brain reference atlas (Ding et al. 2016) | CC BY 4.0 | selected and merged, organs re-meshed as closed shells, scaled to 1.75 m, simplified, compressed |
| HRA 3D Reference Organ Set, United Female v1.10 | female skin, brain, organs (plus uterus and ovaries), torso vessels, spine, sacrum, sternum and leg bones; female `skin_hi` | https://lod.humanatlas.io/ref-organ/united-female/v1.10 (DOI [10.48539/HBM637.DWBM.744](https://doi.org/10.48539/HBM637.DWBM.744)) | Kristen Browne, Heidi Schlehlein (NIH HuBMAP Human Reference Atlas), from the NLM Visible Human Female | CC BY 4.0 | same as the male set; scaled to 1.62 m; only the needed byte ranges fetched (hash-pinned) |
| VOXEL-MAN Segmented Internal Organs of the Visible Human Male (SIO) | stomach, thyroid; ribs, sternum, clavicles, scapulae; abdominal wall, iliopsoas, diaphragm (and the male pelvic floor) in the close-up layers | https://zenodo.org/records/15882019 (DOI [10.5281/zenodo.15882019](https://doi.org/10.5281/zenodo.15882019)) | Höhne, Pflesser, Pommert, Riemer, Schiemann, Schubert, Schumacher, Tiede (VOXEL-MAN project) | CC BY 4.0 | iso-surfaces of selected labels, registered to the HRA bodies (female: through the HRA male body), simplified, compressed |
| BodyParts3D 4.0 | neck, head, arm, hand, leg and foot vessels; skull, arm, hand and foot bones; named muscles in the close-up layers; female hip bones and two veins | https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html (license page updated 2025-02-27) | © The Database Center for Life Science (DBCLS) | CC BY 4.0 | warped into the HRA bodies (thin-plate splines), six gap-bridging vessel tubes added, simplified, compressed |
| Visible Human Project | the underlying data of HRA and SIO | https://www.nlm.nih.gov/research/visible/visible_human.html | U.S. National Library of Medicine | credited as the origin of the HRA and SIO data | none directly |

### Renders of the anatomy (adapted works, CC BY 4.0)

Rendered with this project's code from the anatomy above; the anatomy attribution covers them.

| Files | Content |
|---|---|
| `assets/img/body-poster.webp`, `body-poster-dark.webp` | still of the default see-through body (shown when 3D cannot start), light and dark stage |
| `assets/img/intro-body-{800,1600}.webp`, `intro-body-4x5-{640,1280}.webp` (+ `-dark` variants) | intro: whole see-through body with its organs; no blood vessels (owner, v4); light and dark stage |
| `assets/img/intro-organs-{800,1600}.webp`, `intro-organs-4x5-{640,1280}.webp` (+ `-dark` variants) | intro: head and torso with brain, stomach, heart, liver and pancreas softly highlighted; no blood vessels |

Rendered from this project's 3D scene by `tools/img/render-intro-stills.mjs` (see docs/assets/fix.md).

## Photographs (intro)

Licences checked on each file's own Wikimedia Commons page (and, for the NCI images, NCI Visuals
Online via the Internet Archive) on 2026-10-08. Crops, sizes and hashes: `docs/assets/photos.md`.

**Attribution line (site footer and the intro's "Photo credits"):**

> Photos: insulin syringe by Rehab Center Parus and vial caps by Epolk, both CC BY-SA 4.0, via Wikimedia Commons (cropped, resized; syringe background and printed scale numbers removed); medicine vials (Bill Branson) and blood-cell micrograph (Bruce Wetzel, Harry Schaefer) from the National Cancer Institute, public domain.

| Asset | Files | Source | Author | License | Changes |
|---|---|---|---|---|---|
| Insulin syringe with orange caps | `assets/img/intro-syringe-*.webp` | https://commons.wikimedia.org/wiki/File:Insulin_syringe_foto.jpg | Rehab Center Parus | CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/); our versions are CC BY-SA 4.0 too | printed scale numbers (10–100) and the word "UNITS" removed from the barrel (the plain tick marks stay; `tools/img/retouch-syringe.mjs`); cropped, resized, one version rotated 45°, one with the white background made transparent; metadata removed |
| Medicine vial caps (top view) | `assets/img/intro-vial-caps-*.webp` | https://commons.wikimedia.org/wiki/File:Vial_caps.jpg | Epolk | CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/); our versions are CC BY-SA 4.0 too | cropped to the brown-cap rows (no teal), resized, the 4:5 version turned a quarter (top view); metadata (incl. GPS) removed |
| Glass medicine vials ("Chemotherapy Vials", 1986) | `assets/img/intro-vial-*.webp` (not `-caps`) | https://commons.wikimedia.org/wiki/File:Chemotherapy_vials_(2).jpg (NCI Visuals Online #2238) | Bill Branson, National Cancer Institute | Public domain (US government work) | cropped to the small vials at the front, resized |
| Scanning electron micrograph of human blood (1982) | `assets/img/intro-blood-*.webp` | https://commons.wikimedia.org/wiki/File:SEM_blood_cells.jpg (NCI Visuals Online #2129) | Bruce Wetzel and Harry Schaefer, National Cancer Institute | Public domain (US government work) | cropped, resized; the intro adds a red tint with a CSS filter ("colour added" in its caption) |

The vials in these photos are other medicines, not peptides; the site never captions them as peptide
vials. The syringe's printed scale numbers have been removed from our copies (ARCHITECTURE.md: tick marks
carry no numbers or units).

## Code

| Asset | Where it is used | Source | Author | License | Changes |
|---|---|---|---|---|---|
| three.js r185.1: core (`vendor/three/three.module.min.js`, `three.core.min.js`) and the addons `controls/OrbitControls`, `environments/RoomEnvironment`, `loaders/GLTFLoader`, `libs/meshopt_decoder.module`, `utils/BufferGeometryUtils` (loaded by the 3D body); also vendored but no longer loaded by the site since v4: `postprocessing/*`, `shaders/*`, `utils/SkeletonUtils`, `geometries/RoundedBoxGeometry` | the 3D body (the v4 intro uses no WebGL) | https://github.com/mrdoob/three.js (npm `three@0.185.1`) | three.js authors | MIT (`vendor/three/LICENSE`) | none, files copied as published |

## Fonts

| Asset | Files | Source | Author | License | Changes |
|---|---|---|---|---|---|
| Nunito (variable, roman) | `assets/fonts/Nunito-latin.woff2` | Google Fonts' OFL repository, `ofl/nunito/Nunito[wght].ttf` (commit `2eb0b48d`), https://github.com/google/fonts ; upstream https://github.com/googlefonts/nunito | The Nunito Project Authors | SIL Open Font License 1.1 (`assets/fonts/OFL-Nunito.txt`) | weight range limited to 600–900, Latin subset, WOFF2 |
| DM Sans (variable, roman) | `assets/fonts/DMSans-latin.woff2` | Google Fonts' OFL repository, `ofl/dmsans/DMSans[opsz,wght].ttf` (same commit); upstream https://github.com/googlefonts/dm-fonts | The DM Sans Project Authors | SIL Open Font License 1.1 (`assets/fonts/OFL-DMSans.txt`) | optical size pinned to 14, weight range 400–700, Latin subset, WOFF2 |

Inter and Newsreader (used before v4) are no longer shipped.

## Made for this project

No other third-party files are shipped. Drawn or generated in code for this project: the favicon, the
vial mark and the icon sprite, the site-picker body glyphs and content icons, the drawn vials in "What's
really in the vial", the 404 page, the procedural syringe used in the 3D injection
(`js/scene/syringe.js`), and in the body scene the skin and glass shaders, modesty clothing, tissue
cross-section, capillary network, depot, flow lines, blood and drug particles, floor rings and hotspots.

Design references (patterns only, no code or assets copied): 21st.dev "Basic Stepper", "Grid Feature
Cards", the expandable-card-to-dialog pattern and the scroll-triggered chapter hero; the ui-ux-pro-max
skill for the "Minimalism & Swiss" style, the Nunito + DM Sans pairing and the UX checks.

Dev-only tools (never shipped, `tools/package.json`): `puppeteer-core` (Apache-2.0),
`@gltf-transform/*` 4.5.0 (MIT), `meshoptimizer` 1.2.0 (MIT), and `sharp` 0.35.5 (Apache-2.0, already
installed as a dependency of the glTF tools; used by `tools/img/` to make the photo WebPs).
