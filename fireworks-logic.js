// --- FIREWORKS LOGIC ---
// Pure, deterministic helpers for night fireworks shows: holiday & URL mode
// resolution, clear-night gating, settlement/pier launch-site scoring, exact
// drag+gravity mortar ballistics, show choreography (opening volleys + grand
// finale), and allocation-free star-burst generators.

const TAU = Math.PI * 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export const FIREWORK_MODES = {
  OFF: 'off',
  RARE: 'rare',
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

// Curated night-sky firework pigments (linear-friendly vivid RGBs paired with
// complementary inner-pistil / ring accents).
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
    : FIREWORK_MODES.RARE;
}

// Night sky (stars coming out once sunY < -0.15) and dry/clear conditions.
// When forced via `?fireworks=1`, allows dusk (`sunY < -0.08`) and light rain.
export function canRunFireworks({mode, sunY, rain = 0, snow = 0}) {
  if (!mode || mode === FIREWORK_MODES.OFF) return false;
  if (mode === FIREWORK_MODES.FORCED) {
    return sunY < -0.08;
  }
  return sunY < -0.15 && rain < 0.08 && snow < 0.12;
}

export function nextFireworksWait(mode, first = false, rng = Math.random) {
  if (mode === FIREWORK_MODES.FORCED) {
    return first ? 1.6 + rng() * 1.4 : 7 + rng() * 7;
  }
  if (mode === FIREWORK_MODES.HOLIDAY) {
    return first ? 8 + rng() * 10 : 32 + rng() * 34;
  }
  return first ? 45 + rng() * 50 : 145 + rng() * 115;
}

