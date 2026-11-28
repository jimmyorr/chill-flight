// --- KNOCKED MUSHROOMS SLOWLY TURN THE SKY COSMIC AND SWELL THE MOON ---
// Knocking over one of the eastern alien mushrooms (breakables.js) throws
// out a cloud of glowing spores at its stump, and when it's the player who
// hit it, a slow, chill transition unfolds over the next minute and a half
// to two minutes (stronger and longer for the giants, and stacking smoothly
// across a grove): the upper sky gradually deepens over ~22 s into cosmic
// indigo-violet over a twilight haze as aurora curtains, stars and the Milky
// Way materialize even by day, the cloud layers curl across each other,
// distant hills and islands begin a slow ~30 s inhale-exhale breath as soft
// iridescent breeze washes drift across the ground, and the moon swells
// glacially over ~42 s to ~6x-8.5x its normal size while its sunlit phase
// creeps slowly across its craters (~2.5 min per lunar cycle), before
// melting gently back to normal (or ending at once on touching the water;
// envelope maths in mushroom-trip-logic.js).
//
// It costs nothing on phones: no extra pass, shader or allocations, just
// existing sky, light, terrain and moon uniforms nudged before the frame is
// drawn (applyTrip) and restored straight after (restoreTrip), so the
// day/night code underneath never sees them.
import * as THREE from 'three';
import {scene} from './scene.js';
import {state} from './state.js';
import {moonlightUniforms, terrainUniforms} from './constants.js';
import {windUniforms} from './terrain-geometry.js';
import {
  dirLight,
  hemiLight,
  moonMesh,
  moonUniforms,
  skyUniforms,
  starsMat,
} from './sky.js';
import {planeGroup} from './airplane.js';
import {checkWaterfallContact} from './haptics.js';
import {
  TRIP,
  createTripState,
  endTripState,
  isTripIdle,
  isTripTrailActive,
  startTripState,
  stepTripState,
} from './mushroom-trip-logic.js';

// Default moon scale multiplier at full trip (a = 1): ~6x on a single small
// mushroom (a ~ 0.68) up to 8.5x on a giant or stacked grove; ?tripMoon=N
// lets you experiment with 5x, 10x, etc. directly from the URL
const DEFAULT_MOON_GROW = 8.5;
const CLOUD_MORPH_X = 0.14;
const CLOUD_MORPH_Y = 0.11;
const CLOUD_MORPH_Z = 0.09;
const MOON_PHASE_RATE = 0.042; // ~150 s (2.5 min) per full lunar cycle (~2.4 deg/s)
const MOON_TILT_RATE = 0.05; // ~126 s glacial libration breath
const MOON_BASE_ANG_RAD = (440 * 1.827) / 27500; // ~1.68 deg normal radius

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

// Built-in chill ground effects (breathe + sheen) are on by default and ease
// in over the same slow ~42 s envelope as the moon; ?tripGround=0 (off/none)
// disables them, ?tripGround=breathe or sheen isolates one, and
// ?tripGroundAmt=0..3 tunes their strength.
const _rawTripGround = (_urlParams?.get('tripGround') ?? '')
  .trim()
  .toLowerCase();
const _groundOff =
  _rawTripGround === '0' ||
  _rawTripGround === 'false' ||
  _rawTripGround === 'off' ||
  _rawTripGround === 'none';
const _groundTokens = new Set(_rawTripGround.split(/[,+\s]+/).filter(Boolean));
const _groundDefaultOrAll =
  !_groundOff &&
  (_groundTokens.size === 0 ||
    _groundTokens.has('all') ||
    _groundTokens.has('1') ||
    _groundTokens.has('true'));
const _rawGroundAmt = parseFloat(_urlParams?.get('tripGroundAmt') ?? '');
const GROUND_AMT = Number.isFinite(_rawGroundAmt)
  ? THREE.MathUtils.clamp(_rawGroundAmt, 0, 3)
  : 1;
const GROUND_MODES = {
  breathe:
    !_groundOff && (_groundDefaultOrAll || _groundTokens.has('breathe'))
      ? GROUND_AMT
      : 0,
  sheen:
    !_groundOff && (_groundDefaultOrAll || _groundTokens.has('sheen'))
      ? GROUND_AMT
      : 0,
};
const HAS_GROUND_FX = GROUND_MODES.breathe + GROUND_MODES.sheen > 0;

const trip = createTripState();
// Cap colour of the most recently hit mushroom, streamed off the plane's tail
// while the trip stays active (particles.js, like rushTrail in crystal-rush.js)
const _capColor = new THREE.Color(0x9c27b0);
const _trail = new THREE.Color();
const WHITE = new THREE.Color(1, 1, 1);
const _smokeForcedOff = _urlParams?.get('smoke') === '0';

/** 0-1 how strong the sky trip is now (0 when not tripping). */
export function tripAmount() {
  return FOREVER_STRENGTH > 0 ? FOREVER_STRENGTH : trip.sky.val;
}

