// --- PROMO DIRECTOR: WINGMEN, CAMERA TRACKS & POSE REPLAY ---
// Coordinates multi-track promo choreography (`promo-script`, `promo-camera`,
// `promo-wingmen`, `promo-drive`, `promo-replay`, `promo-record`), spawns
// formation or spline wingmen with shadows and airshow smoke, and provides a
// lightweight 30 Hz pose recorder in debug/record mode so hand-flown skims,
// landings, and buggy drifts can be replayed deterministically.
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {
  attitudeAt,
  rawChannelAt,
  scriptedCamera,
  scriptedDrive,
  scriptedFlight,
  scriptedReplay,
} from './promo-script.js';
import {state} from './state.js';
import {BASE_FLIGHT_SPEED} from './constants.js';
import {log} from './logger.js';
import {scene} from './scene.js';
import {
  activePlaneType,
  planeGroup,
  poseGear,
  setActivePlane,
} from './airplane.js';
import {setGearExtension} from './twin.js';
import {
  PLANE_BUILDERS,
  buildPlaneModel,
  isLiveryMaterial,
  wingtipPoints,
} from './plane-models.js';
import {smokeColor, trailSmoke} from './particles.js';
import {newPropSpin, propSpinTarget, stepPropSpin} from './prop-spin-logic.js';

const DEG = Math.PI / 180;
const LOOP_SPEED_DIP = 0.15;
const NAV_LIGHT_SIZE = 0.012;

const wingmen = [];
let navMats = null;
const _box = new THREE.Box3();
const _offsetVec = new THREE.Vector3();
const _yawQuat = new THREE.Quaternion();
const _localQuat = new THREE.Quaternion();
const _localEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _yAxis = new THREE.Vector3(0, 1, 0);
const _rainbowSmoke = new THREE.Color();

// Pose recorder state (only used when ?debug=1 or ?record=1)
let isRecording = false;
let recordStartMs = 0;
let recordSampleAccum = 0;
let recordedFrames = [];
let recordMeta = null;
let recordBtn = null;

function ensureNavMats() {
  if (navMats || typeof document === 'undefined') return navMats;
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const map = new THREE.CanvasTexture(canvas);
  const make = (color) =>
    new THREE.SpriteMaterial({
      map,
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: false,
      opacity: 0,
    });
  navMats = {
    red: make(0xff3030),
    green: make(0x30ff60),
    strobe: make(0xffffff),
  };
  return navMats;
}

function addNavSprite(group, mat, x, y, z) {
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(NAV_LIGHT_SIZE, NAV_LIGHT_SIZE, 1);
  sprite.position.set(x, y, z);
  sprite.renderOrder = 3;
  group.add(sprite);
  return sprite;
}

function resolveLiveryIndex(livery, fallbackIndex) {
  const count = ChillFlightLogic.PLANE_COLORS.length;
  if (typeof livery === 'number' && Number.isFinite(livery)) {
    return ((Math.floor(livery) % count) + count) % count;
  }
  if (typeof livery === 'string' && livery.trim() !== '') {
    const clean = livery.trim().toLowerCase();
    if (/^\d+$/.test(clean)) {
      return ((parseInt(clean, 10) % count) + count) % count;
    }
    const idx = ChillFlightLogic.LIVERY_NAMES.indexOf(clean);
    if (idx >= 0) return idx;
  }
  return ((fallbackIndex % count) + count) % count;
}

function resolveWingmanSmoke(smokeSpec, liveryHex) {
  if (smokeSpec === false || smokeSpec === 'none' || smokeSpec === 'off') {
    return {mode: 'off', color: null};
  }
  if (smokeSpec === 'rainbow') {
    return {mode: 'rainbow', color: new THREE.Color()};
  }
  if (smokeSpec === 'white') {
    return {mode: 'solid', color: smokeColor(null)};
  }
  if (typeof smokeSpec === 'number') {
    return {mode: 'solid', color: new THREE.Color(smokeSpec)};
  }
  if (typeof smokeSpec === 'string' && smokeSpec.startsWith('#')) {
    return {mode: 'solid', color: new THREE.Color(smokeSpec)};
  }
  return {mode: 'solid', color: smokeColor(liveryHex)};
}

