// Scripted flight, camera, buggy driving, and pose replay for promo clips
// (scripts/promo.js, scripts/shorts.js).
// - Flight `moves`: [t, rollDeg, pitchDeg, yawDeg, speedMult]
//   t in seconds from filming start, roll positive left wing down, pitch
//   positive nose up, optional yawDeg (degrees from entry heading), and
//   optional speedMult (throttle multiplier). Any channel may be null at an
//   intermediate keyframe to ease uninterrupted between surrounding keyframes.
// - Camera `camMoves`: [t, ox, oy, oz, lx, ly, lz, fov, orbitYawDeg, orbitPitchDeg]
//   Any channel may be null or omitted to leave that parameter untouched or
//   ease across intermediate keyframes.
// - Buggy `driveMoves`: [t, steer, throttle, slide, hop]
// - Pose `replay`: {fps, plane, frames: [[t, x, y, z, rx, ry, rz, speed, flags, slide, slip, gear], ...]}
// Normal play never dispatches promo events, so nothing here runs for players.

const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;

// Fritsch-Carlson monotone cubic Hermite interpolation across active keyframes
// for `index` (skipping null/undefined intermediate entries). Hits every
// keyframe `(t_k, v_k)` exactly, starts and ends with zero slope (`m_0 = 0`,
// `m_{n-1} = 0`), never overshoots flat plateaus or extrema, and keeps smooth
// non-zero velocity across interior keyframes moving in the same direction.
export function rawChannelAt(moves, t, index, fallback = null) {
  if (!Array.isArray(moves) || moves.length === 0) return fallback;
  const pts = [];
  for (let i = 0; i < moves.length; i++) {
    const val = moves[i]?.[index];
    if (val != null) {
      pts.push([moves[i][0], val]);
    }
  }
  const n = pts.length;
  if (n === 0) return fallback;
  if (n === 1 || t <= pts[0][0]) return pts[0][1];
  if (t >= pts[n - 1][0]) return pts[n - 1][1];

  const d = new Array(n - 1);
  const h = new Array(n - 1);
  for (let k = 0; k < n - 1; k++) {
    const dt = pts[k + 1][0] - pts[k][0];
    h[k] = dt;
    d[k] = dt > 0 ? (pts[k + 1][1] - pts[k][1]) / dt : 0;
  }

  const m = new Array(n).fill(0);
  for (let k = 1; k < n - 1; k++) {
    if (d[k - 1] !== 0 && d[k] !== 0 && d[k - 1] * d[k] > 0) {
      const w0 = 2 * h[k] + h[k - 1];
      const w1 = h[k] + 2 * h[k - 1];
      m[k] = (w0 + w1) / (w0 / d[k - 1] + w1 / d[k]);
    }
  }

  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) {
      m[k] = 0;
      m[k + 1] = 0;
    } else {
      const a = m[k] / d[k];
      const b = m[k + 1] / d[k];
      const hyp = Math.hypot(a, b);
      if (hyp > 3) {
        const tau = 3 / hyp;
        m[k] = tau * a * d[k];
        m[k + 1] = tau * b * d[k];
      }
    }
  }

  let seg = 0;
  for (let k = 0; k < n - 1; k++) {
    if (pts[k][0] <= t) seg = k;
    else break;
  }
  const span = h[seg];
  if (!(span > 0)) return pts[seg][1];
  const u = Math.min(1, Math.max(0, (t - pts[seg][0]) / span));
  const u2 = u * u;
  const u3 = u2 * u;
  const v0 = pts[seg][1];
  const v1 = pts[seg + 1][1];
  return (
    (2 * u3 - 3 * u2 + 1) * v0 +
    (u3 - 2 * u2 + u) * span * m[seg] +
    (-2 * u3 + 3 * u2) * v1 +
    (u3 - u2) * span * m[seg + 1]
  );
}

function channelAt(moves, t, index) {
  return (rawChannelAt(moves, t, index, 0) ?? 0) * DEG;
}

