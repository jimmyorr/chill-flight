// --- AUDIO (PURRPLE CAT) ---
import {ChillFlightLogic} from './chill-flight-logic.js';
import {log} from './logger.js';
import {hooks} from './hooks.js';
import {TimeoutError, fetchWithTimeout, withTimeout} from './network.js';

// Bundled with the app, so it plays with no network at all.
const BUNDLED_TRACK = 'assets/purrple-cat-birds-of-a-feather.mp3';
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

// Music plays at half volume (-6 dB): the tracks are mastered at streaming
// loudness (about -14 LUFS), which at full volume is louder than music
// usually sits in a game. iOS ignores audio.volume, so there it stays full.
export const MUSIC_VOLUME = 0.5;
// Ducked while paused, relative to MUSIC_VOLUME
export const MUSIC_PAUSED_VOLUME = MUSIC_VOLUME * 0.15;

export let purrpleCatAudio = new Audio();
purrpleCatAudio.volume = MUSIC_VOLUME;
const purrpleCatTracks = [
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-birds-of-a-feather.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-a-place-to-hide.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-aether.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-after-hours.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-alienated.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-around-the-campfire.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-beautiful-day.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-bird-bath.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-birdhouse.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-black-cherry.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-bloom.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-calm-waters.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-caramellow.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-cats-cradle.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-changes.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-creation.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-crescent-moon.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-crossroads.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-dark-chocolate.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-dark-forest.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-dark-moon.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-days-end.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-deja-vu.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-desert-rain.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-discovery.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-dream-machine.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-dreams-come-true.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-drifting.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-echoes-of-yesterday.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-edge-of-the-universe.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-embrace.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-equinox.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-exhale.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-exploration.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-falling-star.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-ferris-wheel.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-field-of-fireflies.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-first-snow.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-flourish.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-forget-me-not.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-frolic.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-gentle-breeze.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-ghost-town.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-glowing-tides.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-green-tea.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-happy-trails.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-heart-of-the-ocean.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-in-the-past.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-introspection.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-journeys-end.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-late-night-latte.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-light-years-apart.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-long-day.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-lost-and-found.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-lost-paradise.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-lost-treasure.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-low-tide.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-lullaby.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-magical-moments.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-message-in-a-bottle.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-meteorites.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-midnight-snack.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-moonlit-walk.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-morning-dew.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-moving-landscapes.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-muse.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-mysterious-lights.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-mystic-mountain.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-neon-tiger.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-night-train.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-once-in-a-lifetime.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-out-of-the-blue.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-palm-tree.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-passing-time.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-pillars-of-creation.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-pillow-fort.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-pineapple-popsicle.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-pitter-patter.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-please-hold-me.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-puddle-jumping.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-rainbow-falls.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-reverie.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-rocky-shores.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-rooftop-rendezvous.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-sand-castles.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-sea-of-stars.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-seashells.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-secret-of-the-forest.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-secrets.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-shipwreck-cove.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-silent-wood.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-sky-lake.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-sleeping-cat.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-sleepless.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-smores.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-snooze-button.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-solitude.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-somewhere-new.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-space-rain.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-spring-showers.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-star-bright.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-stars-collide.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-stasis.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-storm-clouds.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-stranded.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-sugar-coat.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-sundae-sunset.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-supernova.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-swingin.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-take-me-with-you.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-through-the-trees.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-through-the-wormhole.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-thunder-nap.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-time-stands-still.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-time-to-think.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-timeless.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-tunnels.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-underwater-cavern.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-visions.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-waiting-for-the-sun.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-wanted.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-where-the-waves-take-us.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-wild-strawberry.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-winter-morning.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-wish-you-were-here.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-wishes.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-wishing-well.mp3',
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-yesteryear.mp3',
];
// Sync the starting track with the world seed for a deterministic radio experience
let purrpleCatIdx = ChillFlightLogic.WORLD_SEED
  ? Math.abs(ChillFlightLogic.WORLD_SEED) % purrpleCatTracks.length
  : 0;

