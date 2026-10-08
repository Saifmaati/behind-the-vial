# body3d: third-party assets

body3d adds no new third-party files. It uses:

| Asset | Files in repo | Source | Author | License | Modifications |
|---|---|---|---|---|---|
| three.js r185.1 addons: `controls/OrbitControls`, `environments/RoomEnvironment`, `postprocessing/{EffectComposer, RenderPass, UnrealBloomPass, OutputPass}`, `loaders/GLTFLoader`, `libs/meshopt_decoder.module`, `utils/BufferGeometryUtils` | `vendor/three/addons/…` (already vendored by foundation) | https://github.com/mrdoob/three.js (npm `three@0.185.1`) | three.js authors | MIT (`vendor/three/LICENSE`) | none |
| Anatomy (`assets/anatomy/body.glb`, `landmarks.json`) | built by the anatomy pipeline | see `docs/assets/anatomy.md` and `assets/anatomy/LICENSE.md` | HRA (NIH HuBMAP, Visible Human Project), VOXEL-MAN SIO, BodyParts3D (DBCLS) | CC BY 4.0 | none in body3d (rendering only) |

The in-stage credit ("Anatomy: CC BY 4.0 (HRA, VOXEL-MAN, BodyParts3D)") links to `ASSETS.md`.

Everything else in the 3D scene (tissue block shader, capillary network, depot, flow lines, blood cells, drug particles, floor rings, hotspots, procedural placeholder anatomy) is generated in code for this project.
