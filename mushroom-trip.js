// --- KNOCKED MUSHROOMS GO TRIPPY ---
// Knocking over one of the eastern alien mushrooms (breakables.js) throws
// out a cloud of glowing spores in its cap's colour, and when it's the
// player who hit it, the world goes softly psychedelic for a little while:
// the sky, fog and light drift round the colour wheel and back.
//
// It costs nothing on phones: no extra pass or render target, just colours
// nudged before the frame is drawn (applyTrip) and put back straight after
// (restoreTrip), so the day/night code underneath never sees them and the
// look fades out cleanly whatever the time of day.
import * as THREE from 'three';
import {scene} from './scene.js';
import {state} from './state.js';
import {terrainUniforms} from './constants.js';
import {setTripTrail} from './particles.js';
import {dirLight, hemiLight, skyUniforms} from './sky.js';

// How long a trip lasts (s): ~28 s for a small mushroom up to 45 s for a
// giant, easing in over FADE_IN and out over FADE_OUT at the end
const FADE_IN = 1.5;
const FADE_OUT = 5;
const LENGTH_SMALL = 28;
const LENGTH_GIANT = 45;
// How fast the smoke and sky revolve round the colour wheel together
// (turns/s: ~16.7 s per full cycle). The sky sits on the opposite side of
// the wheel (+0.5) from the smoke so the trail always stands out against it.
const RAINBOW_RATE = 0.06;
// How much of the light takes the rainbow's colour at the peak
const LIGHT_TINT = 0.35;
// Extra saturation for the sky and fog at the peak
const SATURATE = 0.3;

// The rainbow trail shows while the trip is at least this strong
const TRAIL_FROM = 0.2;
const _trail = new THREE.Color();
const _hsl = {h: 0, s: 0, l: 0};
// ?trip=1 holds a full trip, for trying the look without finding a mushroom
const FOREVER =
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).get('trip') === '1';

// How long this trip lasts (s) and how far in we are (s)
let length = LENGTH_SMALL;
let age = Infinity;
// The rainbow clock (s), kept running so overlapping trips don't jump
let clock = 0;

/** Where the smoke's rainbow is now (0-1 round the wheel); the sky sits
 * opposite it at `(tripHue() + 0.5) % 1`. */
export function tripHue() {
  return (clock * RAINBOW_RATE) % 1;
}

/** Starts (or tops up) a trip: `size` 0-1 from a small mushroom to a giant. */
export function startTrip(size) {
  const s = THREE.MathUtils.clamp(size, 0, 1);
  const nextLength = THREE.MathUtils.lerp(LENGTH_SMALL, LENGTH_GIANT, s);
  if (age < length) {
    // Already tripping: keep the rainbow moving and top up the time left
    const left = Math.max(0, length - age);
    length = Math.max(left, nextLength);
    age = Math.min(age, FADE_IN);
  } else {
    // Start the wheel where the sky already is so the sky sweeps smoothly
    // away from its natural colour while the smoke starts at its complement
    const base = skyUniforms ? skyUniforms.topColor.value : scene.fog?.color;
    if (base) {
      base.getHSL(_hsl);
      clock = ((_hsl.h + 0.5) % 1) / RAINBOW_RATE;
    }
    length = nextLength;
    age = 0;
  }
}

/** 0-1 how strong the trip is now (0 when not tripping). */
export function tripAmount() {
  if (age >= length) return 0;
  if (age < FADE_IN) return THREE.MathUtils.smoothstep(age, 0, FADE_IN);
  if (age > length - FADE_OUT) {
    return 1 - THREE.MathUtils.smoothstep(age, length - FADE_OUT, length);
  }
  return 1;
}

/** Per frame: moves the trip along. */
export function updateTrip(delta) {
  if (state.isPaused || delta <= 0) return;
  if (FOREVER) {
    length = LENGTH_GIANT;
    age = FADE_IN;
  }
  if (age < length) {
    age += delta;
    clock += delta;
  }
  // A rainbow smoke trail from the tail while it's strong, running round
  // the colour wheel in lockstep with the complementary sky (~16.7 s/cycle)
  if (tripAmount() > TRAIL_FROM) {
    _trail.setHSL(tripHue(), 0.9, 0.62);
    setTripTrail(_trail);
  } else {
    setTripTrail(null);
  }
}

// The colours applyTrip changes, kept to put back after the frame
const touched = [];
const saved = [];
const _target = new THREE.Color();
const _rainbow = new THREE.Color();
let applied = false;

function remember(color) {
  touched.push(color);
  if (saved.length < touched.length) saved.push(color.clone());
  else saved[touched.length - 1].copy(color);
}

function shift(color, hueDelta, sat, amount) {
  remember(color);
  color.getHSL(_hsl);
  const h = (_hsl.h + hueDelta + 1) % 1;
  const s = THREE.MathUtils.lerp(_hsl.s, Math.min(1, _hsl.s + sat), amount);
  if (amount >= 0.999) {
    color.setHSL(h, s, _hsl.l);
  } else {
    _target.setHSL(h, s, _hsl.l);
    color.lerp(_target, amount);
    const l = _hsl.l;
    color.getHSL(_hsl);
    color.setHSL(_hsl.h, s, l);
  }
}

function tint(color, amount) {
  remember(color);
  color.lerp(_rainbow, amount);
}

/** Before the frame is drawn: turns the sky, fog and light trippy. */
export function applyTrip() {
  const a = tripAmount();
  if (a <= 0.001) return;
  applied = true;
  touched.length = 0;
  const smokeHue = tripHue();
  const skyHue = (smokeHue + 0.5) % 1;
  const base = skyUniforms ? skyUniforms.topColor.value : scene.fog.color;
  base.getHSL(_hsl);
  const hueDelta = skyHue - _hsl.h;
  shift(scene.fog.color, hueDelta, SATURATE, a);
  if (skyUniforms) {
    shift(skyUniforms.topColor.value, hueDelta, SATURATE, a);
    shift(skyUniforms.bottomColor.value, hueDelta, SATURATE, a);
  }
  shift(terrainUniforms.uTopColor.value, hueDelta, SATURATE, a);
  shift(terrainUniforms.uBottomColor.value, hueDelta, SATURATE, a);
  _rainbow.setHSL(smokeHue, 0.85, 0.65);
  tint(dirLight.color, LIGHT_TINT * a);
  _rainbow.setHSL(skyHue, 0.85, 0.65);
  tint(hemiLight.color, LIGHT_TINT * a);
  tint(hemiLight.groundColor, LIGHT_TINT * a * 0.6);
}

/** After the frame is drawn: puts everything applyTrip changed back. */
export function restoreTrip() {
  if (!applied) return;
  applied = false;
  for (let i = 0; i < touched.length; i++) touched[i].copy(saved[i]);
  touched.length = 0;
}
