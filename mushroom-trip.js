// --- KNOCKED MUSHROOMS SLOWLY TURN THE SKY COSMIC AND SWELL THE MOON ---
// Knocking over one of the eastern alien mushrooms (breakables.js) throws
// out a cloud of glowing spores at its stump, and when it's the player who
// hit it, a slow, uncanny transition unfolds over the next minute and a half
// to two minutes (stronger and longer for the giants, and stacking smoothly
// across a grove): the upper sky gradually deepens over ~22 s into cosmic
// indigo-violet over a twilight haze as aurora curtains, stars and the Milky
// Way materialize even by day, the cloud layers curl across each other, and
// the moon swells glacially over ~42 s to ~6x-8.5x its normal size while its
// sunlit phase creeps slowly across its craters (~2.5 min per lunar cycle),
// before melting gently back to normal.
//
// It costs nothing on phones: no extra pass, shader or allocations, just
// existing sky, light and moon uniforms nudged before the frame is drawn
// (applyTrip) and restored straight after (restoreTrip), so the day/night
// code underneath never sees them and a longer trip has zero runtime cost.
import * as THREE from 'three';
import {scene} from './scene.js';
import {state} from './state.js';
import {moonlightUniforms, terrainUniforms} from './constants.js';
import {
  dirLight,
  hemiLight,
  moonMesh,
  moonUniforms,
  skyUniforms,
  starsMat,
} from './sky.js';

// Decoupled, unhurried timelines (s): the sky deepens over ~22 s so the moon
// is clearly visible while it is still modest in size, and the moon itself
// takes ~42 s to swell to full scale, holds, and eases back over ~30 s
// (~98 s total for a small mushroom up to ~135 s for a giant)
const SKY_RAMP_IN = 22;
const MOON_RAMP_IN = 42;
const ACTIVE_SMALL = 68;
const ACTIVE_GIANT = 105;
const SKY_FADE_OUT = 24;
const MOON_FADE_OUT = 30;
// Peak strength for a single small mushroom (0) up to a giant (1); knocking
// more mushrooms while tripping stacks +STACK_GAIN smoothly toward 1
const PEAK_SMALL = 0.68;
const STACK_GAIN = 0.24;
// Default moon scale multiplier at full trip (a = 1): ~6x on a single small
// mushroom (a ~ 0.68) up to 8.5x on a giant or stacked grove; ?tripMoon=N
// lets you experiment with 5x, 10x, etc. directly from the URL
const DEFAULT_MOON_GROW = 8.5;
// Extra cloud/aurora flow speed at full trip (~3.4x normal 1x cloudTime,
// integrated smoothly so starting or ending never jumps the clouds)
const CLOUD_DRIFT_GAIN = 2.4;
const CLOUD_MORPH_X = 0.14;
const CLOUD_MORPH_Y = 0.11;
const CLOUD_MORPH_Z = 0.09;
const MOON_PHASE_RATE = 0.042; // ~150 s (2.5 min) per full lunar cycle (~2.4 deg/s)
const MOON_TILT_RATE = 0.05; // ~126 s glacial libration breath
const MOON_BASE_ANG_RAD = (440 * 1.827) / 27500; // ~1.68 deg normal radius
const PHASE_CYCLE_MS = 29.5 * 360000;

const _urlParams =
  typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
const _rawTrip = _urlParams?.get('trip');
// ?trip=1 (or ?trip=0.7) holds a trip at that strength for testing anywhere
const FOREVER_STRENGTH =
  _rawTrip === null || _rawTrip === undefined || _rawTrip === ''
    ? 0
    : _rawTrip === '0' || _rawTrip === 'false' || _rawTrip === 'off'
      ? 0
      : Number.isFinite(Number(_rawTrip))
        ? THREE.MathUtils.clamp(Number(_rawTrip), 0, 1)
        : 1;
const _rawTripMoon = parseFloat(_urlParams?.get('tripMoon') ?? '');
const MOON_GROW = Number.isFinite(_rawTripMoon)
  ? THREE.MathUtils.clamp(_rawTripMoon, 1, 15)
  : DEFAULT_MOON_GROW;

function makeChannel() {
  return {val: 0, from: 0, target: 0, age: 0, dur: 1, mode: 'idle'};
}

