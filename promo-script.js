// Scripted flight for promo clips (scripts/promo.js). A shot's `moves` are
// keyframes [t, rollDeg, pitchDeg, yawDeg]: t in seconds from the start of
// filming, roll positive to the left (left wing down), pitch positive nose up,
// and optional yawDeg (degrees from entry heading) for aerobatic loops and
// quarter clover loops. Any channel may be null at an intermediate keyframe to
// ease uninterrupted between its surrounding keyframes. Values ease between
// keyframes and hold after the last one. The promo script sends them in a
// `promo-script` event when filming starts, and game-loop.js then flies the
// plane from them in place of the controls. Normal play never sends the event,
// so nothing here runs for players.

const DEG = Math.PI / 180;

function channelAt(moves, t, index) {
  let i0 = 0;
  for (let i = 0; i < moves.length; i++) {
    if (moves[i][index] != null && moves[i][0] <= t) i0 = i;
  }
  let i1 = i0;
  for (let i = i0 + 1; i < moves.length; i++) {
    if (moves[i][index] != null) {
      i1 = i;
      break;
    }
  }
  const t0 = moves[i0][0];
  const v0 = moves[i0][index] ?? 0;
  const t1 = moves[i1][0];
  const v1 = moves[i1][index] ?? v0;
  const u = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 1;
  const s = u * u * (3 - 2 * u);
  return (v0 + (v1 - v0) * s) * DEG;
}

// The roll, pitch and yaw (radians) at t seconds, from the keyframes
export function attitudeAt(moves, t) {
  const loop = moves.some(
    (m) => Math.abs(m[2] ?? 0) > 75 || Math.abs(m[3] ?? 0) > 0
  );
  return {
    roll: channelAt(moves, t, 1),
    pitch: channelAt(moves, t, 2),
    yaw: channelAt(moves, t, 3),
    loop,
  };
}

// The scripted attitude for a game time `now` (performance.now), with the
// keyframes starting at `start`
export function scriptedFlight(moves, start) {
  return (now) => attitudeAt(moves, (now - start) / 1000);
}
