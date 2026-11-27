// --- KNOCKED MUSHROOMS MAKE THE SKY SUBTLY STRANGE ---
// Knocking over one of the eastern alien mushrooms (breakables.js) throws
// out a cloud of glowing spores at its stump, and when it's the player who
// hit it, the sky quietly starts acting uncanny for a while (more so and
// longer for the giants, and stacking across a grove): the natural sky and
// fog colours stay put, while overhead the zenith deepens slightly, faint
// stars and aurora ribbons shimmer even by day, the cloud layers slowly curl
// between cumulus, cirrus and mackerel ripples, and the moon emerges a
// little larger than usual with its craters and sunlit phase creeping in
// slow motion.
//
// It costs nothing on phones: no extra pass or shader, just existing sky and
// moon uniforms nudged before the frame is drawn (applyTrip) and restored
// straight after (restoreTrip), so the day/night code underneath never sees
// them and everything melts cleanly back to normal.
import * as THREE from 'three';
import {state} from './state.js';
import {moonlightUniforms, terrainUniforms} from './constants.js';
import {moonMesh, moonUniforms, skyUniforms, starsMat} from './sky.js';

// How long a trip lasts (s): ~22 s for a small mushroom up to 50 s for a
// giant, easing in slowly over FADE_IN and out over FADE_OUT
const FADE_IN = 3;
const FADE_OUT = 7;
const LENGTH_SMALL = 22;
const LENGTH_GIANT = 50;
// Peak strength for a single small mushroom (0) up to a giant (1); knocking
// more mushrooms while tripping stacks +STACK_GAIN toward 1
const PEAK_SMALL = 0.48;
const STACK_GAIN = 0.22;
// Extra cloud/aurora drift speed at full trip (~2.1x normal 1x cloudTime,
// easing smoothly back to 1x with no jump or rewind)
const CLOUD_DRIFT_GAIN = 1.1;
// Slow, meditative periods (~48-78 s) for cloud morphing and moon drift
const CLOUD_MORPH_X = 0.13;
const CLOUD_MORPH_Y = 0.1;
const CLOUD_MORPH_Z = 0.08;
const MOON_PHASE_RATE = 0.09; // ~70 s per full lunar cycle
const MOON_TILT_RATE = 0.12; // ~52 s gentle libration breath
const ZENITH_DEEPEN = 0.2;

// ?trip=1 holds a full trip, for trying the look without finding a mushroom
const FOREVER =
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).get('trip') === '1';

let length = LENGTH_SMALL;
let peak = 1;
let age = Infinity;
// Continuous phase clock (s) so stacked mushrooms never jump the clouds/moon
let clock = 0;

/** 0-1 how strong the trip is now (0 when not tripping). */
export function tripAmount() {
  if (age >= length) return 0;
  let env = 1;
  if (age < FADE_IN) {
    env = THREE.MathUtils.smoothstep(age, 0, FADE_IN);
  } else if (age > length - FADE_OUT) {
    env = 1 - THREE.MathUtils.smoothstep(age, length - FADE_OUT, length);
  }
  return env * peak;
}

/** Starts (or stacks onto) a trip: `size` 0-1 from a small mushroom to a giant. */
export function startTrip(size) {
  const s = THREE.MathUtils.clamp(size, 0, 1);
  const hitPeak = THREE.MathUtils.lerp(PEAK_SMALL, 1, Math.pow(s, 0.65));
  const nextLength = THREE.MathUtils.lerp(LENGTH_SMALL, LENGTH_GIANT, s);
  if (age < length) {
    const left = Math.max(0, length - age);
    peak = Math.min(
      1,
      Math.max(peak, tripAmount()) + STACK_GAIN * (0.5 + 0.5 * s)
    );
    peak = Math.max(peak, hitPeak);
    length = Math.max(left, nextLength);
    age = Math.min(age, FADE_IN);
  } else {
    peak = hitPeak;
    length = nextLength;
    age = 0;
  }
}

/** Per frame: advances the trip clock and gently speeds cloud/aurora flow. */
export function updateTrip(delta) {
  if (state.isPaused || delta <= 0) return;
  if (FOREVER) {
    peak = 1;
    length = LENGTH_GIANT;
    age = FADE_IN;
  }
  if (age < length) {
    age += delta;
    clock += delta;
    const a = tripAmount();
    if (a > 0 && typeof state.cloudTime === 'number') {
      state.cloudTime += delta * CLOUD_DRIFT_GAIN * a;
    }
  }
}

// Saved state restored right after renderFrame in restoreTrip()
const _hsl = {h: 0, s: 0, l: 0};
const _savedTop = new THREE.Color();
const _savedTerrainTop = new THREE.Color();
const _savedCloudTypes = new THREE.Vector3();
const _targetClouds = new THREE.Vector3();
const _savedMoonScale = new THREE.Vector3();
const _savedMoonQuat = new THREE.Quaternion();
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
let _savedMoonOpacity = 1;

