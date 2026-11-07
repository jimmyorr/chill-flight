// --- LOW-POLY CROWD MODELS ---
// Trees, bushes and stumps are drawn by the hundred or thousand, so each
// needs to be tens of triangles, not the 300-1,000 of a Polyfork model.
// These build a cheap stand-in from a detailed model: its crown as a few
// faceted lumps that follow its shape and colours, its trunk as one tapered
// prism, dead trees as a trunk and a few bare limbs.
import * as THREE from 'three';

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