function rampChannel(ch, target, fullDur) {
  if (target > ch.val + 0.005) {
    ch.from = ch.val;
    ch.target = target;
    ch.dur = fullDur * (0.45 + 0.55 * (target - ch.val));
    ch.age = 0;
    ch.mode = 'ramp';
  } else {
    ch.target = Math.max(ch.target, target);
    if (ch.mode === 'fade') {
      ch.from = ch.val;
      ch.dur = fullDur * 0.5;
      ch.age = 0;
      ch.mode = 'ramp';
    } else if (ch.mode === 'idle') {
      ch.val = target;
      ch.mode = 'hold';
    }
  }
}

function beginFadeChannel(ch, fadeDur) {
  if (ch.mode === 'idle' || ch.mode === 'fade') return;
  ch.from = ch.val;
  ch.dur = fadeDur;
  ch.age = 0;
  ch.mode = 'fade';
}

function stepChannel(ch, delta) {
  if (ch.mode === 'ramp') {
    ch.age += delta;
    const u = THREE.MathUtils.clamp(ch.age / ch.dur, 0, 1);
    // Cubic smoothstep (max slope 1.5x linear, gentler than smootherstep's
    // 2.19x) so the middle of the moon's 42 s swell stays slow and steady
    const s = u * u * (3 - 2 * u);
    ch.val = THREE.MathUtils.lerp(ch.from, ch.target, s);
    if (ch.age >= ch.dur) {
      ch.val = ch.target;
      ch.mode = 'hold';
    }
  } else if (ch.mode === 'fade') {
    ch.age += delta;
    const u = THREE.MathUtils.clamp(ch.age / ch.dur, 0, 1);
    const s = u * u * (3 - 2 * u);
    ch.val = ch.from * (1 - s);
    if (ch.age >= ch.dur || ch.val <= 0.0005) {
      ch.val = 0;
      ch.target = 0;
      ch.mode = 'idle';
    }
  }
}

const skyCh = makeChannel();
const moonCh = makeChannel();
let peak = 0;
let activeLeft = 0;
// Continuous phase clock (s) and initial lunar phase anchor
let clock = 0;
let phaseStartAngle = 0;

/** 0-1 how strong the sky trip is now (0 when not tripping). */
export function tripAmount() {
  return FOREVER_STRENGTH > 0 ? FOREVER_STRENGTH : skyCh.val;
}

/** 0-1 how far the moon swell has progressed (ramps slower than the sky). */
export function tripMoonAmount() {
  return FOREVER_STRENGTH > 0 ? FOREVER_STRENGTH : moonCh.val;
}

/** Starts (or stacks smoothly onto) a trip: `size` 0-1 from small to giant. */
export function startTrip(size) {
  const s = THREE.MathUtils.clamp(size, 0, 1);
  const hitPeak = THREE.MathUtils.lerp(PEAK_SMALL, 1, Math.pow(s, 0.6));
  const nextActive = THREE.MathUtils.lerp(ACTIVE_SMALL, ACTIVE_GIANT, s);
  const idle = skyCh.val <= 0.001 && moonCh.val <= 0.001;

  if (idle) {
    const worldNow = state.worldClockNow || 0;
    phaseStartAngle =
      ((worldNow % PHASE_CYCLE_MS) / PHASE_CYCLE_MS) * Math.PI * 2;
    clock = 0;
    peak = hitPeak;
    activeLeft = nextActive;
    skyCh.val = 0;
    moonCh.val = 0;
    rampChannel(skyCh, peak, SKY_RAMP_IN);
    rampChannel(moonCh, peak, MOON_RAMP_IN);
  } else {
    const liveBase = Math.max(skyCh.val, moonCh.val);
    peak = Math.min(
      1,
      Math.max(peak, liveBase + STACK_GAIN * (0.55 + 0.45 * s), hitPeak)
    );
    activeLeft = Math.max(activeLeft, nextActive);
    rampChannel(skyCh, peak, SKY_RAMP_IN);
    rampChannel(moonCh, peak, MOON_RAMP_IN);
  }
}

