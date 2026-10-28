// Crash heuristics (crash-logic.js): direct high-speed wall impact, steep
// nose-dive or stall-plummet into the ground, and short-window strain from
// sustained wall grinding or plowing through several buildings in a row.
import {
  CRASH,
  addPropHitStrain,
  addWallScrapeStrain,
  isDiveImpactCrash,
  isWallImpactCrash,
  newCrashState,
  stepCrashState,
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

if (failed) process.exit(1);
console.log('Crash heuristic tests passed.');
