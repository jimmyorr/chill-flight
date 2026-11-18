#!/usr/bin/env node
/**
 * scripts/test-vr-controls.js
 *
 * Deterministic unit tests for Quest 2 / WebXR Touch controller input:
 * dual-stick steering, Y-axis orientation, cardinal double/triple-flick
 * maneuvers, face/grip button latches, hand-tracking safety, and 3D VR pause
 * menu hit-testing and cross-frame button debouncing.
 */
import * as THREE from 'three';
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {
  STICK_DEADZONE,
  STICK_SENSITIVITY,
  VR_MAP_LAYOUT,
  VR_STICK_HOME_OFFSET,
  VR_THROTTLE_HOME_OFFSET,
  attitudeOfQuat,
  computeVRConsolePose,
  computeVirtualStickAxes,
  computeVirtualThrottle,
  createStickFlickTracker,
  createVRButtonTracker,
  createVRPauseInputLatch,
  createVRSimStickState,
  createVRVirtualControlsTracker,
  evaluateHandFist,
  evaluateHandGrab,
  evaluateHandPinch,
  extractXRControllers,
  getVRSessionInit,
  hitTestVRMapUV,
  hitTestVRPauseMenuUV,
  isPalmFacingHead,
  isXRSessionVisible,
  quatFromAttitude,
  readCombinedThumbstick,
  readVRMapPanStick,
  readXRTriggers,
  scaleThumbstickAxis,
  simStickAxisResponse,
  stepVRSimStickAttitude,
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

// 7. Pause menu UV hit-testing (main buttons + 4 quick-action pills)
{
  check(
    'UV hit-test maps Resume, Map, Exit VR, Camera, Vehicle, Lights, Stick mode pills, and card margins accurately',
    hitTestVRPauseMenuUV(0.5, 1 - 219 / 680) === 0 &&
      hitTestVRPauseMenuUV(0.5, 1 - 313 / 680) === 1 &&
      hitTestVRPauseMenuUV(0.5, 1 - 407 / 680) === 2 &&
      hitTestVRPauseMenuUV(245 / 1024, 1 - 494 / 680) === 3 &&
      hitTestVRPauseMenuUV(423 / 1024, 1 - 494 / 680) === 4 &&
      hitTestVRPauseMenuUV(601 / 1024, 1 - 494 / 680) === 5 &&
      hitTestVRPauseMenuUV(779 / 1024, 1 - 494 / 680) === 6 &&
      hitTestVRPauseMenuUV(334 / 1024, 1 - 494 / 680) === -1 &&
      hitTestVRPauseMenuUV(0.5, 1 - 120 / 680) === -1 &&
      hitTestVRPauseMenuUV(0.05, 1 - 219 / 680) === -1
  );
}

// 8. Stationary WebXR session init with optional hand-tracking & VR headset user-agent preset detection
{
  const sessionInit = getVRSessionInit();
  const opt = sessionInit?.optionalFeatures || [];
  check(
    'getVRSessionInit omits bounded-floor and local-floor while enabling optional hand-tracking',
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
      }) &&
      // 3D spatial virtual flight stick ignores 2D Invert y axis so pulling back always climbs
      !ChillFlightLogic.shouldInvertYAxis({
        invertYAxis: true,
        isVRPresenting: true,
        isVRHeadset: true,
        controlScheme: 'touch',
        gamepadActive: true,
        virtualStickActive: true,
      })
  );

  check(
    'shouldShowDisableMouseSetting shows on desktop/laptop pointers and tablets with keyboards while hiding on phones, bare tablets, native mobile apps, and VR headsets',
    ChillFlightLogic.shouldShowDisableMouseSetting({
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      hasFinePointer: true,
      hasHover: true,
    }) &&
      ChillFlightLogic.shouldShowDisableMouseSetting({
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        hasFinePointer: true,
        hasHover: true,
      }) &&
      // Phones and bare iPads (even with Macintosh desktop-mode UA on iPadOS where primary pointer is coarse)
      !ChillFlightLogic.shouldShowDisableMouseSetting({
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        hasFinePointer: false,
        hasHover: false,
      }) &&
      !ChillFlightLogic.shouldShowDisableMouseSetting({
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
        hasFinePointer: false,
        hasHover: false,
      }) &&
      // Native Capacitor apps stay hidden until a hardware keyboard is detected
      !ChillFlightLogic.shouldShowDisableMouseSetting({
        ua: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
        isNative: true,
        hasFinePointer: true,
        hasHover: true,
      }) &&
      ChillFlightLogic.shouldShowDisableMouseSetting({
        ua: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
        isNative: true,
        keyboardDetected: true,
      }) &&
      // VR headsets never show Disable mouse even though controller rays report fine hover
      !ChillFlightLogic.shouldShowDisableMouseSetting({
        ua: 'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 OculusBrowser/35.0',
        hasFinePointer: true,
        hasHover: true,
        keyboardDetected: true,
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

// 12. Bare-hand synthetic gamepad isolation, pinch/fist detection, & palm-to-face guard
{
  const handPinchSession = {
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
      {
        handedness: 'left',
        hand: {},
        gamepad: {
          connected: true,
          axes: [],
          buttons: [{pressed: false, value: 0}],
        },
      },
    ],
  };
  const handExtracted = extractXRControllers(handPinchSession);
  const handTriggers = readXRTriggers(handExtracted);
  check(
    'extractXRControllers isolates bare-hand synthetic gamepads from physical triggers while reporting hasHandInput and handPinch',
    !handExtracted.hasXRGamepad &&
      handExtracted.leftGp === null &&
      handExtracted.rightGp === null &&
      handExtracted.hasHandInput &&
      handExtracted.rightHandPinch &&
      !handExtracted.leftHandPinch &&
      handExtracted.handPinch &&
      handTriggers.rt === 0 &&
      handTriggers.lt === 0,
    JSON.stringify({handExtracted, handTriggers})
  );

  // Bare-hand pause latch supports handPinch and quick-action pills (3, 4, 5)
  const pLatch = createVRPauseInputLatch();
  pLatch.arm(handExtracted); // pinched on pause frame -> latched!
  check(
    'bare-hand pinch held across pause entry does not fire pause menu actions until released',
    pLatch.poll(handExtracted, 0) === null &&
      pLatch.poll(handExtracted, 3) === null
  );
  const unpinched = {...handExtracted, handPinch: false, rightHandPinch: false};
  pLatch.poll(unpinched, 3);
  check(
    'fresh bare-hand pinch on quick-action pills fires camera, plane, headlight, and stickMode',
    pLatch.poll(handExtracted, 3) === 'camera' &&
      (pLatch.poll(unpinched, 4), pLatch.poll(handExtracted, 4) === 'plane') &&
      (pLatch.poll(unpinched, 5),
      pLatch.poll(handExtracted, 5) === 'headlight') &&
      (pLatch.poll(unpinched, 6), pLatch.poll(handExtracted, 6) === 'stickMode')
  );

  // Pinch & scale-invariant fist hysteresis
  const makeHandJoints = ({
    pinchDist = 0.06,
    palmLen = 0.085,
    curlRatio = 2.0,
    palmTowardHead = false,
    y = -0.32,
  } = {}) => {
    // Right hand: palmTowardHead puts fingers up (+Y), index at +X, pinky at -X
    // so index x pinky points +Z toward head at (0,0,0) when wrist is at z=-0.35
    if (palmTowardHead) {
      return {
        wrist: {position: {x: 0.1, y: -0.1, z: -0.35}, visible: true},
        'index-finger-metacarpal': {
          position: {x: 0.13, y: -0.02, z: -0.35},
          visible: true,
        },
        'middle-finger-metacarpal': {
          position: {x: 0.1, y: -0.015, z: -0.35},
          visible: true,
        },
        'pinky-finger-metacarpal': {
          position: {x: 0.07, y: -0.02, z: -0.35},
          visible: true,
        },
        'thumb-tip': {position: {x: 0.14, y: 0.02, z: -0.35}, visible: true},
        'index-finger-tip': {
          position: {x: 0.14 + pinchDist, y: 0.02, z: -0.35},
          visible: true,
        },
        'middle-finger-tip': {
          position: {x: 0.1, y: -0.1 + palmLen * curlRatio, z: -0.35},
          visible: true,
        },
        'ring-finger-tip': {
          position: {x: 0.085, y: -0.1 + palmLen * curlRatio, z: -0.35},
          visible: true,
        },
        'pinky-finger-tip': {
          position: {x: 0.07, y: -0.1 + palmLen * curlRatio, z: -0.35},
          visible: true,
        },
      };
    }
    return {
      wrist: {position: {x: 0.2, y, z: -0.32}, visible: true},
      'index-finger-metacarpal': {
        position: {x: 0.17, y, z: -0.32 - palmLen},
        visible: true,
      },
      'middle-finger-metacarpal': {
        position: {x: 0.2, y, z: -0.32 - palmLen},
        visible: true,
      },
      'pinky-finger-metacarpal': {
        position: {x: 0.23, y, z: -0.32 - palmLen},
        visible: true,
      },
      'thumb-tip': {position: {x: 0.16, y, z: -0.4}, visible: true},
      'index-finger-tip': {
        position: {x: 0.16 + pinchDist, y, z: -0.4},
        visible: true,
      },
      'middle-finger-tip': {
        position: {x: 0.2, y, z: -0.32 - palmLen * curlRatio},
        visible: true,
      },
      'ring-finger-tip': {
        position: {x: 0.215, y, z: -0.32 - palmLen * curlRatio},
        visible: true,
      },
      'pinky-finger-tip': {
        position: {x: 0.23, y, z: -0.32 - palmLen * curlRatio},
        visible: true,
      },
    };
  };

  check(
    'evaluateHandPinch and evaluateHandFist apply clean hysteresis across small and large hands',
    !evaluateHandPinch(makeHandJoints({pinchDist: 0.04}), false) &&
      evaluateHandPinch(makeHandJoints({pinchDist: 0.015}), false) &&
      evaluateHandPinch(makeHandJoints({pinchDist: 0.028}), true) &&
      !evaluateHandPinch(makeHandJoints({pinchDist: 0.036}), true) &&
      !evaluateHandFist(
        makeHandJoints({palmLen: 0.065, curlRatio: 1.9}),
        false
      ) &&
      evaluateHandFist(
        makeHandJoints({palmLen: 0.065, curlRatio: 1.05}),
        false
      ) &&
      evaluateHandFist(makeHandJoints({palmLen: 0.1, curlRatio: 1.35}), true) &&
      !evaluateHandFist(makeHandJoints({palmLen: 0.1, curlRatio: 1.5}), true)
  );

  const raisedPalm = makeHandJoints({pinchDist: 0.012, palmTowardHead: true});
  const lapHand = makeHandJoints({pinchDist: 0.012, palmTowardHead: false});
  check(
    'isPalmFacingHead rejects raised system-menu palm pinches while allowing normal lap/armrest grabs',
    isPalmFacingHead(raisedPalm, 'right', {x: 0, y: 0, z: 0}) &&
      !evaluateHandGrab(raisedPalm, 'right', {x: 0, y: 0, z: 0}, false) &&
      !isPalmFacingHead(lapHand, 'right', {x: 0, y: 0, z: 0}) &&
      evaluateHandGrab(lapHand, 'right', {x: 0, y: 0, z: 0}, false)
  );
}

// 13. Virtual flight stick tilt invariance, buggy polarity, cruise-hold throttle, & tracker state machine
{
  const axisAngleQuat = (ax, ay, az, rad) => {
    const s = Math.sin(rad * 0.5);
    return {x: ax * s, y: ay * s, z: az * s, w: Math.cos(rad * 0.5)};
  };
  const mulQ = (a, b) => ({
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  });

  // Arbitrary resting wrist pose on knee (pitched forward 40 deg & yawed 20 deg)
  const restingKneeQuat = mulQ(
    axisAngleQuat(0, 1, 0, 0.35),
    axisAngleQuat(1, 0, 0, -0.7)
  );
  const neutral = computeVirtualStickAxes({
    startPos: {x: 0.2, y: -0.35, z: -0.32},
    startQuat: restingKneeQuat,
    currentPos: {x: 0.2, y: -0.35, z: -0.32},
    currentQuat: restingKneeQuat,
    seatYaw: 0,
    isBuggy: false,
  });

  // Pull back ~36.5 deg (+X rotation) from resting knee pose -> full +1 climb in plane, -1 brake in buggy,
  // while a casual 20 deg pull stays comfortably mid-range (~0.56) rather than saturating early
  const gentlePullQuat = mulQ(axisAngleQuat(1, 0, 0, 0.35), restingKneeQuat);
  const gentlePull = computeVirtualStickAxes({
    startPos: {x: 0.2, y: -0.5, z: -0.34},
    startQuat: restingKneeQuat,
    currentPos: {x: 0.2, y: -0.5, z: -0.34},
    currentQuat: gentlePullQuat,
    seatYaw: 0,
    isBuggy: false,
  });
  const pulledBackQuat = mulQ(axisAngleQuat(1, 0, 0, 0.64), restingKneeQuat);
  const planePullBack = computeVirtualStickAxes({
    startPos: {x: 0.2, y: -0.5, z: -0.34},
    startQuat: restingKneeQuat,
    currentPos: {x: 0.2, y: -0.5, z: -0.34},
    currentQuat: pulledBackQuat,
    seatYaw: 0,
    isBuggy: false,
  });
  const buggyPullBack = computeVirtualStickAxes({
    startPos: {x: 0.2, y: -0.5, z: -0.34},
    startQuat: restingKneeQuat,
    currentPos: {x: 0.2, y: -0.5, z: -0.34},
    currentQuat: pulledBackQuat,
    seatYaw: 0,
    isBuggy: true,
  });

  // Bank right ~36.5 deg (-Z rotation) -> full +1 right roll, while pure wrist yaw (+Y) produces 0 pitch/roll
  const tiltedRightQuat = mulQ(axisAngleQuat(0, 0, -1, 0.64), restingKneeQuat);
  const twistedYawQuat = mulQ(axisAngleQuat(0, 1, 0, 0.6), restingKneeQuat);
  const bankRight = computeVirtualStickAxes({
    startPos: {x: 0.2, y: -0.5, z: -0.34},
    startQuat: restingKneeQuat,
    currentPos: {x: 0.2, y: -0.5, z: -0.34},
    currentQuat: tiltedRightQuat,
    seatYaw: 0,
  });
  const pureYaw = computeVirtualStickAxes({
    startPos: {x: 0.2, y: -0.5, z: -0.34},
    startQuat: restingKneeQuat,
    currentPos: {x: 0.2, y: -0.5, z: -0.34},
    currentQuat: twistedYawQuat,
    seatYaw: 0,
  });

  check(
    'computeVirtualStickAxes zeros arbitrary resting wrist angles, keeps casual 20 deg tilt gentle, maps full throw cleanly, and ignores wrist yaw twist',
    Math.abs(neutral.rawX) < 1e-6 &&
      Math.abs(neutral.rawY) < 1e-6 &&
      gentlePull.rawY > 0.45 &&
      gentlePull.rawY < 0.65 &&
      planePullBack.rawY > 0.98 &&
      Math.abs(planePullBack.rawX) < 1e-5 &&
      buggyPullBack.rawY < -0.98 &&
      bankRight.rawX > 0.98 &&
      Math.abs(bankRight.rawY) < 1e-5 &&
      Math.abs(pureYaw.rawX) < 1e-5 &&
      Math.abs(pureYaw.rawY) < 1e-5,
    JSON.stringify({
      neutral,
      gentlePull,
      planePullBack,
      buggyPullBack,
      bankRight,
      pureYaw,
    })
  );

  // Relative cruise-hold throttle
  const tStart = computeVirtualThrottle({
    startPos: {x: -0.2, y: -0.35, z: -0.3},
    currentPos: {x: -0.2, y: -0.35, z: -0.3},
    seatYaw: 0,
    startThrottle: 0.6,
  });
  const tFwd = computeVirtualThrottle({
    startPos: {x: -0.2, y: -0.35, z: -0.3},
    currentPos: {x: -0.2, y: -0.35, z: -0.37}, // 7 cm forward = +50% -> clamped to 1.0
    seatYaw: 0,
    startThrottle: 0.6,
  });
  const tBack = computeVirtualThrottle({
    startPos: {x: -0.2, y: -0.35, z: -0.3},
    currentPos: {x: -0.2, y: -0.35, z: -0.23}, // 7 cm back = -50% -> 0.1
    seatYaw: 0,
    startThrottle: 0.6,
  });
  check(
    'computeVirtualThrottle holds starting cruise throttle on grab and slides smoothly between 0 and 1',
    Math.abs(tStart - 0.6) < 1e-6 &&
      Math.abs(tFwd - 1.0) < 1e-6 &&
      Math.abs(tBack - 0.1) < 1e-6,
    `tStart=${tStart}, tFwd=${tFwd}, tBack=${tBack}`
  );

  // Full tracker: physical controller lap grip vs near-stick grab, bare-hand comfort grab, & pause latch
  const tracker = createVRVirtualControlsTracker();
  const pose = computeVRConsolePose({x: 0, y: 0, z: 0}, 0);

  // Physical controller squeezed in lap (far from stickHomePos) -> does NOT grab stick or consume grip!
  const lapCtrlOut = tracker.update({
    right: {
      connected: true,
      isHand: false,
      gripPos: {x: 0.3, y: -0.58, z: -0.1},
      gripQuat: {x: 0, y: 0, z: 0, w: 1},
      grabbing: true,
    },
    currentThrottle: 0.5,
    delta: 1 / 60,
  });
  check(
    'physical controller squeezing side grip in lap preserves sharp-turn / barrel-roll grip instead of grabbing stick',
    !lapCtrlOut.stickActive && !lapCtrlOut.gripConsumedRight,
    JSON.stringify(lapCtrlOut)
  );

  // Release lap grip, reach onto virtual stick, squeeze -> grabs stick, consumes right grip, pulses haptic!
  tracker.update({
    right: {
      connected: true,
      isHand: false,
      gripPos: pose.stickHomePos,
      gripQuat: {x: 0, y: 0, z: 0, w: 1},
      grabbing: false,
    },
  });
  const nearCtrlOut = tracker.update({
    right: {
      connected: true,
      isHand: false,
      gripPos: pose.stickHomePos,
      gripQuat: {x: 0, y: 0, z: 0, w: 1},
      grabbing: true,
    },
    delta: 1 / 60,
  });
  check(
    'physical controller squeezing grip at virtual stick latches onto stick, suppresses side-grip turn, and pulses haptics',
    nearCtrlOut.stickActive &&
      nearCtrlOut.gripConsumedRight &&
      nearCtrlOut.haptics.length === 1 &&
      nearCtrlOut.haptics[0].side === 'right',
    JSON.stringify(nearCtrlOut)
  );

  // Resume grab latch: pinch held from Resume button does not grab bare-hand stick until released
  tracker.armGrabLatch(false, true, false, true);
  const latchedFrame = tracker.update({
    right: {
      connected: true,
      isHand: true,
      gripPos: {x: 0.22, y: -0.4, z: -0.28},
      gripQuat: restingKneeQuat,
      grabbing: true,
      pinching: true,
    },
    delta: 1 / 60,
  });
  // Release pinch, then pinch comfortably on knee -> centers stick at knee!
  tracker.update({
    right: {
      connected: true,
      isHand: true,
      gripPos: {x: 0.22, y: -0.4, z: -0.28},
      gripQuat: restingKneeQuat,
      grabbing: false,
      pinching: false,
    },
    delta: 1 / 60,
  });
  const kneeGrab = tracker.update({
    right: {
      connected: true,
      isHand: true,
      gripPos: {x: 0.22, y: -0.4, z: -0.28},
      gripQuat: restingKneeQuat,
      grabbing: true,
      pinching: true,
    },
    delta: 1 / 60,
  });
  check(
    'armGrabLatch blocks held resume pinches and allows bare-hand grab-anywhere centering on knee after release',
    !latchedFrame.stickActive &&
      kneeGrab.stickActive &&
      Math.abs(kneeGrab.stickAnchorPos.x - 0.22) < 1e-6 &&
      Math.abs(kneeGrab.stickAnchorPos.y - -0.4) < 1e-6,
    JSON.stringify({latchedFrame, kneeGrab})
  );

  // Bare-hand direct fingertip poke on pause pill triggers pause once and debounces
  tracker.reset();
  const poke1 = tracker.update({
    left: {
      connected: true,
      isHand: true,
      gripPos: {x: -0.1, y: -0.32, z: -0.35},
      indexTipPos: {...pose.pausePillPos},
      grabbing: false,
      pinching: false,
    },
    delta: 1 / 60,
  });
  const poke2 = tracker.update({
    left: {
      connected: true,
      isHand: true,
      gripPos: {x: -0.1, y: -0.32, z: -0.35},
      indexTipPos: {...pose.pausePillPos},
      grabbing: false,
      pinching: false,
    },
    delta: 1 / 60,
  });
  check(
    'touching the in-flight pause pill with a bare fingertip triggers pause once and latches cleanly',
    poke1.pauseTriggered && !poke2.pauseTriggered,
    JSON.stringify({poke1, poke2})
  );
}

// 14. VR Sim stick flight model (roll-and-pull attitude, bank hold, notches, loops, and center haptic detent)
{
  check(
    'simStickAxisResponse unscales deadzone edge without step jump and reaches full +/-1 at rim',
    simStickAxisResponse(0) === 0 &&
      simStickAxisResponse(STICK_DEADZONE) === 0 &&
      simStickAxisResponse(STICK_DEADZONE + 0.01) > 0 &&
      simStickAxisResponse(STICK_DEADZONE + 0.01) < 0.03 &&
      Math.abs(simStickAxisResponse(STICK_SENSITIVITY) - 1) < 1e-6 &&
      Math.abs(simStickAxisResponse(-STICK_SENSITIVITY) - -1) < 1e-6
  );

  // Bank hold while holding centered stick vs. hands-off trainer dihedral recovery
  const handling = {agility: 1, rollRate: 2.8, stallKts: 46, levelKts: 65};
  const sim = createVRSimStickState();
  let q = quatFromAttitude(0, 0, 0);
  for (let i = 0; i < 36; i++) {
    q = stepVRSimStickAttitude(sim, {
      quat: q,
      roll: 0.75,
      pull: 0,
      active: true,
      handling,
      kts: 120,
      dt: 1 / 60,
    }).quat;
  }
  // Let rollRate ease to 0 over 0.7s, then verify bank stays locked for 5 full seconds while holding stick
  for (let i = 0; i < 42; i++) {
    q = stepVRSimStickAttitude(sim, {
      quat: q,
      roll: 0,
      pull: 0,
      active: true,
      handling,
      kts: 120,
      dt: 1 / 60,
    }).quat;
  }
  const bankedAngle = attitudeOfQuat(q).roll; // negative = right wing down
  for (let i = 0; i < 300; i++) {
    q = stepVRSimStickAttitude(sim, {
      quat: q,
      roll: 0,
      pull: 0,
      active: true,
      handling,
      kts: 120,
      dt: 1 / 60,
    }).quat;
  }
  const heldBankAfter5s = attitudeOfQuat(q).roll;
  // Now let go of all controls (`active: false`) for 8 seconds -> dihedral recovery eases bank back
  for (let i = 0; i < 480; i++) {
    q = stepVRSimStickAttitude(sim, {
      quat: q,
      roll: 0,
      pull: 0,
      active: false,
      handling,
      kts: 120,
      dt: 1 / 60,
    }).quat;
  }
  const recoveredBank = attitudeOfQuat(q).roll;
  check(
    'Sim stick banks right and holds bank rock-solid while gripping centered stick, then gently recovers when hands-off',
    bankedAngle < -0.5 &&
      Math.abs(heldBankAfter5s - bankedAngle) < 0.005 &&
      Math.abs(recoveredBank) < 0.12,
    JSON.stringify({bankedAngle, heldBankAfter5s, recoveredBank})
  );

  // Returning stick to neutral within 8 deg of wings-level snaps cleanly onto 0 deg notch
  const notchSim = createVRSimStickState();
  let qNotch = quatFromAttitude(0, 0, -0.09); // ~5.1 deg bank
  notchSim.rollWasHeld = true;
  const notchFirst = stepVRSimStickAttitude(notchSim, {
    quat: qNotch,
    roll: 0,
    pull: 0,
    active: true,
    handling,
    kts: 120,
    dt: 1 / 60,
  });
  qNotch = notchFirst.quat;
  for (let i = 0; i < 60; i++) {
    qNotch = stepVRSimStickAttitude(notchSim, {
      quat: qNotch,
      roll: 0,
      pull: 0,
      active: true,
      handling,
      kts: 120,
      dt: 1 / 60,
    }).quat;
  }
  check(
    'returning Sim stick to neutral near wings-level triggers haptic notch and settles to 0 deg',
    notchFirst.notched && Math.abs(attitudeOfQuat(qNotch).roll) < 0.01,
    JSON.stringify({
      notched: notchFirst.notched,
      finalRoll: attitudeOfQuat(qNotch).roll,
    })
  );

  // Knife-edge (-90 deg bank) + elevator pull carves a smooth horizontal right turn
  const turnSim = createVRSimStickState();
  let qTurn = quatFromAttitude(0, 0, -Math.PI / 2);
  for (let i = 0; i < 65; i++) {
    qTurn = stepVRSimStickAttitude(turnSim, {
      quat: qTurn,
      roll: 0,
      pull: 0.85,
      active: true,
      handling,
      kts: 140,
      dt: 1 / 60,
    }).quat;
  }
  const turnAtt = attitudeOfQuat(qTurn);
  check(
    'pulling back on Sim stick in a right knife-edge bank carves a horizontal right turn',
    turnAtt.yaw < -0.6 && Math.abs(turnAtt.pitch) < 0.25,
    JSON.stringify(turnAtt)
  );

  // Full sustained roll and full sustained pull complete manual 360 deg barrel rolls and loops
  const stuntSim = createVRSimStickState();
  let qStunt = quatFromAttitude(0, 0, 0);
  let didRoll = false;
  for (let i = 0; i < 270; i++) {
    const res = stepVRSimStickAttitude(stuntSim, {
      quat: qStunt,
      roll: 1,
      pull: 0,
      active: true,
      handling,
      kts: 150,
      dt: 1 / 60,
    });
    qStunt = res.quat;
    if (res.rolled) didRoll = true;
  }
  qStunt = quatFromAttitude(0, 0, 0);
  let didLoop = false;
  let sawLooping = false;
  for (let i = 0; i < 450; i++) {
    const res = stepVRSimStickAttitude(stuntSim, {
      quat: qStunt,
      roll: 0,
      pull: 1,
      active: true,
      handling,
      kts: 150,
      dt: 1 / 60,
    });
    qStunt = res.quat;
    if (stuntSim.looping) sawLooping = true;
    if (res.looped) didLoop = true;
  }
  check(
    'sustained full Sim stick roll and pull complete 360 deg manual barrel rolls and vertical loops',
    didRoll && sawLooping && didLoop,
    JSON.stringify({didRoll, sawLooping, didLoop})
  );

  // Controller center-detent haptic tick fires once when returning virtual stick inside neutral
  const cTracker = createVRVirtualControlsTracker();
  const cPose = computeVRConsolePose({x: 0, y: 0, z: 0}, 0);
  cTracker.update({
    right: {
      connected: true,
      isHand: false,
      gripPos: {...cPose.stickHomePos},
      gripQuat: {x: 0, y: 0, z: 0, w: 1},
      grabbing: true,
    },
    delta: 1 / 60,
  });
  // Deflect stick right (+20 deg roll around Z -> q = (0, 0, -sin(10 deg), cos(10 deg)))
  const tiltQuat = {
    x: 0,
    y: 0,
    z: -Math.sin((10 * Math.PI) / 180),
    w: Math.cos((10 * Math.PI) / 180),
  };
  const deflected = cTracker.update({
    right: {
      connected: true,
      isHand: false,
      gripPos: {...cPose.stickHomePos},
      gripQuat: tiltQuat,
      grabbing: true,
    },
    delta: 1 / 60,
  });
  const centered1 = cTracker.update({
    right: {
      connected: true,
      isHand: false,
      gripPos: {...cPose.stickHomePos},
      gripQuat: {x: 0, y: 0, z: 0, w: 1},
      grabbing: true,
    },
    delta: 1 / 60,
  });
  const centered2 = cTracker.update({
    right: {
      connected: true,
      isHand: false,
      gripPos: {...cPose.stickHomePos},
      gripQuat: {x: 0, y: 0, z: 0, w: 1},
      grabbing: true,
    },
    delta: 1 / 60,
  });
  check(
    'returning virtual stick from deflection into neutral fires a single crisp center-detent haptic tick',
    deflected.haptics.length === 0 &&
      centered1.haptics.length === 1 &&
      centered2.haptics.length === 0,
    JSON.stringify({
      deflected: deflected.haptics,
      centered1: centered1.haptics,
      centered2: centered2.haptics,
    })
  );

  // Regression check: large negative dt (e.g. XRSession vs performance.now clock jump)
  // never overflows Math.exp(-dt / tau) into Infinity or NaN
  const negSim = createVRSimStickState();
  const negRes = stepVRSimStickAttitude(negSim, {
    quat: quatFromAttitude(0, 0.25, 0),
    roll: 0,
    pull: 0,
    active: false,
    handling,
    kts: 120,
    dt: -180,
  });
  check(
    'stepVRSimStickAttitude clamps negative or huge dt cleanly with zero NaN quaternion output',
    Number.isFinite(negRes.quat.x) &&
      Number.isFinite(negRes.quat.y) &&
      Number.isFinite(negRes.quat.z) &&
      Number.isFinite(negRes.quat.w) &&
      Number.isFinite(negSim.rollRate) &&
      Number.isFinite(negSim.pullRate),
    JSON.stringify({quat: negRes.quat, negSim})
  );

  // Regression check: real THREE.Quaternion & prototype-getter DOMPointReadOnly
  // poses mutated in place across XR frames (previously `{...h.gripQuat}` dropped
  // prototype getters `.x/.y/.z/.w`, poisoning stickStartQuat with undefined -> NaN
  // and crashing updateSfx() with non-finite float TypeError)
  const domPointProto = {
    get x() {
      return this._px;
    },
    get y() {
      return this._py;
    },
    get z() {
      return this._pz;
    },
  };
  const makeLiveDOMPoint = (x, y, z) => {
    const pt = Object.create(domPointProto);
    pt._px = x;
    pt._py = y;
    pt._pz = z;
    return pt;
  };

  const liveCtrlPos = new THREE.Vector3(
    cPose.stickHomePos.x,
    cPose.stickHomePos.y,
    cPose.stickHomePos.z
  );
  const liveCtrlQuat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-0.18, 0.12, 0.05, 'YXZ')
  );
  const threeTracker = createVRVirtualControlsTracker();
  const grabFrame = threeTracker.update({
    right: {
      connected: true,
      isHand: false,
      gripPos: liveCtrlPos,
      gripQuat: liveCtrlQuat,
      grabbing: true,
    },
    delta: 1 / 72,
  });

  // Mutate the SAME live THREE.Quaternion in place (matching WebXRController.update):
  // pull stick back (+X rotation) and bank right (-Z rotation)
  liveCtrlQuat.multiply(
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.42, 0, -0.42, 'YXZ'))
  );
  let tiltedFrame = grabFrame;
  const liveSimState = createVRSimStickState();
  let livePlaneQuat = quatFromAttitude(0, 0, 0);
  for (let i = 0; i < 28; i++) {
    tiltedFrame = threeTracker.update({
      right: {
        connected: true,
        isHand: false,
        gripPos: liveCtrlPos,
        gripQuat: liveCtrlQuat,
        grabbing: true,
      },
      delta: 1 / 72,
    });
    livePlaneQuat = stepVRSimStickAttitude(liveSimState, {
      quat: livePlaneQuat,
      roll: simStickAxisResponse(tiltedFrame.x),
      pull: simStickAxisResponse(tiltedFrame.y),
      active: tiltedFrame.stickActive,
      handling,
      kts: 120,
      dt: 1 / 72,
    }).quat;
  }
  const liveAtt = attitudeOfQuat(livePlaneQuat);
  check(
    'grabbing virtual stick with live THREE.Quaternion snapshots getters cleanly without NaN and drives Sim stick',
    grabFrame.stickActive &&
      grabFrame.rawX === 0 &&
      grabFrame.rawY === 0 &&
      Number.isFinite(grabFrame.visualPitch) &&
      Number.isFinite(grabFrame.visualRoll) &&
      tiltedFrame.rawX > 0.4 &&
      tiltedFrame.rawY > 0.4 &&
      tiltedFrame.x > STICK_DEADZONE &&
      tiltedFrame.y > STICK_DEADZONE &&
      Number.isFinite(liveAtt.pitch) &&
      Number.isFinite(liveAtt.roll) &&
      liveAtt.pitch > 0.03 &&
      liveAtt.roll < -0.05,
    JSON.stringify({grabFrame, tiltedFrame, liveAtt})
  );

  // Bare-hand comfort-zone grab with prototype-getter DOMPointReadOnly + THREE.Quaternion
  const handPos = makeLiveDOMPoint(0.22, -0.34, -0.32);
  const handQuat = new THREE.Quaternion();
  const handTracker = createVRVirtualControlsTracker();
  const handGrab = handTracker.update({
    right: {
      connected: true,
      isHand: true,
      gripPos: handPos,
      gripQuat: handQuat,
      grabbing: true,
    },
    delta: 1 / 72,
  });
  handPos._px += 0.1;
  handQuat.setFromEuler(new THREE.Euler(0.38, 0, -0.36, 'YXZ'));
  const handTilt = handTracker.update({
    right: {
      connected: true,
      isHand: true,
      gripPos: handPos,
      gripQuat: handQuat,
      grabbing: true,
    },
    delta: 1 / 72,
  });
  check(
    'bare-hand virtual stick grab with prototype-getter DOMPoint + THREE.Quaternion produces finite pitch/roll',
    handGrab.stickActive &&
      Number.isFinite(handGrab.rawX) &&
      Number.isFinite(handGrab.rawY) &&
      handTilt.rawX > 0.4 &&
      handTilt.rawY > 0.4 &&
      Number.isFinite(handTilt.x) &&
      Number.isFinite(handTilt.y),
    JSON.stringify({handGrab, handTilt})
  );

  // Defensive NaN boundary checks
  const nanSimRes = stepVRSimStickAttitude(createVRSimStickState(), {
    quat: {x: NaN, y: 0, z: 0, w: 1},
    roll: NaN,
    pull: NaN,
    rudder: NaN,
    handling: {topKts: 300},
    kts: NaN,
    climbLimit: NaN,
    turnScale: NaN,
    dt: NaN,
  });
  check(
    'axis scalers and stepVRSimStickAttitude sanitize NaN inputs and partial handling objects cleanly',
    scaleThumbstickAxis(NaN) === 0 &&
      unscaleThumbstickForBuggy(NaN, 0.1) === 0 &&
      simStickAxisResponse(NaN) === 0 &&
      Number.isFinite(nanSimRes.quat.x) &&
      Number.isFinite(nanSimRes.quat.y) &&
      Number.isFinite(nanSimRes.quat.z) &&
      Number.isFinite(nanSimRes.quat.w),
    JSON.stringify(nanSimRes)
  );

  // Ergonomic console height, gentle near-center Sim stick response, and Quest VR-only gating
  const smallTiltAxes = computeVirtualStickAxes({
    startPos: {x: 0.19, y: -0.5, z: -0.34},
    startQuat: {x: 0, y: 0, z: 0, w: 1},
    currentPos: {x: 0.19, y: -0.5, z: -0.34},
    currentQuat: {
      x: 0,
      y: 0,
      z: -Math.sin((6 * Math.PI) / 180), // 12 deg wrist tilt
      w: Math.cos((6 * Math.PI) / 180),
    },
  });
  const smallScaled = scaleThumbstickAxis(smallTiltAxes.rawX, STICK_DEADZONE);
  const smallSimCmd = simStickAxisResponse(smallScaled);
  check(
    'virtual stick sits at lap/armrest height (-0.5m) and 12 deg wrist tilt stays under 7% Sim stick rate',
    VR_STICK_HOME_OFFSET.y === -0.5 &&
      VR_THROTTLE_HOME_OFFSET.y === -0.52 &&
      smallSimCmd > 0 &&
      smallSimCmd < 0.07,
    JSON.stringify({
      VR_STICK_HOME_OFFSET,
      VR_THROTTLE_HOME_OFFSET,
      smallTiltAxes,
      smallScaled,
      smallSimCmd,
    })
  );

  const questUA =
    'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 OculusBrowser/34.0';
  const macUA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0';
  check(
    'shouldEnforceVROnly enables VR-only flow on WebXR headsets while keeping desktop 2D and honoring ?vrOnly=0/1',
    ChillFlightLogic.shouldEnforceVROnly({
      ua: questUA,
      xrSupported: true,
      vrOnlyParam: null,
    }) === true &&
      ChillFlightLogic.shouldEnforceVROnly({
        ua: questUA,
        xrSupported: false,
        vrOnlyParam: null,
      }) === false &&
      ChillFlightLogic.shouldEnforceVROnly({
        ua: macUA,
        xrSupported: true,
        vrOnlyParam: null,
      }) === false &&
      ChillFlightLogic.shouldEnforceVROnly({
        ua: questUA,
        xrSupported: true,
        vrOnlyParam: false,
      }) === false &&
      ChillFlightLogic.shouldEnforceVROnly({
        ua: macUA,
        xrSupported: true,
        vrOnlyParam: true,
      }) === true
  );
}

if (failed) {
  process.exit(1);
}
console.log('All VR control tests passed.');
