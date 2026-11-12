#!/usr/bin/env node
/**
 * scripts/test-vr-controls.js
 *
 * Deterministic unit tests for Quest 2 / WebXR Touch controller input:
 * dual-stick steering, Y-axis orientation, cardinal double/triple-flick
 * maneuvers, face/grip button latches, hand-tracking safety, and 3D VR pause
 * menu hit-testing and cross-frame button debouncing.
 */
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {
  STICK_SENSITIVITY,
  createStickFlickTracker,
  createVRButtonTracker,
  createVRPauseInputLatch,
  extractXRControllers,
  getVRSessionInit,
  hitTestVRPauseMenuUV,
  readCombinedThumbstick,
  readXRTriggers,
  scaleThumbstickAxis,
  unscaleThumbstickForBuggy,
} from '../vr-controls-logic.js';

console.log('Testing WebXR / Quest 2 VR controls...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.log(`FAIL: ${name} ${detail}`);
  }
}

function makeQuestPad({
  axes = [0, 0, 0, 0],
  trigger = 0,
  grip = 0,
  stickClick = false,
  primary = false,
  secondary = false,
} = {}) {
  return {
    connected: true,
    mapping: 'xr-standard',
    axes,
    buttons: [
      {pressed: trigger > 0.5, value: trigger},
      {pressed: grip > 0.8, value: grip},
      {pressed: false, value: 0},
      {pressed: stickClick, value: stickClick ? 1 : 0},
      {pressed: primary, value: primary ? 1 : 0},
      {pressed: secondary, value: secondary ? 1 : 0},
    ],
  };
}

function makeSession(leftOpts, rightOpts) {
  const inputSources = [];
  if (leftOpts) {
    inputSources.push({handedness: 'left', gamepad: makeQuestPad(leftOpts)});
  }
  if (rightOpts) {
    inputSources.push({handedness: 'right', gamepad: makeQuestPad(rightOpts)});
  }
  return {inputSources};
}

// 1. Dual-stick steering, Y-axis negation, and sensitivity scaling
{
  const leftSteer = extractXRControllers(
    makeSession({axes: [0, 0, -0.8, 0]}, {axes: [0, 0, 0, 0]})
  );
  const s1 = readCombinedThumbstick(leftSteer);
  const expectedLeftX = scaleThumbstickAxis(-0.8);
  check(
    'left thumbstick steers when right thumbstick is centered and scales smoothly',
    s1.active &&
      Math.abs(s1.rawX - -0.8) < 1e-6 &&
      Math.abs(s1.x - expectedLeftX) < 1e-6 &&
      s1.y === 0,
    JSON.stringify(s1)
  );

  const bothSteer = extractXRControllers(
    makeSession({axes: [0, 0, -0.3, 0]}, {axes: [0, 0, 0.9, -0.5]})
  );
  const s2 = readCombinedThumbstick(bothSteer);
  check(
    'stronger thumbstick deflection wins and forward stick (-axes[3]) maps to +Y',
    s2.active &&
      Math.abs(s2.rawX - 0.9) < 1e-6 &&
      Math.abs(s2.rawY - 0.5) < 1e-6 &&
      Math.abs(s2.x - scaleThumbstickAxis(0.9)) < 1e-6 &&
      Math.abs(s2.y - scaleThumbstickAxis(0.5)) < 1e-6,
    JSON.stringify(s2)
  );

  const pullBack = extractXRControllers(
    makeSession({}, {axes: [0, 0, 0.05, 1.0]})
  );
  const s3 = readCombinedThumbstick(pullBack);
  check(
    'pulling stick back (+axes[3]) maps to -STICK_SENSITIVITY at full throw and deadzone filters X jitter',
    s3.active &&
      s3.x === 0 &&
      Math.abs(s3.rawY - -1) < 1e-6 &&
      Math.abs(s3.y - -STICK_SENSITIVITY) < 1e-6,
    JSON.stringify(s3)
  );

  // Verify game-loop stickResponse(STICK_SENSITIVITY) === 0.5 (half deflection)
  const srU = (STICK_SENSITIVITY - 0.15) / (1 - 0.15);
  const srOut = 0.55 * srU + 0.45 * srU * srU * srU;
  check(
    'full physical stick throw produces gentle 0.5 cruise deflection after stickResponse',
    Math.abs(srOut - 0.5) < 1e-3,
    `srOut=${srOut}`
  );

  // Verify buggy unscaling uses full physical stick travel instead of saturating at 50%
  const halfScaled = scaleThumbstickAxis(0.5);
  const fullScaled = scaleThumbstickAxis(1.0);
  const halfSteer = ChillFlightLogic.buggySteerAxis(
    unscaleThumbstickForBuggy(halfScaled, 0.12),
    false
  );
  const fullSteer = ChillFlightLogic.buggySteerAxis(
    unscaleThumbstickForBuggy(fullScaled, 0.12),
    false
  );
  const halfThrottle = ChillFlightLogic.buggyThrottleAxis(
    unscaleThumbstickForBuggy(halfScaled, 0.15),
    false
  );
  const fullThrottle = ChillFlightLogic.buggyThrottleAxis(
    unscaleThumbstickForBuggy(fullScaled, 0.15),
    false
  );
  check(
    'buggy thumbstick steering and throttle stay gentle at 50% throw and reach 1.0 at 100% throw',
    halfSteer > 0.1 &&
      halfSteer < 0.25 &&
      Math.abs(fullSteer - 1) < 1e-6 &&
      halfThrottle > 0.35 &&
      halfThrottle < 0.5 &&
      Math.abs(fullThrottle - 1) < 1e-6,
    `halfSteer=${halfSteer}, fullSteer=${fullSteer}, halfThrottle=${halfThrottle}, fullThrottle=${fullThrottle}`
  );
}

