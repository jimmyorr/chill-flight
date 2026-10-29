// --- DEBUG MODEL DESTRUCTION PREVIEW ---
// Simulates destruction animations for previewing destructible models in
// debug/debug-models.html. Shares physics, steppers, and matrix transformations
// directly from breakables-logic.js (stepFlying, stepTopple, stepFold, stepSink,
// stepScatter) without re-implementing them.

import * as THREE from 'three';
import {
  BREAK,
  restAngle,
  stepFlying,
  stepFold,
  stepScatter,
  stepSink,
  stepTopple,
  toppleSpin,
} from '../breakables-logic.js';
import {createMaterial} from '../constants.js';
import {
  barnBodyGeo,
  barnRoofGeo,
  houseBodyGeo,
  houseChimneyGeo,
  houseRoofGeo,
  icebergMat,
  twoStoryBodyGeo,
  twoStoryChimneyGeo,
  twoStoryRoofGeo,
  windmillBaseGeo,
} from '../terrain-geometry.js';

export const destructibleTypes = new Set([
  // Nature
  'pine',
  'deciduous',
  'tall_deciduous',
  'yellow_cortez',
  'japanese_maple',
  'palm',
  'dead_tree',
  'bush',
  'mushroom',
  'crystal',
  'cactus',
  'rock',
  'snowman',
  // Structures
  'house',
  'two_story_house',
  'straw_hut',
  'pagoda',
  'barn',
  'monastery',
  'castle',
  'windmill',
  'rock_arch',
  'rock_arch_grass',
  'control_tower',
  'hangar',
  'windsock',
  'airport_sign',
  'lighthouse',
  'pier',
  'streetlight',
  'tent',
  'campfire',
  // Other
  'sailboat',
  'pirateship',
  'iceberg',
  'iceFloe',
  'penguin',
]);

const KTS = 110;
const _m = new THREE.Matrix4();
const _r = new THREE.Matrix4();
const _r2 = new THREE.Matrix4();
const _t = new THREE.Matrix4();
const _m0 = new THREE.Matrix4();
const _axis = new THREE.Vector3();