// Use the bundled track the first time the user ever plays the game
if (localStorage.getItem('chill_flight_played_before') !== 'true') {
  purrpleCatIdx = 0;
  localStorage.setItem('chill_flight_played_before', 'true');
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
async function nextTrack() {
  isMusicInternalAction = true;
  purrpleCatIdx = (purrpleCatIdx + 1) % purrpleCatTracks.length;
  const url = purrpleCatTracks[purrpleCatIdx];
  purrpleCatAudio.src = await getCachedTrackUrl(url);
  purrpleCatAudio.load();
  await updateAudioPlayer(musicEnabled);
  updateMediaMetadata();
  isMusicInternalAction = false;
}

async function previousTrack() {
  isMusicInternalAction = true;
  purrpleCatIdx =
    (purrpleCatIdx - 1 + purrpleCatTracks.length) % purrpleCatTracks.length;
  const url = purrpleCatTracks[purrpleCatIdx];
  purrpleCatAudio.src = await getCachedTrackUrl(url);
  purrpleCatAudio.load();
  await updateAudioPlayer(musicEnabled);
  updateMediaMetadata();
  isMusicInternalAction = false;
}

// Loop to the next track automatically
purrpleCatAudio.addEventListener('ended', async () => {
  await nextTrack();
});

export function getCurrentTrackName() {
  const url = purrpleCatTracks[purrpleCatIdx];
  const fileName = url.split('/').pop().replace('.mp3', '');
  // Convert 'purrple-cat-birds-of-a-feather' to 'Birds Of A Feather'
  return fileName
    .replace('purrple-cat-', '')
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
    hooks.onTrackChange(getCurrentTrackName());
  }

  updateMediaMetadata();
}

purrpleCatAudio.addEventListener('play', () => {
  if (!isMusicInternalAction) {
    if (!musicEnabled) {
      musicEnabled = true;
      localStorage.setItem('chill_flight_music_enabled', 'true');
    }
  }
  syncMusicUI(true);
});

purrpleCatAudio.addEventListener('pause', () => {
  if (!isMusicInternalAction && !purrpleCatAudio.ended) {
    if (musicEnabled) {
      musicEnabled = false;
      localStorage.setItem('chill_flight_music_enabled', 'false');
    }
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

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (musicEnabled && !purrpleCatAudio.paused) {
      isPausedByVisibility = true;
      pauseMusicInternal();
    }
  } else {
    if (isPausedByVisibility) {
      isPausedByVisibility = false;
      playMusicInternal();
    }
  }
});

export function setMusicEnabled(enabled) {
  musicEnabled = enabled;
  if (ChillFlightLogic.MUSIC_PARAM === null) {
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
  if (hooks.onTrackChange) hooks.onTrackChange(getCurrentTrackName());
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

export async function updateAudioPlayer(enabled) {
  playRequested = enabled;
  if (enabled) {
    if (!purrpleCatAudio.src) {
      const url = purrpleCatTracks[purrpleCatIdx];
      purrpleCatAudio.src = await getCachedTrackUrl(url);
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
        // Safety net: resume on first interaction if blocked
        const resumeOnInteraction = () => {
          if (musicEnabled) {
            isMusicInternalAction = true;
            armStallGuard();
            purrpleCatAudio
              .play()
              .then(() => {
                log.info('Audio resumed on interaction');
                isMusicInternalAction = false;
                updateMediaMetadata();
              })
              .catch((e) => {
                isMusicInternalAction = false;
                log.info('Still blocked:', e);
              });
          }
          window.removeEventListener('mousedown', resumeOnInteraction);
          window.removeEventListener('keydown', resumeOnInteraction);
          window.removeEventListener('touchstart', resumeOnInteraction);
        };
        window.addEventListener('mousedown', resumeOnInteraction);
        window.addEventListener('keydown', resumeOnInteraction);
        window.addEventListener('touchstart', resumeOnInteraction);
      });
  } else {
    clearTimeout(stallTimer);
    pauseMusicInternal();
  }
}

function updateMediaMetadata() {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: getCurrentTrackName(),
      artist: 'Purrple Cat',
      artwork: [
        {src: 'assets/icon.svg', sizes: '96x96', type: 'image/svg+xml'},
        {src: 'assets/icon.svg', sizes: '128x128', type: 'image/svg+xml'},
        {src: 'assets/icon.svg', sizes: '192x192', type: 'image/svg+xml'},
        {src: 'assets/icon.svg', sizes: '256x256', type: 'image/svg+xml'},
        {src: 'assets/icon.svg', sizes: '384x384', type: 'image/svg+xml'},
        {src: 'assets/icon.svg', sizes: '512x512', type: 'image/svg+xml'},
      ],
    });
  }
}

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => {
    setMusicEnabled(true);
  });
  navigator.mediaSession.setActionHandler('pause', () => {
    setMusicEnabled(false);
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
