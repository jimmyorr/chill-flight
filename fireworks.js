// --- NIGHT FIREWORKS ---
// Deterministic world-scheduled night fireworks (#23):
// - Every night on the shared world clock (`state.worldClockNow`), one of the
//   world's ~8 curated market towns, harbors, and overlooks hosts an ~82-second
//   fireworks festival (rotating through all venues via a seeded shuffle-bag so
//   every player in a multiplayer room sees the exact same town light up at the
//   exact same time, visible from up to ~8.5 km away on the night horizon).
// - On New Year's Eve, New Year's Day, and July 4th (or with `?fireworks=1`),
//   every venue in the roster celebrates simultaneously.
// - Rendered in a single additive `InstancedBufferGeometry` draw call (`0` draw
//   calls when idle, zero per-frame CPU updates per star).
import * as THREE from 'three';
import {log} from './logger.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {
  FIREWORK_MODES,
  SHOW_DURATION_SEC,
  buildFireworkVenues,
  canRunFireworks,
  emitBurstSparks,
  emitLaunchSparks,
  isInsideFireworkShow,
  mixHash,
  mulberry32,
  nightClockState,
  planFireworkShow,
  resolveFireworksMode,
  scheduledVenuesForNight,
} from './fireworks-logic.js';
import {state} from './state.js';
import {MOUNTAIN_LEVEL, WATER_LEVEL} from './constants.js';
import {simplex} from './noise.js';
import {scene} from './scene.js';
import {skyUniforms} from './sky-uniforms.js';
import {camera, getCameraWorldPosition} from './sky.js';
import {planeGroup} from './airplane.js';
import {WIND_DIR_GLSL, getElevation, windUniforms} from './terrain-geometry.js';
import {playFireworkBurst, playFireworkLaunch} from './sfx-events.js';
import {Achievements} from './achievements.js';
import {
  isLightningFlashing,
  lightningLight,
  precipitation,
} from './weather-manager.js';

const POOL_SIZE = 4096;
const MAX_RENDER_DIST = 17500;
const MAX_RENDER_DIST_SQ = MAX_RENDER_DIST * MAX_RENDER_DIST;
const MAX_AUDIO_DIST = 5500;

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

      // Sub-pixel floor keeps horizon bursts visible ~8 km away without bloating
      float dist = -mv.z;
      float size = max(aTiming.w * 1.65, min(dist * 0.0044, 25.0));
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

      // Bright break flash, sustained glow, and long-range night-horizon reach
      float pop = 1.35 + 1.45 * exp(-age * 12.0);
      float fade = pow(1.0 - age, 1.25);
      float distFade = (1.0 - smoothstep(13000.0, 17500.0, dist))
        * mix(1.0, 0.58, smoothstep(2500.0, 11000.0, dist));
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

const _elevParams = {WATER_LEVEL, MOUNTAIN_LEVEL};
let _cachedVenueKey = '';
let _cachedVenues = [];

export function getFireworkVenues() {
  const seed = ChillFlightLogic.WORLD_SEED | 0;
  const key = `${seed}:${Boolean(ChillFlightLogic.XMAS)}`;
  if (key === _cachedVenueKey) return _cachedVenues;
  _cachedVenueKey = key;
  _cachedVenues = buildFireworkVenues(seed, {
    waterLevel: WATER_LEVEL,
    getElev: getElevation,
    highwayCrossing: ChillFlightLogic.highwayCrossing,
    townExists: (n, c) =>
      ChillFlightLogic.highwayRunsAt(n, c.z, simplex, _elevParams) &&
      ChillFlightLogic.highwayRunsAt(
        ChillFlightLogic.ROAD_EW,
        c.x,
        simplex,
        _elevParams
      ),
    fallsX: ChillFlightLogic.FALLS_X,
    fallsLipZ: ChillFlightLogic.FALLS_LIP_Z,
    xmasSite: ChillFlightLogic.XMAS
      ? ChillFlightLogic.xmasVillageSite(simplex, _elevParams)
      : null,
  });
  return _cachedVenues;
}

let simTime = 0;
let localCycleClock = 0;
let scheduledKey = '';
let scheduledShows = [];
let manualShow = null;
let manualAge = 0;
let loggedNightKey = '';

