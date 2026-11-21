// --- NIGHT FIREWORKS ---
// Rare clear-night fireworks shows launching from loaded towns, villages, and
// coastal piers ahead in view (boosted on New Year's Eve/Day and July 4th, or
// forced on via `?fireworks=1`).
//
// Rendered in a single additive `InstancedBufferGeometry` draw call: each
// rising mortar comet and burst star is written once to a ring buffer on the
// CPU, while the vertex shader integrates air drag, gravity, breeze drift, and
// velocity-aligned motion-blur tails at zero per-frame CPU cost. When idle,
// `mesh.visible = false` (zero draw calls).
import * as THREE from 'three';
import {log} from './logger.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {
  FIREWORK_MODES,
  canRunFireworks,
  emitBurstSparks,
  emitLaunchSparks,
  isInsideFireworkShow,
  nextFireworksWait,
  pickFireworkSite,
  planFireworkShow,
  resolveFireworksMode,
} from './fireworks-logic.js';
import {state} from './state.js';
import {MOUNTAIN_LEVEL, WATER_LEVEL} from './constants.js';
import {simplex} from './noise.js';
import {scene} from './scene.js';
import {skyUniforms} from './sky-uniforms.js';
import {camera, getCameraWorldPosition} from './sky.js';
import {planeGroup} from './airplane.js';
import {
  WIND_DIR_GLSL,
  chunks,
  getElevation,
  windUniforms,
} from './terrain-geometry.js';
import {playFireworkBurst, playFireworkLaunch} from './sfx-events.js';
import {Achievements} from './achievements.js';
import {
  isLightningFlashing,
  lightningLight,
  precipitation,
} from './weather-manager.js';

const POOL_SIZE = 3072;
const MAX_AUDIO_DIST = 3800;

const geometry = new THREE.InstancedBufferGeometry();
const quad = new THREE.PlaneGeometry(1, 1);
geometry.index = quad.index;
geometry.setAttribute('position', quad.attributes.position);
geometry.setAttribute('uv', quad.attributes.uv);
geometry.instanceCount = POOL_SIZE;

function makePoolAttr(name, itemSize) {
  const attr = new THREE.InstancedBufferAttribute(
    new Float32Array(POOL_SIZE * itemSize),
    itemSize
  );
  attr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute(name, attr);
  return attr;
}

const aStart = makePoolAttr('aStart', 3); // world x, y, z
const aVel = makePoolAttr('aVel', 4); // vx, vy, vz, drag
const aTiming = makePoolAttr('aTiming', 4); // birthTime, lifetime, gravity, size
const aStyle = makePoolAttr('aStyle', 4); // r, g, b, signed streak (<0 = crackle strobe)
const attributes = [aStart, aVel, aTiming, aStyle];

for (let i = 0; i < POOL_SIZE; i++) {
  aTiming.array[i * 4 + 1] = -1;
}

const uniforms = {
  uTime: {value: 0},
  uWindStrength: windUniforms.uWindStrength,
};

