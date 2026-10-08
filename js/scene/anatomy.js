// PeptideScope: anatomy (body3d).
// Loads assets/anatomy/body.glb + landmarks.json (GLTFLoader + MeshoptDecoder); the female variant
// loads body-female.glb + landmarks-female.json (same names and frame). Until those files exist it
// builds a procedural placeholder with the SAME API: a smooth mannequin (signed-distance field meshed
// with surface nets), organs at anatomically sensible positions, a vessel tree, a faint skeleton, and
// placeholder landmarks (organ centres, injection sites, flow paths).
//
//   const anatomy = await loadAnatomy(stage, { source: 'auto' | 'placeholder' | 'glb', base?, variant: 'male' | 'female' });
//   (base: optional asset folder URL, a dev/test hook; defaults to assets/anatomy/ next to the site)
//   anatomy.landmarks; anatomy.meshes[organId]; anatomy.siteHotspots
//   anatomy.highlight(organId, { color, intensity, pulse, channel }); anatomy.unhighlight(organId, { channel })
//   anatomy.clearHighlights(channel?); anatomy.setFocus(organId | null); anatomy.organCenter(organId, out?) → Vector3
//   anatomy.selectSite(site | null); anatomy.siteFrame(site) → { point, normal, tangent, bitangent }
//   anatomy.setSkinCut(center | null, radius, amount, planeNormal?) — section window for the injection
//   close-up (skin and vessel walls on the camera side of the plane fade, with a contour line)
//   anatomy.setIsolate(bool); anatomy.setHotspotsVisible(bool); anatomy.setHoverSite(site | null)
//
// Editable body (appearance only; v2). The whole anatomy group scales uniformly about the feet
// (height), and the skin is displaced along its normals in the vertex shader by a per-vertex regional
// weight (aMorph: x = subcutaneous fat share, y = central/abdominal share, z = limb share), so weight
// thickens the belly, hips, thighs, upper arms and back far more than the face, hands, feet and shins.
// Organs and vessels never change shape. Nothing here is ever shown as a number.
//   anatomy.setBody({ scale, fat, age }, { instant }) — targets; tweened per frame (instant under
//     reduced motion). scale: uniform (1 = the model's own height); fat: skin offset in metres at
//     weight 1 (model units, may be slightly negative); age: central-fat shift in metres.
//   anatomy.onBodyChange(fn(body)) → off — called on every tween step (positions already updated)
//   anatomy.body → { scale, fat, age } current; anatomy.modelHeight (m, before scale); anatomy.variant
//   anatomy.toWorld(v) (model → world, in place); anatomy.siteOffset(site) → model-space Vector3 (the
//     skin offset at the site, reused object); anatomy.siteTissue(site) → { fatScale } (subcutaneous
//     fat thickness under the site relative to the default body)
//   World-space getters (organCenter, organAnchor, organRadius, siteFrame) already include the body
//   scale and the skin offset; siteFrame objects are updated in place, so references stay valid.
//
// Highlight channels, strongest first: risk > effect > focus > arrival > default; 'drug' is a
// champagne underlay that the other channels sit on top of.
//
// World frame: meters, Y up, feet at y = 0, faces +Z, the person's left is +X.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const DEG = Math.PI / 180;
const ASSET_BASE = new URL('../../assets/anatomy/', import.meta.url);

export const MESH_ORGANS = ['brain', 'thyroid', 'heart', 'lungs', 'liver', 'gallbladder', 'stomach', 'pancreas',
  'spleen', 'small_intestine', 'large_intestine', 'kidneys', 'bladder'];
export const ANCHOR_ORGANS = ['skin', 'fat', 'injection_site', 'muscle', 'eyes', 'blood'];
export const ORGAN_IDS = [...MESH_ORGANS, ...ANCHOR_ORGANS];
export const ORGAN_LABELS = {
  brain: 'Brain', thyroid: 'Thyroid', heart: 'Heart', lungs: 'Lungs', liver: 'Liver', gallbladder: 'Gallbladder',
  stomach: 'Stomach', pancreas: 'Pancreas', spleen: 'Spleen', small_intestine: 'Small intestine',
  large_intestine: 'Large intestine', kidneys: 'Kidneys', bladder: 'Bladder', skin: 'Skin', fat: 'Fat tissue',
  injection_site: 'Injection site', muscle: 'Muscle', eyes: 'Eyes', blood: 'Bloodstream',
};
// Muted, desaturated natural tints (sRGB hex), like an anatomical plate under warm light. Never a
// "safe" green: the gallbladder is a muted ochre rather than bile green.
export const ORGAN_COLORS = {
  heart: 0x8f3b3e, liver: 0x7c4636, stomach: 0xbf958b, small_intestine: 0xc8a395, large_intestine: 0xb28c7d,
  pancreas: 0xcdb88f, kidneys: 0x7d3d44, brain: 0xc2aea7, lungs: 0xbd989c, thyroid: 0xa0494c,
  gallbladder: 0x9a8152, spleen: 0x6f3c50, bladder: 0xcab395,
};
const CHANNELS = ['risk', 'effect', 'focus', 'arrival', 'default'];
const SITES = ['abdomen', 'thigh', 'arm'];
const SITE_LABELS = { abdomen: 'Abdomen', thigh: 'Thigh', arm: 'Upper arm' };

// Luxury palette (docs/ARCHITECTURE.md, v2): obsidian + ivory + champagne; oxblood arteries, sapphire
// veins. Dark: glass skin with a champagne fresnel rim and engraved contour hairlines. Light: ivory
// ground with ink linework.
const THEME = {
  dark: {
    skin: { core: 0x2b2216, rim: 0xe6d3a3, coreAlpha: 0.022, rimAlpha: 0.6, rimPower: 2.5, intensity: 1.08, scan: 0xf1dda8, scanAmt: 0.5, contour: 0.1, additive: true, cutLine: 0xf1dda8 },
    artery: { core: 0x6a1f1b, rim: 0xc4524a, coreAlpha: 0.3, rimAlpha: 0.6, rimPower: 1.6, intensity: 1.0, additive: true },
    vein: { core: 0x1c2a4e, rim: 0x5b7db8, coreAlpha: 0.32, rimAlpha: 0.6, rimPower: 1.6, intensity: 1.0, additive: true },
    bone: { core: 0xe8dcc4, rim: 0xf3eee6, coreAlpha: 0.008, rimAlpha: 0.15, rimPower: 2.2, intensity: 0.75, additive: true },
    organ: { opacity: 0.8, emissiveBase: 0.03, rim: 0.3, rimPower: 2.6, roughness: 0.52, env: 0.42, rimTint: 0xf1e4c4 },
    highlightGain: 0.72,
    tintGain: 0.5, tintMax: 0.55,
    hotspot: 0xe6d3a3,
    anchorAdditive: true,
    drug: 0xf1dda8,
  },
  light: {
    skin: { core: 0xd9ccb2, rim: 0x2e2920, coreAlpha: 0.035, rimAlpha: 0.74, rimPower: 2.6, intensity: 1.0, scan: 0x7a5c28, scanAmt: 0.32, contour: 0.09, additive: false, cutLine: 0x7a5c28 },
    artery: { core: 0xa63a33, rim: 0x7a2420, coreAlpha: 0.55, rimAlpha: 0.5, rimPower: 1.4, intensity: 1.0, additive: false },
    vein: { core: 0x3a5a92, rim: 0x22406e, coreAlpha: 0.5, rimAlpha: 0.5, rimPower: 1.4, intensity: 1.0, additive: false },
    bone: { core: 0x8a7f6c, rim: 0x5a5244, coreAlpha: 0.02, rimAlpha: 0.18, rimPower: 2.0, intensity: 1.0, additive: false },
    organ: { opacity: 0.9, emissiveBase: 0.0, rim: 0.16, rimPower: 2.2, roughness: 0.56, env: 0.9, rimTint: 0xfffdf8 },
    highlightGain: 0.55,
    tintGain: 0.58, tintMax: 0.66,
    hotspot: 0x7a5c28,
    anchorAdditive: false,
    drug: 0x8f6c2c,
  },
};

// =====================================================================================
// Shared fresnel material (skin, vessel walls, bones)
// =====================================================================================
const FRESNEL_VERT = /* glsl */`
  varying vec3 vWorld;
  varying vec3 vNormalW;
  #ifdef MORPH
  // editable body (appearance only): skin offset along the normal, weighted per region
  attribute vec3 aMorph;
  uniform float uFat; uniform float uAge;
  #endif
  void main() {
    vec3 p = position;
    #ifdef MORPH
    p += normal * (aMorph.x * uFat + (aMorph.y - 0.35 * aMorph.z) * uAge);
    #endif
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const FRESNEL_FRAG = /* glsl */`
  uniform vec3 uCore; uniform vec3 uRim; uniform vec3 uScanColor; uniform vec3 uTint;
  uniform float uCoreAlpha; uniform float uRimAlpha; uniform float uRimPower; uniform float uIntensity;
  uniform float uOpacity; uniform float uScanY; uniform float uScanAmt; uniform float uContour; uniform float uTintAmt;
  uniform vec4 uCut; uniform float uCutAmt; uniform vec3 uCutN; uniform vec3 uCutLine; uniform float uCutLineAmt;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 v = normalize(cameraPosition - vWorld);
    float ndv = abs(dot(n, v));
    float fr = pow(1.0 - ndv, uRimPower);
    vec3 col = mix(uCore, uRim, fr);
    float a = uCoreAlpha + uRimAlpha * fr;
    if (uContour > 0.0) {
      float f = vWorld.y / 0.028;
      float g = abs(fract(f - 0.5) - 0.5) / max(fwidth(f), 1e-4);
      float line = 1.0 - min(g, 1.0);
      a += line * uContour * (0.35 + 0.65 * fr);
    }
    if (uScanAmt > 0.0) {
      float d = vWorld.y - uScanY;
      float band = exp(-d * d * 9000.0);
      float trail = (1.0 - step(0.0, d)) * exp(d * 12.0);
      float w = 0.15 + 0.85 * fr;
      col += uScanColor * (band * 0.45 + trail * 0.12) * uScanAmt * w;
      a += (band * 0.22 + trail * 0.03) * uScanAmt * w;
    }
    if (uTintAmt > 0.0) {
      col = mix(col, uTint, clamp(uTintAmt, 0.0, 1.0) * (0.35 + 0.65 * fr));
      a += uTintAmt * 0.18 * (0.3 + fr);
    }
    if (uCutAmt > 0.0) {
      // Section cut for the injection close-up: within uCut.w of the site, everything on the camera
      // side of the section plane (normal uCutN) is removed, and a fine contour marks where the shell
      // meets the plane. With no plane normal it falls back to a round window.
      vec3 dp = vWorld - uCut.xyz;
      float dc = length(dp);
      if (dot(uCutN, uCutN) > 0.25) {
        // a window: within uCut.w of the site, measured in the section plane, the shell on the camera
        // side is removed however far toward the camera it is; outside the window the body stays whole
        float sd = dot(dp, uCutN);
        float dpl = length(dp - uCutN * sd);
        float inR = 1.0 - smoothstep(uCut.w * 0.7, uCut.w, dpl);
        a *= 1.0 - uCutAmt * inR * smoothstep(-0.0025, 0.0025, sd);
        float fw = max(fwidth(sd), 1e-5);
        float near = 1.0 - smoothstep(uCut.w * 0.45, uCut.w * 0.95, dpl); // the contour frames the window
        float line = (1.0 - smoothstep(0.35 * fw, 1.4 * fw + 0.0003, abs(sd))) * near * uCutLineAmt * uCutAmt;
        col = mix(col, uCutLine, clamp(line, 0.0, 1.0) * 0.8);
        a = max(a, line * 0.5);
      } else {
        a *= mix(1.0, smoothstep(uCut.w * 0.5, uCut.w, dc), uCutAmt);
      }
    }
    gl_FragColor = vec4(col * uIntensity, clamp(a, 0.0, 1.0) * uOpacity);
  }`;

function makeFresnelMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCore: { value: new THREE.Color() }, uRim: { value: new THREE.Color() }, uScanColor: { value: new THREE.Color() },
      uTint: { value: new THREE.Color() }, uTintAmt: { value: 0 },
      uCoreAlpha: { value: 0.03 }, uRimAlpha: { value: 0.7 }, uRimPower: { value: 2 }, uIntensity: { value: 1 },
      uOpacity: { value: 1 }, uScanY: { value: -1 }, uScanAmt: { value: 0 }, uContour: { value: 0 },
      uCut: { value: new THREE.Vector4(0, -10, 0, 0.05) }, uCutAmt: { value: 0 },
      uCutN: { value: new THREE.Vector3() }, uCutLine: { value: new THREE.Color() }, uCutLineAmt: { value: 0 },
      uFat: { value: 0 }, uAge: { value: 0 },
    },
    vertexShader: FRESNEL_VERT,
    fragmentShader: FRESNEL_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}
function applyFresnelTheme(mat, T, { scan = false, contour = false } = {}) {
  const u = mat.uniforms;
  u.uCore.value.setHex(T.core);
  u.uRim.value.setHex(T.rim);
  u.uCoreAlpha.value = T.coreAlpha;
  u.uRimAlpha.value = T.rimAlpha;
  u.uRimPower.value = T.rimPower;
  u.uIntensity.value = T.intensity;
  if (scan) { u.uScanColor.value.setHex(T.scan); mat.userData.scanAmt = T.scanAmt; }
  u.uContour.value = contour ? T.contour : 0;
  mat.blending = T.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  mat.needsUpdate = true;
}

// Organ material: softly lit, semi-translucent, with a view-dependent rim that makes it read as tissue.
function makeOrganMaterial(hex) {
  const color = new THREE.Color(hex);
  const mat = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.42, metalness: 0, transparent: true, opacity: 0.8,
    clearcoat: 0.28, clearcoatRoughness: 0.45, sheen: 0.35, sheenRoughness: 0.65,
    sheenColor: color.clone().lerp(new THREE.Color(0xf1e4c4), 0.4),
    emissive: color.clone(), emissiveIntensity: 1, envMapIntensity: 0.9, depthWrite: true,
  });
  const rim = { uRimColor: { value: color.clone().lerp(new THREE.Color(1, 1, 1), 0.35) }, uRimStrength: { value: 0.6 }, uRimPower: { value: 2.4 } };
  mat.userData.rim = rim;
  mat.userData.baseColor = color.clone();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRimColor = rim.uRimColor;
    sh.uniforms.uRimStrength = rim.uRimStrength;
    sh.uniforms.uRimPower = rim.uRimPower;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;\nuniform float uRimPower;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float rimF = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), uRimPower);
          totalEmissiveRadiance += uRimColor * rimF * uRimStrength;
          diffuseColor.a = clamp(diffuseColor.a * (0.72 + 0.28 * rimF) + rimF * 0.3 * opacity, 0.0, 1.0);
          totalEmissiveRadiance *= clamp(opacity * 1.6, 0.0, 1.0);
        }`);
  };
  return mat;
}

