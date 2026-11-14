import {
  getCurrentTrack,
  getCurrentTrackDisplay,
  getCurrentTrackName,
  getSmoothedFlightEnergy,
  musicEnabled,
  musicMode,
  nextTrack,
  previousTrack,
  selectAlbum,
  selectTrack,
  setMusicEnabled,
  setMusicMode,
} from './audio.js';
import {PURRPLE_CAT_ALBUMS, PURRPLE_CAT_TRACKS} from './music-logic.js';
import {sfxEnabled, setSfxEnabled} from './sfx.js';
import {hooks} from './hooks.js';

let populatedAlbumSlug = '';

function populateDebugTrackSelect(albumSlug) {
  const dbgTrackSelect = document.getElementById('debug-track-select');
  if (!dbgTrackSelect || populatedAlbumSlug === albumSlug) return;
  populatedAlbumSlug = albumSlug;
  dbgTrackSelect.innerHTML = '';
  const albumTracks = PURRPLE_CAT_TRACKS.filter(
    (t) => t.albumSlug === albumSlug
  );
  albumTracks.forEach((t, idx) => {
    const opt = document.createElement('option');
    opt.value = String(t.index);
    opt.textContent = `${idx + 1}. ${t.title}`;
    dbgTrackSelect.appendChild(opt);
  });
}

export function updateDebugMusicTelemetry() {
  const dbgMenu = document.getElementById('debug-menu');
  if (!dbgMenu || dbgMenu.style.display !== 'block') return;
  const track = getCurrentTrack();
  if (!track) return;

  const dbgArt = document.getElementById('debug-album-art');
  const musicTabActive = dbgArt
    ?.closest('.dbg-body')
    ?.classList.contains('active');
  if (
    dbgArt &&
    musicTabActive &&
    track.albumCoverUrl &&
    dbgArt.dataset.cover !== track.albumCoverUrl
  ) {
    dbgArt.dataset.cover = track.albumCoverUrl;
    dbgArt.src = track.albumCoverUrl;
  }

  const dbgTitle = document.getElementById('debug-track-title');
  if (dbgTitle) dbgTitle.textContent = track.title;

  const dbgAlbumSub = document.getElementById('debug-album-subtitle');
  if (dbgAlbumSub) {
    dbgAlbumSub.textContent = `${track.albumTitle} · ${track.albumYear}`;
  }

  const dbgAlbumSelect = document.getElementById('debug-album-select');
  if (dbgAlbumSelect && dbgAlbumSelect.value !== track.albumSlug) {
    dbgAlbumSelect.value = track.albumSlug;
  }

  populateDebugTrackSelect(track.albumSlug);
  const dbgTrackSelect = document.getElementById('debug-track-select');
  if (dbgTrackSelect && dbgTrackSelect.value !== String(track.index)) {
    dbgTrackSelect.value = String(track.index);
  }

  const dbgMode = document.getElementById('debug-music-mode');
  if (dbgMode) {
    dbgMode.textContent = musicMode === 'vibe' ? 'Flight vibe' : 'By album';
  }

  const dbgBpm = document.getElementById('debug-music-bpm');
  if (dbgBpm) dbgBpm.textContent = `${track.bpm} BPM`;

  const dbgEnergy = document.getElementById('debug-music-energy');
  if (dbgEnergy) {
    const intensityPct = Math.round(track.intensity * 100);
    const energyPct = Math.round(track.energy * 100);
    const valencePct = Math.round(track.valence * 100);
    dbgEnergy.textContent = `${intensityPct}% (energy ${energyPct}% · mood ${valencePct}%)`;
  }

  const dbgFlightEnergy = document.getElementById('debug-flight-energy');
  if (dbgFlightEnergy) {
    const flightPct = Math.round(getSmoothedFlightEnergy() * 100);
    dbgFlightEnergy.textContent = `${flightPct}%`;
  }
}

export function updatePauseMenuMusicInfo() {
  const cpEl = document.getElementById('currently-playing');
  const titleEl = document.getElementById('song-title-text');
  const attrEl = document.getElementById('music-attribution');
  const showMusicInfo = musicEnabled;

  if (cpEl && titleEl) {
    if (showMusicInfo) {
      // '' rather than 'visible', so it stays hidden with its pause menu tab
      cpEl.style.visibility = '';
      titleEl.textContent = getCurrentTrackName();
      cpEl.title = getCurrentTrackDisplay();
    } else {
      cpEl.style.visibility = 'hidden';
    }
  }

  if (attrEl) {
    attrEl.style.visibility = showMusicInfo ? '' : 'hidden';
  }

  const modeSelect = document.getElementById('music-mode-select');
  if (modeSelect && modeSelect.value !== musicMode) {
    modeSelect.value = musicMode;
  }

  updateDebugMusicTelemetry();
}

// Register for automatic track change updates
if (typeof window !== 'undefined') {
  hooks.onTrackChange = () => {
    updatePauseMenuMusicInfo();
  };
  // Initialize initial visibility based on startup state
  updatePauseMenuMusicInfo();
}

// Music toggle in settings
const musicToggle = document.getElementById('music-toggle-input');
if (musicToggle) {
  // Initial sync
  musicToggle.checked = musicEnabled;

  musicToggle.addEventListener('change', (e) => {
    setMusicEnabled(e.target.checked);
  });
}

// Music mode selector in settings ('album' vs 'vibe')
const musicModeSelect = document.getElementById('music-mode-select');
if (musicModeSelect) {
  musicModeSelect.value = musicMode;
  musicModeSelect.addEventListener('change', (e) => {
    setMusicMode(e.target.value);
  });
}

// Debug panel album picker & track skip controls
const dbgAlbumSelect = document.getElementById('debug-album-select');
if (dbgAlbumSelect) {
  for (const album of PURRPLE_CAT_ALBUMS) {
    if (album.index === 0) continue;
    const opt = document.createElement('option');
    opt.value = album.slug;
    opt.textContent = `${album.title} (${album.year})`;
    dbgAlbumSelect.appendChild(opt);
  }
  const current = getCurrentTrack();
  if (current) {
    dbgAlbumSelect.value = current.albumSlug;
    populateDebugTrackSelect(current.albumSlug);
  }
  dbgAlbumSelect.addEventListener('change', (e) => {
    selectAlbum(e.target.value);
  });
}

const dbgTrackSelect = document.getElementById('debug-track-select');
if (dbgTrackSelect) {
  const current = getCurrentTrack();
  if (current) dbgTrackSelect.value = String(current.index);
  dbgTrackSelect.addEventListener('change', (e) => {
    selectTrack(Number(e.target.value));
  });
}

const dbgTrackPrev = document.getElementById('debug-track-prev');
if (dbgTrackPrev) {
  dbgTrackPrev.addEventListener('click', () => {
    previousTrack();
  });
}

const dbgTrackNext = document.getElementById('debug-track-next');
if (dbgTrackNext) {
  dbgTrackNext.addEventListener('click', () => {
    nextTrack();
  });
}

// Sound effects toggle in settings
const sfxToggle = document.getElementById('sfx-toggle-input');
if (sfxToggle) {
  // Initial sync
  sfxToggle.checked = sfxEnabled;

  sfxToggle.addEventListener('change', (e) => {
    setSfxEnabled(e.target.checked);
  });
}