const material = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  fog: false,
  vertexShader: /* glsl */ `
    attribute vec3 aStart;
    attribute vec4 aVel;
    attribute vec4 aTiming;
    attribute vec4 aStyle;
    uniform float uTime;
    uniform float uWindStrength;
    varying vec2 vUv;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vTwinkle;

    void main() {
      float t = uTime - aTiming.x;
      float life = aTiming.y;
      float age = t / max(life, 0.001);
      if (life <= 0.0 || age < 0.0 || age > 1.0) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        vAlpha = 0.0;
        return;
      }

      float drag = max(aVel.w, 0.08);
      float expD = exp(-drag * t);
      float carried = (1.0 - expD) / drag;
      vec3 p = aStart + aVel.xyz * carried;
      p.y -= 0.5 * aTiming.z * t * t;

      // Gentle downwind drift as stars slow down in the night breeze
      vec3 wind = ${WIND_DIR_GLSL} * (5.5 * uWindStrength);
      p += wind * (t - carried) * 0.38;

      vec4 mv = viewMatrix * vec4(p, 1.0);
      if (mv.z > -0.5) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        vAlpha = 0.0;
        return;
      }

      vec3 v = aVel.xyz * expD + vec3(0.0, -aTiming.z * t, 0.0);
      vec3 mvVel = mat3(viewMatrix) * v;
      float spd2D = length(mvVel.xy);
      vec2 dir2D = spd2D > 0.02 ? mvVel.xy / spd2D : vec2(0.0, 1.0);
      vec2 perp2D = vec2(dir2D.y, -dir2D.x);

      // Keep distant bursts crisp and sub-pixel-free across bays and valleys
      float dist = -mv.z;
      float size = max(aTiming.w * 1.65, dist * 0.0048);
      float streak = abs(aStyle.w);
      float tailLen = streak < 0.5
        ? size
        : size + min(spd2D * 0.12 * streak, size * 9.5) * (1.0 - age * 0.42);

      float w = position.y + 0.5;
      float along = mix(-(tailLen - size * 0.5), size * 0.5, w);
      mv.xy += perp2D * (position.x * size) + dir2D * along;
      gl_Position = projectionMatrix * mv;

      vUv = uv;
      vColor = aStyle.rgb;

      // Bright initial break pop, sustained glow, smooth ember fade, and soft far-haze
      float pop = 1.35 + 1.45 * exp(-age * 12.0);
      float fade = pow(1.0 - age, 1.25);
      float distFade = exp(-dist * 0.00016);
      vAlpha = pop * fade * distFade;

      // Late-life sparkle/crackle strobe on willow and crackle shells
      float phase = fract(sin(dot(aStart, vec3(12.9898, 78.233, 37.719))) * 43758.5453) * 6.2832;
      vTwinkle = aStyle.w < 0.0 && age > 0.34
        ? 0.45 + 0.75 * smoothstep(0.15, 0.85, 0.5 + 0.5 * sin(t * 38.0 + phase))
        : 1.0;
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vTwinkle;

    void main() {
      if (vAlpha <= 0.002) discard;
      float x = (vUv.x - 0.5) * 2.0;
      float edgeMask = max(0.0, 1.0 - x * x)
        * smoothstep(0.0, 0.14, vUv.y)
        * (1.0 - smoothstep(0.86, 1.0, vUv.y));
      if (edgeMask <= 0.001) discard;

      vec2 hc = vec2(x, (vUv.y - 0.78) * 3.0);
      float headCore = exp(-dot(hc, hc) * 3.8);
      float ribbon = exp(-x * x * 4.8) * pow(vUv.y, 1.15);
      float shape = max(headCore, ribbon * 0.82) * edgeMask;
      float a = shape * vAlpha * vTwinkle;
      if (a < 0.003) discard;

      // Incandescent white-gold star core surrounded by rich shell pigment
      vec3 col = mix(vColor, vec3(1.0, 0.97, 0.88), headCore * 0.7);
      gl_FragColor = vec4(col * a, 1.0);
    }
  `,
});

const mesh = new THREE.Mesh(geometry, material);
mesh.name = 'fireworks';
mesh.frustumCulled = false;
mesh.raycast = () => {};
mesh.renderOrder = 4;
mesh.visible = false;
scene.add(mesh);

let cursor = 0;
let spawnedFrom = 0;
let spawnedCount = 0;
let allDeadAt = 0;

function writeSpark(
  x,
  y,
  z,
  vx,
  vy,
  vz,
  drag,
  birth,
  life,
  gravity,
  size,
  r,
  g,
  b,
  style
) {
  const i = cursor;
  cursor = (cursor + 1) % POOL_SIZE;
  if (spawnedCount === 0) spawnedFrom = i;
  spawnedCount = Math.min(POOL_SIZE, spawnedCount + 1);

  const s = aStart.array;
  const i3 = i * 3;
  s[i3] = x;
  s[i3 + 1] = y;
  s[i3 + 2] = z;

  const i4 = i * 4;
  const v = aVel.array;
  v[i4] = vx;
  v[i4 + 1] = vy;
  v[i4 + 2] = vz;
  v[i4 + 3] = drag;

  const tm = aTiming.array;
  tm[i4] = birth;
  tm[i4 + 1] = life;
  tm[i4 + 2] = gravity;
  tm[i4 + 3] = size;

  const st = aStyle.array;
  st[i4] = r;
  st[i4 + 1] = g;
  st[i4 + 2] = b;
  st[i4 + 3] = style;

  allDeadAt = Math.max(allDeadAt, birth + life);
}

function uploadSpawned() {
  if (spawnedCount === 0) return;
  const wraps = spawnedFrom + spawnedCount > POOL_SIZE;
  for (let k = 0; k < attributes.length; k++) {
    const attr = attributes[k];
    attr.clearUpdateRanges();
    if (wraps) {
      attr.addUpdateRange(0, POOL_SIZE * attr.itemSize);
    } else {
      attr.addUpdateRange(
        spawnedFrom * attr.itemSize,
        spawnedCount * attr.itemSize
      );
    }
    attr.needsUpdate = true;
  }
  spawnedCount = 0;
}

