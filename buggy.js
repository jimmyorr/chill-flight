// --- BUGGY DRIVING ---
// The buggy takes the place of the flight model and flight physics
// (game-loop.js) while it's the active vehicle. Arcade handling: the engine
// pulls hard and tails off toward top speed, the steering is responsive on
// highway curves and opens out at speed, tyres grip firmly in ordinary
// turns, and suspension is critically damped for a smooth, stable ride over
// rolling hills. Holding a hard turn at speed leans in and drifts. Driving
// up inclines or over crests at high speed reliably catches air in a natural
// ballistic flight, and the stick turns it in the air to line up a landing. It drives on the ground as drawn
// (sampleGround), the highway deck and bridges (sampleRoad with 3D elevation awareness),
// and over water it turns into a hovercraft, wheels folded flat, and carries
// on at speed.
//
// Controls: one-handed joystick control. The throttle slider sets target cruise
// speed. The virtual joystick steers left/right. Pushing up temporarily boosts
// up to top speed. Pulling down smoothly brakes to a stop, and continuing to
// hold down shifts into reverse. Releasing the stick smoothly resumes cruising
// forward at the set speed.
//
// Double-tap moves, like the planes': double-tap up to hop (hold on to float
// higher and steer in the air), double-tap left or right and hold to power
// slide, double-tap down and hold to brake hard. On touch, double-tap the
// screen's top, left, right or bottom third, as for the planes.
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {getElevation, sampleGround} from './terrain-geometry.js';
import {sampleRoad} from './terrain-chunks.js';
import {planeGroup} from './airplane.js';
import {
  BUGGY_AXLES,
  BUGGY_WHEEL_RADIUS,
  BUGGY_WHEELBASE,
  setBuggyHoverFold,
} from './buggy-model.js';
import {BASE_FLIGHT_SPEED, PLANE_HANDLING, WATER_LEVEL} from './constants.js';
import {state} from './state.js';
import {doubleTap, keys} from './game-input-bindings.js';
import {setOnWheels} from './flight-physics.js';

// Speeds in units per second, which read as knots; accelerations in units
// per second squared
const KTS_PER_MULT = BASE_FLIGHT_SPEED * 60;
const TOP_SPEED = PLANE_HANDLING.buggy.topKts;
// The engine, brakes, drag, steering limits, hovering and vertical air
// physics live in ChillFlightLogic (BUGGY_DRIVE, BUGGY_HOVER, BUGGY_AIR,
// buggyDriveAccel, buggyDrag, buggySteerLimit, stepBuggyHoverFold,
// stepBuggyVertical)
const {MAX_STEER} = ChillFlightLogic.BUGGY_DRIVE;
const {GRAVITY} = ChillFlightLogic.BUGGY_AIR;
// Ground steeper than this (rise per unit) is a wall it bumps against
const WALL_SLOPE = Math.tan((50 * Math.PI) / 180);
// It stays parked on slopes gentler than this pull (units/s²)
const PARK_HOLD = 9;
// Roads: a deck up to this far above the wheels is a kerb it smoothly mounts
// (allowing the buggy to easily climb back onto the highway from off-road);
// a higher deck is a bridge it drives under
const ROAD_STEP_UP = 12;
// How far the buggy's origin sits below the water's surface as it hovers,
// so the folded wheels skim it
const FLOAT_DEPTH = 0.3;
// A jump of more than this between frames is a teleport (units)
const TELEPORT_DISTANCE = 300;
// Flying into ground that rises more than this above it (a bank or a
// hillside ahead), it bounces off rather than climbing straight up it
const AIR_WALL_STEP = 4;
// Switched to in the air higher than this above the ground, it falls
const DROP_HEIGHT = 2;
// The fastest it can be falling as it's dropped (units/s), as in the air
const MAX_FALL_SPEED = 400;

// The springs: critically damped body bounce on its wheels (c = 2*sqrt(k))
// to eliminate irritating oscillations and pogo-stick bouncing
const SPRING = 80;
const DAMPING = 18;
const SQUAT_PER_ACCEL = 0.0025;
const LEAN_PER_ACCEL = 0.0024;
const MAX_LEAN = 0.1;
const LEAN_EASE_SECONDS = 0.18;
// How quickly the chassis tilts to the slope under it
const TILT_EASE_SECONDS = 0.12;
const AIR_TILT_EASE_SECONDS = 0.4;

