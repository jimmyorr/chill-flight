// --- AUDIO (PURRPLE CAT) ---
import {ChillFlightLogic} from './chill-flight-logic.js';
import {log} from './logger.js';
import {hooks} from './hooks.js';
import {state} from './state.js';
import {TimeoutError, fetchWithTimeout, withTimeout} from './network.js';
import {
  BUNDLED_TRACK,
  PURRPLE_CAT_TRACKS,
  computeFlightEnergy,
  findAlbumBySlugOrTitle,
  formatTrackDisplay,
  initialTrackIndex,
  nextAlbumProgressOffset,
  nextTrackIndex,
  purrpleCatTracks,
} from './music-logic.js';

// Network deadlines: a track download (~3-5 MB) gets 30s overall; native
// downloads also fail fast if they can't connect or stop receiving data.
const DOWNLOAD_TIMEOUT_MS = 30000;
const CONNECT_TIMEOUT_MS = 8000;
const READ_TIMEOUT_MS = 10000;
// A streamed track that can't start playing within this long is treated as
// unreachable (navigator.onLine stays true on networks that drop packets).
const STALL_TIMEOUT_MS = 10000;

// In-flight track lookups/downloads by URL (see getCachedTrackUrl()).
const pendingTrackUrls = new Map();

// ?music=0/1 overrides the saved setting for this visit (and changes made
// during it aren't saved).
export let musicEnabled =
  ChillFlightLogic.MUSIC_PARAM !== null
    ? ChillFlightLogic.MUSIC_PARAM
    : localStorage.getItem('chill_flight_music_enabled') !== 'false';

// 'album' (default: rotates featured album by day/week and plays in track order)
// or 'vibe' (picks next track to match live flight energy and BPM).
export let musicMode =
  ChillFlightLogic.MUSIC_MODE_PARAM ||
  (localStorage.getItem('chill_flight_music_mode') === 'vibe'
    ? 'vibe'
    : 'album');

// Music plays at half volume (-6 dB): the tracks are mastered at streaming
// loudness (about -14 LUFS), which at full volume is louder than music
// usually sits in a game. iOS ignores audio.volume, so there it stays full.
export const MUSIC_VOLUME = 0.5;
// Ducked while paused, relative to MUSIC_VOLUME
export const MUSIC_PAUSED_VOLUME = MUSIC_VOLUME * 0.15;

// Events that count as a user gesture for starting audio. A touch counts
// when it ends, not when it starts (touchstart never unlocks audio).
export const UNLOCK_EVENTS = [
  'pointerdown',
  'pointerup',
  'touchend',
  'keydown',
];

export let purrpleCatAudio = new Audio();
purrpleCatAudio.volume = MUSIC_VOLUME;

const playedBeforeOnStart =
  localStorage.getItem('chill_flight_played_before') === 'true';
if (!playedBeforeOnStart) {
  localStorage.setItem('chill_flight_played_before', 'true');
}

