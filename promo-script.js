// Scripted flight for promo clips (scripts/promo.js). A shot's `moves` are
// keyframes [t, rollDeg, pitchDeg]: t in seconds from the start of filming,
// roll positive to the left (left wing down), pitch positive nose up. Values
// ease between keyframes and hold after the last one. The promo script sends
// them in a `promo-script` event when filming starts, and game-loop.js then
// flies the plane from them in place of the controls; the flight model does
// the rest (a bank turns the plane, a pull up climbs it). Normal play never
// sends the event, so nothing here runs for players.

const DEG = Math.PI / 180;

// The roll and pitch (radians) at t seconds, from the keyframes
export function attitudeAt(moves, t) {
  let i = 0;
  while (i < moves.length - 2 && t >= moves[i + 1][0]) i++;
  const [t0, roll0, pitch0] = moves[i];
  const [t1, roll1, pitch1] = moves[Math.min(i + 1, moves.length - 1)];
  const u = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 1;
  const s = u * u * (3 - 2 * u);
  return {
    roll: (roll0 + (roll1 - roll0) * s) * DEG,
    pitch: (pitch0 + (pitch1 - pitch0) * s) * DEG,
  };
}

// The scripted attitude for a game time `now` (performance.now), with the
// keyframes starting at `start`
export function scriptedFlight(moves, start) {
  return (now) => attitudeAt(moves, (now - start) / 1000);
}