function disposeWingman(w) {
  scene.remove(w.group);
  const shared = navMats ? new Set(Object.values(navMats)) : null;
  w.group.traverse((child) => {
    if (!child.isSprite && child.geometry) child.geometry.dispose();
    if (
      child.material &&
      (!shared || !shared.has(child.material)) &&
      !isLiveryMaterial(child.material)
    ) {
      child.material.dispose();
    }
  });
}

export function clearPromoWingmen() {
  for (const w of wingmen) disposeWingman(w);
  wingmen.length = 0;
}

export function getPromoWingmenCount() {
  return wingmen.length;
}

function updateSingleWingmanPose(w, delta, nowTime) {
  const t = (nowTime - w.startMs) / 1000;
  if (w.isFormation) {
    let ox = w.offset[0] ?? 0;
    let oy = w.offset[1] ?? 0;
    let oz = w.offset[2] ?? 0;
    let dRoll = 0;
    let dPitch = 0;
    let dYaw = 0;
    if (w.offsetMoves) {
      const kx = rawChannelAt(w.offsetMoves, t, 1, null);
      const ky = rawChannelAt(w.offsetMoves, t, 2, null);
      const kz = rawChannelAt(w.offsetMoves, t, 3, null);
      const kr = rawChannelAt(w.offsetMoves, t, 4, null);
      const kp = rawChannelAt(w.offsetMoves, t, 5, null);
      const kyaw = rawChannelAt(w.offsetMoves, t, 6, null);
      if (kx !== null) ox = kx;
      if (ky !== null) oy = ky;
      if (kz !== null) oz = kz;
      if (kr !== null) dRoll = kr * DEG;
      if (kp !== null) dPitch = kp * DEG;
      if (kyaw !== null) dYaw = kyaw * DEG;
    }
    _offsetVec.set(ox, oy, oz);
    if (w.frame === 'yaw') {
      _yawQuat.setFromAxisAngle(_yAxis, planeGroup.rotation.y);
      _offsetVec.applyQuaternion(_yawQuat).add(planeGroup.position);
      w.group.position.copy(_offsetVec);
      w.group.rotation.set(dPitch, planeGroup.rotation.y + dYaw, dRoll, 'YXZ');
    } else {
      planeGroup.updateMatrixWorld();
      w.group.position.copy(_offsetVec).applyMatrix4(planeGroup.matrixWorld);
      _localEuler.set(dPitch, dYaw, dRoll, 'YXZ');
      _localQuat.setFromEuler(_localEuler);
      w.group.quaternion.copy(planeGroup.quaternion).multiply(_localQuat);
    }
    w.currentSpeed = Math.max(0.2, Math.abs(state.flightSpeedMultiplier || 1));
    return;
  }

  // Independent spline wingman: level preroll before startMs, attitude spline after
  if (t <= 0) {
    w.group.rotation.set(0, w.baseYaw, 0, 'YXZ');
    w.currentSpeed = w.baseSpeed;
    if (delta > 0) {
      const stepDist = w.baseSpeed * BASE_FLIGHT_SPEED * delta * 60;
      w.group.position.x += -Math.sin(w.baseYaw) * stepDist;
      w.group.position.z += -Math.cos(w.baseYaw) * stepDist;
    }
  } else {
    const att = attitudeAt(w.moves, t, {direct: w.direct});
    const yaw = w.baseYaw + att.yaw;
    const pitch = att.pitch;
    const mult = att.speed ?? w.baseSpeed;
    const effMult = w.loopDip
      ? mult * (1 - (LOOP_SPEED_DIP * (1 - Math.cos(pitch))) / 2)
      : mult;
    w.group.rotation.set(pitch, yaw, att.roll, 'YXZ');
    w.currentSpeed = effMult;
    if (delta > 0) {
      const stepDist = effMult * BASE_FLIGHT_SPEED * delta * 60;
      w.group.position.x += -Math.sin(yaw) * Math.cos(pitch) * stepDist;
      w.group.position.y += Math.sin(pitch) * stepDist;
      w.group.position.z += -Math.cos(yaw) * Math.cos(pitch) * stepDist;
    }
  }
}

