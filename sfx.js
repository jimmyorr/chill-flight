// --- SOUND EFFECTS & PROCEDURAL AUDIO ---
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {state} from './state.js';
import {activePlaneType} from './airplane.js';
import {log} from './logger.js';

// ?sfx=0/1 overrides the saved setting for this visit (and changes made
// during it aren't saved). With no saved setting, sound effects follow the
// music setting, so players who chose to start silently stay silent.
function savedSfxEnabled() {
  try {
    const saved = localStorage.getItem('chill_flight_sfx_enabled');
    if (saved !== null) return saved !== 'false';
    return localStorage.getItem('chill_flight_music_enabled') !== 'false';
  } catch {
    return true;
  }
}
export let sfxEnabled =
  ChillFlightLogic.SFX_PARAM !== null
    ? ChillFlightLogic.SFX_PARAM
    : savedSfxEnabled();

// Top of the speed range in flightSpeedMultiplier units (500 kts)
const MAX_SPEED_MULT = 500 / 150;
// Depth of the propeller chop (amplitude wobble from the LFO)
const CHOP_DEPTH = 0.3;

// Master SFX volume relative to music (which plays at 0.5)
export const SFX_VOLUME = 0.45;
export let masterVolume = 0.45;

// Optional override for debug auditioning
export let planeTypeOverride = null;

export function setPlaneTypeOverride(type) {
  planeTypeOverride = type;
}

let audioCtx = null;
let masterGain = null;
let engineGain = null;
let engineFilter = null;
let raspFilter = null;
let raspGain = null;
let chopGain = null;
let osc1 = null;
let osc2 = null;
let oscSub = null;
let oscSubGain = null;
let lfo = null;
let lfoGain = null;
let windGain = null;
let windFilter = null;
let windSource = null;
let cricketGain = null;
let cricketSource = null;
let breezeGain = null;
let breezeFilter = null;
let breezeSource = null;
let isInitialized = false;

/**
 * Generates a smooth, looping pink/brown noise buffer for wind rush.
 * Six seconds long so the loop isn't heard as a cycle, and the noise past
 * the end is faded into the start so the loop point has no click.
 */
function createNoiseBuffer(context) {
  const bufferSize = context.sampleRate * 6;
  const fadeLen = Math.floor(context.sampleRate * 0.25);
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const output = buffer.getChannelData(0);
  const tail = new Float32Array(fadeLen);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < bufferSize + fadeLen; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99 * b0 + white * 0.05;
    b1 = 0.95 * b1 + white * 0.1;
    b2 = 0.85 * b2 + white * 0.2;
    const v = (b0 + b1 + b2) * 0.6;
    if (i < bufferSize) output[i] = v;
    else tail[i - bufferSize] = v;
  }
  // The sample after the last one is tail[0], so blend the start from the
  // tail (continuing the end) into the original start.
  for (let i = 0; i < fadeLen; i++) {
    const alpha = i / fadeLen;
    output[i] = output[i] * alpha + tail[i] * (1 - alpha);
  }
  return buffer;
}

/**
 * Generates a peaceful stereo looping buffer of crickets chirping
 * in the meadow at night and dusk.
 */