// 2. Analog triggers
{
  const ctrls = extractXRControllers(
    makeSession({trigger: 0.4}, {trigger: 0.85})
  );
  const {rt, lt} = readXRTriggers(ctrls);
  check(
    'right and left analog triggers map independently to rt and lt',
    Math.abs(rt - 0.85) < 1e-6 && Math.abs(lt - 0.4) < 1e-6,
    `rt=${rt}, lt=${lt}`
  );
}

// 3. Hand-tracking / 1-button controller safety
{
  const handSession = {
    inputSources: [
      {
        handedness: 'right',
        hand: {},
        gamepad: {
          connected: true,
          axes: [],
          buttons: [{pressed: true, value: 1}],
        },
      },
    ],
  };
  const ctrls = extractXRControllers(handSession);
  const btns = createVRButtonTracker();
  const latch = createVRPauseInputLatch();
  let safe = true;
  try {
    readCombinedThumbstick(ctrls);
    readXRTriggers(ctrls);
    btns.pollPause(ctrls);
    btns.pollFlightButtons(ctrls);
    latch.arm(ctrls);
    latch.poll(ctrls, 0);
  } catch {
    safe = false;
  }
  check('1-button hand-tracking input source never throws', safe);
}

// 4. Flight face buttons (A=Camera, B=Headlight, X=Switch vehicle), side-grip barrel rolls, & unset stick clicks
{
  const btns = createVRButtonTracker();
  const c1 = extractXRControllers(
    makeSession(
      {primary: true, grip: 0.98, stickClick: true}, // X pressed + full grip + stick click
      {primary: true, secondary: true, grip: 0.98, stickClick: true} // A + B + full grip + stick click
    )
  );
  check(
    'thumbstick clicks do not trigger accidental pauses when Left Y is not pressed',
    !btns.pollPause(c1)
  );

  const e1 = btns.pollFlightButtons(c1);
  check(
    'Right A, Right B, and Left X fire camera, headlight, and plane once while both grips held cancel out',
    e1.camera && e1.headlight && e1.plane && e1.gripRoll === 0,
    JSON.stringify(e1)
  );

  const e2 = btns.pollFlightButtons(c1);
  check(
    'held flight buttons stay edge-latched on subsequent frames',
    !e2.camera && !e2.headlight && !e2.plane && e2.gripRoll === 0,
    JSON.stringify(e2)
  );

  btns.reset();
  const lightRest = extractXRControllers(
    makeSession({grip: 0.35}, {grip: 0.2})
  );
  const eLight = btns.pollFlightButtons(lightRest);
  check(
    'light finger contact on side grips does not trigger barrel roll or face actions',
    !eLight.camera &&
      !eLight.headlight &&
      !eLight.plane &&
      eLight.gripRoll === 0,
    JSON.stringify(eLight)
  );

  const leftGripSqueeze = extractXRControllers(
    makeSession({grip: 0.75}, {grip: 0})
  );
  const leftGripEase = extractXRControllers(
    makeSession({grip: 0.5}, {grip: 0})
  );
  const leftGripRelease = extractXRControllers(
    makeSession({grip: 0.2}, {grip: 0})
  );
  const eLeft1 = btns.pollFlightButtons(leftGripSqueeze);
  const eLeft2 = btns.pollFlightButtons(leftGripEase);
  const eLeft3 = btns.pollFlightButtons(leftGripRelease);
  check(
    'left side grip holds +1 barrel roll continuously with hysteresis until released',
    eLeft1.gripRoll === 1 &&
      !eLeft1.camera &&
      !eLeft1.headlight &&
      !eLeft1.plane &&
      eLeft2.gripRoll === 1 &&
      eLeft3.gripRoll === 0,
    JSON.stringify({eLeft1, eLeft2, eLeft3})
  );

  const rightGripSqueeze = extractXRControllers(
    makeSession({grip: 0}, {grip: 0.9})
  );
  const bothGrips = extractXRControllers(makeSession({grip: 0.9}, {grip: 0.9}));
  const eRight1 = btns.pollFlightButtons(rightGripSqueeze);
  const eBoth = btns.pollFlightButtons(bothGrips);
  const eRightAgain = btns.pollFlightButtons(rightGripSqueeze);
  check(
    'right side grip holds -1 barrel roll and squeezing both grips cancels to 0 cleanly',
    eRight1.gripRoll === -1 &&
      eBoth.gripRoll === 0 &&
      eRightAgain.gripRoll === -1,
    JSON.stringify({eRight1, eBoth, eRightAgain})
  );
}

