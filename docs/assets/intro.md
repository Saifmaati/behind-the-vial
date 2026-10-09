# Intro: third-party assets

The v4 intro adds no third-party assets of its own. It shows pictures produced by two other steps,
and loads no three.js, models or textures any more.

| What | Files | Where it comes from | Licence | Changes made by the intro |
|---|---|---|---|---|
| Real photographs: glass medicine vials (Bill Branson, NCI), vial caps (Epolk), insulin syringe with orange caps (Rehab Center Parus), electron micrograph of human blood (Bruce Wetzel and Harry Schaefer, NCI) | `assets/img/intro-vial-*`, `intro-vial-caps-*`, `intro-syringe-cutout-*`, `intro-blood-*` | photos step; sources, licence evidence and crops in `docs/assets/photos.md` | Public domain (NCI) and CC BY-SA 4.0 (Epolk, Rehab Center Parus) | Displayed only. The syringe cut-out is turned 45° with CSS in portrait frames; the blood micrograph gets a red tint with a CSS filter (its caption says "colour added"). The files are not modified. |
| Renders of our 3D anatomy (whole body; organs) | `assets/img/intro-body-*`, `intro-organs-*` | body step, rendered from the project's anatomy (HRA 3D Reference Organs / Visible Human data, VOXEL-MAN, BodyParts3D) | CC BY 4.0 | Displayed only. |
| Nunito, DM Sans | `assets/fonts/` (self-hosted by foundation) | foundation | OFL 1.1 | none |

Attribution on the page: a one-line caption under each picture ("Real photo · author · licence",
"Our 3D render of real anatomy data · CC BY 4.0") and a "Photo credits" disclosure on the end card
with the full credit line, links to the CC BY-SA 4.0 and CC BY 4.0 deeds, and ASSETS.md. The intro
does not write ASSETS.md; the photo section for it is ready to paste in `docs/assets/photos.md`.

Removed with v4: the procedural vial (`js/scene/vial.js`, deleted), the intro's use of
`js/scene/syringe.js` (kept for the 3D injection sequence), the studio environment, skin micro-relief,
tissue block, red-cell meshes and the inline SVG still. They were all made for this project, so no
licence records change.
