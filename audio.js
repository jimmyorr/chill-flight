// --- AUDIO (PURRPLE CAT) ---

let currentStation = 0;

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
    updateAudioPlayer(currentStation);
});

function setStation(num) {
    if (num === 1 && currentStation === 1) {
        // Clicking the same station again skips to the next track
        purrpleCatIdx = (purrpleCatIdx + 1) % purrpleCatTracks.length;
    }

    currentStation = num;

    const btns = document.querySelectorAll('.station-btn');
    if (btns.length > 0) {
        btns.forEach(b => {
            b.classList.remove('active');
            const ds = b.getAttribute('data-station');
            if (parseInt(ds) === num) b.classList.add('active');
        });
    }

    updateAudioPlayer(num);
}

function updateAudioPlayer(num) {
    if (num === 1) {
        purrpleCatAudio.src = purrpleCatTracks[purrpleCatIdx];
        purrpleCatAudio.play().catch(e => console.log('Audio play blocked:', e));
    } else {
        purrpleCatAudio.pause();
    }
}


