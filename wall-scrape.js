// --- WALL SCRAPES ---
// The plane's middle keeps a cushion above the ground (flight-physics.js),
// which lifts it straight up. Its wingtips and nose touch steep walls too
// (wall-scrape-logic.js has the maths): a wingtip grazing a cliff pushes
// the plane off sideways, with sparks, a rasp and a wobble away from the
// wall; flying nose first into one glances off it, the heading swinging
// along the wall as the plane is held out of it. Forgiving either way: a
// little speed lost, never a crash.
import * as THREE from 'three';
import {state} from './state.js';
import {sampleGround} from './terrain-geometry.js';
import {activePlaneType, planeGroup} from './airplane.js';
import {BASE_FLIGHT_SPEED, WATER_LEVEL} from './constants.js';
import {propPuffs, scrapeSparks} from './particles.js';
import {playScrape} from './sfx-events.js';
import {smashHaptic} from './haptics.js';
import {checkWallCrash} from './crash.js';
import {
  SCRAPE,
  fadeScrapePush,
  forwardOf,
  glanceHeading,
  headingOf,
  isHeadOn,
  isScrapeTeleport,
  noseLookahead,
  scrapeRoll,
  stepOut,
  turnToward,
  wallContact,
} from './wall-scrape-logic.js';

// Sparks a second while scraping, and while glancing off nose first
const SPARKS_PER_SECOND = 140;
const HEAD_ON_SPARKS_PER_SECOND = 260;
// The rasp repeats this often while scraping (s)
const RASP_EVERY = 0.15;
// The camera's jolt for the first touch (breakables.js uses 1.2 for a tree)
const SHAKE = {graze: 0.5, headOn: 1.2, scraping: 0.25};
const DUST = new THREE.Color(0.62, 0.56, 0.5);

const _ground = {height: 0, slopeX: 0, slopeZ: 0};
const _tip = new THREE.Vector3();
const _probe = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _lastPosition = new THREE.Vector3(NaN, NaN, NaN);
// The push off the wall (units/s), fading
const push = {x: 0, z: 0};
// The probes touching this frame, deepest first is the one shown
const touches = [];
let clock = 0;
let lastTouch = -Infinity;
let lastRasp = -Infinity;
let sparkDebt = 0;
// How long the plane has been heading into a wall (s), and the way out of
// a corner it's turning to (null when not cornered)
let pressing = 0;
let exitHeading = null;

function clearScrapeState() {
  push.x = push.z = 0;
  pressing = 0;
  exitHeading = null;
}

// Probes at the wingtips and the nose, one frame of travel ahead of the
// nose so a wall is met before the plane's middle reaches it; sparks and
// puffs still come off the tip itself (_tip), not out in front
function probe(kind, x, y, z, ahead) {
  _tip.set(x, y, z);
  planeGroup.localToWorld(_tip);
  _probe.copy(_tip);
  if (ahead) _probe.addScaledVector(_fwd, ahead);
  sampleGround(_probe.x, _probe.z, _ground);
  const c = wallContact(_probe.y, _ground, WATER_LEVEL);
  if (!c) return;
  c.kind = kind;
  c.x = _tip.x;
  c.y = _tip.y;
  c.z = _tip.z;
  touches.push(c);
}

// Turning out of a corner, until facing the way out: whether it is
function turnOut(delta) {
  if (exitHeading === null) return false;
  const heading = planeGroup.rotation.y;
  planeGroup.rotation.y = turnToward(
    heading,
    exitHeading,
    SCRAPE.GLANCE_TURN * delta
  );
  const left = exitHeading - planeGroup.rotation.y;
  if (Math.abs(Math.atan2(Math.sin(left), Math.cos(left))) < 0.01) {
    exitHeading = null;
    pressing = 0;
  }
  return true;
}

