# Intro: third-party assets

The intro adds no third-party files of its own.

| What | Where it comes from | License | Notes |
|---|---|---|---|
| three.js core and the addons `postprocessing/EffectComposer`, `RenderPass`, `UnrealBloomPass`, `Pass` (`FullScreenQuad`) | `vendor/three/` (r185.1, vendored by foundation) | MIT | Imported by `js/intro.js`; not modified. |
| `environments/RoomEnvironment` | `vendor/three/addons/` | MIT | Dev sandbox only (`tools/sandbox/intro.html?view=syringe`), never shipped in the intro. |

Everything else is procedural and drawn for this project: the vasculature network, blood cells, studio
environment, grade/vignette/grain pass, HUD, and the syringe geometry, materials and graduation shader
(`js/scene/syringe.js`). No textures, models, fonts or images were downloaded for the intro.
