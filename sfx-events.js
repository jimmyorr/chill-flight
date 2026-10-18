// --- EVENT & ENVIRONMENT SOUND EFFECTS ---
// Procedural sounds layered on the sound effects bus in sfx.js: one-shots
// for touchdowns, splashes, landing gear, dialog and chimes, and loops for
// taxiing, water, falling, rain and the falls. Each one can be switched off
// on its own from the debug menu or the sound lab (debug/debug-sound.html),
// and the switches are saved.
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {state} from './state.js';
import {activePlaneType, planeGroup, planeHandling} from './airplane.js';
import {createNoiseBuffer, getAudioContext, getSfxBus} from './sfx.js';

export const SFX_EVENTS = [
  {key: 'touchdown', label: 'Touchdown'},
  {key: 'splash', label: 'Water landing splash'},
  {key: 'taxi', label: 'Taxi rumble'},
  {key: 'water', label: 'Water lapping and hiss'},
  {key: 'gear', label: 'Landing gear'},
  {key: 'fall', label: 'Falling wind'},
  {key: 'rain', label: 'Rain'},
  {key: 'waterfall', label: 'Waterfall'},
  {key: 'dialog', label: 'Dialog blips'},
  {key: 'chime', label: 'Job and waypoint chime'},
];

const STORAGE_KEY = 'chill_flight_sfx_events';

function loadEnabled() {
  const on = Object.fromEntries(SFX_EVENTS.map((e) => [e.key, true]));
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    for (const key of Object.keys(on)) {
      if (typeof saved[key] === 'boolean') on[key] = saved[key];
    }
  } catch {
    /* ignore */
  }
  return on;
}

const enabled = loadEnabled();

export function isSfxEventEnabled(key) {
  return enabled[key] !== false;
}

export function setSfxEventEnabled(key, on) {
  enabled[key] = on;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
  } catch {
    /* ignore */
  }
}

// Where the falls' roar comes from: the lip of the big falls. Height above
// FALLS_TOP counts toward the distance too.
const FALLS_X = ChillFlightLogic.FALLS_X;
const FALLS_Z = ChillFlightLogic.FALLS_LIP_Z;
const FALLS_TOP = 600;
// Fully loud within this distance, silent beyond FALLS_FAR (units)
const FALLS_NEAR = 250;
const FALLS_FAR = 3000;

let ctx = null;
let bus = null;
let noise = null;
let loops = null;
let lastGround = null;
let lastWater = null;
let lastGear = null;
let lastTouchdown = 0;
let lastY = null;
let fallRate = 0;
let startedAt = 0;

/** A looping noise source through one filter into its own gain. */
function makeLoop(type, freq, q) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(bus);
  // Start each loop at a different point so they don't line up
  src.start(0, Math.random() * noise.duration);
  return {filter, gain};
}

function build() {
  noise = createNoiseBuffer(ctx);
  loops = {
    taxi: makeLoop('lowpass', 200, 0.7),
    water: makeLoop('bandpass', 500, 0.6),
    fall: makeLoop('bandpass', 700, 1.2),
    rain: makeLoop('highpass', 1800, 0.5),
    roar: makeLoop('lowpass', 420, 0.7),
    spray: makeLoop('bandpass', 2400, 0.8),
  };
  // Slow swell on the water, like small waves against the floats
  const swell = ctx.createOscillator();
  swell.frequency.value = 0.18;
  const swellDepth = ctx.createGain();
  swellDepth.gain.value = 0;
  swell.connect(swellDepth);
  swellDepth.connect(loops.water.gain.gain);
  swell.start();
  loops.water.swellDepth = swellDepth;
  startedAt = ctx.currentTime;
}

/** Returns the context once the sound effects graph is up, else null. */
function ready() {
  if (!ctx) {
    ctx = getAudioContext();
    bus = getSfxBus();
    if (!ctx || !bus) {
      ctx = null;
      return null;
    }
    build();
  }
  return ctx;
}

function setLoop(node, value, tc = 0.15) {
  node.setTargetAtTime(value, ctx.currentTime, tc);
}

// A short burst of the noise buffer through a filter, for impacts
function noiseBurst(t, {type, freq, freqEnd, q = 0.7, gain, attack, decay}) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, t);
  if (freqEnd) {
    filter.frequency.exponentialRampToValueAtTime(freqEnd, t + attack + decay);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  src.connect(filter);
  filter.connect(g);
  g.connect(bus);
  src.start(t, Math.random() * (noise.duration - 2));
  src.stop(t + attack + decay + 0.05);
}

