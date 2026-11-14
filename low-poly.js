// --- LOW-POLY CROWD MODELS ---
// Trees, bushes and stumps are drawn by the hundred or thousand, so each
// needs to be tens of triangles, not the 300-1,000 of a Polyfork model.
// These build a cheap stand-in from a detailed model: its crown as a few
// faceted lumps that follow its shape and colours, its trunk as one tapered
// prism, dead trees as a trunk and a few bare limbs.
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Triangle centres of `geo` with their areas and colours
function triangles(geo) {
  const p = geo.attributes.position;
  const c = geo.attributes.color;
  const out = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const d = new THREE.Vector3();
  const tri = new THREE.Triangle();
  const index = geo.index;
  const n = index ? index.count : p.count;
  for (let t = 0; t < n; t += 3) {
    const i0 = index ? index.getX(t) : t;
    const i1 = index ? index.getX(t + 1) : t + 1;
    const i2 = index ? index.getX(t + 2) : t + 2;
    a.fromBufferAttribute(p, i0);
    b.fromBufferAttribute(p, i1);
    d.fromBufferAttribute(p, i2);
    tri.set(a, b, d);
    const area = tri.getArea();
    if (area <= 0) continue;
    out.push({
      x: (a.x + b.x + d.x) / 3,
      y: (a.y + b.y + d.y) / 3,
      z: (a.z + b.z + d.z) / 3,
      w: area,
      r: c ? c.getX(i0) : 1,
      g: c ? c.getY(i0) : 1,
      b: c ? c.getZ(i0) : 1,
    });
  }
  return out;
}