// 5. Cardinal thumbstick double-flick & triple-flick maneuvers
{
  const flick = createStickFlickTracker(450);

  // Slow bank left, hold 1s, center, bank left again -> NOT a double-flick
  flick.update(-0.9, 0, 1000);
  flick.update(-0.9, 0, 2000);
  flick.update(0, 0, 2100);
  const slowSecond = flick.update(-0.9, 0, 2200);
  check(
    'slow sustained turns do not trigger accidental double-flick maneuvers',
    slowSecond.started === null && slowSecond.activeCount === 0
  );
  flick.reset();

  // Rapid double-flick left -> sharp bank turn, triple-flick -> barrel roll
  const f1 = flick.update(-0.9, 0.1, 3000);
  flick.update(0, 0, 3100);
  const f2 = flick.update(-0.92, 0.1, 3220);
  check(
    'double-flick left starts count=2 ArrowLeft hold',
    f1.started === null &&
      f2.started?.action === 'ArrowLeft' &&
      f2.activeCount === 2
  );

  const f2Rel = flick.update(0, 0, 3320);
  const f3 = flick.update(-0.95, 0, 3440);
  check(
    'triple-flick left upgrades to count=3 ArrowLeft barrel roll',
    f2Rel.released?.action === 'ArrowLeft' &&
      f3.started?.action === 'ArrowLeft' &&
      f3.activeCount === 3
  );

  const f3End = flick.update(-0.1, 0, 4000);
  check(
    'returning stick near center releases barrel roll cleanly',
    f3End.released?.action === 'ArrowLeft' && f3End.activeCount === 0
  );

  // Triple-flick down -> Immelmann (ArrowDown count=3)
  flick.update(0, -0.9, 5000);
  flick.update(0, 0, 5080);
  flick.update(0, -0.9, 5180);
  flick.update(0, 0, 5260);
  const imm = flick.update(0, -0.95, 5350);
  check(
    'triple-flick back triggers ArrowDown count=3 for Immelmann',
    imm.started?.action === 'ArrowDown' && imm.activeCount === 3
  );
}

