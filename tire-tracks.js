// --- TIRE TRACKS ---
// Twin ruts the wheels leave behind on dirt, grass, sand and snow, and dark
// rubber marks on paving when the buggy drifts or brakes hard or a plane's
// wheels touch down. Each wheel lays a ribbon of short quads on the ground
// under its tyre, joined end to end, into one ring buffer drawn in a single
// call. Each quad is written once, when it's laid, and fades out in the
// shader from when it was laid, so the CPU does nothing more for it.
//
// The marks multiply the colour of what's under them (so they darken grass,
// sand and asphalt alike, and dim with it at night) rather than painting a
// colour of their own.
import * as THREE from 'three';
import {scene} from './scene.js';
import {state} from './state.js';
import {hooks} from './hooks.js';
import {renderer} from './sky.js';
import {BASE_FLIGHT_SPEED, roadSnowUniforms} from './constants.js';
import {sampleGround} from './terrain-geometry.js';
import {sampleGroundColor} from './terrain-chunks.js';
import {activePlaneType, planeGroup} from './airplane.js';
import {isOnWheels} from './flight-physics.js';
import {isPaved} from './particles.js';
import {BUGGY_AXLES} from './buggy-model.js';
import {ChillFlightLogic} from './chill-flight-logic.js';

// Quads in the ring: both tyres' tracks for TRACK_LIFE at top speed
const SEGMENTS = 3072;
// How far the tyre rolls before the next quad is laid (units): further
// apart at speed, where the path curves gently, so the ring holds as many
// seconds of tracks at top speed (SPACING_TIME of travel, up to MAX_PIECE)
const SPACING = 1.6;
const SPACING_TIME = 1 / 50;
// The longest quad laid in one piece (units)
const MAX_PIECE = 5;
// Further than this between frames is a teleport: start a new ribbon
const BREAK_DISTANCE = 40;
// Lifted off the ground a little, besides the depth offset
const LIFT = 0.08;
// How long each kind of mark takes to fade away (seconds)
const TRACK_LIFE = 16;
const SKID_LIFE = 10;
// How long after a plane touches down its tyres leave rubber (seconds)
const TOUCHDOWN_SKID = 0.6;
// Tracks fade out with distance from the camera, before the fog would
// show them darker than the ground around them (units)
const FADE_NEAR = 220;
const FADE_FAR = 480;

// Tyre width (units) and how far each wheel is to the side and behind the
// vehicle's middle. The buggy draws its rear tyres, and its front ones too
// while it slides (`front`, how far behind the middle they are); the planes
// draw their main wheels (or the seaplane's pontoons).
const WHEELS = {
  buggy: {
    width: 1.4,
    half: BUGGY_AXLES.halfTrack,
    back: BUGGY_AXLES.rear,
    front: BUGGY_AXLES.front,
  },
  seaplane: {width: 1.6, half: 5, back: 0},
  // Main wheels where the models put them (biplane.js, twin.js, jet.js;
  // negative back is ahead of the middle)
  twin: {width: 0.7, half: 5.8, back: -1.4},
  jet: {width: 0.5, half: 1.85, back: 0.8},
  biplane: {width: 0.6, half: 3.8, back: -4.6},
};
const DEFAULT_WHEELS = {width: 0.8, half: 2, back: 0};

// The wheels for a vehicle, following a buggy model's own drawn axles (the
// police cruiser's are wider apart than the buggy's)
const _drawnWheels = {width: WHEELS.buggy.width, half: 0, back: 0, front: 0};
function wheelsOf(type, model) {
  const axles = model?.axles;
  if (type !== 'buggy' || !axles) return WHEELS[type] ?? DEFAULT_WHEELS;
  _drawnWheels.half = axles.halfTrack;
  _drawnWheels.back = axles.rear;
  _drawnWheels.front = axles.front;
  return _drawnWheels;
}
// How long a tyre's patch on the ground is (units): sliding sideways, it
// scuffs a swath that wide rather than its own width
const PATCH_LENGTH = 1.6;
// Sliding less than this, the buggy's front tyres leave nothing
const FRONT_SLIDE = 0.15;

// What each mark multiplies the ground by at full strength
const DIRT_TINT = new THREE.Color(0.6, 0.55, 0.48);
const SNOW_TINT = new THREE.Color(0.66, 0.71, 0.8);
const RUBBER_TINT = new THREE.Color(0.22, 0.22, 0.24);
// Tracks through snow on the road show the darker asphalt in the ruts
const ROAD_SNOW_TINT = new THREE.Color(0.55, 0.58, 0.62);