/** Called once per frame while flying, after the flight physics. */
export function updateWallScrape(delta) {
  clock += delta;
  if (isScrapeTeleport(_lastPosition, planeGroup.position)) {
    clearScrapeState();
  }
  const flying =
    activePlaneType !== 'buggy' &&
    !state.isFreeCamera &&
    !state.isCrashed &&
    !state.isOnGround &&
    !state.isOnWater;
  const model = state.airplaneModel;
  if (!flying || !model?.halfSpan) {
    clearScrapeState();
    _lastPosition.copy(planeGroup.position);
    return;
  }
  if (push.x || push.z) {
    planeGroup.position.x += push.x * delta;
    planeGroup.position.z += push.z * delta;
    push.x = fadeScrapePush(push.x, delta);
    push.z = fadeScrapePush(push.z, delta);
    if (Math.hypot(push.x, push.z) < 1) push.x = push.z = 0;
  }

  planeGroup.updateMatrixWorld();
  planeGroup.getWorldQuaternion(_q);
  _fwd.set(0, 0, -1).applyQuaternion(_q);
  const speed = BASE_FLIGHT_SPEED * Math.abs(state.flightSpeedMultiplier) * 60;
  touches.length = 0;
  probe('left', -model.halfSpan, 0, 0, 0);
  probe('right', model.halfSpan, 0, 0, 0);
  probe('nose', 0, 0, -model.noseLength, noseLookahead(speed, delta));
  if (!touches.length) {
    pressing = Math.max(0, pressing - delta);
    turnOut(delta);
    _lastPosition.copy(planeGroup.position);
    return;
  }

  // Out of the wall, sideways down its slope: the deepest touch's step, the
  // way they all push together
  let sx = 0;
  let sz = 0;
  let most = 0;
  let deepest = touches[0];
  for (const c of touches) {
    const step = stepOut(c.depth, c.slope);
    sx += c.nx * step;
    sz += c.nz * step;
    if (step > most) {
      most = step;
      deepest = c;
    }
  }
  const len = Math.hypot(sx, sz);
  if (len > most && len > 0) {
    sx *= most / len;
    sz *= most / len;
  }
  planeGroup.position.x += sx;
  planeGroup.position.z += sz;

  // And pushed off it at PUSH (at least) while touching, fading after
  const out = push.x * deepest.nx + push.z * deepest.nz;
  if (out < SCRAPE.PUSH) {
    push.x += deepest.nx * (SCRAPE.PUSH - out);
    push.z += deepest.nz * (SCRAPE.PUSH - out);
  }

  const heading = planeGroup.rotation.y;
  const nose = touches.find((c) => c.kind === 'nose');
  const headOn = !!nose && isHeadOn(heading, nose.nx, nose.nz);
  const away = Math.hypot(sx, sz);
  const intoWall = away > 0 && isHeadOn(heading, sx / away, sz / away, 0);
  checkWallCrash({
    heading,
    nose,
    headOn,
    intoWall,
    kts: speed,
    delta,
  });
  const newHit = clock - lastTouch > SCRAPE.NEW_HIT;
  lastTouch = clock;
  if (headOn && newHit) state.flightSpeedMultiplier *= SCRAPE.HEAD_ON_KEEP;

  // Glance off: while heading into the walls touched (together, the way
  // they push out), the heading swings along them. Still into them after a
  // glance's worth of turning (in a corner, where along one wall is into
  // the other), it turns out of the corner the way they push, all the way.
  if (!turnOut(delta)) {
    if (intoWall) {
      pressing += delta;
      if (pressing > SCRAPE.CORNERED) {
        exitHeading = headingOf(sx, sz);
      } else {
        planeGroup.rotation.y = turnToward(
          heading,
          glanceHeading(heading, sx / away, sz / away, planeGroup.rotation.z),
          SCRAPE.GLANCE_TURN * delta
        );
      }
    } else {
      pressing = Math.max(0, pressing - delta);
    }
  }
  state.flightSpeedMultiplier *= Math.pow(SCRAPE.KEEP_PER_SECOND, delta);
  state.bumpRoll = scrapeRoll(heading, deepest.nx, deepest.nz);

  // Sparks off the touch, flung off the wall and back past the plane
  sparkDebt += (headOn ? HEAD_ON_SPARKS_PER_SECOND : SPARKS_PER_SECOND) * delta;
  const count = Math.floor(sparkDebt);
  sparkDebt -= count;
  const back = forwardOf(heading);
  for (const c of touches) {
    scrapeSparks(
      c.x,
      c.y,
      c.z,
      c.nx,
      c.nz,
      -back.x,
      -back.z,
      speed,
      Math.ceil(count / touches.length)
    );
  }

  if (newHit) {
    propPuffs(deepest.x, deepest.y - 2, deepest.z, 3, 3, DUST, 6, 5, 2);
    smashHaptic(headOn);
    state.impactShake = Math.max(
      state.impactShake || 0,
      headOn ? SHAKE.headOn : SHAKE.graze
    );
  } else {
    state.impactShake = Math.max(state.impactShake || 0, SHAKE.scraping);
  }
  if (newHit || clock - lastRasp > RASP_EVERY) {
    lastRasp = clock;
    playScrape(headOn ? 1 : 0.7, newHit);
  }
  _lastPosition.copy(planeGroup.position);
}
