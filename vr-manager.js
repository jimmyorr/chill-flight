import * as THREE from 'three';
import {log} from './logger.js';
import {camera, renderer} from './sky.js';
import {activePlaneType, getMaxFlightSpeedMult, headlight} from './airplane.js';
import {
  createVRControllerGripModel,
  createVRFlightStickModel,
  createVRHandsInstancedMesh,
  createVRThrottleModel,
  updateVRHandsInstancedMesh,
} from './vr-models.js';
import {MUSIC_VOLUME, handleMusicVisibility, setMusicVolume} from './audio.js';
import {initAudioContext, sfxEnabled, syncSfxState} from './sfx.js';
import {renderFrame} from './outline-pass.js';
import {
  _currentLookTarget,
  _idealCameraPos,
  hudVrBtn,
  hudVrBtnLabel,
  vrBtn,
  vrBtnLabel,
} from './game.js';
import {
  cameraDolly,
  checkVRPresenting,
  inputManager,
} from './game-input-bindings.js';
import {scene} from './scene.js';
import {clearInputState, togglePause} from './game-state.js';
import {state} from './state.js';
import {hooks} from './hooks.js';
import {t} from './i18n.js';
import {
  CONTROLLER_GRAB_RADIUS,
  STICK_SENSITIVITY,
  VIRTUAL_THROTTLE_SPAN,
  VR_MAP_LAYOUT,
  computeVRConsolePose,
  createVRPauseInputLatch,
  createVRVirtualControlsTracker,
  evaluateHandGrab,
  evaluateHandPinch,
  extractXRControllers,
  getVRSessionInit,
  hitTestVRMapUV,
  hitTestVRPauseMenuUV,
  isGripHeld,
  isXRSessionVisible,
  readVRMapPanStick,
  uvToVRMapViewportNorm,
} from './vr-controls-logic.js';

const MENU_WIDTH = 1.6;
const MENU_HEIGHT = 1.0625;
const MAP_MENU_SCALE = 1.2;
const CANVAS_SCALE = 1.25;
const LASER_DEFAULT_LENGTH = 3.0;
const FRIEND_MAP_REFRESH_MS = 250;
const PAUSE_PILL_WIDTH = 0.092;
const PAUSE_PILL_HEIGHT = 0.052;
const VR_CAMERA_NEAR = 0.08;
const UI_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const PLANE_LABELS = {
  biplane: 'Biplane',
  seaplane: 'Seaplane',
  twin: 'Twin',
  jet: 'Jet',
  buggy: 'Rally',
};

let vrPauseMenu = null;
let vrPauseMesh = null;
let vrLaserDot0 = null;
let vrLaserDot1 = null;
let vrPauseCanvas = null;
let vrPauseTexture = null;
let vrMenuMode = 'pause';
let vrHoveredButton = -1;
let vrMapHovered = null;
let vrMapLastSig = '';
let vrMapLastDrawMs = 0;
let vrPauseHandMode = false;

let vrConsoleGroup = null;
let vrStickModel = null;
let vrThrottleModel = null;
let vrPausePillMesh = null;
let vrPausePillCanvas = null;
let vrPausePillTexture = null;
let vrPausePillHovered = false;
let vrHandsMesh = null;

let xrController0 = null;
let xrController1 = null;
let xrGrip0 = null;
let xrGrip1 = null;
let xrGripWand0 = null;
let xrGripWand1 = null;
let xrHand0 = null;
let xrHand1 = null;
let laser0 = null;
let laser1 = null;
let trackedXRSession = null;
let savedCameraNear = 1;

// Tracks live XRInputSource & select state per controller slot (0 and 1)
const slotSources = [null, null];
const slotSelectHeld = [false, false];
const prevHandGrabState = {left: false, right: false};
const prevHandPinchState = {left: false, right: false};
const prevCtrlGripState = {left: false, right: false};

// Seated head anchor in cameraDolly local space (horizon-level yaw)
const seatOrigin = new THREE.Vector3(0, 0, 0);
let seatYaw = 0;
let seatAnchorValid = false;

const _lastControllerHits = [
  {uv: null, pauseBtn: -1, mapTarget: null, handedness: null},
  {uv: null, pauseBtn: -1, mapTarget: null, handedness: null},
];

const vrRaycaster = new THREE.Raycaster();
const _vrRayMatrix = new THREE.Matrix4();
const _vrPauseLatch = createVRPauseInputLatch();
const _vrVirtualTracker = createVRVirtualControlsTracker();

// Pre-allocated scratch math objects for per-frame VR updates
const _headForward = new THREE.Vector3();
const _stickTargetPos = new THREE.Vector3();
const _throttleTargetPos = new THREE.Vector3();
const _handVisualEntries = [
  {visible: false, joints: null, active: false},
  {visible: false, joints: null, active: false},
];

function getActiveXRSession() {
  return renderer && renderer.xr && renderer.xr.getSession
    ? renderer.xr.getSession()
    : null;
}

function readCurrentVRControllers() {
  const session = getActiveXRSession();
  const gamepads =
    typeof navigator !== 'undefined' && navigator.getGamepads
      ? navigator.getGamepads()
      : [];
  const extracted = extractXRControllers(session, gamepads);
  if (!isXRSessionVisible(session)) return extracted;

  for (let i = 0; i < 2; i++) {
    const src = slotSources[i] || session?.inputSources?.[i] || null;
    if (!src?.hand) continue;
    const handObj = i === 0 ? xrHand0 : xrHand1;
    const side = src.handedness === 'left' ? 'left' : 'right';
    const fallbackPinch =
      slotSelectHeld[i] ||
      Boolean(handObj?.inputState?.pinching) ||
      Boolean(src.gamepad?.buttons?.[0]?.pressed);
    const pinched = handObj?.visible
      ? evaluateHandPinch(
          handObj.joints,
          prevHandPinchState[side],
          fallbackPinch
        )
      : fallbackPinch;
    if (side === 'left') {
      extracted.leftHandPinch = Boolean(extracted.leftHandPinch || pinched);
    } else {
      extracted.rightHandPinch = Boolean(extracted.rightHandPinch || pinched);
    }
  }
  extracted.handPinch = Boolean(
    extracted.leftHandPinch || extracted.rightHandPinch
  );
  return extracted;
}

function pulseXRInputSource(source, intensity = 0.2, durationMs = 15) {
  const actuator = source?.gamepad?.hapticActuators?.[0];
  if (actuator && typeof actuator.pulse === 'function') {
    try {
      actuator.pulse(intensity, durationMs);
    } catch {
      // Ignore unsupported haptic actuator implementations
    }
  }
}

export function pulseXRControllers(
  intensity = 0.2,
  durationMs = 15,
  side = null
) {
  const session = getActiveXRSession();
  if (!isXRSessionVisible(session) || !session.inputSources) return;
  for (const source of session.inputSources) {
    if (side && source?.handedness && source.handedness !== side) continue;
    pulseXRInputSource(source, intensity, durationMs);
  }
}

async function endVRSession() {
  if (!renderer || !renderer.xr) return;
  const currentSession = renderer.xr.getSession();
  if (currentSession) {
    try {
      await currentSession.end();
    } catch (err) {
      log.warn('Failed to end WebXR session:', err);
    }
  }
}

function drawRoundRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