// Local PRNG seeded from WORLD_SEED so ambient randomness never perturbs other systems
let _rngState = ((ChillFlightLogic.WORLD_SEED | 0) ^ 0x5f3759df) >>> 0;
function nextRng() {
  _rngState |= 0;
  _rngState = (_rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(_rngState ^ (_rngState >>> 15), 1 | _rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

let simTime = 0;
let activeShow = null;
let showAge = 0;
let waitTimer = -1;
let initializedMode = null;

// Transient sky/water/ground burst illumination state
let glowLevel = 0;
const glowPos = new THREE.Vector3();
const glowColor = new THREE.Color(1, 0.8, 0.4);
let ownedLightLastFrame = false;

const _camPos = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _toBurst = new THREE.Vector3();
const _white = new THREE.Color(1, 1, 1);
const _candidateSites = [];
const _viewer = {x: 0, z: 0, fx: 0, fz: -1};
const _elevParams = {WATER_LEVEL, MOUNTAIN_LEVEL};

function currentMode() {
  return resolveFireworksMode(
    ChillFlightLogic.WORLD_SEED,
    ChillFlightLogic.FIREWORKS_PARAM,
    ChillFlightLogic.TRAFFIC_PARAM
  );
}

function gatherCandidateSites() {
  _candidateSites.length = 0;
  for (const group of chunks.values()) {
    const sites = group.userData.fireworkSites;
    if (!sites) continue;
    for (let i = 0; i < sites.length; i++) {
      _candidateSites.push(sites[i]);
    }
  }
  if (ChillFlightLogic.XMAS) {
    const xmas = ChillFlightLogic.xmasVillageSite(simplex, _elevParams);
    if (xmas) {
      _candidateSites.push({
        x: xmas.x,
        y: Math.max(WATER_LEVEL + 1, getElevation(xmas.x, xmas.z)),
        z: xmas.z,
        kind: 'town',
      });
    }
  }
  return _candidateSites;
}

function computeViewer() {
  if (state.isFreeCamera) {
    getCameraWorldPosition(_camPos);
    camera.getWorldDirection(_fwd);
    _viewer.x = _camPos.x;
    _viewer.z = _camPos.z;
    _viewer.fx = _fwd.x;
    _viewer.fz = _fwd.z;
  } else {
    const p = planeGroup.position;
    _fwd.set(0, 0, -1).applyQuaternion(planeGroup.quaternion);
    _viewer.x = p.x;
    _viewer.z = p.z;
    _viewer.fx = _fwd.x;
    _viewer.fz = _fwd.z;
  }
  return _viewer;
}

function formatLatLon(x, z) {
  const lon = `${(Math.abs(x) / 5000).toFixed(2)} ${x >= 0 ? 'East' : 'West'}`;
  const lat = `${(Math.abs(z) / 5000).toFixed(2)} ${z <= 0 ? 'North' : 'South'}`;
  return `${lon}, ${lat}`;
}

// Starts a night fireworks show at `customSite` or at the best loaded town,
// village, or coastal pier ahead in view. Returns true if a show started.
export function startFireworkShow(customSite = null) {
  const mode = currentMode();
  const viewer = computeViewer();
  let site = customSite;

  if (!site) {
    const candidates = gatherCandidateSites();
    site = pickFireworkSite(candidates, viewer, nextRng);
  }
  if (!site && (mode === FIREWORK_MODES.FORCED || customSite === undefined)) {
    // Fallback spot ahead on clear land/coast when `?fireworks=1` is used away from towns
    const fLen = Math.hypot(viewer.fx, viewer.fz) || 1;
    const fx = viewer.fx / fLen;
    const fz = viewer.fz / fLen;
    const sx = viewer.x + fx * 920;
    const sz = viewer.z + fz * 920;
    if (ChillFlightLogic.alienAt(sx, sz, simplex) <= 0.3) {
      site = {
        x: sx,
        y: Math.max(WATER_LEVEL + 1, getElevation(sx, sz)),
        z: sz,
        kind: 'shore',
      };
    }
  }
  if (!site) return false;

  activeShow = planFireworkShow(
    site,
    mode === FIREWORK_MODES.OFF ? FIREWORK_MODES.FORCED : mode,
    nextRng
  );
  showAge = 0;
  log.info(
    `[Fireworks] Show started (${site.kind}): X = ${site.x.toFixed(0)}, Z = ${site.z.toFixed(0)} (${formatLatLon(site.x, site.z)})`
  );
  return true;
}

export function activeFireworkShow() {
  if (!activeShow) return null;
  return {
    site: activeShow.site,
    age: showAge,
    duration: activeShow.duration,
  };
}

function clearGlow() {
  glowLevel = 0;
  skyUniforms.uFireworkPos.value.w = 0;
  if (ownedLightLastFrame && lightningLight && !isLightningFlashing()) {
    lightningLight.intensity = 0;
    lightningLight.color.setHex(0xe0e0ff);
  }
  ownedLightLastFrame = false;
}

export function updateFireworks(delta) {
  const mode = currentMode();
  if (initializedMode !== mode) {
    initializedMode = mode;
    waitTimer = nextFireworksWait(mode, true, nextRng);
  }

  if (mode === FIREWORK_MODES.OFF) {
    if (activeShow || mesh.visible || glowLevel > 0) {
      activeShow = null;
      mesh.visible = false;
      clearGlow();
    }
    return;
  }

  if (state.isPaused || delta <= 0) return;

  simTime += delta;
  uniforms.uTime.value = simTime;

  const allowed = canRunFireworks({
    mode,
    sunY: state.sunY ?? 1,
    rain: precipitation.rain || 0,
    snow: precipitation.snow || 0,
  });

  if (!activeShow) {
    if (allowed) {
      waitTimer -= delta;
      if (waitTimer <= 0) {
        const started = startFireworkShow(null);
        waitTimer = started
          ? nextFireworksWait(mode, false, nextRng)
          : mode === FIREWORK_MODES.FORCED
            ? 2.5
            : 8.0;
      }
    }
  } else {
    showAge += delta;
    getCameraWorldPosition(_camPos);
    _camRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();

    const shells = activeShow.shells;
    for (let i = 0; i < shells.length; i++) {
      const sh = shells[i];
      if (!sh.launched && showAge >= sh.launchAt) {
        sh.launched = true;
        if (allowed) {
          emitLaunchSparks(sh, simTime, nextRng, writeSpark);
          _toBurst.set(sh.padX - _camPos.x, 0, sh.padZ - _camPos.z);
          const dist = _toBurst.length();
          if (dist < MAX_AUDIO_DIST) {
            const pan =
              dist > 1 ? _camRight.dot(_toBurst.multiplyScalar(1 / dist)) : 0;
            playFireworkLaunch(dist / MAX_AUDIO_DIST, false, pan);
          }
        }
      }
      if (!sh.burst && showAge >= sh.burstAt) {
        sh.burst = true;
        if (allowed) {
          emitBurstSparks(sh, simTime, nextRng, writeSpark);

          // Pulse sky, harbor-water reflection, and ground glow in the shell's primary hue
          const [r, g, b] = sh.palette.primary;
          glowPos.set(sh.burstX, sh.burstY, sh.burstZ);
          glowColor.setRGB(r, g, b);
          glowLevel = Math.min(1.0, glowLevel * 0.45 + 0.65 * (sh.scale || 1));

          _toBurst.set(
            sh.burstX - _camPos.x,
            sh.burstY - _camPos.y,
            sh.burstZ - _camPos.z
          );
          const dist = _toBurst.length();
          if (dist < MAX_AUDIO_DIST) {
            const pan =
              dist > 1 ? _camRight.dot(_toBurst.multiplyScalar(1 / dist)) : 0;
            playFireworkBurst(dist / MAX_AUDIO_DIST, sh.crackle, false, pan);
          }
        }
      }
    }

    // Check 'grand_finale' achievement when flying/driving right inside the show
    if (!state.isFreeCamera && !state.isCrashed) {
      const p = planeGroup.position;
      if (isInsideFireworkShow(activeShow, showAge, p.x, p.y, p.z)) {
        Achievements.unlock('grand_finale');
      }
    }

    if (showAge >= activeShow.duration || !allowed) {
      activeShow = null;
      waitTimer = nextFireworksWait(mode, false, nextRng);
    }
  }

  uploadSpawned();

  // Update transient colored sky, water, and village/pier illumination
  if (glowLevel > 0.003) {
    glowLevel *= Math.exp(-3.4 * delta);
    getCameraWorldPosition(_camPos);
    const camDist = _camPos.distanceTo(glowPos);
    const distAtten = Math.exp(-camDist * 0.00045);
    const effGlow = glowLevel * distAtten;

    skyUniforms.uFireworkPos.value.set(
      glowPos.x,
      glowPos.y,
      glowPos.z,
      effGlow * 0.85
    );
    skyUniforms.uFireworkColor.value.copy(glowColor);

    if (lightningLight && !isLightningFlashing()) {
      _toBurst.subVectors(glowPos, _camPos);
      _toBurst.y = Math.max(120, Math.abs(_toBurst.y));
      _toBurst.normalize();
      lightningLight.position.copy(_toBurst);
      lightningLight.color.copy(glowColor).lerp(_white, 0.28);
      lightningLight.intensity = effGlow * 0.36;
      ownedLightLastFrame = true;
    }
  } else if (glowLevel > 0) {
    clearGlow();
  }

  mesh.visible = simTime <= allDeadAt + 0.05 && Boolean(state._enableObjects);
}