// =====================================================================================
// Procedural placeholder: geometry helpers
// =====================================================================================
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const mirror = (pts) => pts.map((p) => [-p[0], p[1], p[2]]);
function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function lerpProfile(profile, u) {
  // profile: [[u, r], ...] sorted by u, smooth interpolation
  if (u <= profile[0][0]) return profile[0][1];
  for (let i = 1; i < profile.length; i++) {
    const [u1, r1] = profile[i];
    if (u <= u1) {
      const [u0, r0] = profile[i - 1];
      return r0 + (r1 - r0) * smoothstep(0, 1, (u - u0) / (u1 - u0));
    }
  }
  return profile[profile.length - 1][1];
}

// Variable-radius tube along a centripetal Catmull-Rom curve, with rounded ends.
function tubeGeometry(points, radius, { radial = 12, step = 0.004, cap = true, minSeg = 8 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(V), false, 'centripetal');
  const L = curve.getLength();
  const n = Math.max(minSeg, Math.ceil(L / step));
  const frames = curve.computeFrenetFrames(n, false);
  const rf = typeof radius === 'function' ? radius : Array.isArray(radius) ? (u) => lerpProfile(radius, u) : () => radius;
  const R = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const u = i / n, s = u * L;
    let r = rf(u, s, L);
    if (cap) {
      const r0 = rf(0, 0, L), r1 = rf(1, L, L);
      if (s < r0) r *= Math.sqrt(Math.max(0, 1 - (1 - s / r0) ** 2));
      if (L - s < r1) r *= Math.sqrt(Math.max(0, 1 - (1 - (L - s) / r1) ** 2));
    }
    R[i] = Math.max(r, 1e-5);
  }
  const pos = new Float32Array((n + 1) * (radial + 1) * 3);
  const nor = new Float32Array((n + 1) * (radial + 1) * 3);
  const uv = new Float32Array((n + 1) * (radial + 1) * 2);
  const P = new THREE.Vector3(), N = new THREE.Vector3(), T = new THREE.Vector3();
  let o = 0, ou = 0;
  for (let i = 0; i <= n; i++) {
    curve.getPointAt(i / n, P);
    T.copy(frames.tangents[i]);
    const dr = (R[Math.min(n, i + 1)] - R[Math.max(0, i - 1)]) / ((Math.min(n, i + 1) - Math.max(0, i - 1)) * (L / n));
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      N.set(0, 0, 0).addScaledVector(frames.normals[i], c).addScaledVector(frames.binormals[i], s);
      pos[o] = P.x + N.x * R[i]; pos[o + 1] = P.y + N.y * R[i]; pos[o + 2] = P.z + N.z * R[i];
      N.addScaledVector(T, -dr).normalize();
      nor[o] = N.x; nor[o + 1] = N.y; nor[o + 2] = N.z;
      uv[ou] = i / n; uv[ou + 1] = j / radial;
      o += 3; ou += 2;
    }
  }
  const idx = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = (i + 1) * (radial + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.userData.length = L;
  return g;
}

// Unit sphere → deformed organ shape. deform(u, v) gets the unit direction u and the scaled point v.
function deformedSphere({ center, radii, deform, rotation, seg = [56, 36] }) {
  let g = new THREE.SphereGeometry(1, seg[0], seg[1]);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-6);
  const p = g.attributes.position;
  const u = new THREE.Vector3(), v = new THREE.Vector3();
  const q = rotation ? new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0] * DEG, rotation[1] * DEG, rotation[2] * DEG)) : null;
  for (let i = 0; i < p.count; i++) {
    u.fromBufferAttribute(p, i).normalize();
    v.set(u.x * radii[0], u.y * radii[1], u.z * radii[2]);
    if (deform) deform(u, v, radii);
    if (q) v.applyQuaternion(q);
    v.x += center[0]; v.y += center[1]; v.z += center[2];
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(p.count * 2), 2));
  return g;
}
function merge(geos) {
  const m = mergeGeometries(geos.map((g) => (g.index ? g : g.toNonIndexed())), false);
  for (const g of geos) g.dispose();
  return m;
}

// =====================================================================================
// Procedural placeholder: the mannequin (SDF → surface nets)
// =====================================================================================
function ell(c, r, k) {
  return { kind: 0, cx: c[0], cy: c[1], cz: c[2], irx: 1 / r[0], iry: 1 / r[1], irz: 1 / r[2], rmin: Math.min(...r), k,
    min: [c[0] - r[0], c[1] - r[1], c[2] - r[2]], max: [c[0] + r[0], c[1] + r[1], c[2] + r[2]] };
}
function rcone(a, b, r1, r2, k) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2;
  return { kind: 1, ax: a[0], ay: a[1], az: a[2], bax, bay, baz, l2, rr, a2: l2 - rr * rr, il2: 1 / l2, r1, r2, k,
    min: [Math.min(a[0] - r1, b[0] - r2), Math.min(a[1] - r1, b[1] - r2), Math.min(a[2] - r1, b[2] - r2)],
    max: [Math.max(a[0] + r1, b[0] + r2), Math.max(a[1] + r1, b[1] + r2), Math.max(a[2] + r1, b[2] + r2)] };
}
function primDist(P, x, y, z) {
  if (P.kind === 0) {
    const ax = (x - P.cx) * P.irx, ay = (y - P.cy) * P.iry, az = (z - P.cz) * P.irz;
    const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
    const bx = ax * P.irx, by = ay * P.iry, bz = az * P.irz;
    const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
    return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -P.rmin;
  }
  const pax = x - P.ax, pay = y - P.ay, paz = z - P.az;
  const yv = pax * P.bax + pay * P.bay + paz * P.baz;
  const zv = yv - P.l2;
  const qx = pax * P.l2 - P.bax * yv, qy = pay * P.l2 - P.bay * yv, qz = paz * P.l2 - P.baz * yv;
  const x2 = qx * qx + qy * qy + qz * qz;
  const y2 = yv * yv * P.l2, z2 = zv * zv * P.l2;
  const kk = Math.sign(P.rr) * P.rr * P.rr * x2;
  if (Math.sign(zv) * P.a2 * z2 > kk) return Math.sqrt(x2 + z2) * P.il2 - P.r2;
  if (Math.sign(yv) * P.a2 * y2 < kk) return Math.sqrt(x2 + y2) * P.il2 - P.r1;
  return (Math.sqrt(x2 * P.a2 * P.il2) + yv * P.rr) * P.il2 - P.r1;
}
function smin(a, b, k) {
  if (k <= 0) return a < b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function bodyPrimitives() {
  const P = [];
  const both = (make) => { P.push(make(1)); P.push(make(-1)); };
  // head + neck
  P.push(ell([0, 1.636, -0.006], [0.077, 0.098, 0.095], 0));
  P.push(ell([0, 1.578, 0.028], [0.06, 0.064, 0.068], 0.03));
  P.push(ell([0, 1.538, 0.05], [0.03, 0.024, 0.03], 0.02));
  P.push(ell([0, 1.613, 0.094], [0.011, 0.022, 0.014], 0.008));
  both((s) => ell([s * 0.077, 1.625, -0.006], [0.01, 0.028, 0.018], 0.006));
  P.push(rcone([0, 1.43, -0.012], [0, 1.57, -0.006], 0.06, 0.05, 0.04));
  // shoulders + torso
  both((s) => rcone([0, 1.445, -0.03], [s * 0.165, 1.425, -0.018], 0.062, 0.052, 0.05));
  P.push(ell([0, 1.29, -0.004], [0.165, 0.18, 0.11], 0.06));
  both((s) => ell([s * 0.078, 1.335, 0.05], [0.072, 0.056, 0.05], 0.04));
  P.push(ell([0, 1.075, 0.005], [0.145, 0.155, 0.108], 0.06));
  P.push(ell([0, 1.015, 0.028], [0.124, 0.1, 0.085], 0.05));
  P.push(ell([0, 0.918, -0.01], [0.168, 0.112, 0.106], 0.06));
  both((s) => ell([s * 0.075, 0.87, -0.046], [0.086, 0.09, 0.076], 0.04));
  // arms (slightly abducted)
  both((s) => ell([s * 0.19, 1.395, -0.012], [0.058, 0.075, 0.06], 0.035));
  both((s) => rcone([s * 0.196, 1.39, -0.016], [s * 0.255, 1.115, -0.03], 0.046, 0.036, 0.016));
  both((s) => rcone([s * 0.255, 1.115, -0.03], [s * 0.3, 0.866, 0.0], 0.037, 0.025, 0.016));
  both((s) => ell([s * 0.268, 1.04, -0.018], [0.037, 0.075, 0.036], 0.02));
  both((s) => ell([s * 0.312, 0.79, 0.008], [0.019, 0.075, 0.042], 0.016));
  both((s) => rcone([s * 0.304, 0.845, 0.032], [s * 0.3, 0.792, 0.056], 0.012, 0.009, 0.01));
  // legs
  both((s) => rcone([s * 0.09, 0.88, 0.0], [s * 0.1, 0.5, 0.012], 0.088, 0.054, 0.05));
  both((s) => ell([s * 0.098, 0.7, 0.028], [0.068, 0.15, 0.06], 0.03));
  both((s) => ell([s * 0.1, 0.5, 0.02], [0.05, 0.05, 0.05], 0.02));
  both((s) => rcone([s * 0.1, 0.49, 0.008], [s * 0.105, 0.085, -0.012], 0.05, 0.032, 0.02));
  both((s) => ell([s * 0.103, 0.37, -0.026], [0.048, 0.1, 0.05], 0.03));
  both((s) => ell([s * 0.105, 0.07, -0.01], [0.034, 0.04, 0.038], 0.02));
  both((s) => rcone([s * 0.105, 0.038, -0.035], [s * 0.115, 0.022, 0.15], 0.036, 0.024, 0.02));
  return P;
}
const BODY_PRIMS = bodyPrimitives();
const SDF_CAP = 0.08;
function bodySDF(x, y, z) {
  let d = SDF_CAP;
  for (const P of BODY_PRIMS) d = smin(d, primDist(P, x, y, z), P.k);
  return d;
}

function buildMannequin(h = 0.007) {
  const x0 = -0.37, y0 = -0.012, z0 = -0.145;
  const nx = Math.ceil(0.74 / h) + 2, ny = Math.ceil(1.765 / h) + 2, nz = Math.ceil(0.34 / h) + 2;
  const sxy = nx * ny;
  const field = new Float32Array(nx * ny * nz).fill(SDF_CAP);
  for (const P of BODY_PRIMS) {
    const m = P.k + 2 * h;
    const i0 = Math.max(0, Math.floor((P.min[0] - m - x0) / h)), i1 = Math.min(nx - 1, Math.ceil((P.max[0] + m - x0) / h));
    const j0 = Math.max(0, Math.floor((P.min[1] - m - y0) / h)), j1 = Math.min(ny - 1, Math.ceil((P.max[1] + m - y0) / h));
    const k0 = Math.max(0, Math.floor((P.min[2] - m - z0) / h)), k1 = Math.min(nz - 1, Math.ceil((P.max[2] + m - z0) / h));
    for (let k = k0; k <= k1; k++) {
      const z = z0 + k * h;
      for (let j = j0; j <= j1; j++) {
        const y = y0 + j * h;
        let idx = i0 + j * nx + k * sxy;
        for (let i = i0; i <= i1; i++, idx++) {
          const d = primDist(P, x0 + i * h, y, z);
          const a = field[idx];
          field[idx] = smin(a, d, P.k);
        }
      }
    }
  }
  // ---- surface nets
  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const cellVert = new Int32Array(cx * cy * cz).fill(-1);
  const pos = [];
  const off = [];
  for (let c = 0; c < 8; c++) off.push((c & 1) + ((c >> 1) & 1) * nx + ((c >> 2) & 1) * sxy);
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const val = new Float32Array(8);
  for (let k = 0; k < cz; k++) {
    for (let j = 0; j < cy; j++) {
      for (let i = 0; i < cx; i++) {
        const base = i + j * nx + k * sxy;
        let mask = 0;
        for (let c = 0; c < 8; c++) { const v = field[base + off[c]]; val[c] = v; if (v < 0) mask |= 1 << c; }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, cnt = 0;
        for (let e = 0; e < 12; e++) {
          const a = E[e][0], b = E[e][1];
          if ((val[a] < 0) === (val[b] < 0)) continue;
          const t = val[a] / (val[a] - val[b]);
          sx += (a & 1) + ((b & 1) - (a & 1)) * t;
          sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
          sz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t;
          cnt++;
        }
        cellVert[i + j * cx + k * cx * cy] = pos.length / 3;
        pos.push(x0 + (i + sx / cnt) * h, y0 + (j + sy / cnt) * h, z0 + (k + sz / cnt) * h);
      }
    }
  }
  const cell = (i, j, k) => cellVert[i + j * cx + k * cx * cy];
  const tris = [];
  const quad = (a, b, c, d, flip) => { if (flip) tris.push(a, d, c, a, c, b); else tris.push(a, b, c, a, c, d); };
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const p = i + j * nx + k * sxy;
        const v0 = field[p];
        const in0 = v0 < 0;
        if (i < cx && j >= 1 && k >= 1 && j < cy && k < cz && in0 !== (field[p + 1] < 0)) {
          quad(cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k), !in0);
        }
        if (j < cy && i >= 1 && k >= 1 && i < cx && k < cz && in0 !== (field[p + nx] < 0)) {
          quad(cell(i - 1, j, k - 1), cell(i - 1, j, k), cell(i, j, k), cell(i, j, k - 1), !in0);
        }
        if (k < cz && i >= 1 && j >= 1 && i < cx && j < cy && in0 !== (field[p + sxy] < 0)) {
          quad(cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k), !in0);
        }
      }
    }
  }
  const P = new Float32Array(pos);
  const I = new Uint32Array(tris);
  taubinSmooth(P, I, 4);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setIndex(new THREE.BufferAttribute(I, 1));
  g.computeVertexNormals();
  return g;
}
function taubinSmooth(P, I, iters) {
  const n = P.length / 3;
  const sum = new Float32Array(n * 3), cnt = new Float32Array(n);
  const pass = (f) => {
    sum.fill(0); cnt.fill(0);
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], b = I[t + 1], c = I[t + 2];
      for (const [u, v] of [[a, b], [b, c], [c, a]]) {
        sum[u * 3] += P[v * 3]; sum[u * 3 + 1] += P[v * 3 + 1]; sum[u * 3 + 2] += P[v * 3 + 2]; cnt[u]++;
        sum[v * 3] += P[u * 3]; sum[v * 3 + 1] += P[u * 3 + 1]; sum[v * 3 + 2] += P[u * 3 + 2]; cnt[v]++;
      }
    }
    for (let i = 0; i < n; i++) {
      if (!cnt[i]) continue;
      for (let c = 0; c < 3; c++) P[i * 3 + c] += f * (sum[i * 3 + c] / cnt[i] - P[i * 3 + c]);
    }
  };
  for (let k = 0; k < iters; k++) { pass(0.5); pass(-0.53); }
}

