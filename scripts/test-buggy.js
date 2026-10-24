#!/usr/bin/env node
/**
 * scripts/test-buggy.js
 *
 * Automated tests for buggy driving mechanics, run against the real
 * functions in chill-flight-logic.js:
 * 1. 3D elevation-aware road deck sampling for underpasses/overpasses
 * 2. Continuous road surface height across segment joints without flat ledge steps
 * 3. Speed-dependent steering limit and stick curves
 * 4. One-handed cruise speed, boost, braking and reverse
 * 5. The ?buggy= switch
 * 6. Incline vertical momentum and catching air
 * 7. Turning into a hovercraft on water
 * 8. Grip, leaning into a drift, and turning in the air
 * 9. A raised bridge's railings hold it on the deck
 * 10. Resting on all four wheels over banks and creases
 * 11. Double-tap moves: hop, power slide, hard brake
 */
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {PLANE_HANDLING} from '../constants.js';
import {BUGGY_WHEELBASE} from '../buggy-model.js';

console.log('Testing buggy driving mechanics...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    console.error(`  FAILED: ${name}${detail ? ` (${detail})` : ''}`);
    failed = true;
  }
}

// --- 1. 3D ELEVATION-AWARE ROAD SAMPLING (UNDERPASSES & OVERPASSES) ---
// Two intersecting road segments at (100, 200):
// Segment 1 (underpass deck at y = 50)
// Segment 2 (overpass deck at y = 72)
const underpassSeg = {
  x0: 80,
  z0: 200,
  y0: 50,
  x1: 120,
  z1: 200,
  y1: 50,
};
const overpassSeg = {
  x0: 100,
  z0: 180,
  y0: 72,
  x1: 100,
  z1: 220,
  y1: 72,
};

const sampleUnderState = {found: false, bestDist: Infinity, bestInside: false};
const outUnder = {height: 0, slopeX: 0, slopeZ: 0};
ChillFlightLogic.sampleRoadSegment(
  underpassSeg,
  100,
  200,
  outUnder,
  50,
  sampleUnderState
);
ChillFlightLogic.sampleRoadSegment(
  overpassSeg,
  100,
  200,
  outUnder,
  50,
  sampleUnderState
);

check(
  'Sampling road near lower deck (y=50) selects the underpass',
  sampleUnderState.found && Math.abs(outUnder.height - 50.75) < 0.1,
  `expected ~50.75, got ${outUnder.height}`
);

const sampleOverState = {found: false, bestDist: Infinity, bestInside: false};
const outOver = {height: 0, slopeX: 0, slopeZ: 0};
ChillFlightLogic.sampleRoadSegment(
  underpassSeg,
  100,
  200,
  outOver,
  72,
  sampleOverState
);
ChillFlightLogic.sampleRoadSegment(
  overpassSeg,
  100,
  200,
  outOver,
  72,
  sampleOverState
);

check(
  'Sampling road near upper deck (y=72) selects the overpass',
  sampleOverState.found && Math.abs(outOver.height - 72.75) < 0.1,
  `expected ~72.75, got ${outOver.height}`
);

const sampleDefaultState = {
  found: false,
  bestDist: Infinity,
  bestInside: false,
};
const outDefault = {height: 0, slopeX: 0, slopeZ: 0};
ChillFlightLogic.sampleRoadSegment(
  underpassSeg,
  100,
  200,
  outDefault,
  null,
  sampleDefaultState
);
ChillFlightLogic.sampleRoadSegment(
  overpassSeg,
  100,
  200,
  outDefault,
  null,
  sampleDefaultState
);

check(
  'Sampling road without vehicle elevation falls back to highest deck (72.75)',
  sampleDefaultState.found && Math.abs(outDefault.height - 72.75) < 0.1,
  `expected ~72.75, got ${outDefault.height}`
);

// --- 2. CONTINUOUS ROAD SURFACE ACROSS SEGMENT JOINTS ---
// Two consecutive sloping segments joining at (100, 0, y=30):
// Seg A: (50, 0, y=25) -> (100, 0, y=30), grade = 5/50 = 0.10
// Seg B: (100, 0, y=30) -> (150, 0, y=34), grade = 4/50 = 0.08
const segA = {
  x0: 50,
  z0: 0,
  y0: 25,
  x1: 100,
  z1: 0,
  y1: 30,
};
const segB = {
  x0: 100,
  z0: 0,
  y0: 30,
  x1: 150,
  z1: 0,
  y1: 34,
};

// Sample just before joint (x = 99.5), at joint (x = 100.0), and just after (x = 100.5)
const sampleRoadAt = (x, z, y) => {
  const out = {height: 0, slopeX: 0, slopeZ: 0};
  const state = {found: false, bestDist: Infinity, bestInside: false};
  ChillFlightLogic.sampleRoadSegment(segA, x, z, out, y, state);
  ChillFlightLogic.sampleRoadSegment(segB, x, z, out, y, state);
  return out;
};

const outBefore = sampleRoadAt(99.5, 0, 30);
const outAt = sampleRoadAt(100.0, 0, 30);
const outAfter = sampleRoadAt(100.5, 0, 30);

const stepBeforeToAt = Math.abs(outAt.height - outBefore.height);
const stepAtToAfter = Math.abs(outAfter.height - outAt.height);

