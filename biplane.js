// --- BIPLANE MODEL ---
// Dependencies: THREE, createMaterial, ChillFlightLogic
// Vintage sport & aerobatic biplane with dual staggered wings, N-struts,
// cabane struts, open cockpit with windscreen, and streamlined wheel pants.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createMaterial} from './constants.js';
import {state} from './state.js';

const _groupInv = new THREE.Matrix4();
const _relMat = new THREE.Matrix4();

function reverseWinding(geo) {
  for (const attr of Object.values(geo.attributes)) {
    const {array, itemSize} = attr;
    for (let i = 0; i < attr.count; i += 3) {
      for (let k = 0; k < itemSize; k++) {
        const a = (i + 1) * itemSize + k;
        const b = (i + 2) * itemSize + k;
        const t = array[a];
        array[a] = array[b];
        array[b] = t;
      }
    }
  }
}

// `piece`: which of the merged group's own children this mesh was under (its
// wreck piece in a crash, crash.js)
function collectStaticMeshes(
  node,
  keepSet,
  byMaterial,
  toRemove,
  piece = null
) {
  for (const child of node.children) {
    if (keepSet && keepSet.has(child)) continue;
    const childPiece = piece ?? pieceIdOf(child);
    if (child.isMesh) {
      _relMat.multiplyMatrices(_groupInv, child.matrixWorld);
      const geo = child.geometry.index
        ? child.geometry.toNonIndexed()
        : child.geometry.clone();
      geo.applyMatrix4(_relMat);
      if (_relMat.determinant() < 0) reverseWinding(geo);
      let entry = byMaterial.get(child.material);
      if (!entry) {
        entry = {
          geos: [],
          castShadow: child.castShadow,
          receiveShadow: child.receiveShadow,
          pieces: [],
        };
        byMaterial.set(child.material, entry);
      }
      entry.geos.push(geo);
      entry.pieces.push(childPiece);
      toRemove.push(child);
    } else {
      collectStaticMeshes(child, keepSet, byMaterial, toRemove, childPiece);
    }
  }
}

function pruneEmptyGroups(node, keepSet) {
  for (let i = node.children.length - 1; i >= 0; i--) {
    const child = node.children[i];
    if (keepSet && keepSet.has(child)) continue;
    if (!child.isMesh) {
      pruneEmptyGroups(child, keepSet);
      if (child.children.length === 0) node.remove(child);
    }
  }
}

let _nextPieceId = 1;
// A part's wreck piece id, given to each of the merged group's own children
// before merging (a child that survives, holding a kept subtree such as a
// twin's nacelle with its propeller, keeps it too)
function pieceIdOf(child) {
  return (child.userData.wreckPiece ??= _nextPieceId++);
}

// Merges non-animating meshes under `group` into one mesh per material with
// transforms baked relative to `group`, leaving subtrees in `keepSet` intact.
// Each merged mesh lists, in userData.wreckRanges, which run of its vertices
// came from which of the group's children, so a crash can still break the
// plane into its parts (crash.js).
export function mergeStaticMeshes(group, keepSet = null) {
  group.updateMatrixWorld(true);
  _groupInv.copy(group.matrixWorld).invert();
  const byMaterial = new Map();
  const toRemove = [];
  collectStaticMeshes(group, keepSet, byMaterial, toRemove);
  for (const mesh of toRemove) {
    mesh.parent.remove(mesh);
  }
  pruneEmptyGroups(group, keepSet);
  for (const [material, entry] of byMaterial) {
    const {geos, castShadow, receiveShadow, pieces} = entry;
    const wreckRanges = [];
    let start = 0;
    geos.forEach((geo, i) => {
      const count = geo.attributes.position.count;
      const last = wreckRanges[wreckRanges.length - 1];
      if (last && last.piece === pieces[i]) last.count += count;
      else wreckRanges.push({piece: pieces[i], start, count});
      start += count;
    });
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.userData.wreckRanges = wreckRanges;
    group.add(mesh);
    if (geos.length > 1) {
      for (const geo of geos) geo.dispose();
    }
  }
  return group;
}

