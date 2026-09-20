// --- BIPLANE MODEL ---
// Dependencies: THREE, createMaterial (or fallback), ChillFlightLogic
// Vintage sport & aerobatic biplane with dual staggered wings, N-struts,
// cabane struts, open cockpit with windscreen, and streamlined wheel pants.

function createBiplaneModel(opts = {}) {
  const root = new THREE.Group();

  const makeMat = (props) => {
    if (typeof createMaterial === 'function') {
      return createMaterial(props);
    }
    return new THREE.MeshStandardMaterial(props);
  };

  const planeColor =
    opts.planeColor !== undefined
      ? opts.planeColor
      : typeof window.planeColor !== 'undefined'
        ? window.planeColor
        : 0x4794db;

  const whiteColor = planeColor === 0xe8c382 ? 0x1c3144 : 0xffffff;

  const accentMat = makeMat({
    color: planeColor,
    flatShading: true,
    roughness: 0.5,
  });

  const bodyMat = makeMat({
    color: whiteColor,
    flatShading: true,
    roughness: 0.5,
  });

  const strutMat = makeMat({
    color: 0x2b2b2b,
    flatShading: true,
    roughness: 0.6,
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

  // 1. Fuselage - Main Body (vintage streamlined tapered oval)
  const bodyGeo = new THREE.CylinderGeometry(0.7, 1.8, 12.5, 8);
  bodyGeo.rotateX(Math.PI / 2);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.set(0, 0, -1.2);
  bodyMesh.scale.set(1.05, 1.28, 1);
  root.add(bodyMesh);

  // 2. Engine Cowling (front cylinder tapering slightly to nose)
  const cowlGeo = new THREE.CylinderGeometry(1.8, 1.35, 2.6, 8);
  cowlGeo.rotateX(Math.PI / 2);
  const cowlMesh = new THREE.Mesh(cowlGeo, bodyMat);
  cowlMesh.position.set(0, 0, -8.7);
  cowlMesh.scale.set(1.05, 1.28, 1);
  root.add(cowlMesh);

  // Cowl front plate / radiator intake
  const cowlPlateGeo = new THREE.CylinderGeometry(1.3, 1.3, 0.3, 8);
  cowlPlateGeo.rotateX(Math.PI / 2);
  const cowlPlateMesh = new THREE.Mesh(cowlPlateGeo, darkMat);
  cowlPlateMesh.position.set(0, 0, -10.05);
  cowlPlateMesh.scale.set(1.02, 1.25, 1);
  root.add(cowlPlateMesh);

  // Spinner cone
  const spinnerGeo = new THREE.ConeGeometry(0.65, 1.6, 8);
  spinnerGeo.rotateX(-Math.PI / 2);
  const spinnerMesh = new THREE.Mesh(spinnerGeo, accentMat);
  spinnerMesh.position.set(0, -0.1, -10.9);
  root.add(spinnerMesh);

  // Propeller blades (2-blade vintage prop)
  const propGroup = new THREE.Group();
  propGroup.position.set(0, -0.1, -10.3);
  root.add(propGroup);

  const bladeGeo = new THREE.BoxGeometry(8.6, 0.7, 0.12);
  const blade1 = new THREE.Mesh(bladeGeo, darkMat);
  propGroup.add(blade1);

  // 3. Fuselage Side Accent Stripes
  const stripeGeo = new THREE.BoxGeometry(2.18, 0.35, 10.5);
  const stripeMesh = new THREE.Mesh(stripeGeo, accentMat);
  stripeMesh.position.set(0, 0.15, -1.8);
  root.add(stripeMesh);

  // 4. Open-Air Cockpit
  // Cockpit rim / coaming padding
  const coamingGeo = new THREE.BoxGeometry(1.9, 0.25, 2.8);
  const coamingMesh = new THREE.Mesh(coamingGeo, darkMat);
  coamingMesh.position.set(0, 1.48, -3.2);
  root.add(coamingMesh);

  // Cockpit interior cutout well
  const cockpitWellGeo = new THREE.BoxGeometry(1.5, 1.2, 2.4);
  const cockpitWellMesh = new THREE.Mesh(cockpitWellGeo, darkMat);
  cockpitWellMesh.position.set(0, 0.9, -3.2);
  root.add(cockpitWellMesh);

  // Headrest cushion (centered directly behind cockpit rim)
  const headrestGeo = new THREE.BoxGeometry(0.7, 0.5, 0.35);
  const headrestMesh = new THREE.Mesh(headrestGeo, darkMat);
  headrestMesh.position.set(0, 1.65, -1.95);
  root.add(headrestMesh);

  // Windscreen (small faceted vintage aero screen)
  const windscreenGeo = new THREE.BoxGeometry(1.7, 0.85, 0.12);
  const windscreenMesh = new THREE.Mesh(windscreenGeo, windowMat);
  windscreenMesh.position.set(0, 1.85, -4.7);
  windscreenMesh.rotation.x = Math.PI / 6;
  root.add(windscreenMesh);

  // Helper for aerodynamic wingtips and tailplane tips with subtle corner radiuses
  const createRoundedTipGeo = (tipSpan, chord, thickness, cornerRadius) => {
    const shape = new THREE.Shape();
    const halfChord = chord / 2;
    const r = Math.min(cornerRadius || tipSpan * 0.75, halfChord * 0.65);

    // Start at leading edge root (tangent parallel to leading edge)
    shape.moveTo(0, -halfChord);

    // Gentle rounded leading corner
    shape.quadraticCurveTo(tipSpan, -halfChord, tipSpan, -halfChord + r);

    // Sleek outer tip edge with very subtle crown
    shape.quadraticCurveTo(tipSpan * 1.04, 0, tipSpan, halfChord - r);

    // Gentle rounded trailing corner (tangent parallel to trailing edge)
    shape.quadraticCurveTo(tipSpan, halfChord, 0, halfChord);

    // Close along root
    shape.lineTo(0, -halfChord);

    const extrudeSettings = {
      depth: thickness,
      bevelEnabled: false,
      curveSegments: 8,
    };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.translate(0, 0, -thickness / 2);
    geo.rotateX(Math.PI / 2);
    return geo;
  };

  // 5. Upper Wing (Elevated with positive stagger, trailing edge center cutout, and subtle rounded tips)
  const upperWingY = 2.85;
  const upperWingZ = -4.0;
  const upperWingThickness = 0.42;
  const upperChord = 4.4;

  // Upper wing left panel
  const upperWingLGeo = new THREE.BoxGeometry(
    10.5,
    upperWingThickness,
    upperChord
  );
  const upperWingL = new THREE.Mesh(upperWingLGeo, bodyMat);
  upperWingL.position.set(-7.75, upperWingY, upperWingZ);
  root.add(upperWingL);

  // Upper wing right panel
  const upperWingR = new THREE.Mesh(upperWingLGeo, bodyMat);
  upperWingR.position.set(7.75, upperWingY, upperWingZ);
  root.add(upperWingR);

  // Upper wing center leading bridge (leaves cockpit trailing edge cut out)
  const upperCenterGeo = new THREE.BoxGeometry(5.0, upperWingThickness, 2.2);
  const upperCenterMesh = new THREE.Mesh(upperCenterGeo, bodyMat);
  upperCenterMesh.position.set(0, upperWingY, upperWingZ - 1.1);
  root.add(upperCenterMesh);

  // Upper wingtips (Accent color, subtle vintage rounded corners)
  const upperTipSpan = 1.5;
  const upperTipGeo = createRoundedTipGeo(
    upperTipSpan,
    upperChord,
    upperWingThickness,
    1.1
  );

  const upperTipR = new THREE.Mesh(upperTipGeo, accentMat);
  upperTipR.position.set(13.0, upperWingY, upperWingZ);
  root.add(upperTipR);

  const upperTipL = new THREE.Mesh(upperTipGeo, accentMat);
  upperTipL.position.set(-13.0, upperWingY, upperWingZ);
  upperTipL.rotation.y = Math.PI;
  root.add(upperTipL);

  // 6. Lower Wing (Mounted low on fuselage, slightly shorter span, subtle rounded tips)
  const lowerWingY = -0.7;
  const lowerWingZ = -3.0;
  const lowerWingThickness = 0.42;
  const lowerChord = 3.9;

  // Lower wing main panel
  const lowerMainGeo = new THREE.BoxGeometry(
    18.0,
    lowerWingThickness,
    lowerChord
  );
  const lowerMainMesh = new THREE.Mesh(lowerMainGeo, bodyMat);
  lowerMainMesh.position.set(0, lowerWingY, lowerWingZ);
  root.add(lowerMainMesh);

  // Lower wingtips (Accent color, subtle vintage rounded corners)
  const lowerTipSpan = 1.3;
  const lowerTipGeo = createRoundedTipGeo(
    lowerTipSpan,
    lowerChord,
    lowerWingThickness,
    1.0
  );

  const lowerTipR = new THREE.Mesh(lowerTipGeo, accentMat);
  lowerTipR.position.set(9.0, lowerWingY, lowerWingZ);
  root.add(lowerTipR);

  const lowerTipL = new THREE.Mesh(lowerTipGeo, accentMat);
  lowerTipL.position.set(-9.0, lowerWingY, lowerWingZ);
  lowerTipL.rotation.y = Math.PI;
  root.add(lowerTipL);

  // 7. Interplane N-Struts (Connecting upper and lower wings)
  const createNStrutGroup = (xSign) => {
    const nGroup = new THREE.Group();
    const strutRadius = 0.1;
    const xPos = xSign * 8.6;

    // Front vertical/slanted strut
    const frontP1 = new THREE.Vector3(xPos, lowerWingY, lowerWingZ - 1.4);
    const frontP2 = new THREE.Vector3(xPos, upperWingY, upperWingZ - 1.6);
    const frontLen = frontP1.distanceTo(frontP2);
    const frontGeo = new THREE.CylinderGeometry(
      strutRadius,
      strutRadius,
      frontLen,
      6
    );
    const frontMesh = new THREE.Mesh(frontGeo, strutMat);
    const frontMid = new THREE.Vector3()
      .addVectors(frontP1, frontP2)
      .multiplyScalar(0.5);
    frontMesh.position.copy(frontMid);
    frontMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3().subVectors(frontP2, frontP1).normalize()
    );
    nGroup.add(frontMesh);

    // Rear vertical/slanted strut
    const rearP1 = new THREE.Vector3(xPos, lowerWingY, lowerWingZ + 1.4);
    const rearP2 = new THREE.Vector3(xPos, upperWingY, upperWingZ + 1.6);
    const rearLen = rearP1.distanceTo(rearP2);
    const rearGeo = new THREE.CylinderGeometry(
      strutRadius,
      strutRadius,
      rearLen,
      6
    );
    const rearMesh = new THREE.Mesh(rearGeo, strutMat);
    const rearMid = new THREE.Vector3()
      .addVectors(rearP1, rearP2)
      .multiplyScalar(0.5);
    rearMesh.position.copy(rearMid);
    rearMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3().subVectors(rearP2, rearP1).normalize()
    );
    nGroup.add(rearMesh);

    // Diagonal N strut (top-front to bottom-rear)
    const diagP1 = new THREE.Vector3(xPos, lowerWingY, lowerWingZ + 1.4);
    const diagP2 = new THREE.Vector3(xPos, upperWingY, upperWingZ - 1.6);
    const diagLen = diagP1.distanceTo(diagP2);
    const diagGeo = new THREE.CylinderGeometry(
      strutRadius * 0.9,
      strutRadius * 0.9,
      diagLen,
      6
    );
    const diagMesh = new THREE.Mesh(diagGeo, strutMat);
    const diagMid = new THREE.Vector3()
      .addVectors(diagP1, diagP2)
      .multiplyScalar(0.5);
    diagMesh.position.copy(diagMid);
    diagMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3().subVectors(diagP2, diagP1).normalize()
    );
    nGroup.add(diagMesh);

    // Diagonal tension wires (thin cross bracing)
    const wireP1 = new THREE.Vector3(xPos * 0.98, lowerWingY, lowerWingZ - 1.4);
    const wireP2 = new THREE.Vector3(xPos * 0.98, upperWingY, upperWingZ + 1.6);
    const wireLen = wireP1.distanceTo(wireP2);
    const wireGeo = new THREE.CylinderGeometry(0.04, 0.04, wireLen, 4);
    const wireMesh = new THREE.Mesh(wireGeo, darkMat);
    const wireMid = new THREE.Vector3()
      .addVectors(wireP1, wireP2)
      .multiplyScalar(0.5);
    wireMesh.position.copy(wireMid);
    wireMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3().subVectors(wireP2, wireP1).normalize()
    );
    nGroup.add(wireMesh);

    return nGroup;
  };

  root.add(createNStrutGroup(-1));
  root.add(createNStrutGroup(1));

  // 8. Cabane Struts (Connecting upper wing center to fuselage cowl/deck)
  const createCabaneStrut = (p1, p2) => {
    const len = p1.distanceTo(p2);
    const geo = new THREE.CylinderGeometry(0.1, 0.1, len, 6);
    const mesh = new THREE.Mesh(geo, strutMat);
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3().subVectors(p2, p1).normalize()
    );
    return mesh;
  };

  root.add(
    createCabaneStrut(
      new THREE.Vector3(-1.3, 1.3, -5.2),
      new THREE.Vector3(-2.2, upperWingY, upperWingZ - 0.8)
    )
  );
  root.add(
    createCabaneStrut(
      new THREE.Vector3(1.3, 1.3, -5.2),
      new THREE.Vector3(2.2, upperWingY, upperWingZ - 0.8)
    )
  );
  root.add(
    createCabaneStrut(
      new THREE.Vector3(-1.3, 1.4, -2.8),
      new THREE.Vector3(-2.2, upperWingY, upperWingZ + 0.8)
    )
  );
  root.add(
    createCabaneStrut(
      new THREE.Vector3(1.3, 1.4, -2.8),
      new THREE.Vector3(2.2, upperWingY, upperWingZ + 0.8)
    )
  );

  // 9. Vintage Landing Gear with Streamlined Wheel Pants (Spats)
  const createLandingGearLeg = (xSign) => {
    const gearGroup = new THREE.Group();
    const xPos = xSign * 3.8;
    const yPos = -3.2;
    const zPos = -4.6;

    // Main landing gear strut (from fuselage to wheel pant)
    const legP1 = new THREE.Vector3(xSign * 1.2, -0.8, -4.6);
    const legP2 = new THREE.Vector3(xPos, yPos + 0.5, zPos);
    const legMesh = createCabaneStrut(legP1, legP2);
    gearGroup.add(legMesh);

    // Aerodynamic streamline fairing leg sleeve
    const sleeveGeo = new THREE.BoxGeometry(0.28, 2.0, 0.7);
    const sleeveMesh = new THREE.Mesh(sleeveGeo, bodyMat);
    const sleeveMid = new THREE.Vector3()
      .addVectors(legP1, legP2)
      .multiplyScalar(0.5);
    sleeveMesh.position.copy(sleeveMid);
    sleeveMesh.rotation.z = xSign * -0.42;
    gearGroup.add(sleeveMesh);

    // Wheel Pant / Spat (Teardrop aerodynamic fairing)
    const pantGroup = new THREE.Group();
    pantGroup.position.set(xPos, yPos, zPos);

    // Main pant hull
    const pantBodyGeo = new THREE.BoxGeometry(0.8, 1.3, 2.6);
    const pantBodyMesh = new THREE.Mesh(pantBodyGeo, bodyMat);
    pantGroup.add(pantBodyMesh);

    // Front rounded nose of pant
    const pantNoseGeo = new THREE.ConeGeometry(0.65, 1.1, 8);
    pantNoseGeo.rotateX(-Math.PI / 2);
    const pantNoseMesh = new THREE.Mesh(pantNoseGeo, bodyMat);
    pantNoseMesh.position.set(0, 0, -1.8);
    pantNoseMesh.scale.set(0.65, 1.0, 1.0);
    pantGroup.add(pantNoseMesh);

    // Tapered aerodynamic tail of pant
    const pantTailGeo = new THREE.ConeGeometry(0.65, 1.8, 8);
    pantTailGeo.rotateX(Math.PI / 2);
    const pantTailMesh = new THREE.Mesh(pantTailGeo, bodyMat);
    pantTailMesh.position.set(0, 0, 2.1);
    pantTailMesh.scale.set(0.65, 1.0, 1.0);
    pantGroup.add(pantTailMesh);

    // Accent flash on pant
    const pantStripeGeo = new THREE.BoxGeometry(0.85, 0.28, 2.2);
    const pantStripeMesh = new THREE.Mesh(pantStripeGeo, accentMat);
    pantStripeMesh.position.set(0, 0.1, 0);
    pantGroup.add(pantStripeMesh);

    // Exposed tire bottom protruding slightly below the spat
    const tireGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.45, 10);
    tireGeo.rotateZ(Math.PI / 2);
    const tireMesh = new THREE.Mesh(tireGeo, darkMat);
    tireMesh.position.set(0, -0.45, 0);
    pantGroup.add(tireMesh);

    gearGroup.add(pantGroup);
    return gearGroup;
  };

  root.add(createLandingGearLeg(-1));
  root.add(createLandingGearLeg(1));

  // Small tail wheel / skid
  const tailSkidGeo = new THREE.BoxGeometry(0.2, 0.6, 1.0);
  const tailSkidMesh = new THREE.Mesh(tailSkidGeo, strutMat);
  tailSkidMesh.position.set(0, -0.65, 4.8);
  tailSkidMesh.rotation.x = -0.3;
  root.add(tailSkidMesh);

  const tailWheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 8);
  tailWheelGeo.rotateZ(Math.PI / 2);
  const tailWheelMesh = new THREE.Mesh(tailWheelGeo, darkMat);
  tailWheelMesh.position.set(0, -0.9, 5.2);
  root.add(tailWheelMesh);

  // 10. Tail Assembly (Empennage)
  // Horizontal Stabilizer (Body color center panel with rounded accent tips)
  const hChord = 2.8;
  const hThickness = 0.35;
  const hCenterSpan = 6.4;
  const hStabGeo = new THREE.BoxGeometry(hCenterSpan, hThickness, hChord);
  const hStabMesh = new THREE.Mesh(hStabGeo, bodyMat);
  hStabMesh.position.set(0, 0.55, 5.2);
  root.add(hStabMesh);

  // Horizontal stabilizer rounded tips (Accent color, subtle vintage corner radius)
  const hTipSpan = 1.0;
  const hTipGeo = createRoundedTipGeo(hTipSpan, hChord, hThickness, 0.75);

  const hTipR = new THREE.Mesh(hTipGeo, accentMat);
  hTipR.position.set(hCenterSpan / 2, 0.55, 5.2);
  root.add(hTipR);

  const hTipL = new THREE.Mesh(hTipGeo, accentMat);
  hTipL.position.set(-hCenterSpan / 2, 0.55, 5.2);
  hTipL.rotation.y = Math.PI;
  root.add(hTipL);

  // Vertical Fin & Rudder (Classic curved vintage aerofoil fin)
  const rudderShape = new THREE.Shape();
  rudderShape.moveTo(0, 0);
  rudderShape.lineTo(2.8, 0);
  rudderShape.quadraticCurveTo(2.6, 2.0, 2.2, 3.4);
  rudderShape.quadraticCurveTo(1.3, 4.4, 0.2, 3.7);
  rudderShape.quadraticCurveTo(0.02, 1.8, 0, 0);

  const rudderExtrude = {depth: 0.35, bevelEnabled: false, curveSegments: 8};
  const rudderGeo = new THREE.ExtrudeGeometry(rudderShape, rudderExtrude);
  rudderGeo.translate(-1.4, 0, -0.175);
  rudderGeo.rotateY(Math.PI / -2); // Align pointing along fuselage

  const rudderMesh = new THREE.Mesh(rudderGeo, accentMat);
  rudderMesh.position.set(0, 0.8, 5.0);
  root.add(rudderMesh);

  root.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return root;
}

// Global exposure
if (typeof window !== 'undefined') {
  window.createBiplaneModel = createBiplaneModel;
  window.biplaneModel = createBiplaneModel();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {createBiplaneModel};
}