/** Before the frame is drawn: nudges sky, clouds, aurora, stars, and moon. */
export function applyTrip() {
  const a = tripAmount();
  if (a <= 0.001 || !skyUniforms) return;
  applied = true;
  appliedMoon = false;

  const overcast = skyUniforms.uCloudDensity?.value ?? 0;
  const clearSky = Math.max(0, 1 - overcast * 0.7);

  // 1. Keep the natural sky hue and horizon/fog untouched; subtly deepen only
  // the zenith so faint daytime stars and translucent aurora read overhead
  _savedTop.copy(skyUniforms.topColor.value);
  _savedTerrainTop.copy(terrainUniforms.uTopColor.value);
  skyUniforms.topColor.value.getHSL(_hsl);
  skyUniforms.topColor.value.setHSL(
    _hsl.h,
    Math.min(1, _hsl.s + 0.05 * a),
    _hsl.l * (1 - ZENITH_DEEPEN * a)
  );
  terrainUniforms.uTopColor.value.copy(skyUniforms.topColor.value);

  // 2. Slow, unhurried cloud morph between cumulus, cirrus, and mackerel ripples
  _savedCloudTypes.copy(skyUniforms.uCloudTypes.value);
  _targetClouds.set(
    0.72 + 0.42 * Math.cos(clock * CLOUD_MORPH_X),
    0.8 + 0.42 * Math.sin(clock * CLOUD_MORPH_Y),
    0.92 + 0.52 * Math.sin(clock * CLOUD_MORPH_Z - 0.8)
  );
  skyUniforms.uCloudTypes.value.lerp(_targetClouds, 0.78 * a);

  // 3. Translucent aurora + faint daytime stars & Milky Way overhead
  _savedAurora = skyUniforms.uAuroraIntensity.value;
  _savedMilkyWay = skyUniforms.uMilkyWay.value;
  _savedStarsOpacity = starsMat.opacity;
  _savedStarsVisible = starsMat.visible;

  skyUniforms.uAuroraIntensity.value = Math.max(
    _savedAurora,
    0.72 * a * clearSky
  );
  const starBleed = 0.55 * a * Math.max(0, 1 - overcast * 1.15);
  starsMat.opacity = Math.max(_savedStarsOpacity, starBleed);
  starsMat.visible = starsMat.opacity > 0.001;
  skyUniforms.uMilkyWay.value = Math.max(_savedMilkyWay, starBleed);

  // 4. Uncanny moon (in its real sky position, behind all terrain): emerges
  // gently in daylight, swells a little, and slowly creeps in phase and tilt
  if (
    moonMesh &&
    moonMesh.material &&
    moonMesh.position.lengthSq() > 1 &&
    state.moonY > -0.12
  ) {
    appliedMoon = true;
    _savedMoonDayFactor = moonUniforms.dayFactor.value;
    _savedMoonBright = moonlightUniforms.uMoonBright.value;
    _savedMoonOpacity = moonMesh.material.opacity;
    _savedMoonScale.copy(moonMesh.scale);
    _savedMoonQuat.copy(moonMesh.quaternion);
    _savedMoonSunDir.copy(moonUniforms.uSunDirectionWorld.value);

    const reveal = a * 0.85;
    moonUniforms.dayFactor.value = THREE.MathUtils.lerp(
      _savedMoonDayFactor,
      0.16,
      reveal
    );
    moonMesh.material.opacity = THREE.MathUtils.lerp(
      _savedMoonOpacity,
      0.9 * Math.max(0, 1 - overcast),
      reveal
    );
    moonMesh.scale.multiplyScalar(1 + 0.65 * a);
    moonlightUniforms.uMoonBright.value = Math.max(
      _savedMoonBright,
      0.45 * a * clearSky
    );

    _moonDir.copy(moonMesh.position).normalize();
    _vZ.copy(_moonDir).negate();
    _vX.crossVectors(_up, _vZ);
    if (_vX.lengthSq() < 0.0001) _vX.set(1, 0, 0);
    _vX.normalize();
    _vY.crossVectors(_vZ, _vX).normalize();

    const tilt = Math.sin(clock * MOON_TILT_RATE) * 0.14 * a;
    const c = Math.cos(tilt);
    const s = Math.sin(tilt);
    _rX.copy(_vX).multiplyScalar(c).addScaledVector(_vY, s);
    _rY.copy(_vY).multiplyScalar(c).addScaledVector(_vX, -s);
    _mRot.makeBasis(_rX, _rY, _vZ);
    moonMesh.quaternion.setFromRotationMatrix(_mRot);

    const phase = clock * MOON_PHASE_RATE;
    _driftedSun
      .copy(_moonDir)
      .multiplyScalar(Math.cos(phase))
      .addScaledVector(_vX, Math.sin(phase))
      .addScaledVector(_vY, 0.2)
      .normalize();
    moonUniforms.uSunDirectionWorld.value
      .copy(_savedMoonSunDir)
      .lerp(_driftedSun, a)
      .normalize();
  }
}

/** After the frame is drawn: puts everything applyTrip changed back. */
export function restoreTrip() {
  if (!applied) return;
  applied = false;
  skyUniforms.topColor.value.copy(_savedTop);
  terrainUniforms.uTopColor.value.copy(_savedTerrainTop);
  skyUniforms.uCloudTypes.value.copy(_savedCloudTypes);
  skyUniforms.uAuroraIntensity.value = _savedAurora;
  skyUniforms.uMilkyWay.value = _savedMilkyWay;
  starsMat.opacity = _savedStarsOpacity;
  starsMat.visible = _savedStarsVisible;
  if (appliedMoon) {
    appliedMoon = false;
    moonUniforms.dayFactor.value = _savedMoonDayFactor;
    moonlightUniforms.uMoonBright.value = _savedMoonBright;
    moonMesh.material.opacity = _savedMoonOpacity;
    moonMesh.scale.copy(_savedMoonScale);
    moonMesh.quaternion.copy(_savedMoonQuat);
    moonUniforms.uSunDirectionWorld.value.copy(_savedMoonSunDir);
  }
}