export function createBiplaneModel(opts = {}) {
  const root = new THREE.Group();

  const makeMat = (props) => createMaterial(props);

  const planeColor =
    opts.planeColor !== undefined
      ? opts.planeColor
      : typeof state.planeColor !== 'undefined'
        ? state.planeColor
        : 0x4794db;

  const whiteColor =
    planeColor === 0xe8c332 || planeColor === 0xe8c382 ? 0x1c3144 : 0xf7f5ef;

  const accentMat =
    opts.planeMat ||
    makeMat({
      color: planeColor,
      flatShading: true,
      roughness: 0.45,
    });

  const bodyMat =
    opts.planeWhiteMat ||
    makeMat({
      color: whiteColor,
      flatShading: true,
      roughness: 0.48,
    });

  const strutMat = makeMat({
    color: 0x2c3038,
    flatShading: true,
    roughness: 0.55,
    metalness: 0.2,
  });

  const metalMat = makeMat({
    color: 0x9aa4b2,
    flatShading: true,
    roughness: 0.35,
    metalness: 0.52,
  });

  const leatherMat = makeMat({
    color: 0x5e341c, // Vintage stitched saddle-brown cockpit coaming leather
    flatShading: true,
    roughness: 0.65,
  });

  const darkMat = makeMat({
    color: 0x191c20,
    flatShading: true,
    roughness: 0.82,
  });

  const propTipMat = makeMat({
    color: 0xeab308, // Vintage brass / safety-yellow prop tip band
    flatShading: true,
    roughness: 0.38,
    metalness: 0.25,
  });

  const windowMat = makeMat({
    color: 0x101826,
    roughness: 0.1,
    metalness: 0.65,
    transparent: true,
    opacity: 0.78,
  });

  accentMat.userData = {type: 'accent'};
  bodyMat.userData = {type: 'body'};

  // Super-ellipse helper for fabric-over-stringer fuselage & flush livery
  const sgnPow = (v, exp) => Math.sign(v) * Math.pow(Math.abs(v), exp);
  const evalRing = (st, theta, scale = 1) => {
    const exp = 2 / st.p;
    const x = st.rx * scale * sgnPow(Math.cos(theta), exp);
    const y = st.cy + st.ry * scale * sgnPow(Math.sin(theta), exp);
    return [x, y];
  };

  // --- 1. LOFTED STEARMAN FUSELAGE & SKIN-TIGHT BARNSTORMER LIVERY ---
  const fuseGroup = new THREE.Group();
  const fuseStations = [
    {z: -8.1, rx: 1.56, ry: 1.72, cy: 0.04, p: 2.05}, // Joins painted metal nose cowl
    {z: -6.2, rx: 1.62, ry: 1.84, cy: 0.1, p: 2.15}, // Forward cockpit bay
    {z: -4.2, rx: 1.6, ry: 1.86, cy: 0.12, p: 2.2}, // Between tandem cockpits
    {z: -2.0, rx: 1.52, ry: 1.8, cy: 0.12, p: 2.2}, // Rear pilot cockpit
    {z: 0.4, rx: 1.24, ry: 1.5, cy: 0.14, p: 2.15}, // Turtledeck taper
    {z: 3.2, rx: 0.82, ry: 1.12, cy: 0.18, p: 2.1}, // Mid tailcone
    {z: 5.6, rx: 0.38, ry: 0.78, cy: 0.24, p: 2.0}, // Empennage root
    {z: 6.45, rx: 0.12, ry: 0.64, cy: 0.28, p: 2.0}, // Vertical tailpost
  ];

  const segs = 14; // 14-sided stringer faceting authentic to fabric-covered Stearman
  const fPos = [];
  const fUvs = [];
  const fIdx = [];
  for (let i = 0; i < fuseStations.length; i++) {
    const st = fuseStations[i];
    for (let s = 0; s <= segs; s++) {
      const theta = (s / segs) * Math.PI * 2;
      const [x, y] = evalRing(st, theta);
      fPos.push(x, y, st.z);
      fUvs.push(s / segs, i / (fuseStations.length - 1));
    }
  }
  const fStride = segs + 1;
  for (let i = 0; i < fuseStations.length - 1; i++) {
    for (let s = 0; s < segs; s++) {
      const a = i * fStride + s;
      const b = i * fStride + s + 1;
      const c = (i + 1) * fStride + s;
      const d = (i + 1) * fStride + s + 1;
      fIdx.push(a, b, c, b, d, c);
    }
  }
  const tpBase = (fuseStations.length - 1) * fStride;
  const tpIdx = fPos.length / 3;
  fPos.push(0, 0.28, 6.48);
  fUvs.push(0.5, 1);
  for (let s = 0; s < segs; s++) fIdx.push(tpIdx, tpBase + s, tpBase + s + 1);

  const fuseGeo = new THREE.BufferGeometry();
  fuseGeo.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
  fuseGeo.setAttribute('uv', new THREE.Float32BufferAttribute(fUvs, 2));
  fuseGeo.setIndex(fIdx);
  fuseGeo.computeVertexNormals();
  fuseGroup.add(new THREE.Mesh(fuseGeo, bodyMat));

  // Skin-tight barnstormer spear stripe along both flanks (-8.1 to +5.6, zero overhang!)
  for (const side of [-1, 1]) {
    const sPos = [];
    const sUvs = [];
    const sIdx = [];
    const bandRows = 4;
    const lastRing = fuseStations.length - 2;
    for (let i = 0; i <= lastRing; i++) {
      const st = fuseStations[i];
      const t = i / lastRing;
      const centerAngle =
        side > 0 ? 0.04 + t * 0.1 : Math.PI - (0.04 + t * 0.1);
      // Wide scallop at forward cowl (-8.1) tapering to a crisp spear point at tail (+5.6)
      const halfSpanAngle = 0.34 * (1 - t * 0.78) + 0.03;
      for (let r = 0; r <= bandRows; r++) {
        const frac = r / bandRows - 0.5;
        const theta = centerAngle + frac * 2 * halfSpanAngle;
        const [x, y] = evalRing(st, theta, 1.015);
        sPos.push(x, y, st.z);
        sUvs.push(r / bandRows, t);
      }
    }
    const sStride = bandRows + 1;
    for (let i = 0; i < lastRing; i++) {
      for (let r = 0; r < bandRows; r++) {
        const a = i * sStride + r;
        const b = i * sStride + r + 1;
        const c = (i + 1) * sStride + r;
        const d = (i + 1) * sStride + r + 1;
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
    fuseGroup.add(new THREE.Mesh(stripeGeo, accentMat));
  }
  root.add(fuseGroup);

  // --- 2. PAINTED NOSE COWL & EXPOSED 7-CYLINDER CONTINENTAL RADIAL ENGINE ---
  const engineGroup = new THREE.Group();
  // Forward painted sheet-metal cowl (-9.55 to -8.1) in player accent color
  const cowlProfile = [
    [1.18, -9.55],
    [1.42, -9.15],
    [1.56, -8.1],
  ];
  const cowlGeo = new THREE.LatheGeometry(
    cowlProfile.map(([r, z]) => new THREE.Vector2(r, z)),
    14
  );
  cowlGeo.rotateX(Math.PI / 2);
  cowlGeo.scale(1.0, 1.1, 1.0);
  cowlGeo.translate(0, 0.04, 0);
  engineGroup.add(new THREE.Mesh(cowlGeo, accentMat));

  // Dark firewall recess behind radial cylinders
  const firewallGeo = new THREE.CylinderGeometry(1.18, 1.2, 0.35, 14);
  firewallGeo.rotateX(Math.PI / 2);
  firewallGeo.scale(1.0, 1.08, 1.0);
  firewallGeo.translate(0, 0.04, -9.58);
  engineGroup.add(new THREE.Mesh(firewallGeo, darkMat));

  // Conical cast-aluminum crankcase housing at center of radial star
  const crankcaseGeo = new THREE.CylinderGeometry(0.46, 0.62, 0.72, 12);
  crankcaseGeo.rotateX(Math.PI / 2);
  crankcaseGeo.translate(0, 0.02, -9.92);
  engineGroup.add(new THREE.Mesh(crankcaseGeo, metalMat));

  // 7 exposed Continental R-670 radial cylinders + rocker heads + twin pushrod tubes
  const numCyls = 7;
  for (let c = 0; c < numCyls; c++) {
    // Top cylinder vertical (angle = 0 along +Y) like classic Stearman R-670!
    const ang = (c / numCyls) * Math.PI * 2;
    const cylAssembly = new THREE.Group();
    cylAssembly.position.set(0, 0.02, -9.9);
    cylAssembly.rotation.z = ang;

    // Dark finned cast-iron barrel
    const barrelGeo = new THREE.CylinderGeometry(0.22, 0.19, 0.78, 6);
    barrelGeo.translate(0, 0.88, 0);
    cylAssembly.add(new THREE.Mesh(barrelGeo, darkMat));

    // Finned aluminum cylinder head & twin rocker boxes
    const headGeo = new THREE.CylinderGeometry(0.25, 0.23, 0.34, 6);
    headGeo.translate(0, 1.38, 0);
    cylAssembly.add(new THREE.Mesh(headGeo, metalMat));

    for (const side of [-1, 1]) {
      const rodGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.78, 4);
      rodGeo.rotateZ(side * -0.08);
      rodGeo.translate(side * 0.11, 0.96, -0.14);
      cylAssembly.add(new THREE.Mesh(rodGeo, metalMat));
    }
    engineGroup.add(cylAssembly);
  }

  // Circular exhaust collector ring behind cylinders + twin lower exhaust pipes
  const collectorGeo = new THREE.TorusGeometry(0.98, 0.09, 5, 12);
  collectorGeo.translate(0, 0.02, -9.62);
  engineGroup.add(new THREE.Mesh(collectorGeo, metalMat));

  for (const side of [-1, 1]) {
    const pipeGeo = new THREE.CylinderGeometry(0.095, 0.11, 1.25, 7);
    pipeGeo.rotateX(Math.PI / 2 + 0.22);
    pipeGeo.rotateZ(side * -0.25);
    pipeGeo.translate(side * 1.18, -0.98, -9.05);
    engineGroup.add(new THREE.Mesh(pipeGeo, metalMat));
  }
  root.add(engineGroup);

  // --- 3. 2-BLADE SCULPTED VINTAGE PROPELLER (spinScale = 2 preserved) ---
  const propGroup = new THREE.Group();
  propGroup.position.set(0, 0.02, -10.35);
  root.add(propGroup);
  root.propGroup = propGroup;
  propGroup.userData.spinScale = 2;

  // Pointed vintage spinner cone & hub collar
  const hubCollarGeo = new THREE.CylinderGeometry(0.36, 0.42, 0.26, 10);
  hubCollarGeo.rotateX(Math.PI / 2);
  propGroup.add(new THREE.Mesh(hubCollarGeo, metalMat));

  const spinnerProfile = [
    [0.0, -1.15],
    [0.18, -0.82],
    [0.32, -0.44],
    [0.38, -0.1],
  ];
  const spinnerGeo = new THREE.LatheGeometry(
    spinnerProfile.map(([r, z]) => new THREE.Vector2(r, z)),
    10
  );
  spinnerGeo.rotateX(Math.PI / 2);
  propGroup.add(new THREE.Mesh(spinnerGeo, accentMat));

  // Two opposing tapered paddle blades with pitch twist & brass/yellow safety tips
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.11, 0.28);
  bladeShape.quadraticCurveTo(-0.38, 1.85, -0.28, 3.85);
  bladeShape.lineTo(0.24, 3.85);
  bladeShape.quadraticCurveTo(0.34, 1.85, 0.11, 0.28);
  bladeShape.closePath();
  const singleBladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.09,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 6,
  });
  singleBladeGeo.translate(0, 0, -0.045);

  const tipCapGeo = new THREE.BoxGeometry(0.48, 0.44, 0.095);
  tipCapGeo.translate(-0.02, 4.06, 0);

  for (const rotZ of [0, Math.PI]) {
    const holder = new THREE.Group();
    holder.rotation.z = rotZ;
    const bMesh = new THREE.Mesh(singleBladeGeo, darkMat);
    bMesh.rotation.y = 0.24;
    holder.add(bMesh);
    const tMesh = new THREE.Mesh(tipCapGeo, propTipMat);
    tMesh.rotation.y = 0.24;
    holder.add(tMesh);
    propGroup.add(holder);
  }
  mergeStaticMeshes(propGroup);

  // --- 4. TANDEM OPEN COCKPITS (STITCHED LEATHER COAMING & 3-PANE WINDSCREENS) ---
  const cockpitsGroup = new THREE.Group();
  const buildOpenCockpit = (cz, cy, scaleW, hasHeadrest) => {
    // Dark recessed cockpit interior well
    const wellGeo = new THREE.CylinderGeometry(
      0.68 * scaleW,
      0.62 * scaleW,
      0.7,
      10
    );
    wellGeo.scale(1.0, 1.0, 1.35);
    wellGeo.translate(0, cy - 0.22, cz);
    cockpitsGroup.add(new THREE.Mesh(wellGeo, darkMat));

    // Padded saddle-brown leather coaming rim around oval cockpit opening
    const rimGeo = new THREE.TorusGeometry(0.7 * scaleW, 0.11, 5, 10);
    rimGeo.rotateX(Math.PI / 2);
    rimGeo.scale(1.0, 1.36, 0.85);
    rimGeo.translate(0, cy + 0.12, cz);
    cockpitsGroup.add(new THREE.Mesh(rimGeo, leatherMat));

    // 3-pane faceted vintage aero windscreen ahead of cockpit rim
    const wsZ = cz - 0.98;
    const centerPaneGeo = new THREE.BoxGeometry(0.62 * scaleW, 0.56, 0.06);
    centerPaneGeo.rotateX(0.48);
    centerPaneGeo.translate(0, cy + 0.36, wsZ);
    cockpitsGroup.add(new THREE.Mesh(centerPaneGeo, windowMat));

    for (const side of [-1, 1]) {
      const sidePaneGeo = new THREE.BoxGeometry(0.46 * scaleW, 0.5, 0.06);
      sidePaneGeo.rotateY(side * -0.58);
      sidePaneGeo.rotateX(0.44);
      sidePaneGeo.translate(side * 0.46 * scaleW, cy + 0.32, wsZ + 0.18);
      cockpitsGroup.add(new THREE.Mesh(sidePaneGeo, windowMat));
    }

    if (hasHeadrest) {
      // Streamlined Stearman headrest fairing tapering aft along turtledeck
      const hrFairingGeo = new THREE.ConeGeometry(0.36, 1.65, 8);
      hrFairingGeo.rotateX(Math.PI / 2);
      hrFairingGeo.scale(0.95, 0.92, 1.0);
      hrFairingGeo.translate(0, cy + 0.24, cz + 1.68);
      cockpitsGroup.add(new THREE.Mesh(hrFairingGeo, accentMat));

      const padGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.16, 8);
      padGeo.rotateX(Math.PI / 2);
      padGeo.translate(0, cy + 0.26, cz + 0.84);
      cockpitsGroup.add(new THREE.Mesh(padGeo, leatherMat));
    }
  };

  // Front passenger/observer cockpit (-5.05) + Rear pilot cockpit (-2.35)
  buildOpenCockpit(-5.05, 1.78, 0.96, false);
  buildOpenCockpit(-2.35, 1.74, 1.0, true);
  root.add(cockpitsGroup);

  // --- 5. CAMBERED CLARK-Y AIRFOIL STAGGERED WINGS & CURVED CENTER CUTOUT ---
  const buildClarkYShape = (chord, thick) => {
    const sh = new THREE.Shape();
    const zLE = -chord * 0.5;
    const zTE = chord * 0.5;
    sh.moveTo(zLE, 0.0);
    sh.bezierCurveTo(
      zLE,
      thick * 0.82,
      zLE + chord * 0.26,
      thick * 0.96,
      zLE + chord * 0.52,
      thick * 0.68
    );
    sh.quadraticCurveTo(zLE + chord * 0.8, thick * 0.34, zTE, -thick * 0.05);
    // Nearly flat Clark-Y underside
    sh.quadraticCurveTo(
      zLE + chord * 0.5,
      -thick * 0.14,
      zLE + chord * 0.14,
      -thick * 0.18
    );
    sh.quadraticCurveTo(zLE, -thick * 0.15, zLE, 0.0);
    return sh;
  };

  const buildEllipticalTipGeo = (airfoil, span, chord, side) => {
    const geo = new THREE.ExtrudeGeometry(airfoil, {
      depth: span,
      bevelEnabled: false,
      steps: 2,
      curveSegments: 4,
    });
    if (side > 0) geo.translate(0, 0, -span);
    geo.rotateY(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const f = Math.min(1, Math.abs(pos.getX(i)) / span);
      // Smooth vintage elliptical tip rounding in planform and thickness
      const chordScale = Math.sqrt(Math.max(0.08, 1 - f * f * 0.86));
      pos.setZ(i, pos.getZ(i) * chordScale + (1 - chordScale) * chord * 0.06);
      pos.setY(i, pos.getY(i) * (1 - f * f * 0.55));
    }
    geo.computeVertexNormals();
    return geo;
  };

  // Upper Wing (y = 2.9, z = -3.95, total half-span = 14.5 matching WINGTIPS.biplane)
  const upperWingGroup = new THREE.Group();
  const upperWingY = 2.9;
  const upperWingZ = -3.95;
  const upperChord = 4.3;
  const upperThick = 0.42;
  const upperAirfoil = buildClarkYShape(upperChord, upperThick);

  // Center wing section (-2.2 to +2.2) with smooth curved Stearman trailing-edge cutout over cockpit!
  const centerWingGeo = new THREE.ExtrudeGeometry(upperAirfoil, {
    depth: 4.4,
    bevelEnabled: false,
    steps: 6,
    curveSegments: 4,
  });
  centerWingGeo.translate(0, 0, -2.2);
  centerWingGeo.rotateY(-Math.PI / 2);
  const cwPos = centerWingGeo.attributes.position;
  for (let i = 0; i < cwPos.count; i++) {
    const x = cwPos.getX(i);
    const z = cwPos.getZ(i);
    const arch = Math.cos((Math.min(2.2, Math.abs(x)) / 2.2) * (Math.PI * 0.5));
    // Pull trailing half smoothly forward into a graceful semicircular cutout
    if (z > -upperChord * 0.35) {
      const teFrac = (z + upperChord * 0.35) / (upperChord * 0.85);
      cwPos.setZ(i, z - arch * teFrac * 1.45);
    }
  }
  centerWingGeo.computeVertexNormals();
  centerWingGeo.translate(0, upperWingY, upperWingZ);
  upperWingGroup.add(new THREE.Mesh(centerWingGeo, accentMat));

  // Left & right main upper wing panels (x = ±2.2 to ±12.3) + elliptical livery wingtips (to ±14.5)
  for (const side of [-1, 1]) {
    const panelGeo = new THREE.ExtrudeGeometry(upperAirfoil, {
      depth: 10.1,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 4,
    });
    if (side > 0) panelGeo.translate(0, 0, -10.1);
    panelGeo.rotateY(-Math.PI / 2);
    panelGeo.translate(side * 2.2, upperWingY, upperWingZ);
    upperWingGroup.add(new THREE.Mesh(panelGeo, bodyMat));

    const tipGeo = buildEllipticalTipGeo(upperAirfoil, 2.2, upperChord, side);
    tipGeo.translate(side * 12.3, upperWingY, upperWingZ);
    upperWingGroup.add(new THREE.Mesh(tipGeo, accentMat));
  }
  root.add(upperWingGroup);

  // Lower Wing (y = -0.82, z = -2.85, subtle 2.5-deg Stearman dihedral!)
  const lowerWingGroup = new THREE.Group();
  const lowerWingY = -0.82;
  const lowerWingZ = -2.85;
  const lowerChord = 3.85;
  const lowerThick = 0.38;
  const lowerAirfoil = buildClarkYShape(lowerChord, lowerThick);
  const dihedral = 0.044; // ~2.5 degrees upward cant

  for (const side of [-1, 1]) {
    const lSideGroup = new THREE.Group();
    lSideGroup.position.set(side * 1.25, lowerWingY, lowerWingZ);
    lSideGroup.rotation.z = side * dihedral;

    const lPanelGeo = new THREE.ExtrudeGeometry(lowerAirfoil, {
      depth: 8.35,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 4,
    });
    if (side > 0) lPanelGeo.translate(0, 0, -8.35);
    lPanelGeo.rotateY(-Math.PI / 2);
    lSideGroup.add(new THREE.Mesh(lPanelGeo, bodyMat));

    const lTipGeo = buildEllipticalTipGeo(lowerAirfoil, 2.0, lowerChord, side);
    lTipGeo.translate(side * 8.35, 0, 0);
    lSideGroup.add(new THREE.Mesh(lTipGeo, accentMat));

    lowerWingGroup.add(lSideGroup);
  }
  root.add(lowerWingGroup);

  // --- 6. INTERPLANE N-STRUTS, CABANE N-STRUTS & RIGGING WIRES ---
  const strutsGroup = new THREE.Group();
  const makeStrutBetween = (p1, p2, radius, mat, airfoilScale = 1.6) => {
    const len = p1.distanceTo(p2);
    const geo = new THREE.CylinderGeometry(radius, radius, len, 6);
    geo.scale(0.68, 1.0, airfoilScale);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.addVectors(p1, p2).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3().subVectors(p2, p1).normalize()
    );
    return mesh;
  };

  for (const side of [-1, 1]) {
    // Outboard interplane N-strut at x = ±8.6
    const xPos = side * 8.6;
    const lowYAtX = lowerWingY + (8.6 - 1.25) * Math.sin(dihedral);
    const fLow = new THREE.Vector3(xPos, lowYAtX, lowerWingZ - 1.15);
    const fHigh = new THREE.Vector3(xPos, upperWingY, upperWingZ - 1.25);
    const rLow = new THREE.Vector3(xPos, lowYAtX, lowerWingZ + 1.15);
    const rHigh = new THREE.Vector3(xPos, upperWingY, upperWingZ + 1.25);

    strutsGroup.add(makeStrutBetween(fLow, fHigh, 0.085, strutMat));
    strutsGroup.add(makeStrutBetween(rLow, rHigh, 0.085, strutMat));
    strutsGroup.add(makeStrutBetween(rLow, fHigh, 0.075, strutMat));

    // Crossed steel flying & landing rigging wires between fuselage/lower root and upper N-strut
    const rootLowF = new THREE.Vector3(
      side * 1.45,
      lowerWingY + 0.1,
      lowerWingZ - 1.0
    );
    const rootHighF = new THREE.Vector3(
      side * 2.2,
      upperWingY - 0.05,
      upperWingZ - 1.1
    );
    strutsGroup.add(makeStrutBetween(rootLowF, fHigh, 0.025, metalMat, 1.0));
    strutsGroup.add(makeStrutBetween(rootHighF, fLow, 0.025, metalMat, 1.0));

    // Center cabane N-struts supporting the upper center wing section
    const cabLowF = new THREE.Vector3(side * 1.22, 1.35, -5.85);
    const cabHighF = new THREE.Vector3(
      side * 2.15,
      upperWingY,
      upperWingZ - 1.05
    );
    const cabLowR = new THREE.Vector3(side * 1.26, 1.45, -3.55);
    const cabHighR = new THREE.Vector3(
      side * 2.15,
      upperWingY,
      upperWingZ + 1.05
    );
    strutsGroup.add(makeStrutBetween(cabLowF, cabHighF, 0.08, strutMat));
    strutsGroup.add(makeStrutBetween(cabLowR, cabHighR, 0.08, strutMat));
    strutsGroup.add(makeStrutBetween(cabLowR, cabHighF, 0.068, strutMat));
  }
  root.add(strutsGroup);

  // --- 7. CANTILEVERED STEARMAN GEAR WITH SEAMLESS TEARDROP WHEEL SPATS ---
  const gearGroup = new THREE.Group();
  // Seamless LatheGeometry teardrop wheel spat profile (-2.25 nose to +2.55 tail)
  const spatProfile = [
    [0.0, -2.25],
    [0.34, -1.75],
    [0.56, -0.95],
    [0.6, 0.1],
    [0.46, 1.25],
    [0.2, 2.15],
    [0.0, 2.55],
  ];
  const spatGeo = new THREE.LatheGeometry(
    spatProfile.map(([r, z]) => new THREE.Vector2(r, z)),
    12
  );
  spatGeo.rotateX(Math.PI / 2);
  spatGeo.scale(0.72, 1.12, 1.0);

  // Skin-tight accent side flash along wheel spat (zero protruding box!)
  const spatFlashGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.35, -1.7),
      new THREE.Vector2(0.57, -0.95),
      new THREE.Vector2(0.61, 0.1),
      new THREE.Vector2(0.47, 1.25),
      new THREE.Vector2(0.21, 2.1),
    ],
    12
  );
  spatFlashGeo.rotateX(Math.PI / 2);
  spatFlashGeo.scale(0.745, 0.34, 1.0);

  for (const side of [-1, 1]) {
    const wheelX = side * 3.8;
    const wheelY = -3.2;
    const wheelZ = -4.6;

    // Stearman cantilevered faired main gear leg (accent upper fairing + chrome lower oleo)
    const legTop = new THREE.Vector3(side * 1.18, -0.85, -4.6);
    const legMid = new THREE.Vector3(side * 2.85, -2.25, -4.6);
    const legBot = new THREE.Vector3(wheelX, wheelY + 0.35, wheelZ);
    gearGroup.add(makeStrutBetween(legTop, legMid, 0.19, accentMat, 2.4));
    gearGroup.add(makeStrutBetween(legMid, legBot, 0.1, metalMat, 1.1));
    // Inner diagonal brace strut to centerline belly
    gearGroup.add(
      makeStrutBetween(
        new THREE.Vector3(side * 0.35, -1.45, -4.6),
        legMid,
        0.065,
        strutMat,
        1.2
      )
    );

    const spat = new THREE.Mesh(spatGeo, bodyMat);
    spat.position.set(wheelX, wheelY, wheelZ);
    gearGroup.add(spat);

    const spatFlash = new THREE.Mesh(spatFlashGeo, accentMat);
    spatFlash.position.set(wheelX, wheelY + 0.04, wheelZ);
    gearGroup.add(spatFlash);

    // Tire protruding cleanly below teardrop spat (min.y = -3.2 - 0.45 - 0.60 = -4.25 -> wheelDepth = 4.25!)
    const tireGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.44, 12);
    tireGeo.rotateZ(Math.PI / 2);
    tireGeo.translate(wheelX, wheelY - 0.45, wheelZ);
    gearGroup.add(new THREE.Mesh(tireGeo, darkMat));
  }

  // Steerable Stearman tailwheel strut & tire at stern
  gearGroup.add(
    makeStrutBetween(
      new THREE.Vector3(0, -0.25, 5.1),
      new THREE.Vector3(0, -0.88, 5.65),
      0.06,
      metalMat,
      1.2
    )
  );
  const tailWheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.18, 10);
  tailWheelGeo.rotateZ(Math.PI / 2);
  tailWheelGeo.translate(0, -0.92, 5.68);
  gearGroup.add(new THREE.Mesh(tailWheelGeo, darkMat));
  root.add(gearGroup);

  // --- 8. CLASSIC STEARMAN ROUNDED-D TAIL & BRACED STABILIZER ---
  const tailGroup = new THREE.Group();
  const hAirfoil = buildClarkYShape(2.65, 0.26);
  const hCenterSpan = 6.2;
  const hCenterGeo = new THREE.ExtrudeGeometry(hAirfoil, {
    depth: hCenterSpan,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 4,
  });
  hCenterGeo.translate(0, 0, -hCenterSpan * 0.5);
  hCenterGeo.rotateY(-Math.PI / 2);
  hCenterGeo.translate(0, 0.48, 5.35);
  tailGroup.add(new THREE.Mesh(hCenterGeo, bodyMat));

  for (const side of [-1, 1]) {
    const hTipGeo = buildEllipticalTipGeo(hAirfoil, 1.35, 2.65, side);
    hTipGeo.translate(side * (hCenterSpan * 0.5), 0.48, 5.35);
    tailGroup.add(new THREE.Mesh(hTipGeo, accentMat));

    // Classic under-tail stabilizer bracing strut
    tailGroup.add(
      makeStrutBetween(
        new THREE.Vector3(side * 0.18, -0.18, 5.45),
        new THREE.Vector3(side * 2.45, 0.44, 5.35),
        0.035,
        strutMat,
        1.2
      )
    );
  }

  // Tall rounded Boeing-Stearman vertical fin & balanced rudder + white rudder stripe
  const rudderShape = new THREE.Shape();
  rudderShape.moveTo(3.4, 0.55); // Dorsal fillet start
  rudderShape.quadraticCurveTo(4.35, 0.85, 4.65, 1.85);
  rudderShape.quadraticCurveTo(4.95, 3.65, 5.45, 4.35);
  rudderShape.bezierCurveTo(5.85, 4.78, 6.75, 4.65, 6.95, 3.85); // Rounded Stearman rudder horn
  rudderShape.quadraticCurveTo(7.18, 2.35, 6.85, 0.25);
  rudderShape.lineTo(4.5, 0.35);
  rudderShape.closePath();

  const rudderGeo = new THREE.ExtrudeGeometry(rudderShape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.035,
    bevelThickness: 0.035,
    curveSegments: 10,
  });
  rudderGeo.translate(0, 0, -0.09);
  rudderGeo.rotateY(-Math.PI / 2);
  tailGroup.add(new THREE.Mesh(rudderGeo, accentMat));

  // Crisp contrasting horizontal stripe across vertical fin
  const rudderBandGeo = new THREE.BoxGeometry(0.27, 0.24, 1.72);
  rudderBandGeo.translate(0, 3.55, 5.98);
  tailGroup.add(new THREE.Mesh(rudderBandGeo, bodyMat));
  root.add(tailGroup);

  mergeStaticMeshes(root, new Set([propGroup]));

  root.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return root;
}
