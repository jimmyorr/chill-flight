// --- CONSTANTS ---
// Terrain parameters
const CHUNK_SIZE = 1500;
let SEGMENTS = 40;
const WATER_LEVEL = 40;
const MOUNTAIN_LEVEL = 180;
let RENDER_DISTANCE = 2;

// Custom Map Parameters
const MAP_WORLD_SIZE = 10000 * ChillFlightLogic.SCALE;
const MAP_HEIGHT_SCALE = 400;

// Flight parameters
const BASE_FLIGHT_SPEED = 2.5;
const MAX_AIRPLANE_SPEED_KTS = 500;
const MAX_FLIGHT_SPEED_MULT = MAX_AIRPLANE_SPEED_KTS / (BASE_FLIGHT_SPEED * 60);
window.MAX_AIRPLANE_SPEED_KTS = MAX_AIRPLANE_SPEED_KTS;
window.MAX_FLIGHT_SPEED_MULT = MAX_FLIGHT_SPEED_MULT;
const TURN_SPEED = 0.03;
const MAX_BANK_BOAT = 30 * Math.PI / 180;
const MAX_BANK_HELI = 45 * Math.PI / 180;
// Initial vehicle-aware speed calculation
const savedInitVehicle = localStorage.getItem('chill_flight_vehicle') || 'airplane';
const INITIAL_SPEED = savedInitVehicle === 'helicopter' ? (100 / 150) : (savedInitVehicle === 'boat' ? (25 / 150) : 1);

let flightSpeedMultiplier = INITIAL_SPEED;

// Feature Flags
const ENABLE_PAGODAS = false;
const ENABLE_BARNS = false;
const ENABLE_MONASTERIES = true;
const ENABLE_CASTLE_RUINS = false;
const ENABLE_LIGHTHOUSES = false;
const ENABLE_VEHICLE_SWITCH = false;

const THEME = ChillFlightLogic.THEME;

function createMaterial(params) {
    // Make a copy of params to avoid mutating the original
    const newParams = { ...params };

    switch (THEME) {
        case 'toon':
            delete newParams.roughness;
            delete newParams.metalness;
            delete newParams.envMap;
            delete newParams.envMapIntensity;
            return new THREE.MeshToonMaterial(newParams);

        case 'basic':
            // Flat, unlit colors - completely ignores lighting
            delete newParams.roughness;
            delete newParams.metalness;
            return new THREE.MeshBasicMaterial(newParams);

        case 'phong':
            // Shiny, plastic-like appearance
            delete newParams.roughness;
            delete newParams.metalness;
            newParams.shininess = 60; // Add some specular shine
            return new THREE.MeshPhongMaterial(newParams);

        case 'lambert':
            // Matte, non-shiny surface (often used for retro low-poly)
            delete newParams.roughness;
            delete newParams.metalness;
            return new THREE.MeshLambertMaterial(newParams);

        case 'normal':
            // Psychedelic look based on object normals (ignores color completely)
            return new THREE.MeshNormalMaterial({ flatShading: params.flatShading });

        case 'wireframe':
            // The Matrix or Tron aesthetic - just lines!
            newParams.wireframe = true;
            return new THREE.MeshBasicMaterial(newParams);

        case 'standard':
        default:
            return new THREE.MeshStandardMaterial(params);
    }
}