check(
  'Road elevation is continuous across segment joint without ledge step',
  stepBeforeToAt < 0.15 && stepAtToAfter < 0.15,
  `step before: ${stepBeforeToAt.toFixed(4)}, step after: ${stepAtToAfter.toFixed(4)}`
);

// --- 3. HIGHWAY STEERING AUTHORITY & SPEED-DEPENDENT TURN RADIUS ---
const topKts = PLANE_HANDLING.buggy.topKts;
const {MAX_STEER, BRAKE_DECEL, REVERSE_TOP, ROLL_DRAG} =
  ChillFlightLogic.BUGGY_DRIVE;
const steerLimit = (speed) =>
  ChillFlightLogic.buggySteerLimit(speed, BUGGY_WHEELBASE);
const radiusAt = (speed) => BUGGY_WHEELBASE / Math.tan(steerLimit(speed));

// Low speed (5 kts): full lock for parking and U-turns
check(
  'Low-speed parking gets full lock (radius about 11 units)',
  radiusAt(5) <= 12 && Math.abs(steerLimit(5) - MAX_STEER) < 1e-9,
  `radius: ${radiusAt(5).toFixed(1)}, steer: ${steerLimit(5).toFixed(3)}`
);

// High speed: grip-limited, so the radius grows with the square of the speed
// (~195 units at 150 kts, ~348 at 200, ~500 at the 240 kts top speed)
check(
  'Turn radius at 150 kts is ~195 units',
  radiusAt(150) >= 180 && radiusAt(150) <= 210,
  `radius: ${radiusAt(150).toFixed(1)}`
);
check(
  'Turn radius at 200 kts is ~348 units',
  radiusAt(200) >= 330 && radiusAt(200) <= 370,
  `radius: ${radiusAt(200).toFixed(1)}`
);
check(
  `Top-speed (${topKts} kts) turn radius is ~500 units`,
  radiusAt(topKts) >= 470 && radiusAt(topKts) <= 530,
  `radius: ${radiusAt(topKts).toFixed(1)}`
);
const yawRateTop = (topKts * Math.tan(steerLimit(topKts))) / BUGGY_WHEELBASE;
check(
  'High-speed full-lock yaw rate is controlled (<= 50 deg/s)',
  yawRateTop * (180 / Math.PI) <= 50,
  `yaw rate: ${(yawRateTop * (180 / Math.PI)).toFixed(1)} deg/s`
);

// Joystick curve for straight highway driving: the virtual joystick's full
// throw is 0.5, and small nudges around the centre steer very little
const steerAxis = (v) => ChillFlightLogic.buggySteerAxis(v, true);
check(
  'Joystick steering curve gives gentle sub-2% lane control around center for straight roads',
  steerAxis(0.12) > 0 && steerAxis(0.12) < 0.02,
  `steer: ${steerAxis(0.12).toFixed(4)}`
);
check(
  'Joystick half deflection provides progressive ~18% intermediate steering',
  steerAxis(0.25) > 0.15 && steerAxis(0.25) < 0.22,
  `steer: ${steerAxis(0.25).toFixed(4)}`
);
check(
  'Joystick steering reaches 100% full steering lock on full deflection',
  Math.abs(steerAxis(0.5) - 1) < 1e-6 && Math.abs(steerAxis(-0.5) + 1) < 1e-6,
  `steer: ${steerAxis(0.5).toFixed(4)}`
);
check('Joystick steering ignores the deadzone', steerAxis(0.05) === 0);
check(
  'Joystick throttle is linear past its deadzone, to full at full throw',
  ChillFlightLogic.buggyThrottleAxis(0.05, true) === 0 &&
    Math.abs(ChillFlightLogic.buggyThrottleAxis(-0.5, true) + 1) < 1e-9 &&
    Math.abs(ChillFlightLogic.buggyThrottleAxis(0.29, true) - 0.5) < 1e-9
);

// --- 4. ONE-HANDED CRUISE SPEED, BOOST & REVERSE LOGIC ---
// Steps the drive force and drag (no slope) as buggy.js does, on land or
// water alike, until it settles
function settle({forward, joyY, cruise, seconds = 30}) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    const drag = ChillFlightLogic.buggyDrag(forward);
    const a = ChillFlightLogic.buggyDriveAccel({
      forward,
      joyY,
      cruise,
      top: topKts,
      drag,
    });
    forward += a * dt;
    forward -= Math.sign(forward) * Math.min(Math.abs(forward), drag * dt);
  }
  return forward;
}
const drive = (forward, joyY, cruise) =>
  ChillFlightLogic.buggyDriveAccel({
    forward,
    joyY,
    cruise,
    top: topKts,
    drag: ROLL_DRAG,
  });