export function spawnPromoWingmen(specs, startMs = performance.now()) {
  clearPromoWingmen();
  if (!Array.isArray(specs) || specs.length === 0) return;

  const playerLivery = Math.max(
    0,
    ChillFlightLogic.PLANE_COLORS.indexOf(state.planeColor)
  );
  const mats = ensureNavMats();

  specs.forEach((spec, index) => {
    if (!spec) return;
    const requestedType = spec.plane || spec.type;
    const rawType = ChillFlightLogic.PLANE_TYPES.includes(requestedType)
      ? requestedType
      : requestedType && PLANE_BUILDERS[requestedType]
        ? requestedType
        : activePlaneType && PLANE_BUILDERS[activePlaneType]
          ? activePlaneType
          : 'biplane';
    const livery = resolveLiveryIndex(spec.livery, playerLivery + index + 1);
    const liveryHex = ChillFlightLogic.PLANE_COLORS[livery];

    const group = new THREE.Group();
    group.rotation.order = 'YXZ';
    const model = buildPlaneModel(rawType, livery);
    if (model.gearGroups && spec.gear !== undefined) {
      setGearExtension(
        model.gearGroups,
        typeof spec.gear === 'number' ? spec.gear : spec.gear ? 1 : 0
      );
    }
    group.add(model);

    let strobe = null;
    if (mats && rawType !== 'buggy') {
      const [left, right] = wingtipPoints(model);
      addNavSprite(group, mats.red, left.x, left.y, left.z);
      addNavSprite(group, mats.green, right.x, right.y, right.z);
      _box.setFromObject(model);
      strobe = addNavSprite(group, mats.strobe, 0, _box.max.y, _box.max.z);
    }

    const isFormation =
      spec.x === undefined &&
      (Array.isArray(spec.offset) || Array.isArray(spec.offsetMoves));

    const w = {
      group,
      model,
      type: rawType,
      props: model.propGroups || (model.propGroup ? [model.propGroup] : []),
      propSpin: newPropSpin(index * 1.1),
      spinScale: rawType === 'biplane' ? 1.2 : 1,
      strobe,
      strobePeriod: 1.05 + (index % 3) * 0.14,
      strobePhase: index * 0.47,
      smoke: resolveWingmanSmoke(spec.smoke, liveryHex),
      smokeLast: Object.assign(new THREE.Vector3(), {valid: false}),
      startMs,
      isFormation,
      frame: spec.frame === 'yaw' ? 'yaw' : 'plane',
      offset: Array.isArray(spec.offset) ? spec.offset : [0, 0, 0],
      offsetMoves: Array.isArray(spec.offsetMoves) ? spec.offsetMoves : null,
      baseYaw: (spec.heading ?? 0) * DEG,
      baseSpeed: spec.speed ?? state.flightSpeedMultiplier ?? 1,
      currentSpeed: spec.speed ?? state.flightSpeedMultiplier ?? 1,
      moves:
        Array.isArray(spec.moves) && spec.moves.length > 0
          ? spec.moves
          : [[0, 0, 0, 0]],
      loopDip: Boolean(spec.loopDip),
      direct: spec.direct !== false,
    };

    if (!isFormation) {
      group.position.set(
        spec.x ?? planeGroup.position.x,
        spec.y ?? planeGroup.position.y,
        spec.z ?? planeGroup.position.z
      );
      group.rotation.set(0, w.baseYaw, 0, 'YXZ');
    } else {
      updateSingleWingmanPose(w, 0, startMs);
    }
    w.propSpin.spin = propSpinTarget(
      w.currentSpeed,
      w.currentSpeed,
      w.spinScale
    );
    scene.add(group);
    wingmen.push(w);
  });
}

function formatLocationReport(x, z) {
  const lon = (Math.abs(x) / 5000).toFixed(2);
  const lat = (Math.abs(z) / 5000).toFixed(2);
  const ew = x >= 0 ? 'East' : 'West';
  const ns = z <= 0 ? 'North' : 'South';
  return `X = ${Math.round(x)}, Z = ${Math.round(z)} (${lon} ${ew}, ${lat} ${ns})`;
}