/** 0-1 how far the moon swell has progressed (ramps slower than the sky). */
export function tripMoonAmount() {
  return FOREVER_STRENGTH > 0 ? FOREVER_STRENGTH : trip.moon.val;
}

/** The plane's smoke trail colour while the trip stays active, or null. */
export function tripTrail() {
  const active =
    (FOREVER_STRENGTH > 0 && !_smokeForcedOff) || isTripTrailActive(trip);
  if (!active) return null;
  return _trail.copy(_capColor).lerp(WHITE, 0.2);
}

/** Starts (or stacks smoothly onto) a trip: `size` 0-1 from small to giant,
 * `capColor` the mushroom cap's colour (THREE.Color or [r, g, b]). */
export function startTrip(size, capColor) {
  if (capColor) {
    if (Array.isArray(capColor)) _capColor.fromArray(capColor);
    else _capColor.copy(capColor);
  }
  startTripState(trip, size, state.worldClockNow || 0);
}

/** Per frame: advances the sky and moon envelopes, or ends the trip on water. */
export function updateTrip(delta) {
  if (state.isPaused || delta <= 0) return;

  if (FOREVER_STRENGTH > 0) {
    trip.clock += delta;
    if (typeof state.cloudTime === 'number') {
      state.cloudTime += delta * TRIP.CLOUD_DRIFT_GAIN * FOREVER_STRENGTH;
    }
    return;
  }

  if (isTripIdle(trip)) return;

  const touchingWater =
    state.isOnWater ||
    (!state.isFreeCamera && checkWaterfallContact(planeGroup.position));
  const cloudDrift = stepTripState(trip, delta, touchingWater);
  if (cloudDrift > 0 && typeof state.cloudTime === 'number') {
    state.cloudTime += cloudDrift;
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
let appliedGround = false;
let _savedAurora = 0;
let _savedMilkyWay = 0;
let _savedStarsOpacity = 0;
let _savedStarsVisible = false;
let _savedMoonDayFactor = 1;
let _savedMoonBright = 0;
let _savedMoonCos = 0.9995;
let _savedWindStrength = 1;

/** Before the frame is drawn: nudges sky, clouds, aurora, stars, lights, and moon. */
export function applyTrip() {
  const aSky = tripAmount();
  const aMoon = tripMoonAmount();
  const aAny = Math.max(aSky, aMoon);
  if (aAny <= 0.001 || !skyUniforms) return;
  applied = true;
  appliedMoon = false;
  appliedGround = false;

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
    0.72 + 0.45 * Math.cos(trip.clock * CLOUD_MORPH_X),
    0.85 + 0.45 * Math.sin(trip.clock * CLOUD_MORPH_Y),
    0.95 + 0.5 * Math.sin(trip.clock * CLOUD_MORPH_Z - 0.8)
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

    const tilt = Math.sin(trip.clock * MOON_TILT_RATE) * 0.14 * aMoon;
    const c = Math.cos(tilt);
    const s = Math.sin(tilt);
    _rX.copy(_vX).multiplyScalar(c).addScaledVector(_vY, s);
    _rY.copy(_vY).multiplyScalar(c).addScaledVector(_vX, -s);
    _mRot.makeBasis(_rX, _rY, _vZ);
    moonMesh.quaternion.setFromRotationMatrix(_mRot);
    moonUniforms.uMoonRotMat.value.setFromMatrix4(_mRot);

    const phase = trip.phaseStartAngle + trip.clock * MOON_PHASE_RATE;
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

  // 5. Slow, chill ground breathing and pastel breeze sheen: rides the ~42 s
  // moon envelope (`aMoon`) so nothing shifts abruptly right on impact, and
  // eases back over ~30 s at the end of the trip
  if (HAS_GROUND_FX && aMoon > 0.001) {
    appliedGround = true;
    terrainUniforms.uTripGround.value.set(
      GROUND_MODES.breathe * aMoon,
      GROUND_MODES.sheen * aMoon,
      trip.clock
    );
    _savedWindStrength = windUniforms.uWindStrength.value;
    if (GROUND_MODES.sheen > 0) {
      const gentleBreeze = 1.42 + 0.48 * Math.sin(trip.clock * 0.22);
      windUniforms.uWindStrength.value = THREE.MathUtils.lerp(
        _savedWindStrength,
        Math.max(_savedWindStrength, gentleBreeze),
        Math.min(1, GROUND_MODES.sheen * aMoon)
      );
    }
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
  if (appliedGround) {
    appliedGround = false;
    terrainUniforms.uTripGround.value.set(0, 0, 0);
    windUniforms.uWindStrength.value = _savedWindStrength;
  }
}

/** Immediately ends any active mushroom trip (e.g. on touching or splashing into water). */
export function endTrip() {
  endTripState(trip);
  if (applied) restoreTrip();
}