const cruiseSettled = settle({forward: 0, joyY: 0, cruise: 80});
check(
  'Stick at rest holds the throttle slider speed',
  Math.abs(cruiseSettled - 80) < 2,
  `forward: ${cruiseSettled.toFixed(1)}`
);
const boosted = settle({forward: 80, joyY: 1, cruise: 80});
check(
  `Pushing up boosts to top speed (${topKts} kts)`,
  Math.abs(boosted - topKts) < 3,
  `forward: ${boosted.toFixed(1)}`
);
check(
  'Pulling down on stick triggers full braking deceleration',
  drive(80, -1, 80) === -BRAKE_DECEL,
  `accel: ${drive(80, -1, 80)}`
);
const reversed = settle({forward: 80, joyY: -1, cruise: 80});
check(
  `Continuing to hold down reverses at up to ${REVERSE_TOP} kts`,
  Math.abs(reversed + REVERSE_TOP) < 1,
  `forward: ${reversed.toFixed(1)}`
);
check(
  'Releasing joystick from reverse brakes, then cruises forward again',
  drive(-10, 0, 80) === BRAKE_DECEL &&
    settle({forward: -10, joyY: 0, cruise: 80}) > 78,
  `accel: ${drive(-10, 0, 80)}`
);
check(
  'With no cruise set, the stick at rest coasts to a stop',
  drive(30, 0, 0) === -ROLL_DRAG && drive(0, 0, 0) === 0
);

// --- 5. DEFAULT AVAILABILITY & URL PARAMETERS ---
check(
  'Buggy is included in ChillFlightLogic.PLANE_TYPES by default',
  ChillFlightLogic.PLANE_TYPES.includes('buggy'),
  `PLANE_TYPES: ${ChillFlightLogic.PLANE_TYPES.join(', ')}`
);
for (const [value, expected] of [
  ['', true],
  ['1', true],
  ['true', true],
  ['0', false],
  ['false', false],
  ['OFF', false],
]) {
  check(
    `?buggy=${value} switch reads as ${expected ? 'on' : 'off'}`,
    ChillFlightLogic.parseSwitch(value) === expected
  );
}
check(
  'No ?buggy= leaves the switch unset (buggy offered)',
  ChillFlightLogic.parseSwitch(null) === null
);

// --- 6. INCLINE VERTICAL MOMENTUM & CATCHING AIR ---
{
  // Climbs at `up` units/s for a second, then the ground runs on at `down`
  // units/s (a crest), stepped at `fps`: whether it took off, and how long
  // it was in the air
  const crest = (fps, up, down) => {
    const dt = 1 / fps;
    let b = {y: 0, velY: 0, airborne: false};
    let ground = 0;
    let air = 0;
    for (let i = 0; i < fps * 4; i++) {
      const gVelY = i < fps ? up : down;
      ground += gVelY * dt;
      b = ChillFlightLogic.stepBuggyVertical({
        ...b,
        surfaceHeight: ground,
        groundVelY: gVelY,
        onWater: false,
        dt,
      });
      if (b.airborne) air += dt;
    }
    return air;
  };
  // A small crest that rolls over, and a sharp one that launches, the same
  // at 30, 60 and 120 fps
  for (const fps of [30, 60, 120]) {
    check(
      `A gentle crest stays on the ground at ${fps} fps`,
      crest(fps, 12, 0) === 0
    );
    const air = crest(fps, 10, -10);
    check(
      `A sharp crest catches air at ${fps} fps`,
      air > 0.3,
      `airTime=${air.toFixed(2)}s`
    );
  }

  // 6a. Cruising on flat ground stays planted (never launches)
  let flat = {y: 0, velY: 0, airborne: false};
  let launchedOnFlat = false;
  for (let t = 0; t < 2; t += 0.016) {
    flat = ChillFlightLogic.stepBuggyVertical({
      ...flat,
      surfaceHeight: 0,
      groundVelY: 0,
      onWater: false,
      dt: 0.016,
    });
    if (flat.airborne) launchedOnFlat = true;
  }
  check('Cruising on flat ground does not launch', !launchedOnFlat);

  // 6b. Driving high speed up an incline reliably catches air over the crest
  // 150 kts up a 0.25 slope -> groundVelY = 37.5 units/s upward
  let incline = {y: 0, velY: 0, airborne: false};
  let launchedOverCrest = false;
  let maxAirHeight = 0;
  let airTime = 0;
  let height = 0;
  for (let t = 0; t < 3; t += 0.016) {
    const climbing = t < 1.0;
    const gVelY = climbing ? 37.5 : 0;
    height += gVelY * 0.016;
    incline = ChillFlightLogic.stepBuggyVertical({
      ...incline,
      surfaceHeight: height,
      groundVelY: gVelY,
      onWater: false,
      dt: 0.016,
    });
    if (incline.airborne) {
      launchedOverCrest = true;
      airTime += 0.016;
      const air = incline.y - height;
      if (air > maxAirHeight) maxAirHeight = air;
    }
  }
  check(
    'High-speed incline crest reliably catches air',
    launchedOverCrest && airTime >= 1.5 && maxAirHeight >= 12,
    `airTime=${airTime.toFixed(2)}s, maxAir=${maxAirHeight.toFixed(1)} units`
  );

  // 6c. Low speed up a gentle slope does not catch air (stays grounded)
  let gentle = {y: 0, velY: 0, airborne: false};
  let launchedGentle = false;
  let gHeight = 0;
  for (let t = 0; t < 2; t += 0.016) {
    const climbing = t < 1.0;
    const gVelY = climbing ? 2.5 : 0;
    gHeight += gVelY * 0.016;
    gentle = ChillFlightLogic.stepBuggyVertical({
      ...gentle,
      surfaceHeight: gHeight,
      groundVelY: gVelY,
      onWater: false,
      dt: 0.016,
    });
    if (gentle.airborne) launchedGentle = true;
  }
  check(
    'Low speed on gentle slope hugs ground without launching',
    !launchedGentle
  );

  // 6d. Driving off a cliff/ledge reliably launches into free-fall
  let cliff = {y: 50, velY: 0, airborne: false};
  let launchedCliff = false;
  for (let t = 0; t < 1; t += 0.016) {
    const h = t < 0.2 ? 50 : 20;
    cliff = ChillFlightLogic.stepBuggyVertical({
      ...cliff,
      surfaceHeight: h,
      groundVelY: 0,
      onWater: false,
      dt: 0.016,
    });
    if (cliff.airborne) launchedCliff = true;
  }
  check('Driving off a cliff or ledge reliably launches', launchedCliff);

  // 6e. On water, buggy floats and never launches
  let water = {y: 0, velY: 0, airborne: false};
  let launchedWater = false;
  for (let t = 0; t < 1; t += 0.016) {
    water = ChillFlightLogic.stepBuggyVertical({
      ...water,
      surfaceHeight: -0.9,
      groundVelY: 20,
      onWater: true,
      dt: 0.016,
    });
    if (water.airborne) launchedWater = true;
  }
  check('Buggy on water floats without launching', !launchedWater);

  // 6f. Jumping into water from the bank falls in, rather than dropping
  // straight to the surface
  let splash = {y: 30, velY: 10, airborne: true};
  splash = ChillFlightLogic.stepBuggyVertical({
    ...splash,
    surfaceHeight: -0.9,
    groundVelY: 0,
    onWater: true,
    dt: 0.016,
  });
  // 6g. Hitting a steep bank flat out throws it up no faster than
  // MAX_RAMP_VEL, rather than hundreds of metres into the sky
  let bank = {y: 0, velY: 0, airborne: false};
  let bankGround = 0;
  let peak = 0;
  for (let i = 0; i < 60 * 8; i++) {
    const gVelY = i < 30 ? 240 * 0.8 : 0;
    bankGround += gVelY / 60;
    bank = ChillFlightLogic.stepBuggyVertical({
      ...bank,
      surfaceHeight: bankGround,
      groundVelY: gVelY,
      onWater: false,
      dt: 1 / 60,
    });
    peak = Math.max(peak, bank.y - bankGround);
  }
  const {MAX_RAMP_VEL, GRAVITY: G} = ChillFlightLogic.BUGGY_AIR;
  check(
    'A steep bank at 240 kts launches no higher than MAX_RAMP_VEL allows',
    peak > 20 && peak <= (MAX_RAMP_VEL * MAX_RAMP_VEL) / (2 * G) + 1,
    `peak ${peak.toFixed(1)} units`
  );
  check(
    'Airborne over water carries on through the air',
    splash.airborne && splash.y > 29,
    `y=${splash.y.toFixed(1)}`
  );
}