const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(SEGMENTS * 4 * 3);
// Birth time, lifetime, strength and side (-1 to 1 across the tyre)
const infos = new Float32Array(SEGMENTS * 4 * 4);
const tints = new Float32Array(SEGMENTS * 4 * 3);
const aPosition = new THREE.BufferAttribute(positions, 3);
const aInfo = new THREE.BufferAttribute(infos, 4);
const aTint = new THREE.BufferAttribute(tints, 3);
const attributes = [aPosition, aInfo, aTint];
for (const attr of attributes) attr.setUsage(THREE.DynamicDrawUsage);
geometry.setAttribute('position', aPosition);
geometry.setAttribute('aInfo', aInfo);
geometry.setAttribute('aTint', aTint);
const index = new Uint32Array(SEGMENTS * 6);
for (let i = 0; i < SEGMENTS; i++) {
  const v = i * 4;
  index.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], i * 6);
}
geometry.setIndex(new THREE.BufferAttribute(index, 1));
// Nothing laid yet: everything is born dead
for (let i = 0; i < SEGMENTS * 4; i++) infos[i * 4 + 1] = -1;

const uniforms = {
  uTime: {value: 0},
};

const material = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -4,
  // Multiplies what's already drawn by the fragment's colour
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.ZeroFactor,
  blendDst: THREE.SrcColorFactor,
  vertexShader: /* glsl */ `
    attribute vec4 aInfo;
    attribute vec3 aTint;
    uniform float uTime;
    varying vec3 vTint;
    varying float vSide;
    varying float vStrength;
    void main() {
      float age = (uTime - aInfo.x) / aInfo.y;
      if (aInfo.y <= 0.0 || age > 1.0) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        vStrength = 0.0;
        return;
      }
      float dist = distance(position, cameraPosition);
      // Fading slowly at first, then away
      float fade = 1.0 - age * age;
      vStrength = aInfo.z * fade *
        (1.0 - smoothstep(${FADE_NEAR.toFixed(1)}, ${FADE_FAR.toFixed(1)}, dist));
      vSide = aInfo.w;
      vTint = aTint;
      gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec3 vTint;
    varying float vSide;
    varying float vStrength;
    void main() {
      // Soft at the tyre's edges
      float edge = 1.0 - smoothstep(0.55, 1.0, abs(vSide));
      float a = vStrength * edge;
      if (a <= 0.003) discard;
      gl_FragColor = vec4(mix(vec3(1.0), vTint, a), 1.0);
    }
  `,
});

const mesh = new THREE.Mesh(geometry, material);
mesh.frustumCulled = false;
// Over the ground and roads, under the particles' puffs
mesh.renderOrder = 1;
mesh.visible = false;
scene.add(mesh);

// --- FLATTENED GRASS ---
// The tall grass (grass.js) would hide the ruts under its blades, so the
// tracks are also drawn from above into a small map round the grass field,
// which the grass reads to lie flat and low along them, standing back up as
// the tracks fade.
const TRAMPLE_SIZE = 128;
export const trample = {
  target: new THREE.WebGLRenderTarget(TRAMPLE_SIZE, TRAMPLE_SIZE, {
    depthBuffer: false,
  }),
  // The map's centre (x, z) and how far it spans (units)
  center: new THREE.Vector2(),
  span: 0,
  // Whether there's anything in it
  live: false,
};
const trampleMaterial = new THREE.ShaderMaterial({
  uniforms,
  depthTest: false,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.CustomBlending,
  blendEquation: THREE.MaxEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  vertexShader: /* glsl */ `
    attribute vec4 aInfo;
    uniform float uTime;
    varying float vSide;
    varying float vStrength;
    void main() {
      float age = (uTime - aInfo.x) / aInfo.y;
      if (aInfo.y <= 0.0 || age > 1.0) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        vStrength = 0.0;
        return;
      }
      // Off the paving only (grass doesn't grow there): ruts, not rubber
      vStrength = min(1.0, aInfo.z * 4.2) * (1.0 - age * age);
      vSide = aInfo.w;
      gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    varying float vSide;
    varying float vStrength;
    void main() {
      float edge = 1.0 - smoothstep(0.7, 1.0, abs(vSide));
      gl_FragColor = vec4(vStrength * edge, 0.0, 0.0, 1.0);
    }
  `,
});
const trampleScene = new THREE.Scene();
const trampleMesh = new THREE.Mesh(geometry, trampleMaterial);
trampleMesh.frustumCulled = false;
trampleScene.add(trampleMesh);
// Looking straight down: x to the right and -z up the map
const trampleCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 20000);
trampleCamera.rotation.x = -Math.PI / 2;
const _clear = new THREE.Color();