// Surface point + outward normal by marching the SDF from inside the body.
function surfacePoint(inside, dir) {
  const d = V(dir).normalize();
  const p = V(inside);
  let t = 0, lo = 0, hi = 0;
  for (let i = 0; i < 200; i++) { t += 0.002; if (bodySDF(p.x + d.x * t, p.y + d.y * t, p.z + d.z * t) > 0) { hi = t; lo = t - 0.002; break; } }
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (bodySDF(p.x + d.x * m, p.y + d.y * m, p.z + d.z * m) > 0) hi = m; else lo = m; }
  const s = p.addScaledVector(d, (lo + hi) / 2);
  const e = 0.002;
  const n = new THREE.Vector3(
    bodySDF(s.x + e, s.y, s.z) - bodySDF(s.x - e, s.y, s.z),
    bodySDF(s.x, s.y + e, s.z) - bodySDF(s.x, s.y - e, s.z),
    bodySDF(s.x, s.y, s.z + e) - bodySDF(s.x, s.y, s.z - e),
  ).normalize();
  return { point: s, normal: n };
}

// =====================================================================================
// Procedural placeholder: organs, vessels, skeleton, landmarks
// =====================================================================================
function buildOrgans() {
  const G = {};
  // Brain: cerebrum with gyri, a midline fissure, cerebellum and brainstem.
  G.brain = merge([
    deformedSphere({
      center: [0, 1.657, -0.008], radii: [0.066, 0.056, 0.083], seg: [96, 64],
      deform: (u, v) => {
        const gy = Math.sin(u.x * 31 + u.z * 7) * Math.sin(u.y * 27 + u.x * 5) * Math.sin(u.z * 29 + u.y * 9);
        let s = 1 + 0.035 * gy;
        if (u.y > -0.2) s *= 1 - 0.16 * Math.exp(-((u.x / 0.07) ** 2)) * smoothstep(-0.2, 0.6, u.y);
        if (u.y < -0.35) v.y *= 0.9;
        v.multiplyScalar(s);
      },
    }),
    deformedSphere({
      center: [0, 1.598, -0.058], radii: [0.05, 0.027, 0.033], seg: [64, 40],
      deform: (u, v) => { v.multiplyScalar(1 + 0.03 * Math.sin(u.y * 42)); },
    }),
    tubeGeometry([[0, 1.612, -0.03], [0, 1.585, -0.034], [0, 1.545, -0.036]], 0.011, { radial: 14 }),
  ]);
  // Thyroid: two lobes and an isthmus.
  G.thyroid = merge([
    deformedSphere({ center: [0.0175, 1.468, 0.04], radii: [0.0085, 0.019, 0.0075], rotation: [0, 0, -12], seg: [32, 24] }),
    deformedSphere({ center: [-0.0175, 1.468, 0.04], radii: [0.0085, 0.019, 0.0075], rotation: [0, 0, 12], seg: [32, 24] }),
    deformedSphere({ center: [0, 1.461, 0.0455], radii: [0.012, 0.005, 0.0045], seg: [24, 16] }),
  ]);
  // Lungs: tapered apex, concave base, flattened medial side; cardiac notch on the left lung.
  const lung = (side) => deformedSphere({
    center: [side * 0.08, 1.292, -0.01], radii: [side > 0 ? 0.06 : 0.064, 0.132, 0.084], seg: [72, 48],
    deform: (u, v, r) => {
      const t = (u.y + 1) / 2;
      const s = t < 0.35 ? 1 : 1 - 0.55 * Math.pow((t - 0.35) / 0.65, 1.6);
      v.x *= s; v.z *= s;
      if (u.y < -0.35) v.y += r[1] * 0.35 * (1 - (u.x * u.x + u.z * u.z)) * smoothstep(-0.35, -1, u.y);
      const med = Math.max(0, -u.x * side);
      v.x += side * med * med * r[0] * 0.38;
      if (side > 0 && u.x < 0.1 && u.z > 0 && u.y < 0.25) {
        v.x += 0.022 * smoothstep(0.1, -0.6, u.x) * smoothstep(0, 0.6, u.z) * smoothstep(0.25, -0.3, u.y);
      }
    },
  });
  G.lungs = merge([lung(1), lung(-1)]);
  // Heart: blunt cone, apex down, forward and to the person's left, with atria on top.
  {
    const axis = new THREE.Vector3(0.45, -0.62, 0.55).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    const e = new THREE.Euler().setFromQuaternion(q);
    G.heart = merge([
      deformedSphere({
        center: [0.02, 1.232, 0.042], radii: [0.046, 0.064, 0.042], rotation: [e.x / DEG, e.y / DEG, e.z / DEG], seg: [72, 48],
        deform: (u, v) => {
          if (u.y > 0) { const k = 1 - 0.5 * Math.pow(u.y, 1.4); v.x *= k; v.z *= k; }
          v.multiplyScalar(1 - 0.05 * Math.exp(-(((u.x - 0.15) / 0.12) ** 2)) * (u.z > 0 ? 1 : 0));
        },
      }),
      deformedSphere({ center: [-0.004, 1.262, 0.028], radii: [0.042, 0.03, 0.034], seg: [48, 32] }),
    ]);
  }
  // Liver: wedge, thick on the right, thin left lobe, flat underside.
  G.liver = deformedSphere({
    center: [-0.035, 1.132, 0.016], radii: [0.098, 0.068, 0.084], seg: [72, 48],
    deform: (u, v) => {
      const s = (-u.x + 1) / 2;
      v.y *= 0.36 + 0.64 * smoothstep(0, 0.75, s);
      v.z *= 0.62 + 0.38 * s;
      if (u.y < 0) v.y *= 0.72;
      v.y += 0.012 * (1 - s);
    },
  });
  G.gallbladder = deformedSphere({
    center: [-0.056, 1.08, 0.066], radii: [0.012, 0.027, 0.012], rotation: [28, 0, 10], seg: [32, 24],
    deform: (u, v) => { const k = 0.65 + 0.35 * (1 - u.y) / 2; v.x *= k; v.z *= k; },
  });
  G.stomach = tubeGeometry(
    [[0.024, 1.176, -0.018], [0.054, 1.172, -0.014], [0.08, 1.156, 0.004], [0.09, 1.122, 0.026], [0.079, 1.088, 0.044],
      [0.05, 1.068, 0.054], [0.016, 1.066, 0.054], [-0.012, 1.078, 0.046]],
    [[0, 0.015], [0.2, 0.038], [0.42, 0.04], [0.72, 0.03], [1, 0.014]], { radial: 28, step: 0.003 },
  );
  G.spleen = deformedSphere({
    center: [0.112, 1.136, -0.05], radii: [0.022, 0.05, 0.032], rotation: [0, -25, -18], seg: [40, 28],
    deform: (u, v) => { v.x += -0.008 * (1 - u.y * u.y); },
  });
  G.pancreas = tubeGeometry(
    [[-0.024, 1.058, 0.012], [0.0, 1.07, 0.004], [0.03, 1.078, -0.008], [0.06, 1.09, -0.022], [0.092, 1.104, -0.036]],
    [[0, 0.016], [0.3, 0.011], [0.75, 0.0095], [1, 0.007]], { radial: 20, step: 0.003 },
  );
  const kidney = (side) => deformedSphere({
    center: [side * 0.068, side > 0 ? 1.046 : 1.03, -0.064], radii: [0.026, 0.052, 0.02], rotation: [0, side * 25, side * 12], seg: [48, 32],
    deform: (u, v, r) => { if (u.x * side < 0) v.x += side * r[0] * 0.55 * Math.exp(-((u.y / 0.35) ** 2)) * (-u.x * side); },
  });
  G.kidneys = merge([kidney(1), kidney(-1)]);
  // Small intestine: a coiled tube packed inside the frame of the large intestine.
  {
    const pts = [];
    const rows = 7;
    for (let r = 0; r < rows; r++) {
      const y = 1.012 - r * 0.0175;
      const dir = r % 2 === 0 ? 1 : -1;
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const x = dir * (-0.068 + 0.136 * t);
        pts.push([x, y + 0.006 * Math.sin(x * 60 + r), 0.03 + 0.02 * Math.sin(x * 45 + r * 1.3)]);
      }
    }
    G.small_intestine = tubeGeometry(pts, (u, s) => 0.0105 * (1 + 0.06 * Math.sin(s * 140)), { radial: 12, step: 0.004 });
  }
  G.large_intestine = tubeGeometry(
    [[-0.082, 0.912, 0.028], [-0.097, 0.95, 0.028], [-0.102, 1.0, 0.026], [-0.098, 1.044, 0.028], [-0.06, 1.05, 0.048],
      [-0.02, 1.042, 0.058], [0.02, 1.042, 0.058], [0.06, 1.052, 0.05], [0.094, 1.074, 0.026], [0.107, 1.04, 0.014],
      [0.107, 0.99, 0.014], [0.102, 0.942, 0.02], [0.085, 0.902, 0.032], [0.05, 0.886, 0.036], [0.02, 0.884, 0.018],
      [0.005, 0.87, -0.02], [0.0, 0.842, -0.045]],
    (u, s) => (u > 0.88 ? 0.014 : 0.018) * (1 + 0.13 * Math.max(0, Math.cos((s / 0.022) * Math.PI * 2))), { radial: 18, step: 0.003 },
  );
  G.bladder = deformedSphere({
    center: [0, 0.848, 0.038], radii: [0.04, 0.032, 0.034], seg: [40, 28],
    deform: (u, v) => { if (u.y > 0.4) v.y -= 0.006 * (1 - u.x * u.x); },
  });
  return G;
}

