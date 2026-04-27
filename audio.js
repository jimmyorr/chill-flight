// --- AUDIO (PURRPLE CAT) ---

let musicEnabled = localStorage.getItem('chill_flight_music_enabled') !== 'false';

let purrpleCatAudio = new Audio();
const purrpleCatTracks = [
    'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-birds-of-a-feather.mp3',
    'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-equinox.mp3',
    'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-flourish.mp3',
    'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-green-tea.mp3',
    'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-rainbow-falls.mp3',
    'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-wild-strawberry.mp3',
    'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat/purrple-cat-winter-morning.mp3'
];
let purrpleCatIdx = 0;

const CACHE_NAME = 'chill-flight-music-v1';

/**
 * Resolves a remote URL to a local Blob URL via the Cache API.
 * Falls back to the remote URL on any error.
 */
async function getCachedTrackUrl(url) {
    if (!('caches' in window)) return url;

    try {
        const cache = await caches.open(CACHE_NAME);
        let response = await cache.match(url);

        if (!response) {
            console.log(`Caching new track: ${url}`);
            response = await fetch(url);
            // We must clone the response to both save it and use it
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

purrpleCatAudio.addEventListener('play', () => {
    if (window.onTrackChange && musicEnabled) {
        window.onTrackChange(getCurrentTrackName());
    }
});

function setMusicEnabled(enabled) {
    musicEnabled = enabled;
    localStorage.setItem('chill_flight_music_enabled', enabled);
    updateAudioPlayer(enabled);

    // Update mobile button UI
    const radToggle = document.getElementById('mobile-rad-toggle');
    if (radToggle) {
        radToggle.title = enabled ? "Pause Music" : "Play Music";
        const svg = radToggle.querySelector('svg');
        if (svg) {
            if (enabled) {
                // Pause icon
                svg.innerHTML = '<path d="M6 4h4v16H6zM14 4h4v16h-4z"></path>';
            } else {
                // Play icon
                svg.innerHTML = '<path d="M5 3l14 9-14 9V3z"></path>';
            }
        }
    }
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
