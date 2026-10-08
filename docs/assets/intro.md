# Intro: third-party assets

The intro downloads no images, videos, models or textures of its own. Everything below is either
already vendored by foundation or produced by the anatomy pipeline.

| What | Where it comes from | License | Notes |
|---|---|---|---|
| three.js core and the addons `postprocessing/EffectComposer`, `UnrealBloomPass`, `Pass` (`FullScreenQuad`), `loaders/GLTFLoader`, `libs/meshopt_decoder.module`, `utils/BufferGeometryUtils` | `vendor/three/` (r185.1, vendored by foundation) | MIT | Imported by `js/intro.js`; not modified. |
| `environments/RoomEnvironment` | `vendor/three/addons/` | MIT | Not used any more (the sandbox product views use the intro's own studio environment). |
| `assets/anatomy/body.glb`, `assets/anatomy/landmarks.json` | anatomy pipeline (HRA 3D Reference Organs / Visible Human, VOXEL-MAN SIO, BodyParts3D) | CC BY 4.0 | Loaded by the intro for the lifelike belly and the see-through body; attribution is in ASSETS.md and the site footer. |
| Inter, Newsreader | `assets/fonts/` (self-hosted by foundation) | OFL 1.1 | Inter is drawn into the vial label canvas; the copy uses both. |

Made for this project (procedural, no source files): the studio light environment, the vial
(`js/scene/vial.js`: glass, stopper, crimp seal, flip-off cap, freeze-dried cake, label canvas), the
syringe (`js/scene/syringe.js`), the skin micro-relief texture (generated on the CPU at load), the
navel and vellus hair, the tissue block and its cut-face shader, the capillary/vein tube and its
endothelium shader, the red cells (Evans–Fung biconcave profile), the drug particles, the grade pass,
and the inline SVG still in `index.html`.