// Vessel tree (placeholder). Person's left = +X. Radii in meters (slightly exaggerated for legibility).
const AORTA = [[0.015, 1.255, 0.045], [0.008, 1.31, 0.045], [0.012, 1.36, 0.015], [0.03, 1.345, -0.03], [0.03, 1.28, -0.055],
  [0.025, 1.18, -0.06], [0.015, 1.12, -0.055], [0.012, 1.05, -0.055], [0.01, 0.99, -0.05], [0.005, 0.965, -0.045]];
const A_PREFIX = AORTA.slice(0, 3);
const D_PREFIX = AORTA.slice(0, 7);
const L_LEG_ART = [[0.005, 0.965, -0.045], [0.05, 0.92, -0.03], [0.075, 0.885, 0.0], [0.085, 0.86, 0.035], [0.09, 0.75, 0.03],
  [0.09, 0.66, 0.015], [0.085, 0.58, -0.01], [0.1, 0.5, -0.03], [0.103, 0.4, -0.02], [0.105, 0.25, -0.01], [0.108, 0.1, 0.0]];
const L_ARM_ART = [[0.025, 1.36, 0.005], [0.07, 1.4, 0.01], [0.15, 1.4, 0.0], [0.205, 1.3, -0.01], [0.248, 1.12, -0.022],
  [0.276, 1.0, -0.008], [0.294, 0.87, 0.005]];
const L_CAROTID = [[0.018, 1.365, 0.012], [0.028, 1.44, 0.025], [0.032, 1.52, 0.02], [0.03, 1.575, 0.0], [0.02, 1.625, -0.005]];
const IVC = [[-0.015, 1.235, 0.03], [-0.022, 1.2, 0.0], [-0.025, 1.15, -0.035], [-0.022, 1.08, -0.05], [-0.02, 1.0, -0.048], [-0.008, 0.955, -0.04]];
const L_LEG_VEIN = [[-0.008, 0.955, -0.04], [0.04, 0.915, -0.025], [0.068, 0.88, 0.005], [0.076, 0.855, 0.04], [0.082, 0.75, 0.035],
  [0.078, 0.66, 0.012], [0.075, 0.58, -0.012], [0.092, 0.5, -0.04], [0.095, 0.4, -0.03], [0.098, 0.25, -0.02], [0.1, 0.1, -0.008]];
const L_SAPHENOUS = [[0.076, 0.855, 0.04], [0.07, 0.8, 0.06], [0.064, 0.7, 0.062], [0.07, 0.58, 0.04], [0.085, 0.5, 0.004], [0.09, 0.3, 0.0]];
const SVC = [[-0.015, 1.262, 0.035], [-0.022, 1.32, 0.035], [-0.02, 1.365, 0.03]];
const L_ARM_VEIN = [[-0.02, 1.365, 0.03], [0.03, 1.385, 0.04], [0.075, 1.405, 0.025], [0.15, 1.39, 0.012], [0.2, 1.3, 0.002],
  [0.242, 1.12, -0.01], [0.27, 1.0, 0.002], [0.288, 0.87, 0.014]];
const PULM_ART = [[0.012, 1.272, 0.058], [0.014, 1.29, 0.05], [0.02, 1.305, 0.025], [0.06, 1.3, 0.01], [0.095, 1.28, -0.01]];
const PULM_ART_R = [[0.02, 1.305, 0.025], [-0.02, 1.305, 0.02], [-0.06, 1.3, 0.015], [-0.09, 1.28, -0.01]];
const PULM_VEIN = [[0.095, 1.25, -0.015], [0.06, 1.255, -0.01], [0.03, 1.255, 0.0]];
const PULM_VEIN_R = [[-0.09, 1.25, -0.015], [-0.05, 1.255, -0.01], [0.0, 1.255, -0.005]];
const CELIAC = [[0.015, 1.12, -0.055], [0.0, 1.11, -0.03]];
const HEPATIC = [[0.0, 1.11, -0.03], [-0.03, 1.105, -0.01], [-0.06, 1.12, 0.02]];
const SPLENIC = [[0.0, 1.11, -0.03], [0.04, 1.11, -0.03], [0.08, 1.115, -0.04], [0.11, 1.125, -0.045]];
const GASTRIC = [[0.0, 1.11, -0.03], [0.03, 1.12, -0.005], [0.06, 1.11, 0.02]];
const SMA = [[0.012, 1.09, -0.052], [0.01, 1.06, -0.02], [0.0, 1.0, 0.012], [0.0, 0.965, 0.03]];
const RENAL_L = [[0.01, 1.045, -0.057], [0.04, 1.045, -0.06], [0.064, 1.042, -0.063]];
const RENAL_R = [[0.01, 1.04, -0.057], [-0.03, 1.035, -0.06], [-0.064, 1.03, -0.063]];
const IMA = [[0.01, 0.99, -0.05], [0.04, 0.97, -0.02], [0.08, 0.96, 0.008], [0.1, 0.95, 0.016]];
const CORONARY = [[0.015, 1.255, 0.045], [0.03, 1.255, 0.07], [0.05, 1.235, 0.075], [0.06, 1.205, 0.06]];
const EPIGASTRIC = [[0.075, 0.885, 0.0], [0.07, 0.92, 0.06], [0.062, 0.97, 0.08], [0.055, 1.02, 0.085]];
const SUP_EPIGASTRIC_V = [[0.076, 0.855, 0.04], [0.068, 0.9, 0.078], [0.06, 0.95, 0.09], [0.055, 1.0, 0.094]];
const JUG_L = [[0.03, 1.385, 0.04], [0.042, 1.45, 0.025], [0.045, 1.53, 0.01], [0.04, 1.58, -0.01]];
const JUG_R = [[-0.02, 1.365, 0.03], [-0.04, 1.45, 0.025], [-0.045, 1.53, 0.01], [-0.04, 1.58, -0.01]];
const R_ARM_ART_HEAD = [[0.004, 1.362, 0.025], [-0.03, 1.39, 0.03], [-0.07, 1.4, 0.012]];
const R_CAROTID = [[-0.03, 1.39, 0.03], [-0.032, 1.45, 0.025], [-0.034, 1.52, 0.02], [-0.03, 1.575, 0.0], [-0.02, 1.625, -0.005]];

function buildVesselTree() {
  const tap = (a, b) => [[0, a], [1, b]];
  const art = [
    tubeGeometry(AORTA, [[0, 0.012], [0.25, 0.012], [0.5, 0.0105], [1, 0.0085]], { radial: 18 }),
    tubeGeometry(L_LEG_ART, tap(0.0062, 0.0028)), tubeGeometry(mirror(L_LEG_ART), tap(0.0062, 0.0028)),
    tubeGeometry(L_ARM_ART, tap(0.0052, 0.0026)),
    tubeGeometry([...R_ARM_ART_HEAD, ...mirror(L_ARM_ART.slice(2))], tap(0.0058, 0.0026)),
    tubeGeometry(L_CAROTID, tap(0.0044, 0.003)), tubeGeometry(R_CAROTID, tap(0.0044, 0.003)),
    tubeGeometry(CELIAC, 0.0042), tubeGeometry(HEPATIC, tap(0.0036, 0.0026)), tubeGeometry(SPLENIC, tap(0.0036, 0.0026)),
    tubeGeometry(GASTRIC, tap(0.0028, 0.002)), tubeGeometry(SMA, tap(0.004, 0.0024)),
    tubeGeometry(RENAL_L, 0.0034), tubeGeometry(RENAL_R, 0.0034), tubeGeometry(IMA, tap(0.0028, 0.002)),
    tubeGeometry(CORONARY, tap(0.0024, 0.0016)), tubeGeometry(EPIGASTRIC, tap(0.0024, 0.0016)),
    tubeGeometry(mirror(EPIGASTRIC), tap(0.0024, 0.0016)),
    tubeGeometry(PULM_VEIN, 0.0045), tubeGeometry(PULM_VEIN_R, 0.0045),
  ];
  const ven = [
    tubeGeometry(IVC, [[0, 0.0125], [1, 0.0105]], { radial: 18 }),
    tubeGeometry(L_LEG_VEIN, tap(0.0072, 0.0034)),
    tubeGeometry([[-0.008, 0.955, -0.04], ...mirror(L_LEG_VEIN.slice(1))], tap(0.0072, 0.0034)),
    tubeGeometry(L_SAPHENOUS, tap(0.0032, 0.0022)), tubeGeometry(mirror(L_SAPHENOUS), tap(0.0032, 0.0022)),
    tubeGeometry(SVC, 0.0095),
    tubeGeometry(L_ARM_VEIN, tap(0.0068, 0.0028)),
    tubeGeometry([[-0.02, 1.365, 0.03], [-0.055, 1.4, 0.03], ...mirror(L_ARM_VEIN.slice(2))], tap(0.0068, 0.0028)),
    tubeGeometry(JUG_L, tap(0.0055, 0.004)), tubeGeometry(JUG_R, tap(0.0055, 0.004)),
    tubeGeometry(SUP_EPIGASTRIC_V, tap(0.0026, 0.0018)), tubeGeometry(mirror(SUP_EPIGASTRIC_V), tap(0.0026, 0.0018)),
    tubeGeometry(PULM_ART, tap(0.0075, 0.0048)), tubeGeometry(PULM_ART_R, tap(0.0062, 0.0046)),
    tubeGeometry([[-0.022, 1.12, -0.04], [-0.05, 1.13, 0.0]], 0.004),
  ];
  return { arteries: merge(art), veins: merge(ven) };
}

function buildSkeleton() {
  const parts = [];
  parts.push(tubeGeometry([[0, 0.88, -0.07], [0, 0.95, -0.062], [0, 1.05, -0.058], [0, 1.15, -0.072], [0, 1.28, -0.086],
    [0, 1.4, -0.072], [0, 1.47, -0.048], [0, 1.555, -0.04]],
  (u, s) => (0.011 + 0.004 * (1 - u)) * (1 + 0.22 * Math.max(0, Math.cos((s / 0.026) * Math.PI * 2))), { radial: 12 }));
  for (let i = 0; i < 10; i++) {
    const y = 1.425 - i * 0.022;
    const w = 0.088 + 0.05 * Math.sin(Math.PI * Math.min(1, (i + 2.5) / 11));
    const front = i < 7;
    for (const s of [1, -1]) {
      const pts = [[s * 0.012, y, -0.084], [s * w * 0.55, y - 0.004, -0.1], [s * w * 0.95, y - 0.026, -0.05], [s * w, y - 0.055, 0.02],
        [s * w * 0.7, y - 0.082 - i * 0.003, 0.072]];
      if (front) pts.push([s * 0.022, 1.405 - i * 0.022 - 0.06, 0.092]);
      parts.push(tubeGeometry(pts, 0.0034, { radial: 8, step: 0.006 }));
    }
  }
  parts.push(tubeGeometry([[0, 1.418, 0.09], [0, 1.33, 0.098], [0, 1.24, 0.098]], [[0, 0.011], [1, 0.007]], { radial: 10 }));
  for (const s of [1, -1]) {
    parts.push(tubeGeometry([[s * 0.02, 1.436, 0.062], [s * 0.09, 1.446, 0.052], [s * 0.16, 1.452, 0.0]], 0.0055, { radial: 8 }));
    parts.push(tubeGeometry([[s * 0.025, 0.985, -0.07], [s * 0.1, 1.0, -0.045], [s * 0.138, 0.972, 0.018], [s * 0.1, 0.92, 0.042],
      [s * 0.045, 0.866, 0.058], [s * 0.008, 0.858, 0.064]], 0.0075, { radial: 10 }));
    parts.push(tubeGeometry([[s * 0.088, 0.9, 0.0], [s * 0.095, 0.7, 0.012], [s * 0.1, 0.51, 0.012]], [[0, 0.013], [0.5, 0.0105], [1, 0.014]], { radial: 10 }));
    parts.push(tubeGeometry([[s * 0.1, 0.48, 0.014], [s * 0.103, 0.28, 0.004], [s * 0.106, 0.085, -0.006]], [[0, 0.012], [0.5, 0.008], [1, 0.01]], { radial: 10 }));
    parts.push(tubeGeometry([[s * 0.193, 1.39, -0.016], [s * 0.225, 1.25, -0.022], [s * 0.252, 1.12, -0.03]], [[0, 0.011], [0.5, 0.008], [1, 0.011]], { radial: 10 }));
    parts.push(tubeGeometry([[s * 0.252, 1.11, -0.034], [s * 0.296, 0.87, -0.008]], 0.0055, { radial: 8 }));
    parts.push(tubeGeometry([[s * 0.256, 1.11, -0.022], [s * 0.3, 0.87, 0.01]], 0.005, { radial: 8 }));
  }
  return merge(parts);
}