// --- 7. HOVERCRAFT ON WATER ---
{
  // Off a bridge 40 units up at 160 kts: it falls, lands on the water and
  // hovers there rather than sinking or getting stuck
  let b = {y: 40, velY: 0, airborne: true};
  let t = 0;
  while (b.airborne && t < 5) {
    b = ChillFlightLogic.stepBuggyVertical({
      ...b,
      surfaceHeight: -0.3,
      groundVelY: 0,
      onWater: true,
      dt: 1 / 60,
    });
    t += 1 / 60;
  }
  check(
    'Falling off a bridge lands on the water and hovers',
    !b.airborne && b.y === -0.3,
    `airborne=${b.airborne}, y=${b.y}`
  );
  const kept = settle({forward: 160, joyY: 0, cruise: 160, seconds: 10});
  check(
    'It carries on across the water at the set speed',
    Math.abs(kept - 160) < 2,
    `forward: ${kept.toFixed(1)}`
  );
  const fromRest = settle({forward: 0, joyY: 1, cruise: 0, seconds: 20});
  check(
    'From a stop on the water it boosts up to top speed',
    fromRest > topKts - 3,
    `forward: ${fromRest.toFixed(1)}`
  );

  // The wheels fold flat over water and back down over land, in
  // FOLD_SECONDS at any frame rate
  const {FOLD_SECONDS} = ChillFlightLogic.BUGGY_HOVER;
  for (const fps of [30, 60, 144]) {
    let fold = 0;
    let half = 0;
    for (let i = 0; i < fps * FOLD_SECONDS; i++) {
      fold = ChillFlightLogic.stepBuggyHoverFold(fold, true, 1 / fps);
      if (i === Math.floor((fps * FOLD_SECONDS) / 2) - 1) half = fold;
    }
    let back = fold;
    for (let i = 0; i < fps * FOLD_SECONDS; i++) {
      back = ChillFlightLogic.stepBuggyHoverFold(back, false, 1 / fps);
    }
    check(
      `Wheels fold flat on water and back on land at ${fps} fps`,
      Math.abs(fold - 1) < 1e-9 && half > 0.4 && half < 0.6 && back < 1e-9,
      `fold=${fold}, half=${half}, back=${back}`
    );
  }
  // Shallows the terrain counts as land but draws under the water (off the
  // Montauk lighthouse's beach, 6-8 units deep): it hovers there too, so
  // the water's surface beside them isn't a wall it tips against
  const over = ChillFlightLogic.buggyOverWater;
  check(
    'It hovers over shallows drawn under the water, even counted as land',
    over(-6.8, 0.5, 0) && over(-1, 0.5, 0) && over(2, 0, 0),
    `${over(-6.8, 0.5, 0)}, ${over(-1, 0.5, 0)}, ${over(2, 0, 0)}`
  );
  check(
    'It drives on land drawn above the water',
    !over(1, 3, 0) && !over(-0.2, 0.5, 0),
    `${over(1, 3, 0)}, ${over(-0.2, 0.5, 0)}`
  );
  check(
    'It slides a little wider on water than on the ground',
    ChillFlightLogic.BUGGY_HOVER.GRIP > 4 &&
      ChillFlightLogic.BUGGY_HOVER.GRIP < 18
  );
}

