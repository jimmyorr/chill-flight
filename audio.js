// --- AUDIO (PURRPLE CAT) ---

let musicEnabled = true;

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

// Loop to the next track automatically
purrpleCatAudio.addEventListener('ended', () => {
    purrpleCatIdx = (purrpleCatIdx + 1) % purrpleCatTracks.length;
    updateAudioPlayer(musicEnabled);
});

function setMusicEnabled(enabled) {
    musicEnabled = enabled;
    updateAudioPlayer(enabled);
}

function updateAudioPlayer(enabled) {
    if (enabled) {
        if (!purrpleCatAudio.src) {
            purrpleCatAudio.src = purrpleCatTracks[purrpleCatIdx];
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