// Transient sky, harbor-water, and village-roof glow state
let glowLevel = 0;
const glowPos = new THREE.Vector3();
const glowColor = new THREE.Color(1, 0.8, 0.4);
let ownedLightLastFrame = false;

const _camPos = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _toBurst = new THREE.Vector3();
const _white = new THREE.Color(1, 1, 1);

function currentMode() {
  return resolveFireworksMode(
    ChillFlightLogic.WORLD_SEED,
    ChillFlightLogic.FIREWORKS_PARAM,
    ChillFlightLogic.TRAFFIC_PARAM
  );
}

function formatLatLon(x, z) {
  const lon = `${(Math.abs(x) / 5000).toFixed(2)} ${x >= 0 ? 'East' : 'West'}`;
  const lat = `${(Math.abs(z) / 5000).toFixed(2)} ${z <= 0 ? 'North' : 'South'}`;
  return `${lon}, ${lat}`;
}

function resetShowFlags(show) {
  show.caughtUp = false;
  for (let i = 0; i < show.shells.length; i++) {
    show.shells[i].launched = false;
    show.shells[i].burst = false;
  }
}

function ensureNightSchedule(nightIndex, mode) {
  const seed = ChillFlightLogic.WORLD_SEED | 0;
  const key = `${seed}:${nightIndex}:${mode}:${Boolean(ChillFlightLogic.XMAS)}`;
  if (key === scheduledKey) return;
  scheduledKey = key;

  const venues = getFireworkVenues();
  const entries = scheduledVenuesForNight(venues, seed, nightIndex, mode);
  scheduledShows = entries.map(({venue, timeOffset}) => {
    const show = planFireworkShow(venue, mode, seed, nightIndex, timeOffset);
    show.caughtUp = false;
    show.lastAge = -1;
    return show;
  });

  // In `?fireworks=1` mode, if the player is far from all 8 major venues, add a
  // local show ahead so testing from remote coordinates still shows fireworks
  if (mode === FIREWORK_MODES.FORCED) {
    getCameraWorldPosition(_camPos);
    const nearAny = venues.some(
      (v) =>
        (v.x - _camPos.x) * (v.x - _camPos.x) +
          (v.z - _camPos.z) * (v.z - _camPos.z) <
        3200 * 3200
    );
    if (!nearAny) {
      camera.getWorldDirection(_fwd);
      const hLen = Math.hypot(_fwd.x, _fwd.z) || 1;
      const lx = Math.round(_camPos.x + (_fwd.x / hLen) * 950);
      const lz = Math.round(_camPos.z + (_fwd.z / hLen) * 950);
      if (ChillFlightLogic.alienAt(lx, lz, simplex) <= 0.3) {
        const localSite = {
          id: 'local_forced',
          idHash: 0x7711aabb,
          name: 'Local bay',
          x: lx,
          y: Math.max(WATER_LEVEL + 1, getElevation(lx, lz)),
          z: lz,
          kind: 'shore',
        };
        const localShow = planFireworkShow(
          localSite,
          mode,
          seed,
          nightIndex,
          0
        );
        localShow.caughtUp = false;
        localShow.lastAge = -1;
        scheduledShows.push(localShow);
      }
    }
  }
}

// Returns tonight's scheduled venue(s) and clock state for inspection/testing.
export function tonightFireworkVenues() {
  const mode = currentMode();
  const nc = nightClockState(state.worldClockNow || Date.now());
  ensureNightSchedule(nc.nightIndex, mode);
  return {
    nightIndex: nc.nightIndex,
    showAge: nc.showAge,
    inWindow: nc.inWindow,
    venues: scheduledShows.map((s) => s.site),
  };
}

// Starts a manual fireworks show at `customSite` (or nearest venue) for testing.
export function startFireworkShow(customSite = null) {
  const seed = ChillFlightLogic.WORLD_SEED | 0;
  let site = customSite;
  if (!site) {
    getCameraWorldPosition(_camPos);
    const venues = getFireworkVenues();
    let bestD2 = Infinity;
    for (let i = 0; i < venues.length; i++) {
      const v = venues[i];
      const d2 =
        (v.x - _camPos.x) * (v.x - _camPos.x) +
        (v.z - _camPos.z) * (v.z - _camPos.z);
      if (d2 < bestD2) {
        bestD2 = d2;
        site = v;
      }
    }
  }
  if (!site) return false;
  const fullSite = {
    id: site.id || 'custom',
    idHash: site.idHash || 0x12345678,
    name: site.name || site.kind || 'Custom site',
    x: site.x,
    y: site.y ?? Math.max(WATER_LEVEL + 1, getElevation(site.x, site.z)),
    z: site.z,
    kind: site.kind || 'town',
  };
  manualShow = planFireworkShow(fullSite, FIREWORK_MODES.FORCED, seed, 0, 0);
  manualShow.caughtUp = true;
  manualAge = 0;
  return true;
}

