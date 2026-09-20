// --- GLIDER / SAILPLANE MODEL ---
// Dependencies: THREE, createMaterial (or fallback), ChillFlightLogic
// High-performance modern glider / sailplane matching the reference design:
// - Aerodynamic composite fuselage with sleek accent nose cap
// - Dark tinted panoramic bubble canopy with side accent chine stripe
// - High-aspect-ratio slender wings with upward dihedral and upturned accent winglets
// - Iconic T-tail empennage with swept vertical fin, accent rudder, and top horizontal stabilizer
// - Clean recessed monowheel undercarriage

function createGliderModel(opts = {}) {
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

  // Dark tinted canopy glass matching reference image
  const canopyMat = makeMat({
    color: 0x1e293b,
    flatShading: true,
    roughness: 0.2,
    metalness: 0.1,
  });

  const darkMat = makeMat({
    color: 0x0f172a,
    flatShading: true,
    roughness: 0.8,
  });

  // Tag materials for model debug viewer color cycling
  accentMat.userData = {type: 'accent'};
  bodyMat.userData = {type: 'body'};

  // ==========================================
  // 1. NOSE CAP & SPINNER (Glider Hub)
  // Seamless aerodynamic nose cone matching inspo image
  // ==========================================
  const propGroup = new THREE.Group();
  propGroup.position.set(0, 0.15, -6.6);
  root.add(propGroup);
  root.propGroup = propGroup;

  // Sleek parabolic red nose cap
  const noseGeo = new THREE.CylinderGeometry(0.7, 0.25, 1.6, 32);
  noseGeo.rotateX(Math.PI / 2); // radiusTop (0.7) to +Z (base), radiusBottom (0.25) to -Z (tip)
  const noseMesh = new THREE.Mesh(noseGeo, accentMat);
  noseMesh.position.set(0, 0, -0.8);
  noseMesh.scale.set(1.1, 1.3, 1.0);
  propGroup.add(noseMesh);

  // Soft rounded tip cap
  const tipGeo = new THREE.SphereGeometry(0.25, 16, 16);
  const tipMesh = new THREE.Mesh(tipGeo, accentMat);
  tipMesh.position.set(0, 0, -1.6);
  tipMesh.scale.set(1.1, 1.3, 1.0);
  propGroup.add(tipMesh);

  // ==========================================
  // 2. SCULPTED FUSELAGE POD & SLENDER BOOM
  // Aerodynamic composite sailplane pod with smooth continuous curves
  // ==========================================
  // Forward cockpit pod
  const fwdPodGeo = new THREE.CylinderGeometry(1.1, 0.7, 2.4, 32);
  fwdPodGeo.rotateX(Math.PI / 2);
  const fwdPodMesh = new THREE.Mesh(fwdPodGeo, bodyMat);
  fwdPodMesh.position.set(0, 0.15, -5.4);
  fwdPodMesh.scale.set(1.1, 1.3, 1.0);
  root.add(fwdPodMesh);

  // Mid cockpit belly pod
  const midPodGeo = new THREE.CylinderGeometry(1.0, 1.1, 2.8, 32);
  midPodGeo.rotateX(Math.PI / 2);
  const midPodMesh = new THREE.Mesh(midPodGeo, bodyMat);
  midPodMesh.position.set(0, 0.18, -2.8);
  midPodMesh.scale.set(1.1, 1.3, 1.0);
  root.add(midPodMesh);

  // Aft wing transition
  const aftPodGeo = new THREE.CylinderGeometry(0.55, 1.0, 2.2, 32);
  aftPodGeo.rotateX(Math.PI / 2);
  const aftPodMesh = new THREE.Mesh(aftPodGeo, bodyMat);
  aftPodMesh.position.set(0, 0.24, -0.3);
  aftPodMesh.scale.set(1.05, 1.25, 1.0);
  root.add(aftPodMesh);

  // Long slender composite tail boom
  const boomGeo = new THREE.CylinderGeometry(0.25, 0.55, 7.8, 32);
  boomGeo.rotateX(Math.PI / 2);
  const boomMesh = new THREE.Mesh(boomGeo, bodyMat);
  boomMesh.position.set(0, 0.3, 4.7);
  boomMesh.scale.set(1.0, 1.15, 1.0);
  root.add(boomMesh);

  // Prominent curved red accent stripe along cockpit flank under canopy
  // Uses thin cylinder shells to perfectly hug the fuselage
  const fwdStripeGeo = new THREE.CylinderGeometry(
    1.102,
    0.702,
    2.4,
    32,
    1,
    false,
    Math.PI / 2 + 0.5,
    0.5
  );
  fwdStripeGeo.rotateX(Math.PI / 2);
  const fwdStripeMesh1 = new THREE.Mesh(fwdStripeGeo, accentMat);
  fwdStripeMesh1.position.set(0, 0.15, -5.4);
  fwdStripeMesh1.scale.set(1.1, 1.3, 1.0);
  root.add(fwdStripeMesh1);

  const fwdStripeGeo2 = new THREE.CylinderGeometry(
    1.102,
    0.702,
    2.4,
    32,
    1,
    false,
    -Math.PI / 2 - 1.0,
    0.5
  );
  fwdStripeGeo2.rotateX(Math.PI / 2);
  const fwdStripeMesh2 = new THREE.Mesh(fwdStripeGeo2, accentMat);
  fwdStripeMesh2.position.set(0, 0.15, -5.4);
  fwdStripeMesh2.scale.set(1.1, 1.3, 1.0);
  root.add(fwdStripeMesh2);

  const midStripeGeo = new THREE.CylinderGeometry(
    1.002,
    1.102,
    2.8,
    32,
    1,
    false,
    Math.PI / 2 + 0.5,
    0.5
  );
  midStripeGeo.rotateX(Math.PI / 2);
  const midStripeMesh1 = new THREE.Mesh(midStripeGeo, accentMat);
  midStripeMesh1.position.set(0, 0.18, -2.8);
  midStripeMesh1.scale.set(1.1, 1.3, 1.0);
  root.add(midStripeMesh1);

  const midStripeGeo2 = new THREE.CylinderGeometry(
    1.002,
    1.102,
    2.8,
    32,
    1,
    false,
    -Math.PI / 2 - 1.0,
    0.5
  );
  midStripeGeo2.rotateX(Math.PI / 2);
  const midStripeMesh2 = new THREE.Mesh(midStripeGeo2, accentMat);
  midStripeMesh2.position.set(0, 0.18, -2.8);
  midStripeMesh2.scale.set(1.1, 1.3, 1.0);
  root.add(midStripeMesh2);

  // ==========================================
  // 3. INTEGRATED PANORAMIC BUBBLE CANOPY
  // Seamless streamlined teardrop bubble canopy nestled into the pod
  // ==========================================
  // Use a single smooth ellipsoid blister that intersects the fuselage cleanly
  // This guarantees a perfectly smooth curve with absolutely no jagged edges
  const canopyGeo = new THREE.SphereGeometry(1.0, 32, 24);
  const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
  // Positioned to sit flush into the upper deck of the fuselage
  canopyMesh.position.set(0, 0.65, -4.4);
  canopyMesh.scale.set(1.02, 0.95, 2.1);
  root.add(canopyMesh);

  // ==========================================
  // 4. HIGH-ASPECT-RATIO WINGS WITH FLAP LINES & CURVED WINGLETS
  // Wingspan ~34 units, upward dihedral flex, panel line detail
  // ==========================================
  const semiSpan = 14.8;
  const rootChord = 2.1;
  const tipChord = 0.76;
  const wingThick = 0.2;
  const dihedralAngle = 0.052; // ~3 degrees upward flex

  const createWingPanel = (span, rChord, tChord, thick) => {
    const shape = new THREE.Shape();
    const halfRChord = rChord / 2;
    const halfTChord = tChord / 2;
    const sweep = 0.22;

    shape.moveTo(0, -halfRChord);
    shape.lineTo(span, -halfTChord - sweep);
    shape.lineTo(span, halfTChord - sweep);
    shape.lineTo(0, halfRChord);
    shape.lineTo(0, -halfRChord);

    const extrudeSettings = {depth: thick, bevelEnabled: false};
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.translate(0, 0, -thick / 2);
    geo.rotateX(-Math.PI / 2); // align chord along Z axis
    return geo;
  };

  const wingGeo = createWingPanel(semiSpan, rootChord, tipChord, wingThick);

  // Center shoulder wing junction (blends into fuselage top)
  const centerJunctionGeo = new THREE.BoxGeometry(
    1.6,
    wingThick + 0.04,
    rootChord
  );
  const centerJunction = new THREE.Mesh(centerJunctionGeo, bodyMat);
  centerJunction.position.set(0, 0.6, -1.0);
  root.add(centerJunction);

  // Right Wing Assembly
  const rightWingGroup = new THREE.Group();
  rightWingGroup.position.set(0.8, 0.6, -1.0);
  rightWingGroup.rotation.z = dihedralAngle;
  root.add(rightWingGroup);

  const rightWingMesh = new THREE.Mesh(wingGeo, bodyMat);
  rightWingGroup.add(rightWingMesh);

  // Flap / aileron panel line detail (matching inspo image dark line along wing trailing section)
  const flapLineGeo = new THREE.BoxGeometry(semiSpan * 0.95, 0.02, 0.04);
  const flapLineRight = new THREE.Mesh(flapLineGeo, darkMat);
  flapLineRight.position.set(semiSpan * 0.5, wingThick / 2 + 0.01, 0.35);
  flapLineRight.rotation.y = 0.035; // follow taper
  rightWingGroup.add(flapLineRight);

  // Left Wing Assembly
  const leftWingGroup = new THREE.Group();
  leftWingGroup.position.set(-0.8, 0.6, -1.0);
  leftWingGroup.rotation.z = -dihedralAngle;
  root.add(leftWingGroup);

  const leftWingMesh = new THREE.Mesh(wingGeo, bodyMat);
  leftWingMesh.scale.set(-1, 1, 1);
  leftWingGroup.add(leftWingMesh);

  const flapLineLeft = new THREE.Mesh(flapLineGeo, darkMat);
  flapLineLeft.position.set(-semiSpan * 0.5, wingThick / 2 + 0.01, 0.35);
  flapLineLeft.rotation.y = -0.035;
  leftWingGroup.add(flapLineLeft);

  // Upturned Winglets (Signature modern soaring aerofoils)
  // Gracefully curved upward and swept back matching inspo image
  const wHeight = 1.9;
  const wBaseChord = tipChord;
  const wTipChord = tipChord * 0.4;
  const wSweep = 0.38;

  const wingletShape = new THREE.Shape();
  wingletShape.moveTo(-wBaseChord / 2, 0);
  wingletShape.lineTo(wBaseChord / 2, 0);
  wingletShape.quadraticCurveTo(
    wTipChord / 2 + wSweep * 0.6,
    wHeight * 0.6,
    wTipChord / 2 + wSweep,
    wHeight
  );
  wingletShape.lineTo(-wTipChord / 2 + wSweep, wHeight);
  wingletShape.quadraticCurveTo(
    -wBaseChord / 2 + wSweep * 0.3,
    wHeight * 0.45,
    -wBaseChord / 2,
    0
  );

  const wingletExtrudeSettings = {depth: 0.12, bevelEnabled: false};
  const wingletGeo = new THREE.ExtrudeGeometry(
    wingletShape,
    wingletExtrudeSettings
  );
  wingletGeo.translate(0, 0, -0.06);
  wingletGeo.rotateY(-Math.PI / 2); // negative rotation makes +X (sweep) align with +Z (tail)

  // Right Winglet
  const rightWinglet = new THREE.Mesh(wingletGeo, accentMat);
  rightWinglet.position.set(semiSpan, 0.02, 0.22);
  rightWinglet.rotation.z = -0.16; // cant slightly outward
  rightWingGroup.add(rightWinglet);

  // Left Winglet
  const leftWinglet = new THREE.Mesh(wingletGeo, accentMat);
  leftWinglet.position.set(-semiSpan, 0.02, 0.22);
  leftWinglet.rotation.z = 0.16;
  leftWingGroup.add(leftWinglet);

  // ==========================================
  // 5. ICONIC T-TAIL EMPENNAGE
  // Swept fin with full-height accent rudder and tapered horizontal stabilizer
  // ==========================================
  // Swept vertical fin (white leading structure)
  const finHeight = 3.6;
  const finBaseChord = 2.2;
  const finTopChord = 1.3;
  const finSweep = 0.92;

  // Leading edge white spar (front ~35% of fin)
  const finShape = new THREE.Shape();
  finShape.moveTo(-finBaseChord / 2, 0);
  finShape.lineTo(-finBaseChord / 2 + 0.8, 0);
  finShape.lineTo(-finTopChord / 2 + 0.5 + finSweep, finHeight);
  finShape.lineTo(-finTopChord / 2 + finSweep, finHeight);
  finShape.lineTo(-finBaseChord / 2, 0);

  const finExtrudeSettings = {depth: 0.2, bevelEnabled: false};
  const finGeo = new THREE.ExtrudeGeometry(finShape, finExtrudeSettings);
  finGeo.translate(0, 0, -0.1);
  finGeo.rotateY(-Math.PI / 2);

  const finMesh = new THREE.Mesh(finGeo, bodyMat);
  finMesh.position.set(0, 0.36, 7.5);
  root.add(finMesh);

  // Accent-colored Rudder (Trailing ~65% of vertical tail matching inspo image)
  const rudderShape = new THREE.Shape();
  rudderShape.moveTo(-finBaseChord / 2 + 0.8, 0.05);
  rudderShape.lineTo(finBaseChord / 2, 0.05);
  rudderShape.lineTo(finTopChord / 2 + finSweep, finHeight);
  rudderShape.lineTo(-finTopChord / 2 + 0.5 + finSweep, finHeight);
  rudderShape.lineTo(-finBaseChord / 2 + 0.8, 0.05);

  const rudderGeo = new THREE.ExtrudeGeometry(rudderShape, {
    depth: 0.16,
    bevelEnabled: false,
  });
  rudderGeo.translate(0, 0, -0.08);
  rudderGeo.rotateY(-Math.PI / 2);

  const rudderMesh = new THREE.Mesh(rudderGeo, accentMat);
  rudderMesh.position.set(0, 0.36, 7.5);
  root.add(rudderMesh);

  // High-mounted T-tail Horizontal Stabilizer with tapered tips
  const hSemiSpan = 3.8;
  const hRootChord = 1.25;
  const hTipChord = 0.75;
  const hThick = 0.15;

  const hStabShape = new THREE.Shape();
  hStabShape.moveTo(-hSemiSpan, -hTipChord / 2 + 0.1);
  hStabShape.lineTo(0, -hRootChord / 2);
  hStabShape.lineTo(hSemiSpan, -hTipChord / 2 + 0.1);
  hStabShape.lineTo(hSemiSpan, hTipChord / 2);
  hStabShape.lineTo(0, hRootChord / 2);
  hStabShape.lineTo(-hSemiSpan, hTipChord / 2);
  hStabShape.lineTo(-hSemiSpan, -hTipChord / 2 + 0.1);

  const hStabGeo = new THREE.ExtrudeGeometry(hStabShape, {
    depth: hThick,
    bevelEnabled: false,
  });
  hStabGeo.translate(0, 0, -hThick / 2);
  hStabGeo.rotateX(-Math.PI / 2);

  const hStabMesh = new THREE.Mesh(hStabGeo, bodyMat);
  hStabMesh.position.set(0, 0.36 + finHeight, 7.5 + finSweep);
  root.add(hStabMesh);

  // Top bullet fairing at T-tail junction
  const bulletGeo = new THREE.CylinderGeometry(0.16, 0.12, 1.5, 8);
  bulletGeo.rotateX(Math.PI / 2);
  const bulletMesh = new THREE.Mesh(bulletGeo, bodyMat);
  bulletMesh.position.set(0, 0.36 + finHeight + 0.08, 7.5 + finSweep);
  root.add(bulletMesh);

  // ==========================================
  // 6. UNDERCARRIAGE (Recessed Monowheel)
  // ==========================================
  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.28, 8);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMesh = new THREE.Mesh(wheelGeo, darkMat);
  wheelMesh.position.set(0, -0.6, -2.4);
  root.add(wheelMesh);

  // Enable shadow casting
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
  window.createGliderModel = createGliderModel;
  window.gliderModel = createGliderModel();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {createGliderModel};
}
