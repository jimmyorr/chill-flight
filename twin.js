// --- TWIN ENGINE TRANSPORT MODEL ("TWIN") ---
// Dependencies: THREE, createMaterial (or fallback), ChillFlightLogic
// Classic low-wing twin radial engine transport (DC-3 style) featuring:
// - Seamless lofted low-poly transport fuselage (perfect alignment from nose to tail)
// - Distinctive faceted cockpit windshield and passenger cabin windows
// - Continuous side cheatline accent stripe and red lower nose chin
// - Low-wing configuration with flat center section and dihedral outer wings (DC-3 sweep)
// - Twin wing-mounted radial engine nacelles with accent cowlings
// - Dual spinning 3-blade propellers with aerodynamic spinners
// - Classic swept empennage with tall accent vertical fin and horizontal stabilizers (zero z-fighting)
// - Sturdy tricycle landing gear with nose gear and dual nacelle main gear

function createTwinModel(opts = {}) {
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
        : 0xe0564c; // Coral-red default matching reference image

  const whiteColor = planeColor === 0xe8c382 ? 0x1c3144 : 0xf8fafc;

  const accentMat =
    opts.planeMat ||
    (opts.planeColor === undefined &&
    typeof window !== 'undefined' &&
    window.planeMat
      ? window.planeMat
      : makeMat({
          color: planeColor,
          flatShading: true,
          roughness: 0.35,
        }));

  const bodyMat =
    opts.planeWhiteMat ||
    (opts.planeColor === undefined &&
    typeof window !== 'undefined' &&
    window.planeWhiteMat
      ? window.planeWhiteMat
      : makeMat({
          color: whiteColor,
          flatShading: true,
          roughness: 0.35,
        }));

  const darkMat = makeMat({
    color: 0x1e293b,
    flatShading: true,
    roughness: 0.7,
  });

  const windowMat = makeMat({
    color: 0x0f172a,
    flatShading: true,
    roughness: 0.15,
    metalness: 0.2,
  });

  const metalMat = makeMat({
    color: 0x64748b,
    flatShading: true,
    roughness: 0.4,
    metalness: 0.3,
  });

  const tireMat = makeMat({
    color: 0x111827,
    flatShading: true,
    roughness: 0.9,
  });

  // Tag materials for model debug viewer color cycling
  accentMat.userData = {type: 'accent'};
  bodyMat.userData = {type: 'body'};

  // ==========================================
  // 1. FUSELAGE
  // Procedural lofted fuselage with smoothly connected cross-section rings
  // Guarantees zero step seams or misalignments between nose, cabin, and tail
  // ==========================================
  const fuselageGroup = new THREE.Group();
  root.add(fuselageGroup);

  const rings = [
    {z: -10.8, y: -0.06, rx: 0.38, ry: 0.38}, // 0: Nose tip
    {z: -9.5, y: 0.02, rx: 1.05, ry: 0.98}, // 1: Nose cone
    {z: -7.8, y: 0.1, rx: 1.45, ry: 1.38}, // 2: Cockpit windshield base
    {z: -6.2, y: 0.2, rx: 1.62, ry: 1.7}, // 3: Cabin front / brow
    {z: -2.5, y: 0.2, rx: 1.64, ry: 1.72}, // 4: Forward main cabin
    {z: 3.5, y: 0.2, rx: 1.64, ry: 1.72}, // 5: Aft main cabin
    {z: 7.2, y: 0.24, rx: 1.35, ry: 1.45}, // 6: Aft fuselage taper
    {z: 9.8, y: 0.28, rx: 0.82, ry: 0.92}, // 7: Tail base
    {z: 11.8, y: 0.32, rx: 0.42, ry: 0.48}, // 8: Tail cone
    {z: 13.0, y: 0.34, rx: 0.08, ry: 0.08}, // 9: Tail cone tip
  ];

  const segments = 16;
  const positions = [];
  const uvs = [];
  const indices = [];

  // Generate vertices for each ring
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * Math.PI * 2;
      const x = ring.rx * Math.cos(angle);
      const y = ring.y + ring.ry * Math.sin(angle);
      const z = ring.z;
      positions.push(x, y, z);
      uvs.push(s / segments, r / (rings.length - 1));
    }
  }

  // Generate cylinder quads between adjacent rings
  for (let r = 0; r < rings.length - 1; r++) {
    for (let s = 0; s < segments; s++) {
      const sNext = (s + 1) % segments;
      const i0 = r * segments + s;
      const i1 = r * segments + sNext;
      const i2 = (r + 1) * segments + s;
      const i3 = (r + 1) * segments + sNext;

      // Outward normals
      indices.push(i0, i1, i2);
      indices.push(i1, i3, i2);
    }
  }

  // Front cap (nose tip)
  const frontCenterIdx = positions.length / 3;
  positions.push(0, rings[0].y, rings[0].z);
  uvs.push(0.5, 0);
  for (let s = 0; s < segments; s++) {
    const sNext = (s + 1) % segments;
    indices.push(frontCenterIdx, sNext, s);
  }

  // Rear cap (tail tip)
  const lastRingStart = (rings.length - 1) * segments;
  const rearCenterIdx = positions.length / 3;
  positions.push(0, rings[rings.length - 1].y, rings[rings.length - 1].z);
  uvs.push(0.5, 1);
  for (let s = 0; s < segments; s++) {
    const sNext = (s + 1) % segments;
    indices.push(rearCenterIdx, lastRingStart + s, lastRingStart + sNext);
  }

  const fuselageGeo = new THREE.BufferGeometry();
  fuselageGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  fuselageGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  fuselageGeo.setIndex(indices);
  fuselageGeo.computeVertexNormals();

  const fuselageMesh = new THREE.Mesh(fuselageGeo, bodyMat);
  fuselageGroup.add(fuselageMesh);

  // Nose tip dome (accent color)
  const noseDomeGeo = new THREE.SphereGeometry(0.42, 12, 8);
  const noseDomeMesh = new THREE.Mesh(noseDomeGeo, accentMat);
  noseDomeMesh.position.set(0, -0.06, -10.8);
  noseDomeMesh.scale.set(0.95, 0.95, 1.1);
  fuselageGroup.add(noseDomeMesh);

  // Lower nose chin accent (coral red lower nose shell matching inspo image)
  const chinGeo = new THREE.CylinderGeometry(
    1.42,
    0.44,
    2.9,
    16,
    1,
    false,
    0,
    Math.PI
  );
  chinGeo.rotateX(Math.PI / 2);
  chinGeo.rotateZ(Math.PI / 2);
  const chinMesh = new THREE.Mesh(chinGeo, accentMat);
  chinMesh.position.set(0, -0.01, -9.4);
  chinMesh.scale.set(0.98, 0.96, 1.0);
  fuselageGroup.add(chinMesh);

  // ==========================================
  // 2. COCKPIT WINDSHIELD & CANOPY
  // Integrated streamlined canopy blister inspired by the glider's clean geometry
  // Nestled into the fuselage brow with zero jagged edges, backwards tilt, or clipping
  // ==========================================
  const canopyGeo = new THREE.SphereGeometry(1.0, 24, 18);
  const canopyMesh = new THREE.Mesh(canopyGeo, windowMat);
  canopyMesh.position.set(0, 0.78, -7.5);
  canopyMesh.scale.set(1.08, 0.62, 2.05);
  canopyMesh.rotation.x = 0.12;
  fuselageGroup.add(canopyMesh);

  // Side cheatline stripes (red accent band running along cabin window row)
  // Ends cleanly at the cabin aft transition with an aerodynamic tapered tip
  const halfH = 0.26;
  const zFront = -6.5;
  const zAft = 3.1;
  const zTip = 3.8;

  // Left stripe
  const stripeShapeLeft = new THREE.Shape();
  stripeShapeLeft.moveTo(zFront, -halfH);
  stripeShapeLeft.lineTo(zAft, -halfH);
  stripeShapeLeft.lineTo(zTip, 0);
  stripeShapeLeft.lineTo(zAft, halfH);
  stripeShapeLeft.lineTo(zFront, halfH);
  stripeShapeLeft.closePath();

  const stripeGeoLeft = new THREE.ShapeGeometry(stripeShapeLeft);
  const leftStripe = new THREE.Mesh(stripeGeoLeft, accentMat);
  leftStripe.position.set(-1.65, 0.26, 0);
  leftStripe.rotation.y = -Math.PI / 2;
  fuselageGroup.add(leftStripe);

  // Right stripe (correct winding for +X outward normal)
  const stripeShapeRight = new THREE.Shape();
  stripeShapeRight.moveTo(-zTip, 0);
  stripeShapeRight.lineTo(-zAft, -halfH);
  stripeShapeRight.lineTo(-zFront, -halfH);
  stripeShapeRight.lineTo(-zFront, halfH);
  stripeShapeRight.lineTo(-zAft, halfH);
  stripeShapeRight.closePath();

  const stripeGeoRight = new THREE.ShapeGeometry(stripeShapeRight);
  const rightStripe = new THREE.Mesh(stripeGeoRight, accentMat);
  rightStripe.position.set(1.65, 0.26, 0);
  rightStripe.rotation.y = Math.PI / 2;
  fuselageGroup.add(rightStripe);

  // Front nose stripe transition curving beneath windshield
  const noseStripeGeo = new THREE.CylinderGeometry(
    1.42,
    1.42,
    0.48,
    16,
    1,
    true,
    0,
    Math.PI
  );
  noseStripeGeo.rotateX(Math.PI / 2);
  noseStripeGeo.rotateZ(Math.PI / 2);
  const noseStripeMesh = new THREE.Mesh(noseStripeGeo, accentMat);
  noseStripeMesh.position.set(0, 0.12, -7.8);
  noseStripeMesh.scale.set(0.98, 0.96, 1.0);
  fuselageGroup.add(noseStripeMesh);

  // Passenger windows along cheatline
  const windowCount = 7;
  const winStartZ = -4.2;
  const winSpacing = 1.1;
  const winGeo = new THREE.BoxGeometry(0.1, 0.32, 0.56);

  for (let i = 0; i < windowCount; i++) {
    const wz = winStartZ + i * winSpacing;
    const winLeft = new THREE.Mesh(winGeo, windowMat);
    winLeft.position.set(-1.66, 0.26, wz);
    fuselageGroup.add(winLeft);

    const winRight = new THREE.Mesh(winGeo, windowMat);
    winRight.position.set(1.66, 0.26, wz);
    fuselageGroup.add(winRight);
  }

  // ==========================================
  // 3. LOW WINGS (DC-3 Planform with Rounded Wingtips)
  // Wide center wing under fuselage, outer wings with ~4.5° dihedral and swept leading edge
  // ==========================================
  const wingGroup = new THREE.Group();
  wingGroup.position.set(0, -0.65, -0.6);
  root.add(wingGroup);

  // Center wing section (width 11.6 across nacelles, chord 4.6, thick 0.52)
  const centerWingGeo = new THREE.BoxGeometry(11.6, 0.52, 4.6);
  const centerWingMesh = new THREE.Mesh(centerWingGeo, bodyMat);
  centerWingMesh.position.set(0, 0, 0);
  wingGroup.add(centerWingMesh);

  // Aerodynamic wing-to-belly fairing
  const bellyFairingGeo = new THREE.CylinderGeometry(
    1.68,
    1.68,
    4.6,
    12,
    1,
    false,
    0,
    Math.PI
  );
  bellyFairingGeo.rotateX(Math.PI / 2);
  bellyFairingGeo.rotateZ(Math.PI / 2);
  const bellyFairing = new THREE.Mesh(bellyFairingGeo, bodyMat);
  bellyFairing.position.set(0, 0.5, 0);
  bellyFairing.scale.set(0.96, 0.45, 1.0);
  wingGroup.add(bellyFairing);

  // Outer wings:
  // Root chord: 4.6, Tip chord: 2.1, Span: 10.5
  // DC-3 planform: Trailing edge straight, leading edge swept back, rounded low-poly tip
  const outerSpan = 10.5;
  const tipChord = 2.1;
  const dihedralAngle = 0.08; // ~4.6 degrees upward

  const teRoot = 2.3;
  const leRoot = -2.3;
  const teTip = 1.9;
  const leTip = teTip - tipChord; // -0.2

  const wingExtrudeSettings = {
    depth: 0.44,
    bevelEnabled: false,
    curveSegments: 6,
  };

  // Helper to create wing geometry with smoothly rounded wingtips
  const createOuterWingPanel = (isRight) => {
    const shape = new THREE.Shape();
    const rTip = 0.65;

    if (isRight) {
      shape.moveTo(0, leRoot);
      shape.lineTo(outerSpan - rTip, leTip);
      shape.quadraticCurveTo(outerSpan, leTip, outerSpan, leTip + rTip);
      shape.lineTo(outerSpan, teTip - rTip);
      shape.quadraticCurveTo(outerSpan, teTip, outerSpan - rTip, teTip);
      shape.lineTo(0, teRoot);
    } else {
      shape.moveTo(0, teRoot);
      shape.lineTo(-outerSpan + rTip, teTip);
      shape.quadraticCurveTo(-outerSpan, teTip, -outerSpan, teTip - rTip);
      shape.lineTo(-outerSpan, leTip + rTip);
      shape.quadraticCurveTo(-outerSpan, leTip, -outerSpan + rTip, leTip);
      shape.lineTo(0, leRoot);
    }
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, wingExtrudeSettings);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, -0.22, 0);

    const panelGroup = new THREE.Group();
    panelGroup.position.set(isRight ? 5.8 : -5.8, 0.02, 0);
    panelGroup.rotation.z = isRight ? dihedralAngle : -dihedralAngle;

    const mesh = new THREE.Mesh(geo, bodyMat);
    panelGroup.add(mesh);

    return panelGroup;
  };

  const rightWingPanel = createOuterWingPanel(true);
  wingGroup.add(rightWingPanel);

  const leftWingPanel = createOuterWingPanel(false);
  wingGroup.add(leftWingPanel);

  // ==========================================
  // 4. TWIN ENGINE NACELLES & PROPELLERS
  // Mounted mid-wing at X = +/- 5.8
  // ==========================================
  const nacelleX = 5.8;
  const nacelleY = -0.62;
  const nacelleZ = -1.6;
  const propGroups = [];

  const createEngineNacelle = (isRight) => {
    const nacelleGroup = new THREE.Group();
    const sign = isRight ? 1 : -1;
    nacelleGroup.position.set(sign * nacelleX, nacelleY, nacelleZ);

    // Nacelle main body (white streamlined cylinder, length 5.4)
    const nacelleBodyGeo = new THREE.CylinderGeometry(1.08, 0.94, 5.4, 14);
    nacelleBodyGeo.rotateX(Math.PI / 2);
    const nacelleBodyMesh = new THREE.Mesh(nacelleBodyGeo, bodyMat);
    nacelleBodyMesh.position.set(0, 0, 0.2);
    nacelleBodyMesh.scale.set(1.0, 1.15, 1.0);
    nacelleGroup.add(nacelleBodyMesh);

    // Nacelle aft fairing tapering smoothly to a point BEHIND the wing (+Z)
    const nacelleAftGeo = new THREE.ConeGeometry(0.94, 2.6, 14);
    nacelleAftGeo.rotateX(Math.PI / 2);
    const nacelleAftMesh = new THREE.Mesh(nacelleAftGeo, bodyMat);
    nacelleAftMesh.position.set(0, 0, 4.2);
    nacelleAftMesh.scale.set(1.0, 1.14, 1.0);
    nacelleGroup.add(nacelleAftMesh);

    // Front Cowling ring (painted coral red / accent color)
    const cowlGeo = new THREE.CylinderGeometry(1.12, 1.14, 1.6, 14);
    cowlGeo.rotateX(Math.PI / 2);
    const cowlMesh = new THREE.Mesh(cowlGeo, accentMat);
    cowlMesh.position.set(0, 0, -2.8);
    cowlMesh.scale.set(1.0, 1.14, 1.0);
    nacelleGroup.add(cowlMesh);

    // Cowling intake lip (subtle rounded front ring)
    const lipGeo = new THREE.TorusGeometry(0.98, 0.14, 8, 14);
    const lipMesh = new THREE.Mesh(lipGeo, accentMat);
    lipMesh.position.set(0, 0, -3.6);
    lipMesh.scale.set(1.0, 1.12, 1.0);
    nacelleGroup.add(lipMesh);

    // Radial engine face (dark recessed plate inside cowling)
    const engineFaceGeo = new THREE.CylinderGeometry(0.94, 0.94, 0.25, 14);
    engineFaceGeo.rotateX(Math.PI / 2);
    const engineFaceMesh = new THREE.Mesh(engineFaceGeo, darkMat);
    engineFaceMesh.position.set(0, 0, -3.3);
    nacelleGroup.add(engineFaceMesh);

    // Center engine crankcase hub
    const hubGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.4, 8);
    hubGeo.rotateX(Math.PI / 2);
    const hubMesh = new THREE.Mesh(hubGeo, metalMat);
    hubMesh.position.set(0, 0, -3.5);
    nacelleGroup.add(hubMesh);

    // ------------------------------------------
    // Propeller Group (Spinning 3-blade prop)
    // ------------------------------------------
    const pGroup = new THREE.Group();
    pGroup.position.set(0, 0, -3.75);
    nacelleGroup.add(pGroup);
    propGroups.push(pGroup);

    // Streamlined pointed spinner cone
    const spinnerGeo = new THREE.ConeGeometry(0.34, 1.0, 10);
    spinnerGeo.rotateX(-Math.PI / 2);
    const spinnerMesh = new THREE.Mesh(spinnerGeo, accentMat);
    spinnerMesh.position.set(0, 0, -0.48);
    pGroup.add(spinnerMesh);

    // Spinner base plate
    const basePlateGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.12, 10);
    basePlateGeo.rotateX(Math.PI / 2);
    const basePlateMesh = new THREE.Mesh(basePlateGeo, metalMat);
    basePlateMesh.position.set(0, 0, 0.02);
    pGroup.add(basePlateMesh);

    // 3 Propeller blades (120 degrees apart)
    const bladeGeo = new THREE.BoxGeometry(0.24, 2.3, 0.06);
    bladeGeo.translate(0, 1.15, 0);

    for (let b = 0; b < 3; b++) {
      const bladeHolder = new THREE.Group();
      bladeHolder.rotation.z = (b * Math.PI * 2) / 3;

      const bladeMesh = new THREE.Mesh(bladeGeo, darkMat);
      bladeMesh.rotation.y = 0.22;
      bladeHolder.add(bladeMesh);

      // Accent blade tip
      const tipBladeGeo = new THREE.BoxGeometry(0.25, 0.32, 0.07);
      tipBladeGeo.translate(0, 2.15, 0);
      const tipBladeMesh = new THREE.Mesh(tipBladeGeo, accentMat);
      tipBladeMesh.rotation.y = 0.22;
      bladeHolder.add(tipBladeMesh);

      pGroup.add(bladeHolder);
    }

    // ------------------------------------------
    // Main Landing Gear (under nacelle)
    // ------------------------------------------
    const mainGearGroup = new THREE.Group();
    mainGearGroup.position.set(0, -0.7, 0.2);
    nacelleGroup.add(mainGearGroup);

    // Twin oleo struts
    const strutGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6);
    const strutLeft = new THREE.Mesh(strutGeo, metalMat);
    strutLeft.position.set(-0.25, -0.6, 0);
    strutLeft.rotation.z = -0.06;
    mainGearGroup.add(strutLeft);

    const strutRight = new THREE.Mesh(strutGeo, metalMat);
    strutRight.position.set(0.25, -0.6, 0);
    strutRight.rotation.z = 0.06;
    mainGearGroup.add(strutRight);

    // Cross axle
    const axleGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.75, 6);
    axleGeo.rotateZ(Math.PI / 2);
    const axle = new THREE.Mesh(axleGeo, metalMat);
    axle.position.set(0, -1.35, 0);
    mainGearGroup.add(axle);

    // Sturdy main wheel tire
    const wheelGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.36, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMesh = new THREE.Mesh(wheelGeo, tireMat);
    wheelMesh.position.set(0, -1.35, 0);
    mainGearGroup.add(wheelMesh);

    // Wheel hub cap
    const hubCapGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.38, 8);
    hubCapGeo.rotateZ(Math.PI / 2);
    const hubCap = new THREE.Mesh(hubCapGeo, metalMat);
    hubCap.position.set(0, -1.35, 0);
    mainGearGroup.add(hubCap);

    return nacelleGroup;
  };

  const leftNacelle = createEngineNacelle(false);
  root.add(leftNacelle);

  const rightNacelle = createEngineNacelle(true);
  root.add(rightNacelle);

  // Store prop groups on root
  root.propGroups = propGroups;
  root.propGroup = propGroups[0] || null;

  // ==========================================
  // 5. NOSE LANDING GEAR (Tricycle Gear)
  // Positioned under forward fuselage
  // ==========================================
  const noseGearGroup = new THREE.Group();
  noseGearGroup.position.set(0, -0.9, -7.8);
  root.add(noseGearGroup);

  const noseStrutGeo = new THREE.CylinderGeometry(0.09, 0.08, 1.5, 6);
  const noseStrut = new THREE.Mesh(noseStrutGeo, metalMat);
  noseStrut.position.set(0, -0.55, 0);
  noseStrut.rotation.x = -0.15; // Raked slightly back
  noseGearGroup.add(noseStrut);

  const noseWheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.28, 12);
  noseWheelGeo.rotateZ(Math.PI / 2);
  const noseWheel = new THREE.Mesh(noseWheelGeo, tireMat);
  noseWheel.position.set(0, -1.3, 0.12);
  noseGearGroup.add(noseWheel);

  const noseHubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8);
  noseHubGeo.rotateZ(Math.PI / 2);
  const noseHub = new THREE.Mesh(noseHubGeo, metalMat);
  noseHub.position.set(0, -1.3, 0.12);
  noseGearGroup.add(noseHub);

  // ==========================================
  // 6. EMPENNAGE (TAIL ASSEMBLY)
  // Classic tall swept vertical stabilizer + non-overlapping horizontal stabilizer
  // Completely eliminates z-fighting and matches inspiration livery
  // ==========================================
  const tailGroup = new THREE.Group();
  root.add(tailGroup);

  // Vertical Fin & Rudder (Classic swept DC-3 aerofoil fin, completely coral red)
  const finShape = new THREE.Shape();
  finShape.moveTo(4.0, 0.8);
  finShape.quadraticCurveTo(6.8, 1.3, 8.4, 2.6); // Dorsal fillet sweep
  finShape.lineTo(9.2, 4.6); // Top front of fin
  finShape.quadraticCurveTo(10.2, 4.8, 10.8, 4.3); // Top rounded crown
  finShape.quadraticCurveTo(11.8, 3.2, 12.0, 1.2); // Trailing edge of rudder
  finShape.lineTo(12.0, 0.8); // Rudder base
  finShape.lineTo(4.0, 0.8); // Base along fuselage spine
  finShape.closePath();

  const finExtrudeSettings = {
    depth: 0.28,
    bevelEnabled: false,
  };

  const finGeo = new THREE.ExtrudeGeometry(finShape, finExtrudeSettings);
  finGeo.rotateY(-Math.PI / 2);
  finGeo.translate(0.14, 0, 0); // Center thickness across X=0

  const finMesh = new THREE.Mesh(finGeo, accentMat);
  tailGroup.add(finMesh);

  // Horizontal Stabilizers (DC-3 tapered planform with rounded tips)
  // Modeled as a single clean aerodynamic geometry in accentMat matching inspo image
  // Zero overlapping geometry = ZERO z-fighting!
  const hSpan = 12.6;
  const hRootChord = 2.8;
  const hTipChord = 1.4;
  const hThickness = 0.26;

  const hStabShape = new THREE.Shape();
  const halfSpan = hSpan / 2;
  const rTailTip = 0.45;

  // Symmetrical planform: root at center (x = 0), tips at x = ±halfSpan
  // Right side (x >= 0):
  hStabShape.moveTo(0, -hRootChord * 0.45);
  hStabShape.lineTo(halfSpan - rTailTip, -hTipChord * 0.4);
  hStabShape.quadraticCurveTo(
    halfSpan,
    -hTipChord * 0.4,
    halfSpan,
    -hTipChord * 0.4 + rTailTip
  );
  hStabShape.lineTo(halfSpan, hTipChord * 0.6 - rTailTip);
  hStabShape.quadraticCurveTo(
    halfSpan,
    hTipChord * 0.6,
    halfSpan - rTailTip,
    hTipChord * 0.6
  );
  hStabShape.lineTo(0, hRootChord * 0.55);

  // Left side (x <= 0):
  hStabShape.lineTo(-halfSpan + rTailTip, hTipChord * 0.6);
  hStabShape.quadraticCurveTo(
    -halfSpan,
    hTipChord * 0.6,
    -halfSpan,
    hTipChord * 0.6 - rTailTip
  );
  hStabShape.lineTo(-halfSpan, -hTipChord * 0.4 + rTailTip);
  hStabShape.quadraticCurveTo(
    -halfSpan,
    -hTipChord * 0.4,
    -halfSpan + rTailTip,
    -hTipChord * 0.4
  );
  hStabShape.closePath();

  const hStabSettings = {
    depth: hThickness,
    bevelEnabled: false,
    curveSegments: 6,
  };

  const hStabGeo = new THREE.ExtrudeGeometry(hStabShape, hStabSettings);
  hStabGeo.rotateX(Math.PI / 2);
  hStabGeo.translate(0, -hThickness / 2, 0);

  const hStabMesh = new THREE.Mesh(hStabGeo, accentMat);
  hStabMesh.position.set(0, 0.75, 10.2);
  tailGroup.add(hStabMesh);

  // ==========================================
  // SHADOW CASTING
  // ==========================================
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
  window.createTwinModel = createTwinModel;
  window.twinModel = createTwinModel();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {createTwinModel};
}