function updateRecordButtonLabel() {
  if (!recordBtn) return;
  recordBtn.textContent = isRecording
    ? `Stop rec (${recordedFrames.length}f)`
    : state.lastRecordedReplay
      ? `Record take (${state.lastRecordedReplay.frames.length}f saved)`
      : 'Record take (Shift+R)';
  recordBtn.style.background = isRecording
    ? 'rgba(220, 38, 38, 0.85)'
    : 'rgba(255, 255, 255, 0.14)';
}

function captureReplaySample(nowTime) {
  const t = Number(((nowTime - recordStartMs) / 1000).toFixed(4));
  const flags = (state.isOnWater ? 1 : 0) | (state.isOnGround ? 2 : 0);
  recordedFrames.push([
    t,
    Number(planeGroup.position.x.toFixed(2)),
    Number(planeGroup.position.y.toFixed(2)),
    Number(planeGroup.position.z.toFixed(2)),
    Number(planeGroup.rotation.x.toFixed(4)),
    Number(planeGroup.rotation.y.toFixed(4)),
    Number(planeGroup.rotation.z.toFixed(4)),
    Number((state.flightSpeedMultiplier || 0).toFixed(3)),
    flags,
    Number((state.buggySlide || 0).toFixed(3)),
    Number((state.buggySlip || 0).toFixed(4)),
    Number((state.gearExtension || 0).toFixed(3)),
  ]);
}

export function startPromoRecording(nowTime = performance.now()) {
  isRecording = true;
  recordStartMs = nowTime;
  recordSampleAccum = 0;
  recordedFrames = [];
  recordMeta = {
    fps: 30,
    seed: ChillFlightLogic.WORLD_SEED,
    plane: activePlaneType,
    tod: Number(state.timeOfDay.toFixed(4)),
    startX: Math.round(planeGroup.position.x),
    startY: Math.round(planeGroup.position.y),
    startZ: Math.round(planeGroup.position.z),
  };
  captureReplaySample(nowTime);
  updateRecordButtonLabel();
  log.info(
    `[Promo recorder] Started recording ${activePlaneType} at ${formatLocationReport(planeGroup.position.x, planeGroup.position.z)}`
  );
}

export function stopPromoRecording() {
  if (!isRecording) return state.lastRecordedReplay;
  isRecording = false;
  const replay = {
    ...recordMeta,
    durationSec:
      recordedFrames.length > 0
        ? recordedFrames[recordedFrames.length - 1][0]
        : 0,
    frames: recordedFrames,
  };
  state.lastRecordedReplay = replay;
  updateRecordButtonLabel();
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(JSON.stringify(replay)).catch(() => {});
  }
  log.info(
    `[Promo recorder] Saved ${replay.frames.length} frames (${replay.durationSec.toFixed(2)}s) starting at ${formatLocationReport(replay.startX, replay.startZ)}`
  );
  return replay;
}

export function applyPromoReplay(nowTime) {
  if (!state.scriptedReplay) return false;
  const pose = state.scriptedReplay(nowTime);
  if (!pose) return false;
  planeGroup.position.set(pose.x, pose.y, pose.z);
  planeGroup.rotation.set(pose.rx, pose.ry, pose.rz, 'YXZ');
  state._nextYaw = pose.ry;
  state.flightSpeedMultiplier = pose.speed;
  state.targetFlightSpeed = pose.speed;
  state.isOnWater = pose.isOnWater;
  state.isOnGround = pose.isOnGround;
  state.buggySlide = pose.slide;
  state.buggySlip = pose.slip;
  state.gearWanted = pose.gear > 0.5;
  state.gearExtension = pose.gear;
  poseGear(pose.gear);
  if (state.airplaneModel) {
    state.airplaneModel.position.set(0, 0, 0);
    state.airplaneModel.rotation.set(0, 0, 0);
  }
  return true;
}