// One non-indexed vertex-coloured geometry from [geometry, [r, g, b]] parts
export function joinColored(parts) {
  const pos = [];
  const col = [];
  for (const [src, [r, g, b]] of parts) {
    const geo = src.index ? src.toNonIndexed() : src;
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      col.push(r, g, b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeVertexNormals();
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

export function geometryAverageColor(geo) {
  const srcCol = geo.attributes.color;
  if (!srcCol) return [1, 1, 1];
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < srcCol.count; i++) {
    r += srcCol.getX(i);
    g += srcCol.getY(i);
    b += srcCol.getZ(i);
  }
  return [r / srcCol.count, g / srcCol.count, b / srcCol.count];
}

export function fillVertexColor(geo, r, g, b) {
  const count = geo.attributes.position.count;
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    col[i * 3] = r;
    col[i * 3 + 1] = g;
    col[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

// A simple shape (spanning -1..1) scaled and moved to fill `geo`'s bounds.
export function fitToBounds(shape, geo) {
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const center = box.getCenter(new THREE.Vector3());
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  shape.scale(half.x, half.y, half.z);
  shape.translate(center.x, center.y, center.z);
  if (geo.attributes.color) {
    const [r, g, b] = geometryAverageColor(geo);
    fillVertexColor(shape, r, g, b);
  }
  return shape;
}

export const farCanopy = (geo) =>
  fitToBounds(new THREE.IcosahedronGeometry(1, 0), geo); // 20 triangles

export const farTrunk = (geo) => {
  geo.computeBoundingBox();
  const h = geo.boundingBox.max.y * 0.75;
  const shape = new THREE.CylinderGeometry(0.9, 1.4, h, 6, 1, true); // 12 triangles
  shape.translate(0, h * 0.5, 0);
  if (geo.attributes.color) {
    const [r, g, b] = geometryAverageColor(geo);
    fillVertexColor(shape, r, g, b);
  }
  return shape;
};

const sharedShadow = (targetType, shape, geo) => {
  const proxy = fitToBounds(shape, geo);
  const box = geo.boundingBox;
  const center = box.getCenter(new THREE.Vector3());
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  proxy._shadowShare = {
    targetType,
    sx: half.x,
    sy: half.y,
    sz: half.z,
    tx: center.x,
    ty: center.y,
    tz: center.z,
  };
  return proxy;
};

export const shadowBox = (geo) =>
  sharedShadow('shadowBox', new THREE.BoxGeometry(2, 2, 2), geo); // 12 triangles

export const shadowCylinder = (geo) =>
  sharedShadow(
    'shadowCylinder',
    new THREE.CylinderGeometry(1, 1, 2, 8, 1, true),
    geo
  ); // 16 triangles

// A round roof (straw hut, silo dome): a cone, closed on top unlike the
// open-ended cylinder, which looks hollow from above far away (16 triangles)
export const shadowCone = (geo) =>
  sharedShadow('shadowCone', new THREE.ConeGeometry(1, 2, 8, 1, false), geo);

// A gable roof: a box whose top edges meet along the longer side (8 triangles)
export const shadowGable = (geo) => {
  geo.computeBoundingBox();
  const size = geo.boundingBox.getSize(new THREE.Vector3());
  const shape = new THREE.BoxGeometry(2, 2, 2);
  const pos = shape.attributes.position;
  const across = size.x < size.z ? 0 : 2; // ridge runs along the other axis
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) pos.setComponent(i, across, 0);
  }
  shape.computeVertexNormals();
  return fitToBounds(shape, geo);
};

function geometryBandColor(geo, y0Frac, y1Frac) {
  const pos = geo.attributes.position;
  const col = geo.attributes.color;
  if (!col) return [1, 1, 1];
  geo.computeBoundingBox();
  const {min, max} = geo.boundingBox;
  const h = max.y - min.y || 1;
  const y0 = min.y + h * y0Frac;
  const y1 = min.y + h * y1Frac;
  const index = geo.index;
  const n = index ? index.count : pos.count;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const tri = new THREE.Triangle();
  let r = 0;
  let g = 0;
  let bl = 0;
  let wSum = 0;
  for (let i = 0; i < n; i += 3) {
    const i0 = index ? index.getX(i) : i;
    const i1 = index ? index.getX(i + 1) : i + 1;
    const i2 = index ? index.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    const cy = (a.y + b.y + c.y) / 3;
    if (cy < y0 || cy > y1) continue;
    tri.set(a, b, c);
    const area = tri.getArea();
    if (area <= 0) continue;
    wSum += area;
    r += ((col.getX(i0) + col.getX(i1) + col.getX(i2)) / 3) * area;
    g += ((col.getY(i0) + col.getY(i1) + col.getY(i2)) / 3) * area;
    bl += ((col.getZ(i0) + col.getZ(i1) + col.getZ(i2)) / 3) * area;
  }
  if (wSum <= 0) return geometryAverageColor(geo);
  return [r / wSum, g / wSum, bl / wSum];
}

function taperedBox(wxTop, wzTop, wxBot, wzBot, y0, y1) {
  const g = new THREE.CylinderGeometry(1, 1, y1 - y0, 4, 1, true);
  g.rotateY(Math.PI / 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const isTop = p.getY(i) > 0;
    p.setX(i, p.getX(i) * Math.SQRT2 * (isTop ? wxTop : wxBot));
    p.setZ(i, p.getZ(i) * Math.SQRT2 * (isTop ? wzTop : wzBot));
  }
  g.translate(0, (y0 + y1) * 0.5, 0);
  return g;
}

function pyramidRoof(wxBot, wzBot, y0, y1) {
  const g = new THREE.ConeGeometry(1, y1 - y0, 4, 1, false);
  g.rotateY(Math.PI / 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setX(i, p.getX(i) * Math.SQRT2 * wxBot);
    p.setZ(i, p.getZ(i) * Math.SQRT2 * wzBot);
  }
  g.translate(0, (y0 + y1) * 0.5, 0);
  return g;
}

export function towerFarGeo(type, geo) {
  geo.computeBoundingBox();
  const {min, max} = geo.boundingBox;
  const cx = (min.x + max.x) * 0.5;
  const cz = (min.z + max.z) * 0.5;
  const hx = (max.x - min.x) * 0.5;
  const hz = (max.z - min.z) * 0.5;
  const y0 = min.y;
  const y1 = max.y;
  const h = y1 - y0;
  if (type === 'castleRuins') {
    const t1 = new THREE.CylinderGeometry(5, 6.5, h, 6, 1, false).translate(
      0,
      y0 + h * 0.5,
      0
    );
    const keepH = Math.min(22.5, h);
    const keep = new THREE.BoxGeometry(16, keepH, 19).translate(
      12,
      y0 + keepH * 0.5,
      -5.5
    );
    const t2H = Math.min(20, h);
    const t2 = new THREE.CylinderGeometry(4.5, 6, t2H, 6, 1, false).translate(
      24,
      y0 + t2H * 0.5,
      4
    );
    const out = mergeGeometries([t1, keep, t2]);
    out.computeBoundingBox();
    out.computeBoundingSphere();
    return out;
  }
  if (type === 'fireLookout') {
    const yCab0 = y0 + h * 0.72;
    const yCab1 = y0 + h * 0.9;
    const legs = taperedBox(
      hx * 0.52,
      hz * 0.52,
      hx * 0.95,
      hz * 0.95,
      y0,
      yCab0
    ).translate(cx, 0, cz);
    const cab = new THREE.BoxGeometry(
      hx * 1.55,
      yCab1 - yCab0,
      hz * 1.55
    ).translate(cx, (yCab0 + yCab1) * 0.5, cz);
    const roof = pyramidRoof(hx * 0.92, hz * 0.92, yCab1, y1).translate(
      cx,
      0,
      cz
    );
    return joinColored([
      [legs, geometryBandColor(geo, 0, 0.72)],
      [cab, geometryBandColor(geo, 0.72, 0.9)],
      [roof, geometryBandColor(geo, 0.9, 1)],
    ]);
  }
  if (type === 'waterTower') {
    const r = Math.max(hx, hz);
    const yTank0 = y0 + h * 0.56;
    const yTank1 = y0 + h * 0.84;
    const legs = new THREE.CylinderGeometry(
      r * 0.48,
      r * 0.95,
      yTank0 - y0,
      6,
      1,
      true
    ).translate(cx, (y0 + yTank0) * 0.5, cz);
    const tank = new THREE.CylinderGeometry(
      r * 0.78,
      r * 0.78,
      yTank1 - yTank0,
      6,
      1,
      false
    ).translate(cx, (yTank0 + yTank1) * 0.5, cz);
    const roof = new THREE.ConeGeometry(
      r * 0.82,
      y1 - yTank1,
      6,
      1,
      true
    ).translate(cx, (yTank1 + y1) * 0.5, cz);
    return joinColored([
      [legs, geometryBandColor(geo, 0, 0.56)],
      [tank, geometryBandColor(geo, 0.56, 0.84)],
      [roof, geometryBandColor(geo, 0.84, 1)],
    ]);
  }
  if (type === 'windpump') {
    const yHead = y0 + h * 0.79;
    const legs = taperedBox(
      hx * 0.25,
      hz * 0.25,
      hx * 0.9,
      hz * 0.9,
      y0,
      yHead
    ).translate(cx, 0, cz);
    const wheelH = y1 - yHead;
    const wheel = new THREE.BoxGeometry(hx * 1.65, wheelH, hz * 0.28).translate(
      cx,
      (yHead + y1) * 0.5,
      cz
    );
    const vane = new THREE.BoxGeometry(
      hx * 0.26,
      wheelH * 0.62,
      hz * 1.65
    ).translate(cx, yHead + wheelH * 0.42, cz);
    const headCol = geometryBandColor(geo, 0.79, 1);
    return joinColored([
      [legs, geometryBandColor(geo, 0, 0.79)],
      [wheel, headCol],
      [vane, headCol],
    ]);
  }
  const r = Math.max(hx, hz);
  const yCap0 = y0 + h * 0.68;
  const yFin0 = y0 + h * 0.9;
  const body = new THREE.CylinderGeometry(
    r * 0.66,
    r * 0.98,
    yCap0 - y0,
    6,
    1,
    true
  ).translate(cx, (y0 + yCap0) * 0.5, cz);
  const cap = new THREE.ConeGeometry(
    r * 0.72,
    yFin0 - yCap0,
    6,
    1,
    false
  ).translate(cx, (yCap0 + yFin0) * 0.5, cz);
  const finial = new THREE.ConeGeometry(
    r * 0.12,
    y1 - yFin0,
    4,
    1,
    true
  ).translate(cx, (yFin0 + y1) * 0.5, cz);
  return joinColored([
    [body, geometryBandColor(geo, 0, 0.68)],
    [cap, geometryBandColor(geo, 0.68, 0.9)],
    [finial, geometryBandColor(geo, 0.9, 1)],
  ]);
}

/**
 * A crown of `k` faceted lumps (20 triangles each) standing in for `geo`:
 * its triangles grouped by position (k-means, weighted by area), each group
 * a lump as wide as its spread and the group's average colour.
 */
export function lumpCrown(geo, k = 5) {
  const tris = triangles(geo);
  if (!tris.length) return geo;
  // Start from spread-out seeds: the heaviest, then each farthest from those
  const centers = [];
  let first = tris[0];
  for (const t of tris) if (t.w > first.w) first = t;
  centers.push({x: first.x, y: first.y, z: first.z});
  while (centers.length < Math.min(k, tris.length)) {
    let best = null;
    let bestD = -1;
    for (const t of tris) {
      let near = Infinity;
      for (const c of centers) {
        near = Math.min(
          near,
          (t.x - c.x) ** 2 + (t.y - c.y) ** 2 + (t.z - c.z) ** 2
        );
      }
      if (near > bestD) {
        bestD = near;
        best = t;
      }
    }
    centers.push({x: best.x, y: best.y, z: best.z});
  }
  const owner = new Int32Array(tris.length);
  for (let iter = 0; iter < 12; iter++) {
    for (let i = 0; i < tris.length; i++) {
      const t = tris[i];
      let bestD = Infinity;
      for (let j = 0; j < centers.length; j++) {
        const c = centers[j];
        const dist = (t.x - c.x) ** 2 + (t.y - c.y) ** 2 + (t.z - c.z) ** 2;
        if (dist < bestD) {
          bestD = dist;
          owner[i] = j;
        }
      }
    }
    for (let j = 0; j < centers.length; j++) {
      let w = 0;
      let x = 0;
      let y = 0;
      let z = 0;
      for (let i = 0; i < tris.length; i++) {
        if (owner[i] !== j) continue;
        const t = tris[i];
        w += t.w;
        x += t.x * t.w;
        y += t.y * t.w;
        z += t.z * t.w;
      }
      if (w > 0) centers[j] = {x: x / w, y: y / w, z: z / w};
    }
  }
  const parts = [];
  const lumps = [];
  for (let j = 0; j < centers.length; j++) {
    const c = centers[j];
    let w = 0;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < tris.length; i++) {
      if (owner[i] !== j) continue;
      const t = tris[i];
      w += t.w;
      sx += (t.x - c.x) ** 2 * t.w;
      sy += (t.y - c.y) ** 2 * t.w;
      sz += (t.z - c.z) ** 2 * t.w;
      r += t.r * t.w;
      g += t.g * t.w;
      b += t.b * t.w;
    }
    if (w <= 0) continue;
    // A lump reaching about as far as its triangles do (2 standard
    // deviations), never a thin sliver
    const rx = Math.sqrt(sx / w) * 2;
    const ry = Math.sqrt(sy / w) * 2;
    const rz = Math.sqrt(sz / w) * 2;
    const m = Math.max(rx, ry, rz);
    const lump = new THREE.IcosahedronGeometry(1, 0);
    lump.rotateY(j * 1.3);
    lump.scale(
      Math.max(rx, m * 0.45),
      Math.max(ry, m * 0.45),
      Math.max(rz, m * 0.45)
    );
    lump.translate(c.x, c.y, c.z);
    parts.push([lump, [r / w, g / w, b / w]]);
    lumps.push({x: c.x, y: c.y, z: c.z});
  }
  const crown = joinColored(parts);
  // Where the lumps are, for limbs up to them (limbsTo)
  crown.userData.lumps = lumps;
  return crown;
}

// Area-weighted average colour of `geo`'s triangles
export function averageColor(geo) {
  let w = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const t of triangles(geo)) {
    w += t.w;
    r += t.r * t.w;
    g += t.g * t.w;
    b += t.b * t.w;
  }
  return w > 0 ? [r / w, g / w, b / w] : [1, 1, 1];
}

