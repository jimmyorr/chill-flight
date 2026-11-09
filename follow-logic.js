// --- CAMERA FOLLOW ---
// The chase camera trails the vehicle like a spring: each frame it closes a
// share of the gap to where it wants to be. Done per frame with a fixed
// share, the gap it settles at depends on the frame's length, so when
// frames alternate between one and two screen refreshes (40 fps on a 60 Hz
// phone) the camera surges and drops back every frame and the ground seems
// to lurch. This works the spring out exactly over the frame, taking the
// target as moving steadily across it, so a vehicle at a steady speed is
// followed at the same distance whatever the frame lengths.

/**
 * Moves `cur` (x, y, z, changed in place) after `ideal` for `dt` seconds:
 * `ideal` is where it should be now, `prevIdeal` where it was last frame,
 * `rate` how fast the gap closes (per second). A target that moved faster
 * than `maxSpeed` units a second (a teleport, a vehicle swap) keeps the
 * camera where it was relative to it. (Faster than any vehicle's throttle:
 * the jet tops out at 1100 units/s, though a crystal rush takes it further
 * and passes its own speed in; a teleport jumps 300+ units in a frame of at
 * most 0.1 s.)
 */
export function followStep(cur, ideal, prevIdeal, dt, rate, maxSpeed = 2500) {
  if (!(dt > 0)) return cur;
  const e = Math.exp(-rate * dt);
  const jx = ideal.x - prevIdeal.x;
  const jy = ideal.y - prevIdeal.y;
  const jz = ideal.z - prevIdeal.z;
  // The steady lag behind a target moving at this speed (speed / rate)
  let lx = 0;
  let ly = 0;
  let lz = 0;
  const reach = maxSpeed * dt;
  if (jx * jx + jy * jy + jz * jz <= reach * reach) {
    const s = 1 / (rate * dt);
    lx = jx * s;
    ly = jy * s;
    lz = jz * s;
  }
  cur.x = ideal.x - lx + (cur.x - prevIdeal.x + lx) * e;
  cur.y = ideal.y - ly + (cur.y - prevIdeal.y + ly) * e;
  cur.z = ideal.z - lz + (cur.z - prevIdeal.z + lz) * e;
  return cur;
}

// The rate that trails a steady target by as much as closing a quarter of
// the gap each 60 Hz frame did: 0.25 / 0.75 of a frame's travel a frame
export const FOLLOW_RATE = 60 * (0.25 / 0.75);