function placeholderLandmarks() {
  const ab = surfacePoint([0.056, 1.0, 0.0], [0, 0, 1]);
  const th = surfacePoint([0.098, 0.68, 0.02], [0.35, 0, 0.94]);
  const ar = surfacePoint([0.221, 1.27, -0.022], [0.97, 0, -0.24]);
  const arr = (v) => [+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)];
  const inward = (s, d) => arr(s.point.clone().addScaledVector(s.normal, -d));
  const veinTail = [[0.068, 0.88, 0.005], [0.04, 0.915, -0.025], [-0.008, 0.955, -0.04], [-0.02, 1.0, -0.048], [-0.022, 1.08, -0.05],
    [-0.025, 1.15, -0.035], [-0.022, 1.2, 0.0], [-0.015, 1.235, 0.03]];
  const paths = {
    abdomen_to_heart: [arr(ab.point), inward(ab, 0.008), [0.06, 0.95, 0.088], [0.068, 0.9, 0.078], [0.076, 0.855, 0.04], ...veinTail],
    thigh_to_heart: [arr(th.point), inward(th, 0.008), [0.1, 0.74, 0.062], [0.07, 0.8, 0.06], [0.076, 0.855, 0.04], ...veinTail],
    arm_to_heart: [arr(ar.point), inward(ar, 0.008), [0.226, 1.28, -0.004], [0.2, 1.3, 0.002], [0.15, 1.39, 0.012], [0.075, 1.405, 0.025],
      [0.03, 1.385, 0.04], [-0.02, 1.365, 0.03], [-0.022, 1.32, 0.035], [-0.015, 1.262, 0.035]],
    heart_to_lungs: [[-0.015, 1.245, 0.035], [0.004, 1.218, 0.064], [0.012, 1.272, 0.058], [0.014, 1.29, 0.05], [0.02, 1.305, 0.025],
      [0.06, 1.3, 0.01], [0.095, 1.28, -0.01]],
    lungs_to_heart: [[0.095, 1.25, -0.015], [0.06, 1.255, -0.01], [0.03, 1.255, 0.0], [0.045, 1.215, 0.045], [0.015, 1.255, 0.045]],
    to_brain: [...A_PREFIX, ...L_CAROTID],
    to_thyroid: [...A_PREFIX, [0.018, 1.365, 0.012], [0.028, 1.44, 0.025], [0.024, 1.462, 0.035], [0.017, 1.469, 0.039]],
    to_heart_muscle: CORONARY,
    to_liver: [...D_PREFIX, ...HEPATIC],
    to_gallbladder: [...D_PREFIX, [0.0, 1.11, -0.03], [-0.03, 1.105, -0.01], [-0.048, 1.09, 0.04], [-0.056, 1.078, 0.064]],
    to_stomach: [...D_PREFIX, ...GASTRIC],
    to_spleen: [...D_PREFIX, ...SPLENIC],
    to_pancreas: [...D_PREFIX, [0.0, 1.11, -0.03], [0.02, 1.085, -0.015], [0.03, 1.077, -0.008]],
    to_kidneys: [...AORTA.slice(0, 8), [0.01, 1.045, -0.057], ...RENAL_L.slice(1)],
    to_small_intestine: [...AORTA.slice(0, 7), ...SMA],
    to_large_intestine: [...AORTA.slice(0, 9), ...IMA.slice(1)],
    to_fat: [...AORTA, [0.05, 0.92, -0.03], [0.075, 0.885, 0.0], ...EPIGASTRIC.slice(1)],
    to_skin: [...A_PREFIX, [0.025, 1.36, 0.005], [0.07, 1.395, 0.012], [0.085, 1.375, 0.05], [0.09, 1.33, 0.078]],
    to_muscle: [...AORTA, [0.05, 0.92, -0.03], [0.075, 0.885, 0.0], [0.085, 0.86, 0.035], [0.09, 0.75, 0.03], [0.098, 0.68, 0.025]],
  };
  const org = (c, r) => ({ center: c, radius: r });
  return {
    units: 'm', height: 1.75, source: 'placeholder',
    organs: {
      brain: org([0, 1.655, -0.01], 0.08), thyroid: org([0, 1.467, 0.04], 0.025), heart: org([0.018, 1.235, 0.042], 0.06),
      lungs: org([0, 1.29, -0.01], 0.15), liver: org([-0.035, 1.13, 0.018], 0.1), gallbladder: org([-0.056, 1.08, 0.066], 0.03),
      stomach: org([0.055, 1.112, 0.022], 0.06), pancreas: org([0.032, 1.08, -0.008], 0.065), spleen: org([0.112, 1.136, -0.05], 0.05),
      small_intestine: org([0, 0.962, 0.03], 0.09), large_intestine: org([0, 0.97, 0.025], 0.12), kidneys: org([0, 1.04, -0.063], 0.1),
      bladder: org([0, 0.848, 0.038], 0.045), skin: org([0.09, 1.335, 0.088], 0.05), fat: org(inward(ab, 0.011), 0.03),
      injection_site: org(arr(ab.point), 0.03), muscle: org([0.098, 0.68, 0.025], 0.07), eyes: org([0, 1.625, 0.078], 0.04),
      blood: org([0.025, 1.18, -0.06], 0.05),
    },
    anchors: {
      lungs: [0.082, 1.318, -0.006], kidneys: [0.068, 1.046, -0.064], large_intestine: [0.106, 0.99, 0.014],
      small_intestine: [0.0, 0.975, 0.045],
    },
    sites: {
      abdomen: { point: arr(ab.point), normal: arr(ab.normal), label: SITE_LABELS.abdomen },
      thigh: { point: arr(th.point), normal: arr(th.normal), label: SITE_LABELS.thigh },
      arm: { point: arr(ar.point), normal: arr(ar.normal), label: SITE_LABELS.arm },
    },
    paths,
  };
}

// =====================================================================================
// Editable body: per-vertex regional weights for the skin offset (computed once per skin mesh)
// =====================================================================================
// Region axes for a 1.75 m reference body in the HRA Visible Human frame (arms abducted, hands at about
// x = ±0.44, y = 0.85). Positions are normalised to that height first, so other heights and the female
// model map onto the same proportions. Limb axes are for the person's left (+X); |x| mirrors them.
// Weights follow where subcutaneous fat actually collects: most on the abdomen, flanks, hips, buttocks,
// thighs, upper arms and back; little on the face, forearms and shins; almost none on hands and feet.
const MORPH_REF_H = 1.75;
const MORPH_BLEND = 0.016; // m: regions blend over a few centimetres, so the offset has no seams
const MORPH_LIMBS = [
  // [id, a, b, radius]
  ['neck', [0, 1.44, -0.01], [0, 1.55, 0.015], 0.055],
  ['head', [0, 1.585, 0.02], [0, 1.68, 0.0], 0.085],
  ['upperArm', [0.19, 1.4, -0.015], [0.285, 1.12, -0.015], 0.045],
  ['forearm', [0.285, 1.12, -0.015], [0.39, 0.99, 0.0], 0.036],
  ['hand', [0.4, 0.98, 0.01], [0.445, 0.82, 0.035], 0.03],
  ['thigh', [0.1, 0.86, 0.0], [0.135, 0.5, 0.0], 0.085],
  ['shin', [0.135, 0.5, 0.0], [0.185, 0.1, -0.085], 0.05],
  ['foot', [0.19, 0.05, -0.11], [0.21, 0.025, 0.06], 0.035],
].map(([id, a, b, r]) => {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  return { id, a, d, l2, r };
});
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// → Float32Array(n * 3): x = fat share, y = central (abdominal) share, z = limb share.
function morphWeights(pos, { height = MORPH_REF_H, female = false } = {}) {
  const n = pos.count;
  const out = new Float32Array(n * 3);
  const k = MORPH_REF_H / (height || MORPH_REF_H);
  const nR = MORPH_LIMBS.length + 1;
  const dist = new Float64Array(nR), fat = new Float64Array(nR), cen = new Float64Array(nR), limb = new Float64Array(nR);
  for (let i = 0; i < n; i++) {
    const x = Math.abs(pos.getX(i)) * k, y = pos.getY(i) * k, z = pos.getZ(i) * k;
    // trunk: an elliptic capsule along the body axis (wider than deep)
    const ty = Math.min(1.44, Math.max(0.84, y));
    const zc = 0.01 - 0.02 * (ty - 0.84) / 0.6;
    const ex = x / 1.18, ez = z - zc, ey = y - ty;
    const rho = Math.hypot(ex, ez);
    dist[0] = Math.hypot(rho, ey) - 0.13;
    const front = 0.5 + 0.5 * (rho > 1e-6 ? ez / rho : 0); // 1 at the front, 0 at the back
    const abd = sstep(0.84, 0.97, y) * (1 - sstep(1.08, 1.26, y));
    const chest = sstep(1.12, 1.24, y) * (1 - sstep(1.36, 1.46, y));
    const hip = sstep(0.78, 0.86, y) * (1 - sstep(0.95, 1.04, y));
    const top = 0.38 - 0.08 * sstep(1.4, 1.46, y);
    fat[0] = Math.max(top,
      abd * (0.6 + 0.4 * front) * (female ? 0.88 : 1),
      chest * (female ? 0.42 + 0.3 * front : 0.4 + 0.12 * front),
      hip * ((female ? 1.02 : 0.92) - 0.3 * front));
    cen[0] = abd * (0.55 + 0.45 * front);
    limb[0] = 0;
    for (let j = 0; j < MORPH_LIMBS.length; j++) {
      const L = MORPH_LIMBS[j];
      const px = x - L.a[0], py = y - L.a[1], pz = z - L.a[2];
      const t = Math.min(1, Math.max(0, (px * L.d[0] + py * L.d[1] + pz * L.d[2]) / L.l2));
      const qx = px - L.d[0] * t, qy = py - L.d[1] * t, qz = pz - L.d[2] * t;
      const r = j + 1;
      dist[r] = Math.hypot(qx, qy, qz) - L.r;
      const fz = Math.min(1, Math.max(-1, qz / L.r)); // +1 = front of this limb
      let f = 0, c = 0, l = 0;
      switch (L.id) {
        case 'neck': f = 0.3 + 0.1 * Math.max(0, fz); break;
        case 'head': f = 0.04 + 0.13 * Math.max(0, fz) * (1 - sstep(1.6, 1.66, y)); break;
        case 'upperArm': f = 0.52 - 0.1 * t + 0.06 * Math.max(0, -fz); l = 1; break;
        case 'forearm': f = 0.22 - 0.1 * t; l = 0.6; break;
        case 'hand': f = 0.05; break;
        case 'thigh': f = (female ? 0.9 : 0.8) - 0.38 * t; l = 1; break;
        case 'shin': f = 0.18 - 0.06 * t + 0.06 * Math.max(0, -fz); l = 0.5; break;
        case 'foot': f = 0.04; break;
        default: break;
      }
      fat[r] = f; cen[r] = c; limb[r] = l;
    }
    let dmin = Infinity;
    for (let r = 0; r < nR; r++) if (dist[r] < dmin) dmin = dist[r];
    let sw = 0, sf = 0, sc = 0, sl = 0;
    for (let r = 0; r < nR; r++) {
      const w = Math.exp(-(dist[r] - dmin) / MORPH_BLEND);
      sw += w; sf += fat[r] * w; sc += cen[r] * w; sl += limb[r] * w;
    }
    out[i * 3] = sf / sw; out[i * 3 + 1] = sc / sw; out[i * 3 + 2] = sl / sw;
  }
  return out;
}