/**
 * Draws the tracks into the trample map round (x, z), `span` units across
 * (for the grass, grass.js). Clears it once when nothing's left.
 */
export function drawTrample(renderer, x, z, span) {
  const live = mesh.visible && ChillFlightLogic.TIRE_TRACKS;
  if (!live && !trample.live) return;
  // Snapped to the map's texels so the flattened lanes don't shimmer
  const texel = span / TRAMPLE_SIZE;
  x = Math.round(x / texel) * texel;
  z = Math.round(z / texel) * texel;
  trample.center.set(x, z);
  trample.span = span;
  trample.live = live;
  const h = span / 2;
  trampleCamera.left = -h;
  trampleCamera.right = h;
  trampleCamera.top = h;
  trampleCamera.bottom = -h;
  trampleCamera.position.set(x, 10000, z);
  trampleCamera.updateProjectionMatrix();
  trampleCamera.updateMatrixWorld();
  const target = renderer.getRenderTarget();
  const clearAlpha = renderer.getClearAlpha();
  renderer.getClearColor(_clear);
  const xr = renderer.xr.enabled;
  renderer.xr.enabled = false;
  renderer.setRenderTarget(trample.target);
  renderer.setClearColor(0x000000, 1);
  renderer.clear(true, false, false);
  if (live) renderer.render(trampleScene, trampleCamera);
  renderer.setRenderTarget(target);
  renderer.setClearColor(_clear, clearAlpha);
  renderer.xr.enabled = xr;
}

let cursor = 0;
let writtenFrom = -1;
let writtenCount = 0;
let allDeadAt = 0;

// Each wheel's ribbon: where it was last laid and its edges there
function newRibbon() {
  return {
    valid: false,
    point: new THREE.Vector3(),
    left: new THREE.Vector3(),
    right: new THREE.Vector3(),
    strength: 0,
    tint: new THREE.Color(),
    life: TRACK_LIFE,
  };
}
// Rear (or only) left and right, then the buggy's front left and right
const ribbons = [newRibbon(), newRibbon(), newRibbon(), newRibbon()];

function writeVertex(v, p, side, birth, life, strength, tint) {
  positions[v * 3] = p.x;
  positions[v * 3 + 1] = p.y;
  positions[v * 3 + 2] = p.z;
  infos[v * 4] = birth;
  infos[v * 4 + 1] = life;
  infos[v * 4 + 2] = strength;
  infos[v * 4 + 3] = side;
  tints[v * 3] = tint.r;
  tints[v * 3 + 1] = tint.g;
  tints[v * 3 + 2] = tint.b;
}

// One quad from the ribbon's last edge to (left, right), with mark m, which
// becomes the ribbon's last edge
function laySegment(r, left, right, m) {
  const {strength, tint, life} = m;
  const i = cursor;
  cursor = (cursor + 1) % SEGMENTS;
  if (writtenCount === 0) writtenFrom = i;
  writtenCount = Math.min(SEGMENTS, writtenCount + 1);
  const now = uniforms.uTime.value;
  const v = i * 4;
  // The near end keeps the life it was laid with, so a skid that stops
  // fades along its length rather than all at once
  writeVertex(v, r.left, -1, now, r.life, r.strength, r.tint);
  writeVertex(v + 1, r.right, 1, now, r.life, r.strength, r.tint);
  writeVertex(v + 2, left, -1, now, life, strength, tint);
  writeVertex(v + 3, right, 1, now, life, strength, tint);
  allDeadAt = Math.max(allDeadAt, now + Math.max(life, r.life));
  r.left.copy(left);
  r.right.copy(right);
  r.strength = strength;
  r.tint.copy(tint);
  r.life = life;
}

const _groundAt = {height: 0, slopeX: 0, slopeZ: 0};
// Sets p just over the ground as drawn
function onGround(p) {
  sampleGround(p.x, p.z, _groundAt);
  p.y = _groundAt.height + LIFT;
}