// --- 8. GRIP, LEANING INTO A DRIFT, AND TURNING IN THE AIR ---
{
  // Drives on flat ground at fps as buggy.js does: the engine and drag
  // (cruise control set to kts), then the handling.
  // steer(t) is the stick. Returns the slide (radians) each frame.
  const handle = ({kts, kind = 'ground', seconds, steer, fps = 60}) => {
    const car = {velX: 0, velZ: -kts, yaw: 0, yawRate: 0, steer: 0, lean: 0};
    const dt = 1 / fps;
    const slips = [];
    for (let i = 0; i < seconds * fps; i++) {
      const fx = -Math.sin(car.yaw);
      const fz = -Math.cos(car.yaw);
      let forward = car.velX * fx + car.velZ * fz;
      const side = car.velX * Math.cos(car.yaw) - car.velZ * Math.sin(car.yaw);
      const drag = ChillFlightLogic.buggyDrag(forward);
      forward +=
        ChillFlightLogic.buggyDriveAccel({
          forward,
          joyY: 0,
          cruise: kts,
          top: topKts,
          drag,
        }) * dt;
      forward -= Math.sign(forward) * Math.min(Math.abs(forward), drag * dt);
      slips.push(
        ChillFlightLogic.stepBuggyHandling(car, {
          forward,
          side,
          steerIn: steer(i * dt),
          kind,
          airborne: false,
          wheelbase: BUGGY_WHEELBASE,
          topSpeed: topKts,
          dt,
        })
      );
    }
    const max = Math.max(...slips.map(Math.abs));
    return {car, slips, max, kts: Math.hypot(car.velX, car.velZ)};
  };
  const deg = (r) => `${((r * 180) / Math.PI).toFixed(1)}°`;
  const DEG5 = (5 * Math.PI) / 180;

  // Ordinary driving stays on rails
  const gentle = handle({kts: 220, seconds: 4, steer: () => 0.6});
  check(
    'A firm turn at 220 kts barely slides',
    gentle.max < DEG5,
    deg(gentle.max)
  );
  const taps = handle({
    kts: 220,
    seconds: 3,
    steer: (t) => (t % 1 < 0.25 ? 1 : 0),
  });
  check(
    'Quick full-stick taps at 220 kts barely slide',
    taps.max < DEG5,
    deg(taps.max)
  );
  const slow = handle({kts: 80, seconds: 3, steer: () => 1});
  check(
    'Full lock below the drift speed barely slides',
    slow.max < DEG5,
    deg(slow.max)
  );

  // Holding a hard turn at speed leans in and drifts, steady, turning
  // tighter than the firmest ordinary turn, and costing speed
  const held = handle({kts: 200, seconds: 3, steer: () => 1});
  const settled = held.slips.at(-1);
  check(
    'Holding a hard turn at 200 kts drifts at a steady 18-35°',
    settled > 0.31 && settled < 0.61 && held.max < 0.7,
    `settled ${deg(settled)}, max ${deg(held.max)}`
  );
  const firm = handle({kts: 200, seconds: 3, steer: () => 0.74});
  check(
    'The drift turns tighter than an ordinary full turn',
    held.car.yaw > firm.car.yaw * 1.4,
    `drift ${deg(held.car.yaw)} vs ${deg(firm.car.yaw)}`
  );
  check('Drifting scrubs speed', held.kts < 185, `${held.kts.toFixed(0)} kts`);
  const road = handle({kts: 200, kind: 'road', seconds: 3, steer: () => 1});
  check(
    'Tarmac grips harder: the drift is narrower on the road',
    road.slips.at(-1) > 0.1 && road.slips.at(-1) < settled * 0.75,
    `road ${deg(road.slips.at(-1))} vs dirt ${deg(settled)}`
  );

  // Letting go catches it, a little more slowly the faster it's going
  const caught = (kts) => {
    const r = handle({kts, seconds: 5, steer: (t) => (t < 3 ? 1 : 0)});
    const after = r.slips.slice(180).findIndex((s) => Math.abs(s) < DEG5);
    return after / 60;
  };
  const c150 = caught(150);
  const c240 = caught(240);
  check(
    'Letting go straightens it within a second, slower at top speed',
    c150 > 0 && c240 < 1 && c240 > c150,
    `${c150.toFixed(2)} s at 150 kts, ${c240.toFixed(2)} s at 240`
  );

  // The same drift at any frame rate
  for (const fps of [30, 144]) {
    const r = handle({kts: 200, seconds: 3, steer: () => 1, fps});
    check(
      `The drift settles the same at ${fps} fps`,
      Math.abs(r.slips.at(-1) - settled) < (2 * Math.PI) / 180,
      `${deg(r.slips.at(-1))} vs ${deg(settled)}`
    );
  }

  // In the air the stick turns it, but it carries on the way it was going
  const air = {velX: 0, velZ: -200, yaw: 0, yawRate: 0, steer: 0, lean: 0};
  for (let i = 0; i < 60; i++) {
    ChillFlightLogic.stepBuggyHandling(air, {
      forward: -Math.sin(air.yaw) * air.velX - Math.cos(air.yaw) * air.velZ,
      side: Math.cos(air.yaw) * air.velX - Math.sin(air.yaw) * air.velZ,
      steerIn: 1,
      kind: 'ground',
      airborne: true,
      wheelbase: BUGGY_WHEELBASE,
      topSpeed: topKts,
      dt: 1 / 60,
    });
  }
  check(
    'In the air the stick turns it 15-40° a second, its path unchanged',
    air.yaw > 0.26 &&
      air.yaw < 0.7 &&
      Math.abs(air.velX) < 1e-6 &&
      Math.abs(air.velZ + 200) < 1e-6,
    `turned ${deg(air.yaw)}, velocity (${air.velX.toFixed(2)}, ${air.velZ.toFixed(2)})`
  );
}

