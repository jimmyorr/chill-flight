// --- TWIN ENGINE TRANSPORT MODEL ("TWIN") ---
// Classic low-wing twin radial engine airliner/transport (Douglas DC-3 style):
// - Stepped DC-3 flight-deck brow with 4-pane V-framed windshield & anti-glare nose panel
// - Lofted fuselage with continuous skin-tight airline cheatline, nose chin & cabin windows
// - Cambered NACA airfoil center & swept DC-3 outer wings with angled livery wingtips
// - Seamless LatheGeometry radial engine nacelles with 9-cylinder Twin Wasp stars,
//   top carburetor air scoops, side exhaust stacks & 3-blade paddle propellers
// - Classic dorsal-filleted DC-3 vertical fin & cambered airfoil horizontal stabilizers
// - Retractable tricycle landing gear (setGearExtension)
import * as THREE from 'three';
import {createMaterial} from './constants.js';
import {mergeStaticMeshes} from './biplane.js';
import {state} from './state.js';

export function createTwinModel(opts = {}) {
  const root = new THREE.Group();

  const makeMat = (props) => createMaterial(props);

  const planeColor =
    opts.planeColor !== undefined
      ? opts.planeColor
      : typeof state.planeColor !== 'undefined'
        ? state.planeColor
        : 0xe0564c;

  const whiteColor = planeColor === 0xe8c382 ? 0x1c3144 : 0xf8fafc;

  const accentMat =
    opts.planeMat ||
    makeMat({
      color: planeColor,
      flatShading: true,
      roughness: 0.36,
    });

  const bodyMat =
    opts.planeWhiteMat ||
    makeMat({
      color: whiteColor,
      flatShading: true,
      roughness: 0.38,
    });

  const darkMat = makeMat({
    color: 0x1e2530,
    flatShading: true,
    roughness: 0.72,
  });

  const windowMat = makeMat({
    color: 0x0d1522,
    roughness: 0.1,
    metalness: 0.68,
    transparent: true,
    opacity: 0.86,
  });

  const metalMat = makeMat({
    color: 0x8e9aa8,
    flatShading: true,
    roughness: 0.34,
    metalness: 0.48,
  });

  const propTipMat = makeMat({
    color: 0xfacc15,
    flatShading: true,
    roughness: 0.38,
  });

  const tireMat = makeMat({
    color: 0x14181f,
    flatShading: true,
    roughness: 0.9,
  });

  accentMat.userData = {type: 'accent'};
  bodyMat.userData = {type: 'body'};

  const sgnPow = (v, exp) => Math.sign(v) * Math.pow(Math.abs(v), exp);
  const evalRing = (st, theta, scale = 1) => {
    const exp = 2 / st.p;
    const x = st.rx * scale * sgnPow(Math.cos(theta), exp);
    const y = st.y + st.ry * scale * sgnPow(Math.sin(theta), exp);
    return [x, y];
  };

  // ==========================================
  // 1. STEPPED DC-3 LOFTED FUSELAGE & AIRLINE LIVERY
  // ==========================================
  const fuselageGroup = new THREE.Group();
  root.add(fuselageGroup);

  const rings = [
    {z: -11.0, y: -0.16, rx: 0.34, ry: 0.32, p: 2.0}, // 0: Nose radome tip
    {z: -9.65, y: -0.08, rx: 1.02, ry: 0.9, p: 2.05}, // 1: Nose cone
    {z: -8.05, y: -0.02, rx: 1.4, ry: 1.16, p: 2.15}, // 2: Windshield sill / nose deck
    {z: -6.5, y: 0.22, rx: 1.58, ry: 1.68, p: 2.3}, // 3: Stepped flight-deck roof brow
    {z: -3.0, y: 0.22, rx: 1.64, ry: 1.74, p: 2.3}, // 4: Forward main cabin
    {z: 3.6, y: 0.22, rx: 1.62, ry: 1.72, p: 2.25}, // 5: Aft main cabin
    {z: 7.4, y: 0.26, rx: 1.28, ry: 1.4, p: 2.15}, // 6: Aft fuselage taper
    {z: 10.2, y: 0.32, rx: 0.72, ry: 0.86, p: 2.05}, // 7: Empennage base
    {z: 12.6, y: 0.38, rx: 0.14, ry: 0.22, p: 2.0}, // 8: Tailcone tip
  ];

  const segments = 16;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    for (let s = 0; s <= segments; s++) {
      const angle = (s / segments) * Math.PI * 2;
      const [x, y] = evalRing(ring, angle);
      positions.push(x, y, ring.z);
      uvs.push(s / segments, r / (rings.length - 1));
    }
  }

  const fStride = segments + 1;
  for (let r = 0; r < rings.length - 1; r++) {
    for (let s = 0; s < segments; s++) {
      const i0 = r * fStride + s;
      const i1 = r * fStride + s + 1;
      const i2 = (r + 1) * fStride + s;
      const i3 = (r + 1) * fStride + s + 1;
      indices.push(i0, i1, i2, i1, i3, i2);
    }
  }

  const frontCenterIdx = positions.length / 3;
  positions.push(0, rings[0].y, rings[0].z - 0.14);
  uvs.push(0.5, 0);
  for (let s = 0; s < segments; s++) {
    indices.push(frontCenterIdx, s + 1, s);
  }

  const lastRingStart = (rings.length - 1) * fStride;
  const rearCenterIdx = positions.length / 3;
  positions.push(
    0,
    rings[rings.length - 1].y,
    rings[rings.length - 1].z + 0.16
  );
  uvs.push(0.5, 1);
  for (let s = 0; s < segments; s++) {
    indices.push(rearCenterIdx, lastRingStart + s, lastRingStart + s + 1);
  }

  const fuselageGeo = new THREE.BufferGeometry();
  fuselageGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  fuselageGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  fuselageGeo.setIndex(indices);
  fuselageGeo.computeVertexNormals();
  fuselageGroup.add(new THREE.Mesh(fuselageGeo, bodyMat));

  // Painted nose cap & lower nose chin scallop (flush lofted shell over rings 0..2)
  const noseCapGeo = new THREE.SphereGeometry(0.36, 12, 8);
  noseCapGeo.scale(1.0, 0.94, 1.18);
  noseCapGeo.translate(0, -0.16, -11.02);
  fuselageGroup.add(new THREE.Mesh(noseCapGeo, accentMat));

  const chinPos = [];
  const chinUvs = [];
  const chinIdx = [];
  const halfSegs = 10;
  for (let r = 0; r <= 2; r++) {
    const ring = rings[r];
    for (let s = 0; s <= halfSegs; s++) {
      const angle = Math.PI + (s / halfSegs) * Math.PI;
      const [x, y] = evalRing(ring, angle, 1.015);
      chinPos.push(x, y, ring.z);
      chinUvs.push(s / halfSegs, r / 2);
    }
  }
  const cStride = halfSegs + 1;
  for (let r = 0; r < 2; r++) {
    for (let s = 0; s < halfSegs; s++) {
      const a = r * cStride + s;
      const b = r * cStride + s + 1;
      const c = (r + 1) * cStride + s;
      const d = (r + 1) * cStride + s + 1;
      chinIdx.push(a, b, c, b, d, c);
    }
  }
  const chinGeo = new THREE.BufferGeometry();
  chinGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(chinPos, 3)
  );
  chinGeo.setAttribute('uv', new THREE.Float32BufferAttribute(chinUvs, 2));
  chinGeo.setIndex(chinIdx);
  chinGeo.computeVertexNormals();
  fuselageGroup.add(new THREE.Mesh(chinGeo, accentMat));

  // Matte black anti-glare panel atop forward nose deck (-10.2 to -8.05)
  const glarePos = [];
  const glareUvs = [];
  const glareIdx = [];
  const glareCols = 6;
  for (let r = 1; r <= 2; r++) {
    const ring = rings[r];
    const span = r === 1 ? 0.34 : 0.44;
    for (let s = 0; s <= glareCols; s++) {
      const angle = Math.PI * 0.5 + (s / glareCols - 0.5) * 2 * span;
      const [x, y] = evalRing(ring, angle, 1.015);
      glarePos.push(x, y, ring.z);
      glareUvs.push(s / glareCols, r - 1);
    }
  }
  for (let s = 0; s < glareCols; s++) {
    const a = s;
    const b = s + 1;
    const c = glareCols + 1 + s;
    const d = glareCols + 1 + s + 1;
    glareIdx.push(a, b, c, b, d, c);
  }
  const glareGeo = new THREE.BufferGeometry();
  glareGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(glarePos, 3)
  );
  glareGeo.setAttribute('uv', new THREE.Float32BufferAttribute(glareUvs, 2));
  glareGeo.setIndex(glareIdx);
  glareGeo.computeVertexNormals();
  fuselageGroup.add(new THREE.Mesh(glareGeo, darkMat));

  // Continuous skin-tight DC-3 airline window-belt cheatline (rings 1..7, flowing from nose chin to tail)
  for (const side of [-1, 1]) {
    const sPos = [];
    const sUvs = [];
    const sIdx = [];
    const bandRows = 4;
    const startR = 1;
    const endR = 7;
    for (let r = startR; r <= endR; r++) {
      const ring = rings[r];
      const t = (r - startR) / (endR - startR);
      // Flows up smoothly out of the nose chin (rings 1..2), runs level along cabin windows (3..5), sweeps into tail (6..7)
      const lift =
        r === 1 ? -0.18 : r === 2 ? -0.06 : r >= 6 ? (r - 5) * 0.08 : 0.03;
      const centerAngle = side > 0 ? lift : Math.PI - lift;
      const halfSpan = r === 7 ? 0.06 : r === 6 ? 0.14 : r === 1 ? 0.14 : 0.19;
      for (let k = 0; k <= bandRows; k++) {
        const frac = k / bandRows - 0.5;
        const theta = centerAngle + frac * 2 * halfSpan;
        const [x, y] = evalRing(ring, theta, 1.016);
        sPos.push(x, y, ring.z);
        sUvs.push(k / bandRows, t);
      }
    }
    const sStride = bandRows + 1;
    for (let r = 0; r < endR - startR; r++) {
      for (let k = 0; k < bandRows; k++) {
        const a = r * sStride + k;
        const b = r * sStride + k + 1;
        const c = (r + 1) * sStride + k;
        const d = (r + 1) * sStride + k + 1;
        sIdx.push(a, b, c, b, d, c);
      }
    }
    const stripeGeo = new THREE.BufferGeometry();
    stripeGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(sPos, 3)
    );
    stripeGeo.setAttribute('uv', new THREE.Float32BufferAttribute(sUvs, 2));
    stripeGeo.setIndex(sIdx);
    stripeGeo.computeVertexNormals();
    fuselageGroup.add(new THREE.Mesh(stripeGeo, accentMat));
  }

  // ==========================================
  // 2. FLUSH LOFTED 4-PANE DC-3 FLIGHT DECK & CABIN WINDOWS
  // ==========================================
  const glassGroup = new THREE.Group();
  // Seamless wrap-around windshield shell lofted across the stepped brow (Ring 2 -> Ring 3)
  const wsPos = [];
  const wsUvs = [];
  const wsIdx = [];
  const wsCols = 8; // Faceted into 4 distinct cockpit panes per half (8 across crown)
  const zTops = [-7.95, -6.72];
  for (let row = 0; row < 2; row++) {
    const zVal = zTops[row];
    const uLerp = (zVal - rings[2].z) / (rings[3].z - rings[2].z);
    const interpRing = {
      z: zVal,
      y: THREE.MathUtils.lerp(rings[2].y, rings[3].y, uLerp),
      rx: THREE.MathUtils.lerp(rings[2].rx, rings[3].rx, uLerp),
      ry: THREE.MathUtils.lerp(rings[2].ry, rings[3].ry, uLerp),
      p: THREE.MathUtils.lerp(rings[2].p, rings[3].p, uLerp),
    };
    const halfArc = row === 0 ? 0.62 : 0.74;
    for (let s = 0; s <= wsCols; s++) {
      const angle = Math.PI * 0.5 + (s / wsCols - 0.5) * 2 * halfArc;
      const [x, y] = evalRing(interpRing, angle, 1.02);
      // Slight V-prow forward point at center (s = wsCols / 2) on bottom sill
      const centerPeak =
        row === 0 ? (1 - Math.abs(s / (wsCols * 0.5) - 1)) * -0.18 : 0;
      wsPos.push(x, y, zVal + centerPeak);
      wsUvs.push(s / wsCols, row);
    }
  }
  for (let s = 0; s < wsCols; s++) {
    const a = s;
    const b = s + 1;
    const c = wsCols + 1 + s;
    const d = wsCols + 1 + s + 1;
    wsIdx.push(a, b, c, b, d, c);
  }
  const wsGeo = new THREE.BufferGeometry();
  wsGeo.setAttribute('position', new THREE.Float32BufferAttribute(wsPos, 3));
  wsGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wsUvs, 2));
  wsGeo.setIndex(wsIdx);
  wsGeo.computeVertexNormals();
  glassGroup.add(new THREE.Mesh(wsGeo, windowMat));

  // Crisp white flight-deck window mullions (center V-divider + left/right corner posts)
  for (const postFrac of [-0.5, 0, 0.5]) {
    const a0 = Math.PI * 0.5 + postFrac * 2 * 0.62;
    const a1 = Math.PI * 0.5 + postFrac * 2 * 0.74;
    const u0 = (-7.95 - rings[2].z) / (rings[3].z - rings[2].z);
    const u1 = (-6.72 - rings[2].z) / (rings[3].z - rings[2].z);
    const r0 = {
      y: THREE.MathUtils.lerp(rings[2].y, rings[3].y, u0),
      rx: THREE.MathUtils.lerp(rings[2].rx, rings[3].rx, u0),
      ry: THREE.MathUtils.lerp(rings[2].ry, rings[3].ry, u0),
      p: THREE.MathUtils.lerp(rings[2].p, rings[3].p, u0),
    };
    const r1 = {
      y: THREE.MathUtils.lerp(rings[2].y, rings[3].y, u1),
      rx: THREE.MathUtils.lerp(rings[2].rx, rings[3].rx, u1),
      ry: THREE.MathUtils.lerp(rings[2].ry, rings[3].ry, u1),
      p: THREE.MathUtils.lerp(rings[2].p, rings[3].p, u1),
    };
    const [x0, y0] = evalRing(r0, a0, 1.03);
    const [x1, y1] = evalRing(r1, a1, 1.03);
    const z0 = -7.95 + (postFrac === 0 ? -0.18 : -0.09);
    const z1 = -6.72;
    const pStart = new THREE.Vector3(x0, y0, z0);
    const pEnd = new THREE.Vector3(x1, y1, z1);
    const mLen = pStart.distanceTo(pEnd);
    const mullionGeo = new THREE.CylinderGeometry(0.042, 0.042, mLen, 5);
    const mullion = new THREE.Mesh(mullionGeo, bodyMat);
    mullion.position.addVectors(pStart, pEnd).multiplyScalar(0.5);
    mullion.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3().subVectors(pEnd, pStart).normalize()
    );
    glassGroup.add(mullion);
  }

  // 8 passenger cabin windows along each side of the airline cheatline
  const winGeo = new THREE.BoxGeometry(0.1, 0.34, 0.56);
  for (let i = 0; i < 8; i++) {
    const wz = -4.9 + i * 1.12;
    for (const side of [-1, 1]) {
      const win = new THREE.Mesh(winGeo, windowMat);
      win.position.set(side * 1.63, 0.28, wz);
      glassGroup.add(win);
    }
  }
  root.add(glassGroup);

  // ==========================================
  // 3. CAMBERED NACA AIRFOIL DC-3 WINGS & LIVERY WINGTIPS
  // ==========================================
  const wingGroup = new THREE.Group();
  wingGroup.position.set(0, -0.65, -0.6);
  root.add(wingGroup);

  // Unit-chord cambered NACA airfoil in [-0.5, +0.5]
  const buildUnitAirfoil = (thickRatio) => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.5, 0.0);
    sh.bezierCurveTo(
      -0.5,
      thickRatio * 0.82,
      -0.24,
      thickRatio * 0.96,
      0.02,
      thickRatio * 0.68
    );
    sh.quadraticCurveTo(0.28, thickRatio * 0.35, 0.5, -thickRatio * 0.05);
    sh.quadraticCurveTo(0.05, -thickRatio * 0.2, -0.32, -thickRatio * 0.26);
    sh.quadraticCurveTo(-0.5, -thickRatio * 0.2, -0.5, 0.0);
    return sh;
  };

  // Center wing section spanning between nacelles (-5.8 to +5.8, chord = 4.6)
  const unitWingAirfoil = buildUnitAirfoil(0.125);
  const centerWingGeo = new THREE.ExtrudeGeometry(unitWingAirfoil, {
    depth: 11.6,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 5,
  });
  centerWingGeo.translate(0, 0, -5.8);
  centerWingGeo.rotateY(-Math.PI / 2);
  centerWingGeo.scale(1.0, 4.6, 4.6);
  wingGroup.add(new THREE.Mesh(centerWingGeo, bodyMat));

  // Aerodynamic wing-root to belly fillet
  const bellyFairingGeo = new THREE.CylinderGeometry(
    1.68,
    1.68,
    4.65,
    12,
    1,
    false,
    0,
    Math.PI
  );
  bellyFairingGeo.rotateX(Math.PI / 2);
  bellyFairingGeo.rotateZ(Math.PI / 2);
  bellyFairingGeo.scale(0.96, 0.44, 1.0);
  bellyFairingGeo.translate(0, 0.48, 0);
  wingGroup.add(new THREE.Mesh(bellyFairingGeo, bodyMat));

  // Continuous spanwise DC-3 outer wing loft (swept LE, straight TE, rounded tip, zero seam gap!)
  const outerSpan = 10.5; // Reaches x = ±(5.8 + 10.5) = ±16.3 (matches WINGTIPS.twin)
  const splitSpan = 8.15; // Inner white wing -> outer angled livery wingtip
  const dihedralAngle = 0.08;

  const loftTaperedAirfoilSpan = (
    airfoil,
    s0,
    s1,
    totalSpan,
    stepsCount,
    leFn,
    teFn,
    thickFn,
    side
  ) => {
    const segLen = s1 - s0;
    const geo = new THREE.ExtrudeGeometry(airfoil, {
      depth: segLen,
      bevelEnabled: false,
      steps: stepsCount,
      curveSegments: 5,
    });
    // Map extruded Z -> span s in [s0, s1] along side * +X, and airfoil X -> [-0.5..+0.5] along +Z
    if (side > 0) {
      geo.translate(0, 0, -s1);
    } else {
      geo.translate(0, 0, s0);
    }
    geo.rotateY(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const s = Math.min(totalSpan, Math.max(0, Math.abs(pos.getX(i))));
      const u = pos.getZ(i) + 0.5; // 0 at leading edge, 1 at trailing edge
      const le = leFn(s);
      const te = teFn(s);
      const chord = Math.max(0.18, te - le);
      pos.setZ(i, le + u * (te - le));
      pos.setY(i, pos.getY(i) * chord * thickFn(s));
    }
    geo.computeVertexNormals();
    return geo;
  };

  // DC-3 leading/trailing edge curves with elliptical rounding over the final 1.2 units
  const wingLeAt = (s) => {
    const baseLe = -2.3 + (s / outerSpan) * 2.1; // Sweeps back from -2.3 to -0.2
    const tipT = Math.max(0, (s - (outerSpan - 1.2)) / 1.2);
    return baseLe + tipT * tipT * 0.65;
  };
  const wingTeAt = (s) => {
    const baseTe = 2.3 - (s / outerSpan) * 0.38; // Nearly straight DC-3 trailing edge
    const tipT = Math.max(0, (s - (outerSpan - 1.2)) / 1.2);
    return baseTe - tipT * tipT * 0.55;
  };
  const wingThickAt = (s) => {
    const tipT = Math.max(0, (s - (outerSpan - 1.4)) / 1.4);
    return (1 - (s / outerSpan) * 0.18) * (1 - tipT * tipT * 0.45);
  };

  for (const side of [-1, 1]) {
    const panelGroup = new THREE.Group();
    panelGroup.position.set(side * 5.8, 0.02, 0);
    panelGroup.rotation.z = side * dihedralAngle;

    const innerGeo = loftTaperedAirfoilSpan(
      unitWingAirfoil,
      0,
      splitSpan,
      outerSpan,
      2,
      wingLeAt,
      wingTeAt,
      wingThickAt,
      side
    );
    panelGroup.add(new THREE.Mesh(innerGeo, bodyMat));

    const tipGeo = loftTaperedAirfoilSpan(
      unitWingAirfoil,
      splitSpan,
      outerSpan,
      outerSpan,
      3,
      wingLeAt,
      wingTeAt,
      wingThickAt,
      side
    );
    panelGroup.add(new THREE.Mesh(tipGeo, accentMat));

    wingGroup.add(panelGroup);
  }

  // ==========================================
  // 4. SEAMLESS TWIN RADIAL NACELLES & 3-BLADE PROPELLERS
  // ==========================================
  const nacelleX = 5.8;
  const nacelleY = -0.62;
  const nacelleZ = -1.6;
  const propGroups = [];
  const gearGroups = [];

  // Shared 9-cylinder Twin Wasp radial star geometry helper
  const createEngineNacelle = (isRight) => {
    const nacelleGroup = new THREE.Group();
    const sign = isRight ? 1 : -1;
    nacelleGroup.position.set(sign * nacelleX, nacelleY, nacelleZ);

    // Seamless aft nacelle body + streamlined trailing cone (-2.05 to +5.45)
    const nacAftProfile = [
      [1.12, -2.05],
      [1.1, 0.4],
      [1.0, 2.7],
      [0.64, 4.3],
      [0.22, 5.2],
      [0.0, 5.5],
    ];
    const nacAftGeo = new THREE.LatheGeometry(
      nacAftProfile.map(([r, z]) => new THREE.Vector2(r, z)),
      14
    );
    nacAftGeo.rotateX(Math.PI / 2);
    nacAftGeo.scale(1.0, 1.14, 1.0);
    nacelleGroup.add(new THREE.Mesh(nacAftGeo, bodyMat));

    // Rounded NACA front radial cowling (-3.68 to -2.05) in player livery accent color
    const cowlProfile = [
      [0.84, -3.35], // Inner recessed cooling lip
      [0.94, -3.68], // Rounded front intake rim
      [1.08, -3.56],
      [1.13, -2.95],
      [1.122, -2.05],
    ];
    const cowlGeo = new THREE.LatheGeometry(
      cowlProfile.map(([r, z]) => new THREE.Vector2(r, z)),
      14
    );
    cowlGeo.rotateX(Math.PI / 2);
    cowlGeo.scale(1.0, 1.14, 1.0);
    nacelleGroup.add(new THREE.Mesh(cowlGeo, accentMat));

    // Classic DC-3 top carburetor ram-air scoop atop each cowling
    const carbScoopGeo = new THREE.BoxGeometry(0.42, 0.28, 1.45);
    const csPos = carbScoopGeo.attributes.position;
    for (let i = 0; i < csPos.count; i++) {
      if (csPos.getZ(i) > 0) {
        csPos.setY(i, csPos.getY(i) * 0.5 - 0.06);
        csPos.setX(i, csPos.getX(i) * 0.72);
      }
    }
    carbScoopGeo.computeVertexNormals();
    carbScoopGeo.translate(0, 1.34, -2.75);
    nacelleGroup.add(new THREE.Mesh(carbScoopGeo, accentMat));

    const scoopInletGeo = new THREE.BoxGeometry(0.3, 0.18, 0.12);
    scoopInletGeo.translate(0, 1.34, -3.44);
    nacelleGroup.add(new THREE.Mesh(scoopInletGeo, darkMat));

    // Dark cooling baffle + 9-cylinder Pratt & Whitney Twin Wasp radial star
    const baffleGeo = new THREE.CylinderGeometry(0.86, 0.86, 0.25, 14);
    baffleGeo.rotateX(Math.PI / 2);
    baffleGeo.scale(1.0, 1.12, 1.0);
    baffleGeo.translate(0, 0, -3.32);
    nacelleGroup.add(new THREE.Mesh(baffleGeo, darkMat));

    const crankcaseGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.45, 10);
    crankcaseGeo.rotateX(Math.PI / 2);
    crankcaseGeo.translate(0, 0, -3.48);
    nacelleGroup.add(new THREE.Mesh(crankcaseGeo, metalMat));

    for (let c = 0; c < 9; c++) {
      const ang = (c / 9) * Math.PI * 2;
      const cylGeo = new THREE.CylinderGeometry(0.13, 0.11, 0.48, 6);
      cylGeo.translate(0, 0.56, 0);
      cylGeo.rotateZ(ang);
      cylGeo.scale(1.0, 1.1, 1.0);
      cylGeo.translate(0, 0, -3.46);
      nacelleGroup.add(new THREE.Mesh(cylGeo, metalMat));
    }

    // Side exhaust collector stack exiting outboard lower cheek of nacelle
    const exhGeo = new THREE.CylinderGeometry(0.085, 0.1, 0.85, 7);
    exhGeo.rotateX(Math.PI / 2 + 0.18);
    exhGeo.rotateZ(sign * 0.28);
    exhGeo.translate(sign * 0.98, -0.52, -2.0);
    nacelleGroup.add(new THREE.Mesh(exhGeo, metalMat));

    // ------------------------------------------
    // Spinning 3-Blade Hamilton Standard Paddle Propeller
    // ------------------------------------------
    const pGroup = new THREE.Group();
    pGroup.position.set(0, 0, -3.75);
    nacelleGroup.add(pGroup);
    propGroups.push(pGroup);

    const basePlateGeo = new THREE.CylinderGeometry(0.34, 0.36, 0.14, 10);
    basePlateGeo.rotateX(Math.PI / 2);
    pGroup.add(new THREE.Mesh(basePlateGeo, metalMat));

    const spinnerProfile = [
      [0.0, -1.05],
      [0.18, -0.72],
      [0.3, -0.36],
      [0.35, -0.04],
    ];
    const spinnerGeo = new THREE.LatheGeometry(
      spinnerProfile.map(([r, z]) => new THREE.Vector2(r, z)),
      10
    );
    spinnerGeo.rotateX(Math.PI / 2);
    pGroup.add(new THREE.Mesh(spinnerGeo, accentMat));

    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.08, 0.22);
    bladeShape.quadraticCurveTo(-0.22, 1.1, -0.17, 2.15);
    bladeShape.lineTo(0.15, 2.15);
    bladeShape.quadraticCurveTo(0.2, 1.1, 0.08, 0.22);
    bladeShape.closePath();
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.06,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 5,
    });
    bladeGeo.translate(0, 0, -0.03);

    const tipBladeGeo = new THREE.BoxGeometry(0.32, 0.28, 0.065);
    tipBladeGeo.translate(-0.01, 2.29, 0);

    for (let b = 0; b < 3; b++) {
      const bladeHolder = new THREE.Group();
      bladeHolder.rotation.z = (b * Math.PI * 2) / 3;

      const bladeMesh = new THREE.Mesh(bladeGeo, darkMat);
      bladeMesh.rotation.y = 0.22;
      bladeHolder.add(bladeMesh);

      const tipBladeMesh = new THREE.Mesh(tipBladeGeo, propTipMat);
      tipBladeMesh.rotation.y = 0.22;
      bladeHolder.add(tipBladeMesh);

      pGroup.add(bladeHolder);
    }
    mergeStaticMeshes(pGroup);

    // ------------------------------------------
    // Main Landing Gear (under nacelle, wheelDepth preserved at ~3.29)
    // ------------------------------------------
    const mainGearGroup = new THREE.Group();
    mainGearGroup.position.set(0, -0.7, 0.2);
    mainGearGroup.userData.foldAngle = Math.PI / 2;
    nacelleGroup.add(mainGearGroup);
    gearGroups.push(mainGearGroup);

    const strutGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6);
    const strutLeft = new THREE.Mesh(strutGeo, metalMat);
    strutLeft.position.set(-0.25, -0.6, 0);
    strutLeft.rotation.z = -0.06;
    mainGearGroup.add(strutLeft);

    const strutRight = new THREE.Mesh(strutGeo, metalMat);
    strutRight.position.set(0.25, -0.6, 0);
    strutRight.rotation.z = 0.06;
    mainGearGroup.add(strutRight);

    const axleGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.75, 6);
    axleGeo.rotateZ(Math.PI / 2);
    axleGeo.translate(0, -1.35, 0);
    mainGearGroup.add(new THREE.Mesh(axleGeo, metalMat));

    const wheelGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.36, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    wheelGeo.translate(0, -1.35, 0);
    mainGearGroup.add(new THREE.Mesh(wheelGeo, tireMat));

    const hubCapGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.38, 8);
    hubCapGeo.rotateZ(Math.PI / 2);
    hubCapGeo.translate(0, -1.35, 0);
    mainGearGroup.add(new THREE.Mesh(hubCapGeo, metalMat));
    mergeStaticMeshes(mainGearGroup);

    return nacelleGroup;
  };

  root.add(createEngineNacelle(false));
  root.add(createEngineNacelle(true));

  root.propGroups = propGroups;
  root.propGroup = propGroups[0] || null;

  // ==========================================
  // 5. NOSE LANDING GEAR (Tricycle Gear)
  // ==========================================
  const noseGearGroup = new THREE.Group();
  noseGearGroup.position.set(0, -0.9, -7.8);
  noseGearGroup.userData.foldAngle = -Math.PI / 2;
  root.add(noseGearGroup);
  gearGroups.push(noseGearGroup);
  root.gearGroups = gearGroups;

  const noseStrutGeo = new THREE.CylinderGeometry(0.09, 0.08, 1.5, 6);
  const noseStrut = new THREE.Mesh(noseStrutGeo, metalMat);
  noseStrut.position.set(0, -0.55, 0);
  noseStrut.rotation.x = -0.15;
  noseGearGroup.add(noseStrut);

  const noseWheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.28, 12);
  noseWheelGeo.rotateZ(Math.PI / 2);
  noseWheelGeo.translate(0, -1.3, 0.12);
  noseGearGroup.add(new THREE.Mesh(noseWheelGeo, tireMat));

  const noseHubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8);
  noseHubGeo.rotateZ(Math.PI / 2);
  noseHubGeo.translate(0, -1.3, 0.12);
  noseGearGroup.add(new THREE.Mesh(noseHubGeo, metalMat));
  mergeStaticMeshes(noseGearGroup);

  // ==========================================
  // 6. EMPENNAGE (SWEPT DC-3 VERTICAL FIN & AIRFOIL HORIZONTAL TAIL)
  // ==========================================
  const tailGroup = new THREE.Group();
  root.add(tailGroup);

  const finShape = new THREE.Shape();
  finShape.moveTo(4.0, 0.8);
  finShape.quadraticCurveTo(6.8, 1.28, 8.35, 2.55);
  finShape.lineTo(9.2, 4.65);
  finShape.bezierCurveTo(9.65, 5.05, 10.65, 4.95, 11.05, 4.35);
  finShape.quadraticCurveTo(11.9, 3.15, 12.1, 1.15);
  finShape.lineTo(12.0, 0.75);
  finShape.lineTo(4.0, 0.8);
  finShape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.04,
    bevelThickness: 0.04,
    curveSegments: 10,
  });
  finGeo.translate(0, 0, -0.11);
  finGeo.rotateY(-Math.PI / 2);
  tailGroup.add(new THREE.Mesh(finGeo, accentMat));

  // Crisp vintage airline horizontal flash stripe across upper vertical fin
  const finStripeGeo = new THREE.BoxGeometry(0.32, 0.28, 2.05);
  finStripeGeo.translate(0, 3.92, 10.18);
  tailGroup.add(new THREE.Mesh(finStripeGeo, bodyMat));

  // Cambered airfoil DC-3 horizontal stabilizers (white inner + angled livery tips)
  const unitTailAirfoil = buildUnitAirfoil(0.11);
  const hHalfSpan = 6.3;
  const hSplitSpan = 4.65;

  const hLeAt = (s) => {
    const baseLe = -1.35 + (s / hHalfSpan) * 0.82;
    const tipT = Math.max(0, (s - (hHalfSpan - 0.85)) / 0.85);
    return baseLe + tipT * tipT * 0.42;
  };
  const hTeAt = (s) => {
    const baseTe = 1.45 - (s / hHalfSpan) * 0.55;
    const tipT = Math.max(0, (s - (hHalfSpan - 0.85)) / 0.85);
    return baseTe - tipT * tipT * 0.36;
  };
  const hThickAt = (s) => {
    const tipT = Math.max(0, (s - (hHalfSpan - 1.0)) / 1.0);
    return (1 - (s / hHalfSpan) * 0.15) * (1 - tipT * tipT * 0.48);
  };

  for (const side of [-1, 1]) {
    const hInnerGeo = loftTaperedAirfoilSpan(
      unitTailAirfoil,
      0,
      hSplitSpan,
      hHalfSpan,
      2,
      hLeAt,
      hTeAt,
      hThickAt,
      side
    );
    hInnerGeo.translate(0, 0.72, 10.2);
    tailGroup.add(new THREE.Mesh(hInnerGeo, bodyMat));

    const hTipGeo = loftTaperedAirfoilSpan(
      unitTailAirfoil,
      hSplitSpan,
      hHalfSpan,
      hHalfSpan,
      2,
      hLeAt,
      hTeAt,
      hThickAt,
      side
    );
    hTipGeo.translate(0, 0.72, 10.2);
    tailGroup.add(new THREE.Mesh(hTipGeo, accentMat));
  }

  mergeStaticMeshes(root, new Set([...propGroups, ...gearGroups]));

  root.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return root;
}

// Lowers or raises a twin's (or jet's) landing gear: 1 is down, 0 is up (folded away and
// hidden, so no tire pokes through the nacelle).
export function setGearExtension(model, extension) {
  const fold = 1 - extension;
  for (const gear of model.gearGroups) {
    if (gear.userData.foldAngle !== undefined) {
      gear.rotation.x = gear.userData.foldAngle * fold;
    } else {
      if (gear.userData.retractRotX !== undefined) {
        gear.rotation.x = gear.userData.retractRotX * fold;
      }
      if (gear.userData.retractRotZ !== undefined) {
        gear.rotation.z = gear.userData.retractRotZ * fold;
      }
    }
    gear.visible = extension > 0;
  }
}
