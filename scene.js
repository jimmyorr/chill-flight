// --- SCENE ---
// The shared three.js scene. Its own module so model files can add to it
// without pulling in the renderer and sky (e.g. on the model debug page).
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';

export const scene = new THREE.Scene();
// Background will be handled by a Skysphere shader. Density starts at the
// clear-sky value; the game loop then follows the conditions.
scene.fog = new THREE.FogExp2(0xa0d8ef, ChillFlightLogic.FOG.CLEAR);