function createCricketBuffer(context) {
  const duration = 5;
  const sampleRate = context.sampleRate;
  const totalSamples = sampleRate * duration;
  const buffer = context.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const crickets = [
    {
      freq: 4650,
      gain: 0.35,
      pan: -0.5,
      times: [0.4, 1.7, 3.1, 4.3],
      pulses: 4,
      len: 0.016,
      gap: 0.026,
    },
    {
      freq: 5050,
      gain: 0.28,
      pan: 0.6,
      times: [0.9, 2.3, 3.8],
      pulses: 3,
      len: 0.014,
      gap: 0.024,
    },
    {
      freq: 4850,
      gain: 0.22,
      pan: 0.2,
      times: [1.3, 2.8, 4.8],
      pulses: 3,
      len: 0.013,
      gap: 0.025,
    },
  ];

  for (const c of crickets) {
    const leftGain = c.gain * (1 - c.pan) * 0.5;
    const rightGain = c.gain * (1 + c.pan) * 0.5;
    for (const st of c.times) {
      for (let p = 0; p < c.pulses; p++) {
        const pStart = st + p * c.gap;
        const startSample = Math.floor(pStart * sampleRate);
        const pulseSamples = Math.floor(c.len * sampleRate);
        for (let i = 0; i < pulseSamples; i++) {
          const idx = (startSample + i) % totalSamples;
          const t = i / sampleRate;
          const env = Math.sin((i / pulseSamples) * Math.PI);
          const carrier = Math.sin(2 * Math.PI * c.freq * t);
          left[idx] += carrier * env * leftGain;
          right[idx] += carrier * env * rightGain;
        }
      }
    }
  }

  // Seamless crossfade loop
  const fadeLen = 4096;
  for (let i = 0; i < fadeLen; i++) {
    const alpha = i / fadeLen;
    const endIdx = totalSamples - fadeLen + i;
    left[i] = left[i] * alpha + left[endIdx] * (1 - alpha);
    right[i] = right[i] * alpha + right[endIdx] * (1 - alpha);
  }

  return buffer;
}

/**
 * Generates a peaceful stereo looping buffer of soft meadow breeze
 * when parked on land during the day.
 */
function createBreezeBuffer(context) {
  const duration = 5;
  const sampleRate = context.sampleRate;
  const totalSamples = sampleRate * duration;
  const buffer = context.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Deterministic seeded pseudo-random noise generator with zero DC offset
  let seedL = 48271;
  let seedR = 982451;
  const nextL = () => {
    seedL = (seedL * 16807) % 2147483647;
    return seedL / 1073741824 - 1;
  };
  const nextR = () => {
    seedR = (seedR * 16807) % 2147483647;
    return seedR / 1073741824 - 1;
  };

  let bz0L = 0;
  let bz1L = 0;
  let bz2L = 0;
  let bz0R = 0;
  let bz1R = 0;
  let bz2R = 0;
  let r0L = 0;
  let r1L = 0;
  let r0R = 0;
  let r1R = 0;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const wL1 = nextL();
    const wR1 = nextR();
    const wL2 = nextL();
    const wR2 = nextR();

    // Warm pink noise for wind body
    bz0L = 0.995 * bz0L + wL1 * 0.05;
    bz1L = 0.95 * bz1L + wL1 * 0.1;
    bz2L = 0.85 * bz2L + wL1 * 0.2;
    bz0R = 0.995 * bz0R + wR1 * 0.05;
    bz1R = 0.95 * bz1R + wR1 * 0.1;
    bz2R = 0.85 * bz2R + wR1 * 0.2;

    const lowNoiseL = (bz0L + bz1L + bz2L) * 0.5;
    const lowNoiseR = (bz0R + bz1R + bz2R) * 0.5;

    const swellL =
      0.5 +
      0.35 * Math.sin((2 * Math.PI * t) / 5.2) +
      0.15 * Math.sin((2 * Math.PI * t) / 2.7);
    const swellR =
      0.5 +
      0.35 * Math.sin((2 * Math.PI * t) / 5.6 + 0.9) +
      0.15 * Math.sin((2 * Math.PI * t) / 3.1);

    // Subtle meadow grass / foliage rustle
    r0L = 0.8 * r0L + wL2 * 0.2;
    r1L = 0.6 * r1L + (wL2 - r0L) * 0.2;
    r0R = 0.8 * r0R + wR2 * 0.2;
    r1R = 0.6 * r1R + (wR2 - r0R) * 0.2;

    const rustleL =
      r1L *
      Math.pow(
        Math.max(
          0,
          0.3 +
            0.4 * Math.sin((2 * Math.PI * t) / 5.2 + 0.4) +
            0.3 * Math.sin((2 * Math.PI * t) / 1.4)
        ),
        1.5
      );
    const rustleR =
      r1R *
      Math.pow(
        Math.max(
          0,
          0.3 +
            0.4 * Math.sin((2 * Math.PI * t) / 5.6 + 1.2) +
            0.3 * Math.sin((2 * Math.PI * t) / 1.6)
        ),
        1.5
      );

    left[i] = lowNoiseL * swellL * 0.75 + rustleL * 0.25;
    right[i] = lowNoiseR * swellR * 0.75 + rustleR * 0.25;
  }

  // Seamless crossfade loop
  const fadeLen = 4096;
  for (let i = 0; i < fadeLen; i++) {
    const alpha = i / fadeLen;
    const endIdx = totalSamples - fadeLen + i;
    left[i] = left[i] * alpha + left[endIdx] * (1 - alpha);
    right[i] = right[i] * alpha + right[endIdx] * (1 - alpha);
  }

  return buffer;
}

