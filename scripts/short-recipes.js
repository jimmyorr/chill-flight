// Diverse 10-archetype daily Short generator for batch rendering (e.g., 30-day
// YouTube Shorts queues). Rotates vehicle, livery, camera rig, maneuver,
// landmarks, weather/time-of-day, art style, and Purrple Cat music tracks so
// consecutive days never repeat the same look or feel.

import {ChillFlightLogic} from '../chill-flight-logic.js';
import {simplex} from '../noise.js';
import {archSites} from '../arches-logic.js';
import {PURRPLE_CAT_TRACKS} from '../music-logic.js';

const WATER_LEVEL = 40;
const LIVERIES = [
  'coral',
  'teal',
  'sand',
  'sage',
  'purple',
  'rose',
  'slate',
  'black',
];

// Calendar-accurate YYYYMMDD + offsetDays (handles month/year rollovers).
export function addDaysToSeed(seed, offsetDays) {
  const s = String(seed);
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  const dt = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return (
    dt.getUTCFullYear() * 10000 + (dt.getUTCMonth() + 1) * 100 + dt.getUTCDate()
  );
}

export function seedToIsoDate(seed) {
  const s = String(seed);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function coordLabel(x, z) {
  const lat = `${(Math.abs(z) / 5000).toFixed(1)}°${z <= 0 ? 'N' : 'S'}`;
  const lon = `${(Math.abs(x) / 5000).toFixed(1)}°${x >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lon}`;
}

// Curated 32-track non-repeating pool drawn deterministically from RAW_TRACKS.
function pickTrack(dayIndex) {
  const stride = Math.max(1, Math.floor(PURRPLE_CAT_TRACKS.length / 32));
  const idx = (dayIndex * stride + 7) % PURRPLE_CAT_TRACKS.length;
  const track = PURRPLE_CAT_TRACKS[idx];
  return {
    slug: `purrple-cat-${track.slug}`,
    title: track.title,
  };
}

// Scouts every major landmark available on a given daily seed.
export function scoutSeedLandmarks(seed) {
  ChillFlightLogic.WORLD_SEED = seed;
  simplex.seed(seed);
  const opts = {WATER_LEVEL};
  const arches = archSites(simplex, opts);
  const sea = [];
  const arcticSea = [];
  const gorge = [];
  const basalt = [];
  const canyonArch = [];
  let seaIdx = 0;
  let gorgeIdx = 0;
  let basaltIdx = 0;
  let canyonIdx = 0;
  for (const a of arches) {
    if (a.kind === 'sea') {
      const rec = {arch: a, archType: 'sea', index: seaIdx++};
      if (a.z < -15000) arcticSea.push(rec);
      else sea.push(rec);
    } else if (a.kind === 'gorge') {
      gorge.push({arch: a, archType: 'gorge', index: gorgeIdx++});
    } else if (a.kind === 'basalt') {
      basalt.push({arch: a, archType: 'basalt', index: basaltIdx++});
    } else if (a.kind === 'canyon') {
      canyonArch.push({arch: a, archType: 'canyon', index: canyonIdx++});
    }
  }
  return {
    seed,
    opts,
    pyramids: ChillFlightLogic.pyramidSite(simplex, opts),
    dragon: ChillFlightLogic.dragonSite(simplex, opts),
    oak: ChillFlightLogic.giantSwampOak(),
    portals: ChillFlightLogic.portalSites(simplex, opts),
    xmas: ChillFlightLogic.xmasVillageSite?.(simplex, opts) || null,
    sea,
    arcticSea,
    gorge,
    basalt,
    canyonArch,
  };
}

// Returns the first candidate whose flight corridor passes `planSegment` cleanly.
// Preserves candidate priority (ideal framing first, higher-altitude fallbacks later).
function chooseSafeSegment(clipSpec, candidates, planSegment) {
  for (const cand of candidates) {
    try {
      const plan = planSegment(clipSpec, cand);
      if (plan.check.ok) return cand;
    } catch {
      // Try next candidate
    }
  }
  return null;
}

// Builds candidate segment specs for a named landmark spot.
// `facing`:
//   - 'rear': camera behind plane looking forward toward/through landmark
//   - 'front': camera ahead of plane looking back (plane flies away from landmark)
//   - 'side-left': Ghibli side-profile cam on +X looking across fuselage toward -X
//     (so landmark sits 700..1100 units off the plane's left wing)
function spotCandidates(scout, spot, slot, facing = 'rear') {
  const {startFrame, endFrame, extra, plane, livery, style, hitOffset} = slot;
  const boost = slot.altBoost ?? 0;
  const baseHit = startFrame + (hitOffset ?? 42);
  const common = {
    startFrame,
    endFrame,
    extra,
    ...(plane ? {plane} : {}),
    ...(livery ? {livery} : {}),
    ...(style ? {style} : {}),
    ...(slot.speed ? {speed: slot.speed} : {}),
    ...(slot.moves ? {moves: slot.moves} : {}),
    ...(slot.rainbow ? {rainbow: true} : {}),
    ...(slot.lightningFrames ? {lightningFrames: slot.lightningFrames} : {}),
    ...(slot.xmas ? {xmas: slot.xmas} : {}),
    ...(slot.trip !== undefined ? {trip: slot.trip} : {}),
    ...(slot.badges ? {badges: slot.badges} : {}),
  };

  // Side-profile Ghibli framing: plane flies parallel to landmark with landmark on -X (left wing).
  // For heading = 0 (North, -Z), left wing is West (-X), so plane flies East (+X) of landmark.
  if (facing === 'side-left') {
    const sidePass = (label, lx, lz, baseY, dist = 850) => [
      {
        ...common,
        label,
        tx: Math.round(lx + dist),
        ty: Math.round(baseY + boost),
        tz: Math.round(lz),
        heading: 0,
        hitFrame: baseHit,
      },
      {
        ...common,
        label,
        tx: Math.round(lx - dist),
        ty: Math.round(baseY + 40 + boost),
        tz: Math.round(lz),
        heading: 180,
        hitFrame: baseHit,
      },
      {
        ...common,
        label,
        tx: Math.round(lx),
        ty: Math.round(baseY + 80 + boost),
        tz: Math.round(lz + dist),
        heading: 90,
        hitFrame: baseHit,
      },
    ];
    if (spot === 'falls') {
      return sidePass(
        `Twin Falls · ${coordLabel(0, -4500)}`,
        0,
        -4500,
        340,
        750
      );
    }
    if (spot === 'volcano') {
      return sidePass(
        `Volcano Caldera · ${coordLabel(-5000, 5000)}`,
        -5000,
        5000,
        1980,
        1150
      );
    }
    if (spot === 'pyramids') {
      const p = scout.pyramids;
      return sidePass(
        `Great Pyramids · ${coordLabel(p.x, p.z)}`,
        p.x,
        p.z,
        p.base + 380,
        1050
      );
    }
    if (spot === 'lighthouse') {
      return sidePass(
        `Headland Lighthouse · ${coordLabel(7525, 3000)}`,
        7525,
        3000,
        195,
        700
      );
    }
    if (spot === 'swamp-oak') {
      const o = scout.oak;
      return sidePass(
        `Giant Swamp Oak · ${coordLabel(o.x, o.z)}`,
        o.x,
        o.z,
        210,
        650
      );
    }
    if (spot === 'dragon') {
      const d = scout.dragon;
      return sidePass(
        `Dragon Skeleton · ${coordLabel(d.x, d.z)}`,
        d.x,
        d.z,
        d.base + 230,
        720
      );
    }
    if (spot === 'xmas' && scout.xmas) {
      const xm = scout.xmas;
      return sidePass(
        `Christmas Village · ${coordLabel(xm.x, xm.z)}`,
        xm.x,
        xm.z,
        xm.base + 185,
        680
      ).map((c) => ({...c, xmas: 'full'}));
    }
    const archPick =
      spot === 'sea-arch'
        ? scout.sea[0] || scout.arcticSea[0]
        : spot === 'basalt-arch'
          ? scout.basalt[0]
          : scout.gorge[0];
    if (archPick) {
      const a = archPick.arch;
      const name =
        spot === 'sea-arch'
          ? 'Coral Sea Arch'
          : spot === 'basalt-arch'
            ? 'Alien Basalt Arch'
            : 'Mountain Gorge Bridge';
      return sidePass(
        `${name} · ${coordLabel(a.x, a.z)}`,
        a.x,
        a.z,
        Math.max(180, (a.high || 160) + 120),
        750
      );
    }
  }

  if (spot === 'falls') {
    if (facing === 'front') {
      return [
        {
          ...common,
          label: `Twin Falls · ${coordLabel(0, -4500)}`,
          tx: 60,
          ty: 265 + boost,
          tz: -3750,
          heading: 174,
          hitFrame: startFrame + 45,
        },
        {
          ...common,
          label: `Twin Falls · ${coordLabel(0, -4500)}`,
          tx: 60,
          ty: 340 + boost,
          tz: -3650,
          heading: 176,
          hitFrame: startFrame + 45,
        },
      ];
    }
    return [
      {
        ...common,
        label: `Twin Falls · ${coordLabel(0, -4500)}`,
        tx: 160,
        ty: 265 + boost,
        tz: -3550,
        heading: 12,
        hitFrame: baseHit,
      },
      {
        ...common,
        label: `Twin Falls · ${coordLabel(0, -4500)}`,
        tx: 120,
        ty: 485 + boost,
        tz: -3650,
        heading: 8,
        hitFrame: baseHit,
      },
    ];
  }

  if (spot === 'volcano') {
    if (facing === 'front') {
      return [
        {
          ...common,
          label: `Volcano Caldera · ${coordLabel(-5000, 5000)}`,
          tx: -5020,
          ty: 2040 + boost,
          tz: 4620,
          heading: 172,
          hitFrame: startFrame + 12,
        },
        {
          ...common,
          label: `Volcano Caldera · ${coordLabel(-5000, 5000)}`,
          tx: -4920,
          ty: 2140 + boost,
          tz: 4520,
          heading: 166,
          hitFrame: startFrame + 12,
        },
      ];
    }
    return [
      {
        ...common,
        label: `Volcano Caldera · ${coordLabel(-5000, 5000)}`,
        tx: -5020,
        ty: 2040 + boost,
        tz: 4620,
        heading: 172,
        hitFrame: baseHit,
      },
      {
        ...common,
        label: `Volcano Caldera · ${coordLabel(-5000, 5000)}`,
        tx: -4920,
        ty: 2140 + boost,
        tz: 4520,
        heading: 166,
        hitFrame: baseHit,
      },
    ];
  }

  if (spot === 'lighthouse') {
    return [
      {
        ...common,
        label: `Headland Lighthouse · ${coordLabel(7525, 3000)}`,
        tx: 7820,
        ty: 175 + boost,
        tz: 3160,
        heading: 55,
        hitFrame: startFrame + 55,
      },
      {
        ...common,
        label: `Headland Lighthouse · ${coordLabel(7525, 3000)}`,
        tx: 7860,
        ty: 260 + boost,
        tz: 3150,
        heading: 55,
        hitFrame: startFrame + 50,
      },
      {
        ...common,
        label: `Headland Lighthouse · ${coordLabel(7525, 3000)}`,
        tx: 7900,
        ty: 360 + boost,
        tz: 3200,
        heading: 52,
        hitFrame: startFrame + 48,
      },
    ];
  }

  if (spot === 'pyramids') {
    const p = scout.pyramids;
    const label = `Great Pyramids · ${coordLabel(p.x, p.z)}`;
    const offsets =
      facing === 'front'
        ? [
            {dx: -530, dz: -650, h: 14, y: 390},
            {dx: 560, dz: -650, h: -18, y: 420},
            {dx: -620, dz: 550, h: 165, y: 440},
            {dx: 620, dz: 550, h: -165, y: 480},
            {dx: 0, dz: -750, h: 0, y: 540},
          ]
        : [
            {dx: 850, dz: 850, h: 40, y: 490},
            {dx: -850, dz: 850, h: -40, y: 490},
            {dx: 850, dz: -850, h: 140, y: 520},
            {dx: -850, dz: -850, h: -140, y: 520},
            {dx: 0, dz: 950, h: 0, y: 640},
          ];
    return offsets.map((o) => ({
      ...common,
      label,
      tx: Math.round(p.x + o.dx),
      ty: Math.round(p.base + o.y + boost),
      tz: Math.round(p.z + o.dz),
      heading: o.h,
      hitFrame: startFrame + 38,
    }));
  }

  if (spot === 'dragon') {
    const d = scout.dragon;
    const label = `Dragon Skeleton · ${coordLabel(d.x, d.z)}`;
    return [
      {
        ...common,
        label,
        tx: Math.round(d.x + 120),
        ty: Math.round(d.base + 175 + boost),
        tz: Math.round(d.z + 180),
        heading: 12,
        hitFrame: baseHit,
      },
      {
        ...common,
        label,
        tx: Math.round(d.x - 120),
        ty: Math.round(d.base + 245 + boost),
        tz: Math.round(d.z - 160),
        heading: 168,
        hitFrame: baseHit,
      },
      {
        ...common,
        label,
        tx: Math.round(d.x),
        ty: Math.round(d.base + 380 + boost),
        tz: Math.round(d.z),
        heading: 90,
        hitFrame: baseHit,
      },
    ];
  }

  if (spot === 'swamp-oak') {
    const o = scout.oak;
    const label = `Giant Swamp Oak · ${coordLabel(o.x, o.z)}`;
    const oakHit = facing === 'front' ? startFrame + 16 : baseHit;
    return [
      {
        ...common,
        label,
        tx: Math.round(o.x + 390),
        ty: 245 + boost,
        tz: Math.round(o.z + 360),
        heading: facing === 'front' ? -132 : 48,
        hitFrame: oakHit,
      },
      {
        ...common,
        label,
        tx: Math.round(o.x - 390),
        ty: 260 + boost,
        tz: Math.round(o.z + 360),
        heading: facing === 'front' ? 132 : -48,
        hitFrame: oakHit,
      },
      {
        ...common,
        label,
        tx: Math.round(o.x + 410),
        ty: 345 + boost,
        tz: Math.round(o.z - 340),
        heading: 135,
        hitFrame: oakHit,
      },
    ];
  }

  if (spot === 'canyon') {
    const c = scout.canyonArch[0]?.arch;
    const cx = c ? Math.round(c.x) : 2950;
    const cz = c ? Math.round(c.z) : 17500;
    const label = `Red-Rock Canyon · ${coordLabel(cx, cz)}`;
    const canyonHit = facing === 'front' ? startFrame + 22 : startFrame + 32;
    return [
      {
        ...common,
        label,
        tx: cx,
        ty: 315 + boost,
        tz: cz,
        heading: 165,
        hitFrame: canyonHit,
      },
      {
        ...common,
        label,
        tx: cx,
        ty: 385 + boost,
        tz: cz,
        heading: 15,
        hitFrame: canyonHit,
      },
      {
        ...common,
        label,
        tx: cx,
        ty: 480 + boost,
        tz: cz,
        heading: 180,
        hitFrame: canyonHit,
      },
    ];
  }

  if (spot === 'xmas' && scout.xmas) {
    const xm = scout.xmas;
    const label = `Christmas Village · ${coordLabel(xm.x, xm.z)}`;
    const xmasHit = facing === 'front' ? startFrame + 16 : startFrame + 55;
    return [
      {
        ...common,
        label,
        xmas: 'full',
        tx: Math.round(xm.x),
        ty: Math.round(xm.base + 140 + boost),
        tz: Math.round(xm.z),
        heading: 55,
        hitFrame: xmasHit,
      },
      {
        ...common,
        label,
        xmas: 'full',
        tx: Math.round(xm.x),
        ty: Math.round(xm.base + 230 + boost),
        tz: Math.round(xm.z),
        heading: -45,
        hitFrame: xmasHit,
      },
      {
        ...common,
        label,
        xmas: 'full',
        tx: Math.round(xm.x),
        ty: Math.round(xm.base + 380 + boost),
        tz: Math.round(xm.z),
        heading: 0,
        hitFrame: xmasHit,
      },
    ];
  }

  if (spot === 'portal' && scout.portals?.east) {
    const east = scout.portals.east;
    const west = scout.portals.west;
    const label = `Xen Wormhole · ${coordLabel(east.x, east.z)}`;
    const destBadge = west
      ? [[startFrame + 36, `Westworld Portal · ${coordLabel(west.x, west.z)}`]]
      : undefined;
    return [
      {
        ...common,
        label,
        badges: destBadge,
        landmark: {
          kind: 'portal',
          side: 'east',
          direction: 1,
          heightAboveBase: 78,
        },
        hitFrame: startFrame + 34,
      },
      {
        ...common,
        label,
        badges: destBadge,
        landmark: {
          kind: 'portal',
          side: 'east',
          direction: -1,
          heightAboveBase: 78,
        },
        hitFrame: startFrame + 34,
      },
      {
        ...common,
        label,
        badges: destBadge,
        landmark: {
          kind: 'portal',
          side: 'east',
          direction: 1,
          heightAboveBase: 112,
        },
        hitFrame: startFrame + 34,
      },
    ];
  }

  // Arch spots: search ALL arches in the bucket before falling back.
  const archBuckets = {
    'sea-arch': {
      list: scout.sea.length ? scout.sea : scout.arcticSea,
      name: 'Coral Sea Arch',
    },
    'arctic-arch': {
      list: scout.arcticSea.length ? scout.arcticSea : scout.sea,
      name: scout.arcticSea.length ? 'Arctic Sea Arch' : 'Coastal Sea Arch',
    },
    'gorge-arch': {
      list: scout.gorge,
      name: 'Mountain Gorge Bridge',
    },
    'basalt-arch': {
      list: scout.basalt,
      name: 'Alien Basalt Arch',
    },
  };
  const bucket = archBuckets[spot];
  if (bucket && bucket.list.length > 0 && boost === 0) {
    const cands = [];
    for (const item of bucket.list) {
      const label = `${bucket.name} · ${coordLabel(item.arch.x, item.arch.z)}`;
      const archHit =
        facing === 'front'
          ? Math.max(0, startFrame - 55)
          : startFrame + (hitOffset ?? 44);
      for (const dir of [1, -1]) {
        for (const hf of [0.58, 0.7, 0.78]) {
          cands.push({
            ...common,
            label,
            landmark: {
              kind: 'arch',
              archType: item.archType,
              index: item.index,
              direction: dir,
              heightFrac: hf,
            },
            hitFrame: archHit,
          });
        }
      }
    }
    return cands;
  }

  // High-altitude overfly of the first arch when boost > 0 (e.g. aerobatic-loop climb)
  if (bucket && bucket.list.length > 0 && boost > 0) {
    const a = bucket.list[0].arch;
    const label = `${bucket.name} · ${coordLabel(a.x, a.z)}`;
    return [
      {
        ...common,
        label,
        tx: Math.round(a.x),
        ty: Math.round(Math.max(160, (a.high || 160) + 60) + boost),
        tz: Math.round(a.z),
        heading: 35,
        hitFrame: baseHit,
      },
      {
        ...common,
        label,
        tx: Math.round(a.x),
        ty: Math.round(Math.max(220, (a.high || 160) + 140) + boost),
        tz: Math.round(a.z),
        heading: -45,
        hitFrame: baseHit,
      },
    ];
  }

  return spotCandidates(scout, 'falls', slot, facing);
}

// 11 genuinely distinct visual & camera archetypes, rotated without repeats.
export const ARCHETYPE_IDS = [
  'front-evolution',
  'dolly-zoom',
  'wingtip-inverted',
  'orbit-2ship',
  'ghibli-anime',
  'aerobatic-loop',
  'weather-moods',
  'canyon-aerobatics',
  'telephoto-giants',
  'sunset-chase',
  'agility-loop',
];

export function buildDailyShortSpec(
  seed,
  dayIndex,
  planSegment,
  forcedArchetype = null
) {
  const scout = scoutSeedLandmarks(seed);
  const archetype =
    forcedArchetype || ARCHETYPE_IDS[dayIndex % ARCHETYPE_IDS.length];
  const cycle = Math.floor(dayIndex / ARCHETYPE_IDS.length);
  const track = pickTrack(dayIndex);
  const liv = (offset) => LIVERIES[(dayIndex * 3 + offset) % LIVERIES.length];

  let spec;

  if (archetype === 'front-evolution') {
    const speedMult = 1.24;
    // Biplane always anchors Segment 1 (3.0s..6.0s) so its snappy rollRate
    // completes a full player barrel roll + settle cleanly inside the 3s window.
    // Never uses `twin`; rotates across biplane, seaplane, and jet.
    const planeOrder =
      cycle % 2 === 0
        ? ['seaplane', 'biplane', 'jet', 'seaplane']
        : ['seaplane', 'biplane', 'jet', 'biplane'];
    const spotSets = [
      ['falls', 'canyon', 'pyramids', 'arctic-arch'],
      ['falls', 'sea-arch', 'volcano', 'basalt-arch'],
      ['swamp-oak', 'canyon', 'pyramids', 'xmas'],
    ];
    const spots = spotSets[cycle % spotSets.length];
    const extras = [
      'tod=0.285&weather=none&cloudMood=fair',
      'tod=0.49&weather=none&cloudMood=fair',
      'tod=0.695&weather=none&cloudMood=mackerel',
      'tod=0.755&weather=snow&headlight=1&cloudMood=high',
    ];
    const titles = [
      '3 planes, 1 seamless roll ✈️',
      'Plane evolution across 4 biomes ✈️',
      'Switching aircraft mid-barrel roll ✈️',
    ];
    spec = {
      id: `daily-${seed}`,
      archetype,
      banner: `Daily ${seed} [Front-Hero 3-Plane Evolution]`,
      seed,
      speedMult,
      camFrame: 'yaw',
      cam:
        `plane=${planeOrder[0]}&livery=${liv(0)}&smoke=1&speed=${speedMult}` +
        '&camOffset=-14,9,-68&camLook=3,3,22&fov=58',
      camMoves: [
        [0.0, -14, 9, -68, 3, 3, 22, 58],
        [3.0, -10, 10, -68, 2, 3, 22, 58],
        [6.0, 14, 9, -68, -3, 3, 22, 58],
        [9.0, 10, 10, -68, -2, 3, 22, 58],
        [12.0, -14, 9, -68, 3, 3, 22, 58],
      ],
      pilotMoves: {
        stick: [
          [0.0, 0.0, 0.0, speedMult],
          [1.3, 0.34, 0.05, speedMult],
          [2.7, 0.0, 0.02, speedMult],
          [6.1, 0.0, 0.02, speedMult],
          [7.4, -0.36, 0.05, speedMult],
          [8.75, 0.0, 0.02, speedMult],
          [9.2, 0.0, 0.06, 1.38],
          [10.5, 0.32, 0.06, 1.38],
          [11.8, 0.0, 0.0, 1.38],
          [12.0, 0.0, 0.0, 1.38],
        ],
        stunts: [[3.1, 4.95, 'roll-left']],
      },
      facing: 'front',
      slots: spots.map((spot, i) => ({
        spot,
        plane: planeOrder[i],
        livery: liv(i),
        extra: extras[i],
        startFrame: i * 90,
        endFrame: (i + 1) * 90,
      })),
      title: titles[cycle % titles.length],
      question: 'Biplane, seaplane, or jet?',
    };
  } else if (archetype === 'dolly-zoom') {
    const planes = ['biplane', 'seaplane', 'jet'];
    const plane = planes[cycle % planes.length];
    const speedMult = plane === 'jet' ? 1.48 : 1.22;
    const spotSets = [
      ['volcano', 'gorge-arch', 'pyramids', 'basalt-arch'],
      ['swamp-oak', 'sea-arch', 'volcano', 'lighthouse'],
      ['pyramids', 'gorge-arch', 'dragon', 'basalt-arch'],
    ];
    const spots = spotSets[cycle % spotSets.length];
    const extras = [
      'tod=0.30&weather=none&cloudMood=fair',
      'tod=0.50&weather=none&cloudMood=fair',
      'tod=0.69&weather=none&cloudMood=mackerel',
      'tod=0.765&headlight=1&weather=none&cloudMood=high',
    ];
    const titles = [
      'Vertigo dolly-zoom over 4 giants ✈️',
      'Dolly-zooming past 4 huge landmarks ✈️',
      'Cinematic lens zoom across 4 biomes ✈️',
    ];
    spec = {
      id: `daily-${seed}`,
      archetype,
      banner: `Daily ${seed} [Vertigo Dolly-Zoom (${plane})]`,
      seed,
      speedMult,
      camFrame: 'yaw',
      cam:
        `plane=${plane}&livery=${liv(1)}&smoke=1&speed=${speedMult}` +
        '&camOffset=10,7,54&camLook=-2,3,-76&fov=66',
      camMoves: [
        [0.0, 10, 7, 54, -2, 3, -76, 66],
        [2.6, 12, 20, 118, -2, -12, -85, 36],
        [3.2, 10, 7, 54, -2, 3, -76, 66],
        [5.6, 12, 20, 118, -2, -12, -85, 36],
        [6.2, 10, 7, 54, -2, 3, -76, 66],
        [8.6, 12, 20, 118, -2, -12, -85, 36],
        [9.2, 10, 7, 54, -2, 3, -76, 66],
        [11.4, 11, 16, 102, -2, -8, -82, 42],
        [12.0, 10, 7, 54, -2, 3, -76, 66],
      ],
      pilotMoves: {
        stick: [
          [0.0, 0.0, 0.0, speedMult],
          [1.5, -0.3, 0.05, speedMult],
          [3.0, 0.0, 0.02, speedMult],
          [4.5, 0.32, 0.05, speedMult],
          [6.0, 0.0, 0.02, speedMult],
          [7.5, -0.3, 0.05, speedMult],
          [9.0, 0.0, 0.02, speedMult],
          [10.5, 0.26, 0.04, speedMult],
          [12.0, 0.0, 0.0, speedMult],
        ],
      },
      facing: 'rear',
      slots: spots.map((spot, i) => ({
        spot,
        extra: extras[i],
        startFrame: i * 90,
        endFrame: (i + 1) * 90,
      })),
      title: titles[cycle % titles.length],
      question: 'Which landmark looked biggest?',
    };
  } else if (archetype === 'wingtip-inverted') {
    const planes = ['biplane', 'jet', 'seaplane'];
    const plane = planes[cycle % planes.length];
    const speedMult = plane === 'jet' ? 1.45 : 1.22;
    const spotSets = [
      ['canyon', 'sea-arch', 'dragon', 'lighthouse'],
      ['gorge-arch', 'arctic-arch', 'swamp-oak', 'basalt-arch'],
      ['falls', 'sea-arch', 'pyramids', 'gorge-arch'],
    ];
    const spots = spotSets[cycle % spotSets.length];
    const extras = [
      'tod=0.33&weather=none&cloudMood=fair',
      'tod=0.52&weather=none&cloudMood=fair',
      'tod=0.43&weather=snow&cloudMood=high',
      'tod=0.765&headlight=1&weather=none&cloudMood=busy',
    ];
    const titles = [
      'Wingtip cam inverted through an arch ✈️',
      'Upside-down wingtip cam across 4 biomes ✈️',
      'GoPro wingtip roll over 4 landmarks ✈️',
    ];
    spec = {
      id: `daily-${seed}`,
      archetype,
      banner: `Daily ${seed} [Wingtip Inverted GoPro (${plane})]`,
      seed,
      speedMult,
      direct: true,
      camFrame: 'plane',
      cam:
        `plane=${plane}&livery=${liv(2)}&smoke=1&speed=${speedMult}` +
        '&camOffset=21,6.2,16&camLook=-2,0.5,-24&fov=66',
      camMoves: [
        [0.0, 21, 6.2, 16, -2, 0.5, -24, 66],
        [2.2, 21, 6.2, 16, -2, 0.5, -24, 66],
        [3.6, 0, 8.5, 32, 0, 0.5, -36, 66],
        [5.8, 0, 8.5, 32, 0, 0.5, -36, 66],
        [7.2, -21, 6.2, 16, 2, 0.5, -24, 66],
        [9.2, -21, 6.2, 16, 2, 0.5, -24, 66],
        [10.8, 21, 6.2, 16, -2, 0.5, -24, 66],
        [12.0, 21, 6.2, 16, -2, 0.5, -24, 66],
      ],
      // Clean 6-knot monotone cubic spline: one unbroken roll onto its back (0 -> 180),
      // steady inverted pass through the arch, and one unbroken roll upright (180 -> 360).
      moves: [
        [0.0, 0, 0, 0],
        [3.1, 180, 2, -6],
        [5.7, 180, 0, -10],
        [8.5, 360, 2, -14],
        [10.6, 344, 0, -12],
        [12.0, 360, 0, -12],
      ],
      facing: 'rear',
      slots: spots.map((spot, i) => ({
        spot,
        extra: extras[i],
        startFrame: i * 90,
        endFrame: (i + 1) * 90,
      })),
      title: titles[cycle % titles.length],
      question: 'Would you fly inverted through that arch?',
    };
  } else if (archetype === 'orbit-2ship') {
    const planes = ['jet', 'biplane', 'seaplane'];
    const wingPlanes = ['jet', 'seaplane', 'biplane'];
    const plane = planes[cycle % planes.length];
    const wingPlane = wingPlanes[cycle % wingPlanes.length];
    const speedMult = plane === 'jet' ? 1.48 : 1.22;
    const wingSpeed = wingPlane === 'jet' ? 1.48 : 1.22;
    const wingRollHold =
      wingPlane === 'biplane' ? 1.95 : wingPlane === 'jet' ? 2.25 : 2.55;
    // Open panoramic landmarks so two widely spaced planes (55..75u apart)
    // never crowd each other or squeeze through narrow rock doorways.
    const spotSets = [
      ['falls', 'pyramids', 'dragon', 'xmas'],
      ['volcano', 'canyon', 'pyramids', 'lighthouse'],
      ['falls', 'canyon', 'volcano', 'lighthouse'],
    ];
    const spots = spotSets[cycle % spotSets.length];
    const extras = [
      'tod=0.31&weather=none&cloudMood=fair',
      'tod=0.50&weather=none&cloudMood=fair',
      'tod=0.69&weather=none&cloudMood=mackerel',
      'tod=0.77&headlight=1&weather=snow&cloudMood=high',
    ];
    const titles = [
      '2-ship 360 orbit across 4 biomes ✈️',
      'Loose 2-ship flight over 4 landmarks ✈️',
      '360 camera orbit around 2 planes ✈️',
    ];
    spec = {
      id: `daily-${seed}`,
      archetype,
      banner: `Daily ${seed} [Independent 2-Ship 360 Orbit (${plane} + ${wingPlane})]`,
      seed,
      speedMult,
      camFrame: 'yaw',
      cam:
        `plane=${plane}&livery=${liv(0)}&smoke=1&speed=${speedMult}` +
        '&camOffset=0,28,156&camLook=22,7,14&fov=64',
      camMoves: [
        [0.0, 0, 28, 156, 22, 7, 14, 64, 0, 0],
        [12.0, 0, 28, 156, 22, 7, 14, 64, 360, 0],
      ],
      wingmen: [
        {
          plane: wingPlane,
          livery: liv(4),
          smoke: 'white',
          followLead: true,
          relOffset: [48, 15, 32],
          speed: wingSpeed,
          stunts: [[5.2, 5.2 + wingRollHold, 'roll-right']],
        },
      ],
      pilotMoves: {
        stick: [
          [0.0, 0.0, 0.0, speedMult],
          [1.4, -0.24, 0.04, speedMult],
          [3.6, 0.0, 0.02, speedMult],
          [8.0, 0.0, 0.02, speedMult],
          [9.6, 0.24, 0.04, speedMult],
          [11.3, 0.0, 0.0, speedMult],
          [12.0, 0.0, 0.0, speedMult],
        ],
      },
      facing: 'rear',
      slots: spots.map((spot, i) => ({
        spot,
        altBoost: 60,
        extra: extras[i],
        startFrame: i * 90,
        endFrame: (i + 1) * 90,
      })),
      title: titles[cycle % titles.length],
      question: 'Which biome would you fly with a wingman?',
    };
  } else if (archetype === 'ghibli-anime') {
    const planes = ['biplane', 'seaplane', 'jet'];
    const plane = planes[cycle % planes.length];
    const speedMult = plane === 'jet' ? 1.5 : 1.24;
    const rollHold = plane === 'biplane' ? 1.95 : plane === 'jet' ? 2.25 : 2.55;
    const spotSets = [
      ['falls', 'falls', 'pyramids', 'lighthouse'],
      ['volcano', 'volcano', 'sea-arch', 'pyramids'],
      ['falls', 'falls', 'dragon', 'xmas'],
    ];
    const spots = spotSets[cycle % spotSets.length];
    const extras = [
      'tod=0.29&weather=none&cloudMood=fair',
      'tod=0.29&weather=none&cloudMood=fair',
      'tod=0.69&weather=none&cloudMood=mackerel',
      'tod=0.76&headlight=1&weather=none&cloudMood=busy',
    ];
    const styles = ['lowpoly', 'anime', 'lowpoly', 'anime'];
    const titles = [
      'Low-poly vs anime shader side-by-side ✈️',
      'Same flight in low-poly and anime style ✈️',
      'Low-poly vs anime shader aerobatics ✈️',
    ];
    spec = {
      id: `daily-${seed}`,
      archetype,
      banner: `Daily ${seed} [Low-Poly vs Anime Shader Swap (${plane})]`,
      seed,
      speedMult,
      camFrame: 'yaw',
      cam:
        `plane=${plane}&livery=${liv(3)}&smoke=1&speed=${speedMult}` +
        '&camOffset=36,11,56&camLook=-5,2,-54&fov=60',
      pilotMoves: {
        stick: [
          [0.0, 0.0, 0.02, speedMult],
          [1.6, -0.42, 0.08, speedMult],
          [3.1, 0.0, 0.04, speedMult],
          [6.5, 0.44, 0.06, speedMult],
          [9.4, -0.36, -0.04, speedMult],
          [11.4, 0.0, 0.0, speedMult],
          [12.0, 0.0, 0.0, speedMult],
        ],
        stunts: [
          [3.2, 3.2 + rollHold, 'roll-right'],
          [7.1, 8.6, 'climb'],
        ],
      },
      facing: 'rear',
      slots: spots.map((spot, i) => ({
        spot,
        altBoost: 70,
        style: styles[i],
        extra: extras[i],
        startFrame: i * 90,
        endFrame: (i + 1) * 90,
      })),
      title: titles[cycle % titles.length],
      question: 'Low-poly or anime shader?',
    };
  } else if (archetype === 'aerobatic-loop') {
    const planes = ['biplane', 'jet', 'seaplane'];
    const plane = planes[cycle % planes.length];
    const speedMult = plane === 'jet' ? 1.85 : 1.24;
    const loopEnd = plane === 'seaplane' ? 2.05 : 1.85;
    const rollEnd = plane === 'seaplane' ? 8.65 : plane === 'jet' ? 8.4 : 8.1;
    const spotSets = [
      ['falls', 'sea-arch', 'dragon', 'pyramids'],
      ['swamp-oak', 'canyon', 'volcano', 'basalt-arch'],
      ['gorge-arch', 'sea-arch', 'xmas', 'lighthouse'],
    ];
    const spots = spotSets[cycle % spotSets.length];
    const extras = [
      'tod=0.29&weather=none&cloudMood=fair',
      'tod=0.49&weather=none&cloudMood=fair',
      'tod=0.41&weather=snow&cloudMood=high',
      'tod=0.72&weather=none&cloudMood=busy',
    ];
    const titles = [
      'Full vertical loop across 4 biomes ✈️',
      'Loop, climbing roll, and dive ✈️',
      'One aerobatic loop through 4 skies ✈️',
    ];
    const altBoosts = [90, 280, 420, 320];
    spec = {
      id: `daily-${seed}`,
      archetype,
      banner: `Daily ${seed} [Aerobatic Vertical Loop (${plane})]`,
      seed,
      speedMult,
      camFrame: 'yaw',
      cam:
        `plane=${plane}&livery=${liv(5)}&smoke=1&speed=${speedMult}` +
        '&camOffset=34,12,56&camLook=-4,2,-58&fov=64',
      pilotMoves: {
        stick: [
          [0.0, 0.0, 0.0, speedMult],
          [3.6, 0.0, 0.0, speedMult],
          [4.6, -0.45, 0.08, speedMult],
          [5.9, 0.0, 0.02, speedMult],
          [9.0, 0.36, -0.06, speedMult],
          [11.2, 0.0, 0.0, speedMult],
          [12.0, 0.0, 0.0, speedMult],
        ],
        stunts: [
          [0.25, loopEnd, 'loop'],
          [3.8, 5.5, 'climb'],
          [6.1, rollEnd, 'roll-right'],
          [9.2, 10.6, 'dive'],
        ],
      },
      facing: 'rear',
      slots: spots.map((spot, i) => ({
        spot,
        altBoost: altBoosts[i],
        extra: extras[i],
        startFrame: i * 90,
        endFrame: (i + 1) * 90,
      })),
      title: titles[cycle % titles.length],
      question: 'Which biome would you loop over first?',
    };
  } else if (archetype === 'weather-moods') {
    const planes = ['seaplane', 'jet', 'biplane'];
    const plane = planes[cycle % planes.length];
    const speedMult = plane === 'jet' ? 1.5 : 1.22;
    const rollHold = plane === 'biplane' ? 1.95 : plane === 'jet' ? 2.25 : 2.55;
    const spotSets = [
      ['falls', 'sea-arch', 'lighthouse', 'dragon'],
      ['swamp-oak', 'gorge-arch', 'lighthouse', 'arctic-arch'],
      ['canyon', 'sea-arch', 'volcano', 'xmas'],
    ];
    const spots = spotSets[cycle % spotSets.length];
    const titles = [
      'One roll through 4 weather moods ✈️',
      'Mist, rainbow, lightning, and blizzard ✈️',
      'Flying from dawn mist to snowstorm ✈️',
    ];
    spec = {
      id: `daily-${seed}`,
      archetype,
      banner: `Daily ${seed} [4 Weather Moods (${plane})]`,
      seed,
      speedMult,
      camFrame: 'yaw',
      cam:
        `plane=${plane}&livery=${liv(1)}&smoke=1&speed=${speedMult}` +
        '&camOffset=-10,7,62&camLook=1,2,-70&fov=64',
      pilotMoves: {
        stick: [
          [0.0, 0.0, 0.0, speedMult],
          [1.3, 0.44, 0.06, speedMult],
          [2.8, 0.0, 0.02, speedMult],
          [6.3, -0.35, 0.04, speedMult],
          [9.6, 0.4, 0.05, speedMult],
          [11.5, 0.0, 0.0, speedMult],
          [12.0, 0.0, 0.0, speedMult],
        ],
        stunts: [
          [3.05, 3.05 + rollHold, 'roll-right'],
          [6.5, 8.3, 'sharp-left'],
        ],
      },
      facing: 'rear',
      slots: [
        {
          spot: spots[0],
          extra: 'tod=0.272&cloudCover=0.25&cloudMood=fair',
          startFrame: 0,
          endFrame: 90,
        },
        {
          spot: spots[1],
          extra: 'tod=0.39&weather=none&cloudCover=0.18&cloudMood=fair',
          rainbow: true,
          startFrame: 90,
          endFrame: 180,
        },
        {
          spot: spots[2],
          extra:
            'tod=0.68&weather=rain&cloudCover=0.92&headlight=1&cloudMood=busy',
          lightningFrames: [192, 234],
          startFrame: 180,
          endFrame: 270,
        },
        {
          spot: spots[3],
          extra: 'tod=0.44&weather=snow&cloudCover=0.82&cloudMood=high',
          startFrame: 270,
          endFrame: 360,
        },
      ],
      title: titles[cycle % titles.length],
      question: 'Mist, rainbow, lightning storm, or blizzard?',
    };
  } else if (archetype === 'canyon-aerobatics') {
    const planes = ['biplane', 'jet', 'seaplane'];
    const plane = planes[cycle % planes.length];
    const speedMult = plane === 'jet' ? 1.75 : 1.24;
    const loopEnd = plane === 'seaplane' ? 8.1 : 7.85;
    const rollEnd = plane === 'seaplane' ? 5.65 : plane === 'jet' ? 5.35 : 5.05;
    const spotSets = [
      ['falls', 'canyon', 'dragon', 'pyramids'],
      ['volcano', 'sea-arch', 'xmas', 'lighthouse'],
      ['canyon', 'pyramids', 'volcano', 'falls'],
    ];
    const spots = spotSets[cycle % spotSets.length];
    const extras = [
      'tod=0.285&weather=none&cloudMood=fair',
      'tod=0.52&weather=none&cloudMood=fair',
      'tod=0.43&weather=snow&cloudMood=high',
      'tod=0.715&weather=none&cloudMood=mackerel',
    ];
    const titles = [
      'Canyon carve and loop across 4 biomes ✈️',
      'Barrel roll and vertical loop over 4 giants ✈️',
      'Aerobatic pass through 4 landscapes ✈️',
    ];
    const altBoosts = [110, 140, 260, 260];
    spec = {
      id: `daily-${seed}`,
      archetype,
      banner: `Daily ${seed} [Canyon Carve & Loop (${plane})]`,
      seed,
      speedMult,
      camFrame: 'yaw',
      cam:
        `plane=${plane}&livery=${liv(0)}&smoke=1&speed=${speedMult}` +
        '&camOffset=-32,11,56&camLook=4,2,-58&fov=62',
      pilotMoves: {
        stick: [
          [0.0, 0.0, 0.0, speedMult],
          [1.2, -0.45, 0.04, speedMult],
          [2.85, 0.0, 0.02, speedMult],
          [6.1, 0.0, 0.0, speedMult],
          [9.4, 0.36, -0.05, speedMult],
          [11.3, 0.0, 0.0, speedMult],
          [12.0, 0.0, 0.0, speedMult],
        ],
        stunts: [
          [0.6, 2.3, 'sharp-left'],
          [3.1, rollEnd, 'roll-right'],
          [6.2, loopEnd, 'loop'],
          [9.5, 10.9, 'dive'],
        ],
      },
      facing: 'rear',
      slots: spots.map((spot, i) => ({
        spot,
        altBoost: altBoosts[i],
        extra: extras[i],
        startFrame: i * 90,
        endFrame: (i + 1) * 90,
      })),
      title: titles[cycle % titles.length],
      question: 'Which landscape looks best from the cockpit?',
    };
  } else if (archetype === 'telephoto-giants') {
    const planes = ['biplane', 'jet', 'seaplane'];
    const plane = planes[cycle % planes.length];
    const speedMult = plane === 'jet' ? 1.52 : 1.22;
    const rollHold = plane === 'biplane' ? 1.95 : plane === 'jet' ? 2.25 : 2.55;
    const spotSets = [
      ['volcano', 'pyramids', 'gorge-arch', 'lighthouse'],
      ['falls', 'swamp-oak', 'pyramids', 'lighthouse'],
      ['volcano', 'canyon', 'arctic-arch', 'xmas'],
    ];
    const spots = spotSets[cycle % spotSets.length];
    const extras = [
      'tod=0.285&weather=none&cloudMood=fair',
      'tod=0.52&weather=none&cloudMood=fair',
      'tod=0.69&weather=none&cloudMood=mackerel',
      'tod=0.76&headlight=1&weather=none&cloudMood=high',
    ];
    const titles = [
      'Telephoto lens makes landmarks huge ✈️',
      'Long-lens flight past 4 giants ✈️',
      'Telephoto zoom across 4 biomes ✈️',
    ];
    spec = {
      id: `daily-${seed}`,
      archetype,
      banner: `Daily ${seed} [Telephoto Giants (${plane})]`,
      seed,
      speedMult,
      camFrame: 'yaw',
      cam:
        `plane=${plane}&livery=${liv(6)}&smoke=1&speed=${speedMult}` +
        '&camOffset=-10,10,118&camLook=1,-4,-95&fov=36',
      pilotMoves: {
        stick: [
          [0.0, 0.0, 0.0, speedMult],
          [1.5, -0.22, 0.04, speedMult],
          [2.9, 0.0, 0.02, speedMult],
          [7.4, 0.24, 0.04, speedMult],
          [10.2, -0.2, 0.03, speedMult],
          [11.6, 0.0, 0.0, speedMult],
          [12.0, 0.0, 0.0, speedMult],
        ],
        stunts: [[3.1, 3.1 + rollHold, 'roll-left']],
      },
      facing: 'rear',
      slots: spots.map((spot, i) => ({
        spot,
        extra: extras[i],
        startFrame: i * 90,
        endFrame: (i + 1) * 90,
      })),
      title: titles[cycle % titles.length],
      question: 'Which giant landmark looks best in telephoto?',
    };
  } else if (archetype === 'agility-loop') {
    const tod = cycle % 2 === 0 ? '0.268' : '0.695';
    const style = cycle % 2 === 0 ? 'anime' : 'lowpoly';
    const titles = [
      '3 planes, 3 very different loops ✈️',
      'Comparing loop agility across 3 planes ✈️',
      'Biplane vs seaplane vs jet loop ✈️',
    ];
    spec = {
      id: `daily-${seed}`,
      archetype,
      banner: `Daily ${seed} [Single-Take 3-Plane Agility Loop (${style})]`,
      seed,
      durationSec: 12,
      speedMult: 1.0,
      camFrame: 'yaw',
      cam:
        `plane=biplane&livery=${liv(0)}&smoke=1&style=${style}&speed=1.0` +
        '&camOffset=235,20,24&camLook=0,14,-10&fov=62',
      pilotMoves: {
        stick: [
          [0.0, 0.0, 0.0, 1.0],
          [3.7, 0.0, 0.0, 1.2],
          [7.8, 0.0, 0.0, 2.1],
          [12.0, 0.0, 0.0, 2.1],
        ],
        stunts: [
          [0.2, 1.8, 'loop'],
          [3.85, 5.7, 'loop'],
          [7.95, 9.55, 'loop'],
        ],
      },
      prebuiltSegments: [
        {
          label: 'Biplane · Tight Loop',
          plane: 'biplane',
          livery: liv(0),
          x: 600,
          y: 620,
          z: 18600,
          heading: -135,
          planeSwaps: [
            [112, 'seaplane', liv(2)],
            [234, 'jet', liv(6)],
          ],
          badges: [
            [112, 'Seaplane · Cruise Loop'],
            [234, 'Swept-Wing Jet · High-G Loop'],
          ],
          extra: `tod=${tod}&weather=none&cloudMood=fair`,
          startFrame: 0,
          endFrame: 360,
        },
      ],
      slots: [],
      title: titles[cycle % titles.length],
      question: 'Which plane has the cleanest loop?',
    };
  } else {
    // 'sunset-chase': clean rear-quarter wormhole warp + aerobatic roll across 3 open vistas (no trip=1)
    const planes = ['biplane', 'jet', 'seaplane'];
    const plane = planes[cycle % planes.length];
    const speedMult = plane === 'jet' ? 1.54 : 1.24;
    const rollHold = plane === 'biplane' ? 1.95 : plane === 'jet' ? 2.25 : 2.55;
    const spotSets = [
      ['portal', 'pyramids', 'dragon', 'lighthouse'],
      ['portal', 'volcano', 'falls', 'xmas'],
      ['portal', 'canyon', 'pyramids', 'falls'],
    ];
    const spots = spotSets[cycle % spotSets.length];
    const extras = [
      'tod=0.35&weather=none&cloudMood=busy',
      'tod=0.68&weather=none&cloudMood=mackerel',
      'tod=0.43&weather=snow&cloudMood=high',
      'tod=0.725&headlight=1&weather=none&cloudMood=fair',
    ];
    const titles = [
      'Wormhole warp into 3 sunset biomes ✈️',
      'Alien portal jump and roll across 4 skies ✈️',
      'Through the wormhole into 3 landmarks ✈️',
    ];
    spec = {
      id: `daily-${seed}`,
      archetype,
      banner: `Daily ${seed} [Wormhole Jump & Sunset Chase (${plane})]`,
      seed,
      speedMult,
      camFrame: 'yaw',
      cam:
        `plane=${plane}&livery=${liv(4)}&smoke=1&speed=${speedMult}` +
        '&camOffset=28,11,60&camLook=-4,2,-64&fov=62',
      pilotMoves: {
        stick: [
          [0.0, 0.0, 0.0, speedMult],
          [1.6, 0.0, 0.0, speedMult],
          [2.6, -0.38, 0.1, speedMult],
          [3.15, 0.0, 0.02, speedMult],
          [6.4, 0.36, 0.05, speedMult],
          [9.4, -0.32, 0.04, speedMult],
          [11.4, 0.0, 0.0, speedMult],
          [12.0, 0.0, 0.0, speedMult],
        ],
        stunts: [
          [3.25, 3.25 + rollHold, 'roll-left'],
          [6.5, 8.2, 'climb'],
        ],
      },
      facing: 'rear',
      slots: spots.map((spot, i) => ({
        spot,
        altBoost: i === 0 ? 0 : 80,
        extra: extras[i],
        startFrame: i * 90,
        endFrame: (i + 1) * 90,
      })),
      title: titles[cycle % titles.length],
      question: 'Where does that alien portal lead?',
    };
  }

  // Resolve and auto-tune all 4 segments using the corridor checker.
  // If a procedural arch has obstructed approaches on this seed, cleanly fall back
  // to another unobstructed landmark so 100% of batch days pass `--check`.
  const fallbackOrder = [
    'sea-arch',
    'canyon',
    'pyramids',
    'volcano',
    'lighthouse',
    'falls',
  ];
  const clipDraft = {
    ...spec,
    segments: [],
  };
  const usedSpots = new Set(spec.slots.map((s) => s.spot));
  const segments =
    spec.prebuiltSegments ||
    spec.slots.map((slot) => {
      const primary = chooseSafeSegment(
        clipDraft,
        spotCandidates(scout, slot.spot, slot, spec.facing),
        planSegment
      );
      if (primary) return primary;
      for (const fb of fallbackOrder) {
        if (usedSpots.has(fb)) continue;
        const alt = chooseSafeSegment(
          clipDraft,
          spotCandidates(scout, fb, {...slot, spot: fb}, spec.facing),
          planSegment
        );
        if (alt) {
          usedSpots.add(fb);
          return alt;
        }
      }
      // Last resort: safe high pass over Twin Falls
      return spotCandidates(
        scout,
        'falls',
        {...slot, altBoost: (slot.altBoost ?? 0) + 120},
        spec.facing
      )[1];
    });

  const stops = segments.map((seg, i) => {
    const tLabel = `0:0${i * 3}`;
    const [name, coords] = seg.label.split(' · ');
    return `${tLabel} ${name} (${coords})`;
  });

  return {
    id: spec.id,
    archetype: spec.archetype,
    banner: spec.banner,
    seed,
    ...(spec.durationSec ? {durationSec: spec.durationSec} : {}),
    speedMult: spec.speedMult,
    direct: spec.direct,
    loopDip: spec.loopDip,
    camFrame: spec.camFrame,
    cam: spec.cam,
    camMoves: spec.camMoves,
    wingmen: spec.wingmen,
    moves: spec.moves,
    pilotMoves: spec.pilotMoves,
    segments,
    outBaseName: `short-${seed}-${spec.archetype}`,
    trackSlug: track.slug,
    musicStart: 18,
    meta: {
      title: spec.title,
      tiktokQuestion: spec.question,
      stops,
      trackTitle: track.title,
    },
  };
}