// --- 9. BRIDGE RAILINGS ---
{
  const {BUGGY_RAIL, stepBuggyRails, sampleRoadSegment} = ChillFlightLogic;
  // A raised deck running north (-z) from the origin at y = 50
  const bridge = {x0: 0, z0: 0, y0: 50, x1: 0, z1: -2000, y1: 50, rails: true};
  const road = {height: 0, slopeX: 0, slopeZ: 0};
  const sample = (x, z, y, seg = bridge) => {
    const st = {found: false, bestDist: Infinity, bestInside: false};
    return sampleRoadSegment(seg, x, z, road, y, st);
  };
  // Driving at the right-hand railing at 200 kts, 25° off the road's line,
  // the body (its reach across the road at that angle) never goes past it
  const yaw = (-25 * Math.PI) / 180;
  const car = {x: 0, z: -100, y: 50.75, velX: 0, velZ: 0};
  car.velX = -Math.sin(yaw) * 200;
  car.velZ = -Math.cos(yaw) * 200;
  let worst = -Infinity;
  let hits = 0;
  for (let i = 0; i < 120; i++) {
    car.x += car.velX / 60;
    car.z += car.velZ / 60;
    if (!sample(car.x, car.z, car.y)) break;
    if (stepBuggyRails(car, road, yaw) > 0) hits++;
    sample(car.x, car.z, car.y);
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const c = Math.abs(fx * road.normalX + fz * road.normalZ);
    const reach =
      BUGGY_RAIL.HALF_WIDTH * Math.sqrt(1 - c * c) + BUGGY_RAIL.HALF_LENGTH * c;
    worst = Math.max(worst, Math.abs(road.across) + reach);
  }
  check(
    "Heading into a bridge's railing at speed, the body stops at it",
    hits > 0 && worst <= BUGGY_RAIL.INNER + 1e-6,
    `${hits} hits, reaches ${worst.toFixed(2)} of ${BUGGY_RAIL.INNER}`
  );
  check(
    'It bounces off and keeps going along the deck',
    car.velX * road.normalX * Math.sign(road.across) +
      car.velZ * road.normalZ * Math.sign(road.across) <=
      0 && -car.velZ > 100,
    `velocity (${car.velX.toFixed(1)}, ${car.velZ.toFixed(1)})`
  );

  // Cruising straight along the deck clear of the railing: untouched
  const cruise = {x: 25, z: -100, y: 50.75, velX: 0, velZ: -200};
  sample(cruise.x, cruise.z, cruise.y);
  check(
    'Cruising straight 25 off the centre line, the railing leaves it be',
    stepBuggyRails(cruise, road, 0) === 0 && cruise.x === 25
  );

  // Above the railing's top it flies over; on a deck without railings
  // nothing holds it
  const high = {
    x: 31,
    z: -100,
    y: 50.75 + BUGGY_RAIL.TOP + 1,
    velX: 50,
    velZ: 0,
  };
  sample(high.x, high.z, high.y);
  stepBuggyRails(high, road, 0);
  const low = {x: 31, z: -100, y: 50.75, velX: 50, velZ: 0};
  sample(low.x, low.z, low.y, {...bridge, rails: false});
  stepBuggyRails(low, road, 0);
  check(
    'It jumps over railings in the air, and no deck without them holds it',
    high.x === 31 && low.x === 31
  );
}

