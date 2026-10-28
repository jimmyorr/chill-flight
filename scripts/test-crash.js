// Crash heuristics (crash-logic.js): direct high-speed wall impact, steep
// nose-dive or stall-plummet into the ground, and short-window strain from
// sustained wall grinding or plowing through several buildings in a row.
import {
  CRASH,
  addPropHitStrain,
  addWallScrapeStrain,
  crashCameraShot,
  crashRespawnPose,
  isDiveImpactCrash,
  isWallImpactCrash,
  newCrashState,
  stepCrashState,
  stepWreckPiece,
} from '../crash-logic.js';
import {headingOf} from '../wall-scrape-logic.js';

console.log('Testing crash heuristics...');
let failed = false;
function check(ok, msg) {
  if (!ok) {
    console.error(`FAIL: ${msg}`);
    failed = true;
  }
}

// A wall facing -x (rising toward +x)
const intoWall = headingOf(1, 0);
const shallow = headingOf(Math.sin(0.5), -Math.cos(0.5)); // ~29° graze

// --- 1. Direct head-on wall impact ---
check(
  isWallImpactCrash(intoWall, -1, 0, 2.0, 160),
  'fast head-on into a steep cliff does not crash'
);
check(
  !isWallImpactCrash(intoWall, -1, 0, 2.0, 80),
  'slow head-on into a cliff crashes instead of glancing off'
);
check(
  !isWallImpactCrash(shallow, -1, 0, 2.0, 200),
  'a shallow wingtip or nose graze crashes'
);
check(
  !isWallImpactCrash(intoWall, -1, 0, 0.75, 200),
  'a moderate hillside (under WALL_SLOPE) crashes'
);
console.log(
  '  Passed: fast dead-on into a steep cliff crashes; slow or angled glances off'
);

// --- 2. Steep nose-dive or stall-plummet into ground/water ---
check(
  isDiveImpactCrash(-0.9, 160, 0),
  'steep high-speed nose-dive into the ground does not crash'
);
check(!isDiveImpactCrash(-0.25, 160, 0), 'normal shallow descent crashes');
check(!isDiveImpactCrash(-0.15, 70, -10), 'landing approach crashes');
check(
  isDiveImpactCrash(-0.1, 40, -240),
  'high-speed stall plummet into the ground does not crash'
);
console.log(
  '  Passed: steep nose-dives and stall plummets crash; normal landings do not'
);

// --- 3. Short-window strain (wall grinding & prop smashes) ---
{
  const s = newCrashState();
  // Grazing a canyon wall for 10 seconds never exceeds GRAZE_STRAIN_CAP
  for (let i = 0; i < 600; i++) {
    const crashed = addWallScrapeStrain(s, false, false, 150, 1 / 60);
    stepCrashState(s, 1 / 60);
    check(!crashed, 'grazing a wall along its side crashed');
  }
  check(
    s.strain <= CRASH.GRAZE_STRAIN_CAP + 1e-6,
    `graze strain exceeded cap: ${s.strain}`
  );

  // Clean flight decays strain back to 0 within 2 seconds
  stepCrashState(s, 2.0);
  check(s.strain === 0, `strain did not decay to 0: ${s.strain}`);

  // Boring nose-first into a wall builds strain to a crash within ~1.2 s
  let grindCrashed = false;
  for (let i = 0; i < 90; i++) {
    if (addWallScrapeStrain(s, true, true, 120, 1 / 60)) {
      grindCrashed = true;
      break;
    }
    stepCrashState(s, 1 / 60);
  }
  check(grindCrashed, 'sustained head-on grinding into a wall did not crash');
}

{
  // Smashing a single house does not crash, and recovers after a few seconds
  const s = newCrashState();
  check(!addPropHitStrain(s, 'house', 140), 'a single house hit crashed');
  stepCrashState(s, 2.0);
  check(s.strain === 0, 'house strain did not fade after clean flight');

  // Plowing through 3 houses in quick succession crashes
  check(!addPropHitStrain(s, 'house', 150), 'first house crashed');
  check(!addPropHitStrain(s, 'house', 150), 'second house crashed');
  check(
    addPropHitStrain(s, 'house', 150),
    'plowing through three houses in a row did not crash'
  );
}
console.log(
  '  Passed: sustained grinding or smashing several houses crashes; brief hits fade'
);

