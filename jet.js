// --- JET MODEL ---
// Dependencies: THREE, createMaterial, ChillFlightLogic
// A twin-tailed fighter jet in the spirit of the F/A-18 Hornet (its own
// design, not a copy): a slim fuselage with a leading-edge strake and an
// underslung air intake on each side, a bubble canopy, swept wings, canted
// twin tails, flat stabilators, two exhaust nozzles and fixed wheels. The nose
// points along -z.
import * as THREE from 'three';
import {createMaterial} from './constants.js';
import {state} from './state.js';

export function createJetModel(opts = {}) {
  const root = new THREE.Group();

  const makeMat = (props) => createMaterial(props);

  const planeColor =
    opts.planeColor !== undefined
      ? opts.planeColor
      : typeof state.planeColor !== 'undefined'
        ? state.planeColor
        : 0x4794db;

  // Hornet-grey airframe; the livery colour goes on the tails
  const greyColor = planeColor === 0xe8c382 ? 0x1c3144 : 0xc9cfd8;

  const accentMat =
    opts.planeMat ||
    makeMat({
      color: planeColor,
      flatShading: true,
      roughness: 0.5,
    });

  const bodyMat =
    opts.planeWhiteMat ||
    makeMat({
      color: greyColor,
      flatShading: true,
      roughness: 0.45,
    });

  const darkMat = makeMat({
    color: 0x1a1a1a,
    flatShading: true,
    roughness: 0.8,
  });

  const windowMat = makeMat({
    color: 0x0f172a,
    roughness: 0.1,
    transparent: true,
    opacity: 0.8,
  });

  // Tag materials so debug color switcher can easily identify and recolor them
  accentMat.userData = {type: 'accent'};
  bodyMat.userData = {type: 'body'};

  const add = (geo, mat, x, y, z) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    root.add(mesh);
    return mesh;
  };

  // A flat plate from a 2D outline, thickness centred on y = 0. The outline
  // is [x, -z] pairs (its y runs toward the nose), laid flat in the x-z plane
  const flatPlate = (points, thickness) => {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) shape.lineTo(x, y);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
    });
    geo.translate(0, 0, -thickness / 2);
    geo.rotateX(-Math.PI / 2);
    return geo;
  };

  // Fuselage: a lathe along its own axis, laid along -z so the nose is at the
  // front. Slim at the nose, widest by the wings, tapering to the nozzles
  const fuselageProfile = [
    [0, -17],
    [0.4, -16.4],
    [0.9, -14.5],
    [1.25, -11],
    [1.5, -6],
    [1.55, -1],
    [1.5, 4],
    [1.3, 8.5],
    [0.95, 11.8],
    [0.6, 13.6],
    [0.5, 14.4],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const fuselageGeo = new THREE.LatheGeometry(fuselageProfile, 20);
  fuselageGeo.rotateX(Math.PI / 2);
  add(fuselageGeo, bodyMat, 0, 0, 0);

  // Bubble canopy on the fuselage just behind the nose
  const canopy = add(
    new THREE.SphereGeometry(1, 14, 10),
    windowMat,
    0,
    1.35,
    -8.5
  );
  canopy.scale.set(0.85, 0.6, 2.4);

  for (const side of [1, -1]) {
    // Leading-edge strake: a flat shelf running from the nose to the wing root
    add(
      flatPlate(
        [
          [side * 0.9, 11],
          [side * 1.95, 2],
          [side * 1.9, 0.5],
          [side * 0.9, 0.5],
        ],
        0.3
      ),
      bodyMat,
      0,
      0.25,
      0
    );

    // Underslung air intake along the side, under the strake
    add(new THREE.BoxGeometry(0.7, 1.2, 8.5), darkMat, side * 1.45, -0.5, -4.8);

    // Swept wing, with its outline drawn as [x, -z] pairs
    add(
      flatPlate(
        [
          [0, 2.5],
          [side * 10, -0.5],
          [side * 10, -3.2],
          [0, -5.5],
        ],
        0.35
      ),
      bodyMat,
      0,
      -0.2,
      0
    );

    // Canted twin tails, a tapered plate in the x-z plane rotated upright
    const tailGeo = new THREE.ExtrudeGeometry(
      (() => {
        const shape = new THREE.Shape();
        shape.moveTo(6.4, 1.5);
        shape.lineTo(12.0, 1.5);
        shape.lineTo(11.0, 5.7);
        shape.lineTo(9.2, 5.7);
        shape.closePath();
        return shape;
      })(),
      {depth: 0.35, bevelEnabled: false}
    );
    tailGeo.translate(0, 0, -0.175);
    tailGeo.rotateY(-Math.PI / 2);
    const tail = add(tailGeo, accentMat, side * 1.2, 0, 0);
    tail.rotation.z = -side * 0.3;

    // Flat stabilators out from the tail
    add(
      flatPlate(
        [
          [side * 1, -8.5],
          [side * 5.5, -9.5],
          [side * 5.3, -12.6],
          [side * 1, -13.2],
        ],
        0.22
      ),
      bodyMat,
      0,
      0.3,
      0
    );

    // Exhaust nozzle at the tail, along the fuselage
    const nozzleGeo = new THREE.CylinderGeometry(0.6, 0.5, 1.4, 12);
    nozzleGeo.rotateX(Math.PI / 2);
    add(nozzleGeo, darkMat, side * 0.6, -0.1, 13.6);

    // Main gear: a small wheel on a short leg under each wing
    add(
      new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12).rotateZ(Math.PI / 2),
      darkMat,
      side * 2.2,
      -2.6,
      3.5
    );
    add(new THREE.BoxGeometry(0.3, 1.5, 0.3), darkMat, side * 2.2, -1.9, 3.5);
  }

  // Nose gear, under the fuselage ahead of the intakes
  add(
    new THREE.CylinderGeometry(0.4, 0.4, 0.3, 10).rotateZ(Math.PI / 2),
    darkMat,
    0,
    -2.2,
    -10
  );
  add(new THREE.BoxGeometry(0.2, 0.9, 0.2), darkMat, 0, -1.8, -10);

  return root;
}