// --- 10. RESTING ON ALL FOUR WHEELS ---
{
  const {buggyWheelContact} = ChillFlightLogic;
  const axles = {front: -3.3, rear: 2.9, halfTrack: 2.5};
  const fwd = [3.3, 3.3, -2.9, -2.9];
  const right = [-2.5, 2.5, -2.5, 2.5];
  const below = (h, c) =>
    Math.max(
      ...h.map(
        (hi, i) => hi - (c.height + c.along * fwd[i] + c.across * right[i])
      )
    );
  // A plain slope, rising 0.3 ahead and 0.5 to the right
  const plane = fwd.map((f, i) => 10 + 0.3 * f + 0.5 * right[i]);
  const tilted = buggyWheelContact(plane, axles, 10);
  check(
    'On a plain slope it sits on it, tilted with it',
    Math.abs(tilted.height - 10) < 1e-9 &&
      Math.abs(tilted.along - 0.3) < 1e-9 &&
      Math.abs(tilted.across - 0.5) < 1e-9
  );
  // A bank rising steeply on the left past a crease: the front left tyre
  // is 3 up, the centre still on the flat
  const bank = [3, 0, 0, 0];
  const onBank = buggyWheelContact(bank, axles, 0);
  check(
    'With a tyre up a bank, no tyre sinks into the ground',
    below(bank, onBank) <= 1e-9,
    `deepest tyre ${below(bank, onBank).toFixed(2)} under`
  );
  // A bump under the middle lifts it once it rises past the belly
  const bump = buggyWheelContact([0, 0, 0, 0], axles, 2);
  check(
    'A bump under the middle lifts it past the belly clearance',
    Math.abs(bump.height - (2 - ChillFlightLogic.BUGGY_BELLY_CLEARANCE)) < 1e-9
  );
}