function lerpWrappedAngle(a, b, u) {
  let diff = (b - a) % TWO_PI;
  if (diff > Math.PI) diff -= TWO_PI;
  else if (diff < -Math.PI) diff += TWO_PI;
  return a + diff * u;
}

// The roll, pitch, yaw (radians) and optional speed multiplier at t seconds
export function attitudeAt(moves, t, opts = {}) {
  const autoLoop = moves.some(
    (m) => Math.abs(m[2] ?? 0) > 75 || Math.abs(m[3] ?? 0) > 0
  );
  const loop =
    opts.direct !== undefined
      ? Boolean(opts.direct)
      : Boolean(opts.surface) || autoLoop;
  return {
    roll: channelAt(moves, t, 1),
    pitch: channelAt(moves, t, 2),
    yaw: channelAt(moves, t, 3),
    speed: rawChannelAt(moves, t, 4, null),
    loop,
    surface: Boolean(opts.surface),
  };
}

// The scripted attitude for a game time `now` (performance.now), with the
// keyframes starting at `start`. Accepts a `moves` array or `{moves, direct, surface}`.
export function scriptedFlight(spec, start) {
  const moves = Array.isArray(spec) ? spec : spec?.moves || [[0, 0, 0, 0]];
  const opts = Array.isArray(spec)
    ? {}
    : {direct: spec?.direct, surface: spec?.surface};
  return (now) => attitudeAt(moves, (now - start) / 1000, opts);
}

// Keyframed camera parameters at `t` seconds:
// [t, ox, oy, oz, lx, ly, lz, fov, orbitYawDeg, orbitPitchDeg]
export function cameraAt(camMoves, t) {
  const orbitYawDeg = rawChannelAt(camMoves, t, 8, null);
  const orbitPitchDeg = rawChannelAt(camMoves, t, 9, null);
  return {
    ox: rawChannelAt(camMoves, t, 1, null),
    oy: rawChannelAt(camMoves, t, 2, null),
    oz: rawChannelAt(camMoves, t, 3, null),
    lx: rawChannelAt(camMoves, t, 4, null),
    ly: rawChannelAt(camMoves, t, 5, null),
    lz: rawChannelAt(camMoves, t, 6, null),
    fov: rawChannelAt(camMoves, t, 7, null),
    orbitYaw: orbitYawDeg === null ? null : orbitYawDeg * DEG,
    orbitPitch: orbitPitchDeg === null ? null : orbitPitchDeg * DEG,
  };
}

export function scriptedCamera(camMoves, start) {
  return (now) => cameraAt(camMoves, (now - start) / 1000);
}

// Keyframed buggy inputs at `t` seconds: [t, steer, throttle, slide, hop]
export function driveAt(driveMoves, t) {
  return {
    steer: rawChannelAt(driveMoves, t, 1, 0) ?? 0,
    throttle: rawChannelAt(driveMoves, t, 2, 0) ?? 0,
    slide: (rawChannelAt(driveMoves, t, 3, 0) ?? 0) >= 0.5,
    hop: (rawChannelAt(driveMoves, t, 4, 0) ?? 0) >= 0.5,
  };
}

export function scriptedDrive(driveMoves, start) {
  return (now) => driveAt(driveMoves, (now - start) / 1000);
}

// Virtual human pilot inputs at `t` seconds:
// - `stick`: [[t, steerX (-1 left .. +1 right), steerY (-1 dive .. +1 climb), throttle], ...]
// - `stunts`: [[tStart, tEnd, kind], ...] where `kind` is one of:
//   'roll-left' | 'roll-right' | 'sharp-left' | 'sharp-right' | 'loop' |
//   'immelmann' | 'climb' | 'steep-climb' | 'dive' | 'steep-dive'
// Feeds straight into the real flight controls & physics in game-loop.js.
export function pilotAt(pilotSpec, t) {
  if (!pilotSpec || t < 0) {
    return {steerX: 0, steerY: 0, throttle: null, stunt: null};
  }
  const stick = Array.isArray(pilotSpec) ? pilotSpec : pilotSpec.stick || [];
  const stunts = Array.isArray(pilotSpec) ? [] : pilotSpec.stunts || [];
  let stunt = null;
  for (let i = 0; i < stunts.length; i++) {
    const s = stunts[i];
    if (s && t >= s[0] && t < s[1]) {
      stunt = s[2] || null;
    }
  }
  return {
    steerX: rawChannelAt(stick, t, 1, 0) ?? 0,
    steerY: rawChannelAt(stick, t, 2, 0) ?? 0,
    throttle: rawChannelAt(stick, t, 3, null),
    stunt,
  };
}

