// The cloud deck seen from above (ABOVE_CLOUDS in flight-physics-logic.js,
// off with ?aboveClouds=0). The sky paints its clouds looking up, so above
// the deck they'd vanish; this is one big flat sheet at the deck's height
// under the camera, drawing the same cumulus the sky shows from below (so
// the gaps match), lit from above: sunny sides bright, shadow sides soft
// and sky-tinted, fading into the horizon far off. Only drawn above the deck.
import * as THREE from 'three';
import {scene} from './scene.js';
import {skyUniforms} from './sky-uniforms.js';
import {CLOUD_GLSL} from './constants.js';
import {ART_POST} from './art-style.js';
import {state} from './state.js';
import {hooks} from './hooks.js';
import {ABOVE_CLOUDS} from './flight-physics-logic.js';
import {headlight, HEADLIGHT_COLOR} from './airplane.js';

const RADIUS = 26000;
// The landing light on the cloud: cos of the beam's outer and inner
// half-angles (its spotlight is 30 degrees across), where it fades out,
// and how far the glow round the plane reaches
const LAMP_CONE = {x: '0.866', y: '0.97'};
const LAMP_RANGE = {x: '300.0', y: '1500.0'};
const LAMP_GLOW = 160;
const deckUniforms = {
  sunDirection: skyUniforms.sunDirection,
  uCloudDensity: skyUniforms.uCloudDensity,
  uTime: skyUniforms.uTime,
  topColor: skyUniforms.topColor,
  bottomColor: skyUniforms.bottomColor,
  uNoiseTex: skyUniforms.uNoiseTex,
  uMoonDir: skyUniforms.uMoonDir,
  uMoonBright: skyUniforms.uMoonBright,
  uCloudCover: skyUniforms.uCloudCover,
  uSnowDeck: skyUniforms.uSnowDeck,
  // Cumulus only: the high cirrus and mackerel aren't in the deck
  uCloudTypes: {value: new THREE.Vector3(1, 0, 0)},
  uDeckHeight: {value: 3000},
  uDeckLight: {value: 1},
  uDeckCenter: {value: new THREE.Vector2()},
  // The plane's landing light (black when off): its beam lights the
  // cloud ahead, and a soft glow lights the cloud right around the plane
  uLampPos: {value: new THREE.Vector3()},
  uLampDir: {value: new THREE.Vector3(0, 0, -1)},
  uLampColor: {value: new THREE.Color(0, 0, 0)},
};

// Domes (#176 follow-up): near the camera the deck is a grid raised into
// the clouds' tops, so skimming over it the billows stand up as rounded
// domes with real silhouettes and parallax instead of a painted floor.
// The cloud's thickness lifts each vertex up to DOME_HEIGHT; the grid is
// snapped to its cells so the shapes don't swim as the camera moves, and
// flattens out toward DOME_RADIUS, where the flat sheet takes over.
const DOME_HEIGHT = 380;
const DOME_RADIUS = 7000;
const DOME_CELLS = 128;
const DOME_CELL = (DOME_RADIUS * 2) / DOME_CELLS;
// Where the domes end and the flat sheet starts (inside the grid's edge,
// so the snapping never leaves a gap)
const DOME_SEAM = DOME_RADIUS - 2 * DOME_CELL;

// Shared by the domes (in the vertex shader, which has no derivatives:
// the anime cirrus in CLOUD_GLSL uses fwidth, unused here) and the veil
const DOME_GLSL = /* glsl */ `
  uniform float uCloudDensity;
  uniform float uTime;
  uniform float uDeckHeight;
  float cloudEdge() {
    return 0.42 - (uCloudDensity - 0.5) * 0.6 - uCloudCover;
  }
  // The sky's cumulus noise (cloudsAlong in CLOUD_GLSL) at world xz, with
  // the fine detail scaled by detail: the cloud's thickness
  float cumulusAt(vec2 xz, float detail) {
    vec2 q;
    vec2 uv = xz / uDeckHeight;
    return cumulusShape((uv + CLOUD_WIND * uTime * 0.034) * 2.0, detail, q);
  }
  // How high the cloud's top stands over the deck there: starts just inside
  // the soft outer rim so small clouds stay 3D billows, then builds into
  // lumpy tops so the thick middles tower over the rest
  float domeHeight(vec2 xz) {
    float d = cumulusAt(xz, 0.0) - cloudEdge() - 0.08;
    float side = smoothstep(0.0, 0.14, d);
    float top = clamp(d / 0.52, 0.0, 1.0);
    // Cauliflower lumps a few hundred metres across on top
    float lumps = fbmMacro(xz / 420.0 + 5.0) - 0.55;
    return ${DOME_HEIGHT.toFixed(1)} * uCloudTypes.x
      * max(0.0, 0.3 * side + 0.7 * top + lumps * 0.45 * side);
  }
`;