// --- 11. DOUBLE-TAP MOVES ---
{
  const {BUGGY_MOVES, stepBuggyVertical, stepBuggyHandling, stepBuggyHop} =
    ChillFlightLogic;
  const deg = (r) => `${((r * 180) / Math.PI).toFixed(1)}°`;

  // Hops off flat ground (or water), holding up for float seconds.
  // Returns its peak and time in the air.
  const hopFrom = ({onWater = false, floatFor = 0, fps = 60}) => {
    const dt = 1 / fps;
    let v = {y: 0, velY: 0, airborne: false};
    let peak = 0;
    let t = 0;
    for (let i = 0; i < 10 * fps; i++) {
      v = stepBuggyVertical({
        ...v,
        surfaceHeight: 0,
        groundVelY: 0,
        onWater,
        hop: i === 0,
        float: t < floatFor,
        dt,
      });
      peak = Math.max(peak, v.y);
      if (i > 0 && !v.airborne) break;
      t += dt;
    }
    return {peak, t};
  };
  const tap = hopFrom({});
  check(
    'Double-tap up hops about 6 m (10-14 units) for 1.2-1.8 s',
    tap.peak > 10 && tap.peak < 14 && tap.t > 1.2 && tap.t < 1.8,
    `peak ${tap.peak.toFixed(1)}, ${tap.t.toFixed(2)} s`
  );
  const floaty = hopFrom({floatFor: BUGGY_MOVES.HOP_FLOAT_SECONDS});
  check(
    'Holding up floats it higher and longer, still under 12 m',
    floaty.peak > tap.peak * 1.3 && floaty.peak < 24 && floaty.t > tap.t,
    `peak ${floaty.peak.toFixed(1)}, ${floaty.t.toFixed(2)} s`
  );
  const wet = hopFrom({onWater: true});
  check(
    'It hops off water too',
    Math.abs(wet.peak - tap.peak) < 0.5,
    `peak ${wet.peak.toFixed(1)}`
  );
  const fast = hopFrom({fps: 144});
  check(
    'The hop is the same at 144 fps',
    Math.abs(fast.peak - tap.peak) < 0.5 && Math.abs(fast.t - tap.t) < 0.05,
    `peak ${fast.peak.toFixed(1)}, ${fast.t.toFixed(2)} s`
  );
  // Over bumps: a tap with the wheels just off the ground still hops, as
  // soon as they touch or within a moment of leaving it, but not again in
  // the air from a hop, nor long after leaving the ground
  const hopsAfter = ({airFor, tapAt, hopping = false, seconds = 1}) => {
    const timer = {buffer: 0, airTime: 0};
    const dt = 1 / 60;
    for (let i = 0; i < seconds * 60; i++) {
      const t = i * dt;
      const airborne = t < airFor;
      const tapped = Math.abs(t - tapAt) < dt / 2;
      if (stepBuggyHop(timer, {tapped, airborne, hopping, dt})) return t;
    }
    return null;
  };
  const onGround = hopsAfter({airFor: 0, tapAt: 0.1});
  const bumpLand = hopsAfter({airFor: 0.5, tapAt: 0.4});
  const justLeft = hopsAfter({airFor: 0.6, tapAt: 0.15});
  check(
    'A tap on the ground hops at once; over a bump it hops as the wheels touch, or just after leaving',
    Math.abs(onGround - 0.1) < 0.01 &&
      Math.abs(bumpLand - 0.5) < 0.02 &&
      Math.abs(justLeft - 0.15) < 0.01,
    `${onGround}, ${bumpLand}, ${justLeft}`
  );
  check(
    "It can't hop again in the air, nor long after leaving the ground",
    hopsAfter({airFor: 2, tapAt: 0.1, hopping: true}) === null &&
      hopsAfter({airFor: 2, tapAt: 0.6}) === null &&
      hopsAfter({airFor: 2, tapAt: 0.1}) !== null
  );

  // In the air with full stick for a second, holding up after a hop or not
  const fly = (hopHeld) => {
    const car = {velX: 0, velZ: -150, yaw: 0, yawRate: 0, steer: 0, lean: 0};
    for (let i = 0; i < 60; i++) {
      stepBuggyHandling(car, {
        forward: -Math.sin(car.yaw) * car.velX - Math.cos(car.yaw) * car.velZ,
        side: Math.cos(car.yaw) * car.velX - Math.sin(car.yaw) * car.velZ,
        steerIn: 1,
        kind: 'ground',
        hopHeld,
        airborne: true,
        wheelbase: BUGGY_WHEELBASE,
        topSpeed: topKts,
        dt: 1 / 60,
      });
    }
    // Which way it's going (yaw-style: 0 is -z, left is positive)
    const path = Math.atan2(-car.velX, -car.velZ);
    return {yaw: car.yaw, path, kts: Math.hypot(car.velX, car.velZ)};
  };
  const plain = fly(false);
  const steered = fly(true);
  check(
    'Holding up after a hop steers it in the air: turns 2x faster and its path follows',
    steered.yaw > plain.yaw * 2 &&
      steered.path > steered.yaw * 0.5 &&
      Math.abs(steered.kts - 150) < 1,
    `nose ${deg(steered.yaw)} (vs ${deg(plain.yaw)}), path ${deg(steered.path)}`
  );

  // On flat ground at a set cruise speed, steering, power sliding or hard
  // braking as given. Returns the slide each frame and the speed.
  const drive = ({
    kts,
    seconds,
    steer = 0,
    slide = false,
    hardBrake = false,
  }) => {
    const car = {velX: 0, velZ: -kts, yaw: 0, yawRate: 0, steer: 0, lean: 0};
    const dt = 1 / 60;
    const slips = [];
    const speeds = [];
    for (let i = 0; i < seconds * 60; i++) {
      const fx = -Math.sin(car.yaw);
      const fz = -Math.cos(car.yaw);
      let forward = car.velX * fx + car.velZ * fz;
      const side = car.velX * Math.cos(car.yaw) - car.velZ * Math.sin(car.yaw);
      const drag = ChillFlightLogic.buggyDrag(forward);
      forward +=
        ChillFlightLogic.buggyDriveAccel({
          forward,
          joyY: hardBrake ? -1 : 0,
          cruise: kts,
          top: topKts,
          drag,
          hardBrake,
        }) * dt;
      forward -= Math.sign(forward) * Math.min(Math.abs(forward), drag * dt);
      slips.push(
        stepBuggyHandling(car, {
          forward,
          side,
          steerIn: steer,
          kind: 'ground',
          slide,
          airborne: false,
          wheelbase: BUGGY_WHEELBASE,
          topSpeed: topKts,
          dt,
        })
      );
      const along =
        -Math.sin(car.yaw) * car.velX - Math.cos(car.yaw) * car.velZ;
      speeds.push(along);
    }
    return {slips, speeds, yaw: car.yaw};
  };
  const lowLean = drive({kts: 60, seconds: 2, steer: 1});
  const lowSlide = drive({kts: 60, seconds: 2, steer: 1, slide: true});
  check(
    'A power slide drifts at 60 kts, where holding the stick over barely slides',
    Math.abs(lowLean.slips.at(-1)) < (5 * Math.PI) / 180 &&
      lowSlide.slips.at(-1) > (15 * Math.PI) / 180,
    `${deg(lowSlide.slips.at(-1))} vs ${deg(lowLean.slips.at(-1))}`
  );
  const kick = lowSlide.slips.findIndex((s) => s > (10 * Math.PI) / 180) / 60;
  check(
    'The tail kicks out within half a second',
    kick > 0 && kick < 0.5,
    `${kick.toFixed(2)} s`
  );
  const lean200 = drive({kts: 200, seconds: 3, steer: 1});
  const slide200 = drive({kts: 200, seconds: 3, steer: 1, slide: true});
  check(
    'At speed the power slide swings wider than leaning in, under 50°',
    slide200.slips.at(-1) > lean200.slips.at(-1) * 1.2 &&
      slide200.slips.at(-1) < (50 * Math.PI) / 180,
    `${deg(slide200.slips.at(-1))} vs ${deg(lean200.slips.at(-1))}`
  );

  const stopTime = (r) => r.speeds.findIndex((v) => v < 0.5) / 60;
  const hard = drive({kts: 150, seconds: 5, hardBrake: true});
  const soft = (() => {
    // Ordinary brakes: 150 kts at BRAKE_DECEL
    return 150 / ChillFlightLogic.BUGGY_DRIVE.BRAKE_DECEL;
  })();
  check(
    'Double-tap down and hold stops from 150 kts in under 2 s, faster than the brakes',
    stopTime(hard) > 0 && stopTime(hard) < 2 && stopTime(hard) < soft * 0.7,
    `${stopTime(hard).toFixed(2)} s vs ${soft.toFixed(2)} s`
  );
  check(
    'Holding the hard brake never reverses',
    Math.min(...hard.speeds) > -0.5,
    `${Math.min(...hard.speeds).toFixed(2)}`
  );
  const turn = drive({
    kts: 120,
    seconds: 1,
    steer: 1,
    slide: true,
    hardBrake: true,
  });
  check(
    'Hard braking while steering swings the tail round',
    Math.max(...turn.slips) > (20 * Math.PI) / 180,
    deg(Math.max(...turn.slips))
  );
}

if (failed) {
  console.error('\nBuggy mechanics tests failed!');
  process.exit(1);
} else {
  console.log('\nAll buggy mechanics tests passed successfully!');
}