const _surface = {
  height: 0,
  slopeX: 0,
  slopeZ: 0,
  kind: 'ground',
  // On a raised bridge, its railings: which side of the centre line it's
  // on and the way across the road (sampleRoadSegment)
  rails: false,
  across: 0,
  normalX: 0,
  normalZ: 0,
};
const _road = {
  height: 0,
  slopeX: 0,
  slopeZ: 0,
  rails: false,
  across: 0,
  normalX: 0,
  normalZ: 0,
};
const _ground = {height: 0, slopeX: 0, slopeZ: 0};
const _railCar = {x: 0, z: 0, y: 0, velX: 0, velZ: 0};
const _wheelHeights = [0, 0, 0, 0];
const _contact = {height: 0, along: 0, across: 0, touch: 0};
const _lastPos = new THREE.Vector3();
const _heading = new THREE.Vector3();
let lastModel = null;
// Horizontal velocity (world x and z) and vertical speed
let velX = 0;
let velZ = 0;
let velY = 0;
let yaw = 0;
let yawRate = 0;
let steer = 0;
let airborne = false;
// The body on its springs, and the chassis's tilt
let bounce = 0;
let bounceVel = 0;
let squat = 0;
let lean = 0;
let tiltPitch = 0;
let tiltRoll = 0;
// The wheels folded flat for hovering: 0 down, 1 flat
let hoverFold = 0;
// The handling's own state (lean: leaning into a hard turn, 0 to 1), and
// how far it's sliding (radians)
const car = {
  velX: 0,
  velZ: 0,
  yaw: 0,
  yawRate: 0,
  steer: 0,
  lean: 0,
  slide: 0,
};
let slip = 0;
// Hopping (double-tap up): in the air from a hop, the double-tap seen
// last frame (a hop fires once per double-tap), and how much longer holding
// up keeps it light on the way up (seconds)
let hopping = false;
let hopLatch = false;
let hopFloatLeft = 0;

// Fills _surface with what the wheels would rest on at (x, z), for a buggy
// at height y: the highway deck (with 3D elevation awareness for junctions/overpasses)
// when on it, otherwise the ground as drawn, or the water's surface over water
function sampleSurface(x, z, y) {
  const onDeck = sampleRoad(x, z, _road, y);
  if (onDeck && y >= _road.height - ROAD_STEP_UP) {
    _surface.height = _road.height;
    _surface.slopeX = _road.slopeX;
    _surface.slopeZ = _road.slopeZ;
    _surface.kind = 'road';
    // Where the road runs in a cutting, the bank's drawn ground rises above
    // the deck's edge: the tyres ride on the bank there
    if (!_road.rails) {
      sampleGround(x, z, _ground);
      if (_ground.height > _road.height) {
        _surface.height = _ground.height;
        _surface.slopeX = _ground.slopeX;
        _surface.slopeZ = _ground.slopeZ;
      }
    }
    _surface.rails = _road.rails;
    _surface.across = _road.across;
    _surface.normalX = _road.normalX;
    _surface.normalZ = _road.normalZ;
    return _surface;
  }
  _surface.rails = false;
  sampleGround(x, z, _surface);
  _surface.kind = 'ground';
  if (getElevation(x, z) <= WATER_LEVEL + 0.1) {
    const float = WATER_LEVEL - FLOAT_DEPTH;
    if (_surface.height < float) {
      _surface.height = float;
      _surface.slopeX = 0;
      _surface.slopeZ = 0;
    }
    _surface.kind = 'water';
  }
  return _surface;
}