/** Per frame: advances the sky and moon envelopes and cloud/aurora drift. */
export function updateTrip(delta) {
  if (state.isPaused || delta <= 0) return;

  if (FOREVER_STRENGTH > 0) {
    clock += delta;
    if (typeof state.cloudTime === 'number') {
      state.cloudTime += delta * CLOUD_DRIFT_GAIN * FOREVER_STRENGTH;
    }
    return;
  }

  if (skyCh.mode === 'idle' && moonCh.mode === 'idle') return;

  clock += delta;
  if (activeLeft > 0) {
    activeLeft -= delta;
    if (activeLeft <= 0) {
      activeLeft = 0;
      beginFadeChannel(skyCh, SKY_FADE_OUT);
      beginFadeChannel(moonCh, MOON_FADE_OUT);
    }
  }

  stepChannel(skyCh, delta);
  stepChannel(moonCh, delta);

  if (skyCh.val > 0 && typeof state.cloudTime === 'number') {
    state.cloudTime += delta * CLOUD_DRIFT_GAIN * skyCh.val;
  }
}

// Palette targets & saved state restored right after renderFrame in restoreTrip()
const _cosmicZenith = new THREE.Color(0x100b30);
const _cosmicHorizon = new THREE.Color(0x28386e);
const _skyHemiTint = new THREE.Color(0x9a78ff);
const _groundHemiTint = new THREE.Color(0x28e0d0);
const _sunWarmTint = new THREE.Color(0xffb8e6);

const _savedTop = new THREE.Color();
const _savedBottom = new THREE.Color();
const _savedFog = new THREE.Color();
const _savedTerrainTop = new THREE.Color();
const _savedTerrainBottom = new THREE.Color();
const _savedDirColor = new THREE.Color();
const _savedHemiColor = new THREE.Color();
const _savedHemiGround = new THREE.Color();
const _savedCloudTypes = new THREE.Vector3();
const _targetClouds = new THREE.Vector3();

const _savedMoonPos = new THREE.Vector3();
const _savedMoonScale = new THREE.Vector3();
const _savedMoonQuat = new THREE.Quaternion();
const _savedMoonRotMat = new THREE.Matrix3();
const _savedMoonSkyDir = new THREE.Vector3();
const _savedMoonLightDir = new THREE.Vector3();
const _savedMoonSunDir = new THREE.Vector3();
const _moonDir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _vX = new THREE.Vector3();
const _vY = new THREE.Vector3();
const _vZ = new THREE.Vector3();
const _rX = new THREE.Vector3();
const _rY = new THREE.Vector3();
const _mRot = new THREE.Matrix4();
const _driftedSun = new THREE.Vector3();

let applied = false;
let appliedMoon = false;
let _savedAurora = 0;
let _savedMilkyWay = 0;
let _savedStarsOpacity = 0;
let _savedStarsVisible = false;
let _savedMoonDayFactor = 1;
let _savedMoonBright = 0;
let _savedMoonCos = 0.9995;

