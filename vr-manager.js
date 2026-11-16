import * as THREE from 'three';
import {log} from './logger.js';
import {camera, renderer} from './sky.js';
import {handleMusicVisibility} from './audio.js';
import {
  _currentLookTarget,
  _idealCameraPos,
  hudVrBtn,
  hudVrBtnLabel,
  vrBtn,
  vrBtnLabel,
} from './game.js';
import {cameraDolly, checkVRPresenting} from './game-input-bindings.js';
import {scene} from './scene.js';
import {clearInputState, togglePause} from './game-state.js';
import {state} from './state.js';
import {hooks} from './hooks.js';
import {t} from './i18n.js';
import {
  VR_MAP_LAYOUT,
  createVRPauseInputLatch,
  extractXRControllers,
  getVRSessionInit,
  hitTestVRMapUV,
  hitTestVRPauseMenuUV,
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
const UI_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

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
let xrController0 = null;
let xrController1 = null;
let laser0 = null;
let laser1 = null;
let trackedXRSession = null;

const _lastControllerHits = [
  {uv: null, pauseBtn: -1, mapTarget: null, handedness: null},
  {uv: null, pauseBtn: -1, mapTarget: null, handedness: null},
];

const vrRaycaster = new THREE.Raycaster();
const _vrRayMatrix = new THREE.Matrix4();
const _vrPauseLatch = createVRPauseInputLatch();

function getActiveXRSession() {
  return renderer && renderer.xr && renderer.xr.getSession
    ? renderer.xr.getSession()
    : null;
}

function readCurrentVRControllers() {
  const gamepads =
    typeof navigator !== 'undefined' && navigator.getGamepads
      ? navigator.getGamepads()
      : [];
  return extractXRControllers(getActiveXRSession(), gamepads);
}

function pulseXRControllers(intensity = 0.2, durationMs = 15) {
  const session = getActiveXRSession();
  if (!isXRSessionVisible(session) || !session.inputSources) return;
  for (const source of session.inputSources) {
    const actuator = source?.gamepad?.hapticActuators?.[0];
    if (actuator && typeof actuator.pulse === 'function') {
      try {
        actuator.pulse(intensity, durationMs);
      } catch {
        // Ignore unsupported haptic actuator implementations
      }
    }
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
  drawRoundRect(ctx, 40, 30, 944, 620, 36);
  ctx.fill();
  ctx.stroke();

  // Header title
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#e8c382';
  ctx.font = `bold 26px ${UI_FONT_STACK}`;
  ctx.fillText('CHILL FLIGHT', 512, 92);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 50px ${UI_FONT_STACK}`;
  ctx.fillText(t('PAUSED'), 512, 152);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = `21px ${UI_FONT_STACK}`;
  ctx.fillText(t('Take a breather or adjust your flight'), 512, 192);

  // Button 0: Resume flight
  const isResumeHover = hovered === 0;
  ctx.fillStyle = isResumeHover ? '#ffffff' : '#e8c382';
  drawRoundRect(ctx, 162, 228, 700, 96, 22);
  ctx.fill();

  ctx.fillStyle = '#161616';
  ctx.font = `bold 36px ${UI_FONT_STACK}`;
  ctx.fillText(t('Resume flight'), 512, 282);

  ctx.fillStyle = 'rgba(22, 22, 22, 0.72)';
  ctx.font = `19px ${UI_FONT_STACK}`;
  ctx.fillText(t('Trigger or press A / Y'), 512, 310);

  // Button 1: Map (in-VR 3D world map)
  const isMapHover = hovered === 1;
  ctx.fillStyle = isMapHover
    ? 'rgba(92, 168, 255, 0.28)'
    : 'rgba(255, 255, 255, 0.1)';
  ctx.strokeStyle = isMapHover ? '#7ab8ff' : 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 162, 344, 700, 96, 22);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 35px ${UI_FONT_STACK}`;
  ctx.fillText(t('Map'), 512, 398);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.font = `19px ${UI_FONT_STACK}`;
  ctx.fillText(t('Warp or set a waypoint'), 512, 426);

  // Button 2: Exit VR
  const isExitHover = hovered === 2;
  ctx.fillStyle = isExitHover
    ? 'rgba(235, 75, 75, 0.9)'
    : 'rgba(255, 255, 255, 0.06)';
  ctx.strokeStyle = isExitHover ? '#ff7777' : 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 162, 460, 700, 96, 22);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 35px ${UI_FONT_STACK}`;
  ctx.fillText(t('Exit VR'), 512, 514);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = `19px ${UI_FONT_STACK}`;
  ctx.fillText(t('Trigger or press B'), 512, 542);

  // Compact in-flight controller legend
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(162, 574);
  ctx.lineTo(862, 574);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
  ctx.font = `18px ${UI_FONT_STACK}`;
  ctx.fillText(
    t('Stick: steer · Triggers: throttle · Grips: turn / roll'),
    512,
    602,
    880
  );
  ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.fillText(
    t('A: camera · B: headlight · X: vehicle · Y: pause'),
    512,
    628,
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
      t('Stick: pan · Grips: zoom · Trigger: pick a spot'),
      512,
      619,
      920
    );
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = `17px ${UI_FONT_STACK}`;
    ctx.fillText(t('A / Y: resume · B: back'), 512, 644, 920);
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

// Register controller slots on Three.js WebXRManager before setSession() runs:
// WebXRManager ignores the initial inputsourceschange event for controllers
// whose index has not yet been requested via renderer.xr.getController(i).
function ensureXRControllers() {
  if (!renderer || !renderer.xr || xrController0) return;

  xrController0 = renderer.xr.getController(0);
  xrController1 = renderer.xr.getController(1);

  const trackHandedness = (ctrl) => {
    ctrl.addEventListener('connected', (e) => {
      ctrl.userData.handedness = e?.data?.handedness || null;
    });
    ctrl.addEventListener('disconnected', () => {
      ctrl.userData.handedness = null;
    });
  };
  trackHandedness(xrController0);
  trackHandedness(xrController1);

  laser0 = buildLaserPointer();
  xrController0.add(laser0);

  laser1 = buildLaserPointer();
  xrController1.add(laser1);

  cameraDolly.add(xrController0);
  cameraDolly.add(xrController1);

  // Fallback select handler strictly for gamepad-less input sources (e.g. hand
  // pinch on browsers that do not expose a synthetic gamepad button[0]).
  const onGamepadlessSelect = (event) => {
    if (event?.data?.gamepad) return;
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
    if (btn === 0) {
      togglePause();
    } else if (btn === 1) {
      openMapFromVR();
    } else if (btn === 2) {
      endVRSession();
    }
  };

  xrController0.addEventListener('select', onGamepadlessSelect);
  xrController1.addEventListener('select', onGamepadlessSelect);
}

ensureXRControllers();

async function enterVRSession() {
  if (!renderer || !renderer.xr || typeof navigator === 'undefined') return;
  if (!navigator.xr || renderer.xr.getSession()) return;
  try {
    ensureXRControllers();
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

export var openVRPauseMenu = function () {
  if (!vrPauseMenu) initVRPauseMenu();
  if (!vrPauseMenu) return;

  // Latch any buttons still held from pausing or flying so they must be
  // released before triggering a pause-menu action.
  _vrPauseLatch.arm(readCurrentVRControllers());

  // While Horizon OS owns focus ('visible-blurred' universal menu or 'hidden'
  // unmounted headset), keep our 3D pause card and lasers hidden so they do
  // not overlap the system overlay; visibilitychange will reveal them on return.
  if (!isXRSessionVisible(getActiveXRSession())) {
    hideVROverlayVisuals();
    return;
  }

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
};

export var updateVRPauseInteraction = function (delta = 1 / 72) {
  if (!state.isPaused || !vrPauseMenu || !vrPauseMenu.visible || !vrPauseMesh) {
    return;
  }

  if (!isXRSessionVisible(getActiveXRSession())) {
    hideVROverlayVisuals();
    return;
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
    slotHit.uv = null;
    slotHit.pauseBtn = -1;
    slotHit.mapTarget = null;
    slotHit.handedness = ctrl?.userData?.handedness || null;

    if (!ctrl || !ctrl.visible) {
      if (laser) setLaserLength(laser, LASER_DEFAULT_LENGTH);
      if (dot) dot.visible = false;
      continue;
    }

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

  const controllers = readCurrentVRControllers();

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

    if (hovered !== vrHoveredButton) {
      vrHoveredButton = hovered;
      drawVRPauseMenu(vrHoveredButton);
      if (vrHoveredButton !== -1) {
        pulseXRControllers(0.2, 15);
      }
    }

    const action = _vrPauseLatch.poll(controllers, hoveredByHand);
    if (action === 'resume') {
      togglePause();
    } else if (action === 'map') {
      openMapFromVR();
    } else if (action === 'exit') {
      endVRSession();
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

  let mapDirty = false;
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

function onXRVisibilityChange() {
  if (!trackedXRSession) return;
  handleMusicVisibility(trackedXRSession.visibilityState === 'hidden');

  if (!isXRSessionVisible(trackedXRSession)) {
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
      const pauseOverlayEl = document.getElementById('pause-overlay');
      if (pauseOverlayEl) pauseOverlayEl.style.display = 'none';
      clearInputState();
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
    handleMusicVisibility(false);

    // Detach camera from dolly and restore to standard world camera
    cameraDolly.remove(camera);
    scene.remove(cameraDolly);
    camera.position.copy(_idealCameraPos);
    camera.lookAt(_currentLookTarget);

    closeVRPauseMenu();

    if (vrBtnLabel) vrBtnLabel.textContent = 'VR';
    if (hudVrBtnLabel) hudVrBtnLabel.textContent = 'VR';
  });
}

hooks.enterVR = enterVRSession;
hooks.openVRPauseMenu = openVRPauseMenu;
hooks.closeVRPauseMenu = closeVRPauseMenu;