// Lifts p to just over the ground as drawn, if it's under it
function aboveGround(p) {
  sampleGround(p.x, p.z, _groundAt);
  p.y = Math.max(p.y, _groundAt.height + LIFT);
}

function upload() {
  if (writtenCount === 0) return;
  const wraps = writtenFrom + writtenCount > SEGMENTS;
  for (const attr of attributes) {
    attr.clearUpdateRanges();
    const per = attr.itemSize * 4;
    if (wraps) attr.addUpdateRange(0, SEGMENTS * per);
    else attr.addUpdateRange(writtenFrom * per, writtenCount * per);
    attr.needsUpdate = true;
  }
  writtenCount = 0;
}

// What the ground under (x, z) does to a tyre: its mark's tint and
// strength, from the ground's colour (snow or not) looked up a few times
// a second
const _ground = new THREE.Color();
const surface = {paved: false, snow: false, checkIn: 0};
function checkSurface(x, z) {
  surface.checkIn -= 1;
  if (surface.checkIn > 0) return surface;
  surface.checkIn = 4;
  surface.paved = isPaved(x, z);
  surface.snow = false;
  if (!surface.paved && sampleGroundColor(x, z, _ground)) {
    const {r, g, b} = _ground;
    surface.snow = r > 0.7 && g > 0.7 && b > 0.72;
  }
  return surface;
}

const _tint = new THREE.Color();
// The mark the tyres leave now: {strength, tint, life}, or strength 0
const mark = {strength: 0, tint: _tint, life: TRACK_LIFE};
function markNow(x, z, sinceTouchdown) {
  const s = checkSurface(x, z);
  const buggy = activePlaneType === 'buggy';
  const slide = buggy ? state.buggySlide || 0 : 0;
  const landing =
    !buggy && sinceTouchdown < TOUCHDOWN_SKID
      ? 1 - sinceTouchdown / TOUCHDOWN_SKID
      : 0;
  if (s.paved) {
    // Rubber off a skid or a touchdown, or ruts in snow on the road
    const rubber = Math.max(slide, landing);
    const snow = roadSnowUniforms.uRoadSnow.value;
    if (rubber > 0.15) {
      mark.strength = 0.75 * rubber;
      _tint.copy(RUBBER_TINT);
      mark.life = SKID_LIFE;
    } else if (snow > 0.2) {
      mark.strength = 0.7 * snow;
      _tint.copy(ROAD_SNOW_TINT);
      mark.life = TRACK_LIFE;
    } else {
      mark.strength = 0;
    }
    return mark;
  }
  // Off the paving the ruts are always there, cut deeper by a slide
  _tint.copy(s.snow ? SNOW_TINT : DIRT_TINT);
  mark.strength = (s.snow ? 0.6 : 0.24) + 0.45 * Math.max(slide, landing);
  mark.life = TRACK_LIFE;
  return mark;
}

const _contact = new THREE.Vector3();
const _left = new THREE.Vector3();
const _right = new THREE.Vector3();
const _pieceLeft = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _swap = new THREE.Vector3();
const noMark = {strength: 0, tint: _tint, life: TRACK_LIFE};
const _pieceRight = new THREE.Vector3();

// Where the tyre on `side` touches the ground, in the world, `across`
// units out from its middle (so a tyre's edges follow a bank's tilt)
function tyreContact(model, wheels, side, across, back, out) {
  out.set(side * wheels.half + across, -(model.wheelDepth ?? 0), back);
  model.localToWorld(out);
  out.y += LIFT;
  return out;
}

let lastWheels = false;
let lastPlaneType = null;
let sinceTouchdown = Infinity;
let settleTime = 0;