/** Before the frame is drawn: nudges sky, clouds, aurora, stars, lights, and moon. */
export function applyTrip() {
  const aSky = tripAmount();
  const aMoon = tripMoonAmount();
  const aAny = Math.max(aSky, aMoon);
  if (aAny <= 0.001 || !skyUniforms) return;
  applied = true;
  appliedMoon = false;

  const overcast = skyUniforms.uCloudDensity?.value ?? 0;
  const clearSky = Math.max(0.15, 1 - overcast * 0.7);
  const day = THREE.MathUtils.clamp(state.dayFactor ?? 1, 0, 1);

  // 1. Slowly pull the upper sky into cosmic indigo-violet and cool the
  // horizon haze partway toward twilight over ~22 s so aurora ribbons, stars
  // and the Milky Way emerge gradually even in midday sun
  _savedTop.copy(skyUniforms.topColor.value);
  _savedBottom.copy(skyUniforms.bottomColor.value);
  _savedFog.copy(scene.fog.color);
  _savedTerrainTop.copy(terrainUniforms.uTopColor.value);
  _savedTerrainBottom.copy(terrainUniforms.uBottomColor.value);

  skyUniforms.topColor.value.lerp(_cosmicZenith, aSky * (0.48 + 0.34 * day));
  const horizonPull = aSky * (0.18 + 0.18 * day);
  skyUniforms.bottomColor.value.lerp(_cosmicHorizon, horizonPull);
  scene.fog.color.lerp(_cosmicHorizon, horizonPull * 0.85);
  terrainUniforms.uTopColor.value.copy(skyUniforms.topColor.value);
  terrainUniforms.uBottomColor.value.copy(skyUniforms.bottomColor.value);

  // Subtle bioluminescent violet/cyan cast on ambient sky & ground bounce light
  _savedDirColor.copy(dirLight.color);
  _savedHemiColor.copy(hemiLight.color);
  _savedHemiGround.copy(hemiLight.groundColor);
  dirLight.color.lerp(_sunWarmTint, 0.14 * aSky);
  hemiLight.color.lerp(_skyHemiTint, 0.32 * aSky);
  hemiLight.groundColor.lerp(_groundHemiTint, 0.3 * aSky);

  // 2. Slow cloud curl between cumulus, cirrus streaks and mackerel rows
  _savedCloudTypes.copy(skyUniforms.uCloudTypes.value);
  _targetClouds.set(
    0.72 + 0.45 * Math.cos(clock * CLOUD_MORPH_X),
    0.85 + 0.45 * Math.sin(clock * CLOUD_MORPH_Y),
    0.95 + 0.5 * Math.sin(clock * CLOUD_MORPH_Z - 0.8)
  );
  skyUniforms.uCloudTypes.value.lerp(_targetClouds, 0.85 * aSky);

  // 3. Vivid 360-degree aurora curtains + daytime stars & Milky Way overhead.
  // sky.frag.glsl raises uAuroraIntensity to the 0.3 power, so raising `aSky`
  // to 2.8 cancels that compression and makes the aurora creep in gradually.
  _savedAurora = skyUniforms.uAuroraIntensity.value;
  _savedMilkyWay = skyUniforms.uMilkyWay.value;
  _savedStarsOpacity = starsMat.opacity;
  _savedStarsVisible = starsMat.visible;

  skyUniforms.uAuroraIntensity.value = Math.max(
    _savedAurora,
    1.35 * Math.pow(aSky, 2.8) * clearSky
  );
  const starBleed =
    0.92 * Math.pow(aSky, 1.35) * Math.max(0, 1 - overcast * 1.1);
  starsMat.opacity = Math.max(_savedStarsOpacity, starBleed);
  starsMat.visible = starsMat.opacity > 0.001;
  skyUniforms.uMilkyWay.value = Math.max(_savedMilkyWay, starBleed);

  // 4. Colossal megamoon (~6x to 8.5x): unveils alongside the darkening sky
  // (`aAny`) so you see it early while still modest, while its scale and
  // horizon-clearing lift swell glacially over ~42 s (`aMoon`) and its sunlit
  // phase creeps at ~150 s per lunar cycle
  if (
    moonMesh &&
    moonMesh.material &&
    moonMesh.position.lengthSq() > 1 &&
    state.moonY > -0.12
  ) {
    appliedMoon = true;
    _savedMoonPos.copy(moonMesh.position);
    _savedMoonScale.copy(moonMesh.scale);
    _savedMoonQuat.copy(moonMesh.quaternion);
    _savedMoonRotMat.copy(moonUniforms.uMoonRotMat.value);
    _savedMoonSkyDir.copy(moonUniforms.uMoonSkyDir.value);
    _savedMoonLightDir.copy(moonlightUniforms.uMoonDir.value);
    _savedMoonSunDir.copy(moonUniforms.uSunDirectionWorld.value);
    _savedMoonDayFactor = moonUniforms.dayFactor.value;
    _savedMoonBright = moonlightUniforms.uMoonBright.value;
    _savedMoonCos = moonlightUniforms.uMoonCos.value;

    const grow = 1 + (MOON_GROW - 1) * aMoon;
    const angR = MOON_BASE_ANG_RAD * grow;

    const orbitR = _savedMoonPos.length();
    _moonDir.copy(_savedMoonPos).divideScalar(orbitR);
    const peakCenterY = Math.max(
      _moonDir.y,
      Math.min(0.44, MOON_BASE_ANG_RAD * MOON_GROW + 0.075)
    );
    if (peakCenterY > _moonDir.y) {
      const targetY = THREE.MathUtils.lerp(_moonDir.y, peakCenterY, aMoon);
      const horiz = Math.hypot(_moonDir.x, _moonDir.z) || 1;
      const newHoriz = Math.sqrt(Math.max(0.01, 1 - targetY * targetY));
      _moonDir.x *= newHoriz / horiz;
      _moonDir.z *= newHoriz / horiz;
      _moonDir.y = targetY;
      moonMesh.position.copy(_moonDir).multiplyScalar(orbitR);
    }

    moonUniforms.uMoonSkyDir.value.copy(_moonDir);
    moonlightUniforms.uMoonDir.value.copy(_moonDir);
    moonlightUniforms.uMoonCos.value = Math.cos(Math.min(0.6, angR));

    // Unveil crater contrast alongside the sky so you watch the moon grow
    moonUniforms.dayFactor.value = THREE.MathUtils.lerp(
      _savedMoonDayFactor,
      0.0,
      Math.pow(aAny, 0.85)
    );
    const sXY = _savedMoonScale.x * grow;
    moonMesh.scale.set(sXY, sXY, 1.0);
    moonlightUniforms.uMoonBright.value = Math.max(
      _savedMoonBright,
      0.75 * aMoon * clearSky
    );

    _vZ.copy(_moonDir).negate();
    _vX.crossVectors(_up, _vZ);
    if (_vX.lengthSq() < 0.0001) _vX.set(1, 0, 0);
    _vX.normalize();
    _vY.crossVectors(_vZ, _vX).normalize();

    const tilt = Math.sin(clock * MOON_TILT_RATE) * 0.14 * aMoon;
    const c = Math.cos(tilt);
    const s = Math.sin(tilt);
    _rX.copy(_vX).multiplyScalar(c).addScaledVector(_vY, s);
    _rY.copy(_vY).multiplyScalar(c).addScaledVector(_vX, -s);
    _mRot.makeBasis(_rX, _rY, _vZ);
    moonMesh.quaternion.setFromRotationMatrix(_mRot);
    moonUniforms.uMoonRotMat.value.setFromMatrix4(_mRot);

    const phase = phaseStartAngle + clock * MOON_PHASE_RATE;
    _driftedSun
      .copy(_moonDir)
      .multiplyScalar(Math.cos(phase))
      .addScaledVector(_vX, Math.sin(phase))
      .addScaledVector(_vY, 0.22 * aAny)
      .normalize();
    moonUniforms.uSunDirectionWorld.value
      .copy(_savedMoonSunDir)
      .lerp(_driftedSun, aAny)
      .normalize();
  }
}