function deckMaterial(domes) {
  return new THREE.ShaderMaterial({
    uniforms: deckUniforms,
    defines: domes ? {DOMES: ''} : {},
    vertexShader:
      (domes ? '#define fwidth(x) 0.0\n' + CLOUD_GLSL + DOME_GLSL : '') +
      /* glsl */ `
    uniform vec2 uDeckCenter;
    varying vec3 vWorld;
    varying vec3 vNormal2;
    varying float vLift;
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.0);
      vNormal2 = vec3(0.0, 1.0, 0.0);
      vLift = 0.0;
#ifdef DOMES
      float rim = 1.0 - smoothstep(0.55, 1.0,
        length(w.xz - uDeckCenter) / ${DOME_SEAM.toFixed(1)});
      float e = ${(DOME_CELL * 0.75).toFixed(1)};
      float h0 = domeHeight(w.xz) * rim;
      float hx = domeHeight(w.xz + vec2(e, 0.0)) * rim;
      float hz = domeHeight(w.xz + vec2(0.0, e)) * rim;
      w.y += h0;
      vNormal2 = normalize(vec3(h0 - hx, e, h0 - hz));
      vLift = h0 / ${DOME_HEIGHT.toFixed(1)};
#endif
      vWorld = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }
  `,
    fragmentShader:
      CLOUD_GLSL +
      DOME_GLSL +
      /* glsl */ `
    uniform vec3 sunDirection;
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform float uDeckLight;
    uniform vec2 uDeckCenter;
    uniform vec3 uLampPos;
    uniform vec3 uLampDir;
    uniform vec3 uLampColor;
    varying vec3 vWorld;
    varying vec3 vNormal2;
    varying float vLift;

    void main() {
      float dist = length(vWorld.xz - uDeckCenter);
#ifdef DOMES
      if (dist > ${DOME_SEAM.toFixed(1)}) discard;
#else
      if (dist < ${DOME_SEAM.toFixed(1)}) discard;
#endif
      float far = dist / ${RADIUS.toFixed(1)};
      float edge = cloudEdge();
      float n = cumulusAt(vWorld.xz, 1.0);
      float here = smoothstep(edge, edge + 0.16, n) * 0.92 * uCloudTypes.x;
      if (here < 0.004) discard;
      // The noise as the height of the tops, well past where the cloud
      // turns solid: a slope down toward the sun faces it, one up toward it
      // is in shadow, so billows show all across the deck, not just at
      // its edges; the hollows between billows are darker too
      vec2 sun2D = length(sunDirection.xz) > 0.001
        ? normalize(sunDirection.xz) : vec2(1.0, 0.0);
      float towardSun = cumulusAt(vWorld.xz + sun2D * 0.008 * uDeckHeight, 1.0);
      float lit = clamp(0.6 + (n - towardSun) * 14.0, 0.0, 1.0);
      float hollow = smoothstep(edge, edge + 0.45, n);
      // Low sun: longer shadows and a warm light
      float lowSun = 1.0 - smoothstep(0.05, 0.5, sunDirection.y);
#ifdef DOMES
      // A dome's own sides: lit by the sun (soft, as cloud scatters it),
      // with the billow detail on top; flat ground at the seam matches the
      // sheet beyond
      vec3 nrm = normalize(vNormal2);
      if (!gl_FrontFacing) nrm = -nrm;
      float sunSide = clamp(dot(nrm, normalize(sunDirection)) * 0.8 + 0.5, 0.0, 1.0);
      float slopeSteep = smoothstep(0.01, 0.15, 1.0 - nrm.y);
      lit = mix(lit, lit * sunSide, slopeSteep);
      // Dome bases sit in their own shadow
      float baseHollow = min(hollow, mix(0.35, 1.0, smoothstep(0.0, 0.5, vLift)));
      hollow = mix(hollow, baseHollow, slopeSteep);
      // Thick 3D cloud volume is optically solid even when its 2D footprint is
      // small, so dome walls aren't hollow arches or front-to-back depth cutouts
      here = max(here, smoothstep(0.01, 0.12, vLift) * 0.75);
#endif
      lit = mix(lit, lit * lit, lowSun * 0.3);
      vec3 sunlit = mix(vec3(1.0, 0.99, 0.97), bottomColor * 1.6, lowSun * 0.35);
      vec3 shade = mix(vec3(0.74, 0.77, 0.84), topColor, 0.25);
      vec3 col = mix(shade, sunlit, lit);
      // Thin edges and hollows are greyer (from above, even a storm deck's
      // top is in the sun)
      col *= mix(0.84, 1.0, hollow);
      col *= uDeckLight;
      if (uLampColor.r + uLampColor.g + uLampColor.b > 0.0) {
        vec3 toCloud = vWorld - uLampPos;
        float d = length(toCloud);
        float beam = smoothstep(${LAMP_CONE.x}, ${LAMP_CONE.y},
          dot(toCloud / max(d, 1e-3), uLampDir));
        float reach = 1.0 - smoothstep(${LAMP_RANGE.x}, ${LAMP_RANGE.y}, d);
        float glow = 1.0 - smoothstep(0.0, ${LAMP_GLOW.toFixed(1)}, d);
        col += uLampColor * mix(0.8, 1.0, lit) * (beam * reach * 0.55 + glow * 0.35);
      }
      col = mix(col, bottomColor, smoothstep(0.25, 0.95, far));
      // Solid where the sky would show thick cloud, so no ground shows through
      float a = smoothstep(0.0, 0.7, here) * (1.0 - smoothstep(0.85, 1.0, far));
      gl_FragColor = vec4(col, a);
    }
  `,
    transparent: true,
    // The domes hide those behind them
    depthWrite: domes,
    fog: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
  });
}
const material = deckMaterial(false);
const domeMaterial = deckMaterial(true);