/**
 * A tapered six-sided trunk (12 triangles, open ends) standing in for
 * `geo`: as thick at the foot as it is a little above its roots, up to
 * `topY`, in its average colour.
 */
export function prismTrunk(geo, topY) {
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const h = box.max.y - box.min.y;
  const p = geo.attributes.position;
  let cx = 0;
  let cz = 0;
  const pts = [];
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y >= box.min.y + h * 0.08 && y <= box.min.y + h * 0.3) {
      pts.push([p.getX(i), p.getZ(i)]);
    }
  }
  let r = 1;
  if (pts.length) {
    cx = pts.reduce((s, q) => s + q[0], 0) / pts.length;
    cz = pts.reduce((s, q) => s + q[1], 0) / pts.length;
    const d = pts
      .map(([x, z]) => Math.hypot(x - cx, z - cz))
      .sort((a, b) => a - b);
    r = Math.max(0.3, d[Math.floor(d.length * 0.6)]);
  }
  const top = Math.max(topY, box.min.y + 1);
  const trunk = new THREE.CylinderGeometry(r * 0.6, r * 1.15, 1, 6, 1, true);
  trunk.scale(1, top - box.min.y, 1);
  trunk.translate(cx, box.min.y + (top - box.min.y) / 2, cz);
  return joinColored([[trunk, averageColor(geo)]]);
}