// 6. Pause / Resume cross-frame regressions & VR pause menu latches
{
  const btns = createVRButtonTracker();
  const pauseLatch = createVRPauseInputLatch();

  // Player presses Left Y (secondary) while holding Right Trigger and Left Grip
  const pauseFrameCtrls = extractXRControllers(
    makeSession({secondary: true, grip: 0.95}, {trigger: 1.0})
  );
  const pausedNow = btns.pollPause(pauseFrameCtrls);
  pauseLatch.arm(pauseFrameCtrls);
  const sameFrameAction = pauseLatch.poll(pauseFrameCtrls, 0);
  const sameFrameHoverExit = pauseLatch.poll(pauseFrameCtrls, 2);
  check(
    'pressing Left Y while holding Trigger and Grip pauses without same-frame unpause or Exit VR',
    pausedNow && sameFrameAction === null && sameFrameHoverExit === null
  );

  // Next frame: release Trigger, still holding Left Y and Grip -> still no Exit VR!
  const heldYAndGrip = extractXRControllers(
    makeSession({secondary: true, grip: 0.95}, {trigger: 0})
  );
  check(
    'holding Left Y or Grip inside pause menu never triggers Exit VR',
    pauseLatch.poll(heldYAndGrip, -1) === null
  );

  // Pulling trigger while pointing off-button (hovered = -1) does NOT resume
  const offCardTrigger = extractXRControllers(makeSession({}, {trigger: 1.0}));
  check(
    'pulling trigger off-card (hovered = -1) does not accidentally resume flight',
    pauseLatch.poll(offCardTrigger, -1) === null &&
      pauseLatch.poll(offCardTrigger, 0) === null // still held: latched!
  );

  // Release trigger, then pull trigger while hovering Resume (0), Map (1), and Exit (2)
  const idle = extractXRControllers(makeSession({}, {}));
  pauseLatch.poll(idle, 0);
  check(
    'pulling trigger while hovering Resume returns resume',
    pauseLatch.poll(offCardTrigger, 0) === 'resume'
  );
  pauseLatch.poll(idle, 1);
  check(
    'pulling trigger while hovering Map returns map',
    pauseLatch.poll(offCardTrigger, 1) === 'map'
  );
  pauseLatch.poll(idle, 2);
  check(
    'pulling trigger while hovering Exit VR returns exit',
    pauseLatch.poll(offCardTrigger, 2) === 'exit'
  );

  // Right B exits VR; Right A + held Grip resumes without firing camera or barrel roll on next flight frame
  pauseLatch.poll(idle, -1);
  const pressRightB = extractXRControllers(makeSession({}, {secondary: true}));
  check(
    'pressing Right B in pause menu returns exit',
    pauseLatch.poll(pressRightB, -1) === 'exit' &&
      pauseLatch.poll(pressRightB, -1) === null
  );

  pauseLatch.poll(idle, -1);
  const pressRightAWithGrip = extractXRControllers(
    makeSession({grip: 0.95}, {primary: true})
  );
  btns.syncFlightHeld(pressRightAWithGrip); // synced while paused
  const resumeAct = pauseLatch.poll(pressRightAWithGrip, -1);
  const resumedFlightEvents = btns.pollFlightButtons(pressRightAWithGrip); // A and Grip still held on 1st resumed frame!
  const releasedAfterResume = btns.pollFlightButtons(idle);
  const freshGripAfterResume = btns.pollFlightButtons(
    extractXRControllers(makeSession({grip: 0.95}, {}))
  );
  check(
    'pressing Right A while gripping controller resumes flight without toggling camera or barrel-rolling until grip is re-squeezed',
    resumeAct === 'resume' &&
      !resumedFlightEvents.camera &&
      resumedFlightEvents.gripRoll === 0 &&
      releasedAfterResume.gripRoll === 0 &&
      freshGripAfterResume.gripRoll === 1,
    JSON.stringify({
      resumedFlightEvents,
      releasedAfterResume,
      freshGripAfterResume,
    })
  );
}

// 7. Pause menu UV hit-testing
{
  check(
    'UV hit-test maps Resume, Map, Exit VR buttons, and card margins accurately',
    hitTestVRPauseMenuUV(0.5, 1 - 276 / 680) === 0 &&
      hitTestVRPauseMenuUV(0.5, 1 - 392 / 680) === 1 &&
      hitTestVRPauseMenuUV(0.5, 1 - 508 / 680) === 2 &&
      hitTestVRPauseMenuUV(0.5, 1 - 150 / 680) === -1 &&
      hitTestVRPauseMenuUV(0.05, 1 - 276 / 680) === -1
  );
}