const ALBUM_PROGRESS_KEY = 'chill_flight_album_progress';
const albumProgress = (() => {
  try {
    const parsed = JSON.parse(localStorage.getItem(ALBUM_PROGRESS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
})();

function recordAlbumProgress(trackIdx) {
  const next = nextAlbumProgressOffset(trackIdx);
  if (!next) return;
  albumProgress[next.albumSlug] = next.nextOffset;
  try {
    localStorage.setItem(ALBUM_PROGRESS_KEY, JSON.stringify(albumProgress));
  } catch {
    // Storage unavailable
  }
}

// Sync the starting album & track with the world seed (or bundled track on first play)
let purrpleCatIdx = initialTrackIndex({
  playedBefore: playedBeforeOnStart,
  seed: ChillFlightLogic.WORLD_SEED,
  albumParam: ChillFlightLogic.ALBUM_PARAM,
  albumProgress,
});
const recentTrackIndices = [];
let smoothedFlightEnergy = computeFlightEnergy(state);

setInterval(() => {
  if (!state.isPaused) {
    const live = computeFlightEnergy(state);
    smoothedFlightEnergy += (live - smoothedFlightEnergy) * 0.25;
  }
}, 1500);

export function getSmoothedFlightEnergy() {
  if (!state.isPaused) {
    const live = computeFlightEnergy(state);
    smoothedFlightEnergy += (live - smoothedFlightEnergy) * 0.25;
  }
  return smoothedFlightEnergy;
}

// Pre-cache the first track immediately to avoid breaking user-gesture chain later
getCachedTrackUrl(purrpleCatTracks[purrpleCatIdx]).catch((e) =>
  console.warn('Failed to pre-cache first track:', e)
);

// Concurrent requests for the same track share one lookup/download.
function getCachedTrackUrl(url) {
  if (!pendingTrackUrls.has(url)) {
    pendingTrackUrls.set(
      url,
      resolveTrackUrl(url).finally(() => pendingTrackUrls.delete(url))
    );
  }
  return pendingTrackUrls.get(url);
}

function fallBackToBundledTrack() {
  purrpleCatIdx = 0;
  return BUNDLED_TRACK;
}

/**
 * Resolves a remote URL to a local path or Blob URL. Falls back to the
 * bundled track when offline or when the network is too slow, and to
 * streaming the remote URL on other download errors.
 */
async function resolveTrackUrl(url) {
  const fileName = url.split('/').pop();

  // If it's the bundled track, just use the local asset directly to save bandwidth and storage
  if (fileName === BUNDLED_TRACK.split('/').pop()) {
    return BUNDLED_TRACK;
  }

  // -- NATIVE MOBILE APP PATH (Capacitor) --
  if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
    try {
      const Filesystem = Capacitor.Plugins.Filesystem;
      if (!Filesystem) throw new Error('Filesystem plugin not available');

      // 1. Check if file already exists in native cache by reading the directory
      // This avoids the native 'stat' error log when the file doesn't exist yet
      let fileExists = false;
      try {
        const dirResult = await Filesystem.readdir({
          directory: 'CACHE',
          path: '',
        });
        fileExists = dirResult.files.some((f) => (f.name || f) === fileName);
      } catch {
        /* ignore */
      }

      if (!fileExists) {
        throw new Error('Cache miss (expected)');
      }

      const result = await Filesystem.getUri({
        directory: 'CACHE',
        path: fileName,
      });

      log.info(`Serving track from native cache: ${fileName}`);
      return Capacitor.convertFileSrc(result.uri);
    } catch (e) {
      // 2. If it doesn't exist, download it natively
      log.info(`Downloading new track to native cache: ${url}`);

      if (!navigator.onLine) {
        log.info('Offline and not cached: Falling back to bundled track');
        return fallBackToBundledTrack();
      }

      try {
        const Filesystem = Capacitor.Plugins.Filesystem;
        if (!Filesystem)
          throw new Error('Filesystem plugin not available', {
            cause: e,
          });

        // If the overall deadline passes, the native download may still finish
        // in the background and be served from the cache next time.
        const downloadResult = await withTimeout(
          Filesystem.downloadFile({
            url: url,
            path: fileName,
            directory: 'CACHE',
            connectTimeout: CONNECT_TIMEOUT_MS,
            readTimeout: READ_TIMEOUT_MS,
          }),
          DOWNLOAD_TIMEOUT_MS,
          `Download of ${fileName}`
        );

        return Capacitor.convertFileSrc(downloadResult.path);
      } catch (downloadErr) {
        if (downloadErr instanceof TimeoutError) {
          log.warn(`${downloadErr.message}; falling back to bundled track`);
          return fallBackToBundledTrack();
        }
        console.error(
          'Failed to download audio natively, streaming directly:',
          downloadErr
        );
        return url;
      }
    }
  }

  // -- NATIVE DESKTOP APP PATH (Tauri) --
  if (window.__TAURI__ !== undefined) {
    try {
      const fs = window.__TAURI__.fs;
      const BaseDirectory = window.__TAURI__.fs.BaseDirectory;

      // 1. Check if file already exists in cache
      const fileExists = await fs.exists(fileName, {
        baseDir: BaseDirectory.Cache,
      });

      if (fileExists) {
        log.info(`Serving track from Tauri cache: ${fileName}`);
        const fileData = await fs.readFile(fileName, {
          baseDir: BaseDirectory.Cache,
        });
        const blob = new Blob([fileData], {type: 'audio/mpeg'});
        return URL.createObjectURL(blob);
      } else {
        throw new Error('Cache miss');
      }
    } catch {
      // 2. If it doesn't exist, download it
      log.info(`Downloading new track to Tauri cache: ${url}`);

      if (!navigator.onLine) {
        log.info('Offline and not cached: Falling back to bundled track');
        return fallBackToBundledTrack();
      }

      try {
        const fs = window.__TAURI__.fs;
        const BaseDirectory = window.__TAURI__.fs.BaseDirectory;

        const response = await fetchWithTimeout(url, {}, DOWNLOAD_TIMEOUT_MS);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const fileData = new Uint8Array(arrayBuffer);

        await fs.writeFile(fileName, fileData, {baseDir: BaseDirectory.Cache});

        const blob = new Blob([fileData], {type: 'audio/mpeg'});
        return URL.createObjectURL(blob);
      } catch (downloadErr) {
        console.error('Failed to download audio in Tauri:', downloadErr);
        return fallBackToBundledTrack();
      }
    }
  }

  // -- STANDARD WEB BROWSER PATH --
  // Note: We do not use the CacheStorage API + blob: URLs here because
  // iOS Safari (WKWebView) has a long-standing bug where AVPlayer fails
  // to play blob: URIs correctly. Standard browser HTTP caching is sufficient.
  if (!navigator.onLine) {
    log.info('Offline: Falling back to bundled track');
    return fallBackToBundledTrack();
  }
  // Streamed; see armStallGuard() for slow networks.
  return url;
}

// Track switching logic
async function switchToTrackIdx(nextIdx) {
  isMusicInternalAction = true;
  purrpleCatIdx =
    ((Math.trunc(nextIdx) % purrpleCatTracks.length) +
      purrpleCatTracks.length) %
    purrpleCatTracks.length;
  const url = purrpleCatTracks[purrpleCatIdx];
  purrpleCatAudio.src = await getCachedTrackUrl(url);
  purrpleCatAudio.load();
  if (hooks.onTrackChange) hooks.onTrackChange(getCurrentTrackDisplay());
  await updateAudioPlayer(musicEnabled);
  updateMediaMetadata();
  isMusicInternalAction = false;
}

export async function nextTrack() {
  recentTrackIndices.push(purrpleCatIdx);
  if (recentTrackIndices.length > 32) recentTrackIndices.shift();
  const nextIdx = nextTrackIndex(purrpleCatIdx, {
    mode: musicMode,
    flightEnergy: getSmoothedFlightEnergy(),
    recentIndices: recentTrackIndices,
    albumProgress,
    step: 1,
  });
  await switchToTrackIdx(nextIdx);
}

export async function previousTrack() {
  const prevIdx = nextTrackIndex(purrpleCatIdx, {
    mode: musicMode,
    flightEnergy: getSmoothedFlightEnergy(),
    recentIndices: recentTrackIndices,
    step: -1,
  });
  if (
    musicMode === 'vibe' &&
    recentTrackIndices[recentTrackIndices.length - 1] === prevIdx
  ) {
    recentTrackIndices.pop();
  }
  await switchToTrackIdx(prevIdx);
}

export async function selectAlbum(slugOrTitle) {
  const album = findAlbumBySlugOrTitle(slugOrTitle);
  if (!album || album.startTrackIdx < 0) return;
  recentTrackIndices.push(purrpleCatIdx);
  if (recentTrackIndices.length > 32) recentTrackIndices.shift();
  await switchToTrackIdx(album.startTrackIdx);
}

export async function selectTrack(trackIdx) {
  const idx = Number(trackIdx);
  if (!Number.isInteger(idx) || idx < 0 || idx >= PURRPLE_CAT_TRACKS.length)
    return;
  recentTrackIndices.push(purrpleCatIdx);
  if (recentTrackIndices.length > 32) recentTrackIndices.shift();
  await switchToTrackIdx(idx);
}

export function setMusicMode(mode, {save = true} = {}) {
  musicMode = mode === 'vibe' ? 'vibe' : 'album';
  if (save && ChillFlightLogic.MUSIC_MODE_PARAM === null) {
    localStorage.setItem('chill_flight_music_mode', musicMode);
  }
  if (hooks.onTrackChange) {
    hooks.onTrackChange(getCurrentTrackDisplay());
  }
}

// Loop to the next track automatically
purrpleCatAudio.addEventListener('ended', async () => {
  await nextTrack();
});

export function getCurrentTrack() {
  return PURRPLE_CAT_TRACKS[purrpleCatIdx] || PURRPLE_CAT_TRACKS[0];
}

export function getCurrentTrackName() {
  return getCurrentTrack().title;
}

export function getCurrentAlbumName() {
  return getCurrentTrack().albumTitle;
}

export function getCurrentTrackDisplay() {
  return formatTrackDisplay(purrpleCatIdx);
}

// Global callback for UI updates

let isMusicInternalAction = false;
let isPausedByVisibility = false;

function syncMusicUI(playing) {
  // Update music settings toggle
  const musicToggle = document.getElementById('music-toggle-input');
  if (musicToggle) {
    musicToggle.checked = playing;
  }

  if (hooks.onTrackChange) {
    hooks.onTrackChange(getCurrentTrackDisplay());
  }

  updateMediaMetadata();
}

// Plays and pauses the game didn't ask for come from the system (headphones
// unplugged, a phone call, the app going to the background). They change
// music for this visit only: saving them would start the next visit silent.
purrpleCatAudio.addEventListener('play', () => {
  if (!isMusicInternalAction) musicEnabled = true;
  recordAlbumProgress(purrpleCatIdx);
  syncMusicUI(true);
});

purrpleCatAudio.addEventListener('pause', () => {
  if (!isMusicInternalAction && !purrpleCatAudio.ended && musicEnabled) {
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'
    ) {
      // Paused by the system as the page hid: resume when it shows again
      isPausedByVisibility = true;
      return;
    }
    musicEnabled = false;
  }
  syncMusicUI(false);
});

function pauseMusicInternal() {
  isMusicInternalAction = true;
  purrpleCatAudio.pause();
  // Ensure the flag stays true through the event loop to catch the 'pause' event
  setTimeout(() => {
    isMusicInternalAction = false;
  }, 100);
}

function playMusicInternal() {
  // We use updateAudioPlayer here because it has the safety net for blocked autoplay
  updateAudioPlayer(musicEnabled);
}

export function handleMusicVisibility(hidden) {
  if (hidden) {
    if (musicEnabled && !purrpleCatAudio.paused) {
      isPausedByVisibility = true;
      pauseMusicInternal();
    }
  } else if (
    isPausedByVisibility &&
    (typeof document === 'undefined' || document.visibilityState !== 'hidden')
  ) {
    isPausedByVisibility = false;
    playMusicInternal();
  }
}

document.addEventListener('visibilitychange', () => {
  handleMusicVisibility(document.visibilityState === 'hidden');
});
window.addEventListener('pagehide', () => handleMusicVisibility(true));
window.addEventListener('pageshow', () => handleMusicVisibility(false));

export function setMusicEnabled(enabled, {save = true} = {}) {
  musicEnabled = enabled;
  if (save && ChillFlightLogic.MUSIC_PARAM === null) {
    localStorage.setItem('chill_flight_music_enabled', enabled);
  }
  // Starting with music off never plays (so never fires 'pause'): sync the
  // settings checkbox and pause menu here rather than waiting on the player.
  syncMusicUI(enabled);
  updateAudioPlayer(enabled);
}

export function setMusicVolume(volume) {
  if (purrpleCatAudio) {
    purrpleCatAudio.volume = volume;
  }
}

// --- STALLED STREAM FALLBACK ---
// A remote track that hasn't buffered enough to play within STALL_TIMEOUT_MS
// (or fails to load) is swapped for the bundled track.
let stallTimer = null;
// Whether playback has been requested (START, unpause, music toggle). The
// fallback only resumes playing if it was.
let playRequested = false;

function isRemoteSrc(src) {
  try {
    return new URL(src, location.href).origin !== location.origin;
  } catch {
    return false;
  }
}

function switchToBundledTrack(reason) {
  clearTimeout(stallTimer);
  log.warn(`Music: ${reason}; switching to the bundled track`);
  fallBackToBundledTrack();
  // Swapping src fires 'pause'; flag it as ours so it isn't taken as the
  // player turning music off (see the 'pause' listener).
  isMusicInternalAction = true;
  purrpleCatAudio.src = BUNDLED_TRACK;
  purrpleCatAudio.load();
  updateMediaMetadata();
  if (hooks.onTrackChange) hooks.onTrackChange(getCurrentTrackDisplay());
  if (playRequested && musicEnabled) {
    updateAudioPlayer(true);
  } else {
    setTimeout(() => {
      isMusicInternalAction = false;
    }, 100);
  }
}

// Call right before play(): only a track we're trying to play can stall.
function armStallGuard() {
  clearTimeout(stallTimer);
  if (
    !isRemoteSrc(purrpleCatAudio.src) ||
    purrpleCatAudio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA
  ) {
    return;
  }
  stallTimer = setTimeout(
    () =>
      switchToBundledTrack(
        `track didn't start within ${STALL_TIMEOUT_MS / 1000}s`
      ),
    STALL_TIMEOUT_MS
  );
}

purrpleCatAudio.addEventListener('canplay', () => clearTimeout(stallTimer));
purrpleCatAudio.addEventListener('error', () => {
  if (isRemoteSrc(purrpleCatAudio.src)) {
    switchToBundledTrack('track failed to load');
  }
});

// Safety net for blocked autoplay: retry on each gesture until music plays
// or is turned off. One try isn't enough, since an event may not count as a
// gesture (or the game started without any tap, e.g. with music off).
let resumeArmed = false;
function armResumeOnInteraction() {
  if (resumeArmed) return;
  resumeArmed = true;
  const disarm = () => {
    resumeArmed = false;
    for (const type of UNLOCK_EVENTS) {
      window.removeEventListener(type, resumeOnInteraction);
    }
  };
  const resumeOnInteraction = () => {
    if (!musicEnabled || !purrpleCatAudio.paused) {
      disarm();
      return;
    }
    isMusicInternalAction = true;
    armStallGuard();
    purrpleCatAudio
      .play()
      .then(() => {
        log.info('Audio resumed on interaction');
        isMusicInternalAction = false;
        disarm();
        updateMediaMetadata();
      })
      .catch((e) => {
        isMusicInternalAction = false;
        clearTimeout(stallTimer);
        log.info('Still blocked:', e);
      });
  };
  for (const type of UNLOCK_EVENTS) {
    window.addEventListener(type, resumeOnInteraction, {passive: true});
  }
}

export async function updateAudioPlayer(enabled) {
  playRequested = enabled;
  if (enabled) {
    if (!purrpleCatAudio.src) {
      // The first track is still being looked up (in the apps, a new track
      // downloads before it plays, which can take up to DOWNLOAD_TIMEOUT_MS).
      // Play the bundled track now rather than start in silence or wait past
      // the tap that allows playback; the download finishes for next time.
      purrpleCatAudio.src = pendingTrackUrls.size
        ? fallBackToBundledTrack()
        : await getCachedTrackUrl(purrpleCatTracks[purrpleCatIdx]);
      if (hooks.onTrackChange) hooks.onTrackChange(getCurrentTrackDisplay());
    }
    isMusicInternalAction = true;
    armStallGuard();
    purrpleCatAudio
      .play()
      .then(() => {
        isMusicInternalAction = false;
        updateMediaMetadata();
      })
      .catch((e) => {
        isMusicInternalAction = false;
        // Blocked autoplay isn't a stalled network; re-arm when we retry.
        clearTimeout(stallTimer);
        log.info('Audio play blocked:', e);
        armResumeOnInteraction();
      });
  } else {
    clearTimeout(stallTimer);
    pauseMusicInternal();
  }
}

function updateMediaMetadata() {
  if ('mediaSession' in navigator) {
    const track = getCurrentTrack();
    const artwork = [
      {src: 'assets/icon.svg', sizes: '96x96', type: 'image/svg+xml'},
      {src: 'assets/icon.svg', sizes: '128x128', type: 'image/svg+xml'},
      {src: 'assets/icon.svg', sizes: '192x192', type: 'image/svg+xml'},
      {src: 'assets/icon.svg', sizes: '256x256', type: 'image/svg+xml'},
      {src: 'assets/icon.svg', sizes: '384x384', type: 'image/svg+xml'},
      {src: 'assets/icon.svg', sizes: '512x512', type: 'image/svg+xml'},
    ];
    if (track?.albumCoverUrl) {
      artwork.unshift({
        src: track.albumCoverUrl,
        sizes: '300x300',
        type: 'image/webp',
      });
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: getCurrentTrackName(),
      artist: 'Purrple Cat',
      album: getCurrentAlbumName(),
      artwork,
    });
  }
}

if ('mediaSession' in navigator) {
  // Media keys and headphone buttons (which also pause when headphones
  // disconnect) only last for this visit, like system pauses above
  navigator.mediaSession.setActionHandler('play', () => {
    setMusicEnabled(true, {save: false});
  });
  navigator.mediaSession.setActionHandler('pause', () => {
    setMusicEnabled(false, {save: false});
  });
  navigator.mediaSession.setActionHandler('previoustrack', () => {
    previousTrack();
  });
  navigator.mediaSession.setActionHandler('nexttrack', () => {
    nextTrack();
  });
}

// Initial UI sync
syncMusicUI(!purrpleCatAudio.paused);

// Pre-resolve the initial track URL so the first user interaction
// can trigger .play() synchronously without being blocked by an await
getCachedTrackUrl(purrpleCatTracks[purrpleCatIdx]).then((url) => {
  if (!purrpleCatAudio.src) {
    purrpleCatAudio.src = url;
  }
});