/**
 * A bare dead tree standing in for `geo` (a trunk and its limbs): a tapered
 * trunk and `limbs` bare limbs (8 triangles each) reaching to where its
 * highest wood is, in its average colour (~50 triangles).
 */
export function bareTree(geo, limbs = 5) {
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const h = box.max.y - box.min.y;
  const color = averageColor(geo);
  const trunkTop = box.min.y + h * 0.5;
  const parts = [[prismTrunk(geo, trunkTop), color]];
  const trunkGeo = parts[0][0];
  trunkGeo.computeBoundingBox();
  const base = trunkGeo.boundingBox;
  const r = (base.max.x - base.min.x) / 2;
  const cx = (base.max.x + base.min.x) / 2;
  const cz = (base.max.z + base.min.z) / 2;
  // Each limb toward one of the model's high wood triangles, spread round
  const tris = triangles(geo).filter((t) => t.y > trunkTop);
  tris.sort(
    (a, b) => Math.atan2(a.z - cz, a.x - cx) - Math.atan2(b.z - cz, b.x - cx)
  );
  for (let i = 0; i < limbs && tris.length; i++) {
    // The farthest-out triangle in this slice of the circle
    const slice = tris.slice(
      Math.floor((i / limbs) * tris.length),
      Math.max(
        Math.floor(((i + 1) / limbs) * tris.length),
        Math.floor((i / limbs) * tris.length) + 1
      )
    );
    let tip = slice[0];
    for (const t of slice) {
      const far = Math.hypot(t.x - cx, t.z - cz) + (t.y - trunkTop) * 0.5;
      const was = Math.hypot(tip.x - cx, tip.z - cz) + (tip.y - trunkTop) * 0.5;
      if (far > was) tip = t;
    }
    const from = new THREE.Vector3(cx, trunkTop - h * 0.06, cz);
    const to = new THREE.Vector3(tip.x, tip.y, tip.z);
    const len = from.distanceTo(to);
    const limb = new THREE.CylinderGeometry(r * 0.12, r * 0.5, len, 4, 1, true);
    limb.translate(0, len / 2, 0);
    limb.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        to.clone().sub(from).normalize()
      )
    );
    limb.translate(from.x, from.y, from.z);
    parts.push([limb, color]);
  }
  return joinColored(parts);
}

