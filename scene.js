// --- SCENE ---
// The shared three.js scene. Its own module so model files can add to it
// without pulling in the renderer and sky (e.g. on the model debug page).
import * as THREE from 'three';

export const scene = new THREE.Scene();
// Background will be handled by a Skysphere shader
scene.fog = new THREE.FogExp2(0xa0d8ef, 0.00015);

// Bridge for classic scripts that haven't been converted to ES modules yet.
window.scene = scene;