export function activeFireworkShow() {
  if (manualShow) {
    return {
      site: manualShow.site,
      age: manualAge,
      duration: manualShow.duration,
    };
  }
  if (scheduledShows.length > 0) {
    const s = scheduledShows[0];
    return {
      site: s.site,
      age: s.lastAge >= 0 ? s.lastAge : 0,
      duration: s.duration,
    };
  }
  return null;
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

function stepSingleShow(show, age, seed) {
  const site = show.site;
  const dxCam = site.x - _camPos.x;
  const dzCam = site.z - _camPos.z;
  const camDistSq = dxCam * dxCam + dzCam * dzCam;
  if (camDistSq > MAX_RENDER_DIST_SQ) {
    show.caughtUp = false;
    return;
  }

  // If the show wrapped around in frozen-clock mode, reset its shell flags
  if (show.lastAge > age + 2.0) {
    resetShowFlags(show);
  }
  show.lastAge = age;

  const shells = show.shells;

  // Mid-show arrival / warp catch-up: mark old shells done without audio spam,
  // and back-date any stars from the last 4.5 s that are still hanging in the sky!
  if (!show.caughtUp) {
    show.caughtUp = true;
    if (age > 1.8) {
      for (let i = 0; i < shells.length; i++) {
        const sh = shells[i];
        if (sh.burstAt < age - 4.5) {
          sh.launched = true;
          sh.burst = true;
        } else if (sh.burstAt <= age) {
          sh.launched = true;
          sh.burst = true;
          const shellRng = mulberry32(
            mixHash(seed, show.nightIndex || 0, (site.idHash || 1) + i * 31)
          );
          emitBurstSparks(
            sh,
            simTime - (age - sh.burstAt),
            shellRng,
            writeSpark
          );
        } else if (sh.launchAt <= age) {
          sh.launched = true;
          const shellRng = mulberry32(
            mixHash(seed, show.nightIndex || 0, (site.idHash || 1) + i * 31 + 7)
          );
          emitLaunchSparks(
            sh,
            simTime - (age - sh.launchAt),
            shellRng,
            writeSpark
          );
        }
      }
    }
  }

  for (let i = 0; i < shells.length; i++) {
    const sh = shells[i];
    if (!sh.launched && age >= sh.launchAt) {
      sh.launched = true;
      const launchRng = mulberry32(
        mixHash(seed, show.nightIndex || 0, (site.idHash || 1) + i * 31 + 7)
      );
      emitLaunchSparks(sh, simTime, launchRng, writeSpark);
      _toBurst.set(sh.padX - _camPos.x, 0, sh.padZ - _camPos.z);
      const dist = _toBurst.length();
      if (dist < MAX_AUDIO_DIST) {
        const pan =
          dist > 1 ? _camRight.dot(_toBurst.multiplyScalar(1 / dist)) : 0;
        playFireworkLaunch(dist / MAX_AUDIO_DIST, false, pan);
      }
    }
    if (!sh.burst && age >= sh.burstAt) {
      sh.burst = true;
      const burstRng = mulberry32(
        mixHash(seed, show.nightIndex || 0, (site.idHash || 1) + i * 31)
      );
      emitBurstSparks(sh, simTime, burstRng, writeSpark);

      _toBurst.set(
        sh.burstX - _camPos.x,
        sh.burstY - _camPos.y,
        sh.burstZ - _camPos.z
      );
      const dist = _toBurst.length();

      // Update sky, harbor-water reflection, and ground glow if closer/brighter
      const curGlowDist = _camPos.distanceTo(glowPos);
      if (glowLevel < 0.08 || dist <= curGlowDist + 800) {
        const [r, g, b] = sh.palette.primary;
        glowPos.set(sh.burstX, sh.burstY, sh.burstZ);
        glowColor.setRGB(r, g, b);
        glowLevel = Math.min(1.0, glowLevel * 0.45 + 0.68 * (sh.scale || 1));
      }

      if (dist < MAX_AUDIO_DIST) {
        const pan =
          dist > 1 ? _camRight.dot(_toBurst.multiplyScalar(1 / dist)) : 0;
        playFireworkBurst(dist / MAX_AUDIO_DIST, sh.crackle, false, pan);
      }
    }
  }

  // Unlock 'grand_finale' when flying or driving right inside an active display
  if (!state.isFreeCamera && !state.isCrashed) {
    const p = planeGroup.position;
    if (isInsideFireworkShow(show, age, p.x, p.y, p.z)) {
      Achievements.unlock('grand_finale');
    }
  }
}

export function updateFireworks(delta) {
  const mode = currentMode();
  if (mode === FIREWORK_MODES.OFF && !manualShow) {
    if (mesh.visible || glowLevel > 0) {
      mesh.visible = false;
      clearGlow();
    }
    return;
  }

  if (state.isPaused || delta <= 0) return;

  simTime += delta;
  uniforms.uTime.value = simTime;

  const allowed = canRunFireworks({
    mode: manualShow ? FIREWORK_MODES.FORCED : mode,
    sunY: state.sunY ?? 1,
    rain: precipitation.rain || 0,
    snow: precipitation.snow || 0,
  });

  getCameraWorldPosition(_camPos);
  _camRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const seed = ChillFlightLogic.WORLD_SEED | 0;

  if (manualShow && allowed) {
    manualAge += delta;
    stepSingleShow(manualShow, manualAge, seed);
    if (manualAge >= manualShow.duration) {
      manualShow = null;
    }
  } else if (allowed) {
    const clockFrozen =
      state.manualTimeOfDay !== undefined || state.daySpeedMultiplier === 0;
    const nc = nightClockState(state.worldClockNow || Date.now());
    ensureNightSchedule(nc.nightIndex, mode);

    let inWindow = nc.inWindow;
    let age = nc.showAge;
    if (clockFrozen) {
      // When the player freezes time at night (`?tod=0.92&timeSpeed=0` or the
      // pause-menu slider), keep tonight's scheduled venue(s) cycling live!
      localCycleClock = (localCycleClock + delta) % SHOW_DURATION_SEC;
      inWindow = true;
      age = localCycleClock;
    }

    if (inWindow && scheduledShows.length > 0) {
      const logKey = `${nc.nightIndex}:${mode}`;
      if (logKey !== loggedNightKey) {
        loggedNightKey = logKey;
        const primary = scheduledShows[0].site;
        log.info(
          `[Fireworks] Night ${nc.nightIndex} show at ${primary.name} (${scheduledShows.length} active): X = ${primary.x}, Z = ${primary.z} (${formatLatLon(primary.x, primary.z)})`
        );
      }
      for (let i = 0; i < scheduledShows.length; i++) {
        stepSingleShow(scheduledShows[i], age, seed);
      }
    }
  }

  uploadSpawned();

  // Update transient colored sky, water, and village/pier illumination
  if (glowLevel > 0.003) {
    glowLevel *= Math.exp(-3.2 * delta);
    const camDist = _camPos.distanceTo(glowPos);
    const skyAtten = Math.exp(-camDist * 0.00014);
    const nearAtten = Math.exp(-camDist * 0.00045);

    skyUniforms.uFireworkPos.value.set(
      glowPos.x,
      glowPos.y,
      glowPos.z,
      glowLevel * skyAtten * 0.85
    );
    skyUniforms.uFireworkColor.value.copy(glowColor);

    if (lightningLight && !isLightningFlashing()) {
      _toBurst.subVectors(glowPos, _camPos);
      _toBurst.y = Math.max(120, Math.abs(_toBurst.y));
      _toBurst.normalize();
      lightningLight.position.copy(_toBurst);
      lightningLight.color.copy(glowColor).lerp(_white, 0.28);
      lightningLight.intensity = glowLevel * nearAtten * 0.36;
      ownedLightLastFrame = true;
    }
  } else if (glowLevel > 0) {
    clearGlow();
  }

  mesh.visible = simTime <= allDeadAt + 0.05 && Boolean(state._enableObjects);
}