// The weights at a surface point: a distance-weighted mean over skin vertices within 2.5 cm.
function morphAt(pos, w, p, out) {
  let sx = 0, sy = 0, sz = 0, sw = 0, best = -1, bd = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const d = Math.hypot(pos.getX(i) - p.x, pos.getY(i) - p.y, pos.getZ(i) - p.z);
    if (d < bd) { bd = d; best = i; }
    if (d < 0.025) { const k = 1 - d / 0.025; sx += w[i * 3] * k; sy += w[i * 3 + 1] * k; sz += w[i * 3 + 2] * k; sw += k; }
  }
  if (sw > 0) out.set(sx / sw, sy / sw, sz / sw);
  else if (best >= 0) out.set(w[best * 3], w[best * 3 + 1], w[best * 3 + 2]);
  else out.set(0.5, 0, 0);
  return out;
}

// Body description → scene parameters (appearance only). Used by index.js for body:change.
//   heightCm, weightKg, age, sex → { scale, fat, age, variant }
// Weight is read against a height-based reference so that the default body (male 175 cm / 75 kg,
// female 162 cm / 65 kg, 35 years) shows the model exactly as built. Nothing here is ever displayed.
export const BODY_DEFAULTS = {
  male: { sex: 'male', heightCm: 175, weightKg: 75, age: 35 },
  female: { sex: 'female', heightCm: 162, weightKg: 65, age: 35 },
};
export function bodyParams({ sex = 'male', heightCm, weightKg, age } = {}, modelHeight = 1.75) {
  const D = BODY_DEFAULTS[sex === 'female' ? 'female' : 'male'];
  const h = Math.min(205, Math.max(145, Number(heightCm) || D.heightCm));
  const wt = Math.min(160, Math.max(40, Number(weightKg) || D.weightKg));
  const a = Math.min(90, Math.max(18, Number(age) || D.age));
  const ref = D.weightKg * (h / D.heightCm) ** 2;
  const r = wt / ref;
  // offset at full regional weight (metres): generous above the reference, small below it
  const fat = r >= 1 ? (0.088 * (r - 1)) / (1 + 0.15 * (r - 1)) : Math.max(-0.016, 0.034 * (r - 1));
  // age: a slight stature loss after about 60 and a mild shift of fat toward the abdomen
  const stature = 1 - 0.0007 * Math.max(0, a - 60);
  const ageShift = 0.012 * Math.min(1.2, Math.max(-0.4, (a - 35) / 45));
  return { scale: ((h / 100) / (modelHeight || 1.75)) * stature, fat, age: ageShift, variant: sex === 'female' ? 'female' : 'male' };
}

// =====================================================================================
// Hotspots (injection-site rings)
// =====================================================================================
// Fine champagne rings, like the chapter ring of a watch dial: a hairline ring, a small centre point,
// four index ticks, a slow expanding hairline (off under reduced motion) and, once selected, an outer
// hairline with sixty minute ticks. No filled disc, so nothing blooms over the organs behind it.
const HOTSPOT_FRAG = /* glsl */`
  uniform vec3 uColor; uniform float uTime; uniform float uSel; uniform float uAnim; uniform float uOpacity; uniform float uHover;
  varying vec2 vUv; varying float vFacing;
  float ring(float r, float rad, float w, float px) { return 1.0 - smoothstep(w, w + px * 1.25, abs(r - rad)); }
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float px = max(fwidth(r), 1e-4);
    float breathe = mix(1.0, 0.86 + 0.14 * sin(uTime * 1.6), uAnim);
    float a = ring(r, 0.34, 0.006, px) * (0.82 + 0.18 * uSel) * breathe;
    a += (1.0 - smoothstep(0.045 - px, 0.045 + px, r)) * 0.95;
    float ph = fract(uTime * 0.26);
    a += ring(r, mix(0.36, 0.84, ph), 0.004, px) * (1.0 - ph) * (1.0 - ph) * 0.55 * uAnim;
    a += ring(r, 0.6, 0.004, px) * uSel * 0.8;
    float ang = atan(p.y, p.x);
    float idx = step(0.9975, abs(cos(ang * 2.0))) * step(0.42, r) * (1.0 - step(0.52, r));
    a += idx * (0.55 + 0.4 * uSel);
    float minute = step(0.93, abs(cos(ang * 30.0))) * step(0.64, r) * (1.0 - step(0.685, r));
    a += minute * uSel * 0.5;
    a += exp(-r * r * 10.0) * (0.04 + 0.12 * uHover);
    // seen through the translucent body when it faces away; gone once it is on the far side
    a *= smoothstep(-0.6, 0.1, vFacing) * uOpacity * (1.0 - smoothstep(0.92, 1.0, r));
    gl_FragColor = vec4(uColor * (1.0 + uHover * 0.2), clamp(a, 0.0, 1.0));
  }`;