let suspendTimer = null;
let wasActive = false;
let isBackgrounded = false;

function isSfxActive() {
  return (
    sfxEnabled &&
    !state.isPaused &&
    !isBackgrounded &&
    (typeof document === 'undefined' || document.visibilityState !== 'hidden')
  );
}

/**
 * Runs the audio context only while sound effects are on, the game is
 * unpaused, and the app/page is in the foreground. Ramps masterGain to zero
 * on the audio thread before suspending so oscillators never cut mid-waveform.
 */
export function syncSfxState() {
  if (!audioCtx || !masterGain) return;
  clearTimeout(suspendTimer);
  suspendTimer = null;
  const active = isSfxActive();
  const now = audioCtx.currentTime;

  if (active) {
    if (!wasActive) {
      wasActive = true;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.setTargetAtTime(masterVolume, now, 0.05);
    }
    if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
      audioCtx.resume().catch(() => {});
    }
  } else {
    if (wasActive) {
      wasActive = false;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(0, now + 0.015);
    }
    if (audioCtx.state === 'running') {
      suspendTimer = setTimeout(() => {
        suspendTimer = null;
        if (audioCtx && !isSfxActive() && audioCtx.state === 'running') {
          audioCtx.suspend().catch(() => {});
        }
      }, 25);
    }
  }
}

export function setSfxBackgrounded(backgrounded) {
  isBackgrounded = !!backgrounded;
  syncSfxState();
}

export function setSfxVolume(vol) {
  masterVolume = THREE.MathUtils.clamp(vol, 0, 1);
  if (audioCtx && masterGain && isSfxActive() && audioCtx.state === 'running') {
    const now = audioCtx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.setTargetAtTime(masterVolume, now, 0.05);
  }
  syncSfxState();
}

/**
 * Initializes the Web Audio graph for sound effects.
 * Safe to call repeatedly; initializes only once.
 */
