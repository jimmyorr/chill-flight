// --- PROCEDURAL AUDIO RADIO & YOUTUBE ---
// Dependencies: none (self-contained, uses global audioCtx)

let audioCtx;
let mainGain;
let currentStation = 0;
let nextNoteTime = 0;
let beatCount = 0;
let scheduleTimer;

const stationNames = ["Off", "L O F I - G I R L"];

function setStation(num) {
    if (num === 1 && currentStation === 1) {
        lofiGirlIdx = (lofiGirlIdx + 1) % lofiGirlVideos.length;
    }

    currentStation = num;
    const nameDisplay = document.getElementById('station-name');

    if (nameDisplay) {
        nameDisplay.innerText = 'C H I L L - F L I G H T';
    }

    const btns = document.querySelectorAll('.station-btn');
    if (btns.length > 0) {
        btns.forEach(b => {
            b.classList.remove('active');
            const ds = b.getAttribute('data-station');
            if (parseInt(ds) === num) b.classList.add('active');
        });
    }

    if (num === 1 && !navigator.onLine) {
        nameDisplay.innerText = stationNames[num] + ' [OFFLINE]';
    } else if (ytPlayerReady) {
        updateYTPlayer(num);
    } else if (num === 1) {
        ensureYTPlayerInitialized();
    }
}

function updateYTPlayer(num) {
    if (!ytPlayerReady) return;
    const ytContainer = document.getElementById('yt-container');
    if (num === 1) {
        const isVisible = window.innerWidth > 768;
        ytContainer.style.display = isVisible ? 'block' : 'none';
        ytContainer.style.opacity = isVisible ? '1' : '0';
        ytPlayer.loadVideoById(lofiGirlVideos[lofiGirlIdx]);
        setTimeout(() => ytPlayer.playVideo(), 100);
    } else {
        ytContainer.style.display = 'none';
        ytContainer.style.opacity = '0';
        ytPlayer.pauseVideo();
    }
}

// --- YOUTUBE API RESILIENT HANDSHAKE (v15) ---
let ytPlayer;
let ytPlayerReady = false;
let ytApiLoaded = false;
let ytInitializing = false;
let calibrationFinished = false;
let ytQueuedStation = null;
const lofiGirlVideos = ['jfKfPfyJRdk', '28KRPhVzCus', 'HuFYqnbVbzY'];
let lofiGirlIdx = 0;

// --- OFFLINE / ONLINE DETECTION (YouTube) ---
function setYTOfflineState(isOffline) {
    const lgBtn = document.querySelector('.station-btn[data-station="1"]');
    const nameDisplay = document.getElementById('station-name');
    if (lgBtn) {
        lgBtn.classList.toggle('disabled', isOffline);
        lgBtn.title = isOffline ? 'L O F I - G I R L (offline)' : 'L O F I - G I R L';
    }
    if (isOffline) {
        if (currentStation === 1) {
            if (ytPlayerReady) {
                try { ytPlayer.pauseVideo(); } catch (e) { /* ignore */ }
            }
        }
        // Reset so we re-init on reconnect
        ytPlayerReady = false;
        ytInitializing = false;
    } else {
        // Back online — if user had LG selected, re-queue it
        if (currentStation === 1) {
            ytQueuedStation = 1;
            if (ytApiLoaded) {
                ensureYTPlayerInitialized();
            }
        }
    }
}

window.addEventListener('offline', () => {
    console.log('Network offline — disabling YouTube radio.');
    setYTOfflineState(true);
});

window.addEventListener('online', () => {
    console.log('Network online — re-enabling YouTube radio.');
    setYTOfflineState(false);
});

// Apply initial offline state on load if needed
if (!navigator.onLine) {
    // Delay slightly so DOM is ready
    setTimeout(() => setYTOfflineState(true), 500);
}

// FAIL-SAFE: Always finish calibration after 10 seconds (upped from 5s)
setTimeout(() => {
    if (!calibrationFinished) {
        console.log("Radio calibration taking longer than usual. Cockpit ready.");
        finishCalibration();
    }
}, 10000);

window.onYouTubeIframeAPIReady = function () {
    console.log("YouTube API Loaded.");
    ytApiLoaded = true;
    updateLoadingProgress(20, "Calculating flight paths...");

    // Short buffer to allow GA configs to settle
    setTimeout(() => {
        ensureYTPlayerInitialized();
    }, 300);
};

function updateLoadingProgress(percent, status) {
    const bar = document.getElementById('loading-bar');
    const text = document.getElementById('loading-status');
    if (bar) bar.style.width = percent + '%';
    if (text) text.innerText = status;
}

function finishCalibration() {
    if (calibrationFinished) return;
    calibrationFinished = true;

    updateLoadingProgress(100, "Ready to chill.");
    const overlay = document.getElementById('loading-overlay');

    if (overlay) {
        overlay.style.transition = 'opacity 1s ease';
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
        setTimeout(() => overlay.style.visibility = 'hidden', 1000);
    }

    setTimeout(() => {
        const defaultNames = window.CALLSIGNS || ['Pilot'];
        const hasName = localStorage.getItem('chill_flight_name') || window.playerName;
        if (!hasName || defaultNames.includes(hasName) || hasName === 'Pilot') {
            const radioPanel = document.getElementById('radio-panel');
            if (radioPanel) radioPanel.classList.add('pulse-radio');
        }
    }, 1500);

    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function ensureYTPlayerInitialized(callback) {
    if (ytInitializing || ytPlayerReady) return;
    if (!navigator.onLine) {
        console.log('YouTube init skipped — offline.');
        return;
    }
    ytInitializing = true;
    updateLoadingProgress(40, "Tuning radios...");

    const ytContainer = document.getElementById('yt-container');
    const origin = window.location.origin || window.location.protocol + '//' + window.location.host;
    const videoId = lofiGirlVideos[lofiGirlIdx];

    ytContainer.style.display = 'block';
    ytContainer.style.opacity = '0';
    ytContainer.style.pointerEvents = 'none';

    updateLoadingProgress(60, "Reticulating splines...");

    ytPlayer = new YT.Player('youtube-player', {
        width: '220',
        height: '124',
        videoId: videoId,
        playerVars: {
            'playsinline': 1,
            'controls': 0,
            'disablekb': 1,
            'enablejsapi': 1,
            'origin': origin,
            'rel': 0,
            'iv_load_policy': 3,
            'widget_referrer': origin
        },
        events: {
            'onReady': () => {
                console.log("YouTube Radio Active.");
                ytPlayerReady = true;
                ytInitializing = false;
                ytContainer.style.pointerEvents = 'auto';

                // Handle station queuing
                if (ytQueuedStation) {
                    setStation(ytQueuedStation);
                    ytQueuedStation = null;
                }

                finishCalibration();
                if (callback) callback();
            },
            'onError': (e) => {
                console.error("YouTube Error:", e.data);
                ytInitializing = false;
                finishCalibration();
            }
        }
    });
}
