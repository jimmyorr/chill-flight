// --- TWIN TURBOPROP ISLAND HOPPER MODEL ("TWIN") ---
// Nimble utility/commuter twin turboprop (Beechcraft Super King Air B200 style):
// - Parabolic utility nose with side avionics louvers & sweeping twin cheatlines
// - Raked panoramic cockpit glazing with framed side pilot windows & 5 oval portholes
// - High-aspect-ratio slender low wings with pneumatic de-ice boots & livery wingtips
// - Forward-projecting PT6A turboprop nacelles with smiling chin air intakes,
//   flared cat-eye exhaust stacks, polished chrome spinners & 4-blade scimitar props
// - Tall swept T-tail with dorsal fillet, bullet pod, ventral strake & blade antennas
// - Retractable dual-wheel main gear & twin-lamp nose gear (setGearExtension)
import * as THREE from 'three';
import {createMaterial} from './constants.js';
import {
  POLICE_DARK_COLOR,
  POLICE_WHITE_COLOR,
  addAircraftPoliceBeacons,
  collectPoliceStrobeMaterials,
  createPoliceStrobeMaterials,
  mergeStaticMeshes,
} from './biplane.js';
import {state} from './state.js';

export function createTwinModel(opts = {}) {
  const root = new THREE.Group();

  const makeMat = (props) => createMaterial(props);

  const isPolice = !!opts.police;
  const planeColor = isPolice
    ? POLICE_WHITE_COLOR
    : opts.planeColor !== undefined
      ? opts.planeColor
      : typeof state.planeColor !== 'undefined'
        ? state.planeColor
        : 0xe0564c;

  const whiteColor = isPolice
    ? POLICE_DARK_COLOR
    : planeColor === 0xe8c382
      ? 0x1c3144
      : 0xf8fafc;

  const accentMat = isPolice
    ? makeMat({
        color: POLICE_WHITE_COLOR,
        flatShading: true,
        roughness: 0.36,
      })
    : opts.planeMat ||
      makeMat({
        color: planeColor,
        flatShading: true,
        roughness: 0.36,
      });

  const bodyMat = isPolice
    ? makeMat({
        color: POLICE_DARK_COLOR,
        flatShading: true,
        roughness: 0.4,
      })
    : opts.planeWhiteMat ||
      makeMat({
        color: whiteColor,
        flatShading: true,
        roughness: 0.36,
      });

  const darkMat = makeMat({
    color: 0x181f28,
    flatShading: true,
    roughness: 0.74,
  });

  const pinstripeMat = makeMat({
    color: planeColor === 0xe8c382 && !isPolice ? 0xf5d99b : 0x222c3a,
    flatShading: true,
    roughness: 0.48,
  });

  const windowMat = makeMat({
    color: 0x132235,
    flatShading: true,
    roughness: 0.14,
    metalness: 0.22,
    transparent: true,
    opacity: 0.9,
  });

  const metalMat = makeMat({
    color: 0xb8c4d0,
    flatShading: true,
    roughness: 0.32,
    metalness: 0.2,
  });

  const chromeMat = makeMat({
    color: 0xeaf0f6,
    flatShading: true,
    roughness: 0.2,
    metalness: 0.18,
  });

  const exhaustMat = makeMat({
    color: 0xa68364,
    flatShading: true,
    roughness: 0.32,
    metalness: 0.22,
  });

  const propTipMat = makeMat({
    color: 0xf1f5f9,
    flatShading: true,
    roughness: 0.34,
  });

  const lampMat = makeMat({
    color: 0xfff4d6,
    emissive: 0xffdfa0,
    emissiveIntensity: 0.35,
    flatShading: true,
    roughness: 0.18,
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
  // 1. COMPACT KING AIR B200 FUSELAGE & SWEEPING ISLAND LIVERY
  // ==========================================
  const fuselageGroup = new THREE.Group();
  root.add(fuselageGroup);

  const rings = [
    {z: -8.95, y: -0.34, rx: 0.28, ry: 0.26, p: 2.0}, // 0: Parabolic nose radome
    {z: -8.05, y: -0.23, rx: 0.76, ry: 0.68, p: 2.06}, // 1: Forward utility nose cone
    {z: -6.85, y: -0.09, rx: 1.08, ry: 0.98, p: 2.15}, // 2: Avionics & louver bay
    {z: -5.55, y: 0.04, rx: 1.28, ry: 1.16, p: 2.25}, // 3: Windshield sill
    {z: -4.05, y: 0.24, rx: 1.38, ry: 1.5, p: 2.45}, // 4: Raked cockpit crown
    {z: -1.6, y: 0.24, rx: 1.4, ry: 1.52, p: 2.48}, // 5: Forward cabin
    {z: 1.75, y: 0.24, rx: 1.35, ry: 1.48, p: 2.4}, // 6: Aft cabin (behind 5th porthole)
    {z: 4.45, y: 0.36, rx: 1.02, ry: 1.16, p: 2.2}, // 7: Upswept STOL tailcone
    {z: 7.05, y: 0.56, rx: 0.54, ry: 0.76, p: 2.08}, // 8: T-tail fin base
    {z: 8.65, y: 0.7, rx: 0.14, ry: 0.26, p: 2.0}, // 9: Tailcone tip
  ];

  const interpStation = (zVal) => {
    if (zVal <= rings[0].z) return {...rings[0], z: zVal};
    const last = rings[rings.length - 1];
    if (zVal >= last.z) return {...last, z: zVal};
    for (let i = 0; i < rings.length - 1; i++) {
      const a = rings[i];
      const b = rings[i + 1];
      if (zVal <= b.z) {
        const u = (zVal - a.z) / (b.z - a.z);
        return {
          z: zVal,
          y: THREE.MathUtils.lerp(a.y, b.y, u),
          rx: THREE.MathUtils.lerp(a.rx, b.rx, u),
          ry: THREE.MathUtils.lerp(a.ry, b.ry, u),
          p: THREE.MathUtils.lerp(a.p, b.p, u),
        };
      }
    }
    return {...last, z: zVal};
  };

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
  positions.push(0, rings[0].y - 0.01, rings[0].z - 0.18);
  uvs.push(0.5, 0);
  for (let s = 0; s < segments; s++) {
    indices.push(frontCenterIdx, s + 1, s);
  }

  const lastRingStart = (rings.length - 1) * fStride;
  const rearCenterIdx = positions.length / 3;
  positions.push(
    0,
    rings[rings.length - 1].y,
    rings[rings.length - 1].z + 0.14
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

  // Smooth rounded white radome nose cap (seamless nose tip like King Air B200)
  const noseCapGeo = new THREE.SphereGeometry(0.28, 10, 8);
  noseCapGeo.scale(1.0, 0.93, 1.15);
  noseCapGeo.translate(0, -0.34, -8.98);
  fuselageGroup.add(new THREE.Mesh(noseCapGeo, bodyMat));

  // Conformal ribbon builder along fuselage flanks (sweeping under windows & up tailcone)
  const addConformalRibbon = (zStops, liftFn, spanFn, scale, mat) => {
    for (const side of [-1, 1]) {
      const sPos = [];
      const sUvs = [];
      const sIdx = [];
      const bandRows = 2;
      for (let i = 0; i < zStops.length; i++) {
        const zVal = zStops[i];
        const st = interpStation(zVal);
        const t = i / (zStops.length - 1);
        const lift = liftFn(zVal, t);
        const halfSpan = spanFn(zVal, t);
        const centerAngle = side > 0 ? lift : Math.PI - lift;
        for (let k = 0; k <= bandRows; k++) {
          const frac = k / bandRows - 0.5;
          const theta = centerAngle + frac * 2 * halfSpan;
          const [x, y] = evalRing(st, theta, scale);
          sPos.push(x, y, zVal);
          sUvs.push(k / bandRows, t);
        }
      }
      const sStride = bandRows + 1;
      for (let i = 0; i < zStops.length - 1; i++) {
        for (let k = 0; k < bandRows; k++) {
          const a = i * sStride + k;
          const b = i * sStride + k + 1;
          const c = (i + 1) * sStride + k;
          const d = (i + 1) * sStride + k + 1;
          sIdx.push(a, b, c, b, d, c);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(sUvs, 2));
      geo.setIndex(sIdx);
      geo.computeVertexNormals();
      fuselageGroup.add(new THREE.Mesh(geo, mat));
    }
  };

  // Primary sweeping King Air cheatline (wraps nose chine, glides below portholes, sweeps up tailcone)
  const stripeZs = [-8.92, -8.0, -6.7, -5.3, -3.2, 1.5, 4.3, 6.4, 7.8];
  const mainLift = (z) => {
    if (z < -5.3) return -0.1 - ((z + 5.3) / 3.62) * 0.08;
    if (z <= 1.5) return -0.1;
    const u = (z - 1.5) / 6.3;
    return -0.1 + u * u * 0.46;
  };
  addConformalRibbon(
    stripeZs,
    mainLift,
    (_z, t) =>
      0.088 * Math.sin(Math.min(1, t * 5.0) * (Math.PI * 0.5)) * (1 - t * 0.35),
    1.016,
    accentMat
  );

  // Crisp companion lower pinstripe (signature multi-tone King Air B200 trim)
  if (!isPolice) {
    addConformalRibbon(
      [-8.55, -7.4, -5.3, -3.0, 1.5, 4.3, 6.2, 7.4],
      (z) => mainLift(z) - 0.12,
      (_z, t) => 0.03 * (1 - t * 0.32),
      1.016,
      pinstripeMat
    );
  }

  // Signature King Air 5-slot avionics cooling louvers on forward nose cheeks
  for (const side of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      const lz = -7.28 + k * 0.13;
      const st = interpStation(lz);
      const theta = side > 0 ? 0.08 : Math.PI - 0.08;
      const [lx, ly] = evalRing(st, theta, 1.018);
      const slotGeo = new THREE.BoxGeometry(0.03, 0.25, 0.052);
      const slot = new THREE.Mesh(slotGeo, darkMat);
      slot.position.set(lx, ly, lz);
      slot.rotation.y = side * -0.18;
      fuselageGroup.add(slot);
    }
  }

  // Helper to build outward-normalled conformal curved patches on fuselage
  const buildConformalPatch = (pts3d, outwardDir, mat) => {
    const cx = pts3d.reduce((acc, p) => acc + p[0], 0) / pts3d.length;
    const cy = pts3d.reduce((acc, p) => acc + p[1], 0) / pts3d.length;
    const cz = pts3d.reduce((acc, p) => acc + p[2], 0) / pts3d.length;
    const pos = [cx, cy, cz];
    const uv = [0.5, 0.5];
    for (let i = 0; i < pts3d.length; i++) {
      pos.push(pts3d[i][0], pts3d[i][1], pts3d[i][2]);
      const ang = (i / pts3d.length) * Math.PI * 2;
      uv.push(0.5 + 0.5 * Math.cos(ang), 0.5 + 0.5 * Math.sin(ang));
    }
    const idx = [];
    const e1 = new THREE.Vector3(
      pts3d[0][0] - cx,
      pts3d[0][1] - cy,
      pts3d[0][2] - cz
    );
    const e2 = new THREE.Vector3(
      pts3d[1][0] - cx,
      pts3d[1][1] - cy,
      pts3d[1][2] - cz
    );
    const flip = e1.cross(e2).dot(outwardDir) < 0;
    for (let i = 0; i < pts3d.length; i++) {
      const a = 1 + i;
      const b = 1 + ((i + 1) % pts3d.length);
      if (flip) idx.push(0, b, a);
      else idx.push(0, a, b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  };

  // ==========================================
  // 2. WRAP-AROUND PANORAMIC COCKPIT WINDOWS & 5 OVAL PORTHOLES
  // ==========================================
  const glassGroup = new THREE.Group();
  root.add(glassGroup);

  // Continuous wrap-around cockpit glazing (-5.48 front sill back to -3.48 side pilot panes)
  // Columns: 0=right aft side, 2=right A-pillar, 5=center V-post, 8=left A-pillar, 10=left aft side
  const cCols = [
    {arc: -1.18, z0: -4.62, z1: -3.48},
    {arc: -0.92, z0: -5.05, z1: -3.72},
    {arc: -0.62, z0: -5.42, z1: -4.08},
    {arc: -0.31, z0: -5.54, z1: -4.14},
    {arc: 0.0, z0: -5.66, z1: -4.16},
    {arc: 0.31, z0: -5.54, z1: -4.14},
    {arc: 0.62, z0: -5.42, z1: -4.08},
    {arc: 0.92, z0: -5.05, z1: -3.72},
    {arc: 1.18, z0: -4.62, z1: -3.48},
  ];
  const wsPos = [];
  const wsUvs = [];
  const wsIdx = [];
  for (let row = 0; row <= 1; row++) {
    for (let c = 0; c < cCols.length; c++) {
      const col = cCols[c];
      const zVal = row === 0 ? col.z0 : col.z1;
      const st = interpStation(zVal);
      const scaleArc = row === 0 ? 1.0 : 0.86;
      const theta = Math.PI * 0.5 + col.arc * scaleArc;
      const [x, y] = evalRing(st, theta, 1.02);
      wsPos.push(x, y, zVal);
      wsUvs.push(c / (cCols.length - 1), row);
    }
  }
  const cStride = cCols.length;
  for (let c = 0; c < cCols.length - 1; c++) {
    const a = c;
    const b = c + 1;
    const d = cStride + c;
    const e = cStride + c + 1;
    wsIdx.push(a, b, d, b, e, d);
  }
  const wsGeo = new THREE.BufferGeometry();
  wsGeo.setAttribute('position', new THREE.Float32BufferAttribute(wsPos, 3));
  wsGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wsUvs, 2));
  wsGeo.setIndex(wsIdx);
  wsGeo.computeVertexNormals();
  glassGroup.add(new THREE.Mesh(wsGeo, windowMat));

  // Crisp white structural cockpit pillars (center divider, corner posts & wider side window B-pillar)
  for (const colIdx of [1, 2, 4, 6, 7]) {
    const col = cCols[colIdx];
    const st0 = interpStation(col.z0);
    const st1 = interpStation(col.z1);
    const [x0, y0] = evalRing(st0, Math.PI * 0.5 + col.arc, 1.028);
    const [x1, y1] = evalRing(st1, Math.PI * 0.5 + col.arc * 0.86, 1.028);
    const pStart = new THREE.Vector3(x0, y0, col.z0);
    const pEnd = new THREE.Vector3(x1, y1, col.z1);
    const mLen = pStart.distanceTo(pEnd);
    const rPost = colIdx === 1 || colIdx === 7 ? 0.062 : 0.032;
    const mullionGeo = new THREE.CylinderGeometry(rPost, rPost, mLen, 5);
    const mullion = new THREE.Mesh(mullionGeo, bodyMat);
    mullion.position.addVectors(pStart, pEnd).multiplyScalar(0.5);
    mullion.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3().subVectors(pEnd, pStart).normalize()
    );
    glassGroup.add(mullion);
  }

  // Dual dark windshield wipers tucked along lower front panes
  for (const side of [-1, 1]) {
    const stW0 = interpStation(-5.58);
    const stW1 = interpStation(-5.1);
    const [wx0, wy0] = evalRing(stW0, Math.PI * 0.5 - side * 0.1, 1.03);
    const [wx1, wy1] = evalRing(stW1, Math.PI * 0.5 - side * 0.28, 1.03);
    const p0 = new THREE.Vector3(wx0, wy0, -5.62);
    const p1 = new THREE.Vector3(wx1, wy1, -5.1);
    const wGeo = new THREE.CylinderGeometry(0.018, 0.015, p0.distanceTo(p1), 4);
    const wiper = new THREE.Mesh(wGeo, darkMat);
    wiper.position.addVectors(p0, p1).multiplyScalar(0.5);
    wiper.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3().subVectors(p1, p0).normalize()
    );
    glassGroup.add(wiper);
  }

  // 5 iconic oval King Air cabin porthole windows per side (spanning -2.68 to +1.32)
  const portholeCount = 5;
  const portholeSegs = 10;
  for (let i = 0; i < portholeCount; i++) {
    const wz = -2.68 + i * 1.0;
    for (const side of [-1, 1]) {
      const outDir = new THREE.Vector3(side, 0.1, 0).normalize();
      const centerLift = 0.22;
      const bezelPts = [];
      const glassPts = [];
      for (let k = 0; k < portholeSegs; k++) {
        const ang = (k / portholeSegs) * Math.PI * 2;
        const dzB = 0.275 * Math.cos(ang);
        const dThB = 0.21 * Math.sin(ang);
        const stB = interpStation(wz + dzB);
        const thB =
          side > 0 ? centerLift + dThB : Math.PI - (centerLift + dThB);
        const [bx, by] = evalRing(stB, thB, 1.015);
        bezelPts.push([bx, by, wz + dzB]);

        const dzG = 0.235 * Math.cos(ang);
        const dThG = 0.178 * Math.sin(ang);
        const stG = interpStation(wz + dzG);
        const thG =
          side > 0 ? centerLift + dThG : Math.PI - (centerLift + dThG);
        const [gx, gy] = evalRing(stG, thG, 1.021);
        glassPts.push([gx, gy, wz + dzG]);
      }
      glassGroup.add(buildConformalPatch(bezelPts, outDir, metalMat));
      glassGroup.add(buildConformalPatch(glassPts, outDir, windowMat));
    }
  }

  // ==========================================
  // 3. SLENDER HIGH-ASPECT LOW WINGS, DE-ICE BOOTS & LIVERY WINGTIPS
  // ==========================================
  const wingGroup = new THREE.Group();
  wingGroup.position.set(0, -0.68, -0.75);
  root.add(wingGroup);

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

  // Crisp leading-edge pneumatic de-ice boot cap shape (front 8% of airfoil)
  const buildDeIceBootShape = (thickRatio) => {
    const sh = new THREE.Shape();
    const s = 1.035;
    sh.moveTo(-0.503, 0.0);
    sh.bezierCurveTo(
      -0.503,
      thickRatio * 0.82 * s,
      -0.465,
      thickRatio * 0.9 * s,
      -0.42,
      thickRatio * 0.88 * s
    );
    sh.lineTo(-0.42, -thickRatio * 0.24 * s);
    sh.quadraticCurveTo(-0.475, -thickRatio * 0.2 * s, -0.503, 0.0);
    return sh;
  };

  const nacelleX = 4.65;
  const rootChord = 3.45;
  const unitWingAirfoil = buildUnitAirfoil(0.13);
  const unitBootShape = buildDeIceBootShape(0.13);

  // Center wing section spanning between nacelles (-4.65 to +4.65)
  const centerWingGeo = new THREE.ExtrudeGeometry(unitWingAirfoil, {
    depth: nacelleX * 2,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 4,
  });
  centerWingGeo.translate(0, 0, -nacelleX);
  centerWingGeo.rotateY(-Math.PI / 2);
  centerWingGeo.scale(1.0, rootChord, rootChord);
  wingGroup.add(new THREE.Mesh(centerWingGeo, bodyMat));

  // Streamlined wing-root to cabin belly fairing
  const bellyFairingGeo = new THREE.CylinderGeometry(
    1.44,
    1.44,
    4.15,
    10,
    1,
    false,
    0,
    Math.PI
  );
  bellyFairingGeo.rotateX(Math.PI / 2);
  bellyFairingGeo.rotateZ(Math.PI / 2);
  bellyFairingGeo.scale(0.96, 0.4, 1.0);
  bellyFairingGeo.translate(0, 0.34, -0.05);
  wingGroup.add(new THREE.Mesh(bellyFairingGeo, bodyMat));

  // Long high-aspect-ratio King Air outer wing panels: x = ±(4.65 + 11.15) = ±15.8
  const outerSpan = 11.15;
  const splitSpan = 9.05;
  const dihedralAngle = 0.095;

  const loftTaperedAirfoilSpan = (
    airfoil,
    s0,
    s1,
    totalSpan,
    stepsCount,
    leFn,
    teFn,
    thickFn,
    side,
    tipLiftFn = null
  ) => {
    const segLen = s1 - s0;
    const geo = new THREE.ExtrudeGeometry(airfoil, {
      depth: segLen,
      bevelEnabled: false,
      steps: stepsCount,
      curveSegments: 4,
    });
    if (side > 0) {
      geo.translate(0, 0, -s1);
    } else {
      geo.translate(0, 0, s0);
    }
    geo.rotateY(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const s = Math.min(totalSpan, Math.max(0, Math.abs(pos.getX(i))));
      const u = pos.getZ(i) + 0.5;
      const le = leFn(s);
      const te = teFn(s);
      const chord = Math.max(0.16, te - le);
      pos.setZ(i, le + u * (te - le));
      const lift = tipLiftFn ? tipLiftFn(s) : 0;
      pos.setY(i, pos.getY(i) * chord * thickFn(s) + lift);
    }
    geo.computeVertexNormals();
    return geo;
  };

  const wingLeAt = (s) => {
    const baseLe = -1.72 + (s / outerSpan) * 1.24;
    const tipT = Math.max(0, (s - (outerSpan - 1.0)) / 1.0);
    return baseLe + tipT * tipT * 0.48;
  };
  const wingTeAt = (s) => {
    const baseTe = 1.72 - (s / outerSpan) * 0.78;
    const tipT = Math.max(0, (s - (outerSpan - 1.0)) / 1.0);
    return baseTe - tipT * tipT * 0.34;
  };
  const wingThickAt = (s) => {
    const tipT = Math.max(0, (s - (outerSpan - 1.2)) / 1.2);
    return (1 - (s / outerSpan) * 0.22) * (1 - tipT * tipT * 0.52);
  };
  const wingTipLiftAt = (s) => {
    const tipT = Math.max(0, (s - (outerSpan - 1.3)) / 1.3);
    return tipT * tipT * 0.14;
  };

  for (const side of [-1, 1]) {
    const panelGroup = new THREE.Group();
    panelGroup.position.set(side * nacelleX, 0.02, 0);
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
      side,
      wingTipLiftAt
    );
    panelGroup.add(new THREE.Mesh(innerGeo, bodyMat));

    if (!isPolice) {
      const bootGeo = loftTaperedAirfoilSpan(
        unitBootShape,
        0.78,
        splitSpan,
        outerSpan,
        2,
        wingLeAt,
        wingTeAt,
        wingThickAt,
        side,
        wingTipLiftAt
      );
      panelGroup.add(new THREE.Mesh(bootGeo, darkMat));
    }

    const tipGeo = loftTaperedAirfoilSpan(
      unitWingAirfoil,
      splitSpan,
      outerSpan,
      outerSpan,
      2,
      wingLeAt,
      wingTeAt,
      wingThickAt,
      side,
      wingTipLiftAt
    );
    panelGroup.add(new THREE.Mesh(tipGeo, accentMat));

    wingGroup.add(panelGroup);
  }

  // ==========================================
  // 4. PT6A TURBOPROP NACELLES, CHIN SCOOPS, CAT-EYE EXHAUSTS & 4-BLADE PROPS
  // ==========================================
  const nacelleY = -0.56;
  const nacelleZ = -1.55;
  const propGroups = [];
  const gearGroups = [];

  const createTurbopropNacelle = (isRight) => {
    const nacelleGroup = new THREE.Group();
    const sign = isRight ? 1 : -1;
    nacelleGroup.position.set(sign * nacelleX, nacelleY, nacelleZ);

    // Streamlined oval turboprop nacelle loft (-3.55 right behind spinner to +3.85 trailing cone)
    const nacStations = [
      {z: -3.55, y: 0.06, rx: 0.41, ry: 0.41, p: 2.0}, // Spinner collar
      {z: -3.02, y: 0.0, rx: 0.66, ry: 0.58, p: 2.15}, // Exhaust cheek zone
      {z: -2.1, y: -0.04, rx: 0.84, ry: 0.78, p: 2.25}, // Forward turbine cowl
      {z: -0.8, y: -0.04, rx: 0.86, ry: 0.8, p: 2.25}, // Over wing LE
      {z: 1.45, y: -0.02, rx: 0.78, ry: 0.74, p: 2.18}, // Over wing TE
      {z: 2.9, y: 0.02, rx: 0.46, ry: 0.48, p: 2.08}, // Aft fairing taper
      {z: 3.85, y: 0.05, rx: 0.08, ry: 0.1, p: 2.0}, // Trailing point
    ];

    const nSegs = 12;
    const nPos = [];
    const nUvs = [];
    const nIdx = [];
    for (let r = 0; r < nacStations.length; r++) {
      const st = nacStations[r];
      for (let s = 0; s <= nSegs; s++) {
        const ang = (s / nSegs) * Math.PI * 2;
        const [x, y] = evalRing(st, ang);
        nPos.push(x, y, st.z);
        nUvs.push(s / nSegs, r / (nacStations.length - 1));
      }
    }
    const nStride = nSegs + 1;
    for (let r = 0; r < nacStations.length - 1; r++) {
      for (let s = 0; s < nSegs; s++) {
        const a = r * nStride + s;
        const b = r * nStride + s + 1;
        const c = (r + 1) * nStride + s;
        const d = (r + 1) * nStride + s + 1;
        nIdx.push(a, b, c, b, d, c);
      }
    }
    const nFrontIdx = nPos.length / 3;
    nPos.push(0, 0.06, -3.57);
    nUvs.push(0.5, 0);
    for (let s = 0; s < nSegs; s++) nIdx.push(nFrontIdx, s + 1, s);

    const nRearStart = (nacStations.length - 1) * nStride;
    const nRearIdx = nPos.length / 3;
    nPos.push(0, 0.05, 3.92);
    nUvs.push(0.5, 1);
    for (let s = 0; s < nSegs; s++) {
      nIdx.push(nRearIdx, nRearStart + s, nRearStart + s + 1);
    }

    const nacGeo = new THREE.BufferGeometry();
    nacGeo.setAttribute('position', new THREE.Float32BufferAttribute(nPos, 3));
    nacGeo.setAttribute('uv', new THREE.Float32BufferAttribute(nUvs, 2));
    nacGeo.setIndex(nIdx);
    nacGeo.computeVertexNormals();
    nacelleGroup.add(new THREE.Mesh(nacGeo, bodyMat));

    // Painted two-tone upper forward PT6 cowling crown
    const crownPos = [];
    const crownUvs = [];
    const crownIdx = [];
    const crownCols = 8;
    const crownEndR = 4;
    for (let r = 0; r <= crownEndR; r++) {
      const st = nacStations[r];
      const halfSpan = r === crownEndR ? 0.5 : 0.9 - r * 0.06;
      for (let s = 0; s <= crownCols; s++) {
        const ang = Math.PI * 0.5 + (s / crownCols - 0.5) * 2 * halfSpan;
        const [x, y] = evalRing(st, ang, 1.018);
        crownPos.push(x, y, st.z);
        crownUvs.push(s / crownCols, r / crownEndR);
      }
    }
    const cStrideN = crownCols + 1;
    for (let r = 0; r < crownEndR; r++) {
      for (let s = 0; s < crownCols; s++) {
        const a = r * cStrideN + s;
        const b = r * cStrideN + s + 1;
        const c = (r + 1) * cStrideN + s;
        const d = (r + 1) * cStrideN + s + 1;
        crownIdx.push(a, b, c, b, d, c);
      }
    }
    const crownGeo = new THREE.BufferGeometry();
    crownGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(crownPos, 3)
    );
    crownGeo.setAttribute('uv', new THREE.Float32BufferAttribute(crownUvs, 2));
    crownGeo.setIndex(crownIdx);
    crownGeo.computeVertexNormals();
    nacelleGroup.add(new THREE.Mesh(crownGeo, accentMat));

    // Iconic PT6 smiling chin air intake scoop directly beneath chrome spinner
    const chinScoopGeo = new THREE.CylinderGeometry(0.38, 0.46, 1.45, 10);
    chinScoopGeo.rotateX(Math.PI / 2);
    chinScoopGeo.scale(1.22, 0.72, 1.0);
    chinScoopGeo.translate(0, -0.44, -2.76);
    nacelleGroup.add(new THREE.Mesh(chinScoopGeo, bodyMat));

    const chinRimGeo = new THREE.TorusGeometry(0.29, 0.055, 5, 10);
    chinRimGeo.scale(1.34, 0.72, 0.8);
    chinRimGeo.translate(0, -0.43, -3.46);
    nacelleGroup.add(new THREE.Mesh(chinRimGeo, chromeMat));

    const chinMouthGeo = new THREE.CylinderGeometry(0.28, 0.26, 0.22, 8);
    chinMouthGeo.rotateX(Math.PI / 2);
    chinMouthGeo.scale(1.3, 0.68, 1.0);
    chinMouthGeo.translate(0, -0.43, -3.38);
    nacelleGroup.add(new THREE.Mesh(chinMouthGeo, darkMat));

    // Twin flared PT6 "cat-eye" exhaust stacks on both forward cheeks
    for (const cheek of [-1, 1]) {
      const stackHolder = new THREE.Group();
      stackHolder.position.set(cheek * 0.6, 0.0, -3.0);
      stackHolder.rotation.y = cheek * -0.48;
      stackHolder.rotation.z = cheek * -0.08;

      const pipeGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.56, 7);
      pipeGeo.rotateX(Math.PI / 2);
      pipeGeo.scale(1.45, 0.68, 1.0);
      stackHolder.add(new THREE.Mesh(pipeGeo, exhaustMat));

      const boreGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.08, 7);
      boreGeo.rotateX(Math.PI / 2);
      boreGeo.scale(1.38, 0.62, 1.0);
      boreGeo.translate(0, 0, 0.26);
      stackHolder.add(new THREE.Mesh(boreGeo, darkMat));

      nacelleGroup.add(stackHolder);
    }

    // ------------------------------------------
    // Spinning 4-Blade Scimitar Turboprop & Polished Chrome Spinner
    // ------------------------------------------
    const pGroup = new THREE.Group();
    pGroup.position.set(0, 0.06, -3.62);
    pGroup.userData.spinScale = 0.85;
    nacelleGroup.add(pGroup);
    propGroups.push(pGroup);

    const spinnerProfile = [
      [0.0, -1.16],
      [0.15, -0.84],
      [0.29, -0.48],
      [0.38, -0.16],
      [0.4, 0.02],
    ];
    const spinnerGeo = new THREE.LatheGeometry(
      spinnerProfile.map(([r, z]) => new THREE.Vector2(r, z)),
      10
    );
    spinnerGeo.rotateX(Math.PI / 2);
    pGroup.add(new THREE.Mesh(spinnerGeo, chromeMat));

    const backPlateGeo = new THREE.CylinderGeometry(0.39, 0.39, 0.06, 10);
    backPlateGeo.rotateX(Math.PI / 2);
    pGroup.add(new THREE.Mesh(backPlateGeo, metalMat));

    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.075, 0.24);
    bladeShape.quadraticCurveTo(-0.205, 0.98, -0.145, 2.04);
    bladeShape.quadraticCurveTo(-0.04, 2.12, 0.11, 2.04);
    bladeShape.quadraticCurveTo(0.185, 1.08, 0.075, 0.24);
    bladeShape.closePath();
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.05,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 4,
    });
    bladeGeo.translate(0, 0, -0.025);

    const tipStripeGeo = new THREE.BoxGeometry(0.25, 0.15, 0.056);
    tipStripeGeo.translate(-0.015, 1.9, 0);

    const phaseOffset = isRight ? 0.26 : 0;
    for (let b = 0; b < 4; b++) {
      const bladeHolder = new THREE.Group();
      bladeHolder.rotation.z = phaseOffset + (b * Math.PI) / 2;

      const bladeMesh = new THREE.Mesh(bladeGeo, darkMat);
      bladeMesh.rotation.y = 0.26;
      bladeHolder.add(bladeMesh);

      const tipMesh = new THREE.Mesh(tipStripeGeo, propTipMat);
      tipMesh.rotation.y = 0.26;
      bladeHolder.add(tipMesh);

      pGroup.add(bladeHolder);
    }
    mergeStaticMeshes(pGroup);

    // ------------------------------------------
    // Dual-Wheel Main Landing Gear (wheel bottom y = -0.56 - 0.52 - 1.54 - 0.46 = -3.08)
    // ------------------------------------------
    const mainGearGroup = new THREE.Group();
    mainGearGroup.position.set(0, -0.52, 0.2);
    mainGearGroup.userData.foldAngle = Math.PI / 2;
    nacelleGroup.add(mainGearGroup);
    gearGroups.push(mainGearGroup);

    const oleoGeo = new THREE.CylinderGeometry(0.085, 0.072, 1.52, 6);
    oleoGeo.translate(0, -0.76, 0);
    mainGearGroup.add(new THREE.Mesh(oleoGeo, metalMat));

    const braceGeo = new THREE.CylinderGeometry(0.048, 0.048, 1.02, 5);
    const brace = new THREE.Mesh(braceGeo, metalMat);
    brace.position.set(0, -0.5, -0.25);
    brace.rotation.x = 0.46;
    mainGearGroup.add(brace);

    const doorGeo = new THREE.BoxGeometry(0.05, 0.44, 0.72);
    const doorMesh = new THREE.Mesh(doorGeo, bodyMat);
    doorMesh.position.set(sign * 0.34, -0.22, 0.02);
    doorMesh.rotation.z = sign * 0.16;
    mainGearGroup.add(doorMesh);

    const axleGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.68, 6);
    axleGeo.rotateZ(Math.PI / 2);
    axleGeo.translate(0, -1.54, 0);
    mainGearGroup.add(new THREE.Mesh(axleGeo, metalMat));

    for (const wSide of [-1, 1]) {
      const wheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.21, 10);
      wheelGeo.rotateZ(Math.PI / 2);
      wheelGeo.translate(wSide * 0.24, -1.54, 0);
      mainGearGroup.add(new THREE.Mesh(wheelGeo, tireMat));

      const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.23, 8);
      hubGeo.rotateZ(Math.PI / 2);
      hubGeo.translate(wSide * 0.24, -1.54, 0);
      mainGearGroup.add(new THREE.Mesh(hubGeo, chromeMat));
    }
    mergeStaticMeshes(mainGearGroup);

    return nacelleGroup;
  };

  root.add(createTurbopropNacelle(false));
  root.add(createTurbopropNacelle(true));

  root.propGroups = propGroups;
  root.propGroup = propGroups[0] || null;

  // ==========================================
  // 5. TWIN-LAMP NOSE LANDING GEAR (wheel bottom y = -0.86 - 1.82 - 0.40 = -3.08)
  // ==========================================
  const noseGearGroup = new THREE.Group();
  noseGearGroup.position.set(0, -0.86, -6.75);
  noseGearGroup.userData.foldAngle = -Math.PI / 2;
  root.add(noseGearGroup);
  gearGroups.push(noseGearGroup);
  root.gearGroups = gearGroups;

  const noseStrutGeo = new THREE.CylinderGeometry(0.085, 0.072, 1.74, 6);
  const noseStrut = new THREE.Mesh(noseStrutGeo, metalMat);
  noseStrut.position.set(0, -0.85, 0.04);
  noseStrut.rotation.x = -0.06;
  noseGearGroup.add(noseStrut);

  // Twin King Air nose-strut taxi/landing lights
  for (const lx of [-0.11, 0.11]) {
    const housingGeo = new THREE.CylinderGeometry(0.085, 0.075, 0.12, 8);
    housingGeo.rotateX(Math.PI / 2);
    housingGeo.translate(lx, -0.52, -0.1);
    noseGearGroup.add(new THREE.Mesh(housingGeo, chromeMat));

    const lensGeo = new THREE.CylinderGeometry(0.068, 0.068, 0.03, 8);
    lensGeo.rotateX(Math.PI / 2);
    lensGeo.translate(lx, -0.52, -0.16);
    noseGearGroup.add(new THREE.Mesh(lensGeo, lampMat));
  }

  // Angled under-chin forward nose-bay door fairing (King Air signature chin detail)
  const noseDoorGeo = new THREE.BoxGeometry(0.46, 0.28, 1.05);
  const noseDoor = new THREE.Mesh(noseDoorGeo, bodyMat);
  noseDoor.position.set(0, -0.18, 0.58);
  noseDoor.rotation.x = 0.14;
  noseGearGroup.add(noseDoor);

  const noseWheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.25, 10);
  noseWheelGeo.rotateZ(Math.PI / 2);
  noseWheelGeo.translate(0, -1.82, 0.1);
  noseGearGroup.add(new THREE.Mesh(noseWheelGeo, tireMat));

  const noseHubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.27, 8);
  noseHubGeo.rotateZ(Math.PI / 2);
  noseHubGeo.translate(0, -1.82, 0.1);
  noseGearGroup.add(new THREE.Mesh(noseHubGeo, chromeMat));
  mergeStaticMeshes(noseGearGroup);

  // ==========================================
  // 6. TALL SWEPT T-TAIL EMPENNAGE, VENTRAL STRAKE & ANTENNAS
  // ==========================================
  const tailGroup = new THREE.Group();
  root.add(tailGroup);

  // Forward dorsal fin fillet rising right behind cabin portholes
  const dorsalShape = new THREE.Shape();
  dorsalShape.moveTo(2.05, 1.54);
  dorsalShape.quadraticCurveTo(4.3, 1.65, 5.75, 2.08);
  dorsalShape.lineTo(7.1, 2.08);
  dorsalShape.lineTo(7.1, 0.95);
  dorsalShape.lineTo(2.05, 1.38);
  dorsalShape.closePath();
  const dorsalGeo = new THREE.ExtrudeGeometry(dorsalShape, {
    depth: 0.18,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 5,
  });
  dorsalGeo.translate(0, 0, -0.09);
  dorsalGeo.rotateY(-Math.PI / 2);
  tailGroup.add(new THREE.Mesh(dorsalGeo, bodyMat));

  // Tall swept King Air T-tail vertical stabilizer in player livery accent
  const finShape = new THREE.Shape();
  finShape.moveTo(5.65, 2.02);
  finShape.lineTo(8.38, 4.86);
  finShape.lineTo(9.96, 4.86);
  finShape.lineTo(8.72, 0.78);
  finShape.lineTo(6.45, 0.98);
  finShape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.03,
    bevelThickness: 0.03,
    curveSegments: 3,
  });
  finGeo.translate(0, 0, -0.12);
  finGeo.rotateY(-Math.PI / 2);
  tailGroup.add(new THREE.Mesh(finGeo, accentMat));

  // Crisp swept white speed-flash ribbon across vertical fin
  const flashShape = new THREE.Shape();
  flashShape.moveTo(6.32, 2.52);
  flashShape.lineTo(9.04, 2.94);
  flashShape.lineTo(9.16, 3.28);
  flashShape.lineTo(6.65, 2.86);
  flashShape.closePath();
  const flashGeo = new THREE.ExtrudeGeometry(flashShape, {
    depth: 0.32,
    bevelEnabled: false,
    steps: 1,
  });
  flashGeo.translate(0, 0, -0.16);
  flashGeo.rotateY(-Math.PI / 2);
  tailGroup.add(new THREE.Mesh(flashGeo, bodyMat));

  // Matte-black leading-edge de-ice boot along vertical stabilizer
  if (!isPolice) {
    const finBootStart = new THREE.Vector3(0, 2.1, 5.72);
    const finBootEnd = new THREE.Vector3(0, 4.8, 8.32);
    const fbLen = finBootStart.distanceTo(finBootEnd);
    const fbGeo = new THREE.CylinderGeometry(0.055, 0.065, fbLen, 6);
    const fbMesh = new THREE.Mesh(fbGeo, darkMat);
    fbMesh.position.addVectors(finBootStart, finBootEnd).multiplyScalar(0.5);
    fbMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3().subVectors(finBootEnd, finBootStart).normalize()
    );
    tailGroup.add(fbMesh);
  }

  // Streamlined T-tail bullet pod crowning the fin/stabilizer junction
  const podProfile = [
    [0.0, -1.2],
    [0.15, -0.78],
    [0.2, -0.08],
    [0.16, 0.72],
    [0.0, 1.28],
  ];
  const podGeo = new THREE.LatheGeometry(
    podProfile.map(([r, z]) => new THREE.Vector2(r, z)),
    8
  );
  podGeo.rotateX(Math.PI / 2);
  podGeo.scale(0.95, 0.85, 1.0);
  podGeo.translate(0, 4.86, 9.02);
  tailGroup.add(new THREE.Mesh(podGeo, accentMat));

  // High-mounted T-tail horizontal stabilizer (y = 4.84, z = 9.05, half-span = 4.85)
  const unitTailAirfoil = buildUnitAirfoil(0.105);
  const unitTailBoot = buildDeIceBootShape(0.105);
  const hHalfSpan = 4.85;
  const hSplitSpan = 3.85;

  const hLeAt = (s) => {
    const baseLe = -0.92 + (s / hHalfSpan) * 0.68;
    const tipT = Math.max(0, (s - (hHalfSpan - 0.6)) / 0.6);
    return baseLe + tipT * tipT * 0.28;
  };
  const hTeAt = (s) => {
    const baseTe = 0.94 - (s / hHalfSpan) * 0.42;
    const tipT = Math.max(0, (s - (hHalfSpan - 0.6)) / 0.6);
    return baseTe - tipT * tipT * 0.24;
  };
  const hThickAt = (s) => {
    const tipT = Math.max(0, (s - (hHalfSpan - 0.8)) / 0.8);
    return (1 - (s / hHalfSpan) * 0.18) * (1 - tipT * tipT * 0.48);
  };

  for (const side of [-1, 1]) {
    const hPanel = new THREE.Group();
    hPanel.position.set(0, 4.84, 9.05);
    hPanel.rotation.z = side * -0.025;

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
    hPanel.add(new THREE.Mesh(hInnerGeo, bodyMat));

    if (!isPolice) {
      const hBootGeo = loftTaperedAirfoilSpan(
        unitTailBoot,
        0.22,
        hSplitSpan,
        hHalfSpan,
        2,
        hLeAt,
        hTeAt,
        hThickAt,
        side
      );
      hPanel.add(new THREE.Mesh(hBootGeo, darkMat));
    }

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
    hPanel.add(new THREE.Mesh(hTipGeo, accentMat));
    tailGroup.add(hPanel);
  }

  // King Air aft ventral stability strake + dorsal/belly VHF blade antennas
  const strakeShape = new THREE.Shape();
  strakeShape.moveTo(4.4, -0.72);
  strakeShape.lineTo(7.85, 0.16);
  strakeShape.lineTo(7.55, -0.32);
  strakeShape.lineTo(5.35, -0.98);
  strakeShape.closePath();
  const strakeGeo = new THREE.ExtrudeGeometry(strakeShape, {
    depth: 0.08,
    bevelEnabled: false,
    steps: 1,
  });
  strakeGeo.translate(0, 0, -0.04);
  strakeGeo.rotateY(-Math.PI / 2);
  tailGroup.add(new THREE.Mesh(strakeGeo, bodyMat));

  const antShape = new THREE.Shape();
  antShape.moveTo(-0.22, 0);
  antShape.lineTo(0.05, 0.42);
  antShape.lineTo(0.24, 0.42);
  antShape.lineTo(0.22, 0);
  antShape.closePath();
  const antGeo = new THREE.ExtrudeGeometry(antShape, {
    depth: 0.035,
    bevelEnabled: false,
    steps: 1,
  });
  antGeo.translate(0, 0, -0.0175);
  antGeo.rotateY(-Math.PI / 2);

  const dorsalAnt = new THREE.Mesh(antGeo, bodyMat);
  dorsalAnt.position.set(0, 1.68, -1.15);
  tailGroup.add(dorsalAnt);

  const bellyAnt = new THREE.Mesh(antGeo.clone(), bodyMat);
  bellyAnt.scale.set(1, -0.82, 0.85);
  bellyAnt.position.set(0, -1.24, -2.95);
  tailGroup.add(bellyAnt);

  if (isPolice) {
    const {redMat, blueMat} = createPoliceStrobeMaterials();
    addAircraftPoliceBeacons(root, {
      barPos: [0, 1.74, -3.2],
      barScale: 1.02,
      leftTip: [-15.45, 0.48, -0.3],
      rightTip: [15.45, 0.48, -0.3],
      baseMat: darkMat,
      redMat,
      blueMat,
    });
  }

  mergeStaticMeshes(root, new Set([...propGroups, ...gearGroups]));
  if (isPolice) root.policeStrobeMats = collectPoliceStrobeMaterials(root);
  root.isPolice = isPolice;

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
