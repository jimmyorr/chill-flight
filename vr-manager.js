async function toggleVRSession() {
  if (typeof renderer === 'undefined' || !renderer || !renderer.xr) return;
  const currentSession = renderer.xr.getSession();
  if (!currentSession) {
    try {
      const sessionInit = {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
      };
      const session = await navigator.xr.requestSession(
        'immersive-vr',
        sessionInit
      );
      await renderer.xr.setSession(session);
    } catch (err) {
      console.warn('Failed to start WebXR session:', err);
    }
  } else {
    await currentSession.end();
  }
}

if (vrBtn) {
  vrBtn.addEventListener('click', toggleVRSession);
}
if (splashVrBtn) {
  splashVrBtn.addEventListener('click', toggleVRSession);
}

if (typeof renderer !== 'undefined' && renderer && renderer.xr) {
  renderer.xr.addEventListener('sessionstart', () => {
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

    if (vrBtnLabel) vrBtnLabel.textContent = 'Exit VR';
    if (splashVrBtn) splashVrBtn.textContent = 'Exit VR';

    // If still at loading screen, dismiss and begin flight immediately
    const loadingEl = document.getElementById('loading-overlay');
    if (
      loadingEl &&
      loadingEl.style.display !== 'none' &&
      typeof dismissLoadingScreen === 'function'
    ) {
      dismissLoadingScreen(true);
    } else if (isPaused) {
      isPaused = false;
      const pauseOverlayEl = document.getElementById('pause-overlay');
      if (pauseOverlayEl) pauseOverlayEl.style.display = 'none';
      if (typeof clearInputState === 'function') clearInputState();
    }
  });

  renderer.xr.addEventListener('sessionend', () => {
    // Detach camera from dolly and restore to standard world camera
    cameraDolly.remove(camera);
    scene.remove(cameraDolly);
    camera.position.copy(_idealCameraPos);
    camera.lookAt(_currentLookTarget);

    if (typeof closeVRPauseMenu === 'function') {
      closeVRPauseMenu();
    }

    if (vrBtnLabel) vrBtnLabel.textContent = 'VR';
    if (splashVrBtn) splashVrBtn.textContent = 'VR';
  });
}

// --- 3D VR PAUSE MENU & INTERACTION ---
var vrPauseMenu;
var vrPauseMesh;
var vrPauseCanvas;
var vrPauseTexture;
var vrHoveredButton = -1;
var xrController0;
var xrController1;
var laser0;
var laser1;
var _vrButton0Pressed = false;
var _vrButton1Pressed = false;
const vrRaycaster = new THREE.Raycaster();
const _vrRayMatrix = new THREE.Matrix4();

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

  // Header Title
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8c382';
  ctx.font =
    'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('CHILL FLIGHT', 512, 105);

  ctx.fillStyle = '#ffffff';
  ctx.font =
    'bold 54px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('PAUSED', 512, 175);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font =
    '22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Take a breather or adjust your flight', 512, 220);

  // Button 1: Resume
  const isResumeHover = hovered === 0;
  ctx.fillStyle = isResumeHover ? '#ffffff' : '#e8c382';
  drawRoundRect(ctx, 162, 270, 700, 110, 24);
  ctx.fill();

  ctx.fillStyle = '#161616';
  ctx.font =
    'bold 40px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Resume flight', 512, 335);

  ctx.fillStyle = 'rgba(22, 22, 22, 0.7)';
  ctx.font =
    '20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Trigger or Press A / Menu', 512, 365);

  // Button 2: Exit VR
  const isExitHover = hovered === 1;
  ctx.fillStyle = isExitHover
    ? 'rgba(235, 75, 75, 0.9)'
    : 'rgba(255, 255, 255, 0.08)';
  ctx.strokeStyle = isExitHover ? '#ff7777' : 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 162, 420, 700, 110, 24);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font =
    'bold 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Exit VR', 512, 485);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font =
    '20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Trigger or Press B / X', 512, 515);

  // Footer instructions
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font =
    '20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Point controller & pull trigger to select', 512, 595);

  ctx.restore();
  if (vrPauseTexture) vrPauseTexture.needsUpdate = true;
}

function buildLaserPointer() {
  const geom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -3),
  ]);
  const mat = new THREE.LineBasicMaterial({
    color: 0xe8c382,
    transparent: true,
    opacity: 0.6,
  });
  const line = new THREE.Line(geom, mat);
  line.name = 'laserPointer';
  line.visible = false;
  return line;
}

