# body: third-party assets

The body work adds no third-party files. Everything new is generated in code for this project: the
frosted-glass and lifelike skin shaders (procedural micro-relief, no image textures), the garment masks
and modesty shaping, the per-vertex skin occlusion, the vessel, bone and organ looks, the Body panel and
the skin-tone swatches.

It keeps using the files already recorded in `docs/assets/body3d.md` and `ASSETS.md`: three.js r185.1
and its addons (MIT, `vendor/three/`) and the anatomy models (`assets/anatomy/*`, CC BY 4.0; HRA,
VOXEL-MAN, BodyParts3D; see `assets/anatomy/LICENSE.md`). v4 drops the post-processing addons
(EffectComposer, RenderPass, UnrealBloomPass, OutputPass) from the stage.

## Renders of the CC BY 4.0 anatomy (adapted works; the anatomy credit in ASSETS.md covers them)

Made with this project's code from the sandbox (`tools/sandbox/body3d.html?poster=1&theme=light`), rendered
at 2× and downsampled, WebP quality 95, light stage background baked in:

| File | Size | Content |
|---|---|---|
| `assets/img/body-poster.webp` | 1600 × 1000, 60 KB | default glass view, no markers (no-WebGL fallback) |
| `assets/img/intro-body-1600.webp`, `-800.webp` | 16:9, 53 KB / 19 KB | whole body, glass, vessels visible |
| `assets/img/intro-body-4x5-1280.webp`, `-640.webp` | 4:5, 111 KB / 40 KB | the same, portrait (the intro's narrow layout) |
| `assets/img/intro-organs-1600.webp`, `-800.webp` | 16:9, 94 KB / 35 KB | head and torso, brain/stomach/heart/liver/pancreas softly highlighted |
| `assets/img/intro-organs-4x5-1280.webp`, `-640.webp` | 4:5, 133 KB / 51 KB | the same, portrait |

Wherever these stills are shown, the same credit line as the live stage applies: "Anatomy: CC BY 4.0
(HRA, VOXEL-MAN, BodyParts3D)", linking to `ASSETS.md`.