/**
 * `trunk` (from prismTrunk) with a bare limb (8 triangles) from its top up
 * into each of `crown`'s lumps (lumpCrown), so none floats.
 */
export function limbsTo(trunk, crown) {
  trunk.computeBoundingBox();
  const box = trunk.boundingBox;
  const r = (box.max.x - box.min.x) / 2;
  const from = new THREE.Vector3(
    (box.max.x + box.min.x) / 2,
    box.max.y - (box.max.y - box.min.y) * 0.1,
    (box.max.z + box.min.z) / 2
  );
  const c = trunk.attributes.color;
  const color = c ? [c.getX(0), c.getY(0), c.getZ(0)] : [1, 1, 1];
  const parts = [[trunk, color]];
  for (const lump of crown.userData.lumps || []) {
    const to = new THREE.Vector3(lump.x, lump.y, lump.z);
    const len = from.distanceTo(to);
    if (len < r) continue;
    const limb = new THREE.CylinderGeometry(r * 0.25, r * 0.5, len, 4, 1, true);
    limb.translate(0, len / 2, 0);
    limb.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        to.clone().sub(from).normalize()
      )
    );
    limb.translate(from.x, from.y, from.z);
    parts.push([limb, color]);
  }
  return joinColored(parts);
}

// Rings through `geo` from foot to top: `bands` + 1 of them, each its
// triangles' centre at that height and a radius a little inside their spread
function trunkRings(geo, bands) {
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const h = box.max.y - box.min.y;
  const tris = triangles(geo);
  const rings = [];
  for (let i = 0; i <= bands; i++) {
    const y = box.min.y + (h * i) / bands;
    const near = tris.filter((t) => Math.abs(t.y - y) <= h / bands / 1.5);
    if (!near.length) {
      rings.push(null);
      continue;
    }
    const cx = near.reduce((s, t) => s + t.x, 0) / near.length;
    const cz = near.reduce((s, t) => s + t.z, 0) / near.length;
    const d = near
      .map((t) => Math.hypot(t.x - cx, t.z - cz))
      .sort((a, b) => a - b);
    rings.push({
      x: cx,
      y,
      z: cz,
      r: Math.max(0.2, d[Math.floor(d.length * 0.6)]),
    });
  }
  // Fill any band without triangles from its neighbours
  for (let i = 0; i < rings.length; i++) {
    if (rings[i]) continue;
    const prev = rings.slice(0, i).reverse().find(Boolean);
    const next = rings.slice(i + 1).find(Boolean);
    const src = prev || next;
    rings[i] = {...src, y: box.min.y + (h * i) / bands};
  }
  return rings;
}

