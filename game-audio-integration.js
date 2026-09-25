function updatePauseMenuMusicInfo() {
  const cpEl = document.getElementById('currently-playing');
  const titleEl = document.getElementById('song-title-text');
  const attrEl = document.getElementById('music-attribution');
  const showMusicInfo =
    typeof musicEnabled !== 'undefined' &&
    musicEnabled &&
    typeof getCurrentTrackName === 'function';

  if (cpEl && titleEl) {
    if (showMusicInfo) {
      cpEl.style.visibility = 'visible';
      titleEl.textContent = getCurrentTrackName();
    } else {
      cpEl.style.visibility = 'hidden';
    }
  }

  if (attrEl) {
    attrEl.style.visibility = showMusicInfo ? 'visible' : 'hidden';
  }
}

// Make globally available
window.updatePauseMenuMusicInfo = updatePauseMenuMusicInfo;

// Register for automatic track change updates
if (typeof window !== 'undefined') {
  window.onTrackChange = (name) => {
    updatePauseMenuMusicInfo();
  };
  // Initialize initial visibility based on startup state
  updatePauseMenuMusicInfo();
}

// Music toggle in settings
const musicToggle = document.getElementById('music-toggle-input');
if (musicToggle) {
  // Initial sync
  musicToggle.checked =
    typeof musicEnabled !== 'undefined' ? musicEnabled : true;

  musicToggle.addEventListener('change', (e) => {
    if (typeof setMusicEnabled === 'function') {
      setMusicEnabled(e.target.checked);
    }
  });
}
