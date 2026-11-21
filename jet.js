import * as THREE from 'three';
import {createMaterial} from './constants.js';
import {mergeStaticMeshes} from './biplane.js';
import {state} from './state.js';

export function createJetModel(opts = {}) {
  const root = new THREE.Group();

  const planeColor =
    opts.planeColor !== undefined
      ? opts.planeColor
      : typeof state.planeColor !== 'undefined'
        ? state.planeColor
        : 0x4794db;

  // Materials: USAF F-16 two-tone tactical grey scheme + player squadron livery accent
  const upperGreyMat = createMaterial({
    color: 0x76808e, // Gunship / tactical blue-slate upper fuselage & inner wings
    flatShading: true,
    roughness: 0.45,
    metalness: 0.14,
  });

  const lowerGreyMat = createMaterial({
    color: 0xb2bcc8, // Crisp light ghost grey underside, fin fillet & missile/tank noses
    flatShading: true,
    roughness: 0.46,
    metalness: 0.12,
  });

  const radomeMat = createMaterial({
    color: 0x959fa9, // Medium neutral grey radome cone
    flatShading: true,
    roughness: 0.48,
    metalness: 0.08,
  });

  const accentMat =
    opts.planeMat ||
    createMaterial({
      color: planeColor,
      flatShading: true,
      roughness: 0.38,
      metalness: 0.1,
    });

  const darkMetalMat = createMaterial({
    color: 0x22262d,
    flatShading: true,
    roughness: 0.52,
    metalness: 0.36,
  });

  const burnerCoreMat = createMaterial({
    color: 0xff7a38,
    emissive: 0xe64a19,
    emissiveIntensity: 0.7,
    flatShading: true,
  });

  // Signature F-16 gold-bronze ITO tinted bubble canopy
  const canopyMat = createMaterial({
    color: 0x5c4419,
    emissive: 0x291c05,
    emissiveIntensity: 0.36,
    roughness: 0.1,
    metalness: 0.74,
    transparent: true,
    opacity: 0.74,
  });

  const tireMat = createMaterial({
    color: 0x1a1c1e,
    flatShading: true,
    roughness: 0.9,
  });

  const strutMat = createMaterial({
    color: 0xd6dee8,
    flatShading: true,
    roughness: 0.28,
    metalness: 0.52,
  });

  // --- 1. OGIVE RADOME & NEEDLE PITOT PROBE ---
  const noseGroup = new THREE.Group();
  const radomeProfile = [
    [0.0, -13.7],
    [0.25, -12.75],
    [0.52, -11.65],
    [0.76, -10.55],
    [0.93, -9.5],
  ];
  const radomeGeo = new THREE.LatheGeometry(
    radomeProfile.map(([r, z]) => new THREE.Vector2(r, z)),
    12
  );
  radomeGeo.rotateX(Math.PI / 2);
  radomeGeo.scale(1.16, 0.88, 1.0);
  // Slight downward droop of F-16 radome for high over-nose visibility
  const rPos = radomeGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const z = rPos.getZ(i);
    const t = Math.max(0, (-9.5 - z) / 4.2);
    rPos.setY(i, rPos.getY(i) - t * t * 0.16);
  }
  radomeGeo.computeVertexNormals();
  radomeGeo.translate(0, 0.1, 0);
  noseGroup.add(new THREE.Mesh(radomeGeo, radomeMat));

  // Silver pitot probe at tip of radome
  const pitotGeo = new THREE.CylinderGeometry(0.016, 0.044, 1.4, 6);
  pitotGeo.rotateX(Math.PI / 2);
  pitotGeo.translate(0, -0.08, -14.32);
  noseGroup.add(new THREE.Mesh(pitotGeo, strutMat));
  root.add(noseGroup);

  // --- 2. BLENDED WING-BODY FUSELAGE, DORSAL ACCENT SADDLE & TAILBOOM SHELVES ---
  const fuselageGroup = new THREE.Group();
  const upperFuseProfile = [
    [0.93, -9.5],
    [1.14, -7.6],
    [1.24, -5.2],
    [1.26, -1.8],
    [1.22, 2.8],
    [1.1, 7.2],
    [0.88, 10.9],
  ];
  const upperFuseGeo = new THREE.LatheGeometry(
    upperFuseProfile.map(([r, z]) => new THREE.Vector2(r, z)),
    12
  );
  upperFuseGeo.rotateX(Math.PI / 2);
  upperFuseGeo.scale(1.18, 0.82, 1.0);
  const ufPos = upperFuseGeo.attributes.position;
  for (let i = 0; i < ufPos.count; i++) {
    const z = ufPos.getZ(i);
    const y = ufPos.getY(i);
    if (y > 0 && z > -9.2 && z < -2.0) {
      const hump = Math.sin(((z + 9.2) / 7.2) * Math.PI);
      ufPos.setY(i, y + hump * 0.18);
    }
  }
  upperFuseGeo.computeVertexNormals();
  upperFuseGeo.translate(0, 0.14, 0);
  fuselageGroup.add(new THREE.Mesh(upperFuseGeo, upperGreyMat));

  // Flush curved dorsal spine livery stripe behind canopy (-2.1 to +3.0)
  const dorsalSpineProfile = [
    [1.265, -2.1],
    [1.25, 0.4],
    [1.225, 3.0],
  ];
  const dorsalAccentGeo = new THREE.LatheGeometry(
    dorsalSpineProfile.map(([r, z]) => new THREE.Vector2(r, z)),
    8,
    Math.PI - 0.34,
    0.68
  );
  dorsalAccentGeo.rotateX(Math.PI / 2);
  dorsalAccentGeo.scale(1.18, 0.835, 1.0);
  const dsPos = dorsalAccentGeo.attributes.position;
  for (let i = 0; i < dsPos.count; i++) {
    const z = dsPos.getZ(i);
    // Taper width aft to meet the fin-root scoop cleanly
    const t = (z + 2.1) / 5.1;
    dsPos.setX(i, dsPos.getX(i) * (1 - t * 0.42));
  }
  dorsalAccentGeo.computeVertexNormals();
  dorsalAccentGeo.translate(0, 0.145, 0);
  fuselageGroup.add(new THREE.Mesh(dorsalAccentGeo, accentMat));

  // Counter-shaded ghost-grey lower fuselage belly
  const lowerBellyProfile = [
    [0.0, -9.1],
    [0.72, -8.2],
    [0.95, -5.2],
    [1.18, -1.2],
    [1.16, 3.6],
    [1.0, 8.2],
    [0.86, 10.6],
  ];
  const lowerBellyGeo = new THREE.LatheGeometry(
    lowerBellyProfile.map(([r, z]) => new THREE.Vector2(r, z)),
    12
  );
  lowerBellyGeo.rotateX(Math.PI / 2);
  lowerBellyGeo.scale(1.14, 0.72, 1.0);
  lowerBellyGeo.translate(0, -0.22, 0);
  fuselageGroup.add(new THREE.Mesh(lowerBellyGeo, lowerGreyMat));

  // Aft F-16 chined tailboom shelves flanking the single round nozzle
  for (const side of [-1, 1]) {
    const shelfShape = new THREE.Shape();
    shelfShape.moveTo(0, 4.8);
    shelfShape.lineTo(side * 1.68, 5.7);
    shelfShape.lineTo(side * 1.54, 11.4);
    shelfShape.lineTo(side * 0.84, 11.6);
    shelfShape.lineTo(0, 10.6);
    shelfShape.closePath();
    const shelfGeo = new THREE.ExtrudeGeometry(shelfShape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.05,
      bevelThickness: 0.05,
    });
    shelfGeo.rotateX(Math.PI / 2);
    shelfGeo.translate(0, 0.16, 0);
    fuselageGroup.add(new THREE.Mesh(shelfGeo, upperGreyMat));
  }
  root.add(fuselageGroup);

  // --- 3. ICONIC UNDERSLUNG "SMILING" CHIN AIR INTAKE ---
  const intakeGroup = new THREE.Group();
  const intakeProfile = [
    [0.0, -5.4],
    [0.82, -5.4],
    [0.95, -6.85],
    [1.08, -6.72],
    [1.14, -4.6],
    [1.15, -0.4],
    [1.08, 4.2],
    [0.94, 7.8],
    [0.74, 10.4],
    [0.0, 10.6],
  ];
  const intakeGeo = new THREE.LatheGeometry(
    intakeProfile.map(([r, z]) => new THREE.Vector2(r, z)),
    16
  );
  intakeGeo.rotateX(Math.PI / 2);
  intakeGeo.scale(1.04, 0.56, 1.0);
  const inPos = intakeGeo.attributes.position;
  for (let i = 0; i < inPos.count; i++) {
    const x = inPos.getX(i);
    const y = inPos.getY(i);
    const z = inPos.getZ(i);
    if (z < -4.2) {
      const t = Math.min(1, (-4.2 - z) / 2.65);
      inPos.setZ(i, z + Math.max(0, -y) * 0.95 * t);
      if (y > 0.25) {
        inPos.setY(i, 0.25 + (y - 0.25) * 0.45);
      } else {
        inPos.setY(i, y + x * x * 0.065 * t);
      }
    } else if (y > 0) {
      inPos.setY(i, y + 0.26);
    }
  }
  intakeGeo.computeVertexNormals();
  intakeGeo.translate(0, -0.84, 0);
  intakeGroup.add(new THREE.Mesh(intakeGeo, lowerGreyMat));

  const ductPlugGeo = new THREE.CylinderGeometry(0.82, 0.84, 1.15, 14);
  ductPlugGeo.rotateX(Math.PI / 2);
  ductPlugGeo.scale(1.0, 0.48, 1.0);
  ductPlugGeo.translate(0, -0.86, -5.85);
  intakeGroup.add(new THREE.Mesh(ductPlugGeo, darkMetalMat));

  const diverterGeo = new THREE.BoxGeometry(0.82, 0.18, 1.15);
  diverterGeo.translate(0, -0.45, -5.85);
  intakeGroup.add(new THREE.Mesh(diverterGeo, lowerGreyMat));
  root.add(intakeGroup);

  // --- 4. BLENDED FOREBODY CHINES, LIVERY CHINE FLASH & LERX STRAKES ---
  const strakeGroup = new THREE.Group();
  const createLerxGeo = (isRight) => {
    const s = isRight ? 1 : -1;
    // Inner main strake in upper tactical grey
    const innerShape = new THREE.Shape();
    innerShape.moveTo(0, -9.45);
    innerShape.lineTo(s * 0.94, -9.2);
    innerShape.lineTo(s * 1.18, -7.3);
    innerShape.lineTo(s * 1.42, -5.3);
    innerShape.lineTo(s * 1.82, -3.3);
    innerShape.lineTo(s * 2.6, -1.2);
    innerShape.lineTo(0, -1.0);
    innerShape.closePath();
    const innerGeo = new THREE.ExtrudeGeometry(innerShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.035,
      bevelThickness: 0.035,
    });
    innerGeo.rotateX(Math.PI / 2);
    innerGeo.translate(0, 0.24, 0);

    // Flush outer forebody chine trim in player livery accent color (zero overlap!)
    const chineShape = new THREE.Shape();
    chineShape.moveTo(s * 0.98, -9.15);
    chineShape.lineTo(s * 1.1, -9.05);
    chineShape.lineTo(s * 1.38, -7.25);
    chineShape.lineTo(s * 1.65, -5.25);
    chineShape.lineTo(s * 2.04, -3.3);
    chineShape.lineTo(s * 2.58, -1.35);
    chineShape.lineTo(s * 2.44, -1.45);
    chineShape.lineTo(s * 1.87, -3.3);
    chineShape.lineTo(s * 1.47, -5.3);
    chineShape.lineTo(s * 1.22, -7.3);
    chineShape.closePath();
    const chineGeo = new THREE.ExtrudeGeometry(chineShape, {
      depth: 0.13,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.025,
      bevelThickness: 0.025,
    });
    chineGeo.rotateX(Math.PI / 2);
    chineGeo.translate(0, 0.235, 0);

    return {innerGeo, chineGeo};
  };
  for (const isRight of [true, false]) {
    const {innerGeo, chineGeo} = createLerxGeo(isRight);
    strakeGroup.add(new THREE.Mesh(innerGeo, upperGreyMat));
    strakeGroup.add(new THREE.Mesh(chineGeo, accentMat));
  }

  // M61 Vulcan gun port louver on left strake root
  const gunPortGeo = new THREE.BoxGeometry(0.24, 0.14, 0.85);
  gunPortGeo.rotateY(0.12);
  gunPortGeo.translate(-1.32, 0.35, -4.35);
  strakeGroup.add(new THREE.Mesh(gunPortGeo, darkMetalMat));
  root.add(strakeGroup);

  // --- 5. PROUD FRAMELESS GOLD-TINTED BUBBLE CANOPY & COCKPIT ---
  const cockpitGroup = new THREE.Group();
  const coamingGeo = new THREE.BoxGeometry(0.88, 0.36, 1.35);
  coamingGeo.translate(0, 0.94, -7.15);
  cockpitGroup.add(new THREE.Mesh(coamingGeo, darkMetalMat));

  const seatBackGeo = new THREE.BoxGeometry(0.64, 1.05, 0.28);
  seatBackGeo.rotateX(-0.52);
  seatBackGeo.translate(0, 1.02, -5.15);
  cockpitGroup.add(new THREE.Mesh(seatBackGeo, darkMetalMat));

  const headrestGeo = new THREE.BoxGeometry(0.4, 0.34, 0.3);
  headrestGeo.rotateX(-0.35);
  headrestGeo.translate(0, 1.44, -4.85);
  cockpitGroup.add(new THREE.Mesh(headrestGeo, darkMetalMat));

  const helmetGeo = new THREE.SphereGeometry(0.25, 8, 6);
  helmetGeo.translate(0, 1.36, -5.38);
  cockpitGroup.add(new THREE.Mesh(helmetGeo, lowerGreyMat));

  const visorGeo = new THREE.SphereGeometry(
    0.255,
    8,
    5,
    -Math.PI * 0.85,
    Math.PI * 0.7,
    Math.PI * 0.18,
    Math.PI * 0.38
  );
  visorGeo.translate(0, 1.37, -5.4);
  cockpitGroup.add(new THREE.Mesh(visorGeo, darkMetalMat));

  const canopyGeo = new THREE.SphereGeometry(
    1.0,
    16,
    10,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.54
  );
  canopyGeo.scale(0.9, 1.18, 3.45);
  const cPos = canopyGeo.attributes.position;
  for (let i = 0; i < cPos.count; i++) {
    const z = cPos.getZ(i);
    const y = cPos.getY(i);
    if (z > -0.3) {
      const t = (z + 0.3) / 3.75;
      const narrow = 1 - Math.min(0.52, t * 0.52);
      cPos.setX(i, cPos.getX(i) * narrow);
      cPos.setY(i, y * (1 - Math.min(0.42, t * t * 0.45)));
    }
  }
  canopyGeo.computeVertexNormals();
  canopyGeo.translate(0, 0.72, -5.05);
  cockpitGroup.add(new THREE.Mesh(canopyGeo, canopyMat));

  const aftBowGeo = new THREE.TorusGeometry(0.86, 0.045, 6, 12, Math.PI);
  aftBowGeo.rotateX(-0.2);
  aftBowGeo.scale(0.96, 1.18, 1.0);
  aftBowGeo.translate(0, 0.74, -4.15);
  cockpitGroup.add(new THREE.Mesh(aftBowGeo, upperGreyMat));
  root.add(cockpitGroup);

  // --- 6. CROPPED-DELTA WINGS (WITH ANGLED LIVERY WINGTIPS), RAILS & TANKS ---
  const createWingAssembly = (isRight) => {
    const s = isRight ? 1 : -1;
    const wGroup = new THREE.Group();

    // Inner cropped-delta wing section (x = 1.45 to angled seam ~7.62/8.30)
    const innerWingShape = new THREE.Shape();
    innerWingShape.moveTo(s * 1.45, -1.45);
    innerWingShape.lineTo(s * 7.62, 2.5);
    innerWingShape.lineTo(s * 8.3, 5.73);
    innerWingShape.lineTo(s * 1.45, 5.45);
    innerWingShape.closePath();

    const innerWingGeo = new THREE.ExtrudeGeometry(innerWingShape, {
      depth: 0.13,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.03,
      bevelThickness: 0.03,
    });
    innerWingGeo.rotateX(Math.PI / 2);
    innerWingGeo.translate(0, 0.22, 0);
    wGroup.add(new THREE.Mesh(innerWingGeo, upperGreyMat));

    // Outer swept wingtip livery panel in player accent color (clean panel seam, zero overlap!)
    const outerWingShape = new THREE.Shape();
    outerWingShape.moveTo(s * 7.68, 2.54);
    outerWingShape.lineTo(s * 10.05, 4.05);
    outerWingShape.lineTo(s * 10.05, 5.8);
    outerWingShape.lineTo(s * 8.36, 5.73);
    outerWingShape.closePath();

    const outerWingGeo = new THREE.ExtrudeGeometry(outerWingShape, {
      depth: 0.13,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.03,
      bevelThickness: 0.03,
    });
    outerWingGeo.rotateX(Math.PI / 2);
    outerWingGeo.translate(0, 0.22, 0);
    wGroup.add(new THREE.Mesh(outerWingGeo, accentMat));

    // Wingtip LAU-129 launcher rail in accent livery color
    const railX = s * 10.18;
    const railY = 0.16;
    const railGeo = new THREE.BoxGeometry(0.22, 0.22, 3.65);
    railGeo.translate(railX, railY, 4.45);
    wGroup.add(new THREE.Mesh(railGeo, accentMat));

    // Crisp ghost-grey AIM-120 style wingtip missile contrasting against colored rail
    const mX = railX + s * 0.22;
    const mBodyGeo = new THREE.CylinderGeometry(0.095, 0.095, 3.65, 8);
    mBodyGeo.rotateX(Math.PI / 2);
    mBodyGeo.translate(mX, railY, 4.0);
    wGroup.add(new THREE.Mesh(mBodyGeo, lowerGreyMat));

    const mNoseGeo = new THREE.ConeGeometry(0.095, 0.55, 8);
    mNoseGeo.rotateX(-Math.PI / 2);
    mNoseGeo.translate(mX, railY, 1.9);
    wGroup.add(new THREE.Mesh(mNoseGeo, radomeMat));

    for (const fz of [3.35, 5.65]) {
      const finH = new THREE.BoxGeometry(0.44, 0.03, 0.34);
      finH.translate(mX, railY, fz);
      const finV = new THREE.BoxGeometry(0.03, 0.44, 0.34);
      finV.translate(mX, railY, fz);
      wGroup.add(new THREE.Mesh(finH, darkMetalMat));
      wGroup.add(new THREE.Mesh(finV, darkMetalMat));
    }

    // Inboard pylon + forward-jutting 370-gal external fuel tank (grey nose + accent band + dark body)
    const tankX = s * 4.05;
    const pylonGeo = new THREE.BoxGeometry(0.14, 0.42, 2.3);
    const pPos = pylonGeo.attributes.position;
    for (let i = 0; i < pPos.count; i++) {
      if (pPos.getZ(i) < 0 && pPos.getY(i) < 0) {
        pPos.setZ(i, pPos.getZ(i) + 0.35);
      }
    }
    pylonGeo.computeVertexNormals();
    pylonGeo.translate(tankX, -0.14, 1.85);
    wGroup.add(new THREE.Mesh(pylonGeo, upperGreyMat));

    const tankNoseProfile = [
      [0.0, -3.1],
      [0.22, -2.2],
      [0.39, -1.2],
      [0.45, -0.5],
    ];
    const tankNoseGeo = new THREE.LatheGeometry(
      tankNoseProfile.map(([r, z]) => new THREE.Vector2(r, z)),
      10
    );
    tankNoseGeo.rotateX(Math.PI / 2);
    tankNoseGeo.translate(tankX, -0.58, 0);
    wGroup.add(new THREE.Mesh(tankNoseGeo, lowerGreyMat));

    // Livery accent collar band around external tank
    const tankBandGeo = new THREE.CylinderGeometry(0.452, 0.452, 0.44, 10);
    tankBandGeo.rotateX(Math.PI / 2);
    tankBandGeo.translate(tankX, -0.58, -0.28);
    wGroup.add(new THREE.Mesh(tankBandGeo, accentMat));

    const tankAftProfile = [
      [0.45, -0.06],
      [0.45, 2.1],
      [0.33, 3.6],
      [0.12, 4.45],
      [0.0, 4.7],
    ];
    const tankAftGeo = new THREE.LatheGeometry(
      tankAftProfile.map(([r, z]) => new THREE.Vector2(r, z)),
      10
    );
    tankAftGeo.rotateX(Math.PI / 2);
    tankAftGeo.translate(tankX, -0.58, 0);
    wGroup.add(new THREE.Mesh(tankAftGeo, darkMetalMat));

    return wGroup;
  };
  root.add(createWingAssembly(true));
  root.add(createWingAssembly(false));

  // --- 7. FIN-ROOT FILLET, SQUADRON LIVERY VERTICAL TAIL & VENTRAL FINS ---
  const tailGroup = new THREE.Group();

  // Pale-grey F-16 dorsal fin-root avionics/parabrake housing
  const filletShape = new THREE.Shape();
  filletShape.moveTo(2.9, 0.72);
  filletShape.lineTo(3.45, 1.14);
  filletShape.lineTo(5.0, 1.32);
  filletShape.lineTo(11.35, 1.24);
  filletShape.lineTo(11.2, 0.68);
  filletShape.closePath();
  const filletGeo = new THREE.ExtrudeGeometry(filletShape, {
    depth: 0.48,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.07,
    bevelThickness: 0.07,
  });
  filletGeo.translate(0, 0, -0.24);
  filletGeo.rotateY(-Math.PI / 2);
  tailGroup.add(new THREE.Mesh(filletGeo, lowerGreyMat));

  const finScoopGeo = new THREE.BoxGeometry(0.28, 0.2, 0.18);
  finScoopGeo.rotateX(0.45);
  finScoopGeo.translate(0, 1.0, 3.15);
  tailGroup.add(new THREE.Mesh(finScoopGeo, darkMetalMat));

  // Lower diagonal fin-root base wedge in ghost grey
  const vFinBaseShape = new THREE.Shape();
  vFinBaseShape.moveTo(4.75, 1.24);
  vFinBaseShape.lineTo(5.48, 2.08);
  vFinBaseShape.lineTo(10.61, 2.48);
  vFinBaseShape.lineTo(10.7, 1.2);
  vFinBaseShape.closePath();
  const vFinBaseGeo = new THREE.ExtrudeGeometry(vFinBaseShape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.03,
    bevelThickness: 0.03,
  });
  vFinBaseGeo.translate(0, 0, -0.07);
  vFinBaseGeo.rotateY(-Math.PI / 2);
  tailGroup.add(new THREE.Mesh(vFinBaseGeo, lowerGreyMat));

  // Main swept squadron vertical tail panel in player livery accent color!
  const vFinAccentShape = new THREE.Shape();
  vFinAccentShape.moveTo(5.53, 2.14);
  vFinAccentShape.lineTo(8.76, 5.84);
  vFinAccentShape.lineTo(10.22, 5.84);
  vFinAccentShape.lineTo(10.6, 2.54);
  vFinAccentShape.closePath();
  const vFinAccentGeo = new THREE.ExtrudeGeometry(vFinAccentShape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.03,
    bevelThickness: 0.03,
  });
  vFinAccentGeo.translate(0, 0, -0.07);
  vFinAccentGeo.rotateY(-Math.PI / 2);
  tailGroup.add(new THREE.Mesh(vFinAccentGeo, accentMat));

  // Crisp light-grey fin-tip trim stripe + gunship-grey RWR fin cap nib
  const finTrimShape = new THREE.Shape();
  finTrimShape.moveTo(8.8, 5.89);
  finTrimShape.lineTo(8.95, 6.06);
  finTrimShape.lineTo(10.26, 6.06);
  finTrimShape.lineTo(10.22, 5.89);
  finTrimShape.closePath();
  const finTrimGeo = new THREE.ExtrudeGeometry(finTrimShape, {
    depth: 0.15,
    bevelEnabled: false,
    steps: 1,
  });
  finTrimGeo.translate(0, 0, -0.075);
  finTrimGeo.rotateY(-Math.PI / 2);
  tailGroup.add(new THREE.Mesh(finTrimGeo, lowerGreyMat));

  const finCapGeo = new THREE.BoxGeometry(0.18, 0.16, 1.72);
  finCapGeo.translate(0, 6.14, 9.72);
  tailGroup.add(new THREE.Mesh(finCapGeo, upperGreyMat));

  // Twin outward-canted ventral fins in player livery accent color
  for (const side of [-1, 1]) {
    const vfShape = new THREE.Shape();
    vfShape.moveTo(5.9, 0);
    vfShape.lineTo(6.9, -0.95);
    vfShape.lineTo(9.4, -0.95);
    vfShape.lineTo(9.8, 0);
    vfShape.closePath();
    const vfGeo = new THREE.ExtrudeGeometry(vfShape, {
      depth: 0.08,
      bevelEnabled: false,
      steps: 1,
    });
    vfGeo.translate(0, 0, -0.04);
    vfGeo.rotateY(-Math.PI / 2);
    const vfMesh = new THREE.Mesh(vfGeo, accentMat);
    vfMesh.position.set(side * 0.68, -0.56, 0);
    vfMesh.rotation.z = side * 0.26;
    tailGroup.add(vfMesh);
  }
  root.add(tailGroup);

  // --- 8. ALL-MOVING SWEPT HORIZONTAL STABILATORS (WITH ACCENT TIPS) ---
  const createHTail = (isRight) => {
    const s = isRight ? 1 : -1;
    const hGroup = new THREE.Group();

    const innerShape = new THREE.Shape();
    innerShape.moveTo(s * 1.35, 7.25);
    innerShape.lineTo(s * 4.42, 9.46);
    innerShape.lineTo(s * 4.78, 11.72);
    innerShape.lineTo(s * 1.35, 11.15);
    innerShape.closePath();
    const innerGeo = new THREE.ExtrudeGeometry(innerShape, {
      depth: 0.11,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.025,
      bevelThickness: 0.025,
    });
    innerGeo.rotateX(Math.PI / 2);
    hGroup.add(new THREE.Mesh(innerGeo, upperGreyMat));

    const tipShape = new THREE.Shape();
    tipShape.moveTo(s * 4.48, 9.5);
    tipShape.lineTo(s * 5.65, 10.35);
    tipShape.lineTo(s * 5.65, 11.35);
    tipShape.lineTo(s * 4.85, 11.75);
    tipShape.closePath();
    const tipGeo = new THREE.ExtrudeGeometry(tipShape, {
      depth: 0.11,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.025,
      bevelThickness: 0.025,
    });
    tipGeo.rotateX(Math.PI / 2);
    hGroup.add(new THREE.Mesh(tipGeo, accentMat));

    hGroup.position.y = 0.08;
    hGroup.rotation.z = -s * 0.07;
    return hGroup;
  };
  root.add(createHTail(true));
  root.add(createHTail(false));

  // --- 9. SINGLE CONVERGENT "TURKEY FEATHER" EXHAUST NOZZLE ---
  const nozzleGroup = new THREE.Group();
  const nozzleShroudGeo = new THREE.CylinderGeometry(0.84, 0.88, 0.75, 12);
  nozzleShroudGeo.rotateX(Math.PI / 2);
  nozzleShroudGeo.translate(0, 0.02, 10.85);
  nozzleGroup.add(new THREE.Mesh(nozzleShroudGeo, darkMetalMat));

  const petalProfile = [
    [0.54, 11.3],
    [0.58, 11.3],
    [0.68, 12.48],
    [0.74, 12.48],
    [0.85, 11.2],
    [0.54, 11.2],
  ];
  const petalGeo = new THREE.LatheGeometry(
    petalProfile.map(([r, z]) => new THREE.Vector2(r, z)),
    12
  );
  petalGeo.rotateX(Math.PI / 2);
  petalGeo.translate(0, 0.02, 0);
  nozzleGroup.add(new THREE.Mesh(petalGeo, darkMetalMat));

  const burnerGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.25, 12);
  burnerGeo.rotateX(Math.PI / 2);
  burnerGeo.translate(0, 0.02, 11.55);
  nozzleGroup.add(new THREE.Mesh(burnerGeo, burnerCoreMat));
  root.add(nozzleGroup);

  // --- 10. RETRACTABLE F-16 TRICYCLE LANDING GEAR ---
  const gearGroups = [];

  const noseGearGroup = new THREE.Group();
  noseGearGroup.position.set(0, -1.28, -4.3);
  noseGearGroup.userData.retractRotX = Math.PI * 0.48;

  const noseStrutGeo = new THREE.CylinderGeometry(0.075, 0.075, 1.05, 8);
  noseStrutGeo.translate(0, -0.52, 0);
  noseGearGroup.add(new THREE.Mesh(noseStrutGeo, strutMat));

  const noseWheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.2, 12);
  noseWheelGeo.rotateZ(Math.PI / 2);
  noseWheelGeo.translate(0, -1.05, 0);
  noseGearGroup.add(new THREE.Mesh(noseWheelGeo, tireMat));

  root.add(noseGearGroup);
  gearGroups.push(noseGearGroup);

  const createMainGear = (isRight) => {
    const s = isRight ? 1 : -1;
    const mgGroup = new THREE.Group();
    mgGroup.position.set(s * 0.95, -0.78, 0.8);
    mgGroup.userData.retractRotZ = -s * Math.PI * 0.48;

    const strutGeo = new THREE.CylinderGeometry(0.09, 0.085, 1.65, 8);
    strutGeo.rotateZ(s * 0.46);
    strutGeo.translate(s * 0.36, -0.68, 0);
    mgGroup.add(new THREE.Mesh(strutGeo, strutMat));

    const wheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.28, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    wheelGeo.translate(s * 0.9, -1.42, 0);
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
  mergeStaticMeshes(root, new Set(gearGroups));

  return root;
}
