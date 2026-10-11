// --- OTHER PLANES' MODELS ---
// The game's plane models as other planes wear them, in any livery: the
// traffic flying around (traffic.js) and the planes parked at the airports
// (airports.js).
import {ChillFlightLogic} from './chill-flight-logic.js';
import {createMaterial} from './constants.js';
import {createBiplaneModel} from './biplane.js';
import {createGliderModel} from './glider.js';
import {createTwinModel} from './twin.js';
import {createClassicAirplaneModel} from './airplane.js';

// The classic flies without the player's pontoons, so it has no landing gear
export const PLANE_BUILDERS = {
  classic: (opts) => createClassicAirplaneModel({...opts, pontoons: false}),
  biplane: createBiplaneModel,
  twin: createTwinModel,
  glider: createGliderModel,
};

// One pair of materials per livery, shared by every plane wearing it (the
// light trim is dark on sand, as on the player's plane)
const liveryMats = new Map();
function materialsFor(livery) {
  if (!liveryMats.has(livery)) {
    const color = ChillFlightLogic.PLANE_COLORS[livery];
    liveryMats.set(livery, {
      planeMat: createMaterial({color, flatShading: true}),
      planeWhiteMat: createMaterial({
        color: color === 0xe8c382 ? 0x1c3144 : 0xffffff,
        flatShading: true,
      }),
    });
  }
  return liveryMats.get(livery);
}

// A plane of the given type (a PLANE_BUILDERS key) in livery number `livery`
// (ChillFlightLogic.PLANE_COLORS), casting shadows
export function buildPlaneModel(type, livery) {
  const model = PLANE_BUILDERS[type]({
    planeColor: ChillFlightLogic.PLANE_COLORS[livery],
    ...materialsFor(livery),
  });
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = false;
    }
  });
  return model;
}

// Whether a material is one of the shared livery materials (not to be
// disposed with a plane)
export function isLiveryMaterial(material) {
  for (const m of liveryMats.values()) {
    if (m.planeMat === material || m.planeWhiteMat === material) return true;
  }
  return false;
}