// 8. Stationary WebXR session init & VR headset user-agent preset detection
{
  const sessionInit = getVRSessionInit();
  const opt = sessionInit?.optionalFeatures || [];
  check(
    'getVRSessionInit omits bounded-floor and local-floor so Quest defaults to stationary tracking',
    Array.isArray(opt) &&
      !opt.includes('bounded-floor') &&
      !opt.includes('local-floor') &&
      opt.includes('hand-tracking'),
    JSON.stringify(sessionInit)
  );

  check(
    'isVRHeadsetUserAgent detects Quest 2/3, Pico, Wolvic, and VR browsers without false positives on phones or desktops',
    ChillFlightLogic.isVRHeadsetUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64; Quest 2) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/35.2.0.9.61 Chrome/128.0.6613.162 VR Safari/537.36'
    ) &&
      ChillFlightLogic.isVRHeadsetUserAgent(
        'Mozilla/5.0 (Android 12; Mobile VR; rv:109.0) Gecko/113.0 Wolvic/1.4.1'
      ) &&
      ChillFlightLogic.isVRHeadsetUserAgent(
        'Mozilla/5.0 (Linux; Android 10; Pico 4) AppleWebKit/537.36 Chrome/112.0.0.0 VR Safari/537.36'
      ) &&
      !ChillFlightLogic.isVRHeadsetUserAgent(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
      ) &&
      !ChillFlightLogic.isVRHeadsetUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
      ) &&
      !ChillFlightLogic.isVRHeadsetUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      )
  );

  check(
    'chooseAutoGraphicsPreset defaults Quest 2, 4-6 GB Android, modern iPads/iPhones, iOS Safari, and 4-core desktops to mid while keeping true low-end devices on low',
    ChillFlightLogic.chooseAutoGraphicsPreset({
      cores: 4,
      memory: 4,
      ua: 'Mozilla/5.0 (X11; Linux x86_64; Quest 2) OculusBrowser/35.2 VR Safari/537.36',
    }).preset === 'mid' &&
      ChillFlightLogic.chooseAutoGraphicsPreset({
        cores: 8,
        memory: 4,
        ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7a) Chrome/128.0 Mobile Safari/537.36',
        isCoarsePointer: true,
      }).preset === 'mid' &&
      ChillFlightLogic.chooseAutoGraphicsPreset({
        cores: 8,
        memory: 2,
        ua: 'Mozilla/5.0 (Linux; Android 13; BudgetPhone) Chrome/128.0 Mobile Safari/537.36',
        isCoarsePointer: true,
      }).preset === 'low' &&
      ChillFlightLogic.chooseAutoGraphicsPreset({
        cores: 4,
        memory: 4,
        ua: 'Mozilla/5.0 (Linux; Android 11; EntryPhone) Chrome/128.0 Mobile Safari/537.36',
        isCoarsePointer: true,
      }).preset === 'low' &&
      ChillFlightLogic.chooseAutoGraphicsPreset({
        isNative: true,
        nativePlatform: 'ios',
        nativeModel: 'iPad13,4',
      }).preset === 'mid' &&
      ChillFlightLogic.chooseAutoGraphicsPreset({
        isNative: true,
        nativePlatform: 'ios',
        nativeModel: 'iPad16,3',
      }).preset === 'mid' &&
      ChillFlightLogic.chooseAutoGraphicsPreset({
        isNative: true,
        nativePlatform: 'ios',
        nativeModel: 'iPad7,5',
      }).preset === 'low' &&
      ChillFlightLogic.chooseAutoGraphicsPreset({
        isNative: true,
        nativePlatform: 'ios',
        nativeModel: 'iPhone12,1',
      }).preset === 'low' &&
      ChillFlightLogic.chooseAutoGraphicsPreset({
        isNative: true,
        nativePlatform: 'ios',
        nativeModel: 'iPhone13,2',
      }).preset === 'mid' &&
      ChillFlightLogic.chooseAutoGraphicsPreset({
        cores: 4,
        memory: 4,
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128.0 Safari/537.36',
        isCoarsePointer: false,
      }).preset === 'mid' &&
      ChillFlightLogic.chooseAutoGraphicsPreset({
        cores: 2,
        memory: 4,
        ua: 'Mozilla/5.0 (X11; CrOS x86_64) Chrome/128.0 Safari/537.36',
        isCoarsePointer: false,
      }).preset === 'low' &&
      ChillFlightLogic.chooseAutoGraphicsPreset({
        cores: 2,
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Version/17.5 Mobile Safari/604.1',
        isCoarsePointer: true,
      }).preset === 'mid'
  );
}

if (failed) {
  process.exit(1);
}
console.log('All VR control tests passed.');
