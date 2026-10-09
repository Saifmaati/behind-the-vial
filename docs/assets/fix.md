# Fix pass: assets

No new third-party assets. Existing ones were adapted or re-rendered:

| Files | Source | Author | Licence | Changes in this pass |
|---|---|---|---|---|
| `assets/img/intro-syringe-*.webp` | https://commons.wikimedia.org/wiki/File:Insulin_syringe_foto.jpg | Rehab Center Parus | CC BY-SA 4.0 (ours too) | Printed scale numbers (10–100) and the word "UNITS" retouched out of the barrel before cropping (`tools/img/retouch-syringe.mjs`, run by `tools/img/make-intro-photos.mjs`); plain tick marks and orange caps kept. Credit lines in the intro, footer and ASSETS.md say "printed scale numbers removed". |
| `assets/img/intro-vial-{800,1200}.webp`, `intro-vial-4x5-640.webp` | https://commons.wikimedia.org/wiki/File:Chemotherapy_vials_(2).jpg (NCI #2238) | Bill Branson, NCI | Public domain | Re-cropped to the small flip-off-cap vials at the front; the tighter frame is narrower than 1600 px, so the largest files are 1200 (16:9) and 640 (4:5); no upscaling. `intro-vial-1600.webp` and `intro-vial-4x5-1280.webp` deleted. |
| `assets/img/intro-vial-caps-*.webp` | https://commons.wikimedia.org/wiki/File:Vial_caps.jpg | Epolk | CC BY-SA 4.0 (ours too) | Re-cropped to the two brown-cap rows (no teal); the 4:5 version turned 90° (a top view has no up). Colours unchanged. |
| `assets/img/intro-body-*.webp`, `intro-organs-*.webp` (+ new `-dark` variants), `body-poster-dark.webp` (new), `body-poster.webp` | Our renders of the project's anatomy (HRA 3D Reference Organs / Visible Human, VOXEL-MAN, BodyParts3D) | this project | CC BY 4.0 (anatomy credit in ASSETS.md) | Re-rendered by `tools/img/render-intro-stills.mjs` from `tools/sandbox/body3d.html` (2× then Lanczos3, WebP q90): intro stills with the blood-vessel layer OFF (see-through skin and organs only), each in a light and a dark stage background; the no-3D poster in both themes. Sizes 8–60 KB, all ≤ 200 KB. |

Rebuild:

```
node tools/img/make-intro-photos.mjs                       # photos (needs tools/.cache/photos originals)
node tools/serve.mjs 8849 &
node tools/img/render-intro-stills.mjs http://127.0.0.1:8849   # renders (ONLY=body-poster,… for a subset)
node tools/build-sources.mjs                               # data/sources.js with tools/source-overrides.mjs
node tools/docs-shots.mjs http://127.0.0.1:8849            # docs/screenshots/*.jpg (--only name,name for a subset)
```