export function startDestruction(type, previewGroup, mats = {}) {
  if (!previewGroup) return null;

  const s = previewGroup.scale.x;
  const localGroundY = previewGroup.worldToLocal(new THREE.Vector3(0, 0, 0)).y;
  const hitDir = new THREE.Vector3(0.8, 0, -0.6).normalize();
  const dx = hitDir.x;
  const dz = hitDir.z;
  const axis = new THREE.Vector3(dz, 0, -dx).normalize();
  const fwd = (KTS * 0.12) / s;
  const gravity = BREAK.GRAVITY / s;

  const pieces = [];

  function addPiece(mesh, anim) {
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    const m0 = mesh.matrix.elements.slice();
    const m = m0.slice();
    const piece = {mesh, m0, m, anim};
    pieces.push(piece);
    return piece;
  }

  function addFling(
    mesh,
    vx,
    vy,
    vz,
    spin = 2,
    rest = localGroundY,
    spinAxis = null
  ) {
    const from = mesh.position.clone();
    const anim = {
      kind: 'fly',
      from,
      axis:
        spinAxis ||
        new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5
        ).normalize(),
      x: from.x,
      y: from.y,
      z: from.z,
      vx,
      vy,
      vz,
      angle: 0,
      spin,
      rest,
      done: false,
    };
    return addPiece(mesh, anim);
  }

  function addTopple(
    meshes,
    pivot,
    toppleAxis = axis,
    spin = toppleSpin(KTS),
    rest = restAngle(10, 1, () => 0)
  ) {
    const anim = {
      kind: 'topple',
      pivot,
      axis: toppleAxis,
      angle: 0,
      spin,
      rest,
      stepped: null,
      done: false,
    };
    meshes.forEach((m) => addPiece(m, anim));
  }

  function addFold(
    mesh,
    pivot = new THREE.Vector3(0, localGroundY, 0),
    foldAxis = axis
  ) {
    const anim = {
      kind: 'fold',
      pivot,
      axis: foldAxis,
      t: 0,
      lean: 0,
      squash: 1,
      done: false,
    };
    return addPiece(mesh, anim);
  }

  function addRubble(
    count,
    spread,
    mat,
    geo = null,
    speedMult = 1,
    yOffset = 0.5
  ) {
    const rGeo = geo || new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(rGeo, mat);
      const sz = 0.8 + Math.random();
      const h = sz * (0.5 + Math.random() * 0.5);
      m.scale.set(sz, h, sz);
      m.position.set(
        (Math.random() - 0.5) * spread,
        localGroundY + yOffset + Math.random() * 2,
        (Math.random() - 0.5) * spread
      );
      previewGroup.add(m);
      const ang = Math.random() * Math.PI * 2;
      const spd = ((4 + Math.random() * 8) * speedMult) / s;
      addFling(
        m,
        Math.cos(ang) * spd + dx * fwd * 0.3,
        (4 + Math.random() * 7) / s,
        Math.sin(ang) * spd + dz * fwd * 0.3,
        2 + Math.random() * 4,
        localGroundY + h * 0.5
      );
    }
  }

  // 1. Boats
  if (type === 'sailboat' || type === 'pirateship') {
    const anim = {
      kind: 'sink',
      pivot: new THREE.Vector3(0, 0, 0),
      axis: new THREE.Vector3(0, 0, 1),
      t: 0,
      roll: 0,
      drop: 0,
      done: false,
    };
    addPiece(previewGroup, anim);
  }

  // 2. Penguin
  else if (type === 'penguin') {
    const anim = {
      kind: 'scatter',
      pivot: new THREE.Vector3(0, 0, 0),
      ux: 0,
      uz: 1,
      turn: Math.PI * 0.45,
      t: 0,
      done: false,
    };
    addPiece(previewGroup, anim);
  }

  // 3. Bush
  else if (type === 'bush') {
    previewGroup.children.filter((c) => c.isMesh).forEach((m) => addFold(m));
  }

  // 4. Campfire
  else if (type === 'campfire') {
    previewGroup.children.forEach((c) => {
      if (c.material !== mats.woodMat) {
        c.visible = false;
      } else {
        const ang = Math.random() * Math.PI * 2;
        addFling(
          c,
          (Math.cos(ang) * 7 + dx * 4) / s,
          (4 + Math.random() * 4) / s,
          (Math.sin(ang) * 7 + dz * 4) / s,
          3,
          localGroundY + 0.3
        );
      }
    });
    const emberMat = createMaterial({
      color: 0xff6622,
      emissive: 0xff4400,
    });
    addRubble(8, 2, emberMat, new THREE.BoxGeometry(0.3, 0.3, 0.3), 0.8, 0.8);
  }

  // 5. Rocks, pier, ice, rock arch
  else if (
    [
      'rock',
      'pier',
      'iceberg',
      'iceFloe',
      'rock_arch',
      'rock_arch_grass',
    ].includes(type)
  ) {
    previewGroup.children.forEach((c) => {
      c.visible = false;
    });
    const rockMat = mats.rockMat || createMaterial({color: 0x888888});
    if (type.startsWith('rock_arch') && previewGroup.userData.blocks) {
      const grassMat = createMaterial({color: 0x7cb342});
      previewGroup.userData.blocks.forEach(([bx, by, bz, sz, isGrass]) => {
        const bm = new THREE.Mesh(
          new THREE.BoxGeometry(sz, sz * 0.7, sz),
          isGrass ? grassMat : rockMat
        );
        bm.position.set(bx, by, bz);
        previewGroup.add(bm);
        addFling(
          bm,
          (dx * 12 + (Math.random() - 0.5) * 16) / s,
          (-2 + Math.random() * 8) / s,
          (dz * 12 + (Math.random() - 0.5) * 16) / s,
          1.5,
          localGroundY + sz * 0.35
        );
      });
    } else if (type === 'pier') {
      addRubble(
        BREAK.RUBBLE.pier,
        12,
        mats.woodMat || createMaterial({color: 0x8b5a2b}),
        new THREE.BoxGeometry(3.5, 0.25, 0.8),
        0.9,
        0.5
      );
    } else if (type === 'iceberg' || type === 'iceFloe') {
      const isFloe = type === 'iceFloe';
      addRubble(
        isFloe ? BREAK.RUBBLE.iceFloe : BREAK.RUBBLE.iceberg,
        isFloe ? 16 : 10,
        icebergMat,
        isFloe
          ? new THREE.BoxGeometry(2.5, 0.3, 2.0)
          : new THREE.IcosahedronGeometry(1.0, 0),
        1.0,
        isFloe ? 0.3 : 1.5
      );
    } else {
      const firstMesh = previewGroup.children.find((c) => c.isMesh);
      addRubble(
        BREAK.RUBBLE.rock,
        5,
        firstMesh?.material || rockMat,
        null,
        1.2,
        1.0
      );
    }
  }

  // 6. Buildings & structures
  else if (
    [
      'house',
      'two_story_house',
      'straw_hut',
      'pagoda',
      'barn',
      'monastery',
      'castle',
      'windmill',
      'hangar',
      'lighthouse',
    ].includes(type)
  ) {
    const allMeshes = [];
    previewGroup.traverse((c) => {
      if (c.isMesh) allMeshes.push(c);
    });
    const bodyMat = allMeshes[0]?.material;
    const roofMat = allMeshes[1]?.material;

    if (type === 'lighthouse') {
      const tower = allMeshes.filter((m) => Math.abs(m.position.x) < 2);
      const keeperHouse = allMeshes.filter((m) => m.position.x > 10);
      const flag = allMeshes.filter((m) => m.position.x < -10);

      // Light turns off
      const light = tower.find((m) => m.position.y > 60);
      if (light) light.visible = false;

      addTopple(tower, new THREE.Vector3(0, localGroundY, 0));
      if (flag.length) {
        addTopple(flag, new THREE.Vector3(-14, localGroundY, 0));
      }
      const khBody = keeperHouse.find((m) => m.position.y < 5);
      const khRoof = keeperHouse.find((m) => m.position.y >= 5);
      if (khBody) addFold(khBody, new THREE.Vector3(16, localGroundY, 0));
      if (khRoof) {
        addFling(
          khRoof,
          (dx * 12) / s,
          6 / s,
          (dz * 12) / s,
          2,
          localGroundY + 1
        );
      }
    } else if (type === 'windmill') {
      const base =
        allMeshes.find((m) => m.geometry === windmillBaseGeo) || allMeshes[0];
      const blades = allMeshes.filter((m) => m !== base);
      if (base) addFold(base);
      blades.forEach((b, i) => {
        addFling(
          b,
          (Math.cos((i * Math.PI) / 2) * 12 + dx * 8) / s,
          6 / s,
          (Math.sin((i * Math.PI) / 2) * 12 + dz * 8) / s,
          3,
          localGroundY + 1
        );
      });
    } else if (type === 'hangar') {
      if (allMeshes[0]) addFold(allMeshes[0]);
      allMeshes.slice(1, 3).forEach((r, i) => {
        addFling(
          r,
          (dx * 14 + (i === 0 ? -4 : 4)) / s,
          6 / s,
          (dz * 14) / s,
          2,
          localGroundY + 1
        );
      });
    } else if (type === 'castle') {
      if (allMeshes[0]) addFold(allMeshes[0]);
    } else if (type === 'barn') {
      const body =
        allMeshes.find((m) => m.geometry === barnBodyGeo) || allMeshes[0];
      const roof =
        allMeshes.find((m) => m.geometry === barnRoofGeo) || allMeshes[1];
      const silo = allMeshes.filter((m) => m.position.x > 10);
      if (body) addFold(body);
      if (roof) {
        addFling(
          roof,
          (dx * 14) / s,
          6 / s,
          (dz * 14) / s,
          2,
          localGroundY + 1.5
        );
      }
      allMeshes.forEach((m) => {
        if (m !== body && m !== roof && !silo.includes(m)) {
          m.visible = false;
        }
      });
      if (silo.length) {
        addTopple(silo, new THREE.Vector3(12, localGroundY, 0));
      }
    } else {
      // house, two_story_house, straw_hut, pagoda, monastery
      const isHouse = type === 'house' || type === 'two_story_house';
      const body =
        allMeshes.find(
          (m) => m.geometry === houseBodyGeo || m.geometry === twoStoryBodyGeo
        ) || allMeshes[0];
      const roof =
        allMeshes.find(
          (m) => m.geometry === houseRoofGeo || m.geometry === twoStoryRoofGeo
        ) || allMeshes[1];
      const chimney = isHouse
        ? allMeshes.find(
            (m) =>
              m.geometry === houseChimneyGeo ||
              m.geometry === twoStoryChimneyGeo
          )
        : null;

      if (body) addFold(body);
      if (roof) {
        addFling(
          roof,
          (dx * 14) / s,
          6 / s,
          (dz * 14) / s,
          2,
          localGroundY + 1.2
        );
      }
      if (chimney) {
        addFling(
          chimney,
          (dx * 15) / s,
          7 / s,
          (dz * 15) / s,
          3,
          localGroundY + 0.8
        );
      }
      allMeshes.forEach((m) => {
        if (m !== body && m !== roof && m !== chimney) {
          m.visible = false;
        }
      });
    }

    const rubbleCount = BREAK.RUBBLE[type] || 12;
    const spread = Math.max(
      6,
      (new THREE.Box3().setFromObject(previewGroup).getSize(new THREE.Vector3())
        .x /
        s) *
        0.7
    );
    addRubble(
      rubbleCount,
      spread,
      bodyMat || roofMat || createMaterial({color: 0x998877}),
      null,
      1.1,
      1.0
    );
  }

  // 7. Trees, cactus, snowmen, mushrooms, crystals, streetlights, tents, airport props
  else {
    const allMeshes = [];
    previewGroup.traverse((c) => {
      if (c.isMesh) allMeshes.push(c);
    });
    if (type === 'streetlight' && allMeshes[2]) {
      allMeshes[2].material = createMaterial({color: 0x333333});
    }
    const clusters = [];
    allMeshes.forEach((mesh) => {
      let found = clusters.find((c) => Math.abs(c.x - mesh.position.x) < 4);
      if (!found) {
        found = {x: mesh.position.x, meshes: []};
        clusters.push(found);
      }
      found.meshes.push(mesh);
    });
    const spin = (type === 'snowman' ? 2 : 1) * toppleSpin(KTS);
    clusters.forEach((c, i) => {
      const jitter = (i - (clusters.length - 1) / 2) * 0.15;
      const clusterAxis = axis
        .clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), jitter);
      addTopple(
        c.meshes,
        new THREE.Vector3(c.x, localGroundY, 0),
        clusterAxis,
        spin * (0.95 + Math.random() * 0.1)
      );
    });
  }

  let frameStep = 0;
  return {
    update(dt) {
      frameStep++;
      for (const piece of pieces) {
        const anim = piece.anim;
        if (anim.kind === 'topple') {
          if (anim.stepped !== frameStep) {
            anim.stepped = frameStep;
            stepTopple(anim, dt);
          }
          _r.makeRotationAxis(_axis.copy(anim.axis).normalize(), anim.angle);
          const pv = anim.pivot;
          _m.makeTranslation(pv.x, pv.y, pv.z);
          _m.multiply(_r);
          _m.multiply(_t.makeTranslation(-pv.x, -pv.y, -pv.z));
          _m.multiply(_m0.fromArray(piece.m0));
          _m.toArray(piece.m);
          piece.mesh.matrix.fromArray(piece.m);
        } else if (anim.kind === 'fold') {
          stepFold(anim, dt);
          _r.makeRotationAxis(_axis.copy(anim.axis).normalize(), anim.lean);
          _r.multiply(_t.makeScale(1, anim.squash, 1));
          const pv = anim.pivot;
          _m.makeTranslation(pv.x, pv.y, pv.z);
          _m.multiply(_r);
          _m.multiply(_t.makeTranslation(-pv.x, -pv.y, -pv.z));
          _m.multiply(_m0.fromArray(piece.m0));
          _m.toArray(piece.m);
          piece.mesh.matrix.fromArray(piece.m);
        } else if (anim.kind === 'fly') {
          stepFlying(anim, dt, gravity);
          _m.makeTranslation(anim.x, anim.y, anim.z);
          _m.multiply(_r.makeRotationAxis(anim.axis, anim.angle));
          _m.multiply(
            _t.makeTranslation(-anim.from.x, -anim.from.y, -anim.from.z)
          );
          _m.multiply(_m0.fromArray(piece.m0));
          _m.toArray(piece.m);
          piece.mesh.matrix.fromArray(piece.m);
        } else if (anim.kind === 'sink') {
          stepSink(anim, dt);
          const pv = anim.pivot;
          _m.makeTranslation(pv.x, pv.y - anim.drop * s, pv.z);
          _m.multiply(_r.makeRotationAxis(anim.axis, anim.roll));
          _m.multiply(_t.makeTranslation(-pv.x, -pv.y, -pv.z));
          _m.multiply(_m0.fromArray(piece.m0));
          _m.toArray(piece.m);
          piece.mesh.matrix.fromArray(piece.m);
          if (anim.t > BREAK.SINK_GONE) piece.mesh.visible = false;
        } else if (anim.kind === 'scatter') {
          stepScatter(anim, dt);
          _r.makeRotationY(anim.turnAngle);
          _r.premultiply(
            _r2.makeRotationAxis(_axis.set(anim.uz, 0, -anim.ux), anim.pitch)
          );
          _r.premultiply(
            _r2.makeRotationAxis(_axis.set(anim.ux, 0, anim.uz), anim.roll)
          );
          const pv = anim.pivot;
          _m.makeTranslation(
            pv.x + anim.ux * anim.along * s,
            pv.y + anim.up * s,
            pv.z + anim.uz * anim.along * s
          );
          _m.multiply(_r);
          _m.multiply(_t.makeTranslation(-pv.x, -pv.y, -pv.z));
          _m.multiply(_m0.fromArray(piece.m0));
          _m.toArray(piece.m);
          piece.mesh.matrix.fromArray(piece.m);
          if (anim.done) piece.mesh.visible = false;
        }
      }
    },
  };
}
