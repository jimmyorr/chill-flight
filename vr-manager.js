import * as THREE from 'three';
import {log} from './logger.js';
import {camera, renderer} from './sky.js';
import {
  _currentLookTarget,
  _idealCameraPos,
  splashVrBtn,
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
  createVRPauseInputLatch,
  extractXRControllers,
  getVRSessionInit,
  hitTestVRPauseMenuUV,
} from './vr-controls-logic.js';

const MENU_WIDTH = 1.6;
const MENU_HEIGHT = 1.0625;
const LASER_DEFAULT_LENGTH = 3.0;

let vrPauseMenu = null;
let vrPauseMesh = null;
let vrLaserDot = null;
let vrPauseCanvas = null;
let vrPauseTexture = null;
let vrHoveredButton = -1;
let xrController0 = null;
let xrController1 = null;
let laser0 = null;
let laser1 = null;

const vrRaycaster = new THREE.Raycaster();
const _vrRayMatrix = new THREE.Matrix4();
const _vrPauseLatch = createVRPauseInputLatch();

function readCurrentVRControllers() {
  const gamepads =
    typeof navigator !== 'undefined' && navigator.getGamepads
      ? navigator.getGamepads()
      : [];
  const session =
    renderer && renderer.xr && renderer.xr.getSession
      ? renderer.xr.getSession()
      : null;
  return extractXRControllers(session, gamepads);
}