// A single enveloped oscillator note, optionally through a low-pass
function tone(t, {type = 'sine', freq, freqEnd, gain, attack, decay, lowpass}) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (freqEnd) {
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t + attack + decay);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  if (lowpass) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    osc.connect(filter);
    filter.connect(g);
  } else {
    osc.connect(g);
  }
  g.connect(bus);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
}

// --- ONE-SHOTS ---
// strength is 0..1 (how hard the plane came down). force plays even when
// the sound is switched off, for auditioning in the sound lab.

export function playTouchdown(strength = 0.6, force = false) {
  if ((!force && !isSfxEventEnabled('touchdown')) || !ready()) return;
  const s = THREE.MathUtils.clamp(strength, 0.2, 1);
  const t = ctx.currentTime;
  // Low thump of the wheels taking the weight, and a scuff of tyres
  tone(t, {freq: 75, freqEnd: 42, gain: 0.9 * s, attack: 0.005, decay: 0.3});
  noiseBurst(t, {
    type: 'lowpass',
    freq: 900,
    freqEnd: 300,
    gain: 0.8 * s,
    attack: 0.005,
    decay: 0.22,
  });
}

export function playSplash(strength = 0.6, force = false) {
  if ((!force && !isSfxEventEnabled('splash')) || !ready()) return;
  const s = THREE.MathUtils.clamp(strength, 0.2, 1);
  const t = ctx.currentTime;
  noiseBurst(t, {
    type: 'bandpass',
    freq: 1800,
    freqEnd: 500,
    q: 0.6,
    gain: 1.2 * s,
    attack: 0.03,
    decay: 1.1,
  });
  tone(t, {freq: 90, freqEnd: 50, gain: 0.5 * s, attack: 0.01, decay: 0.35});
}

// down: gear extending (true) or retracting (false)
export function playGear(down = true, force = false) {
  if ((!force && !isSfxEventEnabled('gear')) || !ready()) return;
  const t = ctx.currentTime;
  // As long as the gear takes to move (game-loop.js eases it at 0.5/s down
  // and 0.4/s up)
  const run = down ? 2 : 2.5;
  // Electric motor whir, rising as it runs
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(down ? 110 : 130, t);
  osc.frequency.linearRampToValueAtTime(down ? 150 : 175, t + run);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 900;
  filter.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.2, t + 0.12);
  g.gain.setValueAtTime(0.2, t + run - 0.15);
  g.gain.exponentialRampToValueAtTime(0.0001, t + run);
  osc.connect(filter);
  filter.connect(g);
  g.connect(bus);
  osc.start(t);
  osc.stop(t + run + 0.05);
  // Clunk as it locks
  tone(t + run, {
    freq: 140,
    freqEnd: 70,
    gain: 0.3,
    attack: 0.004,
    decay: 0.12,
  });
  noiseBurst(t + run, {
    type: 'bandpass',
    freq: 1400,
    gain: 0.18,
    attack: 0.002,
    decay: 0.06,
  });
}

// One blip of typed dialog. voice is any string (the speaker's name) and
// picks a pitch, so each person sounds a little different.
export function playDialogBlip(voice = '', force = false) {
  if ((!force && !isSfxEventEnabled('dialog')) || !ready()) return;
  let hash = 0;
  for (let i = 0; i < voice.length; i++) {
    hash = (hash * 31 + voice.charCodeAt(i)) >>> 0;
  }
  const base = 260 + (hash % 9) * 35;
  // A softened square wave, a little off pitch each time like speech
  tone(ctx.currentTime, {
    type: 'square',
    freq: base * (0.94 + Math.random() * 0.12),
    gain: 0.08,
    attack: 0.004,
    decay: 0.045,
    lowpass: 1800,
  });
}

// Two soft bell notes, for a job step done or a waypoint reached
export function playChime(force = false) {
  if ((!force && !isSfxEventEnabled('chime')) || !ready()) return;
  const t = ctx.currentTime;
  for (const [i, freq] of [659.25, 987.77].entries()) {
    const start = t + i * 0.14;
    tone(start, {freq, gain: 0.2, attack: 0.01, decay: 1.4});
    // A quiet octave above gives it a bell-like shimmer
    tone(start, {freq: freq * 2, gain: 0.045, attack: 0.01, decay: 0.8});
  }
}

// Audition each one-shot from the debug menu and sound lab, even when it's
// switched off
export const SFX_EVENT_PLAYERS = {
  touchdown: () => playTouchdown(0.7, true),
  splash: () => playSplash(0.7, true),
  gear: () => playGear(true, true),
  dialog: () => {
    for (let i = 0; i < 8; i++) {
      setTimeout(() => playDialogBlip('Ray', true), i * 57);
    }
  },
  chime: () => playChime(true),
};

// Loops forced on for auditioning in the sound lab, whatever the plane is
// doing (and even when switched off)
const preview = {};
export const SFX_LOOP_KEYS = ['taxi', 'water', 'fall', 'rain', 'waterfall'];

