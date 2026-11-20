// --- LATE-BOUND HOOKS ---
// Lets a module call into one that loads after it, without an import cycle.
// The later module assigns its implementation here when it loads; callers
// check for it before use, e.g. `hooks.fullscreenMap?.isOpen()`.
export const hooks = {
  togglePause: null, // game-state.js
  enterVR: null, // vr-manager.js
  openVRPauseMenu: null, // vr-manager.js
  closeVRPauseMenu: null, // vr-manager.js
  pollVRVirtualControls: null, // vr-manager.js: (delta, controllers) => object
  resetSteering: null, // game-ui.js
  resetManeuvers: null, // game-loop.js: clears barrel roll, rollExit, loop, and Immelmann state
  onTrackChange: null, // game-audio-integration.js: (trackName) => void
  onAudioUnlocked: null, // sfx.js: called when media autoplay succeeds on load
  fullscreenMap: null, // minimap.js: {open, close, toggle, isOpen, syncUrlParams}
  vrMap: null, // minimap.js: in-VR 3D world map controller
  minimap: null, // minimap.js: {toggle, isVisible}
  clearFarTerrain: null, // far-terrain.js: drops the distant terrain ring
  onResume: null, // zen.js: called when flight starts or the game unpauses
  onJobProgress: null, // people-screen.js: called by jobs.js when progress changes
  movePlane: null, // minimap.js: (x, y, z, yaw?, speed?) moves the plane there
  parkBuggy: null, // buggy.js: sets the buggy down where it is, stopped
  syncSmokeUI: null, // game-ui.js: updates the smoke button when forced on/off
  inGameMode: null, // multiplayer.js: () => whether tag or a race is on
  toggleAutopilot: null, // game-ui.js: (on?) => void
  setZen: null, // zen.js: (on) => void
  isZen: null, // zen.js: () => whether zen is on
  checkDiveCrash: null, // crash.js: (pitch, kts, verticalVelocity) => boolean
  onBackground: null, // analytics.js: called when mobile app is backgrounded
  onForeground: null, // analytics.js: called when mobile app comes back
  navigateBack: null, // ui-a11y.js: ({source}) => 'handled' | 'exit' | false
  onSheetDismiss: null, // haptics.js: called when a bottom sheet dismisses by drag/flick
  onSheetSnap: null, // haptics.js: called when a dragged bottom sheet snaps back open
  // Background CPU prep steps started at 25% terrain load without touching scene
  earlyWarmUps: [],
  // Loading screen warm-up steps (game-ui.js): each async (at) => undo or
  // null. Each sets out something that only appears later in flight (road
  // cars, other planes, the lens flare) by the plane (at, a Vector3) for one
  // drawn frame, so its shaders compile on the loading screen, not mid-flight
  warmUps: [],
};