export function scriptedPilot(pilotSpec, start) {
  return (now) => pilotAt(pilotSpec, (now - start) / 1000);
}

// Interpolated vehicle pose at `t` seconds from recorded frames:
// [t, x, y, z, rx, ry, rz, speed, flags, slide, slip, gear]
export function replayAt(replay, t) {
  const frames = Array.isArray(replay) ? replay : replay?.frames;
  if (!Array.isArray(frames) || frames.length === 0) return null;
  if (t <= frames[0][0] || frames.length === 1) {
    const f = frames[0];
    const flags = f[8] ?? 0;
    return {
      x: f[1],
      y: f[2],
      z: f[3],
      rx: f[4] ?? 0,
      ry: f[5] ?? 0,
      rz: f[6] ?? 0,
      speed: f[7] ?? 1,
      isOnWater: Boolean(flags & 1),
      isOnGround: Boolean(flags & 2),
      slide: f[9] ?? 0,
      slip: f[10] ?? 0,
      gear: f[11] ?? 0,
    };
  }
  const last = frames[frames.length - 1];
  if (t >= last[0]) {
    const flags = last[8] ?? 0;
    return {
      x: last[1],
      y: last[2],
      z: last[3],
      rx: last[4] ?? 0,
      ry: last[5] ?? 0,
      rz: last[6] ?? 0,
      speed: last[7] ?? 1,
      isOnWater: Boolean(flags & 1),
      isOnGround: Boolean(flags & 2),
      slide: last[9] ?? 0,
      slip: last[10] ?? 0,
      gear: last[11] ?? 0,
    };
  }
  let lo = 0;
  let hi = frames.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid][0] <= t) lo = mid;
    else hi = mid;
  }
  const f0 = frames[lo];
  const f1 = frames[hi];
  const dt = f1[0] - f0[0];
  const u = dt > 0 ? Math.min(1, Math.max(0, (t - f0[0]) / dt)) : 0;
  const nearFlags = (u < 0.5 ? f0[8] : f1[8]) ?? 0;
  return {
    x: f0[1] + (f1[1] - f0[1]) * u,
    y: f0[2] + (f1[2] - f0[2]) * u,
    z: f0[3] + (f1[3] - f0[3]) * u,
    rx: lerpWrappedAngle(f0[4] ?? 0, f1[4] ?? 0, u),
    ry: lerpWrappedAngle(f0[5] ?? 0, f1[5] ?? 0, u),
    rz: lerpWrappedAngle(f0[6] ?? 0, f1[6] ?? 0, u),
    speed: (f0[7] ?? 1) + ((f1[7] ?? 1) - (f0[7] ?? 1)) * u,
    isOnWater: Boolean(nearFlags & 1),
    isOnGround: Boolean(nearFlags & 2),
    slide: (f0[9] ?? 0) + ((f1[9] ?? 0) - (f0[9] ?? 0)) * u,
    slip: lerpWrappedAngle(f0[10] ?? 0, f1[10] ?? 0, u),
    gear: (f0[11] ?? 0) + ((f1[11] ?? 0) - (f0[11] ?? 0)) * u,
  };
}

export function scriptedReplay(replay, start) {
  return (now) => replayAt(replay, (now - start) / 1000);
}