const geometry = new THREE.PlaneGeometry(RADIUS * 2, RADIUS * 2, 1, 1);
geometry.rotateX(-Math.PI / 2);
const deck = new THREE.Mesh(geometry, material);
deck.frustumCulled = false;
deck.visible = false;
deck.renderOrder = 1;
if (ABOVE_CLOUDS) scene.add(deck);
const domeGeometry = new THREE.PlaneGeometry(
  DOME_RADIUS * 2,
  DOME_RADIUS * 2,
  DOME_CELLS,
  DOME_CELLS
);
domeGeometry.rotateX(-Math.PI / 2);
const domes = new THREE.Mesh(domeGeometry, domeMaterial);
domes.frustumCulled = false;
domes.visible = false;
domes.renderOrder = 2;
if (ABOVE_CLOUDS) scene.add(domes);

export function updateCloudDeck(camPos) {
  if (!ABOVE_CLOUDS) return;
  const h = skyUniforms.uCloudHeight.value;
  deck.visible = skyUniforms.uShowClouds.value && camPos.y > h + 5;
  domes.visible = deck.visible;
  if (!deck.visible) return;
  deck.position.set(camPos.x, h, camPos.z);
  domes.position.set(
    Math.round(camPos.x / DOME_CELL) * DOME_CELL,
    h,
    Math.round(camPos.z / DOME_CELL) * DOME_CELL
  );
  deckUniforms.uDeckHeight.value = h;
  deckUniforms.uDeckCenter.value.set(camPos.x, camPos.z);
  deckUniforms.uCloudTypes.value.set(skyUniforms.uCloudTypes.value.x, 0, 0);
  deckUniforms.uDeckLight.value = 0.3 + 0.7 * Math.min(1, state.dayFactor);
  updateLamp();
}

const _lampTarget = new THREE.Vector3();
// The landing light, from the spotlight itself (airplane.js aims it); it
// shows mostly at night, against the dark cloud
function updateLamp() {
  const u = deckUniforms;
  if (headlight.intensity === 0) {
    u.uLampColor.value.setRGB(0, 0, 0);
    return;
  }
  headlight.getWorldPosition(u.uLampPos.value);
  headlight.target.getWorldPosition(_lampTarget);
  u.uLampDir.value.subVectors(_lampTarget, u.uLampPos.value).normalize();
  const night = 1 - Math.min(1, state.dayFactor);
  u.uLampColor.value.copy(HEADLIGHT_COLOR).multiplyScalar(0.15 + 0.85 * night);
}