// --- 4. Clear-air respawn pose (Option B) ---
{
  // Over a steep east-facing cliff (terrain rises toward -x, slopeX = -2),
  // respawn places the plane RESPAWN_CLEARANCE above the terrain and faces
  // downhill (+x -> heading = -PI/2, since forward is (-sin(h), -cos(h)))
  const cliff = crashRespawnPose(
    100,
    -200,
    0,
    {height: 150, slopeX: -2, slopeZ: 0},
    40
  );
  check(
    cliff.x === 100 && cliff.z === -200,
    'respawn changed x/z coordinates instead of placing overhead'
  );
  check(
    cliff.y === 150 + CRASH.RESPAWN_CLEARANCE,
    `respawn y (${cliff.y}) is not RESPAWN_CLEARANCE above terrain`
  );
  check(
    Math.abs(-Math.sin(cliff.heading) - 1) < 1e-6 &&
      Math.abs(-Math.cos(cliff.heading)) < 1e-6,
    `respawn on cliff did not face downhill (+x): heading=${cliff.heading}`
  );

  // Over flat water, respawn preserves the original heading and clears WATER_LEVEL
  const water = crashRespawnPose(
    50,
    60,
    1.23,
    {height: 10, slopeX: 0, slopeZ: 0},
    40
  );
  check(
    water.y === 40 + CRASH.RESPAWN_CLEARANCE,
    `water respawn y (${water.y}) did not clear WATER_LEVEL`
  );
  check(
    Math.abs(water.heading - 1.23) < 1e-6,
    'flat-water respawn did not preserve heading'
  );
}
console.log(
  '  Passed: respawn places the plane overhead in clear air, facing downhill on slopes'
);

// --- 5. Two-act camera choreography & wreck piece physics ---
{
  const wreck = {x: 0, y: 50, z: 0};
  const chase = {
    camX: 0,
    camY: 185,
    camZ: 45,
    lookX: 0,
    lookY: 170,
    lookZ: -20,
  };
  // Act 1 start: orbits around wreck and looks at the wreck
  const s0 = crashCameraShot({
    t: 0,
    wreck,
    startAngle: 0,
    dir: 1,
    chase,
  });
  check(
    Math.abs(s0.look.y - (wreck.y + 2)) < 1e-6,
    'Act 1 camera does not look at the wreck'
  );
  const sMid = crashCameraShot({
    t: CRASH.ORBIT_SECONDS * 0.9,
    wreck,
    startAngle: 0,
    dir: 1,
    chase,
  });
  check(
    Math.abs(sMid.pos.x) > 10 && sMid.pos.y > s0.pos.y,
    'Act 1 camera did not orbit and rise around the wreck'
  );
  // End of Act 2: reaches exact chase camera pose
  const sEnd = crashCameraShot({
    t: CRASH.DURATION,
    wreck,
    startAngle: 0,
    dir: 1,
    chase,
  });
  check(
    Math.hypot(
      sEnd.pos.x - chase.camX,
      sEnd.pos.y - chase.camY,
      sEnd.pos.z - chase.camZ
    ) < 1e-6 &&
      Math.hypot(
        sEnd.look.x - chase.lookX,
        sEnd.look.y - chase.lookY,
        sEnd.look.z - chase.lookZ
      ) < 1e-6,
    'Act 2 camera did not converge smoothly to chase camera at CRASH.DURATION'
  );

  // Wreck piece falls under gravity and bounces off its rest height
  const piece = {
    x: 0,
    y: 42,
    z: 0,
    vx: 10,
    vy: -20,
    vz: 0,
    angle: 0,
    spin: 4,
    rest: 40,
  };
  stepWreckPiece(piece, 0.2);
  check(
    piece.y === 40 && piece.vy > 0,
    `wreck piece did not bounce off surface: y=${piece.y}, vy=${piece.vy}`
  );
}
console.log(
  '  Passed: two-act camera orbits wreck then arcs into chase view; wreck pieces bounce'
);

if (failed) process.exit(1);
console.log('Crash heuristic tests passed.');
