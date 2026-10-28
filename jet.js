import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createMaterial} from './constants.js';
import {state} from './state.js';

export function createJetModel(opts = {}) {
  const root = new THREE.Group();

  const planeColor =
    opts.planeColor !== undefined
      ? opts.planeColor
      : typeof state.planeColor !== 'undefined'
        ? state.planeColor
        : 0x4794db;

  // Materials
  const bodyMat = createMaterial({
    color: 0xd4d9e0, // Crisp air-superiority light grey
    flatShading: true,
    roughness: 0.42,
    metalness: 0.12,
  });

  const bellyMat = createMaterial({
    color: 0xbac2cc, // Slightly cooler underside/nacelle grey
    flatShading: true,
    roughness: 0.48,
    metalness: 0.12,
  });

  const accentMat =
    opts.planeMat ||
    createMaterial({
      color: planeColor,
      flatShading: true,
      roughness: 0.4,
      metalness: 0.1,
    });

  const darkMetalMat = createMaterial({
    color: 0x22252a,
    flatShading: true,
    roughness: 0.55,
    metalness: 0.35,
  });

  const radomeMat = createMaterial({
    color: 0x2f343c,
    flatShading: true,
    roughness: 0.5,
  });

  const burnerCoreMat = createMaterial({
    color: 0xff7043,
    emissive: 0xd84315,
    emissiveIntensity: 0.45,
    flatShading: true,
  });

  const glassMat = createMaterial({
    color: 0x101824,
    roughness: 0.1,
    metalness: 0.85,
    transparent: true,
    opacity: 0.86,
  });

  const tireMat = createMaterial({
    color: 0x1a1a1a,
    flatShading: true,
    roughness: 0.9,
  });

  const strutMat = createMaterial({
    color: 0xcbd5e1,
    flatShading: true,
    roughness: 0.3,
    metalness: 0.5,
  });

  // --- 1. FORWARD & CENTRAL FUSELAGE + RADOME + TWIN ENGINE NACELLES ---
  // Radome nose cone (-14.2 to -10.8)
  const radomeProfile = [
    [0.0, -14.2],
    [0.28, -13.2],
    [0.62, -12.0],
    [0.92, -10.8],
  ];
  const radomeLathe = new THREE.LatheGeometry(
    radomeProfile.map(([r, z]) => new THREE.Vector2(r, z)),
    10
  );
  radomeLathe.rotateX(Math.PI / 2);
  radomeLathe.scale(1.12, 0.88, 1.0);
  // Pitot probe at tip of nose
  const pitotGeo = new THREE.CylinderGeometry(0.025, 0.04, 0.85, 6);
  pitotGeo.rotateX(Math.PI / 2);
  pitotGeo.translate(0, -0.05, -14.55);
  const radomeMesh = new THREE.Mesh(
    mergeGeometries([radomeLathe, pitotGeo]),
    radomeMat
  );
  radomeMesh.position.y = 0.05;
  root.add(radomeMesh);

  // Main fuselage spine (-10.8 to +10.8)
  const fuselageProfile = [
    [0.92, -10.8],
    [1.18, -8.5],
    [1.34, -5.5], // Cockpit widest section
    [1.36, -1.5],
    [1.26, 3.5],
    [1.05, 7.8],
    [0.62, 10.8],
    [0.18, 11.6], // Central tail boom stinger between nozzles
  ];
  const fuselageLathe = new THREE.LatheGeometry(
    fuselageProfile.map(([r, z]) => new THREE.Vector2(r, z)),
    12
  );
  fuselageLathe.rotateX(Math.PI / 2);
  fuselageLathe.scale(1.12, 0.88, 1.0);
  const fuselageMesh = new THREE.Mesh(fuselageLathe, bodyMat);
  fuselageMesh.position.y = 0.05;
  root.add(fuselageMesh);

  // Twin rear engine nacelle tunnels (-2.5 to +10.6) blending into the twin nozzles
  const nacelleParts = [];
  for (const side of [-1, 1]) {
    const nacGeo = new THREE.CylinderGeometry(0.64, 0.76, 13.0, 10);
    nacGeo.rotateX(Math.PI / 2);
    nacGeo.scale(1.05, 0.88, 1.0);
    nacGeo.translate(side * 0.72, -0.04, 4.1);
    nacelleParts.push(nacGeo);
  }
  // Wide flattened upper deck fairing spanning across the twin engine tunnels
  const aftDeckGeo = new THREE.BoxGeometry(2.55, 0.65, 11.2);
  aftDeckGeo.translate(0, 0.32, 4.2);
  nacelleParts.push(aftDeckGeo);
  root.add(new THREE.Mesh(mergeGeometries(nacelleParts), bellyMat));

  // Dorsal spine & livery accent cheatlines
  const spineAccents = [];
  // Dorsal spine fairing behind canopy (-2.4 to +8.6)
  const spineGeo = new THREE.CylinderGeometry(0.44, 0.22, 11.0, 8);
  spineGeo.rotateX(Math.PI / 2);
  spineGeo.scale(0.95, 0.65, 1.0);
  spineGeo.translate(0, 1.02, 3.1);
  spineAccents.push(spineGeo);
  // Forward nose/cockpit side cheatlines (-10.8 to -4.2)
  for (const side of [-1, 1]) {
    const stripeGeo = new THREE.BoxGeometry(0.14, 0.22, 6.6);
    stripeGeo.rotateY(side * -0.07);
    stripeGeo.translate(side * 1.22, 0.22, -7.4);
    spineAccents.push(stripeGeo);
  }
  root.add(new THREE.Mesh(mergeGeometries(spineAccents), accentMat));

  // --- 2. COCKPIT INTERIOR, EJECTION SEAT & FRAMED BUBBLE CANOPY ---
  const cockpitGroup = new THREE.Group();
  // Instrument glare-shield / HUD coaming + ejection seat headrest
  const coamingGeo = new THREE.BoxGeometry(1.05, 0.38, 1.3);
  coamingGeo.translate(0, 0.82, -7.35);
  const seatBackGeo = new THREE.BoxGeometry(0.72, 0.95, 0.32);
  seatBackGeo.rotateX(-0.22);
  seatBackGeo.translate(0, 0.85, -5.35);
  const headrestGeo = new THREE.BoxGeometry(0.5, 0.34, 0.34);
  headrestGeo.translate(0, 1.24, -5.22);
  cockpitGroup.add(
    new THREE.Mesh(
      mergeGeometries([coamingGeo, seatBackGeo, headrestGeo]),
      darkMetalMat
    )
  );

  // Bubble canopy glass (-9.2 to -2.4)
  const canopyGeo = new THREE.SphereGeometry(
    1.0,
    12,
    8,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.52
  );
  canopyGeo.scale(0.98, 0.96, 3.4);
  const canopyMesh = new THREE.Mesh(canopyGeo, glassMat);
  canopyMesh.position.set(0, 0.66, -5.85);
  cockpitGroup.add(canopyMesh);

  // Canopy sill frame & windshield bow arch
  const sillGeo = new THREE.TorusGeometry(0.98, 0.07, 6, 16);
  sillGeo.rotateX(Math.PI / 2);
  sillGeo.scale(1.0, 3.42, 0.7);
  sillGeo.translate(0, 0.68, -5.85);
  const archGeo = new THREE.TorusGeometry(0.86, 0.06, 6, 10, Math.PI);
  archGeo.rotateY(Math.PI);
  archGeo.rotateX(0.35);
  archGeo.translate(0, 0.72, -7.05);
  cockpitGroup.add(
    new THREE.Mesh(mergeGeometries([sillGeo, archGeo]), bodyMat)
  );
  root.add(cockpitGroup);

  // --- 3. LERX STRAKES & RAKED SIDE AIR INTAKES ---
  // Leading-edge root extensions (LERX) blending the forebody into the main wings
  const createLerxGeo = (isRight) => {
    const sign = isRight ? 1 : -1;
    const lerxShape = new THREE.Shape();
    lerxShape.moveTo(0, -2.5); // Forward strake root (z = -7.5)
    lerxShape.lineTo(sign * 1.15, 0.2); // Outer strake chine (z = -4.8)
    lerxShape.lineTo(sign * 1.85, 3.4); // Joins main wing root (z = -1.6)
    lerxShape.lineTo(0, 3.4);
    lerxShape.closePath();
    const geo = new THREE.ExtrudeGeometry(lerxShape, {
      depth: 0.16,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.04,
    });
    geo.rotateX(Math.PI / 2);
    geo.translate(sign * 0.95, 0.26, -5.0);
    return geo;
  };
  root.add(
    new THREE.Mesh(
      mergeGeometries([createLerxGeo(true), createLerxGeo(false)]),
      bodyMat
    )
  );

  // Raked side air intakes under the LERX strakes
  const intakeOuter = [];
  const intakeMouths = [];
  for (const side of [-1, 1]) {
    // Sculpted intake trunk with raked front lip
    const trunkGeo = new THREE.BoxGeometry(0.82, 1.08, 8.2);
    const pos = trunkGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      const y = pos.getY(i);
      // Rake the front intake face (-4.1) backward at the bottom
      if (z < 0 && y < 0) pos.setZ(i, z + 0.65);
      // Taper aft end into the engine nacelle
      if (z > 0) pos.setX(i, pos.getX(i) * 0.85);
    }
    trunkGeo.computeVertexNormals();
    trunkGeo.translate(side * 1.42, -0.22, 0.2);
    intakeOuter.push(trunkGeo);

    // Dark recessed inlet mouth opening at the front of the intake
    const mouthGeo = new THREE.BoxGeometry(0.66, 0.88, 0.45);
    mouthGeo.rotateX(0.28);
    mouthGeo.translate(side * 1.42, -0.22, -3.72);
    intakeMouths.push(mouthGeo);
  }
  root.add(new THREE.Mesh(mergeGeometries(intakeOuter), bellyMat));
  root.add(new THREE.Mesh(mergeGeometries(intakeMouths), darkMetalMat));

  // --- 4. SWEPT MAIN WINGS & WINGTIP MISSILE RAILS ---
  const createWingGeo = (isRight) => {
    const sign = isRight ? 1 : -1;
    const shape = new THREE.Shape();
    const rootChord = 6.4;
    const tipChord = 1.95;
    const span = 12.2;
    const sweep = 4.1;

    shape.moveTo(0, 0);
    shape.lineTo(sign * span, sweep);
    shape.lineTo(sign * span, sweep + tipChord);
    shape.lineTo(0, rootChord);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.2,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.05,
      bevelThickness: 0.05,
    });
    geo.rotateX(Math.PI / 2);
    return geo;
  };

  const wingR = new THREE.Mesh(createWingGeo(true), bodyMat);
  wingR.position.set(1.35, 0.14, -1.6);
  root.add(wingR);

  const wingL = new THREE.Mesh(createWingGeo(false), bodyMat);
  wingL.position.set(-1.35, 0.14, -1.6);
  root.add(wingL);

  // Wingtip missile launcher rails + accent wing stripes
  const railAccents = [];
  const railTips = [];
  for (const side of [-1, 1]) {
    const railX = side * 13.65;
    const railY = 0.06;
    const railZ = 3.45;
    // Launcher rail bar in livery accent color
    const railGeo = new THREE.BoxGeometry(0.24, 0.28, 3.8);
    railGeo.translate(railX, railY, railZ);
    railAccents.push(railGeo);

    // Sleek wingtip air-to-air missile body on the rail
    const missileBody = new THREE.CylinderGeometry(0.11, 0.11, 3.4, 8);
    missileBody.rotateX(Math.PI / 2);
    missileBody.translate(railX + side * 0.14, railY, railZ - 0.2);
    railAccents.push(missileBody);

    // Dark seeker nose cone & fins on the wingtip rail
    const seekerCone = new THREE.ConeGeometry(0.11, 0.45, 8);
    seekerCone.rotateX(-Math.PI / 2);
    seekerCone.translate(railX + side * 0.14, railY, railZ - 2.12);
    railTips.push(seekerCone);
  }
  root.add(new THREE.Mesh(mergeGeometries(railAccents), accentMat));
  root.add(new THREE.Mesh(mergeGeometries(railTips), darkMetalMat));

  // --- 5. TWIN CANTED VERTICAL STABILIZERS & HORIZONTAL STABILATORS ---
  const createVTailGeo = () => {
    const shape = new THREE.Shape();
    const rootChord = 4.2;
    const tipChord = 1.65;
    const height = 3.95;
    const sweep = 2.45;

    shape.moveTo(0, 0);
    shape.lineTo(sweep, height);
    shape.lineTo(sweep + tipChord, height);
    shape.lineTo(rootChord, 0);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.15,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.04,
    });
    geo.translate(0, 0, -0.075);
    geo.rotateY(-Math.PI / 2);
    return geo;
  };

  const vTailGeo = createVTailGeo();
  // Fin cap flash at top of each vertical tail
  const finCapGeo = new THREE.BoxGeometry(0.2, 0.28, 1.72);
  finCapGeo.translate(0, 3.92, 3.28);

  const vTailR = new THREE.Group();
  vTailR.add(new THREE.Mesh(vTailGeo, accentMat));
  vTailR.add(new THREE.Mesh(finCapGeo, bodyMat));
  vTailR.position.set(1.22, 0.52, 5.4);
  vTailR.rotation.z = -0.28; // Outward cant
  root.add(vTailR);

  const vTailL = new THREE.Group();
  vTailL.add(new THREE.Mesh(vTailGeo, accentMat));
  vTailL.add(new THREE.Mesh(finCapGeo, bodyMat));
  vTailL.position.set(-1.22, 0.52, 5.4);
  vTailL.rotation.z = 0.28; // Outward cant
  root.add(vTailL);

  // Horizontal stabilators (all-moving tailplanes)
  const createHTailGeo = (isRight) => {
    const sign = isRight ? 1 : -1;
    const shape = new THREE.Shape();
    const rootChord = 3.2;
    const tipChord = 1.15;
    const span = 4.4;
    const sweep = 2.1;

    shape.moveTo(0, 0);
    shape.lineTo(sign * span, sweep);
    shape.lineTo(sign * span, sweep + tipChord);
    shape.lineTo(0, rootChord);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.03,
      bevelThickness: 0.03,
    });
    geo.rotateX(Math.PI / 2);
    return geo;
  };

  const hTailR = new THREE.Mesh(createHTailGeo(true), bodyMat);
  hTailR.position.set(1.38, -0.02, 7.2);
  root.add(hTailR);

  const hTailL = new THREE.Mesh(createHTailGeo(false), bodyMat);
  hTailL.position.set(-1.38, -0.02, 7.2);
  root.add(hTailL);

  // --- 6. ARTICULATED TWIN AFTERBURNER EXHAUST NOZZLES ---
  const nozzleOuter = [];
  const nozzleGlow = [];
  for (const side of [-1, 1]) {
    const nx = side * 0.72;
    const ny = -0.04;
    // Outer shroud ring + turkey-feather convergent petal cone
    const collarGeo = new THREE.CylinderGeometry(0.64, 0.66, 0.55, 10);
    collarGeo.rotateX(Math.PI / 2);
    collarGeo.translate(nx, ny, 10.65);
    const petalGeo = new THREE.CylinderGeometry(0.5, 0.64, 1.15, 10);
    petalGeo.rotateX(Math.PI / 2);
    petalGeo.translate(nx, ny, 11.45);
    nozzleOuter.push(collarGeo, petalGeo);

    // Inner glowing afterburner flame holder ring
    const coreGeo = new THREE.CylinderGeometry(0.38, 0.44, 0.35, 10);
    coreGeo.rotateX(Math.PI / 2);
    coreGeo.translate(nx, ny, 11.78);
    nozzleGlow.push(coreGeo);
  }
  root.add(new THREE.Mesh(mergeGeometries(nozzleOuter), darkMetalMat));
  root.add(new THREE.Mesh(mergeGeometries(nozzleGlow), burnerCoreMat));

  // --- 7. RETRACTABLE LANDING GEAR ---
  const gearGroups = [];

  // Nose gear
  const noseGearGroup = new THREE.Group();
  noseGearGroup.position.set(0, -0.8, -8.5);
  noseGearGroup.userData.retractRotX = -Math.PI * 0.48;

  const noseStrutGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8);
  noseStrutGeo.translate(0, -0.7, 0);
  noseGearGroup.add(new THREE.Mesh(noseStrutGeo, strutMat));

  const noseWheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.2, 12);
  noseWheelGeo.rotateZ(Math.PI / 2);
  noseWheelGeo.translate(0, -1.4, 0);
  noseGearGroup.add(new THREE.Mesh(noseWheelGeo, tireMat));

  root.add(noseGearGroup);
  gearGroups.push(noseGearGroup);

  // Main gear helper
  const createMainGear = (isRight) => {
    const sign = isRight ? 1 : -1;
    const mgGroup = new THREE.Group();
    mgGroup.position.set(sign * 1.4, -0.6, 1.0);
    mgGroup.userData.retractRotZ = -sign * Math.PI * 0.48;

    const strutGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.6, 8);
    strutGeo.translate(0, -0.8, 0);
    mgGroup.add(new THREE.Mesh(strutGeo, strutMat));

    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    wheelGeo.translate(sign * 0.2, -1.6, 0);
    mgGroup.add(new THREE.Mesh(wheelGeo, tireMat));

    return mgGroup;
  };

  const mainGearR = createMainGear(true);
  root.add(mainGearR);
  gearGroups.push(mainGearR);

  const mainGearL = createMainGear(false);
  root.add(mainGearL);
  gearGroups.push(mainGearL);

  root.gearGroups = gearGroups;

  return root;
}