export function updatePromoDirector(delta, nowTime) {
  if (wingmen.length > 0) {
    const mats = ensureNavMats();
    if (mats) {
      const night = 1 - THREE.MathUtils.smoothstep(state.dayFactor, 0.3, 0.8);
      mats.red.opacity = mats.green.opacity = mats.strobe.opacity = night;
      mats.red.visible = mats.green.visible = night > 0.001;
    }
    const sec = nowTime / 1000;
    for (let i = 0; i < wingmen.length; i++) {
      const w = wingmen[i];
      updateSingleWingmanPose(w, delta, nowTime);
      w.group.updateMatrixWorld(true);

      if (w.props.length > 0) {
        const target = propSpinTarget(
          w.currentSpeed,
          w.currentSpeed,
          w.spinScale
        );
        stepPropSpin(w.propSpin, target, delta);
        for (const prop of w.props) {
          prop.rotation.z = w.propSpin.angle;
        }
      }

      if (w.strobe && mats) {
        const nightVisible = mats.red.visible;
        const phase = (sec + w.strobePhase) % w.strobePeriod;
        w.strobe.visible = nightVisible && phase < 0.08;
      }

      if (w.smoke.mode !== 'off' && delta > 0) {
        let color = w.smoke.color;
        if (w.smoke.mode === 'rainbow') {
          const hue = (((sec * 0.35 + i * 0.2) % 1) + 1) % 1;
          color = _rainbowSmoke.setHSL(hue, 0.85, 0.65);
        }
        trailSmoke(w.group, w.smokeLast, w.currentSpeed, color);
      }
    }
  }

  if (isRecording && delta > 0) {
    recordSampleAccum += delta;
    if (recordSampleAccum >= 1 / 30 - 1e-4) {
      recordSampleAccum %= 1 / 30;
      captureReplaySample(nowTime);
      updateRecordButtonLabel();
    }
  }
}

export function configurePromoDirector(detail, nowTime = performance.now()) {
  if (!detail) {
    state.scriptedFlight = null;
    state.scriptedCamera = null;
    state.scriptedDrive = null;
    state.scriptedReplay = null;
    state.scriptedSpeed = null;
    clearPromoWingmen();
    return null;
  }

  if (Array.isArray(detail)) {
    state.scriptedSpeed = null;
    const fn = scriptedFlight(detail, nowTime);
    state.scriptedFlight = fn;
    return fn;
  }

  const startMs = nowTime + (detail.startOffsetMs ?? 0);

  if (
    detail.camFrame &&
    ChillFlightLogic.CAM_FRAMES.includes(detail.camFrame)
  ) {
    state.camFrame = detail.camFrame;
    state.cameraMode = 'cinematic';
  }
  if (detail.camMoves !== undefined) {
    if (detail.camMoves) state.cameraMode = 'cinematic';
    state.scriptedCamera = detail.camMoves
      ? scriptedCamera(detail.camMoves, startMs)
      : null;
  }
  if (detail.driveMoves !== undefined) {
    state.scriptedDrive = detail.driveMoves
      ? scriptedDrive(detail.driveMoves, startMs)
      : null;
  }
  if (detail.replay !== undefined) {
    if (
      detail.replay?.plane &&
      detail.replay.plane !== activePlaneType &&
      ChillFlightLogic.PLANE_TYPES.includes(detail.replay.plane)
    ) {
      setActivePlane(detail.replay.plane, true);
    }
    state.scriptedReplay = detail.replay
      ? scriptedReplay(detail.replay, startMs)
      : null;
  }
  if (detail.wingmen !== undefined) {
    if (detail.wingmen) spawnPromoWingmen(detail.wingmen, startMs);
    else clearPromoWingmen();
  }

  if (detail.moves) {
    const fn = scriptedFlight(
      {
        moves: detail.moves,
        direct: detail.direct,
        surface: detail.surface,
      },
      startMs
    );
    state.scriptedFlight = fn;
    return fn;
  }
  return state.scriptedFlight;
}

