# body: third-party assets

The v2/v3 body work adds no third-party files. Everything new is generated in code for this project:
the lifelike skin shader (procedural triplanar micro-relief, no image textures), the per-vertex skin
occlusion, the solid vessel and bone looks, the layers panel and the skin-tone swatches.

It keeps using the files already recorded in `docs/assets/body3d.md` and `ASSETS.md`: three.js r185.1
and its addons (MIT, `vendor/three/`) and the anatomy models (`assets/anatomy/*`, CC BY 4.0; HRA,
VOXEL-MAN, BodyParts3D; see `assets/anatomy/LICENSE.md`).

`assets/img/body-poster.webp` (the no-WebGL fallback still) is a render of that same CC BY 4.0
anatomy made with this project's code, so the CC BY attribution in `ASSETS.md` covers it as an
adapted work; the fallback should carry the same credit line as the live stage.