// Rests the surface under the middle (from sampleSurface) on all four tyres:
// its height and slopes become those of the ground the tyres touch, so a
// tyre over a bank, a crease in the terrain or a road's edge doesn't sink
// into it. Over water it hovers flat as it was.
function restOnWheels(surface, x, z, y, yaw) {
  if (surface.kind === 'water') return surface;
  const {kind, height} = surface;
  const rails = surface.rails;
  const across = surface.across;
  const normalX = surface.normalX;
  const normalZ = surface.normalZ;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  for (let i = 0; i < 4; i++) {
    const back = i < 2 ? BUGGY_AXLES.front : BUGGY_AXLES.rear;
    const side = (i % 2 ? 1 : -1) * BUGGY_AXLES.halfTrack;
    _wheelHeights[i] = sampleSurface(
      x - fx * back + rx * side,
      z - fz * back + rz * side,
      y
    ).height;
  }
  ChillFlightLogic.buggyWheelContact(
    _wheelHeights,
    BUGGY_AXLES,
    height,
    _contact
  );
  _surface.kind = kind;
  _surface.rails = rails;
  _surface.across = across;
  _surface.normalX = normalX;
  _surface.normalZ = normalZ;
  // How far the lowest tyre is into its ground, at the chassis's tilt now
  // (in the air the tilt follows its path, not the ground)
  const tanPitch = Math.tan(tiltPitch);
  const tanRoll = Math.tan(tiltRoll);
  let touch = -Infinity;
  for (let i = 0; i < 4; i++) {
    const ahead = -(i < 2 ? BUGGY_AXLES.front : BUGGY_AXLES.rear);
    const side = (i % 2 ? 1 : -1) * BUGGY_AXLES.halfTrack;
    touch = Math.max(
      touch,
      _wheelHeights[i] - (y + tanPitch * ahead + tanRoll * side)
    );
  }
  _contact.touch = touch;
  _surface.height = _contact.height;
  _surface.slopeX = _contact.along * fx + _contact.across * rx;
  _surface.slopeZ = _contact.along * fz + _contact.across * rz;
  return _surface;
}

// Into the buggy. Switching from a plane in the air drops it from where the
// plane was, carrying on along the plane's heading at the speed it had (up
// to the buggy's top speed) and climbing or sinking as the plane was, to
// fall from there. Otherwise (the game loading, a teleport from the map's
// click-to-fly) it's set down on the ground under the plane.
function enter(fall) {
  yaw = planeGroup.rotation.y;
  const planeSpeed = Math.abs(state.flightSpeedMultiplier) * KTS_PER_MULT;
  _heading.set(0, 0, -1).applyEuler(planeGroup.rotation);
  const climb = fall ? _heading.y : 0;
  const speed = Math.min(
    TOP_SPEED,
    planeSpeed * Math.sqrt(Math.max(0, 1 - climb * climb))
  );
  velX = -Math.sin(yaw) * speed;
  velZ = -Math.cos(yaw) * speed;
  // Cruise control no faster than the buggy goes
  state.targetFlightSpeed = Math.min(
    state.targetFlightSpeed || 0,
    TOP_SPEED / KTS_PER_MULT
  );
  velY = THREE.MathUtils.clamp(
    planeSpeed * climb,
    -MAX_FALL_SPEED,
    ChillFlightLogic.BUGGY_AIR.MAX_RAMP_VEL
  );
  yawRate = 0;
  steer = 0;
  car.lean = 0;
  car.slide = 0;
  slip = 0;
  hopping = false;
  airborne = false;
  bounce = 0;
  bounceVel = 0;
  const pos = planeGroup.position;
  // What it'd land on: the deck it's over and above, or else the ground
  const below = sampleSurface(pos.x, pos.z, fall ? pos.y : Infinity).height;
  if (fall && pos.y > below + DROP_HEIGHT) {
    airborne = true;
  } else {
    velY = 0;
    pos.y = below;
    pos.y = sampleSurface(pos.x, pos.z, pos.y).height;
  }
  const s = _surface;
  hoverFold = s.kind === 'water' ? 1 : 0;
  if (airborne) {
    tiltPitch = Math.atan2(velY, Math.max(1, speed)) * 0.6;
    tiltRoll = 0;
  } else {
    tiltPitch = Math.atan(-Math.sin(yaw) * s.slopeX - Math.cos(yaw) * s.slopeZ);
    tiltRoll = Math.atan(Math.cos(yaw) * s.slopeX - Math.sin(yaw) * s.slopeZ);
  }
  state.autopilotEnabled = false;
  _lastPos.copy(pos);
}

// The stick's steering and throttle axes (ChillFlightLogic), only while the
// stick or gyro is steering
function stickLive() {
  return state.mouseControlActive || state.currentControlScheme === 'gyro';
}

function analogSteerAxis(value) {
  if (!stickLive()) return 0;
  return ChillFlightLogic.buggySteerAxis(
    value,
    state.currentControlScheme === 'joystick'
  );
}

function analogThrottleAxis(value) {
  if (!stickLive()) return 0;
  return ChillFlightLogic.buggyThrottleAxis(
    value,
    state.currentControlScheme === 'joystick'
  );
}

// Loses speed hitting something (breakables.js): keep is the fraction kept
export function slowBuggy(keep) {
  velX *= keep;
  velZ *= keep;
}

