// --- MUSHROOM TRIP ENVELOPE & WATER RESET: THE MATHS ---
// Pure state machine for mushroom-trip.js (no three.js or DOM), so it can be
// tested deterministically in Node (scripts/test-breakables.js).
//
// Knocking an eastern alien mushroom starts a slow, decoupled sky (~22 s) and
// moon (~42 s) ramp-in, holds for ~68-105 s (small to giant, stacking across a
// grove), and fades gently back out. Touching the water immediately ends the
// trip at any stage.

export const TRIP = {
  SKY_RAMP_IN: 22,
  MOON_RAMP_IN: 42,
  ACTIVE_SMALL: 68,
  ACTIVE_GIANT: 105,
  SKY_FADE_OUT: 24,
  MOON_FADE_OUT: 30,
  PEAK_SMALL: 0.68,
  STACK_GAIN: 0.24,
  CLOUD_DRIFT_GAIN: 2.4,
  PHASE_CYCLE_MS: 29.5 * 360000,
  TRAIL_MIN: 0.06,
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function makeChannel() {
  return {val: 0, from: 0, target: 0, age: 0, dur: 1, mode: 'idle'};
}

function resetChannel(ch) {
  ch.val = 0;
  ch.from = 0;
  ch.target = 0;
  ch.age = 0;
  ch.dur = 1;
  ch.mode = 'idle';
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
    const u = clamp(ch.age / ch.dur, 0, 1);
    // Cubic smoothstep (max slope 1.5x linear, gentler than smootherstep's
    // 2.19x) so the middle of the moon's 42 s swell stays slow and steady
    const s = u * u * (3 - 2 * u);
    ch.val = lerp(ch.from, ch.target, s);
    if (ch.age >= ch.dur) {
      ch.val = ch.target;
      ch.mode = 'hold';
    }
  } else if (ch.mode === 'fade') {
    ch.age += delta;
    const u = clamp(ch.age / ch.dur, 0, 1);
    const s = u * u * (3 - 2 * u);
    ch.val = ch.from * (1 - s);
    if (ch.age >= ch.dur || ch.val <= 0.0005) {
      ch.val = 0;
      ch.target = 0;
      ch.mode = 'idle';
    }
  }
}

export function createTripState() {
  return {
    sky: makeChannel(),
    moon: makeChannel(),
    peak: 0,
    activeLeft: 0,
    clock: 0,
    phaseStartAngle: 0,
  };
}

export function isTripIdle(trip) {
  return trip.sky.mode === 'idle' && trip.moon.mode === 'idle';
}

export function isTripTrailActive(trip) {
  return (
    trip.sky.mode !== 'idle' &&
    (trip.activeLeft > 0 ||
      Math.max(trip.sky.val, trip.moon.val) > TRIP.TRAIL_MIN)
  );
}

/** Immediately ends an active trip, resetting both channels to idle. */
export function endTripState(trip) {
  resetChannel(trip.sky);
  resetChannel(trip.moon);
  trip.peak = 0;
  trip.activeLeft = 0;
}

/** Starts (or stacks smoothly onto) a trip: `size` 0-1 from small to giant. */
export function startTripState(trip, size, worldNow = 0) {
  const s = clamp(size, 0, 1);
  const hitPeak = lerp(TRIP.PEAK_SMALL, 1, Math.pow(s, 0.6));
  const nextActive = lerp(TRIP.ACTIVE_SMALL, TRIP.ACTIVE_GIANT, s);
  const idle = trip.sky.val <= 0.001 && trip.moon.val <= 0.001;

  if (idle) {
    trip.phaseStartAngle =
      (((worldNow || 0) % TRIP.PHASE_CYCLE_MS) / TRIP.PHASE_CYCLE_MS) *
      Math.PI *
      2;
    trip.clock = 0;
    trip.peak = hitPeak;
    trip.activeLeft = nextActive;
    trip.sky.val = 0;
    trip.moon.val = 0;
    rampChannel(trip.sky, trip.peak, TRIP.SKY_RAMP_IN);
    rampChannel(trip.moon, trip.peak, TRIP.MOON_RAMP_IN);
  } else {
    const liveBase = Math.max(trip.sky.val, trip.moon.val);
    trip.peak = Math.min(
      1,
      Math.max(
        trip.peak,
        liveBase + TRIP.STACK_GAIN * (0.55 + 0.45 * s),
        hitPeak
      )
    );
    trip.activeLeft = Math.max(trip.activeLeft, nextActive);
    rampChannel(trip.sky, trip.peak, TRIP.SKY_RAMP_IN);
    rampChannel(trip.moon, trip.peak, TRIP.MOON_RAMP_IN);
  }
}

/**
 * Advances the sky and moon envelopes by `delta` seconds.
 * Touching the water (`touchingWater`) immediately ends any active trip.
 * Returns extra cloud-drift seconds to add to `state.cloudTime` this frame.
 */
export function stepTripState(trip, delta, touchingWater = false) {
  if (touchingWater) {
    endTripState(trip);
    return 0;
  }
  if (delta <= 0 || isTripIdle(trip)) return 0;

  trip.clock += delta;
  if (trip.activeLeft > 0) {
    trip.activeLeft -= delta;
    if (trip.activeLeft <= 0) {
      trip.activeLeft = 0;
      beginFadeChannel(trip.sky, TRIP.SKY_FADE_OUT);
      beginFadeChannel(trip.moon, TRIP.MOON_FADE_OUT);
    }
  }

  stepChannel(trip.sky, delta);
  stepChannel(trip.moon, delta);

  return trip.sky.val > 0 ? delta * TRIP.CLOUD_DRIFT_GAIN * trip.sky.val : 0;
}
