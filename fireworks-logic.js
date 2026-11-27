// --- FIREWORKS LOGIC ---
// Pure, deterministic world-scheduled night fireworks logic:
// - Curated roster of ~8 deterministic towns, harbors, and overlooks per seed
// - Fair nightly shuffle-bag schedule keyed to `(WORLD_SEED, nightIndex)` on
//   the shared world clock (1 guaranteed venue every night, all venues on
//   Dec 31 / Jan 1 / Jul 4 or `?fireworks=1`, zero back-to-back repeats)
// - Noon-anchored night clock so midnight sits seamlessly mid-show
// - Exact drag+gravity mortar ballistics and allocation-free star generators

const TAU = Math.PI * 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mixHash(a, b = 0, c = 0) {
  let h = (a | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (b | 0), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ (c | 0), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export const DAY_CYCLE_MS = 360000; // 6-minute full day-night cycle (0 ms = midnight)
export const NOON_OFFSET_MS = 180000; // Anchor nightIndex boundaries at High Noon
export const SHOW_START_SEC = -48; // ~20:35 in-game once evening stars come out
export const SHOW_DURATION_SEC = 82; // ~82 s festival ending in a ~01:15 grand finale

export const FIREWORK_MODES = {
  OFF: 'off',
  SCHEDULED: 'scheduled',
  HOLIDAY: 'holiday',
  FORCED: 'forced',
};

export const SHELL_TYPES = [
  'peony',
  'chrysanthemum',
  'willow',
  'ring',
  'crackle',
];

// Curated night-sky firework pigments (vivid RGBs paired with inner/ring accents)
export const FIREWORK_PALETTES = [
  {
    name: 'gold_champagne',
    primary: [1.0, 0.78, 0.32],
    secondary: [1.0, 0.94, 0.78],
  },
  {
    name: 'sakura_cyan',
    primary: [1.0, 0.34, 0.68],
    secondary: [0.28, 0.92, 1.0],
  },
  {
    name: 'ruby_gold',
    primary: [1.0, 0.24, 0.28],
    secondary: [1.0, 0.82, 0.36],
  },
  {
    name: 'emerald_silver',
    primary: [0.26, 0.98, 0.56],
    secondary: [0.92, 0.96, 1.0],
  },
  {
    name: 'sapphire_peach',
    primary: [0.36, 0.62, 1.0],
    secondary: [1.0, 0.68, 0.42],
  },
  {
    name: 'violet_gold',
    primary: [0.76, 0.42, 1.0],
    secondary: [1.0, 0.86, 0.44],
  },
];

// Checks whether a YYYYMMDD world seed lands on New Year's Eve (Dec 31),
// New Year's Day (Jan 1), or Independence Day (Jul 4).
export function isFireworksHoliday(seed) {
  if (!Number.isInteger(seed) || seed < 10000101 || seed > 99991231) {
    return false;
  }
  const mmdd = seed % 10000;
  return mmdd === 1231 || mmdd === 101 || mmdd === 704;
}

export function resolveFireworksMode(
  seed,
  fireworksParam = null,
  trafficParam = null
) {
  if (fireworksParam === false) return FIREWORK_MODES.OFF;
  if (fireworksParam === true) return FIREWORK_MODES.FORCED;
  if (trafficParam === false) return FIREWORK_MODES.OFF;
  return isFireworksHoliday(seed)
    ? FIREWORK_MODES.HOLIDAY
    : FIREWORK_MODES.SCHEDULED;
}

// Night sky (stars out once sunY < -0.15) and clear-enough skies (no heavy storm;
// gentle winter snow in the north still allows Christmas village shows).
export function canRunFireworks({mode, sunY, rain = 0, snow = 0}) {
  if (!mode || mode === FIREWORK_MODES.OFF) return false;
  if (mode === FIREWORK_MODES.FORCED) {
    return sunY < -0.08;
  }
  return sunY < -0.15 && rain < 0.16 && snow < 0.72;
}

// Computes an unbroken `nightIndex` (flipping at High Noon, never at midnight)
// and continuous seconds relative to midnight (`-180 .. +180`, `0` = midnight).
export function nightClockState(worldClockNow) {
  const shifted = (worldClockNow || 0) + NOON_OFFSET_MS;
  const nightIndex = Math.floor(shifted / DAY_CYCLE_MS);
  const secFromNoon =
    (((shifted % DAY_CYCLE_MS) + DAY_CYCLE_MS) % DAY_CYCLE_MS) / 1000;
  const secFromMidnight = secFromNoon - 180;
  const showAge = secFromMidnight - SHOW_START_SEC;
  return {
    nightIndex,
    secFromMidnight,
    showAge,
    inWindow: showAge >= 0 && showAge <= SHOW_DURATION_SEC,
  };
}

// Builds the deterministic roster of ~8 iconic firework venues across the map:
// the 3 populated heartland/west highway-crossing market towns (`n = 0..2`),
// Montauk Lighthouse harbor, Lagoon Bay, Great Falls plunge tarn, Christmas
// Village / Pinewood valley in the north, and Mesa overlook in the south.
export function buildFireworkVenues(seed, helpers = {}) {
  const waterLevel = helpers.waterLevel ?? 40;
  const getElev = helpers.getElev || (() => waterLevel + 12);
  const venues = [];

  const pushVenue = (id, name, x, z, kind) => {
    const rx = Math.round(x);
    const rz = Math.round(z);
    const y = Math.max(waterLevel + 1, getElev(rx, rz));
    let idHash = 2166136261;
    for (let i = 0; i < id.length; i++) {
      idHash = Math.imul(idHash ^ id.charCodeAt(i), 16777619) >>> 0;
    }
    venues.push({id, idHash, name, x: rx, y, z: rz, kind});
  };

  // 1-3. Heartland & western highway-crossing market towns (`n = 0, 1, 2`)
  const townNames = ['Crossroads', 'Millbrook', 'Oakridge'];
  for (let n = 0; n <= 2; n++) {
    const c = helpers.highwayCrossing
      ? helpers.highwayCrossing(n)
      : {x: -5000 - n * 10000, z: 1200};
    const runs = helpers.townExists ? helpers.townExists(n, c) : true;
    if (runs) {
      pushVenue(`town_${n}`, townNames[n], c.x, c.z, 'town');
    }
  }

  // 4. Montauk Lighthouse harbor (East Coast headland bay)
  pushVenue('montauk', 'Montauk harbor', 7350, 3150, 'harbor');

  // 5. Lagoon Bay (636 units broadside off Lagoon Field's runway over the bay)
  pushVenue('lagoon', 'Lagoon bay', 5450, 4350, 'harbor');

  // 6. Great Falls plunge tarn (northern lake below the waterfall)
  const fallsX = (helpers.fallsX ?? 0) + 45;
  const fallsZ = (helpers.fallsLipZ ?? -2750) + 380;
  pushVenue('falls', 'Great Falls tarn', fallsX, fallsZ, 'harbor');

  // 7. Northern settlement: Christmas Village in season, or Pinewood valley
  if (helpers.xmasSite) {
    pushVenue(
      'north',
      'Christmas village',
      helpers.xmasSite.x,
      helpers.xmasSite.z,
      'town'
    );
  } else {
    pushVenue('north', 'Pinewood valley', -3250, -17200, 'town');
  }

  // 8. Southern red-rock desert: Mesa overlook (broadside clear of Mesa runway)
  pushVenue('mesa', 'Mesa overlook', -4250, 15650, 'town');

  return venues;
}

function shuffledIndices(count, seedKey) {
  const arr = Array.from({length: count}, (_, i) => i);
  const rng = mulberry32(seedKey);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

// Picks tonight's active firework venue(s) deterministically from `(seed, nightIndex)`:
// - SCHEDULED: 1 guaranteed venue every night via seeded N-night permutation
//   (every venue gets a turn once per N nights, never repeating across epoch seams)
// - HOLIDAY / FORCED: every venue in the world puts on a staggered show!
export function scheduledVenuesForNight(venues, seed, nightIndex, mode) {
  if (!venues || venues.length === 0 || mode === FIREWORK_MODES.OFF) return [];
  const n = venues.length;
  if (mode === FIREWORK_MODES.HOLIDAY || mode === FIREWORK_MODES.FORCED) {
    return venues.map((venue, idx) => ({
      venue,
      timeOffset: ((idx * 1.7) % 6.0) - 2.0,
    }));
  }
  if (n === 1) return [{venue: venues[0], timeOffset: 0}];

  const epoch = Math.floor(nightIndex / n);
  const slot = ((nightIndex % n) + n) % n;
  const perm = shuffledIndices(n, mixHash(seed, epoch, 0x517cc1b7));
  const prevPerm = shuffledIndices(n, mixHash(seed, epoch - 1, 0x517cc1b7));
  if (perm[0] === prevPerm[n - 1]) {
    const tmp = perm[0];
    perm[0] = perm[1];
    perm[1] = tmp;
  }
  return [{venue: venues[perm[slot]], timeOffset: 0}];
}

// Exact analytical launch velocity `v0` so a shell under exponential air drag
// `v' = -drag * v` and vertical `-gravity` reaches `target` at `t = dur`.
export function solveLaunchVelocity(pad, target, dur, drag, gravity) {
  const c = (1 - Math.exp(-drag * dur)) / drag;
  return {
    vx: (target.x - pad.x) / c,
    vy: (target.y - pad.y + 0.5 * gravity * dur * dur) / c,
    vz: (target.z - pad.z) / c,
  };
}

export const COMET_DRAG = 0.42;
export const COMET_GRAVITY = 22.0;

// Plans a complete ~82-second 4-act show seeded deterministically from
// `(seed, nightIndex, site.idHash)` so all multiplayer peers share the exact
// same shell-by-shell choreography.
export function planFireworkShow(
  site,
  mode,
  seed = 20261121,
  nightIndex = 0,
  timeOffset = 0
) {
  const rng = mulberry32(mixHash(seed, nightIndex, site.idHash || 1));
  const rand = (a, b) => a + (b - a) * rng();
  const finaleStart = 70.5;
  const baseY = site.y;

  const shells = [];
  const addShell = (launchAt, opts = {}) => {
    const effLaunch = Math.max(0.15, launchAt + timeOffset);
    const shellType =
      opts.type || SHELL_TYPES[Math.floor(rng() * SHELL_TYPES.length)];
    const pal =
      opts.palette ||
      FIREWORK_PALETTES[Math.floor(rng() * FIREWORK_PALETTES.length)];
    const padAngle = rng() * TAU;
    const padDist = rand(0, 26);
    const padX = site.x + Math.cos(padAngle) * padDist;
    const padY = baseY + 2.5;
    const padZ = site.z + Math.sin(padAngle) * padDist;

    const spread = opts.spread ?? 95;
    const burstX = site.x + rand(-spread, spread);
    const burstZ = site.z + rand(-spread, spread);
    const burstY = baseY + (opts.height ?? rand(235, 425));
    const flightDur = clamp(
      1.15 + ((burstY - padY) / 420) * 0.48 + rand(-0.08, 0.08),
      1.05,
      1.75
    );
    const v0 = solveLaunchVelocity(
      {x: padX, y: padY, z: padZ},
      {x: burstX, y: burstY, z: burstZ},
      flightDur,
      COMET_DRAG,
      COMET_GRAVITY
    );

    shells.push({
      type: shellType,
      palette: pal,
      scale: opts.scale ?? rand(0.95, 1.22),
      launchAt: effLaunch,
      flightDur,
      burstAt: effLaunch + flightDur,
      padX,
      padY,
      padZ,
      vx: v0.vx,
      vy: v0.vy,
      vz: v0.vz,
      burstX,
      burstY,
      burstZ,
      crackle:
        shellType === 'crackle' ||
        shellType === 'willow' ||
        Boolean(opts.finale),
      launched: false,
      burst: false,
    });
  };

  // Act 1 (0..24s): unhurried opening mortars
  let t = 0.35;
  while (t < 24.0) {
    addShell(t, {height: rand(225, 370)});
    t += rand(2.3, 3.4);
  }

  // Act 2 (24..53s): main feature with single shells, twin doublets & 3-shell fans
  while (t < 53.0) {
    const roll = rng();
    if (roll < 0.28) {
      const pal =
        FIREWORK_PALETTES[Math.floor(rng() * FIREWORK_PALETTES.length)];
      const type = SHELL_TYPES[Math.floor(rng() * SHELL_TYPES.length)];
      const h = rand(250, 410);
      addShell(t, {type, palette: pal, height: h, spread: 125});
      addShell(t + rand(0.1, 0.24), {
        type,
        palette: pal,
        height: h + rand(-22, 22),
        spread: 125,
      });
      t += rand(2.4, 3.4);
    } else if (roll < 0.4) {
      const pal =
        FIREWORK_PALETTES[Math.floor(rng() * FIREWORK_PALETTES.length)];
      for (let k = 0; k < 3; k++) {
        addShell(t + k * 0.18, {
          palette: pal,
          height: 265 + k * 42,
          spread: 145,
        });
      }
      t += rand(2.9, 3.8);
    } else {
      addShell(t);
      t += rand(1.75, 2.75);
    }
  }

  // Act 3 (53..70s): pre-finale build with higher breaks and faster cadence
  while (t < finaleStart - 1.1) {
    addShell(t, {height: rand(275, 435), scale: rand(1.05, 1.26), spread: 120});
    t += rand(1.3, 2.05);
  }

  // Act 4 (70.5..76s): grand finale crescendo salvo + twin high willow/chrysanthemum crown
  const finaleCount = 8;
  let ft = finaleStart;
  for (let i = 0; i < finaleCount; i++) {
    const u = i / (finaleCount - 1);
    addShell(ft, {
      height: 235 + u * 215 + rand(-18, 18),
      spread: 175,
      scale: 1.08 + u * 0.28,
      finale: true,
    });
    ft += rand(0.22, 0.38);
  }
  addShell(ft + 0.22, {
    type: 'willow',
    palette: FIREWORK_PALETTES[0],
    height: 450,
    spread: 90,
    scale: 1.42,
    finale: true,
  });
  addShell(ft + 0.35, {
    type: 'chrysanthemum',
    palette: FIREWORK_PALETTES[1],
    height: 420,
    spread: 90,
    scale: 1.36,
    finale: true,
  });

  shells.sort((a, b) => a.launchAt - b.launchAt);
  const firstBurstAt = shells.length > 0 ? shells[0].burstAt : 1.5;
  const lastBurstAt =
    shells.length > 0 ? shells[shells.length - 1].burstAt : finaleStart + 4;

  return {
    site,
    mode,
    nightIndex,
    duration: Math.max(SHOW_DURATION_SEC, lastBurstAt + 4.8),
    finaleStart: finaleStart + timeOffset,
    firstBurstAt,
    lastBurstAt,
    canopyY: baseY + 325,
    shells,
  };
}

function randomSphereDir(rng, out) {
  const z = rng() * 2 - 1;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  const a = rng() * TAU;
  out.x = r * Math.cos(a);
  out.y = z;
  out.z = r * Math.sin(a);
}

const _dir = {x: 0, y: 1, z: 0};

// Emits rising comet core + pre-scheduled golden ember trail sparks along the
// climb trajectory so the GPU animates a curved spark tail with zero per-frame CPU.
export function emitLaunchSparks(shell, launchTime, rng, emit) {
  const dur = shell.flightDur;
  emit(
    shell.padX,
    shell.padY,
    shell.padZ,
    shell.vx,
    shell.vy,
    shell.vz,
    COMET_DRAG,
    launchTime,
    dur,
    COMET_GRAVITY,
    4.8,
    1.0,
    0.88,
    0.52,
    2.4
  );

  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    const tk = (i / (steps + 1)) * dur;
    const c = (1 - Math.exp(-COMET_DRAG * tk)) / COMET_DRAG;
    const px = shell.padX + shell.vx * c + (rng() - 0.5) * 1.2;
    const py = shell.padY + shell.vy * c - 0.5 * COMET_GRAVITY * tk * tk;
    const pz = shell.padZ + shell.vz * c + (rng() - 0.5) * 1.2;
    emit(
      px,
      py,
      pz,
      (rng() - 0.5) * 8,
      -6 - rng() * 8,
      (rng() - 0.5) * 8,
      1.8,
      launchTime + tk,
      0.42 + rng() * 0.24,
      16.0,
      2.6,
      1.0,
      0.74,
      0.32,
      1.1
    );
  }
}

// Emits 115-175 burst stars for a detonating aerial shell.
export function emitBurstSparks(shell, burstTime, rng, emit) {
  const bx = shell.burstX;
  const by = shell.burstY;
  const bz = shell.burstZ;
  const sc = shell.scale || 1;
  const [r1, g1, b1] = shell.palette.primary;
  const [r2, g2, b2] = shell.palette.secondary;

  emit(
    bx,
    by,
    bz,
    0,
    0,
    0,
    2.0,
    burstTime,
    0.26,
    0,
    26 * sc,
    1.0,
    0.96,
    0.86,
    0.2
  );

  if (shell.type === 'willow') {
    const count = 152;
    for (let i = 0; i < count; i++) {
      randomSphereDir(rng, _dir);
      const spd = (64 + rng() * 26) * sc;
      const useSec = i % 5 === 0;
      emit(
        bx,
        by,
        bz,
        _dir.x * spd,
        _dir.y * spd + 12,
        _dir.z * spd,
        0.56,
        burstTime,
        3.6 + rng() * 1.1,
        28.0,
        3.6 * sc,
        useSec ? r2 : r1,
        useSec ? g2 : g1,
        useSec ? b2 : b1,
        -2.2
      );
    }
    return;
  }

  if (shell.type === 'ring') {
    const tiltX = (rng() - 0.5) * 1.3;
    const tiltZ = (rng() - 0.5) * 1.3;
    const cx = Math.cos(tiltX);
    const sx = Math.sin(tiltX);
    const cz = Math.cos(tiltZ);
    const sz = Math.sin(tiltZ);
    const ringCount = 72;
    for (let i = 0; i < ringCount; i++) {
      const a = (i / ringCount) * TAU + (rng() - 0.5) * 0.03;
      const lx = Math.cos(a);
      const lz = Math.sin(a);
      const x1 = lx * cz;
      const y1 = lx * sz;
      const z1 = lz;
      const dx = x1;
      const dy = y1 * cx - z1 * sx;
      const dz = y1 * sx + z1 * cx;
      const spd = (86 + (rng() - 0.5) * 4) * sc;
      emit(
        bx,
        by,
        bz,
        dx * spd,
        dy * spd,
        dz * spd,
        1.02,
        burstTime,
        2.4 + rng() * 0.4,
        14.0,
        3.8 * sc,
        r1,
        g1,
        b1,
        1.35
      );
    }
    const coreCount = 56;
    for (let i = 0; i < coreCount; i++) {
      randomSphereDir(rng, _dir);
      const spd = (42 + rng() * 14) * sc;
      emit(
        bx,
        by,
        bz,
        _dir.x * spd,
        _dir.y * spd,
        _dir.z * spd,
        1.15,
        burstTime,
        2.0 + rng() * 0.4,
        15.0,
        3.2 * sc,
        r2,
        g2,
        b2,
        1.2
      );
    }
    return;
  }

  if (shell.type === 'crackle') {
    const fronds = 8;
    const perFrond = 13;
    for (let f = 0; f < fronds; f++) {
      randomSphereDir(rng, _dir);
      _dir.y = Math.abs(_dir.y) * 0.65 + 0.2;
      const len = Math.hypot(_dir.x, _dir.y, _dir.z) || 1;
      const dx = _dir.x / len;
      const dy = _dir.y / len;
      const dz = _dir.z / len;
      for (let k = 0; k < perFrond; k++) {
        const u = (k + 1) / perFrond;
        const spd = (34 + u * 68) * sc;
        emit(
          bx,
          by,
          bz,
          dx * spd + (rng() - 0.5) * 6,
          dy * spd + (rng() - 0.5) * 6,
          dz * spd + (rng() - 0.5) * 6,
          0.88,
          burstTime,
          2.2 + u * 0.7,
          22.0,
          (2.8 + u * 1.4) * sc,
          r1,
          g1,
          b1,
          2.1
        );
      }
    }
    const crackles = 56;
    for (let i = 0; i < crackles; i++) {
      randomSphereDir(rng, _dir);
      const spd = (55 + rng() * 38) * sc;
      emit(
        bx,
        by,
        bz,
        _dir.x * spd,
        _dir.y * spd,
        _dir.z * spd,
        1.18,
        burstTime + 0.12 + rng() * 0.18,
        2.1 + rng() * 0.6,
        16.0,
        3.5 * sc,
        r2,
        g2,
        b2,
        -1.6
      );
    }
    return;
  }

  const isChrys = shell.type === 'chrysanthemum';
  const outerCount = isChrys ? 142 : 116;
  const drag = isChrys ? 0.82 : 1.08;
  const lifeBase = isChrys ? 2.8 : 2.25;
  const streak = isChrys ? 2.25 : 1.4;

  for (let i = 0; i < outerCount; i++) {
    randomSphereDir(rng, _dir);
    const spd = (78 + rng() * 24) * sc;
    emit(
      bx,
      by,
      bz,
      _dir.x * spd,
      _dir.y * spd + 4,
      _dir.z * spd,
      drag,
      burstTime,
      lifeBase + rng() * 0.65,
      18.0,
      3.6 * sc,
      r1,
      g1,
      b1,
      streak
    );
  }

  const pistilCount = 38;
  for (let i = 0; i < pistilCount; i++) {
    randomSphereDir(rng, _dir);
    const spd = (36 + rng() * 14) * sc;
    emit(
      bx,
      by,
      bz,
      _dir.x * spd,
      _dir.y * spd,
      _dir.z * spd,
      1.18,
      burstTime,
      1.75 + rng() * 0.45,
      15.0,
      3.1 * sc,
      r2,
      g2,
      b2,
      1.25
    );
  }
}

// Checks whether the player's vehicle is flying or driving right inside an
// active fireworks display (unlocks the 'grand_finale' achievement).
export function isInsideFireworkShow(show, showAge, px, py, pz) {
  if (!show) return false;
  if (showAge < show.firstBurstAt || showAge > show.lastBurstAt + 3.0) {
    return false;
  }
  const dx = px - show.site.x;
  const dz = pz - show.site.z;
  if (dx * dx + dz * dz > 340 * 340) return false;
  return py >= show.site.y - 15 && py <= show.site.y + 600;
}