export function updateBuggy(delta) {
  const model = state.airplaneModel;
  if (state.isFreeCamera || !model) return;
  const pos = planeGroup.position;
  if (
    model !== lastModel ||
    pos.distanceToSquared(_lastPos) > TELEPORT_DISTANCE ** 2
  ) {
    // Switched to from another plane (not the game loading, nor a teleport)
    const fall = model !== lastModel && !!model.switchedTo;
    lastModel = model;
    enter(fall);
  }
  const dt = Math.min(delta, 0.05);

  // --- INPUT ---
  const shift = keys.Shift;
  let steerIn = -analogSteerAxis(state.mouseX);
  if ((keys.ArrowLeft || keys.KeyA) && !shift) steerIn = 1;
  else if ((keys.ArrowRight || keys.KeyD) && !shift) steerIn = -1;

  let joyY = analogThrottleAxis(state.mouseY);
  if ((keys.ArrowUp || keys.KeyW) && !shift) joyY = 1;
  else if ((keys.ArrowDown || keys.KeyS) && !shift) joyY = -1;

  // Double-tap moves (held: the double-tap stays set until the key's let go)
  const held = (dir) => doubleTap[dir] && keys[dir] && !shift;
  const dtUp = held('ArrowUp');
  const hop = dtUp && !hopLatch && !airborne;
  hopLatch = dtUp;
  if (hop) {
    hopping = true;
    hopFloatLeft = ChillFlightLogic.BUGGY_MOVES.HOP_FLOAT_SECONDS;
  }
  const hopHeld = hopping && keys.ArrowUp && !shift;
  const float = hopHeld && hopFloatLeft > 0;
  hopFloatLeft = hopHeld ? hopFloatLeft - dt : 0;
  const hardBrake = held('ArrowDown');
  const slide =
    held('ArrowLeft') ||
    held('ArrowRight') ||
    (hardBrake && Math.abs(steerIn) > 0.5);

  // --- FORCES ---
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  let forward = velX * fx + velZ * fz;
  let side = velX * rx + velZ * rz;
  const speed = Math.hypot(velX, velZ);

  const ground = sampleSurface(pos.x, pos.z, pos.y);
  const onWater = ground.kind === 'water';
  const top = TOP_SPEED;

  let driveAccel = 0;
  if (!airborne) {
    // Gravity along the slope: downhill speeds up, uphill slows
    const norm = Math.sqrt(1 + ground.slopeX ** 2 + ground.slopeZ ** 2);
    const slopeAlong = (fx * ground.slopeX + fz * ground.slopeZ) / norm;
    const slopeAcross = (rx * ground.slopeX + rz * ground.slopeZ) / norm;
    const slopeAccel = -GRAVITY * slopeAlong;

    // Rolling resistance and drag
    const drag = ChillFlightLogic.buggyDrag(forward);
    // Throttle slider sets baseline cruise speed
    const cruise = Math.min(
      top,
      Math.max(0, (state.targetFlightSpeed || 0) * KTS_PER_MULT)
    );
    driveAccel = ChillFlightLogic.buggyDriveAccel({
      forward,
      joyY,
      cruise,
      top,
      drag,
      hardBrake,
    });

    const coasting = hardBrake || (Math.abs(joyY) <= 0.05 && cruise <= 0.5);
    if (
      coasting &&
      Math.abs(forward) < 0.5 &&
      Math.abs(slopeAccel) < PARK_HOLD
    ) {
      // Parked: tyres hold it on gentle slopes
      forward = 0;
      side = 0;
    } else {
      forward += (driveAccel + slopeAccel) * dt;
      forward -= Math.sign(forward) * Math.min(Math.abs(forward), drag * dt);
    }

    // Sliding down a slope across it
    side += -GRAVITY * slopeAcross * dt;
  }

  // Steering, turning and the tyres' grip, leaning in to drift through a
  // hard turn at speed, and turning in the air (ChillFlightLogic)
  Object.assign(car, {velX, velZ, yaw, yawRate, steer});
  slip = ChillFlightLogic.stepBuggyHandling(car, {
    forward,
    side,
    steerIn,
    kind: ground.kind,
    slide,
    hopHeld,
    airborne,
    wheelbase: BUGGY_WHEELBASE,
    topSpeed: TOP_SPEED,
    dt,
  });
  ({velX, velZ, yaw, yawRate, steer} = car);

  const kick = (impact) => {
    bounceVel -= impact;
  };

  // --- MOVE ---
  const oldX = pos.x;
  const oldZ = pos.z;
  const oldHeight = ground.height;
  const wasOnRoad = ground.kind === 'road';
  // Between a raised bridge's railings, below their tops
  const railed =
    wasOnRoad &&
    ground.rails &&
    pos.y <= oldHeight + ChillFlightLogic.BUGGY_RAIL.TOP;

  const blocker = (x, z) => {
    const s = sampleSurface(x, z, pos.y);
    if (
      wasOnRoad &&
      s.kind !== 'road' &&
      (railed || oldHeight - s.height > ROAD_STEP_UP)
    ) {
      return 'barrier';
    }
    const rise = s.height - oldHeight;
    const moved = Math.hypot(x - oldX, z - oldZ);
    if (
      !onWater &&
      s.kind !== 'road' &&
      rise > 0.5 &&
      rise > WALL_SLOPE * moved
    ) {
      return 'wall';
    }
    return null;
  };

  const block = blocker(oldX + velX * dt, oldZ + velZ * dt);
  if (!block) {
    pos.x += velX * dt;
    pos.z += velZ * dt;
  } else if (block === 'barrier') {
    if (!blocker(oldX, oldZ + velZ * dt)) {
      pos.z += velZ * dt;
      velX *= -0.2;
    } else if (!blocker(oldX + velX * dt, oldZ)) {
      pos.x += velX * dt;
      velZ *= -0.2;
    } else {
      velX *= -0.2;
      velZ *= -0.2;
    }
    kick(Math.min(1.5, speed * 0.02));
  } else {
    const s = sampleSurface(oldX + velX * dt, oldZ + velZ * dt, pos.y);
    const g = Math.hypot(s.slopeX, s.slopeZ) || 1;
    const nx = s.slopeX / g;
    const nz = s.slopeZ / g;
    const into = velX * nx + velZ * nz;
    if (into > 0) {
      velX -= nx * into * 1.3;
      velZ -= nz * into * 1.3;
    }
  }
  let surface = sampleSurface(pos.x, pos.z, pos.y);
  if (surface.kind === 'road' && surface.rails) {
    // A raised bridge's railings hold it on the deck (ChillFlightLogic)
    Object.assign(_railCar, {x: pos.x, z: pos.z, y: pos.y, velX, velZ});
    const hit = ChillFlightLogic.stepBuggyRails(_railCar, surface, yaw);
    if (_railCar.x !== pos.x || _railCar.z !== pos.z) {
      pos.x = _railCar.x;
      pos.z = _railCar.z;
      ({velX, velZ} = _railCar);
      if (hit > 0) kick(Math.min(1.5, hit * 0.03));
      surface = sampleSurface(pos.x, pos.z, pos.y);
    }
  }
  surface = restOnWheels(surface, pos.x, pos.z, pos.y, yaw);
  if (airborne && surface.kind !== 'water' && _contact.touch > 0) {
    if (_contact.height - pos.y > AIR_WALL_STEP) {
      // Flying into a bank: back out and bounce off its face
      pos.x = oldX;
      pos.z = oldZ;
      const g = Math.hypot(surface.slopeX, surface.slopeZ) || 1;
      const nx = surface.slopeX / g;
      const nz = surface.slopeZ / g;
      const into = velX * nx + velZ * nz;
      if (into > 0) {
        velX -= nx * into * 1.3;
        velZ -= nz * into * 1.3;
        kick(Math.min(1.5, into * 0.02));
      }
      surface = restOnWheels(
        sampleSurface(pos.x, pos.z, pos.y),
        pos.x,
        pos.z,
        pos.y,
        yaw
      );
    }
    if (_contact.touch > 0) {
      // A tyre touches down: the chassis settles onto the ground under all
      // four, and it lands as soon as it's down to it
      tiltPitch = Math.atan(_contact.along);
      tiltRoll = Math.atan(_contact.across);
      pos.y = Math.max(pos.y, Math.min(surface.height, pos.y + AIR_WALL_STEP));
    }
  }

  // --- UP AND DOWN ---
  if (
    !airborne &&
    surface.kind === 'road' &&
    !wasOnRoad &&
    surface.height - pos.y > 0.5
  ) {
    // Smooth curb mounting when driving onto road from off-road
    const step = Math.min(surface.height - pos.y, ROAD_STEP_UP);
    pos.y += Math.min(step, 25 * dt);
    if (pos.y >= surface.height - 0.1) {
      pos.y = surface.height;
    }
    velY = 0;
  } else {
    const groundVelY = velX * surface.slopeX + velZ * surface.slopeZ;
    const res = ChillFlightLogic.stepBuggyVertical({
      y: pos.y,
      velY,
      airborne,
      surfaceHeight: surface.height,
      groundVelY,
      onWater,
      hop,
      float,
      dt,
    });
    pos.y = res.y;
    velY = res.velY;
    airborne = res.airborne;
    if (res.impact > 2) kick(res.impact * 0.04);
    if (res.impact > 0) {
      const scrub = 1 - Math.min(0.15, res.impact * 0.002);
      velX *= scrub;
      velZ *= scrub;
    }
  }
  if (!airborne) hopping = false;
  _lastPos.copy(pos);

  // --- LOOKS ---
  planeGroup.rotation.set(0, yaw, 0);
  const s = surface;
  const visualYaw = yaw;
  if (!airborne) {
    const pitch = Math.atan(
      -Math.sin(visualYaw) * s.slopeX - Math.cos(visualYaw) * s.slopeZ
    );
    const roll = Math.atan(
      Math.cos(visualYaw) * s.slopeX - Math.sin(visualYaw) * s.slopeZ
    );
    const ease = 1 - Math.exp(-dt / TILT_EASE_SECONDS);
    tiltPitch += (pitch - tiltPitch) * ease;
    tiltRoll += (roll - tiltRoll) * ease;
  } else {
    const ease = 1 - Math.exp(-dt / AIR_TILT_EASE_SECONDS);
    const path = Math.atan2(velY, Math.max(1, speed)) * 0.6;
    tiltPitch += (path - tiltPitch) * ease;
    tiltRoll += (0 - tiltRoll) * ease;
  }
  model.rotation.order = 'YXZ';
  model.rotation.set(tiltPitch, 0, tiltRoll);
  model.position.y = 0;

  // The body on its critically damped springs
  bounceVel += (-SPRING * bounce - DAMPING * bounceVel) * dt;
  bounce = THREE.MathUtils.clamp(bounce + bounceVel * dt, -0.6, 0.6);
  const leanEase = 1 - Math.exp(-dt / LEAN_EASE_SECONDS);
  const squatTarget = airborne ? 0 : driveAccel * SQUAT_PER_ACCEL;
  const leanTarget = airborne ? 0 : -forward * yawRate * LEAN_PER_ACCEL;
  squat +=
    (THREE.MathUtils.clamp(squatTarget, -MAX_LEAN, MAX_LEAN) - squat) *
    leanEase;
  lean +=
    (THREE.MathUtils.clamp(leanTarget, -MAX_LEAN, MAX_LEAN) - lean) * leanEase;
  if (model.body) {
    const bob = onWater ? Math.sin(performance.now() * 0.0024) * 0.12 : 0;
    model.body.position.y = bounce + bob;
    model.body.rotation.set(squat, 0, lean);
  }
  // Over water (or flying over it) the wheels fold flat to hover
  hoverFold = ChillFlightLogic.stepBuggyHoverFold(
    hoverFold,
    surface.kind === 'water',
    dt
  );
  setBuggyHoverFold(model, hoverFold);
  if (model.wheels) {
    const roll = (forward * dt) / BUGGY_WHEEL_RADIUS;
    for (const wheel of model.wheels) wheel.rotation.x -= roll;
  }
  if (model.steerPivots) {
    const wheelSteer = THREE.MathUtils.clamp(steer, -MAX_STEER, MAX_STEER);
    for (const pivot of model.steerPivots) pivot.rotation.y = wheelSteer;
  }

  // --- WHAT THE REST OF THE GAME READS ---
  state.flightSpeedMultiplier = speed / KTS_PER_MULT;
  state._nextYaw = yaw;
  state.verticalVelocity = 0;
  state.lastY = pos.y;
  state.isOnWater = !airborne && onWater;
  state.isOnGround = !airborne && !onWater;
  setOnWheels(state.isOnGround);
  state.targetPitch = 0;
  state.targetRoll = 0;
  state.isDoingImmelmann = false;
  state.isLooping = false;
  state.isBarrelRolling = false;
  state.isSteepPitch = false;
  state.sharpTurnAmount = 0;
  // Smoke or dust off the tyres braking hard or drifting
  const braking = joyY < -0.2 && forward > 15 ? Math.min(1, -joyY) : 0;
  const drifting = THREE.MathUtils.clamp((Math.abs(slip) - 0.1) / 0.3, 0, 1);
  state.buggySlide =
    !airborne && !onWater && speed > 15 ? Math.max(braking, drifting) : 0;
}