// Back-solves spawn `(x, y, z)` so that after `prerollSec` of level flight at
// `speedMult` plus `targetFrame` frames of `moves`, the plane hits `(tx, ty, tz)`.
export function solveStartCoords({
  tx,
  ty,
  tz,
  headingDeg = 0,
  speedMult = 1,
  moves = [[0, 0, 0, 0]],
  targetFrame = 0,
  prerollSec = 1.5,
  fps = 30,
  loopDip = false,
  baseSpeed = 3.0,
  dipAmount = 0.15,
  round = true,
}) {
  const dt = 1 / fps;
  const baseYaw = headingDeg * DEG;
  const prerollSteps = Math.round(prerollSec * fps);
  const prerollStepDist = speedMult * baseSpeed * (dt * 60);
  let dx = -Math.sin(baseYaw) * prerollStepDist * prerollSteps;
  let dy = 0;
  let dz = -Math.cos(baseYaw) * prerollStepDist * prerollSteps;

  for (let i = 0; i < targetFrame; i++) {
    const att = attitudeAt(moves, (i + 1) / fps);
    const yaw = baseYaw + att.yaw;
    const pitch = att.pitch;
    const mult = att.speed ?? speedMult;
    const stepDist = mult * baseSpeed * (dt * 60);
    const effStep = loopDip
      ? stepDist * (1 - (dipAmount * (1 - Math.cos(pitch))) / 2)
      : stepDist;
    dx += -Math.sin(yaw) * Math.cos(pitch) * effStep;
    dy += Math.sin(pitch) * effStep;
    dz += -Math.cos(yaw) * Math.cos(pitch) * effStep;
  }
  const rx = tx - dx;
  const ry = ty - dy;
  const rz = tz - dz;
  return round
    ? {x: Math.round(rx), y: Math.round(ry), z: Math.round(rz)}
    : {x: rx, y: ry, z: rz};
}

// Steps the deterministic flight path from `-prerollSteps` through `endFrame`,
// returning `{frame, t, x, y, z, roll, pitch, yaw, speed}` samples for
// collision checks and independent wingman splines.
export function traceScriptedTrajectory({
  x = 0,
  y = 0,
  z = 0,
  headingDeg = 0,
  speedMult = 1,
  moves = [[0, 0, 0, 0]],
  endFrame = 0,
  prerollSec = 1.5,
  fps = 30,
  loopDip = false,
  baseSpeed = 3.0,
  dipAmount = 0.15,
}) {
  const dt = 1 / fps;
  const baseYaw = headingDeg * DEG;
  const prerollSteps = Math.round(prerollSec * fps);
  const prerollStepDist = speedMult * baseSpeed * (dt * 60);
  let px = x;
  let py = y;
  let pz = z;
  const samples = [
    {
      frame: -prerollSteps,
      t: -prerollSec,
      x: px,
      y: py,
      z: pz,
      roll: 0,
      pitch: 0,
      yaw: baseYaw,
      speed: speedMult,
    },
  ];
  for (let s = 1; s <= prerollSteps; s++) {
    px += -Math.sin(baseYaw) * prerollStepDist;
    pz += -Math.cos(baseYaw) * prerollStepDist;
    samples.push({
      frame: -prerollSteps + s,
      t: (-prerollSteps + s) / fps,
      x: px,
      y: py,
      z: pz,
      roll: 0,
      pitch: 0,
      yaw: baseYaw,
      speed: speedMult,
    });
  }
  for (let i = 0; i < endFrame; i++) {
    const t = (i + 1) / fps;
    const att = attitudeAt(moves, t);
    const yaw = baseYaw + att.yaw;
    const pitch = att.pitch;
    const mult = att.speed ?? speedMult;
    const stepDist = mult * baseSpeed * (dt * 60);
    const effStep = loopDip
      ? stepDist * (1 - (dipAmount * (1 - Math.cos(pitch))) / 2)
      : stepDist;
    px += -Math.sin(yaw) * Math.cos(pitch) * effStep;
    py += Math.sin(pitch) * effStep;
    pz += -Math.cos(yaw) * Math.cos(pitch) * effStep;
    samples.push({
      frame: i + 1,
      t,
      x: px,
      y: py,
      z: pz,
      roll: att.roll,
      pitch,
      yaw,
      speed: mult,
    });
  }
  return samples;
}
