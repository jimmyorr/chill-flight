// Motion must not depend on how long each frame takes. When a phone can't
// hold 60 fps, frames alternate between one and two screen refreshes; any
// step that assumes even frames makes the view lurch back and forth.
import {readFileSync} from 'node:fs';
import {followStep, FOLLOW_RATE} from '../follow-logic.js';

let failed = false;
function check(name, ok, detail = '') {
  console.log(
    `  ${ok ? 'Passed' : 'FAILED'}: ${name}${detail ? ` (${detail})` : ''}`
  );
  if (!ok) failed = true;
}

console.log('Testing frame timing...');

// A target flying at a steady 77 m/s, followed through uneven frames: the
// camera's lag behind it must stay the same every frame
function lagSpread(step, frames) {
  const cur = {x: 0, y: 0, z: 0};
  const prev = {x: 0, y: 0, z: 0};
  let t = 0;
  const lags = [];
  for (let i = 0; i < 400; i++) {
    const dt = frames[i % frames.length];
    t += dt;
    const ideal = {x: 77 * t, y: 0, z: 0};
    step(cur, ideal, prev, dt);
    Object.assign(prev, ideal);
    if (i > 200) lags.push(ideal.x - cur.x);
  }
  return Math.max(...lags) - Math.min(...lags);
}
const exact = (cur, ideal, prev, dt) =>
  followStep(cur, ideal, prev, dt, FOLLOW_RATE);
// The old per-frame share, for comparison
const perFrame = (cur, ideal, _prev, dt) => {
  const a = 1 - Math.pow(0.75, dt * 60);
  cur.x += (ideal.x - cur.x) * a;
};
const uneven = [1 / 60, 1 / 30];
const exactSpread = lagSpread(exact, uneven);
check(
  'the chase camera keeps a steady lag through uneven frames',
  exactSpread < 1e-6,
  `${exactSpread.toExponential(1)} m`
);
const oldSpread = lagSpread(perFrame, uneven);
check(
  'the old per-frame share would have surged (the check can tell)',
  oldSpread > 0.05,
  `${oldSpread.toFixed(2)} m`
);
const evenLag = (() => {
  const cur = {x: 0, y: 0, z: 0};
  const prev = {x: 0, y: 0, z: 0};
  let t = 0;
  let lag = 0;
  for (let i = 0; i < 400; i++) {
    t += 1 / 60;
    const ideal = {x: 77 * t, y: 0, z: 0};
    exact(cur, ideal, prev, 1 / 60);
    Object.assign(prev, ideal);
    lag = ideal.x - cur.x;
  }
  return lag;
})();
check(
  'the lag at 60 fps is what it was (a quarter of the gap a frame)',
  Math.abs(evenLag - (77 / 60) * 3) < 0.05,
  `${evenLag.toFixed(2)} m`
);
const jumped = followStep(
  {x: 0, y: 0, z: 0},
  {x: 5000, y: 0, z: 0},
  {x: 0, y: 0, z: 0},
  1 / 60,
  FOLLOW_RATE
);
check(
  'a teleport carries the camera along, not swept across',
  Math.abs(jumped.x - 5000) < 1e-6,
  `${jumped.x.toFixed(0)}`
);

// The game loop steps the world by each frame's own timestamp, not an
// average of recent frames (that lurched the view at 40 fps)
const loop = readFileSync(new URL('../game-loop.js', import.meta.url), 'utf8');
check(
  'the game loop times frames by their display timestamp',
  /clock\.update\(\s*typeof timestamp === 'number'/.test(loop) &&
    /function animate\(timestamp\)/.test(loop)
);
check(
  'the game loop does not average frame times',
  !/_deltaRing|DELTA_BUFFER_SIZE|deltaRingSum/.test(loop)
);

if (failed) {
  console.error('Frame timing test failed');
  process.exit(1);
}
console.log('Frame timing test passed');
