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
import {dirLight, hemiLight, skyUniforms} from './sky.js';

// How long a trip lasts (s): fading in, then out
const FADE_IN = 1.5;
const LENGTH = 14;
// How far round the colour wheel the sky turns at the peak (0-1 is a full
// turn), and how fast it swings (radians/s)
const HUE_SWING = 0.35;
const SWING_SPEED = 0.55;
// How much of the light takes the rainbow's colour at the peak
const LIGHT_TINT = 0.35;
// Extra saturation for the sky and fog at the peak
const SATURATE = 0.25;

// ?trip=1 holds a full trip, for trying the look without finding a mushroom
const FOREVER =
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).get('trip') === '1';

// 0-1 how strong this trip is (bigger mushrooms, stronger), and how far in (s)
let strength = 0;
let age = LENGTH;
// The swing's clock, kept running so trips that overlap don't jump
let clock = 0;

/** Starts (or tops up) a trip: `size` 0-1 from a small mushroom to a giant. */
export function startTrip(size) {
  const s = THREE.MathUtils.clamp(size, 0.3, 1);
  if (age < LENGTH) {
    // Already tripping: stretch it out rather than starting over
    strength = Math.max(strength * tripEnvelope(age), s);
    age = Math.min(age, FADE_IN);
  } else {
    strength = s;
    age = 0;
  }
}

/** 0-1 how strong the trip is now (0 when not tripping). */
export function tripAmount() {
  return age < LENGTH ? strength * tripEnvelope(age) : 0;
}

// Eases in over FADE_IN and slowly out to LENGTH
function tripEnvelope(t) {
  if (t < FADE_IN) return THREE.MathUtils.smoothstep(t, 0, FADE_IN);
  const out = (t - FADE_IN) / (LENGTH - FADE_IN);
  return 1 - THREE.MathUtils.smoothstep(out, 0.35, 1);
}

/** Per frame: moves the trip along. */
export function updateTrip(delta) {
  if (state.isPaused || delta <= 0) return;
  if (FOREVER) {
    strength = 1;
    age = FADE_IN;
  }
  if (age < LENGTH) {
    age += delta;
    clock += delta;
  }
}

/** Where the rainbow is now (0-1 round the wheel). */
export function tripHue() {
  return (clock * 0.07) % 1;
}

// The colours applyTrip changes, kept to put back after the frame
const touched = [];
const saved = [];
const _hsl = {h: 0, s: 0, l: 0};
const _rainbow = new THREE.Color();
let applied = false;

function remember(color) {
  touched.push(color);
  if (saved.length < touched.length) saved.push(color.clone());
  else saved[touched.length - 1].copy(color);
}

function shift(color, hue, sat) {
  remember(color);
  color.getHSL(_hsl);
  color.setHSL((_hsl.h + hue + 1) % 1, Math.min(1, _hsl.s + sat), _hsl.l);
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
  const hue = Math.sin(clock * SWING_SPEED) * HUE_SWING * a;
  const sat = SATURATE * a;
  shift(scene.fog.color, hue, sat);
  if (skyUniforms) {
    shift(skyUniforms.topColor.value, hue, sat);
    shift(skyUniforms.bottomColor.value, hue, sat);
  }
  shift(terrainUniforms.uTopColor.value, hue, sat);
  shift(terrainUniforms.uBottomColor.value, hue, sat);
  _rainbow.setHSL(tripHue(), 0.85, 0.65);
  tint(dirLight.color, LIGHT_TINT * a);
  _rainbow.setHSL((tripHue() + 0.5) % 1, 0.85, 0.65);
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