function pulseXRControllers(intensity = 0.2, durationMs = 15) {
  const session =
    renderer && renderer.xr && renderer.xr.getSession
      ? renderer.xr.getSession()
      : null;
  if (!session || !session.inputSources) return;
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

async function openMapFromVR() {
  state.returnToVROnMapClose = true;
  await endVRSession();
  hooks.fullscreenMap?.open();
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

// Register controller slots on Three.js WebXRManager before setSession() runs:
// WebXRManager ignores the initial inputsourceschange event for controllers
// whose index has not yet been requested via renderer.xr.getController(i).
function ensureXRControllers() {
  if (!renderer || !renderer.xr || xrController0) return;

  xrController0 = renderer.xr.getController(0);
  xrController1 = renderer.xr.getController(1);

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
    if (vrHoveredButton === 0) {
      togglePause();
    } else if (vrHoveredButton === 1) {
      openMapFromVR();
    } else if (vrHoveredButton === 2) {
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
  ctx.clearRect(0, 0, 1024, 680);

  // Background card
  ctx.save();
  ctx.fillStyle = 'rgba(18, 22, 28, 0.94)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 4;
  drawRoundRect(ctx, 40, 30, 944, 620, 36);
  ctx.fill();
  ctx.stroke();

  // Header title
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8c382';
  ctx.font =
    'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('CHILL FLIGHT', 512, 92);

  ctx.fillStyle = '#ffffff';
  ctx.font =
    'bold 50px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(t('PAUSED'), 512, 152);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font =
    '21px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(t('Take a breather or adjust your flight'), 512, 192);

  // Button 0: Resume flight
  const isResumeHover = hovered === 0;
  ctx.fillStyle = isResumeHover ? '#ffffff' : '#e8c382';
  drawRoundRect(ctx, 162, 228, 700, 96, 22);
  ctx.fill();

  ctx.fillStyle = '#161616';
  ctx.font =
    'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(t('Resume flight'), 512, 282);

  ctx.fillStyle = 'rgba(22, 22, 22, 0.72)';
  ctx.font =
    '19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(t('Trigger or press A / Y'), 512, 310);

  // Button 1: Map (pop out to 2D map)
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
  ctx.font =
    'bold 35px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(t('Map'), 512, 398);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.font =
    '19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(t('Warp or set a waypoint in 2D'), 512, 426);

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
  ctx.font =
    'bold 35px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(t('Exit VR'), 512, 514);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font =
    '19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(t('Trigger or press B'), 512, 542);

  // Footer instructions
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font =
    '19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(t('Point controller & pull trigger to select'), 512, 606);

  ctx.restore();
  if (vrPauseTexture) vrPauseTexture.needsUpdate = true;
}

function initVRPauseMenu() {
  if (vrPauseMenu) return;

  ensureXRControllers();

  vrPauseCanvas = document.createElement('canvas');
  vrPauseCanvas.width = 1024;
  vrPauseCanvas.height = 680;

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

  const dotRingGeo = new THREE.CircleGeometry(0.022, 24);
  const dotRingMat = new THREE.MeshBasicMaterial({
    color: 0x161616,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    depthWrite: false,
  });
  const dotRing = new THREE.Mesh(dotRingGeo, dotRingMat);
  dotRing.renderOrder = 1001;

  const dotCoreGeo = new THREE.CircleGeometry(0.013, 24);
  const dotCoreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.98,
    depthTest: false,
    depthWrite: false,
  });
  const dotCore = new THREE.Mesh(dotCoreGeo, dotCoreMat);
  dotCore.renderOrder = 1002;

  vrLaserDot = new THREE.Group();
  vrLaserDot.name = 'vrLaserDot';
  vrLaserDot.add(dotRing);
  vrLaserDot.add(dotCore);
  vrLaserDot.visible = false;

  vrPauseMenu = new THREE.Group();
  vrPauseMenu.name = 'vrPauseMenu';
  vrPauseMenu.add(vrPauseMesh);
  vrPauseMenu.add(vrLaserDot);
  vrPauseMenu.visible = false;
  cameraDolly.add(vrPauseMenu);

  drawVRPauseMenu(-1);
}

export var openVRPauseMenu = function () {
  if (!vrPauseMenu) initVRPauseMenu();
  if (!vrPauseMenu) return;

  // Latch any buttons still held from pausing or flying so they must be
  // released before triggering a pause-menu action.
  _vrPauseLatch.arm(readCurrentVRControllers());

  // Position directly in front of the player's current head orientation
  vrPauseMenu.position.copy(camera.position);
  vrPauseMenu.quaternion.copy(camera.quaternion);
  vrPauseMenu.translateZ(-1.8);
  vrPauseMenu.visible = true;

  vrHoveredButton = -1;
  drawVRPauseMenu(-1);

  if (vrLaserDot) vrLaserDot.visible = false;
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
  vrPauseMenu.visible = false;
  if (vrLaserDot) vrLaserDot.visible = false;
  if (laser0) laser0.visible = false;
  if (laser1) laser1.visible = false;
  _vrPauseLatch.reset();
};

export var updateVRPauseInteraction = function () {
  if (!state.isPaused || !vrPauseMenu || !vrPauseMenu.visible || !vrPauseMesh) {
    return;
  }

  // Ensure controller and menu world matrices reflect this XR frame's pose
  // before raycasting (animate runs prior to renderer.render).
  cameraDolly.updateMatrixWorld(true);

  let hovered = -1;
  let dotUV = null;

  const pairs = [
    [xrController0, laser0],
    [xrController1, laser1],
  ];

  for (const [ctrl, laser] of pairs) {
    if (!ctrl || !ctrl.visible) {
      if (laser) setLaserLength(laser, LASER_DEFAULT_LENGTH);
      continue;
    }

    _vrRayMatrix.identity().extractRotation(ctrl.matrixWorld);
    vrRaycaster.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
    vrRaycaster.ray.direction.set(0, 0, -1).applyMatrix4(_vrRayMatrix);

    const hits = vrRaycaster.intersectObject(vrPauseMesh);
    if (hits.length > 0 && hits[0].uv) {
      const hit = hits[0];
      if (laser) setLaserLength(laser, hit.distance);
      const btnHit = hitTestVRPauseMenuUV(hit.uv.x, hit.uv.y);
      if (btnHit !== -1) {
        hovered = btnHit;
        dotUV = hit.uv;
        break;
      }
      if (!dotUV) {
        dotUV = hit.uv;
      }
    } else if (laser) {
      setLaserLength(laser, LASER_DEFAULT_LENGTH);
    }
  }

  if (vrLaserDot) {
    if (dotUV) {
      vrLaserDot.position.set(
        (dotUV.x - 0.5) * MENU_WIDTH,
        (dotUV.y - 0.5) * MENU_HEIGHT,
        0.001
      );
      vrLaserDot.visible = true;
    } else {
      vrLaserDot.visible = false;
    }
  }

  if (hovered !== vrHoveredButton) {
    vrHoveredButton = hovered;
    drawVRPauseMenu(vrHoveredButton);
    if (vrHoveredButton !== -1) {
      pulseXRControllers(0.2, 15);
    }
  }

  const action = _vrPauseLatch.poll(
    readCurrentVRControllers(),
    vrHoveredButton
  );
  if (action === 'resume') {
    togglePause();
  } else if (action === 'map') {
    openMapFromVR();
  } else if (action === 'exit') {
    endVRSession();
  }
};

if (vrBtn) {
  vrBtn.addEventListener('click', toggleVRSession);
}
if (splashVrBtn) {
  splashVrBtn.addEventListener('click', toggleVRSession);
}

if (renderer && renderer.xr) {
  renderer.xr.addEventListener('sessionstart', () => {
    state.returnToVROnMapClose = false;
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

    // Negotiate 72 or 90 Hz if supported
    const session = renderer.xr.getSession();
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
    if (splashVrBtn) splashVrBtn.textContent = t('Exit VR');

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
    // Detach camera from dolly and restore to standard world camera
    cameraDolly.remove(camera);
    scene.remove(cameraDolly);
    camera.position.copy(_idealCameraPos);
    camera.lookAt(_currentLookTarget);

    closeVRPauseMenu();

    if (vrBtnLabel) vrBtnLabel.textContent = 'VR';
    if (splashVrBtn) splashVrBtn.textContent = 'VR';
  });
}

hooks.enterVR = enterVRSession;
hooks.openVRPauseMenu = openVRPauseMenu;
hooks.closeVRPauseMenu = closeVRPauseMenu;