function initVRPauseMenu() {
  if (vrPauseMenu) return;

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

  const geo = new THREE.PlaneGeometry(1.6, 1.0625);
  vrPauseMesh = new THREE.Mesh(geo, mat);
  vrPauseMesh.renderOrder = 999;

  vrPauseMenu = new THREE.Group();
  vrPauseMenu.name = 'vrPauseMenu';
  vrPauseMenu.add(vrPauseMesh);
  vrPauseMenu.visible = false;
  cameraDolly.add(vrPauseMenu);

  if (typeof renderer !== 'undefined' && renderer && renderer.xr) {
    xrController0 = renderer.xr.getController(0);
    xrController1 = renderer.xr.getController(1);

    laser0 = buildLaserPointer();
    xrController0.add(laser0);

    laser1 = buildLaserPointer();
    xrController1.add(laser1);

    cameraDolly.add(xrController0);
    cameraDolly.add(xrController1);

    const onXRSelect = () => {
      if (!isPaused || !checkVRPresenting()) return;
      if (vrHoveredButton === 0) {
        togglePause();
      } else if (vrHoveredButton === 1) {
        toggleVRSession();
      }
    };

    xrController0.addEventListener('select', onXRSelect);
    xrController1.addEventListener('select', onXRSelect);
  }

  drawVRPauseMenu(-1);
}

var openVRPauseMenu = function () {
  if (!vrPauseMenu) initVRPauseMenu();
  if (!vrPauseMenu) return;

  // Position directly in front of the player's current head orientation
  vrPauseMenu.position.copy(camera.position);
  vrPauseMenu.quaternion.copy(camera.quaternion);
  vrPauseMenu.translateZ(-1.8);
  vrPauseMenu.visible = true;

  vrHoveredButton = -1;
  drawVRPauseMenu(-1);

  if (laser0) laser0.visible = true;
  if (laser1) laser1.visible = true;
};

var closeVRPauseMenu = function () {
  if (!vrPauseMenu) return;
  vrPauseMenu.visible = false;
  if (laser0) laser0.visible = false;
  if (laser1) laser1.visible = false;
};

var updateVRPauseInteraction = function () {
  if (!isPaused || !vrPauseMenu || !vrPauseMenu.visible || !vrPauseMesh) return;

  let hovered = -1;
  const controllers = [xrController0, xrController1].filter(Boolean);
  for (const ctrl of controllers) {
    if (!ctrl.visible) continue;
    _vrRayMatrix.identity().extractRotation(ctrl.matrixWorld);
    vrRaycaster.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
    vrRaycaster.ray.direction.set(0, 0, -1).applyMatrix4(_vrRayMatrix);

    const hits = vrRaycaster.intersectObject(vrPauseMesh);
    if (hits.length > 0 && hits[0].uv) {
      const uv = hits[0].uv;
      const cy = (1.0 - uv.y) * 680;
      const cx = uv.x * 1024;
      if (cx >= 160 && cx <= 864) {
        if (cy >= 270 && cy <= 380) {
          hovered = 0; // Resume
          break;
        } else if (cy >= 420 && cy <= 530) {
          hovered = 1; // Exit VR
          break;
        }
      }
    }
  }

  if (hovered !== vrHoveredButton) {
    vrHoveredButton = hovered;
    drawVRPauseMenu(vrHoveredButton);
  }

  // Poll gamepad buttons for instant physical presses
  if (typeof navigator !== 'undefined' && navigator.getGamepads) {
    const gamepads = navigator.getGamepads();
    const gps = [];
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i] && gamepads[i].connected) gps.push(gamepads[i]);
    }
    const session =
      renderer && renderer.xr && renderer.xr.getSession
        ? renderer.xr.getSession()
        : null;
    if (session && session.inputSources) {
      for (const src of session.inputSources) {
        if (src.gamepad && src.gamepad.connected) gps.push(src.gamepad);
      }
    }
    for (const gp of gps) {
      // Button 0 (Trigger) or Button 4 (Quest A/X): Resume (or activate hovered button)
      if (gp.buttons[0]?.pressed || gp.buttons[4]?.pressed) {
        if (!_vrButton0Pressed) {
          _vrButton0Pressed = true;
          if (vrHoveredButton === 1) {
            toggleVRSession();
          } else {
            togglePause();
          }
          return;
        }
      } else {
        _vrButton0Pressed = false;
      }

      // Button 5 (Quest B/Y) or Button 1 (Gamepad B): Exit VR
      if (gp.buttons[5]?.pressed || gp.buttons[1]?.pressed) {
        if (!_vrButton1Pressed) {
          _vrButton1Pressed = true;
          toggleVRSession();
          return;
        }
      } else {
        _vrButton1Pressed = false;
      }
    }
  }
};
