// --- LATE-BOUND HOOKS ---
// Lets a module call into one that loads after it, without an import cycle.
// The later module assigns its implementation here when it loads; callers
// check for it before use, e.g. `hooks.fullscreenMap?.isOpen()`.
export const hooks = {
  togglePause: null, // game-state.js
  openVRPauseMenu: null, // vr-manager.js
  closeVRPauseMenu: null, // vr-manager.js
  resetSteering: null, // game-ui.js
  onTrackChange: null, // game-audio-integration.js: (trackName) => void
  fullscreenMap: null, // minimap.js: {open, close, toggle, isOpen, syncUrlParams}
  minimap: null, // minimap.js: {toggle, isVisible}
  clearFarTerrain: null, // far-terrain.js: drops the distant terrain ring
};
