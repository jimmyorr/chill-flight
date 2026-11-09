// Named camera views shared by the screenshot and audit scripts, so a
// before/after shot and a perf measurement can use the same spot by name:
//   node scripts/shot.js out.jpg forest swamp
//   VIEWS=land,swamp node scripts/audit-render.js
// Each is a set of the game's URL parameters (see README). With freecam the
// plane is placed there too, so full-detail terrain loads around the view.

// Pinned so numbers and shots compare across days (the seed defaults to the
// date). Pass seed= in a query to use another world.
export const AUDIT_SEED = 20260928;

export const VIEWS = {
  land: 'x=0&y=413&z=0&heading=45&pitch=-4&tod=0.614&clouds=0.2',
  landHigh: 'x=0&y=2500&z=0&heading=45&pitch=-15&tod=0.614&clouds=0.2',
  forest: 'x=-3000&y=330&z=-6000&heading=160&pitch=-8&tod=0.45&clouds=0.3',
  forestHigh:
    'x=-3000&y=2500&z=-6000&heading=160&pitch=-15&tod=0.45&clouds=0.3',
  mtn: 'x=-2000&y=600&z=-2500&heading=20&pitch=-3&tod=0.5&clouds=0.3',
  sunset: 'x=30000&y=420&z=3000&heading=-90&pitch=-3&tod=0.735&clouds=0.45',
  swamp: 'x=-9000&y=250&z=8000&heading=0&pitch=-6&tod=0.5&clouds=0.2',
  swampLow: 'x=-9000&y=60&z=8000&heading=90&pitch=-3&tod=0.5&clouds=0.2',
  down: 'x=-3000&y=1200&z=-6000&heading=160&pitch=-89&tod=0.45&clouds=0.3',
};

// A view name, or a query used as is
export function viewQuery(nameOrQuery) {
  return VIEWS[nameOrQuery] ?? nameOrQuery;
}

// The query an audit opens: frozen time, no weather, the pinned seed, the
// preset, the view, then any extra parameters (later ones win).
export function auditQuery(view, {preset = 'mid', extra = ''} = {}) {
  const q = new URLSearchParams(
    `freecam=true&seed=${AUDIT_SEED}&timeSpeed=0&weather=none&preset=${preset}`
  );
  for (const part of [viewQuery(view), extra]) {
    for (const [k, v] of new URLSearchParams(part)) q.set(k, v);
  }
  return q.toString();
}