export function setSfxLoopPreview(key, on) {
  preview[key] = on;
}

// --- PER FRAME ---
// rain: 0..1 how hard it's raining. Detects touchdowns, splashes and gear
// changes from state, and sets the loops' levels.
export function updateSfxEvents(delta, rain = 0) {
  if (!ready() || delta <= 0) return;
  const paused = state.isPaused;
  const speed = Math.max(0, state.flightSpeedMultiplier || 0);
  const onGround = state.isOnGround;
  const onWater = state.isOnWater;

  // Vertical speed, units/s (positive falling), smoothed
  const y = planeGroup.position.y;
  if (lastY !== null && !paused) {
    const rate = (lastY - y) / delta;
    fallRate += (rate - fallRate) * Math.min(1, delta * 4);
  }
  lastY = y;

  // Ignore what the spawn looks like for the first moment
  const settled = ctx.currentTime - startedAt > 2;
  if (settled && !paused && !state.isFreeCamera) {
    const now = ctx.currentTime;
    const impact = THREE.MathUtils.clamp(
      0.3 + fallRate / 60 + speed * 0.3,
      0,
      1
    );
    if (onGround && lastGround === false && now - lastTouchdown > 0.5) {
      lastTouchdown = now;
      playTouchdown(impact);
    }
    if (onWater && lastWater === false && now - lastTouchdown > 0.5) {
      lastTouchdown = now;
      playSplash(impact);
    }
    // Only the seaplane's pontoons and the twin's wheels move
    const movingGear =
      activePlaneType === 'seaplane' || activePlaneType === 'twin';
    if (lastGear !== null && state.gearWanted !== lastGear && movingGear) {
      playGear(state.gearWanted);
    }
  }
  lastGround = onGround;
  lastWater = onWater;
  lastGear = state.gearWanted;

  // Taxi rumble on land, rising with ground speed
  const rolling = THREE.MathUtils.clamp(speed / 0.6, 0, 1);
  const taxiRoll = preview.taxi ? 0.6 : onGround ? rolling : 0;
  setLoop(
    loops.taxi.gain.gain,
    isSfxEventEnabled('taxi') || preview.taxi ? 0.5 * taxiRoll : 0,
    0.08
  );
  setLoop(loops.taxi.filter.frequency, 120 + taxiRoll * 260);

  // Water: gentle lapping when resting, a hiss of spray when moving
  const waterOn = preview.water || (isSfxEventEnabled('water') && onWater);
  const waterRoll = preview.water ? 0 : rolling;
  const lap = 0.22;
  setLoop(loops.water.gain.gain, waterOn ? lap + 0.5 * waterRoll : 0, 0.2);
  setLoop(loops.water.swellDepth.gain, waterOn ? lap * 0.7 : 0, 0.2);
  setLoop(loops.water.filter.frequency, 450 + waterRoll * 1600);

  // Falling: wind rushing past as the plane drops out of the sky, below its
  // stall speed (the speed multiplier is in 150-knot steps)
  const airborne = !onGround && !onWater && !state.isFreeCamera;
  const falling = preview.fall
    ? 0.8
    : airborne && speed * 150 < planeHandling().stallKts
      ? THREE.MathUtils.clamp(fallRate / 120, 0, 1)
      : 0;
  setLoop(
    loops.fall.gain.gain,
    isSfxEventEnabled('fall') || preview.fall ? 0.45 * falling : 0,
    0.2
  );
  setLoop(loops.fall.filter.frequency, 500 + falling * 900);

  // Rain on the canopy
  const rainAmount = preview.rain ? 1 : THREE.MathUtils.clamp(rain, 0, 1);
  setLoop(
    loops.rain.gain.gain,
    isSfxEventEnabled('rain') || preview.rain ? 0.5 * rainAmount : 0,
    0.5
  );

  // The falls: roar carries far, spray only up close
  const pos = planeGroup.position;
  const dist = Math.hypot(
    pos.x - FALLS_X,
    pos.z - FALLS_Z,
    Math.max(0, pos.y - FALLS_TOP)
  );
  const near = preview.waterfall
    ? 0.85
    : THREE.MathUtils.clamp(
        1 - (dist - FALLS_NEAR) / (FALLS_FAR - FALLS_NEAR),
        0,
        1
      );
  const fallsOn = isSfxEventEnabled('waterfall') || preview.waterfall;
  setLoop(loops.roar.gain.gain, fallsOn ? 0.7 * near * near : 0, 0.3);
  setLoop(loops.spray.gain.gain, fallsOn ? 0.35 * Math.pow(near, 4) : 0, 0.3);
}