if (typeof window !== 'undefined') {
  window.addEventListener('promo-camera', (event) => {
    const d = event.detail;
    if (!d) {
      state.scriptedCamera = null;
      return;
    }
    const camMoves = Array.isArray(d) ? d : d.camMoves;
    const startMs =
      performance.now() + (Array.isArray(d) ? 0 : (d.startOffsetMs ?? 0));
    if (
      !Array.isArray(d) &&
      d.camFrame &&
      ChillFlightLogic.CAM_FRAMES.includes(d.camFrame)
    ) {
      state.camFrame = d.camFrame;
    }
    state.cameraMode = 'cinematic';
    state.scriptedCamera = camMoves ? scriptedCamera(camMoves, startMs) : null;
  });

  window.addEventListener('promo-wingmen', (event) => {
    const d = event.detail;
    if (!d) {
      clearPromoWingmen();
      return;
    }
    const specs = Array.isArray(d) ? d : d.wingmen;
    const startMs =
      performance.now() + (Array.isArray(d) ? 0 : (d.startOffsetMs ?? 0));
    spawnPromoWingmen(specs, startMs);
  });

  window.addEventListener('promo-drive', (event) => {
    const d = event.detail;
    if (!d) {
      state.scriptedDrive = null;
      return;
    }
    const moves = Array.isArray(d) ? d : d.driveMoves;
    const startMs =
      performance.now() + (Array.isArray(d) ? 0 : (d.startOffsetMs ?? 0));
    state.scriptedDrive = moves ? scriptedDrive(moves, startMs) : null;
  });

  window.addEventListener('promo-replay', (event) => {
    const d = event.detail;
    if (!d) {
      state.scriptedReplay = null;
      return;
    }
    const replay = Array.isArray(d) || d.frames ? d : d.replay;
    const startMs = performance.now() + (d.startOffsetMs ?? 0);
    if (
      replay?.plane &&
      replay.plane !== activePlaneType &&
      ChillFlightLogic.PLANE_TYPES.includes(replay.plane)
    ) {
      setActivePlane(replay.plane, true);
    }
    state.scriptedReplay = replay ? scriptedReplay(replay, startMs) : null;
  });

  window.addEventListener('promo-record', (event) => {
    const action = event.detail || 'toggle';
    if (action === 'start') startPromoRecording();
    else if (action === 'stop') stopPromoRecording();
    else if (action === 'play' && state.lastRecordedReplay) {
      state.scriptedReplay = scriptedReplay(
        state.lastRecordedReplay,
        performance.now()
      );
    } else if (action === 'toggle') {
      if (isRecording) stopPromoRecording();
      else startPromoRecording();
    }
  });

  if (ChillFlightLogic.START_DEBUG || ChillFlightLogic.START_RECORD) {
    const mountDebugRecorderUi = () => {
      const menu = document.getElementById('debug-menu');
      if (menu && !document.getElementById('debug-record-replay')) {
        const row = document.createElement('div');
        row.setAttribute('data-no-translate', '');
        row.style.cssText = 'display:flex;gap:6px;margin-top:6px;';

        recordBtn = document.createElement('button');
        recordBtn.id = 'debug-record-replay';
        recordBtn.type = 'button';
        recordBtn.setAttribute('data-no-translate', '');
        recordBtn.style.cssText =
          'flex:1;padding:5px 8px;border:1px solid rgba(255,255,255,0.25);border-radius:6px;color:#fff;font-size:11px;cursor:pointer;';
        recordBtn.addEventListener('click', () => {
          if (isRecording) stopPromoRecording();
          else startPromoRecording();
        });

        const playBtn = document.createElement('button');
        playBtn.id = 'debug-play-replay';
        playBtn.type = 'button';
        playBtn.textContent = 'Replay';
        playBtn.setAttribute('data-no-translate', '');
        playBtn.style.cssText =
          'padding:5px 8px;border:1px solid rgba(255,255,255,0.25);border-radius:6px;background:rgba(255,255,255,0.14);color:#fff;font-size:11px;cursor:pointer;';
        playBtn.addEventListener('click', () => {
          if (isRecording) stopPromoRecording();
          if (state.lastRecordedReplay) {
            state.scriptedReplay = scriptedReplay(
              state.lastRecordedReplay,
              performance.now()
            );
          }
        });

        row.append(recordBtn, playBtn);
        menu.appendChild(row);
        updateRecordButtonLabel();
      }
      if (ChillFlightLogic.START_RECORD === true && !isRecording) {
        startPromoRecording();
      }
    };

    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', mountDebugRecorderUi, {
        once: true,
      });
    } else {
      mountDebugRecorderUi();
    }

    window.addEventListener('keydown', (e) => {
      if (
        e.shiftKey &&
        e.code === 'KeyR' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        document.activeElement?.tagName !== 'INPUT'
      ) {
        e.preventDefault();
        if (isRecording) stopPromoRecording();
        else startPromoRecording();
      }
    });
  }
}