export function initAudioContext() {
  if (isInitialized || typeof window === 'undefined') {
    syncSfxState();
    return audioCtx;
  }

  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return null;

  try {
    audioCtx = new AudioContextClass();

    // Master SFX Bus
    const active = isSfxActive();
    wasActive = active;
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(
      active ? masterVolume : 0,
      audioCtx.currentTime
    );
    masterGain.connect(audioCtx.destination);

    // --- Wind rush (Pink noise bandpass) ---
    windSource = audioCtx.createBufferSource();
    windSource.buffer = createNoiseBuffer(audioCtx);
    windSource.loop = true;

    windFilter = audioCtx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(450, audioCtx.currentTime);
    windFilter.Q.setValueAtTime(0.85, audioCtx.currentTime);

    windGain = audioCtx.createGain();
    windGain.gain.setValueAtTime(0, audioCtx.currentTime);

    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(masterGain);
    windSource.start(0);

    // --- Stopped land crickets ambiance (night/dusk) ---
    cricketSource = audioCtx.createBufferSource();
    cricketSource.buffer = createCricketBuffer(audioCtx);
    cricketSource.loop = true;

    cricketGain = audioCtx.createGain();
    cricketGain.gain.setValueAtTime(0, audioCtx.currentTime);

    cricketSource.connect(cricketGain);
    cricketGain.connect(masterGain);
    cricketSource.start(0);

    // --- Stopped land meadow breeze ambiance (daytime) ---
    breezeSource = audioCtx.createBufferSource();
    breezeSource.buffer = createBreezeBuffer(audioCtx);
    breezeSource.loop = true;

    breezeFilter = audioCtx.createBiquadFilter();
    breezeFilter.type = 'lowpass';
    breezeFilter.frequency.setValueAtTime(360, audioCtx.currentTime);
    breezeFilter.Q.setValueAtTime(0.7, audioCtx.currentTime);

    breezeGain = audioCtx.createGain();
    breezeGain.gain.setValueAtTime(0, audioCtx.currentTime);

    breezeSource.connect(breezeFilter);
    breezeFilter.connect(breezeGain);
    breezeGain.connect(masterGain);
    breezeSource.start(0);

    // --- Engine synthesis ---
    // Primary oscillator (sawtooth for rich harmonic body)
    osc1 = audioCtx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(45, audioCtx.currentTime);

    // Secondary oscillator (triangle for mellow undertone / twin detune)
    osc2 = audioCtx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(47, audioCtx.currentTime);

    // Sub-harmonic oscillator (sub-octave thrum)
    oscSub = audioCtx.createOscillator();
    oscSub.type = 'triangle';
    oscSub.frequency.setValueAtTime(22.5, audioCtx.currentTime);

    oscSubGain = audioCtx.createGain();
    oscSubGain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    oscSub.connect(oscSubGain);

    // Warm low-pass filter to remove harsh digital frequencies
    engineFilter = audioCtx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.setValueAtTime(180, audioCtx.currentTime);
    engineFilter.Q.setValueAtTime(1.5, audioCtx.currentTime);

    // Upper-mid "rasp" from the sawtooth's harmonics, so the engine still
    // carries on phone and laptop speakers that can't play the low body
    raspFilter = audioCtx.createBiquadFilter();
    raspFilter.type = 'bandpass';
    raspFilter.frequency.setValueAtTime(400, audioCtx.currentTime);
    raspFilter.Q.setValueAtTime(0.9, audioCtx.currentTime);
    raspGain = audioCtx.createGain();
    raspGain.gain.setValueAtTime(2, audioCtx.currentTime);

    engineGain = audioCtx.createGain();
    engineGain.gain.setValueAtTime(0, audioCtx.currentTime);

    // Propeller blade chop: the LFO wobbles chopGain around 1
    chopGain = audioCtx.createGain();
    chopGain.gain.setValueAtTime(1, audioCtx.currentTime);

    lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(9, audioCtx.currentTime);

    lfoGain = audioCtx.createGain();
    lfoGain.gain.setValueAtTime(CHOP_DEPTH, audioCtx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(chopGain.gain);

    osc1.connect(engineFilter);
    osc2.connect(engineFilter);
    oscSubGain.connect(engineFilter);
    osc1.connect(raspFilter);
    raspFilter.connect(raspGain);
    engineFilter.connect(chopGain);
    raspGain.connect(chopGain);
    chopGain.connect(engineGain);
    engineGain.connect(masterGain);

    osc1.start(0);
    osc2.start(0);
    oscSub.start(0);
    lfo.start(0);

    isInitialized = true;
    log.info('Sound effects audio graph initialized');
  } catch (err) {
    log.warn('Could not initialize audio context:', err);
    return null;
  }

  audioCtx.addEventListener('statechange', () => {
    if (audioCtx && audioCtx.state === 'running' && !isSfxActive()) {
      syncSfxState();
    }
  });

  // Resume suspended AudioContext on user interaction (autoplay policy)
  const unlockAudio = () => syncSfxState();
  window.addEventListener('pointerdown', unlockAudio, {passive: true});
  window.addEventListener('keydown', unlockAudio, {passive: true});
  window.addEventListener('touchstart', unlockAudio, {passive: true});
  // Gains only change from the frame loop, which stops in hidden tabs and
  // backgrounded apps, so ramp down and suspend the context there instead.
  document.addEventListener('visibilitychange', syncSfxState);
  window.addEventListener('pagehide', () => setSfxBackgrounded(true));
  window.addEventListener('pageshow', () => setSfxBackgrounded(false));
  syncSfxState();

  return audioCtx;
}

/**
 * Toggles or sets the sound effects enabled state.
 */
export function setSfxEnabled(enabled) {
  sfxEnabled = enabled;
  if (ChillFlightLogic.SFX_PARAM === null) {
    try {
      localStorage.setItem(
        'chill_flight_sfx_enabled',
        enabled ? 'true' : 'false'
      );
    } catch {
      /* ignore */
    }
  }

  const sfxToggle = document.getElementById('sfx-toggle-input');
  if (sfxToggle && sfxToggle.checked !== enabled) {
    sfxToggle.checked = enabled;
  }

  if (enabled && !isInitialized) {
    initAudioContext();
  }

  syncSfxState();
}

/**
 * Updates SFX synthesis parameters every frame based on plane speed and type.
 */
export function updateSfx() {
  if (!isInitialized || !audioCtx) return;

  const active = isSfxActive();
  if (active !== wasActive) {
    syncSfxState();
  }
  if (!active) return;

  const speed = Math.max(0, state.flightSpeedMultiplier || 0);
  const targetSpeed = Math.max(0, state.targetFlightSpeed || 0);
  const throttleFactor = THREE.MathUtils.clamp(targetSpeed / 2.5, 0, 1);
  const planeType = planeTypeOverride || activePlaneType;
  const isStopped = speed < 0.05 && targetSpeed === 0;
  const speedFrac = THREE.MathUtils.clamp(speed / MAX_SPEED_MULT, 0, 1);
  // Engine loudness keeps rising up to top speed instead of flattening out
  const engineLoudness = 0.05 + 0.19 * Math.sqrt(speedFrac);

  // Stopped ambient soundscapes (crickets at night/dusk or gentle meadow breeze during day when parked on land)
  let targetCricketGain = 0;
  let targetBreezeGain = 0;

  if (isStopped && state.isOnGround) {
    // Transition from crickets (night/dusk) to meadow breeze (day) based on dayFactor
    // dayFactor: 0 = night, 1 = day
    const nightFactor = THREE.MathUtils.clamp(
      (0.55 - state.dayFactor) / 0.35,
      0,
      1
    );
    targetCricketGain = 0.45 * nightFactor;
    targetBreezeGain = 0.4 * (1 - nightFactor * 0.7);
  }

  cricketGain.gain.setTargetAtTime(
    targetCricketGain,
    audioCtx.currentTime,
    0.4
  );
  breezeGain.gain.setTargetAtTime(targetBreezeGain, audioCtx.currentTime, 0.4);

  if (planeType === 'glider') {
    // Gliders have no engine; only graceful wind rush scaling with airspeed
    engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);

    // As loud as a powered plane's engine, rising across the whole range
    const gliderWind =
      (0.18 + 0.7 * Math.sqrt(speedFrac)) *
      THREE.MathUtils.clamp(speed / 0.3, 0, 1);
    windGain.gain.setTargetAtTime(gliderWind, audioCtx.currentTime, 0.05);
    windFilter.frequency.setTargetAtTime(
      320 + speed * 280,
      audioCtx.currentTime,
      0.05
    );
    return;
  }

  if (isStopped) {
    // Engine idles at low murmur when plane is parked
    engineGain.gain.setTargetAtTime(0.03, audioCtx.currentTime, 0.1);
    windGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
    osc1.frequency.setTargetAtTime(36, audioCtx.currentTime, 0.1);
    osc2.frequency.setTargetAtTime(37.5, audioCtx.currentTime, 0.1);
    oscSub.frequency.setTargetAtTime(18, audioCtx.currentTime, 0.1);
    engineFilter.frequency.setTargetAtTime(130, audioCtx.currentTime, 0.1);
    raspFilter.frequency.setTargetAtTime(260, audioCtx.currentTime, 0.1);
    lfo.frequency.setTargetAtTime(5, audioCtx.currentTime, 0.1);
    return;
  }

  if (planeType === 'twin') {
    // Twin engine with acoustic beat frequency between props
    const f = 40 + speed * 26 + throttleFactor * 16;
    osc1.frequency.setTargetAtTime(f - 1.4, audioCtx.currentTime, 0.05);
    osc2.frequency.setTargetAtTime(f + 1.8, audioCtx.currentTime, 0.05);
    oscSub.frequency.setTargetAtTime(f * 0.5, audioCtx.currentTime, 0.05);
    lfo.frequency.setTargetAtTime(7 + speed * 6, audioCtx.currentTime, 0.05);

    const cutoff = 150 + speed * 160 + throttleFactor * 60;
    engineFilter.frequency.setTargetAtTime(cutoff, audioCtx.currentTime, 0.05);

    raspFilter.frequency.setTargetAtTime(f * 6, audioCtx.currentTime, 0.05);
    engineGain.gain.setTargetAtTime(
      engineLoudness * 1.05,
      audioCtx.currentTime,
      0.05
    );

    // Subtle wind rush
    windGain.gain.setTargetAtTime(speed * 0.06, audioCtx.currentTime, 0.05);
    windFilter.frequency.setTargetAtTime(
      380 + speed * 220,
      audioCtx.currentTime,
      0.05
    );
  } else {
    // Single-engine prop plane (seaplane or biplane)
    const isBiplane = planeType === 'biplane';
    const f = (isBiplane ? 43 : 46) + speed * 28 + throttleFactor * 16;

    osc1.frequency.setTargetAtTime(f, audioCtx.currentTime, 0.05);
    osc2.frequency.setTargetAtTime(
      f * (isBiplane ? 1.5 : 1.02),
      audioCtx.currentTime,
      0.05
    );
    oscSub.frequency.setTargetAtTime(f * 0.5, audioCtx.currentTime, 0.05);
    lfo.frequency.setTargetAtTime(8 + speed * 7, audioCtx.currentTime, 0.05);

    const cutoff = (isBiplane ? 150 : 165) + speed * 180 + throttleFactor * 70;
    engineFilter.frequency.setTargetAtTime(cutoff, audioCtx.currentTime, 0.05);

    raspFilter.frequency.setTargetAtTime(f * 6, audioCtx.currentTime, 0.05);
    engineGain.gain.setTargetAtTime(engineLoudness, audioCtx.currentTime, 0.05);

    // Subtle wind rush
    windGain.gain.setTargetAtTime(speed * 0.05, audioCtx.currentTime, 0.05);
    windFilter.frequency.setTargetAtTime(
      380 + speed * 200,
      audioCtx.currentTime,
      0.05
    );
  }
}

/**
 * The sound effects bus (master gain) other sound modules connect to, or
 * null before the audio graph exists.
 */
export function getSfxBus() {
  return masterGain;
}

/**
 * Returns the active AudioContext instance (or null if not initialized).
 */
export function getAudioContext() {
  return audioCtx;
}

/**
 * Returns references to internal audio nodes for diagnostics and debug tools.
 */
export function getSfxNodes() {
  return {
    masterGain,
    engineGain,
    engineFilter,
    raspFilter,
    raspGain,
    chopGain,
    osc1,
    osc2,
    oscSub,
    oscSubGain,
    lfo,
    lfoGain,
    windGain,
    windFilter,
    windSource,
    cricketGain,
    cricketSource,
    breezeGain,
    breezeFilter,
    breezeSource,
  };
}

export {createNoiseBuffer, createCricketBuffer, createBreezeBuffer};