// A tube through `rings` ({x, y, z, r}) with `sides` sides, open ends
function tube(rings, sides) {
  const pos = [];
  const ring = (k, j) => {
    const a = (j / sides) * Math.PI * 2;
    const g = rings[k];
    return [g.x + Math.cos(a) * g.r, g.y, g.z + Math.sin(a) * g.r];
  };
  for (let k = 0; k < rings.length - 1; k++) {
    for (let j = 0; j < sides; j++) {
      const a = ring(k, j);
      const b = ring(k, j + 1);
      const c = ring(k + 1, j + 1);
      const d = ring(k + 1, j);
      pos.push(...a, ...d, ...c, ...a, ...c, ...b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return out;
}

/**
 * A bent trunk (a palm's) standing in for `geo`: a five-sided tube through
 * its middle at `bands` + 1 heights, in its average colour (10 triangles a
 * band).
 */
export function bentTrunk(geo, bands = 4) {
  return joinColored([[tube(trunkRings(geo, bands), 5), averageColor(geo)]]);
}

/**
 * Palm fronds standing in for `geo` (a rosette of `count` fronds round
 * (cx, cz)): each frond a flat blade from the crown, through two points
 * along its spine, to its tip, as wide as the frond, both faces (10
 * triangles a frond), in the frond's average colour.
 */
export function frondRosette(geo, count, cx, cz) {
  const tris = triangles(geo);
  if (!tris.length) return geo;
  for (const t of tris) t.a = Math.atan2(t.z - cz, t.x - cx);
  tris.sort((p, q) => p.a - q.a);
  // Split the circle at the `count` widest gaps between fronds
  const gaps = tris.map((t, i) => {
    const next = tris[(i + 1) % tris.length];
    let g = next.a - t.a;
    if (g < 0) g += Math.PI * 2;
    return {i, g};
  });
  const cuts = gaps
    .sort((p, q) => q.g - p.g)
    .slice(0, count)
    .map((g) => g.i)
    .sort((p, q) => p - q);
  const crownY =
    tris.reduce((s, t) => s + t.y * t.w, 0) / tris.reduce((s, t) => s + t.w, 0);
  const parts = [];
  for (let f = 0; f < cuts.length; f++) {
    const from = cuts[f] + 1;
    const to = f + 1 < cuts.length ? cuts[f + 1] : cuts[0] + tris.length;
    const frond = [];
    for (let i = from; i <= to; i++) frond.push(tris[i % tris.length]);
    if (frond.length < 2) continue;
    // Direction out from the crown (area-weighted)
    let w = 0;
    let dx = 0;
    let dz = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    for (const t of frond) {
      w += t.w;
      dx += (t.x - cx) * t.w;
      dz += (t.z - cz) * t.w;
      r += t.r * t.w;
      g += t.g * t.w;
      b += t.b * t.w;
    }
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    // Along the frond: distance out, and how far to the side
    for (const t of frond) {
      t.d = (t.x - cx) * ux + (t.z - cz) * uz;
      t.s = -(t.x - cx) * uz + (t.z - cz) * ux;
    }
    const maxD = Math.max(...frond.map((t) => t.d));
    const spine = [];
    for (const [lo, hi] of [
      [0, 0.12],
      [0.18, 0.34],
      [0.4, 0.56],
      [0.62, 0.78],
      [0.88, 1.01],
    ]) {
      const bin = frond.filter((t) => t.d >= lo * maxD && t.d <= hi * maxD);
      if (!bin.length) continue;
      let bw = 0;
      let x = 0;
      let y = 0;
      let z = 0;
      let s2 = 0;
      for (const t of bin) {
        bw += t.w;
        x += t.x * t.w;
        y += t.y * t.w;
        z += t.z * t.w;
      }
      x /= bw;
      y /= bw;
      z /= bw;
      const sMid = -(x - cx) * uz + (z - cz) * ux;
      for (const t of bin) s2 += (t.s - sMid) ** 2 * t.w;
      spine.push({x, y, z, half: Math.sqrt(s2 / bw) * 1.3});
    }
    if (spine.length < 2) continue;
    // From the crown's middle, narrow at both ends
    spine.unshift({x: cx + ux * 0.3, y: crownY, z: cz + uz * 0.3, half: 0.2});
    spine[spine.length - 1].half = 0;
    // Each segment a shallow V (the midrib raised), both faces
    const pos = [];
    const edge = (p, side) => [
      p.x - uz * p.half * side,
      p.y - p.half * 0.35,
      p.z + ux * p.half * side,
    ];
    for (let k = 0; k < spine.length - 1; k++) {
      const p = spine[k];
      const q = spine[k + 1];
      const pm = [p.x, p.y, p.z];
      const qm = [q.x, q.y, q.z];
      for (const side of [1, -1]) {
        const pe = edge(p, side);
        const qe = edge(q, side);
        if (side === 1) {
          pos.push(...pe, ...qe, ...qm, ...pe, ...qm, ...pm);
          pos.push(...pe, ...qm, ...qe, ...pe, ...pm, ...qm);
        } else {
          pos.push(...pm, ...qm, ...qe, ...pm, ...qe, ...pe);
          pos.push(...pm, ...qe, ...qm, ...pm, ...pe, ...qe);
        }
      }
    }
    const blade = new THREE.BufferGeometry();
    blade.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    parts.push([blade, [r / w, g / w, b / w]]);
  }
  return joinColored(parts);
}

/**
 * Stacked cones (a snowy spruce) standing in for `geo`: `tiers` cones of
 * `sides` sides from its foliage's foot to its top, each as wide as its
 * band's widest reach, snow on top over a band of needles at the rim,
 * needles underneath (4 x sides triangles a tier).
 */
export function coneTiers(geo, tiers = 4, sides = 7) {
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const h = box.max.y - box.min.y;
  const cx = (box.max.x + box.min.x) / 2;
  const cz = (box.max.z + box.min.z) / 2;
  // (Leaving out a snow drift round the roots)
  const foot = box.min.y + h * 0.12;
  const tris = triangles(geo).filter((t) => t.y >= foot);
  const luma = (t) => t.r * 0.3 + t.g * 0.59 + t.b * 0.11;
  const avg = (list) => {
    let w = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    for (const t of list) {
      w += t.w;
      r += t.r * t.w;
      g += t.g * t.w;
      b += t.b * t.w;
    }
    return w > 0 ? [r / w, g / w, b / w] : null;
  };
  const pos = [];
  const col = [];
  const all = avg(tris) || [1, 1, 1];
  const snow = avg(tris.filter((t) => luma(t) >= 0.5)) || all;
  const needles = avg(tris.filter((t) => luma(t) < 0.5)) || all;
  const span = box.max.y - foot;
  for (let i = 0; i < tiers; i++) {
    const y0 = foot + (span * i) / tiers;
    const y1 = foot + (span * (i + 1)) / tiers;
    const band = tris.filter((t) => t.y >= y0 && t.y < y1 + 1e-6);
    if (!band.length) continue;
    const reach = band
      .map((t) => Math.hypot(t.x - cx, t.z - cz))
      .sort((a, b) => a - b);
    const r = reach[Math.floor(reach.length * 0.9)] * 1.1;
    // Snow on top, fading to needles at the rim; dark needles underneath
    const rim = snow.map((c, k) => c * 0.15 + needles[k] * 0.85);
    // Each cone's point reaches a little into the tier above
    const top = i === tiers - 1 ? box.max.y : y1 + (y1 - y0) * 0.35;
    const base = y0 - (i === 0 ? 0 : (y1 - y0) * 0.1);
    // Snow down to SNOW_LINE of the way to the rim, then a band of needles
    const SNOW_LINE = 0.72;
    const at = (a, f) => [
      cx + Math.cos(a) * r * f,
      top + (base - top) * f,
      cz + Math.sin(a) * r * f,
    ];
    for (let j = 0; j < sides; j++) {
      const a0 = (j / sides) * Math.PI * 2 + i * 0.4;
      const a1 = ((j + 1) / sides) * Math.PI * 2 + i * 0.4;
      const p0 = at(a0, 1);
      const p1 = at(a1, 1);
      const s0 = at(a0, SNOW_LINE);
      const s1 = at(a1, SNOW_LINE);
      // Snowy top
      pos.push(...s0, cx, top, cz, ...s1);
      col.push(...snow, ...snow, ...snow);
      // Needles below the snow
      pos.push(...p0, ...s0, ...s1, ...p0, ...s1, ...p1);
      col.push(...rim, ...rim, ...rim, ...rim, ...rim, ...rim);
      // Underside
      pos.push(...p0, ...p1, cx, base + (top - base) * 0.15, cz);
      col.push(...needles, ...needles, ...needles);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeVertexNormals();
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}