/** Per frame: lays the wheels' marks and moves the marks' clock. */
export function updateTireTracks(delta) {
  if (!ChillFlightLogic.TIRE_TRACKS || state.isPaused || delta <= 0) return;
  uniforms.uTime.value += delta;
  settleTime += delta;

  if (activePlaneType !== lastPlaneType) {
    lastPlaneType = activePlaneType;
    for (const r of ribbons) r.valid = false;
  }

  const model = state.airplaneModel;
  const wheels = isOnWheels() && !state.isOnWater;
  if (wheels && !lastWheels) sinceTouchdown = 0;
  else sinceTouchdown += delta;
  lastWheels = wheels;

  if (
    !wheels ||
    !model ||
    state.isFreeCamera ||
    state.isCrashed ||
    settleTime < 1
  ) {
    for (const r of ribbons) r.valid = false;
  } else {
    const spec = wheelsOf(activePlaneType, state.airplaneModel);
    const {x, z} = planeGroup.position;
    markNow(x, z, sinceTouchdown);
    const w = spec.width / 2;
    const speed =
      Math.abs(state.flightSpeedMultiplier || 0) * BASE_FLIGHT_SPEED * 60;
    const spacing = THREE.MathUtils.clamp(
      speed * SPACING_TIME,
      SPACING,
      MAX_PIECE
    );
    const h = planeGroup.rotation.y;
    const fx = -Math.sin(h);
    const fz = -Math.cos(h);
    const sliding = activePlaneType === 'buggy' ? state.buggySlide || 0 : 0;
    ribbons.forEach((r, i) => {
      const front = i >= 2;
      if (front && spec.front === undefined) {
        r.valid = false;
        return;
      }
      const back = front ? spec.front : spec.back;
      const side = i % 2 ? 1 : -1;
      const p = tyreContact(model, spec, side, 0, back, _contact);
      const far = r.valid ? r.point.distanceTo(p) : Infinity;
      // Rolling straight, the mark is the tyre's width across its own
      // axle (following a bank's tilt); sliding, it's square to the way the
      // tyre is really going and widens to the swath it scuffs sideways
      let travel = 0;
      if (r.valid && far <= BREAK_DISTANCE) {
        _dir.set(p.x - r.point.x, 0, p.z - r.point.z);
        travel = _dir.length();
      }
      const slip =
        travel > 0.5
          ? Math.min(1, Math.abs(_dir.x * fz - _dir.z * fx) / travel)
          : 0;
      if (slip > 0.05) {
        const grip = Math.sqrt(1 - slip * slip);
        const half = (spec.width * grip + PATCH_LENGTH * slip) / 2;
        _dir.divideScalar(travel);
        _left.set(p.x - _dir.z * half, p.y, p.z + _dir.x * half);
        _right.set(p.x + _dir.z * half, p.y, p.z - _dir.x * half);
        // (which side is left flips going backwards: keep the ribbon's own)
        if (
          _left.distanceToSquared(r.left) > _right.distanceToSquared(r.left)
        ) {
          _swap.copy(_left);
          _left.copy(_right);
          _right.copy(_swap);
        }
        if (!surface.paved) {
          onGround(_left);
          onGround(_right);
        }
      } else {
        tyreContact(model, spec, side, -w, back, _left);
        tyreContact(model, spec, side, w, back, _right);
      }
      const m = front && sliding < FRONT_SLIDE ? noMark : mark;
      if (far > BREAK_DISTANCE || (m.strength <= 0 && r.strength <= 0)) {
        // Start a ribbon here, fading in from nothing
        r.valid = true;
        r.point.copy(p);
        r.left.copy(_left);
        r.right.copy(_right);
        r.strength = 0;
        r.tint.copy(m.tint);
        r.life = m.life;
        return;
      }
      if (far < spacing) return;
      // A long way since the last quad (fast, or a slow frame): lay it in
      // pieces, each kept up out of the ground between
      const pieces = Math.ceil(far / MAX_PIECE);
      for (let k = 1; k < pieces; k++) {
        const t = 1 / (pieces - k + 1);
        _pieceLeft.lerpVectors(r.left, _left, t);
        _pieceRight.lerpVectors(r.right, _right, t);
        if (!surface.paved) {
          aboveGround(_pieceLeft);
          aboveGround(_pieceRight);
        }
        laySegment(r, _pieceLeft, _pieceRight, m);
      }
      laySegment(r, _left, _right, m);
      r.point.copy(p);
    });
  }

  upload();
  mesh.visible = uniforms.uTime.value < allDeadAt;
}

if (ChillFlightLogic.TIRE_TRACKS) {
  hooks.warmUps.push(async () => {
    if (renderer) {
      const target = renderer.getRenderTarget();
      const clearAlpha = renderer.getClearAlpha();
      renderer.getClearColor(_clear);
      const xr = renderer.xr.enabled;
      renderer.xr.enabled = false;
      renderer.setRenderTarget(trample.target);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, false, false);
      renderer.render(trampleScene, trampleCamera);
      renderer.setRenderTarget(target);
      renderer.setClearColor(_clear, clearAlpha);
      renderer.xr.enabled = xr;
    }
    const wasVisible = mesh.visible;
    mesh.visible = true;
    return () => {
      mesh.visible = wasVisible;
    };
  });
}