// Inside the deck: a whiteout over the whole view (the fog alone doesn't
// reach the sky), as thick as the cloud the camera is in. The sky's own
// cumulus at the camera says whether that's a cloud or a gap, so climbing
// through a gap stays clear and through a cloud goes white. Only drawn
// within the deck's band (uBand), so the noise costs nothing elsewhere.
const veilMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uColor: {value: new THREE.Color()},
    uBand: {value: 0},
    uCamXZ: {value: new THREE.Vector2()},
    uCamY: {value: 0},
    uDeckHeight: deckUniforms.uDeckHeight,
    uCloudDensity: skyUniforms.uCloudDensity,
    uTime: skyUniforms.uTime,
    uNoiseTex: skyUniforms.uNoiseTex,
    uMoonDir: skyUniforms.uMoonDir,
    uMoonBright: skyUniforms.uMoonBright,
    uCloudCover: skyUniforms.uCloudCover,
    uSnowDeck: skyUniforms.uSnowDeck,
    uCloudTypes: deckUniforms.uCloudTypes,
  },
  vertexShader: /* glsl */ `
    void main() { gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }
  `,
  fragmentShader:
    CLOUD_GLSL +
    DOME_GLSL +
    /* glsl */ `
    uniform vec3 uColor;
    uniform float uBand;
    uniform vec2 uCamXZ;
    uniform float uCamY;
    void main() {
      float edge = cloudEdge();
      // Thicker toward the middle of a cloud, so the white builds and clears
      float inside = smoothstep(edge, edge + 0.12, cumulusAt(uCamXZ, 0.0))
        * uCloudTypes.x;
      // Over the deck, white only inside a dome, thickening past its skin
      float under = uDeckHeight + domeHeight(uCamXZ) - uCamY;
      float band = uCamY > uDeckHeight ? smoothstep(-20.0, 60.0, under) : uBand;
      gl_FragColor = vec4(uColor, min(0.95, band * inside * 1.15));
    }
  `,
  transparent: true,
  depthTest: false,
  depthWrite: false,
  fog: false,
});
const veil = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), veilMaterial);
veil.frustumCulled = false;
veil.renderOrder = 1000;
veil.visible = false;
if (ABOVE_CLOUDS) scene.add(veil);

// With the art style's post pass, attenuate the target's alpha where the
// cloud sheet or veil covers the view so ridge and plane ink don't bleed
// through thick cloud, while gaps between clouds keep their ink
if (ART_POST) {
  for (const mat of [material, domeMaterial, veilMaterial]) {
    mat.blending = THREE.CustomBlending;
    mat.blendSrc = THREE.SrcAlphaFactor;
    mat.blendDst = THREE.OneMinusSrcAlphaFactor;
    mat.blendSrcAlpha = THREE.ZeroFactor;
    mat.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  }
}

const _white = new THREE.Color(0xf2f4f7);
const _nightCloud = new THREE.Color(0x3a414c);
const _litCloud = new THREE.Color(0x9a9286);
export function updateCloudVeil(fogColor, camPos) {
  if (!ABOVE_CLOUDS) return;
  const h = skyUniforms.uCloudHeight.value;
  const band = skyUniforms.uShowClouds.value
    ? 1 - THREE.MathUtils.smoothstep(Math.abs(camPos.y - h), 60, 260)
    : 0;
  // Over the deck the shader checks the dome under the camera
  veil.visible =
    band > 0.01 ||
    (skyUniforms.uShowClouds.value &&
      camPos.y > h &&
      camPos.y < h + DOME_HEIGHT + 30);
  if (!veil.visible) return;
  const u = veilMaterial.uniforms;
  u.uBand.value = band;
  u.uCamXZ.value.set(camPos.x, camPos.z);
  u.uCamY.value = camPos.y;
  u.uDeckHeight.value = h;
  deckUniforms.uCloudTypes.value.set(skyUniforms.uCloudTypes.value.x, 0, 0);
  // Cloud white in daylight; at night a dim moonlit grey instead of the
  // fog's near-black (which read as the screen going dark), lit up warm
  // by the landing light when it's on
  const day = Math.min(1, state.dayFactor);
  u.uColor.value
    .copy(fogColor)
    .lerp(_nightCloud, 1 - day)
    .lerp(_white, 0.6 * day);
  if (headlight.intensity > 0) {
    u.uColor.value.lerp(_litCloud, 0.55 * (1 - day));
  }
}

if (ABOVE_CLOUDS) {
  hooks.warmUps.push(async () => {
    if (!skyUniforms.uShowClouds.value) return null;
    const deckWas = deck.visible;
    const domesWas = domes.visible;
    const veilWas = veil.visible;
    const prevTypesX = deckUniforms.uCloudTypes.value.x;
    const prevBand = veilMaterial.uniforms.uBand.value;
    if (!deckWas) deckUniforms.uCloudTypes.value.x = 0;
    if (!veilWas) veilMaterial.uniforms.uBand.value = 0;
    deck.visible = true;
    domes.visible = true;
    veil.visible = true;
    return () => {
      deckUniforms.uCloudTypes.value.x = prevTypesX;
      veilMaterial.uniforms.uBand.value = prevBand;
      deck.visible = deckWas;
      domes.visible = domesWas;
      veil.visible = veilWas;
    };
  });
}