const HOTSPOT_VERT = /* glsl */`
  varying vec2 vUv; varying float vFacing;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec3 n = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
    vFacing = dot(n, normalize(cameraPosition - wp.xyz));
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

// =====================================================================================
// Anchor glows (organs without meshes: fat, injection site, muscle, eyes, blood, skin)
// =====================================================================================
const ANCHOR_VERT = /* glsl */`
  attribute vec3 aColor; attribute float aAlpha; attribute float aSize;
  uniform float uScale;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    vColor = aColor; vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(aSize * uScale / -mv.z, 2.0, 220.0);
  }`;
const ANCHOR_FRAG = /* glsl */`
  varying vec3 vColor; varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r = length(c);
    if (r > 1.0) discard;
    float glow = exp(-r * r * 4.0);
    float px = fwidth(r);
    float ring = 1.0 - smoothstep(0.02, 0.02 + px * 1.5, abs(r - 0.62));
    float a = (glow * 0.85 + ring * 0.55) * vAlpha;
    gl_FragColor = vec4(vColor, a);
  }`;

// =====================================================================================
// loadAnatomy
// =====================================================================================
function classifyName(raw) {
  if (!raw) return null;
  let n = String(raw).toLowerCase().trim().replace(/[\s.\-]+/g, '_').replace(/_?\d+$/, '').replace(/_(mesh|geo|primitive)$/, '');
  const alias = {
    lung: 'lungs', left_lung: 'lungs', right_lung: 'lungs', kidney: 'kidneys', left_kidney: 'kidneys', right_kidney: 'kidneys',
    smallintestine: 'small_intestine', intestine_small: 'small_intestine', small_bowel: 'small_intestine',
    largeintestine: 'large_intestine', intestine_large: 'large_intestine', colon: 'large_intestine',
    artery: 'arteries', arterial: 'arteries', vein: 'veins', venous: 'veins', bones: 'skeleton', bone: 'skeleton',
    body: 'skin', gall_bladder: 'gallbladder', urinary_bladder: 'bladder',
  };
  n = alias[n] || n;
  if (MESH_ORGANS.includes(n) || n === 'skin' || n === 'arteries' || n === 'veins' || n === 'skeleton') return n;
  return null;
}

// KHR_mesh_quantization stores positions/normals as normalized integers with the scale in the node
// transform. Baking the world matrix into a normalized attribute would clamp it to [-1, 1], so turn
// every attribute into plain Float32 first.
function dequantize(geo) {
  for (const name of Object.keys(geo.attributes)) {
    const a = geo.attributes[name];
    if (!a.isInterleavedBufferAttribute && !a.normalized && a.array instanceof Float32Array) continue;
    const n = a.count, k = a.itemSize, out = new Float32Array(n * k);
    for (let i = 0; i < n; i++) {
      out[i * k] = a.getX(i);
      if (k > 1) out[i * k + 1] = a.getY(i);
      if (k > 2) out[i * k + 2] = a.getZ(i);
      if (k > 3) out[i * k + 3] = a.getW(i);
    }
    geo.setAttribute(name, new THREE.BufferAttribute(out, k));
  }
  return geo;
}

const VARIANT_FILES = {
  male: { glb: 'body.glb', landmarks: 'landmarks.json' },
  female: { glb: 'body-female.glb', landmarks: 'landmarks-female.json' },
};
async function tryLoadGLB(base = ASSET_BASE, files = VARIANT_FILES.male) {
  const lmRes = await fetch(new URL(files.landmarks, base), { cache: 'no-cache' }).catch(() => null);
  if (!lmRes || !lmRes.ok) return null;
  const landmarks = await lmRes.json();
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/libs/meshopt_decoder.module.js'),
  ]);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(new URL(files.glb, base).href);
  return { landmarks, gltf };
}

// Is the female anatomy published? (HEAD requests; both files must exist.)
export async function hasVariant(variant, base) {
  const files = VARIANT_FILES[variant];
  if (!files) return false;
  const b = base ? new URL(base, document.baseURI) : ASSET_BASE;
  try {
    const rs = await Promise.all([files.glb, files.landmarks].map((f) => fetch(new URL(f, b), { method: 'HEAD', cache: 'no-cache' })));
    return rs.every((r) => r.ok);
  } catch { return false; }
}

export async function loadAnatomy(stage, { source = 'auto', base, variant = 'male' } = {}) {
  const { scene } = stage;
  const female = variant === 'female';
  const root = new THREE.Group();
  root.name = 'anatomy';

  let landmarks = null;
  let gltf = null;
  if (source !== 'placeholder') {
    try {
      const r = await tryLoadGLB(base ? new URL(base, document.baseURI) : ASSET_BASE, VARIANT_FILES[female ? 'female' : 'male']);
      if (r) { landmarks = r.landmarks; gltf = r.gltf; }
    } catch (e) {
      if (female) throw e;
      console.warn('[anatomy] body.glb could not be loaded; using the procedural placeholder.', e);
      landmarks = null; gltf = null;
    }
    // the female body is only shown from real anatomy; the caller keeps the current body otherwise
    if (female && !gltf) throw new Error('female anatomy unavailable');
  }
  scene.add(root);
  const placeholderLM = placeholderLandmarks();
  const usingGLB = !!gltf;
  if (landmarks) {
    // Fill anything the real landmarks are missing from the placeholder set.
    landmarks.organs = { ...placeholderLM.organs, ...(landmarks.organs || {}) };
    landmarks.sites = { ...placeholderLM.sites, ...(landmarks.sites || {}) };
    landmarks.paths = { ...placeholderLM.paths, ...(landmarks.paths || {}) };
    landmarks.anchors = { ...(usingGLB ? {} : placeholderLM.anchors), ...(landmarks.anchors || {}) };
  } else {
    landmarks = placeholderLM;
  }

  // ---------------------------------------------------------------- meshes
  const meshes = {};
  const organState = {};
  const organMats = {};
  let skinMesh = null, arteryMesh = null, veinMesh = null, boneMesh = null;
  const skinMat = makeFresnelMaterial();
  skinMat.defines = { MORPH: '' };
  const arteryMat = makeFresnelMaterial();
  const veinMat = makeFresnelMaterial();
  const boneMat = makeFresnelMaterial();

  const addOrganMesh = (id, geo) => {
    const mat = organMats[id] || (organMats[id] = makeOrganMaterial(ORGAN_COLORS[id] ?? 0xcccccc));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = id;
    mesh.userData.organId = id;
    mesh.renderOrder = 0;
    if (!meshes[id]) { meshes[id] = new THREE.Group(); meshes[id].name = `organ:${id}`; root.add(meshes[id]); }
    meshes[id].add(mesh);
    return mesh;
  };

  if (usingGLB) {
    gltf.scene.updateMatrixWorld(true);
    const found = [];
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      let id = null;
      for (let p = o; p && !id; p = p.parent) id = classifyName(p.name);
      found.push([o, id]);
    });
    for (const [o, id] of found) {
      const geo = dequantize(o.geometry.clone());
      geo.applyMatrix4(o.matrixWorld);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      if (id === 'skin') { skinMesh = new THREE.Mesh(geo, skinMat); }
      else if (id === 'arteries') { arteryMesh = new THREE.Mesh(geo, arteryMat); }
      else if (id === 'veins') { veinMesh = new THREE.Mesh(geo, veinMat); }
      else if (id === 'skeleton') { boneMesh = new THREE.Mesh(geo, boneMat); }
      else if (id) addOrganMesh(id, geo);
      else geo.dispose();
    }
    gltf.scene.traverse((o) => { o.geometry?.dispose?.(); });
  }
  // Placeholder for everything the GLB did not provide (or for everything, in placeholder mode).
  const needOrgans = MESH_ORGANS.filter((id) => !meshes[id]);
  if (!usingGLB || needOrgans.length) {
    const G = buildOrgans();
    for (const id of MESH_ORGANS) {
      if (meshes[id]) { G[id]?.dispose(); continue; }
      if (G[id]) addOrganMesh(id, G[id]);
    }
  }
  if (!skinMesh) skinMesh = new THREE.Mesh(buildMannequin(), skinMat);
  if (!arteryMesh || !veinMesh) {
    const VT = buildVesselTree();
    if (!arteryMesh) arteryMesh = new THREE.Mesh(VT.arteries, arteryMat); else VT.arteries.dispose();
    if (!veinMesh) veinMesh = new THREE.Mesh(VT.veins, veinMat); else VT.veins.dispose();
  }
  if (!boneMesh && !usingGLB) boneMesh = new THREE.Mesh(buildSkeleton(), boneMat);

  skinMesh.name = 'skin'; skinMesh.renderOrder = 10;
  // the skin is displaced in the vertex shader, so its stored bounds no longer hold
  skinMesh.frustumCulled = false;
  arteryMesh.name = 'arteries'; arteryMesh.renderOrder = 2;
  veinMesh.name = 'veins'; veinMesh.renderOrder = 2;
  root.add(skinMesh, arteryMesh, veinMesh);
  if (boneMesh) { boneMesh.name = 'skeleton'; boneMesh.renderOrder = 1; root.add(boneMesh); }

  // model height (before the body scale): the landmarks say it; else the skin's bounds
  let modelHeight = Number(landmarks.height);
  if (!(modelHeight > 0.5)) { skinMesh.geometry.computeBoundingBox(); modelHeight = skinMesh.geometry.boundingBox.max.y || 1.75; }
  const skinPos = skinMesh.geometry.attributes.position;
  const skinMorph = morphWeights(skinPos, { height: modelHeight, female });
  skinMesh.geometry.setAttribute('aMorph', new THREE.BufferAttribute(skinMorph, 3));

  // ---------------------------------------------------------------- organ state + anchors
  const tmpC = new THREE.Color();
  const mkSlot = () => ({ on: false, color: new THREE.Color(), intensity: 1, pulse: 0, phase: 0 });
  const mkState = (id) => {
    const s = { id, slots: {}, drug: mkSlot(), dim: 1, dimTarget: 1, out: new THREE.Color() };
    for (const c of CHANNELS) s.slots[c] = mkSlot();
    return s;
  };
  for (const id of ORGAN_IDS) organState[id] = mkState(id);

  const anchorIds = ['fat', 'injection_site', 'muscle', 'eyes', 'eyes', 'blood', 'skin'];
  const anchorSizes = [0.065, 0.05, 0.08, 0.045, 0.045, 0.09, 0.07];
  const anchorGeo = new THREE.BufferGeometry();
  const aPos = new Float32Array(anchorIds.length * 3);
  const aCol = new Float32Array(anchorIds.length * 3);
  const aAlpha = new Float32Array(anchorIds.length);
  anchorGeo.setAttribute('position', new THREE.BufferAttribute(aPos, 3));
  anchorGeo.setAttribute('aColor', new THREE.BufferAttribute(aCol, 3).setUsage(THREE.DynamicDrawUsage));
  anchorGeo.setAttribute('aAlpha', new THREE.BufferAttribute(aAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  anchorGeo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(anchorSizes), 1));
  const anchorMat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 500 } }, vertexShader: ANCHOR_VERT, fragmentShader: ANCHOR_FRAG,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const anchorPoints = new THREE.Points(anchorGeo, anchorMat);
  anchorPoints.name = 'anchor-glows';
  anchorPoints.frustumCulled = false;
  anchorPoints.renderOrder = 12;
  root.add(anchorPoints);

  // ---------------------------------------------------------------- body state (appearance only)
  const body = { scale: 1, fat: 0, age: 0 };
  const bodyTarget = { scale: 1, fat: 0, age: 0 };
  const bodyFns = [];

  // ---------------------------------------------------------------- sites + hotspots
  // siteBase: the landmark (model space) and the skin's regional weights there; siteFrames: world
  // space, updated in place whenever the body changes.
  const siteBase = {};
  const siteFrames = {};
  const siteOff = {};
  for (const s of SITES) {
    const def = landmarks.sites[s];
    if (!def) continue;
    const point0 = V(def.point);
    const normal = V(def.normal || [0, 0, 1]).normalize();
    const t = new THREE.Vector3(normal.z, 0, -normal.x);
    if (t.lengthSq() < 1e-6) t.set(1, 0, 0);
    t.normalize();
    if (t.x < 0) t.negate();
    const camDir = normal.clone().multiplyScalar(0.55).addScaledVector(t, 0.8);
    if (camDir.z < 0.1) t.negate();
    const b = new THREE.Vector3().crossVectors(normal, t).normalize();
    siteBase[s] = { point0, w: morphAt(skinPos, skinMorph, point0, new THREE.Vector3()) };
    siteOff[s] = new THREE.Vector3();
    siteFrames[s] = { point: point0.clone(), normal, tangent: t, bitangent: b, label: def.label || SITE_LABELS[s] };
  }
  const siteDisp = (s) => {
    const w = siteBase[s]?.w;
    return w ? w.x * body.fat + (w.y - 0.35 * w.z) * body.age : 0;
  };

  const siteHotspots = {};
  const hotspotTargets = [];
  const hotspotMats = [];
  let selectedSite = null;
  let hoverSite = null;
  for (const s of SITES) {
    const f = siteFrames[s];
    if (!f) continue;
    const g = new THREE.Group();
    g.name = `hotspot:${s}`;
    g.position.copy(siteBase[s].point0).addScaledVector(f.normal, 0.0025);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.normal);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color() }, uTime: { value: 0 }, uSel: { value: 0 }, uAnim: { value: 1 },
        uOpacity: { value: 1 }, uHover: { value: 0 },
      },
      vertexShader: HOTSPOT_VERT, fragmentShader: HOTSPOT_FRAG,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), mat);
    ring.renderOrder = 13;
    // double-sided so the ring can be picked through the see-through body (e.g. the back of the arm)
    const hit = new THREE.Mesh(new THREE.CircleGeometry(0.045, 24), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    hit.userData.site = s;
    g.add(ring, hit);
    g.userData = { site: s, mat, sel: 0, selTarget: 0, hover: 0, base: 1 };
    root.add(g);
    siteHotspots[s] = g;
    hotspotTargets.push(hit);
    hotspotMats.push(mat);
  }
  let hotspotsVisible = true;
  let hotspotFade = 1;

  // ---------------------------------------------------------------- landmarks helpers
  // Internally everything is model space (the anatomy group carries the body scale); the public
  // getters return world space.
  const centerCache = {};
  const fatRoute = usingGLB ? landmarks.paths?.to_fat : null;
  const fatRouteEnd = fatRoute?.length ? V(fatRoute[fatRoute.length - 1]) : null;
  const _m = new THREE.Vector3();
  function modelCenter(id, out) {
    // 'fat' on the real anatomy is where its artery route ends (subcutaneous fat of the lower belly),
    // so the arrival glow and the label sit where the drug particles stop.
    if (id === 'fat' && fatRouteEnd) return out.copy(fatRouteEnd);
    if (id === 'injection_site' || id === 'fat') {
      const s = siteBase[selectedSite || 'abdomen'] ? (selectedSite || 'abdomen') : null;
      if (s) return out.copy(siteBase[s].point0).add(siteOff[s]).addScaledVector(siteFrames[s].normal, id === 'fat' ? -0.011 : -0.004);
    }
    let c = centerCache[id];
    if (!c) {
      const o = landmarks.organs?.[id];
      if (o?.center) c = V(o.center);
      else if (meshes[id]) { root.updateMatrixWorld(true); c = new THREE.Box3().setFromObject(meshes[id]).getCenter(new THREE.Vector3()).divideScalar(root.scale.x || 1); }
      else c = new THREE.Vector3(0, 1.1, 0);
      centerCache[id] = c;
    }
    return out.copy(c);
  }
  function organCenter(id, out = new THREE.Vector3()) {
    return modelCenter(id, out).multiplyScalar(body.scale);
  }
  function organAnchor(id, out = new THREE.Vector3()) {
    const a = landmarks.anchors?.[id];
    return a ? out.set(a[0], a[1], a[2]).multiplyScalar(body.scale) : organCenter(id, out);
  }
  const radiusCache = {};
  function organRadius(id) {
    if (radiusCache[id] == null) {
      const o = landmarks.organs?.[id];
      if (o?.radius) radiusCache[id] = o.radius;
      else if (meshes[id]) {
        root.updateMatrixWorld(true);
        radiusCache[id] = new THREE.Box3().setFromObject(meshes[id]).getBoundingSphere(new THREE.Sphere()).radius / (root.scale.x || 1);
      } else radiusCache[id] = 0.05;
    }
    return radiusCache[id] * body.scale;
  }
  const eyeOff = [0, 0, 0, 0.032, -0.032, 0, 0];
  function updateAnchorPositions() {
    for (let i = 0; i < anchorIds.length; i++) {
      modelCenter(anchorIds[i], _m);
      if (anchorIds[i] === 'eyes') { _m.x += eyeOff[i]; _m.z -= 0.005; }
      aPos[i * 3] = _m.x; aPos[i * 3 + 1] = _m.y; aPos[i * 3 + 2] = _m.z;
    }
    anchorGeo.attributes.position.needsUpdate = true;
  }

  // Apply the current body: group scale, skin offset uniforms, sites, hotspots, anchors. No allocation.
  function applyBody() {
    root.scale.setScalar(body.scale);
    skinMat.uniforms.uFat.value = body.fat;
    skinMat.uniforms.uAge.value = body.age;
    for (const s of SITES) {
      const f = siteFrames[s];
      if (!f) continue;
      const d = siteDisp(s);
      siteOff[s].copy(f.normal).multiplyScalar(d);
      f.point.copy(siteBase[s].point0).add(siteOff[s]).multiplyScalar(body.scale);
      siteHotspots[s]?.position.copy(siteBase[s].point0).addScaledVector(f.normal, d + 0.0025);
    }
    updateAnchorPositions();
    for (let i = 0; i < bodyFns.length; i++) {
      try { bodyFns[i](body); } catch (e) { console.error('[anatomy] body listener failed', e); }
    }
  }
  function setBody(next = {}, { instant = false } = {}) {
    if (Number.isFinite(next.scale)) bodyTarget.scale = Math.min(1.6, Math.max(0.6, next.scale));
    if (Number.isFinite(next.fat)) bodyTarget.fat = Math.min(0.15, Math.max(-0.03, next.fat));
    if (Number.isFinite(next.age)) bodyTarget.age = Math.min(0.03, Math.max(-0.03, next.age));
    if (instant || stage.reducedMotion) {
      body.scale = bodyTarget.scale; body.fat = bodyTarget.fat; body.age = bodyTarget.age;
      applyBody();
    }
  }
  function stepBody(dt) {
    const ds = bodyTarget.scale - body.scale, df = bodyTarget.fat - body.fat, da = bodyTarget.age - body.age;
    if (Math.abs(ds) < 1e-5 && Math.abs(df) < 1e-5 && Math.abs(da) < 1e-5) {
      if (ds || df || da) { body.scale = bodyTarget.scale; body.fat = bodyTarget.fat; body.age = bodyTarget.age; applyBody(); }
      return;
    }
    const k = stage.reducedMotion ? 1 : 1 - Math.exp(-dt * 6.5);
    body.scale += ds * k; body.fat += df * k; body.age += da * k;
    applyBody();
  }
  // Subcutaneous fat thickness under a site relative to the default body (the tissue cross-section
  // uses it): the same regional offset, read as extra (or less) fat under the skin.
  function siteTissue(site) {
    const d = siteBase[site] ? siteDisp(site) : 0;
    return { fatScale: Math.min(3, Math.max(0.55, 1 + d / 0.05)) };
  }
  updateAnchorPositions();

  // ---------------------------------------------------------------- theme
  let T = THEME[stage.theme] || THEME.dark;
  function applyTheme(theme) {
    T = THEME[theme] || THEME.dark;
    applyFresnelTheme(skinMat, T.skin, { scan: true, contour: true });
    skinMat.uniforms.uCutLine.value.setHex(T.skin.cutLine ?? T.skin.rim);
    applyFresnelTheme(arteryMat, T.artery);
    applyFresnelTheme(veinMat, T.vein);
    applyFresnelTheme(boneMat, T.bone);
    for (const id of Object.keys(organMats)) {
      const m = organMats[id];
      m.userData.baseOpacity = T.organ.opacity;
      m.roughness = T.organ.roughness;
      m.envMapIntensity = T.organ.env;
      m.userData.rim.uRimStrength.value = T.organ.rim;
      m.userData.rim.uRimPower.value = T.organ.rimPower;
      m.userData.rim.uRimColor.value.copy(m.userData.baseColor).lerp(tmpC.setHex(T.organ.rimTint ?? 0xffffff), 0.4);
    }
    anchorMat.blending = T.anchorAdditive ? THREE.AdditiveBlending : THREE.NormalBlending;
    anchorMat.needsUpdate = true;
    for (const m of hotspotMats) {
      m.uniforms.uColor.value.setHex(T.hotspot);
      m.blending = stage.theme === 'light' ? THREE.NormalBlending : THREE.AdditiveBlending;
      m.needsUpdate = true;
    }
    dirtyOpacity = true;
  }
  let dirtyOpacity = true;
  const offTheme = stage.onTheme(applyTheme);
  applyTheme(stage.theme);

  // ---------------------------------------------------------------- highlight API
  const toColor = (c, fallback) => {
    if (c == null) return tmpC.set(fallback);
    if (c.isColor) return tmpC.copy(c);
    return tmpC.set(c);
  };
  function highlight(organId, { color, intensity = 1, pulse = 0, channel = 'default' } = {}) {
    const st = organState[organId];
    if (!st) return;
    const slot = channel === 'drug' ? st.drug : st.slots[channel] || st.slots.default;
    slot.on = intensity > 0;
    slot.color.copy(toColor(color, channel === 'drug' ? T.drug : T.hotspot));
    slot.intensity = intensity;
    slot.pulse = pulse === true ? 0.9 : Number(pulse) || 0;
  }
  function unhighlight(organId, { channel } = {}) {
    const st = organState[organId];
    if (!st) return;
    if (!channel) { for (const c of CHANNELS) st.slots[c].on = false; st.drug.on = false; return; }
    if (channel === 'drug') st.drug.on = false; else if (st.slots[channel]) st.slots[channel].on = false;
  }
  function clearHighlights(channel) {
    for (const id of ORGAN_IDS) unhighlight(id, channel ? { channel } : {});
  }

  let focusId = null;
  let isolate = false;
  function applyDimTargets() {
    for (const oid of ORGAN_IDS) {
      organState[oid].dimTarget = isolate ? 0.05 : !focusId ? 1 : oid === focusId ? 1 : 0.2;
    }
    skinDimTarget = isolate ? 0.55 : focusId ? 0.5 : 1;
    vesselDimTarget = isolate ? 0.035 : focusId ? (focusId === 'blood' ? 1 : 0.35) : 1;
    boneDimTarget = isolate ? 0 : focusId ? 0.35 : 1;
  }
  function setFocus(id) { focusId = id || null; applyDimTargets(); }
  // Close-up mode for the injection: everything but the skin outline fades far back.
  function setIsolate(on) { isolate = !!on; applyDimTargets(); }
  let skinDim = 1, skinDimTarget = 1, vesselDim = 1, vesselDimTarget = 1, boneDim = 1, boneDimTarget = 1;

  function selectSite(site) {
    selectedSite = SITES.includes(site) ? site : null;
    for (const s of SITES) if (siteHotspots[s]) siteHotspots[s].userData.selTarget = s === selectedSite ? 1 : 0;
    updateAnchorPositions();
  }
  function setHoverSite(site) { hoverSite = site || null; }
  function setHotspotsVisible(on) { hotspotsVisible = !!on; }

  // Section cut at the injection site (the tissue block is the cut face): skin and vessel walls on the
  // camera side of the plane through `center` with normal `planeNormal` fade out within `radius`; the
  // skin gets a fine contour where it meets the plane. Without a normal it is a round window.
  function setSkinCut(center, radius = 0.05, amount = 1, planeNormal = null) {
    // While cut open, the skin is drawn double-sided so the far half of the limb or belly still reads
    // as a shell around the block (seen from inside) instead of vanishing.
    const side = center && amount > 0 && planeNormal ? THREE.DoubleSide : THREE.FrontSide;
    if (skinMat.side !== side) { skinMat.side = side; skinMat.needsUpdate = true; }
    for (const m of [skinMat, arteryMat, veinMat, boneMat]) {
      const u = m.uniforms;
      if (!center || amount <= 0) { u.uCutAmt.value = 0; continue; }
      u.uCut.value.set(center.x, center.y, center.z, radius);
      if (planeNormal) u.uCutN.value.copy(planeNormal); else u.uCutN.value.set(0, 0, 0);
      u.uCutAmt.value = amount;
      u.uCutLineAmt.value = m === skinMat ? 1 : 0;
    }
  }

  // ---------------------------------------------------------------- per-frame
  const scanPeriod = 9.5;
  const pulseK = (slot, t) => {
    if (!slot.pulse || stage.reducedMotion) return 1;
    return 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * slot.pulse * Math.PI * 2));
  };
  function update(dt, t) {
    const rm = stage.reducedMotion;
    stepBody(dt);
    // scan band (off under reduced motion)
    const su = skinMat.uniforms;
    if (rm) su.uScanAmt.value = 0;
    else {
      const ph = (t % scanPeriod) / scanPeriod;
      su.uScanY.value = (-0.15 + ph * 2.1) * body.scale;
      su.uScanAmt.value = (skinMat.userData.scanAmt ?? 1) * smoothstep(0, 0.08, ph) * smoothstep(1, 0.85, ph);
    }
    // dimming (focus)
    const k = rm ? 1 : 1 - Math.exp(-dt * 7);
    let changed = dirtyOpacity;
    for (const id of MESH_ORGANS) {
      const st = organState[id];
      if (Math.abs(st.dim - st.dimTarget) > 1e-3) { st.dim += (st.dimTarget - st.dim) * k; changed = true; }
    }
    if (Math.abs(skinDim - skinDimTarget) > 1e-3) { skinDim += (skinDimTarget - skinDim) * k; changed = true; }
    if (Math.abs(vesselDim - vesselDimTarget) > 1e-3) { vesselDim += (vesselDimTarget - vesselDim) * k; changed = true; }
    if (Math.abs(boneDim - boneDimTarget) > 1e-3) { boneDim += (boneDimTarget - boneDim) * k; changed = true; }
    if (changed) {
      dirtyOpacity = false;
      for (const id of MESH_ORGANS) {
        const m = organMats[id];
        if (!m) continue;
        const d = organState[id].dim;
        m.opacity = (m.userData.baseOpacity ?? 0.8) * d;
        m.depthWrite = d > 0.6;
        if (meshes[id]) meshes[id].visible = d > 0.015;
      }
      su.uOpacity.value = skinDim;
      arteryMat.uniforms.uOpacity.value = vesselDim;
      veinMat.uniforms.uOpacity.value = vesselDim;
      boneMat.uniforms.uOpacity.value = boneDim;
      if (boneMesh) boneMesh.visible = boneDim > 0.01;
    }
    // organ emissive
    const gain = T.highlightGain;
    for (const id of ORGAN_IDS) {
      const st = organState[id];
      let top = null;
      for (const c of CHANNELS) { if (st.slots[c].on) { top = st.slots[c]; break; } }
      let r = 0, g = 0, b = 0;
      if (top) {
        const p = pulseK(top, t) * top.intensity * gain;
        r += top.color.r * p; g += top.color.g * p; b += top.color.b * p;
      }
      if (st.drug.on) {
        const w = top && (top === st.slots.risk || top === st.slots.effect) ? 0 : 1;
        const p = st.drug.intensity * gain * w;
        r += st.drug.color.r * p; g += st.drug.color.g * p; b += st.drug.color.b * p;
      }
      st.out.setRGB(r, g, b);
      const m = organMats[id];
      if (m) {
        const base = T.organ.emissiveBase;
        const bc = m.userData.baseColor;
        m.emissive.setRGB(bc.r * base + r, bc.g * base + g, bc.b * base + b);
        // let warnings (and, more gently, the drug arriving) read on the surface colour too; this
        // matters most in the light theme, where emissive light barely shows
        const warnTop = top && (top === st.slots.risk || top === st.slots.effect);
        let tint = 0, tintColor = null;
        if (warnTop) { tint = Math.min(T.tintMax, top.intensity * T.tintGain * pulseK(top, t)); tintColor = top.color; }
        else if (top === st.slots.arrival) { tint = Math.min(0.5, top.intensity * 0.42); tintColor = top.color; }
        else if (st.drug.on) { tint = Math.min(0.4, st.drug.intensity * 0.5); tintColor = st.drug.color; }
        if (tint > 0) m.color.copy(bc).lerp(tintColor, tint); else m.color.copy(bc);
      }
    }
    // anchors
    for (let i = 0; i < anchorIds.length; i++) {
      const o = organState[anchorIds[i]].out;
      const lum = Math.max(o.r, o.g, o.b);
      const a = Math.min(1, lum);
      const inv = lum > 1e-4 ? 1 / Math.max(1, lum) : 0;
      aCol[i * 3] = o.r * inv;
      aCol[i * 3 + 1] = o.g * inv;
      aCol[i * 3 + 2] = o.b * inv;
      aAlpha[i] = a * (T.anchorAdditive ? 0.24 : 0.55); // additive glows stay below a white bloom blow-out
    }
    anchorGeo.attributes.aColor.needsUpdate = true;
    anchorGeo.attributes.aAlpha.needsUpdate = true;
    anchorMat.uniforms.uScale.value = stage.viewScale || 500;
    // skin + blood tints
    const so = organState.skin.out;
    const sl = Math.max(so.r, so.g, so.b);
    su.uTintAmt.value = Math.min(0.3, sl * 0.25); // a hint on the skin; the anchor glow carries the signal
    if (sl > 1e-4) su.uTint.value.setRGB(so.r / Math.max(1, sl), so.g / Math.max(1, sl), so.b / Math.max(1, sl));
    const bo = organState.blood.out;
    const bl = Math.max(bo.r, bo.g, bo.b);
    for (const m of [arteryMat, veinMat]) {
      m.uniforms.uTintAmt.value = Math.min(0.85, bl * 0.55);
      if (bl > 1e-4) m.uniforms.uTint.value.setRGB(bo.r / Math.max(1, bl), bo.g / Math.max(1, bl), bo.b / Math.max(1, bl));
    }
    // hotspots
    const fadeTarget = hotspotsVisible ? 1 : 0;
    hotspotFade += (fadeTarget - hotspotFade) * (rm ? 1 : 1 - Math.exp(-dt * 8));
    const camDist = stage.camera.position.distanceTo(stage.controls.target);
    const scaleBase = THREE.MathUtils.clamp(camDist / 2.6, 0.32, 1.25);
    for (const s of SITES) {
      const h = siteHotspots[s];
      if (!h) continue;
      const ud = h.userData;
      ud.sel += (ud.selTarget - ud.sel) * (rm ? 1 : 1 - Math.exp(-dt * 8));
      const hv = hoverSite === s ? 1 : 0;
      ud.hover += (hv - ud.hover) * (rm ? 1 : 1 - Math.exp(-dt * 10));
      const u = ud.mat.uniforms;
      u.uTime.value = t;
      u.uSel.value = ud.sel;
      u.uHover.value = ud.hover;
      u.uAnim.value = rm ? 0 : 1;
      u.uOpacity.value = hotspotFade * (0.75 + 0.25 * ud.sel);
      h.visible = hotspotFade > 0.01;
      h.scale.setScalar(scaleBase * (1 + 0.25 * ud.sel));
    }
  }
  const offFrame = stage.onFrame(update);

  // ---------------------------------------------------------------- pickables
  const pickables = [];
  for (const id of MESH_ORGANS) if (meshes[id]) meshes[id].traverse((o) => { if (o.isMesh) { o.userData.organId = id; pickables.push(o); } });

  function dispose() {
    offFrame(); offTheme();
    root.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) m.dispose();
    });
    root.removeFromParent();
  }

  return {
    root,
    source: usingGLB ? 'glb' : 'placeholder',
    landmarks,
    meshes,
    skin: skinMesh,
    arteries: arteryMesh,
    veins: veinMesh,
    skeleton: boneMesh,
    siteHotspots,
    hotspotTargets,
    pickables,
    labels: ORGAN_LABELS,
    highlight, unhighlight, clearHighlights,
    setFocus, get focus() { return focusId; }, setIsolate,
    organCenter, organAnchor, organRadius,
    // editable body (appearance only)
    variant: female ? 'female' : 'male',
    modelHeight,
    setBody,
    get body() { return { scale: body.scale, fat: body.fat, age: body.age }; },
    get bodyScale() { return body.scale; },
    onBodyChange(fn) { bodyFns.push(fn); return () => { const i = bodyFns.indexOf(fn); if (i >= 0) bodyFns.splice(i, 1); }; },
    toWorld: (v) => v.multiplyScalar(body.scale),
    siteOffset: (site) => siteOff[site] || null,
    siteTissue,
    selectSite, get selectedSite() { return selectedSite; },
    setHoverSite, setHotspotsVisible,
    siteFrame: (s) => siteFrames[s] || null,
    setSkinCut,
    dispose,
  };
}

// Internal builders, exported for dev tooling (profiling and tests) only.
export const _internals = { buildMannequin, buildOrgans, buildVesselTree, buildSkeleton, placeholderLandmarks, bodySDF, morphWeights };
