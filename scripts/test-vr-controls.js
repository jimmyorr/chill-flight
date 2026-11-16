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
  VR_MAP_LAYOUT,
  createStickFlickTracker,
  createVRButtonTracker,
  createVRPauseInputLatch,
  extractXRControllers,
  getVRSessionInit,
  hitTestVRMapUV,
  hitTestVRPauseMenuUV,
  isXRSessionVisible,
  readCombinedThumbstick,
  readVRMapPanStick,
  readXRTriggers,
  scaleThumbstickAxis,
  unscaleThumbstickForBuggy,
  uvToVRMapViewportNorm,
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

// 4. Flight face buttons (A=Camera, B=Headlight, X=Switch vehicle), side-grip sharp turns / barrel rolls, & unset stick clicks
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

  const e1 = btns.pollFlightButtons(c1, 100);
  check(
    'Right A, Right B, and Left X fire camera, headlight, and plane once while both grips held cancel out',
    e1.camera &&
      e1.headlight &&
      e1.plane &&
      e1.gripTurn === 0 &&
      e1.gripRoll === 0,
    JSON.stringify(e1)
  );

  const e2 = btns.pollFlightButtons(c1, 116);
  check(
    'held flight buttons stay edge-latched on subsequent frames',
    !e2.camera &&
      !e2.headlight &&
      !e2.plane &&
      e2.gripTurn === 0 &&
      e2.gripRoll === 0,
    JSON.stringify(e2)
  );

  btns.reset();
  const lightRest = extractXRControllers(
    makeSession({grip: 0.35}, {grip: 0.2})
  );
  const eLight = btns.pollFlightButtons(lightRest, 500);
  check(
    'light finger contact on side grips does not trigger sharp turn, barrel roll, or face actions',
    !eLight.camera &&
      !eLight.headlight &&
      !eLight.plane &&
      eLight.gripTurn === 0 &&
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
  const eLeft1 = btns.pollFlightButtons(leftGripSqueeze, 1000);
  const eLeft2 = btns.pollFlightButtons(leftGripEase, 1100);
  const eLeft3 = btns.pollFlightButtons(leftGripRelease, 1200);
  check(
    'single left side-grip squeeze holds +1 sharp turn continuously with hysteresis until released',
    eLeft1.gripTurn === 1 &&
      eLeft1.gripRoll === 0 &&
      !eLeft1.camera &&
      !eLeft1.headlight &&
      !eLeft1.plane &&
      eLeft2.gripTurn === 1 &&
      eLeft2.gripRoll === 0 &&
      eLeft3.gripTurn === 0 &&
      eLeft3.gripRoll === 0,
    JSON.stringify({eLeft1, eLeft2, eLeft3})
  );

  // Double-squeeze within 450ms upgrades to barrel roll; re-squeeze after long hold returns to sharp turn
  const eLeftRollStart = btns.pollFlightButtons(leftGripSqueeze, 1320);
  const eLeftRollHold = btns.pollFlightButtons(leftGripEase, 2500);
  const eLeftRollRel = btns.pollFlightButtons(leftGripRelease, 2600);
  const eLeftTurnAgain = btns.pollFlightButtons(leftGripSqueeze, 2750);
  check(
    'double-squeezing left side grip holds +1 barrel roll and re-squeezing after a long roll returns to single-tap sharp turn',
    eLeftRollStart.gripTurn === 0 &&
      eLeftRollStart.gripRoll === 1 &&
      eLeftRollHold.gripTurn === 0 &&
      eLeftRollHold.gripRoll === 1 &&
      eLeftRollRel.gripTurn === 0 &&
      eLeftRollRel.gripRoll === 0 &&
      eLeftTurnAgain.gripTurn === 1 &&
      eLeftTurnAgain.gripRoll === 0,
    JSON.stringify({
      eLeftRollStart,
      eLeftRollHold,
      eLeftRollRel,
      eLeftTurnAgain,
    })
  );

  btns.reset();
  const rightGripSqueeze = extractXRControllers(
    makeSession({grip: 0}, {grip: 0.9})
  );
  const rightGripRelease = extractXRControllers(
    makeSession({grip: 0}, {grip: 0})
  );
  const bothGrips = extractXRControllers(makeSession({grip: 0.9}, {grip: 0.9}));
  const eRightTurn = btns.pollFlightButtons(rightGripSqueeze, 3000);
  btns.pollFlightButtons(rightGripRelease, 3100);
  const eRightRoll = btns.pollFlightButtons(rightGripSqueeze, 3220);
  const eBoth = btns.pollFlightButtons(bothGrips, 3300);
  const eRightAgain = btns.pollFlightButtons(rightGripSqueeze, 3400);
  check(
    'right side grip single-taps -1 sharp turn, double-taps -1 barrel roll, and squeezing both grips cancels to 0 cleanly',
    eRightTurn.gripTurn === -1 &&
      eRightTurn.gripRoll === 0 &&
      eRightRoll.gripTurn === 0 &&
      eRightRoll.gripRoll === -1 &&
      eBoth.gripTurn === 0 &&
      eBoth.gripRoll === 0 &&
      eRightAgain.gripTurn === 0 &&
      eRightAgain.gripRoll === -1,
    JSON.stringify({eRightTurn, eRightRoll, eBoth, eRightAgain})
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
  const resumedFlightEvents = btns.pollFlightButtons(pressRightAWithGrip, 4000); // A and Grip still held on 1st resumed frame!
  const releasedAfterResume = btns.pollFlightButtons(idle, 4100);
  const freshGripAfterResume = btns.pollFlightButtons(
    extractXRControllers(makeSession({grip: 0.95}, {})),
    4200
  );
  check(
    'pressing Right A while gripping controller resumes flight without toggling camera, sharp-turning, or barrel-rolling until grip is re-squeezed',
    resumeAct === 'resume' &&
      !resumedFlightEvents.camera &&
      resumedFlightEvents.gripTurn === 0 &&
      resumedFlightEvents.gripRoll === 0 &&
      releasedAfterResume.gripTurn === 0 &&
      releasedAfterResume.gripRoll === 0 &&
      freshGripAfterResume.gripTurn === 1 &&
      freshGripAfterResume.gripRoll === 0,
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
    'getVRSessionInit omits bounded-floor, local-floor, and hand-tracking so Quest defaults to stationary Touch-controller play',
    Array.isArray(opt) &&
      !opt.includes('bounded-floor') &&
      !opt.includes('local-floor') &&
      !opt.includes('hand-tracking'),
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

  const questUa =
    'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/35.2.0.9.61 Chrome/128.0.6613.162 VR Safari/537.36';
  const picoUa =
    'Mozilla/5.0 (Linux; Android 10; Pico 4) AppleWebKit/537.36 Chrome/112.0.0.0 VR Safari/537.36';
  const iphoneUa =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const macUa =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

  check(
    'resolveControlScheme forces screen-position touch on VR headsets regardless of saved joystick/gyro while preserving phone preferences',
    ChillFlightLogic.resolveControlScheme(null, questUa) === 'touch' &&
      ChillFlightLogic.resolveControlScheme('joystick', questUa) === 'touch' &&
      ChillFlightLogic.resolveControlScheme('gyro', questUa) === 'touch' &&
      ChillFlightLogic.resolveControlScheme('touch', questUa) === 'touch' &&
      ChillFlightLogic.resolveControlScheme('joystick', picoUa) === 'touch' &&
      ChillFlightLogic.resolveControlScheme(null, iphoneUa) === 'joystick' &&
      ChillFlightLogic.resolveControlScheme('touch', iphoneUa) === 'touch' &&
      ChillFlightLogic.resolveControlScheme('gyro', iphoneUa) === 'gyro' &&
      ChillFlightLogic.resolveControlScheme('joystick', iphoneUa) ===
        'joystick' &&
      ChillFlightLogic.resolveControlScheme('retired-mode', iphoneUa) ===
        'joystick' &&
      ChillFlightLogic.resolveControlScheme(null, macUa) === 'joystick'
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

// 9. XRSession visibilityState focus awareness (VRC.Quest.Input.4)
{
  const active = makeSession(
    {axes: [0, 0, -0.8, 0], primary: true, trigger: 0.9},
    {axes: [0, 0, 0.7, -0.6], primary: true, trigger: 0.8}
  );
  const stdFallback = [
    {
      connected: true,
      mapping: 'standard',
      axes: [0.6, 0, 0, 0],
      buttons: Array.from({length: 12}, () => ({pressed: true, value: 1})),
    },
  ];

  check(
    'isXRSessionVisible treats visible or unspecified XRSession as visible and rejects blurred/hidden/null',
    !isXRSessionVisible(null) &&
      isXRSessionVisible(active) &&
      isXRSessionVisible({...active, visibilityState: 'visible'}) &&
      !isXRSessionVisible({...active, visibilityState: 'visible-blurred'}) &&
      !isXRSessionVisible({...active, visibilityState: 'hidden'})
  );

  const blurredCtrls = extractXRControllers(
    {...active, visibilityState: 'visible-blurred'},
    stdFallback
  );
  const hiddenCtrls = extractXRControllers(
    {...active, visibilityState: 'hidden'},
    stdFallback
  );
  const visibleCtrls = extractXRControllers(
    {...active, visibilityState: 'visible'},
    stdFallback
  );

  check(
    'extractXRControllers suppresses XR and fallback gamepads while session is visible-blurred or hidden',
    !blurredCtrls.hasXRGamepad &&
      blurredCtrls.leftGp === null &&
      blurredCtrls.rightGp === null &&
      blurredCtrls.standardGp === null &&
      !hiddenCtrls.hasXRGamepad &&
      hiddenCtrls.standardGp === null &&
      visibleCtrls.hasXRGamepad &&
      visibleCtrls.leftGp !== null &&
      visibleCtrls.rightGp !== null &&
      visibleCtrls.standardGp !== null
  );
}

// 10. Invert y axis scoping (VR sticks & gamepads vs. 2D laser & Touch screen-position)
{
  check(
    'shouldInvertYAxis always returns false when Invert y axis is disabled',
    !ChillFlightLogic.shouldInvertYAxis({
      invertYAxis: false,
      isVRPresenting: true,
      isVRHeadset: true,
      controlScheme: 'touch',
    }) &&
      !ChillFlightLogic.shouldInvertYAxis({
        invertYAxis: false,
        controlScheme: 'joystick',
        gamepadActive: true,
      })
  );

  check(
    'shouldInvertYAxis honors Invert y axis on VR physical sticks, W3C gamepads, desktop mouse/keys, Joystick, and Gyro while ignoring it on 2D VR headset laser rays and Touch screen-position mode',
    // Immersive VR physical sticks honor Invert y axis even on Quest ('touch' scheme)
    ChillFlightLogic.shouldInvertYAxis({
      invertYAxis: true,
      isVRPresenting: true,
      isVRHeadset: true,
      controlScheme: 'touch',
    }) &&
      // Bluetooth gamepad in a 2D Quest browser window or mobile Touch mode honors Invert y axis
      ChillFlightLogic.shouldInvertYAxis({
        invertYAxis: true,
        isVRPresenting: false,
        isVRHeadset: true,
        controlScheme: 'touch',
        gamepadActive: true,
      }) &&
      ChillFlightLogic.shouldInvertYAxis({
        invertYAxis: true,
        controlScheme: 'touch',
        isTouchInput: true,
        gamepadActive: true,
      }) &&
      // 2D VR headset laser ray (both trigger touch and hover mousemove) ignores Invert y axis
      !ChillFlightLogic.shouldInvertYAxis({
        invertYAxis: true,
        isVRPresenting: false,
        isVRHeadset: true,
        controlScheme: 'touch',
        isTouchInput: true,
      }) &&
      !ChillFlightLogic.shouldInvertYAxis({
        invertYAxis: true,
        isVRPresenting: false,
        isVRHeadset: true,
        controlScheme: 'touch',
        isTouchInput: false,
      }) &&
      // Mobile/tablet Touch (screen-position) mode ignores Invert y axis
      !ChillFlightLogic.shouldInvertYAxis({
        invertYAxis: true,
        controlScheme: 'touch',
        isTouchInput: true,
      }) &&
      // Mobile/tablet Joystick and Gyro modes honor Invert y axis
      ChillFlightLogic.shouldInvertYAxis({
        invertYAxis: true,
        controlScheme: 'joystick',
        isTouchInput: true,
      }) &&
      ChillFlightLogic.shouldInvertYAxis({
        invertYAxis: true,
        controlScheme: 'gyro',
        isTouchInput: true,
      }) &&
      // Desktop mouse and keyboard honor Invert y axis (even if controlScheme is 'touch' on a hybrid laptop)
      ChillFlightLogic.shouldInvertYAxis({
        invertYAxis: true,
        controlScheme: 'joystick',
        isTouchInput: false,
      }) &&
      ChillFlightLogic.shouldInvertYAxis({
        invertYAxis: true,
        controlScheme: 'touch',
        isTouchInput: false,
      })
  );
}

// 11. In-VR 3D world map card UV hit-testing, viewport mapping, pan, and latches
{
  const toUV = (cx, cy) => [
    cx / VR_MAP_LAYOUT.canvasW,
    1 - cy / VR_MAP_LAYOUT.canvasH,
  ];
  const rectCenterUV = (r) => toUV(r.x + r.w / 2, r.y + r.h / 2);

  const [backU, backV] = rectCenterUV(VR_MAP_LAYOUT.backBtn);
  const [resU, resV] = rectCenterUV(VR_MAP_LAYOUT.resumeBtn);
  const [zInU, zInV] = rectCenterUV(VR_MAP_LAYOUT.zoomInBtn);
  const [zOutU, zOutV] = rectCenterUV(VR_MAP_LAYOUT.zoomOutBtn);
  const [recU, recV] = rectCenterUV(VR_MAP_LAYOUT.recenterBtn);
  const [vpU, vpV] = rectCenterUV(VR_MAP_LAYOUT.viewport);
  // Gap pixel between Zoom In (y 396..448) and Zoom Out (y 456..508)
  const [gapU, gapV] = toUV(950, 452);

  check(
    'hitTestVRMapUV resolves header, floating zoom/recenter buttons, guard zone, and map viewport',
    hitTestVRMapUV(backU, backV) === 'back' &&
      hitTestVRMapUV(resU, resV) === 'resume' &&
      hitTestVRMapUV(zInU, zInV) === 'zoomIn' &&
      hitTestVRMapUV(zOutU, zOutV) === 'zoomOut' &&
      hitTestVRMapUV(recU, recV) === 'recenter' &&
      hitTestVRMapUV(gapU, gapV) === null &&
      hitTestVRMapUV(vpU, vpV) === 'viewport'
  );

  const [wpWarpU, wpWarpV] = rectCenterUV(VR_MAP_LAYOUT.waypointWithWarpBtn);
  const [warpU, warpV] = rectCenterUV(VR_MAP_LAYOUT.warpBtn);
  const [clearU, clearV] = rectCenterUV(VR_MAP_LAYOUT.clearPinBtn);
  const [wpNoWarpU, wpNoWarpV] = rectCenterUV(VR_MAP_LAYOUT.waypointNoWarpBtn);
  const [clearWpU, clearWpV] = rectCenterUV(VR_MAP_LAYOUT.clearWaypointBtn);

  check(
    'hitTestVRMapUV adapts bottom bar buttons for pin+warp, multiplayer pin-only, and active waypoint states',
    hitTestVRMapUV(warpU, warpV, {hasPin: false, hasWaypoint: false}) ===
      null &&
      hitTestVRMapUV(wpWarpU, wpWarpV, {hasPin: true, canWarp: true}) ===
        'waypoint' &&
      hitTestVRMapUV(warpU, warpV, {hasPin: true, canWarp: true}) === 'warp' &&
      hitTestVRMapUV(clearU, clearV, {hasPin: true, canWarp: true}) ===
        'clearPin' &&
      hitTestVRMapUV(warpU, warpV, {hasPin: true, canWarp: false}) !== 'warp' &&
      hitTestVRMapUV(wpNoWarpU, wpNoWarpV, {hasPin: true, canWarp: false}) ===
        'waypoint' &&
      hitTestVRMapUV(clearWpU, clearWpV, {
        hasPin: false,
        hasWaypoint: true,
      }) === 'waypoint'
  );

  const centerNorm = uvToVRMapViewportNorm(vpU, vpV);
  const [tlU, tlV] = toUV(VR_MAP_LAYOUT.viewport.x, VR_MAP_LAYOUT.viewport.y);
  const [brU, brV] = toUV(
    VR_MAP_LAYOUT.viewport.x + VR_MAP_LAYOUT.viewport.w,
    VR_MAP_LAYOUT.viewport.y + VR_MAP_LAYOUT.viewport.h
  );
  const tlNorm = uvToVRMapViewportNorm(tlU, tlV);
  const brNorm = uvToVRMapViewportNorm(brU, brV);
  check(
    'uvToVRMapViewportNorm maps viewport center to (0, 0) and corners to (-0.5, -0.5) .. (+0.5, +0.5)',
    Math.abs(centerNorm.normX) < 1e-9 &&
      Math.abs(centerNorm.normY) < 1e-9 &&
      Math.abs(tlNorm.normX - -0.5) < 1e-9 &&
      Math.abs(tlNorm.normY - -0.5) < 1e-9 &&
      Math.abs(brNorm.normX - 0.5) < 1e-9 &&
      Math.abs(brNorm.normY - 0.5) < 1e-9
  );

  const panIdle = readVRMapPanStick(
    extractXRControllers(
      makeSession({axes: [0, 0, 0.08, -0.05]}, {axes: [0, 0, 0, 0]})
    )
  );
  const panFull = readVRMapPanStick(
    extractXRControllers(
      makeSession({axes: [0, 0, 0, 0]}, {axes: [0, 0, 1.0, -1.0]})
    )
  );
  check(
    'readVRMapPanStick filters deadzone noise and maps full stick throw to (+/-1, +/-1)',
    !panIdle.active &&
      panIdle.x === 0 &&
      panIdle.y === 0 &&
      panFull.active &&
      Math.abs(panFull.x - 1) < 1e-6 &&
      Math.abs(panFull.y - 1) < 1e-6
  );

  // Latch transitions: Pause -> Map (Trigger & Grip held) -> per-hand click -> Back via B -> Pause (B still held)
  const latch = createVRPauseInputLatch();
  const enterMapHeld = extractXRControllers(
    makeSession({grip: 0.9}, {trigger: 0.95})
  );
  latch.arm(enterMapHeld);

  const firstMapPoll = latch.pollMap(enterMapHeld, {
    left: 'viewport',
    right: 'viewport',
    any: 'viewport',
  });
  check(
    'holding Trigger or Grip across Map open does not drop an accidental pin or zoom on frame 1',
    firstMapPoll.action === null && firstMapPoll.gripZoom === 0,
    JSON.stringify(firstMapPoll)
  );

  const neutral = extractXRControllers(makeSession({}, {}));
  latch.pollMap(neutral, {left: 'viewport', right: 'zoomIn', any: 'zoomIn'});

  const rightTriggerClick = extractXRControllers(
    makeSession({}, {trigger: 0.95})
  );
  const rightRes = latch.pollMap(rightTriggerClick, {
    left: 'viewport',
    right: 'zoomIn',
    any: 'viewport',
  });
  latch.pollMap(neutral, {left: 'viewport', right: 'zoomIn', any: 'zoomIn'});

  const leftTriggerClick = extractXRControllers(
    makeSession({trigger: 0.95}, {})
  );
  const leftRes = latch.pollMap(leftTriggerClick, {
    left: 'viewport',
    right: 'zoomIn',
    any: 'zoomIn',
  });
  check(
    'pollMap dispatches each hand trigger against that specific controller ray target',
    rightRes.action === 'zoomIn' &&
      rightRes.hand === 'right' &&
      leftRes.action === 'viewport' &&
      leftRes.hand === 'left',
    JSON.stringify({rightRes, leftRes})
  );

  const rightGripZoom = latch.pollMap(
    extractXRControllers(makeSession({}, {grip: 1.0})),
    {left: null, right: null, any: null}
  );
  const leftGripZoom = latch.pollMap(
    extractXRControllers(makeSession({grip: 1.0}, {})),
    {left: null, right: null, any: null}
  );
  check(
    'Right Grip zooms in (+1) and Left Grip zooms out (-1) once unlatched',
    Math.abs(rightGripZoom.gripZoom - 1) < 1e-6 &&
      Math.abs(leftGripZoom.gripZoom - -1) < 1e-6,
    JSON.stringify({rightGripZoom, leftGripZoom})
  );

  const pressB = extractXRControllers(makeSession({}, {secondary: true}));
  const backRes = latch.pollMap(pressB, {
    left: 'viewport',
    right: 'viewport',
    any: 'viewport',
  });
  // Returning to the pause card arms the latch while B is still held:
  latch.arm(pressB);
  const pauseWhileHoldingB = latch.poll(pressB, -1);
  latch.poll(neutral, -1);
  const freshExitOnPause = latch.poll(pressB, -1);
  check(
    'pressing Right B on the Map card returns back without firing Exit VR until released and pressed again',
    backRes.action === 'back' &&
      pauseWhileHoldingB === null &&
      freshExitOnPause === 'exit',
    JSON.stringify({backRes, pauseWhileHoldingB, freshExitOnPause})
  );
}

if (failed) {
  process.exit(1);
}
console.log('All VR control tests passed.');
