// --- SOUND EFFECTS & PROCEDURAL AUDIO ---
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {state} from './state.js';
import {activePlaneType} from './airplane.js';
import {log} from './logger.js';

// ?sfx=0/1 overrides the saved setting for this visit (and changes made
// during it aren't saved).
export let sfxEnabled =
  ChillFlightLogic.SFX_PARAM !== null
    ? ChillFlightLogic.SFX_PARAM
    : localStorage.getItem('chill_flight_sfx_enabled') !== 'false';

// Master SFX volume relative to music (which plays at 0.5)
export const SFX_VOLUME = 0.45;

let audioCtx = null;
let masterGain = null;
let engineGain = null;
let engineFilter = null;
let osc1 = null;
let osc2 = null;
let oscSub = null;
let oscSubGain = null;
let lfo = null;
let lfoGain = null;
let windGain = null;
let windFilter = null;
let windSource = null;
let isInitialized = false;

/**
 * Generates a smooth, looping pink/brown noise buffer for wind rush.
 */
function createNoiseBuffer(context) {
  const bufferSize = context.sampleRate * 2;
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const output = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99 * b0 + white * 0.05;
    b1 = 0.95 * b1 + white * 0.1;
    b2 = 0.85 * b2 + white * 0.2;
    output[i] = (b0 + b1 + b2) * 0.6;
  }
  return buffer;
}

/**
 * Initializes the Web Audio graph for sound effects.
 * Safe to call repeatedly; initializes only once.
 */
export function initAudioContext() {
  if (isInitialized || typeof window === 'undefined') return audioCtx;

  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return null;

  try {
    audioCtx = new AudioContextClass();

    // Master SFX Bus
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(
      sfxEnabled && !state.isPaused ? SFX_VOLUME : 0,
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

    engineGain = audioCtx.createGain();
    engineGain.gain.setValueAtTime(0, audioCtx.currentTime);

    // Propeller blade chop modulation via LFO
    lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(9, audioCtx.currentTime);

    lfoGain = audioCtx.createGain();
    lfoGain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    lfo.connect(lfoGain);

    osc1.connect(engineFilter);
    osc2.connect(engineFilter);
    oscSubGain.connect(engineFilter);
    engineFilter.connect(engineGain);
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

  // Resume suspended AudioContext on user interaction
  const unlockAudio = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  };
  window.addEventListener('pointerdown', unlockAudio, {passive: true});
  window.addEventListener('keydown', unlockAudio, {passive: true});
  window.addEventListener('touchstart', unlockAudio, {passive: true});

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

  if (audioCtx && masterGain) {
    const targetGain = enabled && !state.isPaused ? SFX_VOLUME : 0;
    masterGain.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.05);
  }
}

/**
 * Updates SFX synthesis parameters every frame based on plane speed and type.
 */
export function updateSfx(delta) {
  if (!isInitialized || !audioCtx) return;

  const targetMasterGain = sfxEnabled && !state.isPaused ? SFX_VOLUME : 0;
  masterGain.gain.setTargetAtTime(targetMasterGain, audioCtx.currentTime, 0.08);

  if (!sfxEnabled || state.isPaused) return;

  const speed = Math.max(0, state.flightSpeedMultiplier || 0);
  const targetSpeed = Math.max(0, state.targetFlightSpeed || 0);
  const throttleFactor = THREE.MathUtils.clamp(targetSpeed / 2.5, 0, 1);
  const planeType = activePlaneType;
  const isStopped = speed < 0.02 && targetSpeed === 0;

  if (planeType === 'glider') {
    // Gliders have no engine; only graceful wind rush scaling with airspeed
    engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);

    const gliderWind = THREE.MathUtils.clamp(speed * 0.22, 0, 0.35);
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
    engineGain.gain.setTargetAtTime(0.02, audioCtx.currentTime, 0.1);
    windGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
    osc1.frequency.setTargetAtTime(36, audioCtx.currentTime, 0.1);
    osc2.frequency.setTargetAtTime(37.5, audioCtx.currentTime, 0.1);
    oscSub.frequency.setTargetAtTime(18, audioCtx.currentTime, 0.1);
    engineFilter.frequency.setTargetAtTime(130, audioCtx.currentTime, 0.1);
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

    const targetEngineGain =
      0.04 + THREE.MathUtils.clamp(speed * 0.14, 0, 0.16);
    engineGain.gain.setTargetAtTime(
      targetEngineGain,
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

    const targetEngineGain =
      0.04 + THREE.MathUtils.clamp(speed * 0.13, 0, 0.15);
    engineGain.gain.setTargetAtTime(
      targetEngineGain,
      audioCtx.currentTime,
      0.05
    );

    // Subtle wind rush
    windGain.gain.setTargetAtTime(speed * 0.05, audioCtx.currentTime, 0.05);
    windFilter.frequency.setTargetAtTime(
      380 + speed * 200,
      audioCtx.currentTime,
      0.05
    );
  }
}
