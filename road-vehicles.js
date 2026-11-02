// --- ROAD VEHICLES ---
// The cars, vans and trucks the road traffic drives (road-traffic.js):
// Polyfork models (polyfork.dev, free licence; sources unchanged in
// third-party/polyfork), each in its own paint schemes. Each model is
// generated in code, taking 10 to 100 ms, so road-traffic.js builds them a
// few at a time in idle moments and clones the built ones (clones share the
// geometry). Front toward +z, wheels on y = 0, real-world metres.
import * as THREE from 'three';
import {createMaterial} from './constants.js';
import {POLYFORK_SCALE} from './boat-models.js';
import * as compactHatchback from './third-party/polyfork/compact-hatchback-386417.mjs';
import * as deliveryTruck from './third-party/polyfork/delivery-truck-a9537e.mjs';
import * as familyMinivan from './third-party/polyfork/family-minivan-924de0.mjs';
import * as gt3 from './third-party/polyfork/model-of-a-gt3-32b70d.mjs';
import * as hatchback80s from './third-party/polyfork/hatchback-80s-e95554.mjs';
import * as policeCruiser from './third-party/polyfork/police-cruiser-a2d25e.mjs';
import * as popTopCamper from './third-party/polyfork/pop-top-camper-van-62a322.mjs';
import * as skateTourVan from './third-party/polyfork/skate-team-tour-van-fb3c89.mjs';
import * as stationWagon70s from './third-party/polyfork/station-wagon-70s-11d67b.mjs';
import * as townCar from './third-party/polyfork/town-car-56eeb6.mjs';

// How much bigger than real life they're drawn, like every Polyfork model
// (boat-models.js): a 4 m hatchback comes out 14 units long
export const ROAD_VEHICLE_SCALE = POLYFORK_SCALE;

// Each kind, how often it turns up (relative), and its paint schemes
export const ROAD_VEHICLES = [
  {name: 'Compact hatchback', module: compactHatchback, weight: 3},
  {name: 'Town car', module: townCar, weight: 2},
  {name: 'Family minivan', module: familyMinivan, weight: 2},
  {name: 'Delivery truck', module: deliveryTruck, weight: 2},
  {name: 'Hatchback (80s)', module: hatchback80s, weight: 2},
  {name: 'Station wagon (70s)', module: stationWagon70s, weight: 2},
  {name: 'Pop-top camper van', module: popTopCamper, weight: 1.5},
  {name: 'Skate team tour van', module: skateTourVan, weight: 1},
  {name: 'GT3 car', module: gt3, weight: 0.7},
  {name: 'Police cruiser', module: policeCruiser, weight: 0.5},
].map((v) => ({...v, colorways: v.module.params.colorway.options}));

const vehicleMat = createMaterial({vertexColors: true, flatShading: true});

// Builds one vehicle in one paint scheme: a group (front toward +z) with
// `wheels` (spin about x) and `steers` (turn about y), and its size
export function buildRoadVehicle(kind, colorway) {
  const asset = kind.module.createAsset({colorway});
  const wheels = [];
  const steers = [];
  asset.traverse((o) => {
    if (o.isMesh) {
      o.material = vehicleMat;
      o.castShadow = true;
    }
    if (/^wheel-(fl|fr|rl|rr)$/.test(o.name)) wheels.push(o.name);
    if (/^steer-(fl|fr)$/.test(o.name)) steers.push(o.name);
  });
  const box = new THREE.Box3().setFromObject(asset);
  return {asset, wheels, steers, box, kind, colorway};
}

// A copy of a built vehicle to drive (shares its geometry), with its wheel
// and steering groups found again in the copy
export function cloneRoadVehicle(built) {
  const model = built.asset.clone();
  model.wheels = built.wheels.map((n) => model.getObjectByName(n));
  model.steerPivots = built.steers.map((n) => model.getObjectByName(n));
  return model;
}
