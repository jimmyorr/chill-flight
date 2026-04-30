// --- AUDIO (PURRPLE CAT) ---

let musicEnabled = localStorage.getItem('chill_flight_music_enabled') !== 'false';

let purrpleCatAudio = new Audio();
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
    'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-bones.mp3',
    'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-calm-waters.mp3',
    'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-caramellow.mp3',
    'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-cats-cradle.mp3',
    'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-changes.mp3',
    'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-chugging-along.mp3',
    'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-come-one-come-all.mp3',
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
    'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-going-with-the-flow.mp3',
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
    'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-phantom-waltz.mp3',
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
    'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-the-lonely-ghost-halloween-2023.mp3',
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
    'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-yesteryear.mp3'
];
// Sync the starting track with the world seed for a deterministic radio experience
let purrpleCatIdx = (typeof ChillFlightLogic !== 'undefined' && ChillFlightLogic.WORLD_SEED) 
    ? (Math.abs(ChillFlightLogic.WORLD_SEED) % purrpleCatTracks.length) 
    : 0;


const CACHE_NAME = 'chill-flight-music-v1';

/**
 * Resolves a remote URL to a local path or Blob URL.
 * Falls back to the remote URL on any error.
 */
async function getCachedTrackUrl(url) {
    const fileName = url.split('/').pop();

    // -- NATIVE MOBILE APP PATH (Capacitor) --
    if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
        try {
            const Filesystem = Capacitor.Plugins.Filesystem;
            if (!Filesystem) throw new Error('Filesystem plugin not available');

            // 1. Check if file already exists in native cache
            const result = await Filesystem.getUri({
                directory: 'CACHE',
                path: fileName
            });

            console.log(`Serving track from native cache: ${fileName}`);
            return Capacitor.convertFileSrc(result.uri);

        } catch (e) {
            // 2. If it doesn't exist, download it natively
            console.log(`Downloading new track to native cache: ${url}`);

            try {
                const Filesystem = Capacitor.Plugins.Filesystem;
                const downloadResult = await Filesystem.downloadFile({
                    url: url,
                    path: fileName,
                    directory: 'CACHE'
                });

                return Capacitor.convertFileSrc(downloadResult.path);
            } catch (downloadErr) {
                console.error('Failed to download audio natively:', downloadErr);
                return url; // Fallback to streaming
            }
        }
    }

    // -- STANDARD WEB BROWSER PATH --
    if (!('caches' in window)) return url;

    try {
        const cache = await caches.open(CACHE_NAME);
        let response = await cache.match(url);

        if (!response) {
            console.log(`Caching new track: ${url}`);
            response = await fetch(url);
            await cache.put(url, response.clone());
        } else {
            console.log(`Serving track from cache: ${url}`);
        }

        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (e) {
        console.warn('Cache API error, falling back to remote URL:', e);
        return url;
    }
}

// Loop to the next track automatically
purrpleCatAudio.addEventListener('ended', async () => {
    purrpleCatIdx = (purrpleCatIdx + 1) % purrpleCatTracks.length;
    // Update the source immediately so play() uses the new track
    const url = purrpleCatTracks[purrpleCatIdx];
    purrpleCatAudio.src = await getCachedTrackUrl(url);

    // Explicitly load the new track to reset the audio element's state 
    // before updateAudioPlayer attempts to call .play()
    purrpleCatAudio.load();

    updateAudioPlayer(musicEnabled);
});

function getCurrentTrackName() {
    const url = purrpleCatTracks[purrpleCatIdx];
    const fileName = url.split('/').pop().replace('.mp3', '');
    // Convert 'purrple-cat-birds-of-a-feather' to 'Birds Of A Feather'
    return fileName.replace('purrple-cat-', '').split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// Global callback for UI updates
window.onTrackChange = null;

let isMusicInternalAction = false;
let isPausedByVisibility = false;

function syncMusicUI(playing) {
    // Update mobile button UI
    const radToggle = document.getElementById('mobile-rad-toggle');
    if (radToggle) {
        radToggle.title = playing ? "Pause" : "Play";
        const svg = radToggle.querySelector('svg');
        if (svg) {
            if (playing) {
                // Pause icon
                svg.innerHTML = '<path d="M6 4h4v16H6zM14 4h4v16h-4z"></path>';
            } else {
                // Play icon
                svg.innerHTML = '<path d="M5 3l14 9-14 9V3z"></path>';
            }
        }
    }

    if (window.onTrackChange) {
        window.onTrackChange(getCurrentTrackName());
    }
}

purrpleCatAudio.addEventListener('play', () => {
    if (!isMusicInternalAction) {
        musicEnabled = true;
        localStorage.setItem('chill_flight_music_enabled', 'true');
    }
    syncMusicUI(true);
});

purrpleCatAudio.addEventListener('pause', () => {
    if (!isMusicInternalAction) {
        musicEnabled = false;
        localStorage.setItem('chill_flight_music_enabled', 'false');
    }
    syncMusicUI(false);
});

function pauseMusicInternal() {
    isMusicInternalAction = true;
    purrpleCatAudio.pause();
    isMusicInternalAction = false;
}

function playMusicInternal() {
    isMusicInternalAction = true;
    purrpleCatAudio.play().catch(e => {
        console.log('Internal audio play blocked:', e);
    });
    isMusicInternalAction = false;
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

function setMusicEnabled(enabled) {
    musicEnabled = enabled;
    localStorage.setItem('chill_flight_music_enabled', enabled);
    updateAudioPlayer(enabled);
}

async function updateAudioPlayer(enabled) {
    if (enabled) {
        if (!purrpleCatAudio.src) {
            const url = purrpleCatTracks[purrpleCatIdx];
            purrpleCatAudio.src = await getCachedTrackUrl(url);
        }
        purrpleCatAudio.play().catch(e => {
            console.log('Audio play blocked:', e);
            // Safety net: resume on first interaction if blocked
            const resumeOnInteraction = () => {
                if (musicEnabled) {
                    purrpleCatAudio.play().then(() => {
                        console.log('Audio resumed on interaction');
                    }).catch(e => console.log('Still blocked:', e));
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
        purrpleCatAudio.pause();
    }
}