// Scores loaded town, village, and coastal pier sites around the viewer so the
// show launches ahead of the nose within comfortable viewing range.
export function pickFireworkSite(sites, viewer, rng = Math.random) {
  if (!sites || sites.length === 0 || !viewer) return null;
  const vx = viewer.x || 0;
  const vz = viewer.z || 0;
  const fLen = Math.hypot(viewer.fx || 0, viewer.fz || 0);
  const fx = fLen > 1e-4 ? viewer.fx / fLen : 0;
  const fz = fLen > 1e-4 ? viewer.fz / fLen : -1;

  let best = null;
  let bestScore = -Infinity;

  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    const dx = s.x - vx;
    const dz = s.z - vz;
    const dist = Math.hypot(dx, dz);
    if (dist < 260 || dist > 4000) continue;

    const align = (dx * fx + dz * fz) / dist;
    // Skip sites well behind the tail unless very few exist
    if (align < -0.25) continue;

    // Peak distance score between 750 and 2200 units ahead
    const distScore =
      dist < 750
        ? 0.55 + 0.45 * ((dist - 260) / 490)
        : 1.0 - 0.65 * Math.min(1, (dist - 1500) / 2500);
    const forwardScore = 0.4 + 0.9 * Math.max(0, align);
    const kindWeight =
      s.kind === 'town' ? 1.28 : s.kind === 'pier' ? 1.22 : 1.0;
    const jitter = 0.86 + 0.28 * rng();
    const score = distScore * forwardScore * kindWeight * jitter;

    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

// Exact analytical launch velocity `v0` so a shell under exponential air drag
// `v' = -drag * v` and vertical `-gravity` reaches `target` at `t = dur`:
// `p(t) = pad + v0 * ((1 - exp(-drag * t)) / drag) - (0, 0.5 * g * t^2, 0)`.
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

// Plans a complete multi-shell show (26-42 s) with single bursts, synchronized
// doublets, and a rapid multi-shell grand finale.
export function planFireworkShow(site, mode, rng = Math.random) {
  const rand = (a, b) => a + (b - a) * rng();
  const festive =
    mode === FIREWORK_MODES.HOLIDAY || mode === FIREWORK_MODES.FORCED;
  const duration = festive ? rand(32, 42) : rand(26, 36);
  const finaleStart = duration - 5.2;
  const baseY = site.y;

  const shells = [];
  const addShell = (launchAt, opts = {}) => {
    const shellType =
      opts.type || SHELL_TYPES[Math.floor(rng() * SHELL_TYPES.length)];
    const pal =
      opts.palette ||
      FIREWORK_PALETTES[Math.floor(rng() * FIREWORK_PALETTES.length)];
    const padAngle = rng() * TAU;
    const padDist = rand(0, 22);
    const padX = site.x + Math.cos(padAngle) * padDist;
    const padY = baseY + 2.5;
    const padZ = site.z + Math.sin(padAngle) * padDist;

    const spread = opts.spread ?? 88;
    const burstX = site.x + rand(-spread, spread);
    const burstZ = site.z + rand(-spread, spread);
    const burstY = baseY + (opts.height ?? rand(220, 410));
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
      scale: opts.scale ?? rand(0.92, 1.18),
      launchAt,
      flightDur,
      burstAt: launchAt + flightDur,
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

  // 1. Opening and mid-show volleys
  let t = 0.25;
  while (t < finaleStart - 1.2) {
    if (rng() < 0.28) {
      // Synchronized twin doublet flanking left and right
      const sharedPal =
        FIREWORK_PALETTES[Math.floor(rng() * FIREWORK_PALETTES.length)];
      const sharedType = SHELL_TYPES[Math.floor(rng() * SHELL_TYPES.length)];
      const h = rand(240, 390);
      addShell(t, {type: sharedType, palette: sharedPal, height: h});
      addShell(t + rand(0.08, 0.22), {
        type: sharedType,
        palette: sharedPal,
        height: h + rand(-24, 24),
      });
      t += rand(2.1, 3.1);
    } else {
      addShell(t);
      t += rand(1.45, 2.55);
    }
  }

  // 2. Grand finale crescendo (6..8 rapid overlapping shells + twin crown)
  const finaleCount = festive ? 7 : 6;
  let ft = finaleStart;
  for (let i = 0; i < finaleCount; i++) {
    const u = i / Math.max(1, finaleCount - 1);
    addShell(ft, {
      height: 225 + u * 215 + rand(-18, 18),
      spread: 170,
      scale: 1.05 + u * 0.28,
      finale: true,
    });
    ft += rand(0.22, 0.4);
  }
  // Twin high golden willow + sakura-cyan chrysanthemum crown at peak
  addShell(ft + 0.22, {
    type: 'willow',
    palette: FIREWORK_PALETTES[0],
    height: 440,
    spread: 90,
    scale: 1.4,
    finale: true,
  });
  addShell(ft + 0.35, {
    type: 'chrysanthemum',
    palette: FIREWORK_PALETTES[1],
    height: 415,
    spread: 90,
    scale: 1.34,
    finale: true,
  });

  shells.sort((a, b) => a.launchAt - b.launchAt);
  const firstBurstAt = shells.length > 0 ? shells[0].burstAt : 1.5;
  const lastBurstAt =
    shells.length > 0 ? shells[shells.length - 1].burstAt : duration;

  return {
    site,
    mode,
    duration: Math.max(duration, lastBurstAt + 4.8),
    finaleStart,
    firstBurstAt,
    lastBurstAt,
    canopyY: baseY + 320,
    shells,
  };
}

// Samples a uniform random unit direction on the sphere.
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
export function emitLaunchSparks(shell, now, rng, emit) {
  const dur = shell.flightDur;
  // Ascending bright comet head
  emit(
    shell.padX,
    shell.padY,
    shell.padZ,
    shell.vx,
    shell.vy,
    shell.vz,
    COMET_DRAG,
    now,
    dur,
    COMET_GRAVITY,
    4.6,
    1.0,
    0.88,
    0.52,
    2.4
  );

  // Pre-scheduled trail embers peeling off behind the rising mortar
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
      now + tk,
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
// `style` > 0 encodes velocity-tail stretch; negative `style` enables crisp
// late-life strobe/glitter crackle at `|style|` tail stretch.
export function emitBurstSparks(shell, now, rng, emit) {
  const bx = shell.burstX;
  const by = shell.burstY;
  const bz = shell.burstZ;
  const sc = shell.scale || 1;
  const [r1, g1, b1] = shell.palette.primary;
  const [r2, g2, b2] = shell.palette.secondary;

  // Brief central flash puff at the break point
  emit(bx, by, bz, 0, 0, 0, 2.0, now, 0.26, 0, 26 * sc, 1.0, 0.96, 0.86, 0.2);

  if (shell.type === 'willow') {
    // Weeping golden/champagne crown: low drag, long hang time, graceful droop
    const count = 152;
    for (let i = 0; i < count; i++) {
      randomSphereDir(rng, _dir);
      const spd = (64 + rng() * 26) * sc;
      const useSec = i % 5 === 0;
      const cr = useSec ? r2 : r1;
      const cg = useSec ? g2 : g1;
      const cb = useSec ? b2 : b1;
      emit(
        bx,
        by,
        bz,
        _dir.x * spd,
        _dir.y * spd + 12,
        _dir.z * spd,
        0.56,
        now,
        3.6 + rng() * 1.1,
        28.0,
        3.6 * sc,
        cr,
        cg,
        cb,
        -2.2
      );
    }
    return;
  }

  if (shell.type === 'ring') {
    // Tilted celestial Saturn ring + contrasting inner jewel sphere
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
      // Rotate ring from XZ plane by tiltZ then tiltX
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
        now,
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
        now,
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
    // Sweeping palm fronds + delayed sparkling strobe crackle cloud
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
          now,
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
        now + 0.12 + rng() * 0.18,
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

  // 'peony' and 'chrysanthemum'
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
      now,
      lifeBase + rng() * 0.65,
      18.0,
      3.6 * sc,
      r1,
      g1,
      b1,
      streak
    );
  }

  // Inner complementary pistil
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
      now,
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
  if (dx * dx + dz * dz > 320 * 320) return false;
  return py >= show.site.y - 15 && py <= show.site.y + 580;
}