/** After the frame is drawn: puts everything applyTrip changed back. */
export function restoreTrip() {
  if (!applied) return;
  applied = false;
  skyUniforms.topColor.value.copy(_savedTop);
  skyUniforms.bottomColor.value.copy(_savedBottom);
  scene.fog.color.copy(_savedFog);
  terrainUniforms.uTopColor.value.copy(_savedTerrainTop);
  terrainUniforms.uBottomColor.value.copy(_savedTerrainBottom);
  dirLight.color.copy(_savedDirColor);
  hemiLight.color.copy(_savedHemiColor);
  hemiLight.groundColor.copy(_savedHemiGround);
  skyUniforms.uCloudTypes.value.copy(_savedCloudTypes);
  skyUniforms.uAuroraIntensity.value = _savedAurora;
  skyUniforms.uMilkyWay.value = _savedMilkyWay;
  starsMat.opacity = _savedStarsOpacity;
  starsMat.visible = _savedStarsVisible;
  if (appliedMoon) {
    appliedMoon = false;
    moonMesh.position.copy(_savedMoonPos);
    moonMesh.scale.copy(_savedMoonScale);
    moonMesh.quaternion.copy(_savedMoonQuat);
    moonUniforms.uMoonRotMat.value.copy(_savedMoonRotMat);
    moonUniforms.uMoonSkyDir.value.copy(_savedMoonSkyDir);
    moonlightUniforms.uMoonDir.value.copy(_savedMoonLightDir);
    moonUniforms.uSunDirectionWorld.value.copy(_savedMoonSunDir);
    moonUniforms.dayFactor.value = _savedMoonDayFactor;
    moonlightUniforms.uMoonBright.value = _savedMoonBright;
    moonlightUniforms.uMoonCos.value = _savedMoonCos;
  }
}