function drawVRPauseMenu(hovered = -1) {
  if (!vrPauseCanvas) return;
  const ctx = vrPauseCanvas.getContext('2d');
  ctx.save();
  ctx.setTransform(CANVAS_SCALE, 0, 0, CANVAS_SCALE, 0, 0);
  ctx.clearRect(0, 0, VR_MAP_LAYOUT.canvasW, VR_MAP_LAYOUT.canvasH);

  // Background card
  ctx.fillStyle = 'rgba(18, 22, 28, 0.94)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 4;
  drawRoundRect(ctx, 40, 22, 944, 636, 36);
  ctx.fill();
  ctx.stroke();

  // Header title
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#e8c382';
  ctx.font = `bold 24px ${UI_FONT_STACK}`;
  ctx.fillText('CHILL FLIGHT', 512, 70);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 46px ${UI_FONT_STACK}`;
  ctx.fillText(t('PAUSED'), 512, 120);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = `19px ${UI_FONT_STACK}`;
  ctx.fillText(t('Take a breather or adjust your flight'), 512, 154);

  // Button 0: Resume flight (y = 178..260)
  const isResumeHover = hovered === 0;
  ctx.fillStyle = isResumeHover ? '#ffffff' : '#e8c382';
  drawRoundRect(ctx, 162, 178, 700, 82, 20);
  ctx.fill();

  ctx.fillStyle = '#161616';
  ctx.font = `bold 33px ${UI_FONT_STACK}`;
  ctx.fillText(t('Resume flight'), 512, 224);

  ctx.fillStyle = 'rgba(22, 22, 22, 0.72)';
  ctx.font = `17px ${UI_FONT_STACK}`;
  ctx.fillText(
    vrPauseHandMode ? t('Pinch to select') : t('Trigger or press A / Y'),
    512,
    249
  );

  // Button 1: Map (in-VR 3D world map, y = 272..354)
  const isMapHover = hovered === 1;
  ctx.fillStyle = isMapHover
    ? 'rgba(92, 168, 255, 0.28)'
    : 'rgba(255, 255, 255, 0.1)';
  ctx.strokeStyle = isMapHover ? '#7ab8ff' : 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 162, 272, 700, 82, 20);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 32px ${UI_FONT_STACK}`;
  ctx.fillText(t('Map'), 512, 318);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.font = `17px ${UI_FONT_STACK}`;
  ctx.fillText(t('Warp or set a waypoint'), 512, 343);

  // Button 2: Exit VR (y = 366..448)
  const isExitHover = hovered === 2;
  ctx.fillStyle = isExitHover
    ? 'rgba(235, 75, 75, 0.9)'
    : 'rgba(255, 255, 255, 0.06)';
  ctx.strokeStyle = isExitHover ? '#ff7777' : 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 162, 366, 700, 82, 20);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 32px ${UI_FONT_STACK}`;
  ctx.fillText(t('Exit VR'), 512, 412);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = `17px ${UI_FONT_STACK}`;
  ctx.fillText(
    vrPauseHandMode ? t('Pinch to select') : t('Trigger or press B'),
    512,
    437
  );

  // Quick-action pill row (y = 462..526): Camera (3), Vehicle (4), Lights (5), Stick mode (6)
  const lightsOn = Boolean(headlight && headlight.intensity > 0);
  const simStickOn = state.vrStickMode === 'sim';
  const planeKey = PLANE_LABELS[activePlaneType] || 'Biplane';
  const pills = [
    {idx: 3, x: 162, label: t('Camera'), active: false},
    {idx: 4, x: 340, label: t(planeKey), active: false},
    {idx: 5, x: 518, label: t('Lights'), active: lightsOn},
    {
      idx: 6,
      x: 696,
      label: simStickOn ? t('Sim stick') : t('Chill stick'),
      active: simStickOn,
    },
  ];

  ctx.textBaseline = 'middle';
  for (const pill of pills) {
    const isHov = hovered === pill.idx;
    ctx.fillStyle = isHov
      ? 'rgba(232, 195, 130, 0.34)'
      : pill.active
        ? 'rgba(232, 195, 130, 0.2)'
        : 'rgba(255, 255, 255, 0.08)';
    ctx.strokeStyle =
      isHov || pill.active ? '#e8c382' : 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 3;
    drawRoundRect(ctx, pill.x, 462, 166, 64, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = pill.active ? '#e8c382' : '#ffffff';
    ctx.font = `bold 22px ${UI_FONT_STACK}`;
    ctx.fillText(pill.label, pill.x + 83, 494, 148);
  }

  // Compact in-flight controller / bare-hand legend
  ctx.textBaseline = 'alphabetic';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(162, 548);
  ctx.lineTo(862, 548);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.54)';
  ctx.font = `17px ${UI_FONT_STACK}`;
  ctx.fillText(
    vrPauseHandMode
      ? simStickOn
        ? t('Right hand: sim stick (roll and pull) · Left hand: throttle')
        : t('Right hand: flight stick · Left hand: throttle')
      : simStickOn
        ? t('Sim stick: roll and pull · Triggers: throttle · Grips: rudder')
        : t('Stick: steer · Triggers: throttle · Grips: turn / roll'),
    512,
    580,
    880
  );
  ctx.fillStyle = 'rgba(255, 255, 255, 0.44)';
  ctx.fillText(
    vrPauseHandMode
      ? t('Tap or pinch pause below to open this menu')
      : t('A: camera · B: headlight · X: vehicle · Y: pause'),
    512,
    608,
    880
  );

  ctx.restore();
  if (vrPauseTexture) vrPauseTexture.needsUpdate = true;
}

function drawSecondaryBtn(ctx, rect, isHover) {
  ctx.fillStyle = isHover
    ? 'rgba(92, 168, 255, 0.34)'
    : 'rgba(255, 255, 255, 0.1)';
  ctx.strokeStyle = isHover ? '#7ab8ff' : 'rgba(255, 255, 255, 0.26)';
  ctx.lineWidth = 2.5;
  drawRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.r);
  ctx.fill();
  ctx.stroke();
}

function drawFloatingMapIconBtn(ctx, rect, isHover) {
  ctx.fillStyle = isHover
    ? 'rgba(92, 168, 255, 0.42)'
    : 'rgba(18, 22, 28, 0.88)';
  ctx.strokeStyle = isHover ? '#7ab8ff' : 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 2.5;
  drawRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.r);
  ctx.fill();
  ctx.stroke();
}

function drawVRMapCard(hoveredTarget = null) {
  if (!vrPauseCanvas) return;
  const ctx = vrPauseCanvas.getContext('2d');
  ctx.save();
  ctx.setTransform(CANVAS_SCALE, 0, 0, CANVAS_SCALE, 0, 0);
  ctx.clearRect(0, 0, VR_MAP_LAYOUT.canvasW, VR_MAP_LAYOUT.canvasH);

  const card = VR_MAP_LAYOUT.card;
  ctx.fillStyle = 'rgba(18, 22, 28, 0.96)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 3.5;
  drawRoundRect(ctx, card.x, card.y, card.w, card.h, card.r);
  ctx.fill();
  ctx.stroke();

  const info = hooks.vrMap
    ? hooks.vrMap.getOverlayInfo()
    : {
        centerCoords: '0.0° Lat, 0.0° Lon',
        hasPin: false,
        hasWaypoint: false,
        canWarp: true,
        spotName: '',
        spotCoords: '',
        spotPeople: '',
      };

  // Top bar: Back button
  const backBtn = VR_MAP_LAYOUT.backBtn;
  drawSecondaryBtn(ctx, backBtn, hoveredTarget === 'back');
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 20px ${UI_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `← ${t('Back')}`,
    backBtn.x + backBtn.w / 2,
    backBtn.y + backBtn.h / 2,
    backBtn.w - 20
  );

  // Top bar: Map title & current center coordinates
  const headerCenterX = (backBtn.x + backBtn.w + VR_MAP_LAYOUT.resumeBtn.x) / 2;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#e8c382';
  ctx.font = `bold 21px ${UI_FONT_STACK}`;
  ctx.fillText(t('Map'), headerCenterX, 43, 500);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.font = `600 16px ${UI_FONT_STACK}`;
  ctx.fillText(info.centerCoords, headerCenterX, 64, 500);

  // Top bar: Resume flight button
  const resumeBtn = VR_MAP_LAYOUT.resumeBtn;
  ctx.fillStyle = hoveredTarget === 'resume' ? '#ffffff' : '#e8c382';
  drawRoundRect(
    ctx,
    resumeBtn.x,
    resumeBtn.y,
    resumeBtn.w,
    resumeBtn.h,
    resumeBtn.r
  );
  ctx.fill();
  ctx.fillStyle = '#161616';
  ctx.font = `bold 20px ${UI_FONT_STACK}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(
    t('Resume flight'),
    resumeBtn.x + resumeBtn.w / 2,
    resumeBtn.y + resumeBtn.h / 2,
    resumeBtn.w - 22
  );

  // Clipped map viewport
  const vp = VR_MAP_LAYOUT.viewport;
  ctx.save();
  drawRoundRect(ctx, vp.x, vp.y, vp.w, vp.h, vp.r);
  ctx.clip();
  ctx.translate(vp.x, vp.y);
  if (hooks.vrMap) {
    hooks.vrMap.drawViewport(ctx, vp.w, vp.h, CANVAS_SCALE);
  } else {
    ctx.fillStyle = '#090e17';
    ctx.fillRect(0, 0, vp.w, vp.h);
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2;
  drawRoundRect(ctx, vp.x, vp.y, vp.w, vp.h, vp.r);
  ctx.stroke();

  // Floating map controls: Zoom in (+), Zoom out (-), Center on plane
  const zIn = VR_MAP_LAYOUT.zoomInBtn;
  drawFloatingMapIconBtn(ctx, zIn, hoveredTarget === 'zoomIn');
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const zInCx = zIn.x + zIn.w / 2;
  const zInCy = zIn.y + zIn.h / 2;
  ctx.beginPath();
  ctx.moveTo(zInCx - 9, zInCy);
  ctx.lineTo(zInCx + 9, zInCy);
  ctx.moveTo(zInCx, zInCy - 9);
  ctx.lineTo(zInCx, zInCy + 9);
  ctx.stroke();
  ctx.restore();

  const zOut = VR_MAP_LAYOUT.zoomOutBtn;
  drawFloatingMapIconBtn(ctx, zOut, hoveredTarget === 'zoomOut');
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const zOutCx = zOut.x + zOut.w / 2;
  const zOutCy = zOut.y + zOut.h / 2;
  ctx.beginPath();
  ctx.moveTo(zOutCx - 9, zOutCy);
  ctx.lineTo(zOutCx + 9, zOutCy);
  ctx.stroke();
  ctx.restore();

  const rec = VR_MAP_LAYOUT.recenterBtn;
  drawFloatingMapIconBtn(ctx, rec, hoveredTarget === 'recenter');
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  const recCx = rec.x + rec.w / 2;
  const recCy = rec.y + rec.h / 2;
  ctx.beginPath();
  ctx.arc(recCx, recCy, 8.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(recCx, recCy, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(recCx, recCy - 14);
  ctx.lineTo(recCx, recCy - 10);
  ctx.moveTo(recCx, recCy + 10);
  ctx.lineTo(recCx, recCy + 14);
  ctx.moveTo(recCx - 14, recCy);
  ctx.lineTo(recCx - 10, recCy);
  ctx.moveTo(recCx + 10, recCy);
  ctx.lineTo(recCx + 14, recCy);
  ctx.stroke();
  ctx.restore();

  // Bottom bar: either VR map legend or selected pin / active waypoint controls
  if (!info.hasPin && !info.hasWaypoint) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.66)';
    ctx.font = `19px ${UI_FONT_STACK}`;
    ctx.fillText(
      vrPauseHandMode
        ? t('Pinch to select')
        : t('Stick: pan · Grips: zoom · Trigger: pick a spot'),
      512,
      619,
      920
    );
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = `17px ${UI_FONT_STACK}`;
    ctx.fillText(
      vrPauseHandMode
        ? t('Warp or set a waypoint')
        : t('A / Y: resume · B: back'),
      512,
      644,
      920
    );
  } else {
    const firstBtnX = info.hasPin
      ? info.canWarp
        ? VR_MAP_LAYOUT.waypointWithWarpBtn.x
        : VR_MAP_LAYOUT.waypointNoWarpBtn.x
      : VR_MAP_LAYOUT.clearWaypointBtn.x;
    const maxTextW = Math.max(160, firstBtnX - 54);

    ctx.textAlign = 'left';
    if (info.spotName) {
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 21px ${UI_FONT_STACK}`;
      ctx.fillText(info.spotName, 40, 619, maxTextW);

      const subLine = info.spotPeople
        ? `${info.spotCoords} · ${info.spotPeople}`
        : info.spotCoords;
      ctx.fillStyle = info.spotPeople ? '#e8c382' : 'rgba(255, 255, 255, 0.72)';
      ctx.font = `600 16px ${UI_FONT_STACK}`;
      ctx.fillText(subLine, 40, 644, maxTextW);
    } else {
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd700';
      ctx.font = `bold 19px ${UI_FONT_STACK}`;
      ctx.fillText(info.spotCoords, 40, 624, maxTextW);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (info.hasPin) {
      const wpRect = info.canWarp
        ? VR_MAP_LAYOUT.waypointWithWarpBtn
        : VR_MAP_LAYOUT.waypointNoWarpBtn;
      drawSecondaryBtn(ctx, wpRect, hoveredTarget === 'waypoint');
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 19px ${UI_FONT_STACK}`;
      ctx.fillText(
        t('Set waypoint'),
        wpRect.x + wpRect.w / 2,
        wpRect.y + wpRect.h / 2,
        wpRect.w - 20
      );

      if (info.canWarp) {
        const warpRect = VR_MAP_LAYOUT.warpBtn;
        ctx.fillStyle = hoveredTarget === 'warp' ? '#ffffff' : '#e8c382';
        drawRoundRect(
          ctx,
          warpRect.x,
          warpRect.y,
          warpRect.w,
          warpRect.h,
          warpRect.r
        );
        ctx.fill();
        ctx.fillStyle = '#161616';
        ctx.font = `bold 20px ${UI_FONT_STACK}`;
        ctx.fillText(
          t('Warp here'),
          warpRect.x + warpRect.w / 2,
          warpRect.y + warpRect.h / 2,
          warpRect.w - 20
        );
      }

      const clearRect = VR_MAP_LAYOUT.clearPinBtn;
      drawSecondaryBtn(ctx, clearRect, hoveredTarget === 'clearPin');
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.8;
      ctx.lineCap = 'round';
      const cCx = clearRect.x + clearRect.w / 2;
      const cCy = clearRect.y + clearRect.h / 2;
      ctx.beginPath();
      ctx.moveTo(cCx - 7, cCy - 7);
      ctx.lineTo(cCx + 7, cCy + 7);
      ctx.moveTo(cCx + 7, cCy - 7);
      ctx.lineTo(cCx - 7, cCy + 7);
      ctx.stroke();
      ctx.restore();
    } else if (info.hasWaypoint) {
      const clearWpRect = VR_MAP_LAYOUT.clearWaypointBtn;
      drawSecondaryBtn(ctx, clearWpRect, hoveredTarget === 'waypoint');
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 19px ${UI_FONT_STACK}`;
      ctx.fillText(
        t('Clear waypoint'),
        clearWpRect.x + clearWpRect.w / 2,
        clearWpRect.y + clearWpRect.h / 2,
        clearWpRect.w - 20
      );
    }
  }

  ctx.restore();
  if (vrPauseTexture) vrPauseTexture.needsUpdate = true;
  if (hooks.vrMap) {
    vrMapLastSig = hooks.vrMap.getRenderSignature().sig;
  }
  vrMapLastDrawMs =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function openMapFromVR() {
  if (!hooks.vrMap) return;
  hooks.vrMap.open();
  vrMenuMode = 'map';
  vrHoveredButton = -1;
  vrMapHovered = null;
  vrMapLastSig = '';
  if (vrPauseMenu) {
    vrPauseMenu.scale.setScalar(MAP_MENU_SCALE);
  }
  _vrPauseLatch.arm(readCurrentVRControllers());
  pulseXRControllers(0.25, 18);
  drawVRMapCard(null);
}

function returnToVRPauseCard() {
  hooks.vrMap?.close();
  vrMenuMode = 'pause';
  vrHoveredButton = -1;
  vrMapHovered = null;
  if (vrPauseMenu) {
    vrPauseMenu.scale.setScalar(1);
  }
  _vrPauseLatch.arm(readCurrentVRControllers());
  pulseXRControllers(0.2, 15);
  drawVRPauseMenu(-1);
}

function executePauseMenuAction(action) {
  if (action === 'resume') {
    togglePause();
  } else if (action === 'map') {
    openMapFromVR();
  } else if (action === 'exit') {
    endVRSession();
  } else if (action === 'camera') {
    inputManager.onCameraToggle?.();
    pulseXRControllers(0.22, 16);
    drawVRPauseMenu(vrHoveredButton);
  } else if (action === 'plane') {
    inputManager.onPlaneToggle?.();
    pulseXRControllers(0.22, 16);
    drawVRPauseMenu(vrHoveredButton);
  } else if (action === 'headlight') {
    inputManager.onHeadlightToggle?.();
    pulseXRControllers(0.22, 16);
    drawVRPauseMenu(vrHoveredButton);
  } else if (action === 'stickMode') {
    state.vrStickMode = state.vrStickMode === 'sim' ? 'chill' : 'sim';
    try {
      localStorage.setItem('chill_flight_vr_stick_mode', state.vrStickMode);
    } catch {
      // Storage unavailable
    }
    pulseXRControllers(0.24, 18);
    drawVRPauseMenu(vrHoveredButton);
  }
}

function executeVRMapAction(action, uv) {
  if (!action) return false;
  if (action === 'back') {
    returnToVRPauseCard();
    return false;
  }
  if (action === 'resume') {
    togglePause();
    return false;
  }
  if (!hooks.vrMap) return false;

  if (action === 'zoomIn') {
    pulseXRControllers(0.25, 15);
    return hooks.vrMap.zoomByFactor(1 / 1.45);
  }
  if (action === 'zoomOut') {
    pulseXRControllers(0.25, 15);
    return hooks.vrMap.zoomByFactor(1.45);
  }
  if (action === 'recenter') {
    pulseXRControllers(0.25, 18);
    return hooks.vrMap.recenter();
  }
  if (action === 'viewport' && uv) {
    const {normX, normY} = uvToVRMapViewportNorm(uv.x, uv.y);
    const vp = VR_MAP_LAYOUT.viewport;
    pulseXRControllers(0.3, 18);
    return hooks.vrMap.pickViewport(normX, normY, vp.w, vp.h);
  }
  if (action === 'clearPin') {
    pulseXRControllers(0.2, 15);
    return hooks.vrMap.clearPin();
  }
  if (action === 'warp') {
    if (hooks.vrMap.applyWarp()) {
      pulseXRControllers(0.4, 25);
      togglePause();
    }
    return false;
  }
  if (action === 'waypoint') {
    const res = hooks.vrMap.applyWaypoint();
    if (res.acted) {
      pulseXRControllers(0.35, 22);
      if (res.resumeFlight) {
        togglePause();
        return false;
      }
      return true;
    }
  }
  return false;
}

function buildLaserPointer() {
  const geom = new THREE.CylinderGeometry(0.002, 0.0035, 1.0, 6, 1, true);
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, 0, -0.5);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xe8c382,
    transparent: true,
    opacity: 0.85,
    depthTest: false,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(geom, mat);
  beam.name = 'laserPointer';
  beam.renderOrder = 1000;
  beam.frustumCulled = false;
  beam.visible = false;
  beam.scale.set(1, 1, LASER_DEFAULT_LENGTH);
  return beam;
}

function setLaserLength(laser, length) {
  if (!laser) return;
  const clamped = Math.max(0.05, length);
  if (laser.scale.z !== clamped) {
    laser.scale.z = clamped;
  }
}

function buildLaserDot() {
  const dotRingGeo = new THREE.CircleGeometry(0.015, 24);
  const dotRingMat = new THREE.MeshBasicMaterial({
    color: 0x161616,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    depthWrite: false,
  });
  const dotRing = new THREE.Mesh(dotRingGeo, dotRingMat);
  dotRing.renderOrder = 1001;

  const dotCoreGeo = new THREE.CircleGeometry(0.009, 24);
  const dotCoreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.98,
    depthTest: false,
    depthWrite: false,
  });
  const dotCore = new THREE.Mesh(dotCoreGeo, dotCoreMat);
  dotCore.renderOrder = 1002;

  const dot = new THREE.Group();
  dot.name = 'vrLaserDot';
  dot.add(dotRing);
  dot.add(dotCore);
  dot.visible = false;
  return dot;
}

function placeLaserDot(dot, uv) {
  if (!dot) return;
  if (uv) {
    dot.position.set(
      (uv.x - 0.5) * MENU_WIDTH,
      (uv.y - 0.5) * MENU_HEIGHT,
      0.001
    );
    dot.visible = true;
  } else {
    dot.visible = false;
  }
}

function captureSeatAnchor() {
  seatOrigin.copy(camera.position);
  _headForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
  _headForward.y = 0;
  if (_headForward.lengthSq() > 1e-4) {
    _headForward.normalize();
    seatYaw = Math.atan2(-_headForward.x, -_headForward.z);
  } else {
    seatYaw = 0;
  }
  seatAnchorValid = true;
}

// Register controller, grip, and hand slots on Three.js WebXRManager before
// setSession() runs: WebXRManager ignores initial inputsourceschange events
// for indices not yet requested.
function ensureXRControllers() {
  if (!renderer || !renderer.xr || xrController0) return;

  xrController0 = renderer.xr.getController(0);
  xrController1 = renderer.xr.getController(1);
  xrGrip0 = renderer.xr.getControllerGrip(0);
  xrGrip1 = renderer.xr.getControllerGrip(1);
  xrHand0 = renderer.xr.getHand(0);
  xrHand1 = renderer.xr.getHand(1);

  const bindSlotEvents = (ctrl, idx) => {
    ctrl.addEventListener('connected', (e) => {
      slotSources[idx] = e?.data || null;
      slotSelectHeld[idx] = false;
      ctrl.userData.handedness = e?.data?.handedness || null;
    });
    ctrl.addEventListener('disconnected', () => {
      slotSources[idx] = null;
      slotSelectHeld[idx] = false;
      ctrl.userData.handedness = null;
    });
    ctrl.addEventListener('selectstart', () => {
      slotSelectHeld[idx] = true;
    });
    ctrl.addEventListener('selectend', () => {
      slotSelectHeld[idx] = false;
    });
  };
  bindSlotEvents(xrController0, 0);
  bindSlotEvents(xrController1, 1);

  laser0 = buildLaserPointer();
  xrController0.add(laser0);

  laser1 = buildLaserPointer();
  xrController1.add(laser1);

  xrGripWand0 = createVRControllerGripModel();
  xrGrip0.add(xrGripWand0);

  xrGripWand1 = createVRControllerGripModel();
  xrGrip1.add(xrGripWand1);

  vrHandsMesh = createVRHandsInstancedMesh();
  vrHandsMesh.visible = false;

  cameraDolly.add(xrController0);
  cameraDolly.add(xrController1);
  cameraDolly.add(xrGrip0);
  cameraDolly.add(xrGrip1);
  cameraDolly.add(xrHand0);
  cameraDolly.add(xrHand1);
  cameraDolly.add(vrHandsMesh);

  // Fallback select handler strictly for gamepad-less input sources whose
  // select pulse completes within a single frame.
  const onGamepadlessSelect = (event) => {
    if (event?.data?.gamepad || event?.data?.hand) return;
    if (!state.isPaused || !checkVRPresenting()) return;
    if (!isXRSessionVisible(getActiveXRSession())) return;
    const idx = event?.target === xrController1 ? 1 : 0;
    const hit = _lastControllerHits[idx];
    if (vrMenuMode === 'map') {
      if (hit.mapTarget && executeVRMapAction(hit.mapTarget, hit.uv)) {
        drawVRMapCard(vrMapHovered);
      }
      return;
    }
    const btn = hit.pauseBtn !== -1 ? hit.pauseBtn : vrHoveredButton;
    const actionMap = [
      'resume',
      'map',
      'exit',
      'camera',
      'plane',
      'headlight',
      'stickMode',
    ];
    const act = actionMap[btn];
    if (act) executePauseMenuAction(act);
  };

  xrController0.addEventListener('select', onGamepadlessSelect);
  xrController1.addEventListener('select', onGamepadlessSelect);
}

ensureXRControllers();

function drawVRPausePill(hovered = false) {
  if (!vrPausePillCanvas) return;
  const ctx = vrPausePillCanvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 144);

  ctx.save();
  ctx.fillStyle = hovered
    ? 'rgba(232, 195, 130, 0.96)'
    : 'rgba(20, 25, 33, 0.88)';
  ctx.strokeStyle = hovered ? '#ffffff' : 'rgba(232, 195, 130, 0.55)';
  ctx.lineWidth = 5;
  drawRoundRect(ctx, 10, 10, 236, 124, 44);
  ctx.fill();
  ctx.stroke();

  const fg = hovered ? '#161616' : '#e8c382';
  ctx.fillStyle = fg;
  drawRoundRect(ctx, 52, 48, 12, 48, 4);
  ctx.fill();
  drawRoundRect(ctx, 74, 48, 12, 48, 4);
  ctx.fill();

  ctx.fillStyle = hovered ? '#161616' : '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `bold 32px ${UI_FONT_STACK}`;
  ctx.fillText(t('Pause'), 102, 73, 130);
  ctx.restore();

  if (vrPausePillTexture) vrPausePillTexture.needsUpdate = true;
}

function initVRConsole() {
  if (vrConsoleGroup) return;
  ensureXRControllers();

  vrConsoleGroup = new THREE.Group();
  vrConsoleGroup.name = 'vrConsoleGroup';
  vrConsoleGroup.visible = false;

  vrStickModel = createVRFlightStickModel();
  vrThrottleModel = createVRThrottleModel();

  vrPausePillCanvas = document.createElement('canvas');
  vrPausePillCanvas.width = 256;
  vrPausePillCanvas.height = 144;
  vrPausePillTexture = new THREE.CanvasTexture(vrPausePillCanvas);
  vrPausePillTexture.minFilter = THREE.LinearFilter;
  vrPausePillTexture.magFilter = THREE.LinearFilter;

  const pillMat = new THREE.MeshBasicMaterial({
    map: vrPausePillTexture,
    transparent: true,
  });
  const pillGeo = new THREE.PlaneGeometry(PAUSE_PILL_WIDTH, PAUSE_PILL_HEIGHT);
  vrPausePillMesh = new THREE.Mesh(pillGeo, pillMat);
  vrPausePillMesh.name = 'vrPausePillMesh';
  vrPausePillMesh.rotation.order = 'YXZ';

  vrConsoleGroup.add(vrStickModel);
  vrConsoleGroup.add(vrThrottleModel);
  vrConsoleGroup.add(vrPausePillMesh);
  cameraDolly.add(vrConsoleGroup);

  drawVRPausePill(false);
}

async function enterVRSession() {
  if (!renderer || !renderer.xr || typeof navigator === 'undefined') return;
  if (!navigator.xr || renderer.xr.getSession()) return;
  try {
    ensureXRControllers();
    initVRConsole();
    const session = await navigator.xr.requestSession(
      'immersive-vr',
      getVRSessionInit()
    );
    await renderer.xr.setSession(session);
  } catch (err) {
    log.warn('Failed to start WebXR session:', err);
  }
}

async function toggleVRSession() {
  if (!renderer || !renderer.xr) return;
  if (!renderer.xr.getSession()) {
    await enterVRSession();
  } else {
    await endVRSession();
  }
}

function initVRPauseMenu() {
  if (vrPauseMenu) return;

  ensureXRControllers();

  vrPauseCanvas = document.createElement('canvas');
  vrPauseCanvas.width = Math.round(VR_MAP_LAYOUT.canvasW * CANVAS_SCALE);
  vrPauseCanvas.height = Math.round(VR_MAP_LAYOUT.canvasH * CANVAS_SCALE);

  vrPauseTexture = new THREE.CanvasTexture(vrPauseCanvas);
  vrPauseTexture.minFilter = THREE.LinearFilter;
  vrPauseTexture.magFilter = THREE.LinearFilter;

  const mat = new THREE.MeshBasicMaterial({
    map: vrPauseTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const geo = new THREE.PlaneGeometry(MENU_WIDTH, MENU_HEIGHT);
  vrPauseMesh = new THREE.Mesh(geo, mat);
  vrPauseMesh.renderOrder = 999;

  vrLaserDot0 = buildLaserDot();
  vrLaserDot1 = buildLaserDot();

  vrPauseMenu = new THREE.Group();
  vrPauseMenu.name = 'vrPauseMenu';
  vrPauseMenu.add(vrPauseMesh);
  vrPauseMenu.add(vrLaserDot0);
  vrPauseMenu.add(vrLaserDot1);
  vrPauseMenu.visible = false;
  cameraDolly.add(vrPauseMenu);

  drawVRPauseMenu(-1);
}

function hideVROverlayVisuals() {
  if (vrPauseMenu) vrPauseMenu.visible = false;
  if (vrLaserDot0) vrLaserDot0.visible = false;
  if (vrLaserDot1) vrLaserDot1.visible = false;
  if (laser0) laser0.visible = false;
  if (laser1) laser1.visible = false;
}

function readSlotSideStates(controllers) {
  const session = getActiveXRSession();
  const sides = {
    left: {
      connected: false,
      isHand: false,
      gripPos: null,
      gripQuat: null,
      indexTipPos: null,
      grabbing: false,
      pinching: false,
      hoveringPausePill: false,
      rayCtrl: null,
      laser: null,
      wand: null,
      source: null,
    },
    right: {
      connected: false,
      isHand: false,
      gripPos: null,
      gripQuat: null,
      indexTipPos: null,
      grabbing: false,
      pinching: false,
      hoveringPausePill: false,
      rayCtrl: null,
      laser: null,
      wand: null,
      source: null,
    },
  };

  for (let i = 0; i < 2; i++) {
    const src = slotSources[i] || session?.inputSources?.[i] || null;
    if (!src) continue;
    const side = src.handedness === 'left' ? 'left' : 'right';
    const entry = sides[side];
    const rayCtrl = i === 0 ? xrController0 : xrController1;
    const gripObj = i === 0 ? xrGrip0 : xrGrip1;
    const handObj = i === 0 ? xrHand0 : xrHand1;
    const laser = i === 0 ? laser0 : laser1;
    const wand = i === 0 ? xrGripWand0 : xrGripWand1;

    entry.source = src;
    entry.rayCtrl = rayCtrl;
    entry.laser = laser;
    entry.wand = wand;

    if (src.hand) {
      entry.isHand = true;
      const joints = handObj?.visible ? handObj.joints : null;
      const wrist = joints?.wrist;
      const palmRef = joints?.['middle-finger-metacarpal'] || wrist;
      const idxTip = joints?.['index-finger-tip'];
      const fallbackSelect =
        slotSelectHeld[i] ||
        Boolean(handObj?.inputState?.pinching) ||
        Boolean(src.gamepad?.buttons?.[0]?.pressed);

      if (palmRef && palmRef.visible !== false) {
        entry.connected = true;
        entry.gripPos = palmRef.position;
        entry.gripQuat =
          (wrist && wrist.visible !== false ? wrist.quaternion : null) ||
          palmRef.quaternion ||
          rayCtrl?.quaternion ||
          null;
        entry.indexTipPos =
          idxTip && idxTip.visible !== false ? idxTip.position : null;
        entry.pinching = evaluateHandPinch(
          joints,
          prevHandPinchState[side],
          fallbackSelect
        );
        entry.grabbing = evaluateHandGrab(
          joints,
          side,
          camera.position,
          prevHandGrabState[side],
          fallbackSelect
        );
      } else if (rayCtrl?.visible) {
        entry.connected = true;
        entry.gripPos = rayCtrl.position;
        entry.gripQuat = rayCtrl.quaternion;
        entry.pinching = fallbackSelect;
        entry.grabbing = fallbackSelect;
      }
      prevHandPinchState[side] = entry.pinching;
      prevHandGrabState[side] = entry.grabbing;
    } else {
      entry.isHand = false;
      const gp =
        side === 'left'
          ? controllers?.leftGp
          : controllers?.rightGp || src.gamepad;
      const poseObj = gripObj?.visible
        ? gripObj
        : rayCtrl?.visible
          ? rayCtrl
          : null;
      if (poseObj) {
        entry.connected = true;
        entry.gripPos = poseObj.position;
        entry.gripQuat = poseObj.quaternion;
        entry.grabbing = isGripHeld(gp, prevCtrlGripState[side]);
        prevCtrlGripState[side] = entry.grabbing;
      } else {
        prevCtrlGripState[side] = false;
      }
    }
  }

  return sides;
}

function syncHandAndWandVisuals(
  sides,
  activeStickSide = null,
  activeThrottleSide = null
) {
  if (!vrHandsMesh) return;
  const session = getActiveXRSession();
  const visible = isXRSessionVisible(session);

  for (let i = 0; i < 2; i++) {
    const handObj = i === 0 ? xrHand0 : xrHand1;
    const wand = i === 0 ? xrGripWand0 : xrGripWand1;
    const src = slotSources[i] || session?.inputSources?.[i] || null;
    const side = src?.handedness === 'left' ? 'left' : 'right';
    const sideInfo = sides ? sides[side] : null;

    if (visible && handObj?.visible && src?.hand) {
      _handVisualEntries[i].visible = true;
      _handVisualEntries[i].joints = handObj.joints;
      _handVisualEntries[i].active = Boolean(
        sideInfo?.pinching ||
        activeStickSide === side ||
        activeThrottleSide === side
      );
      if (wand) wand.visible = false;
    } else {
      _handVisualEntries[i].visible = false;
      _handVisualEntries[i].joints = null;
      _handVisualEntries[i].active = false;
      if (wand) {
        wand.visible =
          visible &&
          !src?.hand &&
          activeStickSide !== side &&
          activeThrottleSide !== side;
      }
    }
  }

  updateVRHandsInstancedMesh(vrHandsMesh, _handVisualEntries);
}

function armVirtualControlsFromCurrentPose() {
  const controllers = readCurrentVRControllers();
  const sides = readSlotSideStates(controllers);
  _vrVirtualTracker.armGrabLatch(
    sides.left.grabbing,
    sides.right.grabbing,
    sides.left.pinching,
    sides.right.pinching
  );
  return {controllers, sides};
}

export var openVRPauseMenu = function () {
  if (!vrPauseMenu) initVRPauseMenu();
  if (!vrPauseMenu) return;

  // Latch any buttons or bare-hand pinches still held from pausing or flying so
  // they must be released before triggering a pause-menu action.
  const {controllers, sides} = armVirtualControlsFromCurrentPose();
  _vrPauseLatch.arm(controllers);

  if (vrConsoleGroup) vrConsoleGroup.visible = false;

  // While Horizon OS owns focus ('visible-blurred' universal menu or 'hidden'
  // unmounted headset), keep our 3D pause card and lasers hidden so they do
  // not overlap the system overlay; visibilitychange will reveal them on return.
  if (!isXRSessionVisible(getActiveXRSession())) {
    hideVROverlayVisuals();
    syncHandAndWandVisuals(sides);
    return;
  }

  vrPauseHandMode = Boolean(
    controllers.hasHandInput && !controllers.hasXRGamepad
  );

  // Position directly in front of the player's current head orientation
  vrPauseMenu.position.copy(camera.position);
  vrPauseMenu.quaternion.copy(camera.quaternion);
  vrPauseMenu.translateZ(-1.8);
  vrPauseMenu.scale.setScalar(vrMenuMode === 'map' ? MAP_MENU_SCALE : 1);
  vrPauseMenu.visible = true;

  vrHoveredButton = -1;
  vrMapHovered = null;
  if (vrMenuMode === 'map') {
    drawVRMapCard(null);
  } else {
    drawVRPauseMenu(-1);
  }

  if (vrLaserDot0) vrLaserDot0.visible = false;
  if (vrLaserDot1) vrLaserDot1.visible = false;
  if (laser0) {
    setLaserLength(laser0, LASER_DEFAULT_LENGTH);
    laser0.visible = true;
  }
  if (laser1) {
    setLaserLength(laser1, LASER_DEFAULT_LENGTH);
    laser1.visible = true;
  }
};

export var closeVRPauseMenu = function () {
  if (!vrPauseMenu) return;
  hideVROverlayVisuals();
  vrPauseMenu.scale.setScalar(1);
  if (vrMenuMode === 'map') {
    hooks.vrMap?.close();
  }
  vrMenuMode = 'pause';
  vrHoveredButton = -1;
  vrMapHovered = null;
  vrMapLastSig = '';
  _vrPauseLatch.reset();
  // Latch any pinch or grip held on the Resume click so it doesn't immediately
  // grab the virtual flight stick on the first resumed flight frame.
  armVirtualControlsFromCurrentPose();
};

export var updateVRPauseInteraction = function (delta = 1 / 72) {
  if (!state.isPaused || !vrPauseMenu || !vrPauseMenu.visible || !vrPauseMesh) {
    return;
  }

  const session = getActiveXRSession();
  if (!isXRSessionVisible(session)) {
    hideVROverlayVisuals();
    if (vrHandsMesh) vrHandsMesh.visible = false;
    return;
  }

  const controllers = readCurrentVRControllers();
  const sides = readSlotSideStates(controllers);
  syncHandAndWandVisuals(sides);

  const nextHandMode = Boolean(
    controllers.hasHandInput && !controllers.hasXRGamepad
  );
  let handModeChanged = false;
  if (nextHandMode !== vrPauseHandMode) {
    vrPauseHandMode = nextHandMode;
    handModeChanged = true;
  }

  // Ensure controller and menu world matrices reflect this XR frame's pose
  // before raycasting (animate runs prior to renderer.render).
  cameraDolly.updateMatrixWorld(true);

  const isMapMode = vrMenuMode === 'map';
  const hitCtx =
    isMapMode && hooks.vrMap ? hooks.vrMap.getHitContext() : undefined;

  const slots = [
    [xrController0, laser0, vrLaserDot0, 0],
    [xrController1, laser1, vrLaserDot1, 1],
  ];

  for (const [ctrl, laser, dot, idx] of slots) {
    const slotHit = _lastControllerHits[idx];
    const fallbackSrc = slotSources[idx] || session?.inputSources?.[idx];
    slotHit.uv = null;
    slotHit.pauseBtn = -1;
    slotHit.mapTarget = null;
    slotHit.handedness =
      ctrl?.userData?.handedness || fallbackSrc?.handedness || null;

    if (!ctrl || !ctrl.visible) {
      if (laser) {
        setLaserLength(laser, LASER_DEFAULT_LENGTH);
        laser.visible = false;
      }
      if (dot) dot.visible = false;
      continue;
    }
    if (laser) laser.visible = true;

    _vrRayMatrix.identity().extractRotation(ctrl.matrixWorld);
    vrRaycaster.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
    vrRaycaster.ray.direction.set(0, 0, -1).applyMatrix4(_vrRayMatrix);

    const hits = vrRaycaster.intersectObject(vrPauseMesh);
    if (hits.length > 0 && hits[0].uv) {
      const hit = hits[0];
      if (laser) setLaserLength(laser, hit.distance);
      slotHit.uv = hit.uv;
      placeLaserDot(dot, hit.uv);
      if (isMapMode) {
        slotHit.mapTarget = hitTestVRMapUV(hit.uv.x, hit.uv.y, hitCtx);
      } else {
        slotHit.pauseBtn = hitTestVRPauseMenuUV(hit.uv.x, hit.uv.y);
      }
    } else {
      if (laser) setLaserLength(laser, LASER_DEFAULT_LENGTH);
      if (dot) dot.visible = false;
    }
  }

  if (!isMapMode) {
    let hovered = -1;
    const hoveredByHand = {left: -1, right: -1, any: -1};
    for (const h of _lastControllerHits) {
      if (h.pauseBtn !== -1) {
        if (h.handedness === 'left') hoveredByHand.left = h.pauseBtn;
        else if (h.handedness === 'right') hoveredByHand.right = h.pauseBtn;
        if (hovered === -1 || h.handedness === 'right') {
          hovered = h.pauseBtn;
        }
      }
    }
    hoveredByHand.any = hovered;

    if (hovered !== vrHoveredButton || handModeChanged) {
      const changedHover = hovered !== vrHoveredButton;
      vrHoveredButton = hovered;
      drawVRPauseMenu(vrHoveredButton);
      if (changedHover && vrHoveredButton !== -1) {
        pulseXRControllers(0.2, 15);
      }
    }

    const action = _vrPauseLatch.poll(controllers, hoveredByHand);
    if (action) {
      executePauseMenuAction(action);
    }
    return;
  }

  // In-VR 3D world map interaction
  let hoveredBtnTarget = null;
  const targetByHand = {left: null, right: null, any: null};
  const uvByHand = {left: null, right: null, any: null};

  for (const h of _lastControllerHits) {
    if (!h.uv) continue;
    if (h.handedness === 'left') {
      targetByHand.left = h.mapTarget;
      uvByHand.left = h.uv;
    } else if (h.handedness === 'right') {
      targetByHand.right = h.mapTarget;
      uvByHand.right = h.uv;
    }
    if (!uvByHand.any || h.handedness === 'right') {
      uvByHand.any = h.uv;
    }
    if (h.mapTarget) {
      if (
        !targetByHand.any ||
        (targetByHand.any === 'viewport' && h.mapTarget !== 'viewport') ||
        (h.handedness === 'right' &&
          (h.mapTarget !== 'viewport' || targetByHand.any === 'viewport'))
      ) {
        targetByHand.any = h.mapTarget;
        uvByHand.any = h.uv;
      }
    }
    if (h.mapTarget && h.mapTarget !== 'viewport') {
      if (!hoveredBtnTarget || h.handedness === 'right') {
        hoveredBtnTarget = h.mapTarget;
      }
    }
  }

  let mapDirty = handModeChanged;
  if (hoveredBtnTarget !== vrMapHovered) {
    vrMapHovered = hoveredBtnTarget;
    mapDirty = true;
    if (vrMapHovered) {
      pulseXRControllers(0.2, 15);
    }
  }

  const dt = Math.min(
    0.1,
    Math.max(1 / 240, typeof delta === 'number' && delta > 0 ? delta : 1 / 72)
  );

  const pan = readVRMapPanStick(controllers);
  if (pan.active && hooks.vrMap?.pan(pan.x, pan.y, dt)) {
    mapDirty = true;
  }

  const {action, hand, gripZoom} = _vrPauseLatch.pollMap(
    controllers,
    targetByHand
  );
  if (
    gripZoom !== 0 &&
    hooks.vrMap?.zoomByFactor(Math.pow(2.4, -gripZoom * dt))
  ) {
    mapDirty = true;
  }

  if (action) {
    const clickUV = (hand && uvByHand[hand]) || uvByHand.any || null;
    if (executeVRMapAction(action, clickUV)) {
      mapDirty = true;
    }
    if (!state.isPaused || vrMenuMode !== 'map') {
      return;
    }
  }

  if (!mapDirty && hooks.vrMap) {
    const {sig, hasFriends} = hooks.vrMap.getRenderSignature();
    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (sig !== vrMapLastSig) {
      mapDirty = true;
    } else if (hasFriends && now - vrMapLastDrawMs >= FRIEND_MAP_REFRESH_MS) {
      mapDirty = true;
    }
  }

  if (mapDirty) {
    drawVRMapCard(vrMapHovered);
  }
};

function pollVRVirtualControls(delta, controllers, isPausedFrame = false) {
  const session = getActiveXRSession();
  if (!isXRSessionVisible(session)) {
    if (vrConsoleGroup) vrConsoleGroup.visible = false;
    if (vrHandsMesh) vrHandsMesh.visible = false;
    if (laser0) laser0.visible = false;
    if (laser1) laser1.visible = false;
    _vrVirtualTracker.reset();
    return null;
  }

  initVRConsole();

  if (!seatAnchorValid) {
    captureSeatAnchor();
  }

  const sides = readSlotSideStates(controllers);

  if (isPausedFrame || state.isPaused) {
    if (vrConsoleGroup) vrConsoleGroup.visible = false;
    _vrVirtualTracker.armGrabLatch(
      sides.left.grabbing,
      sides.right.grabbing,
      sides.left.pinching,
      sides.right.pinching
    );
    syncHandAndWandVisuals(sides);
    return null;
  }

  const headDrift = Math.hypot(
    camera.position.x - seatOrigin.x,
    camera.position.z - seatOrigin.z
  );
  if (headDrift > 0.45 && !sides.left.grabbing && !sides.right.grabbing) {
    captureSeatAnchor();
  }

  const prePose = computeVRConsolePose(seatOrigin, seatYaw);
  if (vrPausePillMesh) {
    vrPausePillMesh.position.set(
      prePose.pausePillPos.x,
      prePose.pausePillPos.y,
      prePose.pausePillPos.z
    );
    vrPausePillMesh.rotation.set(-0.62, seatYaw, 0, 'YXZ');
    vrPausePillMesh.visible = Boolean(controllers?.hasHandInput);
  }

  let anyPillHover = false;
  if (vrConsoleGroup) vrConsoleGroup.visible = true;
  cameraDolly.updateMatrixWorld(true);

  for (const side of ['left', 'right']) {
    const h = sides[side];
    if (!h.laser) continue;
    if (
      vrPausePillMesh?.visible &&
      h.connected &&
      h.isHand &&
      h.rayCtrl?.visible
    ) {
      _vrRayMatrix.identity().extractRotation(h.rayCtrl.matrixWorld);
      vrRaycaster.ray.origin.setFromMatrixPosition(h.rayCtrl.matrixWorld);
      vrRaycaster.ray.direction.set(0, 0, -1).applyMatrix4(_vrRayMatrix);
      const hits = vrRaycaster.intersectObject(vrPausePillMesh);
      if (hits.length > 0 && hits[0].distance < 1.2) {
        h.hoveringPausePill = true;
        anyPillHover = true;
        setLaserLength(h.laser, hits[0].distance);
        h.laser.visible = true;
      } else {
        h.laser.visible = false;
      }
    } else {
      h.laser.visible = false;
    }
  }

  if (anyPillHover !== vrPausePillHovered) {
    vrPausePillHovered = anyPillHover;
    drawVRPausePill(vrPausePillHovered);
  }

  const maxSpeed = Math.max(0.01, getMaxFlightSpeedMult());
  const currentNormThrottle = THREE.MathUtils.clamp(
    state.targetFlightSpeed / maxSpeed,
    0,
    1
  );

  const prevThrottle = state.targetFlightSpeed;
  const out = _vrVirtualTracker.update({
    left: sides.left,
    right: sides.right,
    headPos: camera.position,
    seatOrigin,
    seatYaw,
    currentThrottle: currentNormThrottle,
    isBuggy: activePlaneType === 'buggy',
    delta,
  });

  for (const pulse of out.haptics) {
    const src = sides[pulse.side]?.source;
    if (src && !src.hand) {
      pulseXRInputSource(src, pulse.intensity, pulse.durationMs);
    }
  }

  let throttlingUp = false;
  if (out.throttleTarget !== null) {
    const nextSpeed = out.throttleTarget * maxSpeed;
    throttlingUp = nextSpeed > prevThrottle + 1e-4;
    state.targetFlightSpeed = nextSpeed;
    hooks.updateThrottle?.();
  }

  const activeNormThrottle =
    out.throttleTarget !== null ? out.throttleTarget : currentNormThrottle;

  const safeDelta =
    Number.isFinite(delta) && delta > 0 ? Math.min(0.1, delta) : 0;

  if (vrStickModel) {
    _stickTargetPos.set(
      out.stickAnchorPos.x,
      out.stickAnchorPos.y,
      out.stickAnchorPos.z
    );
    const posEase = out.stickActive
      ? 1 - Math.exp(-safeDelta / 0.025)
      : 1 - Math.exp(-safeDelta / 0.14);
    if (vrStickModel.position.lengthSq() === 0) {
      vrStickModel.position.copy(_stickTargetPos);
    } else {
      vrStickModel.position.lerp(_stickTargetPos, posEase);
    }
    vrStickModel.rotation.y = seatYaw;

    let targetRotX = out.visualPitch;
    let targetRotZ = out.visualRoll;
    if (!out.stickActive && inputManager.state.gamepad.steeringActive) {
      const nx = THREE.MathUtils.clamp(
        inputManager.state.gamepad.x / STICK_SENSITIVITY,
        -1,
        1
      );
      const ny = THREE.MathUtils.clamp(
        inputManager.state.gamepad.y / STICK_SENSITIVITY,
        -1,
        1
      );
      // Pushing a physical thumbstick forward (ny > 0) tilts the 3D stick
      // forward (-Z, negative X rotation), and pulling back tilts it back (+Z)
      targetRotX = -ny * 0.3;
      targetRotZ = -nx * 0.3;
    }
    const tiltEase = out.stickActive ? 1 : 1 - Math.exp(-safeDelta / 0.08);
    vrStickModel.pivotGroup.rotation.x = THREE.MathUtils.lerp(
      vrStickModel.pivotGroup.rotation.x,
      targetRotX,
      tiltEase
    );
    vrStickModel.pivotGroup.rotation.z = THREE.MathUtils.lerp(
      vrStickModel.pivotGroup.rotation.z,
      targetRotZ,
      tiltEase
    );

    const nearCtrlStick =
      !out.stickActive &&
      ((sides.right.connected &&
        !sides.right.isHand &&
        sides.right.gripPos?.distanceTo(_stickTargetPos) <=
          CONTROLLER_GRAB_RADIUS) ||
        (sides.left.connected &&
          !sides.left.isHand &&
          sides.left.gripPos?.distanceTo(_stickTargetPos) <=
            CONTROLLER_GRAB_RADIUS));
    vrStickModel.setGrabbed(out.stickActive, nearCtrlStick);
  }

  if (vrThrottleModel) {
    if (out.throttleHolder) {
      const handleStartZ = (0.5 - out.throttleStartVal) * VIRTUAL_THROTTLE_SPAN;
      const c = Math.cos(seatYaw);
      const s = Math.sin(seatYaw);
      _throttleTargetPos.set(
        out.throttleAnchorPos.x - s * handleStartZ,
        out.throttleAnchorPos.y,
        out.throttleAnchorPos.z - c * handleStartZ
      );
    } else {
      _throttleTargetPos.set(
        out.consolePose.throttleHomePos.x,
        out.consolePose.throttleHomePos.y,
        out.consolePose.throttleHomePos.z
      );
    }
    const thrEase = out.throttleHolder
      ? 1 - Math.exp(-safeDelta / 0.025)
      : 1 - Math.exp(-safeDelta / 0.14);
    if (vrThrottleModel.position.lengthSq() === 0) {
      vrThrottleModel.position.copy(_throttleTargetPos);
    } else {
      vrThrottleModel.position.lerp(_throttleTargetPos, thrEase);
    }
    vrThrottleModel.rotation.y = seatYaw;

    const nearCtrlThr =
      !out.throttleHolder &&
      ((sides.left.connected &&
        !sides.left.isHand &&
        sides.left.gripPos?.distanceTo(_throttleTargetPos) <=
          CONTROLLER_GRAB_RADIUS) ||
        (sides.right.connected &&
          !sides.right.isHand &&
          sides.right.gripPos?.distanceTo(_throttleTargetPos) <=
            CONTROLLER_GRAB_RADIUS));
    vrThrottleModel.setThrottle(
      activeNormThrottle,
      Boolean(out.throttleHolder),
      nearCtrlThr
    );
  }

  syncHandAndWandVisuals(sides, out.stickHolder, out.throttleHolder);

  return {
    pauseTriggered: out.pauseTriggered,
    stickActive: out.stickActive,
    rawX: out.rawX,
    rawY: out.rawY,
    x: out.x,
    y: out.y,
    throttleTarget: out.throttleTarget,
    throttlingUp,
    gripConsumedLeft: out.gripConsumedLeft,
    gripConsumedRight: out.gripConsumedRight,
  };
}

function onXRVisibilityChange() {
  if (!trackedXRSession) return;
  handleMusicVisibility(trackedXRSession.visibilityState === 'hidden');

  if (!isXRSessionVisible(trackedXRSession)) {
    _vrVirtualTracker.reset();
    if (vrConsoleGroup) vrConsoleGroup.visible = false;
    if (vrHandsMesh) vrHandsMesh.visible = false;
    if (!state.isPaused) {
      togglePause();
    }
    hideVROverlayVisuals();
    vrHoveredButton = -1;
    vrMapHovered = null;
  } else if (state.isPaused) {
    openVRPauseMenu();
  }
}

if (vrBtn) {
  vrBtn.addEventListener('click', toggleVRSession);
}
if (hudVrBtn) {
  hudVrBtn.addEventListener('click', toggleVRSession);
}

if (renderer && renderer.xr) {
  renderer.xr.addEventListener('sessionstart', () => {
    initVRPauseMenu();
    initVRConsole();
    seatAnchorValid = false;
    _vrVirtualTracker.reset();

    // Lower near clip plane in VR so hands and virtual stick/throttle within
    // arm's reach (0.1 to 0.6 m) never clip; restored on sessionend.
    savedCameraNear = camera.near;
    camera.near = VR_CAMERA_NEAR;
    camera.updateProjectionMatrix();

    // Keep VR camera in a horizon-stable forward view (birds-eye looks straight
    // down -Y and cinematic hijacks the thumbstick to orbit).
    if (state.cameraMode !== 'follow' && state.cameraMode !== 'first-person') {
      state.cameraMode = 'follow';
      state.cameraTransitionProgress = 0;
    }

    // Attach camera to cameraDolly so headset pose is layered on top of flight positioning
    cameraDolly.position.copy(camera.position);
    cameraDolly.quaternion.copy(camera.quaternion);
    scene.add(cameraDolly);
    cameraDolly.add(camera);
    camera.position.set(0, 0, 0);
    camera.quaternion.identity();

    // Enable Quest 2 fixed foveated rendering (reduces outer lens fillrate cost)
    if (typeof renderer.xr.setFoveation === 'function') {
      renderer.xr.setFoveation(1.0);
    }

    // Negotiate 72 or 90 Hz if supported and track Horizon OS focus state
    const session = renderer.xr.getSession();
    if (
      trackedXRSession &&
      typeof trackedXRSession.removeEventListener === 'function'
    ) {
      trackedXRSession.removeEventListener(
        'visibilitychange',
        onXRVisibilityChange
      );
    }
    trackedXRSession = session;
    if (session && typeof session.addEventListener === 'function') {
      session.addEventListener('visibilitychange', onXRVisibilityChange);
    }

    if (
      session &&
      session.supportedFrameRates &&
      typeof session.updateTargetFrameRate === 'function'
    ) {
      const targetRate = session.supportedFrameRates.includes(72)
        ? 72
        : session.supportedFrameRates.includes(90)
          ? 90
          : null;
      if (targetRate) {
        session.updateTargetFrameRate(targetRate).catch(() => {});
      }
    }

    if (vrBtnLabel) vrBtnLabel.textContent = t('Exit VR');
    if (hudVrBtnLabel) hudVrBtnLabel.textContent = t('Exit VR');

    // If still at loading screen, dismiss and begin flight immediately
    const loadingEl = document.getElementById('loading-overlay');
    if (
      loadingEl &&
      loadingEl.style.display !== 'none' &&
      typeof state.dismissLoadingScreen === 'function'
    ) {
      state.dismissLoadingScreen(true);
    } else if (state.isPaused) {
      state.isPaused = false;
      state.justResumed = true;
      for (const id of [
        'pause-overlay',
        'achievements-overlay',
        'people-overlay',
        'help-overlay',
        'language-overlay',
      ]) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      }
      if (hooks.fullscreenMap?.isOpen()) {
        hooks.fullscreenMap.close({quiet: true});
      }
      setMusicVolume(MUSIC_VOLUME);
      syncSfxState();
      if (sfxEnabled) initAudioContext();
      clearInputState();
      hooks.onResume?.();
    }
  });

  renderer.xr.addEventListener('sessionend', () => {
    if (
      trackedXRSession &&
      typeof trackedXRSession.removeEventListener === 'function'
    ) {
      trackedXRSession.removeEventListener(
        'visibilitychange',
        onXRVisibilityChange
      );
    }
    trackedXRSession = null;
    slotSources[0] = null;
    slotSources[1] = null;
    slotSelectHeld[0] = false;
    slotSelectHeld[1] = false;
    seatAnchorValid = false;
    _vrVirtualTracker.reset();
    if (vrConsoleGroup) vrConsoleGroup.visible = false;
    if (vrHandsMesh) vrHandsMesh.visible = false;
    handleMusicVisibility(false);

    // Restore standard 2D near clip plane and detach camera from dolly
    camera.near = savedCameraNear;
    camera.updateProjectionMatrix();

    cameraDolly.remove(camera);
    scene.remove(cameraDolly);
    camera.position.copy(_idealCameraPos);
    camera.lookAt(_currentLookTarget);

    closeVRPauseMenu();

    if (state.vrOnlyFlow) {
      // Paint one static frame at the current flight spot behind the 2D pause
      // menu, then keep 2D paused so Quest never runs unpaused 2D flight.
      renderFrame(scene, camera);
      if (!state.isPaused) {
        togglePause();
      } else {
        const pauseOverlayEl = document.getElementById('pause-overlay');
        if (pauseOverlayEl) pauseOverlayEl.style.display = 'flex';
      }
    }

    if (vrBtnLabel) vrBtnLabel.textContent = 'VR';
    if (hudVrBtnLabel) hudVrBtnLabel.textContent = 'VR';
  });
}

hooks.enterVR = enterVRSession;
hooks.openVRPauseMenu = openVRPauseMenu;
hooks.closeVRPauseMenu = closeVRPauseMenu;
hooks.pollVRVirtualControls = pollVRVirtualControls;
