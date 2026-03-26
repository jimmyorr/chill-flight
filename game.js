// --- GAME LOOP, INPUT & CONTROLS ---
// Dependencies: THREE, scene, camera, renderer, planeGroup, propGroup, skyGroup,
//               sunMesh, moonMesh, dirLight, hemiLight, starsMat, timeOfDay, daySpeedMultiplier,
//               houseWindowMats, chunks, updateChunks, getElevation,
//               CHUNK_SIZE, WATER_LEVEL, BASE_FLIGHT_SPEED, TURN_SPEED, flightSpeedMultiplier,
//               pontoonGroup, pontoonL, pontoonR, hingeLF, hingeLB, hingeRF, hingeRB,
//               headlight, headlightGlow, otherPlayers (set by multiplayer.js),
//               currentStation, ytPlayer, ytPlayerReady, setStation

// --- INPUT ---
let mouseX = 0;
let mouseY = 0;
const _lastChunkUpdatePos = new THREE.Vector3(Infinity, Infinity, Infinity);
let mouseControlActive = false; // becomes true once the mouse moves; cleared by arrow-key presses
let windowJustFocused = false;  // absorbs the first mousemove after returning to the tab
let targetPitch = 0;
let targetRoll = 0;
let targetFlightSpeed = flightSpeedMultiplier; // Initialize based on current vehicle speed multiplier
let smoothedManeuverFactor = 0; // Ensures smooth cinematic transitions
let manualPitch = 0;
let verticalVelocity = 0; // units/sec, negative = falling
let keyPressStartTime = { ArrowLeft: 0, ArrowRight: 0, ArrowUp: 0, ArrowDown: 0 };
let cameraMode = 'follow'; // 'follow', 'birds-eye-close', 'birds-eye-far', 'birds-eye-ultra', or 'cinematic'
let cameraTransitionProgress = 0; // 0 = follow/cinematic, 1 = bird's eye
let currentBirdEyeHeight = 2000;
let cinematicTimer = 0;
let currentCinematicIndex = 0;
let _cinematicStableHeading = 0;

const CINEMATIC_CONFIGS = [
    { offset: new THREE.Vector3(40, 10, 40), lookOffset: new THREE.Vector3(0, 5, -10), fov: 65 }, // Side-on follow
    { offset: new THREE.Vector3(0, -15, -60), lookOffset: new THREE.Vector3(0, 0, 5), fov: 80 },  // From below-front (low angle)
    { offset: new THREE.Vector3(-50, 20, 30), lookOffset: new THREE.Vector3(0, 0, -20), fov: 60 }, // Front-quarter
    { offset: new THREE.Vector3(0, 80, 20), lookOffset: new THREE.Vector3(0, 0, -30), fov: 75 },   // High-angle vertical
    { offset: new THREE.Vector3(80, 5, -20), lookOffset: new THREE.Vector3(0, 0, 10), fov: 50 },  // Wing-tip view
];

const _idealCameraPos_Cinematic = new THREE.Vector3();
const _idealLookTarget_Cinematic = new THREE.Vector3();
const _up_Cinematic = new THREE.Vector3(0, 1, 0);

const _cinematicOffsetCurrent = new THREE.Vector3().copy(CINEMATIC_CONFIGS[0].offset);
const _cinematicLookTargetCurrent = new THREE.Vector3().copy(CINEMATIC_CONFIGS[0].lookOffset);
const _cinematicStableMatrix = new THREE.Matrix4();
const _cinematicStableQuat = new THREE.Quaternion();

function updateInputPosition(clientX, clientY) {
    const pos = ChillFlightLogic.computeInputPosition(clientX, clientY, window.innerWidth, window.innerHeight);
    mouseX = pos.x;
    mouseY = pos.y;
}

window.addEventListener('mousemove', (e) => {
    if (!e.target.closest('#cockpit-ui') && !e.target.closest('#debug-menu') && !e.target.closest('.title') && !e.target.closest('#mobile-controls') && !e.target.closest('#online-players')) {
        updateInputPosition(e.clientX, e.clientY);
        if (windowJustFocused) {
            // Silently sync position without steering — swallows the spurious
            // move event browsers fire when the window regains focus.
            windowJustFocused = false;
            return;
        }
        mouseControlActive = true;
        gamepadSteeringActive = false;
    }
});

window.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
        const target = e.target;
        const isPauseOverlay = target.closest('#pause-overlay');
        const isUI = isPauseOverlay || target.closest('#cockpit-ui') || target.closest('#debug-menu') || target.closest('.title') || target.closest('#mobile-controls') || target.closest('#player-list') || target.closest('.station-btn') || target.closest('.color-swatch');
        if (!isUI) {
            updateInputPosition(e.touches[0].clientX, e.touches[0].clientY);
            mouseControlActive = true;
        } else {
            mouseControlActive = false; // Stop steering if touching UI
            mouseX = 0;
            mouseY = 0;
        }
    }
    windowJustFocused = false;
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
        const target = e.target;
        const isCockpit = target.closest('#cockpit-ui');
        if (!isCockpit && !isPaused) {
            e.preventDefault();
        }
        const isPauseOverlay = target.closest('#pause-overlay');
        const isUI = isCockpit || isPauseOverlay || target.closest('#debug-menu') || target.closest('.title') || target.closest('#mobile-controls') || target.closest('#player-list') || target.closest('.station-btn') || target.closest('.color-swatch');
        if (!isUI) {
            updateInputPosition(e.touches[0].clientX, e.touches[0].clientY);
            mouseControlActive = true;
        } else {
            mouseControlActive = false;
            mouseX = 0;
            mouseY = 0;
        }
    }
}, { passive: false });

window.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
        mouseControlActive = false;
        mouseX = 0;
        mouseY = 0;
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    const ytContainer = document.getElementById('yt-container');
    if (currentStation === 1) {
        ytContainer.style.display = window.innerWidth <= 1024 ? 'none' : 'block';
    }
});

// --- EXPLOSIONS ---
let explosionParticles = null;
let lastY = 250; // track for ascent/descent detection



// --- PAUSE ---
let isPaused = false;
let justResumed = false; // one-frame guard to suppress any input that bled through from the pause menu

function clearInputState() {
    mouseX = 0;
    mouseY = 0;
    mouseControlActive = false;
    // keys/doubleTap may not exist yet at first call (togglePause runs before key state is declared),
    // so guard with typeof.
    if (typeof keys !== 'undefined') {
        keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = keys.Shift = false;
    }
    if (typeof doubleTap !== 'undefined') {
        doubleTap.ArrowUp = doubleTap.ArrowDown = doubleTap.ArrowLeft = doubleTap.ArrowRight = false;
    }
}
const pauseOverlay = document.getElementById('pause-overlay');

function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
        pauseOverlay.style.display = 'flex';

        // Clear all movement keys so they aren't stuck when unpausing
        keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false;
        doubleTap.ArrowUp = doubleTap.ArrowDown = doubleTap.ArrowLeft = doubleTap.ArrowRight = false;

        if (ytPlayerReady && currentStation === 1) ytPlayer.pauseVideo();
    } else {
        pauseOverlay.style.display = 'none';
        clock.getDelta(); // clear accumulated time so plane doesn't skip
        clearInputState();  // wipe any input that bled through from the pause overlay
        justResumed = true; // suppress the first animate frame's input application

        if (ytPlayerReady && currentStation === 1) ytPlayer.playVideo();
    }
}

// --- GAMEPAD SUPPORT ---
let gamepadPauseLatched = false;
let gamepadSelectLatched = false;
let gamepadSteeringActive = false;
let lastGamepadButtons = [];

let mobileFocusIndex = -1;
function updateMobileMenuFocus() {
    const subMenu = document.getElementById('mobile-sub-menu');
    if (!subMenu) return;
    const items = Array.from(subMenu.querySelectorAll('.sub-btn'));
    document.querySelectorAll('#mobile-action-menu .tv-focused').forEach(el => el.classList.remove('tv-focused'));
    if (mobileFocusIndex >= 0 && mobileFocusIndex < items.length) {
        items[mobileFocusIndex].classList.add('tv-focused');
    }
}

function pollGamepad(delta) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
    let gp = null;
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].connected) {
            gp = gamepads[i];
            break;
        }
    }

    if (!gp) {
        lastGamepadButtons = [];
        return;
    }

    // 1. Flight Stick: Map Left Analog Stick (Axes 0 and 1) to Pitch and Roll
    // Axis 0: Roll (Left/Right), Axis 1: Pitch (Up/Down)
    let roll = gp.axes[0];
    let pitch = gp.axes[1];

    // Deadzone: 0.15
    const deadzone = 0.15;
    if (Math.abs(roll) < deadzone) roll = 0;
    if (Math.abs(pitch) < deadzone) pitch = 0;

    // Map to global mouseX/mouseY which are used for targetRoll/targetPitch
    if (Math.abs(gp.axes[0]) > deadzone || Math.abs(gp.axes[1]) > deadzone) {
        mouseX = roll;
        mouseY = pitch;
        mouseControlActive = true;
        gamepadSteeringActive = true;
    } else if (gamepadSteeringActive) {
        mouseX = 0;
        mouseY = 0;
        gamepadSteeringActive = false;
    }

    // 2. Throttle: Map Right Trigger (Button 7) to accelerate and Left Trigger (Button 6) to decelerate
    const rt = gp.buttons[7].value !== undefined ? gp.buttons[7].value : (gp.buttons[7].pressed ? 1 : 0);
    const lt = gp.buttons[6].value !== undefined ? gp.buttons[6].value : (gp.buttons[6].pressed ? 1 : 0);

    if (rt > 0.1) {
        const throttleRate = (0.5 + rt * 3.5) * delta;
        targetFlightSpeed = Math.min(10, targetFlightSpeed + throttleRate);
    }
    if (lt > 0.1) {
        const throttleRate = (0.5 + lt * 3.5) * delta;
        targetFlightSpeed = Math.max(0, targetFlightSpeed - throttleRate);
    }

    // 3. Pause: Map 'Start' or 'Menu' button (Button 9) to toggle pause
    if (gp.buttons[9].pressed) {
        if (!gamepadPauseLatched) {
            togglePause();
            gamepadPauseLatched = true;
        }
    } else {
        gamepadPauseLatched = false;
    }

    // Toggle Mobile Menu: Map 'Select' or 'Back' button (Button 8)
    if (gp.buttons[8].pressed) {
        if (!gamepadSelectLatched) {
            const menuContainer = document.getElementById('mobile-action-menu');
            if (menuContainer) {
                const expanding = !menuContainer.classList.contains('expanded');
                menuContainer.classList.toggle('expanded');
                if (expanding) {
                    mobileFocusIndex = 0;
                    updateMobileMenuFocus();
                } else {
                    mobileFocusIndex = -1;
                    updateMobileMenuFocus();
                }
            }
            gamepadSelectLatched = true;
        }
    } else {
        gamepadSelectLatched = false;
    }

    // 4. Buttons and D-pad
    const currentButtons = gp.buttons.map(b => b.pressed);

    // Map D-pad to Arrows
    const dpadMap = [
        { btn: 12, key: 'ArrowUp' },
        { btn: 13, key: 'ArrowDown' },
        { btn: 14, key: 'ArrowLeft' },
        { btn: 15, key: 'ArrowRight' }
    ];

    dpadMap.forEach(map => {
        const isPressed = gp.buttons[map.btn].pressed;
        const wasPressed = !!lastGamepadButtons[map.btn];

        if (isPressed && !wasPressed) {
            // Dispatch a native keydown for D-pad so it reaches our menu logic
            window.dispatchEvent(new KeyboardEvent('keydown', { key: map.key }));
        } else if (!isPressed && wasPressed) {
            window.dispatchEvent(new KeyboardEvent('keyup', { key: map.key }));
        }
    });

    // Map Button 0 (A) to Enter for selection
    if (gp.buttons[0].pressed && !lastGamepadButtons[0]) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    } else if (!gp.buttons[0].pressed && lastGamepadButtons[0]) {
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
    }

    // 5. Bumpers: Map LB (4) and RB (5) to ArrowLeft/ArrowRight (handled for barrel rolls)
    const bumperMap = [
        { btn: 4, key: 'ArrowLeft' },
        { btn: 5, key: 'ArrowRight' }
    ];

    bumperMap.forEach(map => {
        const isPressed = gp.buttons[map.btn].pressed;
        const wasPressed = !!lastGamepadButtons[map.btn];

        if (isPressed && !wasPressed) {
            keys[map.key] = true;
            const now = performance.now();
            if (now - lastArrowTap[map.key] < DOUBLE_TAP_MS) {
                doubleTap[map.key] = true;
            }
            lastArrowTap[map.key] = now;
            keyPressStartTime[map.key] = now;

            // Keyboard/Gamepad takes control from mouse/stick
            mouseControlActive = false;
            mouseX = 0;
            mouseY = 0;
        } else if (!isPressed && wasPressed) {
            keys[map.key] = false;
            doubleTap[map.key] = false;
            lastKeyUpTime[map.key] = performance.now();
        }
        // State is updated for all buttons at the end of pollGamepad
    });

    // Update lastGamepadButtons for all buttons
    gp.buttons.forEach((btn, idx) => {
        lastGamepadButtons[idx] = btn.pressed;
    });
}

let tvFocusRow = 2; // Default to radio section
let tvFocusCol = 0;

function getMenuGrid() {
    return [
        [document.getElementById('player-name-input')],
        Array.from(document.querySelectorAll('.color-swatch')),
        [document.getElementById('quality-select')],
        [document.getElementById('distance-select')],
        [document.getElementById('invert-y-input')],
        [document.getElementById('resume-btn')]
    ];
}

function updateTVFocus() {
    document.querySelectorAll('.tv-focused').forEach(el => el.classList.remove('tv-focused'));
    const grid = getMenuGrid();
    if (!grid[tvFocusRow] || !grid[tvFocusRow][tvFocusCol]) return;
    const el = grid[tvFocusRow][tvFocusCol];
    el.classList.add('tv-focused');
    el.focus();
}

window.addEventListener('mousemove', () => {
    if (isPaused) {
        document.querySelectorAll('.tv-focused').forEach(el => el.classList.remove('tv-focused'));
    }
});

window.addEventListener('keydown', (e) => {
    // 1. Mobile Action Menu Navigation (Priority when expanded)
    const menuContainer = document.getElementById('mobile-action-menu');
    const isMenuExpanded = menuContainer && menuContainer.classList.contains('expanded');
    if (isMenuExpanded && !isPaused) {
        const subMenu = document.getElementById('mobile-sub-menu');
        const items = subMenu ? Array.from(subMenu.querySelectorAll('.sub-btn')) : [];
        if (items.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                mobileFocusIndex = (mobileFocusIndex + 1) % items.length;
                updateMobileMenuFocus();
                return;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                mobileFocusIndex = (mobileFocusIndex - 1 + items.length) % items.length;
                updateMobileMenuFocus();
                return;
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (mobileFocusIndex >= 0 && mobileFocusIndex < items.length) {
                    items[mobileFocusIndex].click();
                }
                return;
            }
        }
    }

    // 2. Toggle Pause: Escape = PC, Backspace = TV Back, MediaPlayPause = TV Play/Pause, Enter = TV Center (if playing)
    const isToggleKey = e.key === 'Escape' || e.code === 'MediaPlayPause' ||
        (e.key === 'Backspace' && (!document.activeElement || document.activeElement.tagName !== 'INPUT')) ||
        (e.key === 'Enter' && !isPaused && !isMenuExpanded && (!document.activeElement || document.activeElement.id !== 'resume-btn'));

    if (isToggleKey) {
        togglePause();
        if (isPaused) {
            tvFocusRow = 2;
            tvFocusCol = 0;
            document.querySelectorAll('.tv-focused').forEach(el => el.classList.remove('tv-focused'));
        }
        return;
    }

    // 3. Navigation in pause menu
    if (isPaused) {
        // Prevent arrow keys from scrolling the page
        if (e.key.startsWith('Arrow')) {
            e.preventDefault();
        }

        const grid = getMenuGrid();
        let handled = false;

        if (e.key === 'ArrowDown') {
            tvFocusRow = Math.min(tvFocusRow + 1, grid.length - 1);
            tvFocusCol = Math.min(tvFocusCol, grid[tvFocusRow].length - 1);
            handled = true;
        } else if (e.key === 'ArrowUp') {
            tvFocusRow = Math.max(tvFocusRow - 1, 0);
            tvFocusCol = Math.min(tvFocusCol, grid[tvFocusRow].length - 1);
            handled = true;
        } else if (e.key === 'ArrowLeft') {
            if (document.activeElement && document.activeElement.tagName === 'SELECT') {
                const sel = document.activeElement;
                if (sel.selectedIndex > 0) {
                    sel.selectedIndex--;
                    sel.dispatchEvent(new Event('change'));
                }
            } else if (document.activeElement && document.activeElement.tagName === 'INPUT') {
                return; // Let native cursor move
            } else {
                tvFocusCol = Math.max(tvFocusCol - 1, 0);
            }
            handled = true;
        } else if (e.key === 'ArrowRight') {
            if (document.activeElement && document.activeElement.tagName === 'SELECT') {
                const sel = document.activeElement;
                if (sel.selectedIndex < sel.options.length - 1) {
                    sel.selectedIndex++;
                    sel.dispatchEvent(new Event('change'));
                }
            } else if (document.activeElement && document.activeElement.tagName === 'INPUT') {
                return; // Let native cursor move
            } else {
                tvFocusCol = Math.min(tvFocusCol + 1, grid[tvFocusRow].length - 1);
            }
            handled = true;
        } else if (e.key === 'Enter') {
            const el = grid[tvFocusRow][tvFocusCol];
            if (el) {
                if (el.tagName === 'INPUT') {
                    el.blur();
                    tvFocusRow = 1;
                    tvFocusCol = 0;
                } else if (el.id === 'resume-btn') {
                    togglePause();
                } else {
                    el.click();
                }
            }
            handled = true;
        }

        if (handled) {
            e.preventDefault();
            updateTVFocus();
        }
        return; // Important: don't let pause menu keys leak to flight controls
    }

    // 4. Vehicle Switch Shortcut: 'v' or 'V'
    if (e.key.toLowerCase() === 'v' && !isPaused && (!document.activeElement || document.activeElement.tagName !== 'INPUT')) {
        const nextType = vehicleType === 'airplane' ? 'helicopter' : (vehicleType === 'helicopter' ? 'boat' : 'airplane');
        setVehicle(nextType);
        return;
    }
});



document.getElementById('resume-btn').addEventListener('click', () => {
    togglePause();
});

const radioPanel = document.getElementById('radio-panel');
if (radioPanel) {
    radioPanel.addEventListener('click', () => {
        togglePause();
    });
}


const vehicleToggle = document.getElementById('mobile-vehicle-toggle');
if (vehicleToggle) {
    vehicleToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nextType = vehicleType === 'airplane' ? 'helicopter' : (vehicleType === 'helicopter' ? 'boat' : 'airplane');
        setVehicle(nextType);
    });
}

// Distance selection
const distanceSelect = document.getElementById('distance-select');
if (distanceSelect) {
    distanceSelect.addEventListener('change', (e) => {
        RENDER_DISTANCE = parseInt(e.target.value);
        localStorage.setItem('chill_flight_distance', RENDER_DISTANCE);
        console.log(`Draw distance changed: RENDER_DISTANCE = ${RENDER_DISTANCE}`);

        // Clear all existing chunks to force regeneration
        chunks.forEach((group, key) => {
            group.traverse(child => {
                if (child.isMesh || child.isInstancedMesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else if (child.material) {
                        child.material.dispose();
                    }
                }
            });
            scene.remove(group);
        });
        chunks.clear();
        _lastChunkUpdatePos.set(Infinity, Infinity, Infinity); // Force chunk rebuild
    });
}
const qualitySelect = document.getElementById('quality-select');
if (qualitySelect) {
    qualitySelect.addEventListener('change', (e) => {
        SEGMENTS = parseInt(e.target.value);
        localStorage.setItem('chill_flight_quality', SEGMENTS);
        console.log(`Quality changed: SEGMENTS = ${SEGMENTS}`);

        // Clear all existing chunks to force regeneration
        chunks.forEach((group, key) => {
            group.traverse(child => {
                if (child.isMesh || child.isInstancedMesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else if (child.material) {
                        child.material.dispose();
                    }
                }
            });
            scene.remove(group);
        });
        chunks.clear();
        _lastChunkUpdatePos.set(Infinity, Infinity, Infinity); // Force chunk rebuild

        // The animate loop will call updateChunks() next frame and rebuild everything
    });
}

// Theme selection
const themeSelect = document.getElementById('theme-select');
if (themeSelect) {
    const currentTheme = new URLSearchParams(window.location.search).get('theme') || 'standard';
    themeSelect.value = currentTheme;
    themeSelect.addEventListener('change', (e) => {
        const newTheme = e.target.value;
        const confirmReload = window.confirm("Applying a new theme requires a page reload.\n\nReload now?");

        if (confirmReload) {
            const url = new URL(window.location);
            url.searchParams.set('theme', newTheme);
            window.location.assign(url.toString());
        } else {
            // Revert the dropdown selection if they cancel
            themeSelect.value = currentTheme;
        }
    });
}

// Seed selection
const seedInput = document.getElementById('seed-input');
if (seedInput) {
    seedInput.value = ChillFlightLogic.WORLD_SEED;
    seedInput.addEventListener('change', (e) => {
        const newSeed = e.target.value;
        if (!newSeed) return;
        if (parseInt(newSeed, 10) === ChillFlightLogic.WORLD_SEED) return;
        const confirmReload = window.confirm("Applying a new seed requires a page reload.\n\nReload now?");

        if (confirmReload) {
            const url = new URL(window.location);
            url.searchParams.set('seed', newSeed);
            window.location.assign(url.toString());
        } else {
            // Revert to original
            seedInput.value = ChillFlightLogic.WORLD_SEED;
        }
    });
}

// --- MOBILE UI ADJUSTMENTS ---
if (window.innerWidth <= 1024) {
    const cockpitUI = document.getElementById('cockpit-ui');
    if (cockpitUI) {
        cockpitUI.style.justifyContent = 'center';
    }

    const radioModule = document.getElementById('cockpit-radio-module');
    if (radioModule) {
        radioModule.style.borderLeft = 'none';
        radioModule.style.paddingLeft = '0';
        radioModule.style.marginLeft = '0';
    }
}

// --- MAIN GAME LOOP ---
const clock = new THREE.Clock();

// --- PERSISTENCE ---
let invertYAxis = false;
const savedInvertY = localStorage.getItem('chill_flight_invert_y');
if (savedInvertY !== null) {
    invertYAxis = savedInvertY === 'true';
}
const invertYInput = document.getElementById('invert-y-input');
if (invertYInput) {
    invertYInput.checked = invertYAxis;
    invertYInput.addEventListener('change', (e) => {
        invertYAxis = e.target.checked;
        localStorage.setItem('chill_flight_invert_y', invertYAxis);
    });
}

const savedQuality = localStorage.getItem('chill_flight_quality');
if (savedQuality) {
    SEGMENTS = parseInt(savedQuality);
    if (qualitySelect) qualitySelect.value = savedQuality;
}
const savedDistance = localStorage.getItem('chill_flight_distance');
if (savedDistance) {
    RENDER_DISTANCE = parseInt(savedDistance);
    if (distanceSelect) distanceSelect.value = savedDistance;
}


// Setup timeOfDay before chunk gen
const serverNowFirst = Date.now() + (window.serverTimeOffset || 0);
const secondsInCycleFirst = (serverNowFirst % 300000) / 1000;
const currentWarpedProgressFirst = ChillFlightLogic.computeTimeOfDay(secondsInCycleFirst);
window.timeOfDay = currentWarpedProgressFirst * Math.PI * 2;


// Initial chunk generation
updateChunks();
if (typeof planeGroup !== 'undefined') {
    _lastChunkUpdatePos.copy(planeGroup.position); 
}

// --- WEATHER SYSTEM ---
let weatherType = 'auto'; // Default to 'auto' now
let snowParticles = null;
// Scale snow based on quality: High = 5000, Low = 1500
const _savedQualityForSnow = localStorage.getItem('chill_flight_quality');
const _currentQualityForSnow = _savedQualityForSnow ? parseInt(_savedQualityForSnow) : 32;
const SNOW_COUNT = _currentQualityForSnow <= 16 ? 1500 : 5000;
const SNOW_RANGE = 500; // Spawn in a 500-unit box around the camera

// Generate a soft, glowing circle instead of a harsh square
function createSnowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(8, 8, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    return new THREE.CanvasTexture(canvas);
}

function initWeather() {
    const snowGeo = new THREE.BufferGeometry();
    const snowPos = new Float32Array(SNOW_COUNT * 3);
    const snowVel = new Float32Array(SNOW_COUNT * 3); // Individual drift/fall speeds

    for (let i = 0; i < SNOW_COUNT; i++) {
        snowPos[i * 3] = (Math.random() - 0.5) * SNOW_RANGE;
        snowPos[i * 3 + 1] = (Math.random() - 0.5) * SNOW_RANGE;
        snowPos[i * 3 + 2] = (Math.random() - 0.5) * SNOW_RANGE;

        // X drift, Y fall speed, Z drift
        snowVel[i * 3] = (Math.random() - 0.5) * 15;
        snowVel[i * 3 + 1] = -(Math.random() * 25 + 30);
        snowVel[i * 3 + 2] = (Math.random() - 0.5) * 15;
    }

    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    snowGeo.setAttribute('velocity', new THREE.BufferAttribute(snowVel, 3));

    const snowMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 2.0,
        map: createSnowTexture(),
        transparent: true,
        opacity: 0.0, // Start at 0 so it can fade in smoothly
        depthWrite: false,
        blending: THREE.AdditiveBlending 
    });

    snowParticles = new THREE.Points(snowGeo, snowMat);
    snowParticles.visible = false;

    snowParticles.frustumCulled = false;
    scene.add(snowParticles);

    // Bind UI
    const weatherSelect = document.getElementById('weather-select');
    if (weatherSelect) {
        weatherSelect.value = 'auto';
        weatherSelect.addEventListener('change', (e) => {
            setWeather(e.target.value);
        });
    }
}

function setWeather(type) {
    weatherType = type;
    console.log(`Weather changed to: ${type}`);
    // Removed direct visibility toggling here; updateWeather handles smooth fading now
}

function updateWeather(delta) {
    if (!snowParticles) return;

    let targetOpacity = 0;

    if (weatherType === 'snow') {
        targetOpacity = 0.8;
    } else if (weatherType === 'auto') {
        // Calculate latitude using the same scale as the cockpit HUD
        const latVal = (-planeGroup.position.z / 5000);
        
        if (latVal > 1.0) {
            // Fade in gradually from 1.0°N to 1.5°N
            targetOpacity = THREE.MathUtils.clamp((latVal - 1.0) / 0.5, 0, 1) * 0.5;
        }
    }

    // Smoothly transition the opacity
    snowParticles.material.opacity = THREE.MathUtils.lerp(snowParticles.material.opacity, targetOpacity, delta * 0.5);

    // If invisible, skip the heavy CPU math to save performance
    if (snowParticles.material.opacity < 0.01) {
        snowParticles.visible = false;
        return; 
    } else {
        snowParticles.visible = true;
    }

    const positions = snowParticles.geometry.attributes.position.array;
    const velocities = snowParticles.geometry.attributes.velocity.array;
    const camPos = camera.position;

    const halfRange = SNOW_RANGE / 2;
    const minX = camPos.x - halfRange;
    const maxX = camPos.x + halfRange;
    const minY = camPos.y - halfRange;
    const maxY = camPos.y + halfRange;
    const minZ = camPos.z - halfRange;
    const maxZ = camPos.z + halfRange;

    const len = SNOW_COUNT * 3;

    for (let i = 0; i < len; i += 3) {
        positions[i]     += velocities[i] * delta;
        positions[i + 1] += velocities[i + 1] * delta;
        positions[i + 2] += velocities[i + 2] * delta;

        if      (positions[i] < minX) positions[i] += SNOW_RANGE;
        else if (positions[i] > maxX) positions[i] -= SNOW_RANGE;

        if      (positions[i + 1] < minY) positions[i + 1] += SNOW_RANGE;
        else if (positions[i + 1] > maxY) positions[i + 1] -= SNOW_RANGE;

        if      (positions[i + 2] < minZ) positions[i + 2] += SNOW_RANGE;
        else if (positions[i + 2] > maxZ) positions[i + 2] -= SNOW_RANGE;
    }

    snowParticles.geometry.attributes.position.needsUpdate = true;
}

// Initialize immediately
initWeather();

const fpsCounterEl = document.getElementById('debug-fps');

// Optimization: Pre-allocate reusable objects for the animate loop to prevent GC stutter
const _targetEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const _forward = new THREE.Vector3(0, 0, -1);
const _cameraOffset = new THREE.Vector3(0, 0, 0);
const _idealCameraPos = new THREE.Vector3(0, 0, 0);
const _lookOffset = new THREE.Vector3(0, 0, -20);
const _idealLookTarget = new THREE.Vector3(0, 0, 0);
const _currentLookTarget = new THREE.Vector3(0, 0, 0);
const _idealUp = new THREE.Vector3(0, 1, 0);
const _upVector = new THREE.Vector3(0, 1, 0);
const _chunkDummy = new THREE.Object3D();
const _yAxis = new THREE.Vector3(0, 1, 0);
const _hubOffset = new THREE.Vector3(0, 0, 8.5);
const _idealCameraPos_Follow = new THREE.Vector3();
const _idealCameraPos_TopDown = new THREE.Vector3();
const _idealLookTarget_Follow = new THREE.Vector3();
const _idealLookTarget_TopDown = new THREE.Vector3();
const _up_Follow = new THREE.Vector3();
const _up_TopDown = new THREE.Vector3();
let lastPlayerListUpdate = 0;
const _dirArrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

// Optimization: Pre-allocate colors for sky gradients
const _uncloudedSkyColor = new THREE.Color();
const _uncloudedFogColor = new THREE.Color();
const _daySky = new THREE.Color(0x87ceeb);
const _sunriseSky = new THREE.Color();
const _goldenSky = new THREE.Color();
const _sunsetSky = new THREE.Color();
const _goldenSunsetSky = new THREE.Color();

function updateSkyBaseColors(palette) {
    _sunriseSky.copy(new THREE.Color(palette.bottom)).lerp(new THREE.Color(palette.top), 0.2); // Derived from palette
    _goldenSky.copy(new THREE.Color(palette.bottom)).lerp(new THREE.Color(0xffffff), 0.1);  // Highlighted palette bottom
    _sunsetSky.copy(new THREE.Color(palette.bottom)); // Pure palette bottom
    _goldenSunsetSky.copy(new THREE.Color(palette.bottom)).lerp(new THREE.Color(0x000000), 0.2); // Deeper palette bottom
}
updateSkyBaseColors(selectedPalette);

let targetPaletteTop = new THREE.Color(selectedPalette.top);
let targetPaletteBottom = new THREE.Color(selectedPalette.bottom);

const zenithPicker = document.getElementById('sky-zenith-picker');
const horizonPicker = document.getElementById('sky-horizon-picker');

function updateColorPickers(palette) {
    if (zenithPicker) zenithPicker.value = '#' + palette.top.toString(16).padStart(6, '0');
    if (horizonPicker) horizonPicker.value = '#' + palette.bottom.toString(16).padStart(6, '0');
}

// Initial sync
updateColorPickers(selectedPalette);

if (zenithPicker && horizonPicker) {
    const handlePickerChange = () => {
        applyCustomSkyColors(zenithPicker.value, horizonPicker.value);
    };
    zenithPicker.addEventListener('input', handlePickerChange);
    horizonPicker.addEventListener('input', handlePickerChange);
}

window.addEventListener('paletteChanged', (e) => {
    updateSkyBaseColors(e.detail);
    targetPaletteTop.setHex(e.detail.top);
    targetPaletteBottom.setHex(e.detail.bottom);

    // Only update picker UI if NOT in custom mode to avoid fighting the user
    if (!isCustomPalette) {
        updateColorPickers(e.detail);
    }
});

const _twilightSky = new THREE.Color(0x2c3e50);


const _currentSunriseSky = new THREE.Color();
const _currentGoldenSky = new THREE.Color();
const _cloudyColor = new THREE.Color();
const _finalSkyColor = new THREE.Color();
const _finalFogColor = new THREE.Color();
const _tempVec = new THREE.Vector3();
const _weatherLerpBase = new THREE.Color(0x8899aa);

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const delta = clock.getDelta();

    pollGamepad(delta);

    if (isPaused || window.isNamePromptOpen) return;

    // One-frame blanket suppression of all input after resuming from pause,
    // to catch any input that slipped through despite clearInputState().
    if (justResumed) {
        justResumed = false;
        clearInputState();
        return;
    }

    // --- DAY/NIGHT CYCLE ---
    const debugMenu = document.getElementById('debug-menu');
    const isDebugMode = (debugMenu && debugMenu.style.display === 'block');

    const CYCLE_DURATION_MS = 300000;

    let secondsInCycle, currentWarpedProgress;
    let passedServerNow;

    if (isDebugMode) {
        // In debug mode, we use a virtual clock that we increment ourselves,
        // allowing for speed multipliers while maintaining the same "warped" physics
        // as the server-synced clock.
        if (window._debugVirtualServerNow === undefined) {
            window._debugVirtualServerNow = Date.now() + (window.serverTimeOffset || 0);
        } else {
            window._debugVirtualServerNow += (delta * 1000) * daySpeedMultiplier;
        }
        passedServerNow = window._debugVirtualServerNow;
        secondsInCycle = (passedServerNow % CYCLE_DURATION_MS) / 1000;

        // Keep older debug virtual seconds for compat just in case
        window._debugVirtualSeconds = secondsInCycle;
    } else {
        // In normal mode, we always sync to the absolute server time.
        // We reset the virtual clock so it picks up from current server time if re-enabled.
        window._debugVirtualServerNow = undefined;
        window._debugVirtualSeconds = undefined;

        const serverNow = Date.now() + (window.serverTimeOffset || 0);
        passedServerNow = serverNow;
        secondsInCycle = (serverNow % CYCLE_DURATION_MS) / 1000;
    }

    currentWarpedProgress = ChillFlightLogic.computeTimeOfDay(secondsInCycle);
    timeOfDay = currentWarpedProgress * Math.PI * 2;

    // Check and update the sky palette if it's a new cycle
    if (typeof updateSkyPalette === 'function') {
        updateSkyPalette(passedServerNow);
    }
    // Window glow
    houseWindowMats.forEach((mat, i) => {
        const offset = i * 0.05;
        const localSunY = -Math.cos(timeOfDay - offset);
        const nightValue = Math.max(0, (-localSunY + 0.1) * 2);
        mat.emissiveIntensity = Math.min(2.0, nightValue);
    });

    // Update other players (interpolate & dead reckoning)
    if (typeof otherPlayers !== 'undefined') {
        otherPlayers.forEach((p) => {
            _targetEuler.set(p.targetRotX || 0, p.targetRotY || 0, p.targetRotZ || 0, 'XYZ');
            _forward.set(0, 0, -1).applyEuler(_targetEuler);
            p.targetPos.add(_forward.multiplyScalar(BASE_FLIGHT_SPEED * (p.targetSpeedMult || 1) * 60 * delta));

            const dist = p.mesh.position.distanceTo(p.targetPos);
            if (dist > 500) {
                p.mesh.position.copy(p.targetPos);
                p.mesh.rotation.set(p.targetRotX || 0, p.targetRotY || 0, p.targetRotZ || 0);
            } else {
                // Position Catch-Up: Linear step based on speed
                const catchUpSpeed = (BASE_FLIGHT_SPEED * (p.targetSpeedMult || 1) * 60) + 150;
                const posStep = catchUpSpeed * delta;
                if (dist > 0.01) {
                    p.mesh.position.lerp(p.targetPos, Math.min(posStep, dist) / dist);
                }

                // Rotation Catch-Up: Maximum turn rate
                if (p.targetQuat) {
                    p.targetQuat.setFromEuler(_targetEuler);
                    const angle = p.mesh.quaternion.angleTo(p.targetQuat);
                    const maxTurn = 3.5 * delta; // Max rotation speed in radians per second
                    if (angle > 0.001) {
                        p.mesh.quaternion.slerp(p.targetQuat, Math.min(maxTurn, angle) / angle);
                    }
                }
            }

            if (Math.abs(p.targetSpeedMult || 0) > 0.001) {
                const baseSpin = 15 * p.targetSpeedMult;
                if (p.mesh.userData.airplaneModel && p.mesh.userData.airplaneModel.visible && p.mesh.userData.propeller) {
                    const spin = Math.max(4, Math.min(25, baseSpin));
                    p.mesh.userData.propeller.rotation.z += spin * delta;
                } else if (p.mesh.userData.helicopterModel && p.mesh.userData.helicopterModel.visible && p.mesh.userData.mainRotor) {
                    const heliBase = baseSpin * 1.5;
                    // Ensure a higher floor (5.0) even at low speeds so it doesn't look silly, ramping to 7.5 @ 50kts
                    const spin = (Math.abs(p.targetSpeedMult) < 0.33) ? Math.max(5.0, heliBase) : Math.max(7.5, Math.min(18.75, heliBase));
                    p.mesh.userData.mainRotor.rotation.y += spin * delta;
                    p.mesh.userData.tailRotor.rotation.x += spin * 1.5 * delta;
                } else if (p.mesh.userData.boatModel && p.mesh.userData.boatModel.visible && p.mesh.userData.boatPropeller) {
                    const spin = Math.max(2, Math.min(20, baseSpin * 0.8));
                    p.mesh.userData.boatPropeller.rotation.z += spin * 2 * delta;
                }
            }
        });
    }

    // Spin the propellers/rotors
    if (Math.abs(flightSpeedMultiplier) > 0.001) {
        const baseSpin = 15 * Math.abs(flightSpeedMultiplier);
        if (vehicleType === 'airplane') {
            const spin = Math.max(4, Math.min(25, baseSpin));
            propGroup.rotation.z += spin * delta;
        } else if (vehicleType === 'helicopter') {
            const heliBase = baseSpin * 1.5;
            // Higher floor (5.0) for low speeds so it doesn't look silly, ramping to 7.5 @ 50kts
            // Then clamp between 7.5 and 18.75 (reached at 125 KTS / 0.83 mult)
            const spin = (Math.abs(flightSpeedMultiplier) < 0.33) ? Math.max(5.0, heliBase) : Math.max(7.5, Math.min(18.75, heliBase));
            mainRotorGroup.rotation.y += spin * delta;
            tailRotorGroup.rotation.x += spin * 1.5 * delta;
        } else if (vehicleType === 'boat' && window.boatPropellerGroup) {
            const spin = Math.max(2, Math.min(20, baseSpin * 0.8));
            window.boatPropellerGroup.rotation.z += spin * 2 * delta;
        }
    }

    // Animate pontoons
    if (isDeployingPontoons && !isRetractingPontoons && pontoonDeploymentProgress < 1) {
        pontoonDeploymentProgress += delta * 0.5;
        if (pontoonDeploymentProgress > 1) pontoonDeploymentProgress = 1;
        const t = pontoonDeploymentProgress;
        const easeOut = 1 - Math.pow(1 - t, 3);

        pontoonGroup.scale.setScalar(easeOut);

        const leftRotAngle = (Math.PI / 2) * (1 - easeOut);
        pontoonL.rotation.z = leftRotAngle;
        hingeLF.rotation.z = leftRotAngle;
        hingeLB.rotation.z = leftRotAngle;
        const rightRotAngle = -(Math.PI / 2) * (1 - easeOut);
        pontoonR.rotation.z = rightRotAngle;
        hingeRF.rotation.z = rightRotAngle;
        hingeRB.rotation.z = rightRotAngle;
        pontoonL.position.y = -0.5 - (4.0 * easeOut);
        pontoonR.position.y = -0.5 - (4.0 * easeOut);
    } else if (isRetractingPontoons && pontoonDeploymentProgress > 0) {
        pontoonDeploymentProgress -= delta * 0.4;
        if (pontoonDeploymentProgress < 0) {
            pontoonDeploymentProgress = 0;
            isRetractingPontoons = false;
            isDeployingPontoons = false;
            pontoonGroup.visible = false;
        }
        const t = pontoonDeploymentProgress;
        const easeOut = 1 - Math.pow(1 - t, 3);

        pontoonGroup.scale.setScalar(easeOut);

        const leftRotAngle = (Math.PI / 2) * (1 - easeOut);
        pontoonL.rotation.z = leftRotAngle;
        hingeLF.rotation.z = leftRotAngle;
        hingeLB.rotation.z = leftRotAngle;
        const rightRotAngle = -(Math.PI / 2) * (1 - easeOut);
        pontoonR.rotation.z = rightRotAngle;
        hingeRF.rotation.z = rightRotAngle;
        hingeRB.rotation.z = rightRotAngle;
        pontoonL.position.y = -0.5 - (4.0 * easeOut);
        pontoonR.position.y = -0.5 - (4.0 * easeOut);
    }

    // Plane rotation control
    const maxPitch = Math.PI / 4;
    const maxRoll = Math.PI / 3;
    let effMouseX = (mouseControlActive && Math.abs(mouseX) >= 0.15) ? mouseX : 0;
    let effMouseY = (mouseControlActive && Math.abs(mouseY) >= 0.15) ? mouseY : 0;

    const nowTime = performance.now();

    // Logical inputs based on Y-axis inversion
    const isUp = invertYAxis ? keys.ArrowDown : keys.ArrowUp;
    const isDown = invertYAxis ? keys.ArrowUp : keys.ArrowDown;
    const dtUp = invertYAxis ? doubleTap.ArrowDown : doubleTap.ArrowUp;
    const dtDown = invertYAxis ? doubleTap.ArrowUp : doubleTap.ArrowDown;
    const startUp = invertYAxis ? keyPressStartTime.ArrowDown : keyPressStartTime.ArrowUp;
    const startDown = invertYAxis ? keyPressStartTime.ArrowUp : keyPressStartTime.ArrowDown;

    // Shift+Up/Down: throttle control (For boat, it is just Up/Down)
    if (keys.Shift || vehicleType === 'boat') {
        if (isUp) {
            const heldTime = nowTime - startUp;
            const ramp = Math.min(1.0, heldTime / 2000);
            const throttleRate = (0.5 + ramp * 3.5) * delta;
            targetFlightSpeed = targetFlightSpeed + throttleRate;
            if (vehicleType !== 'boat') {
                targetFlightSpeed = Math.min(10, targetFlightSpeed);
            } else {
                targetFlightSpeed = Math.min(0.33, targetFlightSpeed); // Cap forward boat speed
            }
        } else if (isDown) {
            const heldTime = nowTime - startDown;
            const ramp = Math.min(1.0, heldTime / 2000);
            const throttleRate = (0.5 + ramp * 3.5) * delta;

            if (vehicleType === 'boat') {
                const prevSpeed = targetFlightSpeed;
                targetFlightSpeed = targetFlightSpeed - throttleRate;

                // Safeguard: Stop at zero. User must release and press again to go negative.
                if (prevSpeed > 0 && targetFlightSpeed < 0) {
                    targetFlightSpeed = 0;
                } else if (prevSpeed === 0 && heldTime > 100) {
                    // Already at zero and holding the button down
                    targetFlightSpeed = 0;
                }
                targetFlightSpeed = Math.max(-0.15, targetFlightSpeed);
            } else {
                targetFlightSpeed = Math.max(0, targetFlightSpeed - throttleRate);
            }
        }
    }

    if (flightSpeedMultiplier > 0 || Math.abs(targetFlightSpeed) > 0) {
        let yMultiplier = invertYAxis ? -1 : 1;

        if (vehicleType === 'boat') {
            targetPitch = 0;
            targetRoll = 0;
        } else {
            targetPitch = effMouseY * maxPitch * yMultiplier;
            targetRoll = -effMouseX * (maxRoll * 1.25);
        }

        manualPitch = THREE.MathUtils.lerp(manualPitch, 0, 0.1);

        if (keys.Shift || vehicleType === 'boat') {
            // Throttle already handled above; no pitch changes while Shift is held or if boat
        } else if (vehicleType === 'helicopter' && (isUp || isDown)) {
            targetPitch = 0; // Maintain level flight during vertical movement
        } else if (isUp && !dtUp) {
            const heldTime = nowTime - startUp;
            if (heldTime > STEER_HOLD_THRESHOLD) {
                targetPitch = (35 * Math.PI / 180); // Full climb
            } else {
                const ramp = heldTime / STEER_HOLD_THRESHOLD;
                targetPitch = (5 * Math.PI / 180) * ramp;
            }
        } else if (isDown) {
            const heldTime = nowTime - startDown;
            if (heldTime > STEER_HOLD_THRESHOLD) {
                targetPitch = (-45 * Math.PI / 180); // Softened full dive
            } else {
                const ramp = heldTime / STEER_HOLD_THRESHOLD;
                targetPitch = (-5 * Math.PI / 180) * ramp;
            }
        }
    } else {
        targetPitch = 0;
        targetRoll = 0;
    }

    let isBarrelRolling = false;
    let isClampedRoll = false;
    let isLooping = false;
    const manualRollSpeed = 4.0;
    const manualLoopSpeed = 2.5;

    if (window.autopilotEnabled && flightSpeedMultiplier > 0) {
        // 1. Maintain cruising speed (150 kts = 1.0 multiplier)
        targetFlightSpeed = 1.0;

        // 2. Altitude Control
        const currentRiverZ = typeof window.ChillFlightLogic !== 'undefined' && window.ChillFlightLogic.getRiverCenterZ
            ? window.ChillFlightLogic.getRiverCenterZ(planeGroup.position.x, simplex)
            : 0;

        const distToRiver = Math.abs(currentRiverZ - planeGroup.position.z);
        let targetAltY = 145.5; // 2500 altitude
        if (distToRiver > 1500) {
            targetAltY = 445.5; // 10000 altitude
        } else if (distToRiver > 500) {
            const t = (distToRiver - 500) / 1000;
            targetAltY = 145.5 + t * (445.5 - 145.5);
        }

        const altError = targetAltY - planeGroup.position.y;
        const maxAutoPitch = Math.PI / 6; // 30 degrees limit
        targetPitch = THREE.MathUtils.clamp(altError * 0.01, -maxAutoPitch, maxAutoPitch);

        // 3. Direction Control -> Head towards sunset/sunrise when applicable, otherwise West
        const _sunY = -Math.cos(timeOfDay);
        const _sunX = Math.sin(timeOfDay);
        const dawnDuskFactor = Math.max(0, 1.0 - Math.abs(_sunY) * 2.5);

        // 1 for East (Sunrise), -1 for West (Sunset or default)
        let lookDirX = -1;
        if (dawnDuskFactor > 0.05) {
            lookDirX = (_sunX > 0) ? 1 : -1;
        }

        // We look ahead a bit to calculate the river's local angle
        const lookAheadX = planeGroup.position.x + (lookDirX * 300);
        const targetRiverZ = typeof window.ChillFlightLogic !== 'undefined' && window.ChillFlightLogic.getRiverCenterZ
            ? window.ChillFlightLogic.getRiverCenterZ(lookAheadX, simplex)
            : 0;

        // Calculate the vector pointing down the river
        const dx = lookAheadX - planeGroup.position.x;
        const dz = targetRiverZ - currentRiverZ;

        // In this coordinate system, looking down -Z is rotation.y = 0.
        const riverAngle = Math.atan2(-dx, -dz);

        // Offset to steer back towards the center of the river. 
        const zError = currentRiverZ - planeGroup.position.z;
        // If flying East (+X), we need the opposite correction sign to steer correctly towards the river.
        const correctionSign = (lookDirX < 0) ? 1 : -1;
        const correctionAngle = THREE.MathUtils.clamp(zError * 0.003 * correctionSign, -Math.PI / 4, Math.PI / 4);

        const targetYaw = riverAngle + correctionAngle;

        let yawError = targetYaw - planeGroup.rotation.y;
        while (yawError > Math.PI) yawError -= Math.PI * 2;
        while (yawError < -Math.PI) yawError += Math.PI * 2;

        // Bank (roll) the plane to turn
        const maxAutoRoll = Math.PI / 4;
        targetRoll = THREE.MathUtils.clamp(yawError * 1.5, -maxAutoRoll, maxAutoRoll);

        // Cancel manual maneuvers
        isLooping = false;
        isBarrelRolling = false;
        isClampedRoll = false;
    } else if (flightSpeedMultiplier > 0) {
        if (isUp && dtUp && (nowTime - startUp > STEER_HOLD_THRESHOLD) && !keys.Shift) {
            // Double-tap up and hold: loop (Direct rotation, no trim pollution)
            planeGroup.rotation.x += manualLoopSpeed * delta;
            isLooping = true;
        } else if (isDown && dtDown && (nowTime - startDown > STEER_HOLD_THRESHOLD) && !keys.Shift) {
            // Double-tap down and hold: steep dive
            const targetDive = -(Math.PI * 70) / 180; // 70 degrees
            planeGroup.rotation.x = THREE.MathUtils.lerp(planeGroup.rotation.x, targetDive, 0.05);
            isLooping = true;
        }

        if (keys.ArrowLeft && !keys.Shift) {
            if (vehicleType === 'boat' || vehicleType === 'helicopter') {
                const maxRoll = (vehicleType === 'boat') ? MAX_BANK_BOAT : MAX_BANK_HELI;
                planeGroup.rotation.z = Math.min(maxRoll, planeGroup.rotation.z + manualRollSpeed * 0.5 * delta);
                isClampedRoll = true;
                isBarrelRolling = true;
            } else if (doubleTap.ArrowLeft) {
                // Double-tap: full barrel roll
                planeGroup.rotation.z += manualRollSpeed * delta;
                isBarrelRolling = true;
            } else {
                // Single-tap: bank to 90° and hold
                const target = Math.PI / 2;
                planeGroup.rotation.z = Math.min(target, planeGroup.rotation.z + manualRollSpeed * delta);
                isClampedRoll = true;
                isBarrelRolling = true;
            }
        } else if (keys.ArrowRight && !keys.Shift) {
            if (vehicleType === 'boat' || vehicleType === 'helicopter') {
                const maxRoll = (vehicleType === 'boat') ? MAX_BANK_BOAT : MAX_BANK_HELI;
                planeGroup.rotation.z = Math.max(-maxRoll, planeGroup.rotation.z - manualRollSpeed * 0.5 * delta);
                isClampedRoll = true;
                isBarrelRolling = true;
            } else if (doubleTap.ArrowRight) {
                // Double-tap: full barrel roll
                planeGroup.rotation.z -= manualRollSpeed * delta;
                isBarrelRolling = true;
            } else {
                // Single-tap: bank to -90° and hold
                const target = -Math.PI / 2;
                planeGroup.rotation.z = Math.max(target, planeGroup.rotation.z - manualRollSpeed * delta);
                isClampedRoll = true;
                isBarrelRolling = true;
            }
        }
    }

    if (!isLooping) {
        const finalTargetPitch = targetPitch + manualPitch;
        while (planeGroup.rotation.x > finalTargetPitch + Math.PI) planeGroup.rotation.x -= 2 * Math.PI;
        while (planeGroup.rotation.x < finalTargetPitch - Math.PI) planeGroup.rotation.x += 2 * Math.PI;
        planeGroup.rotation.x = THREE.MathUtils.lerp(planeGroup.rotation.x, finalTargetPitch, TURN_SPEED);
    }

    if (!isBarrelRolling) {
        while (planeGroup.rotation.z > targetRoll + Math.PI) planeGroup.rotation.z -= 2 * Math.PI;
        while (planeGroup.rotation.z < targetRoll - Math.PI) planeGroup.rotation.z += 2 * Math.PI;
        planeGroup.rotation.z = THREE.MathUtils.lerp(planeGroup.rotation.z, targetRoll, TURN_SPEED);
    }

    // --- FLIGHT PHYSICS & SPEED ---
    if (flightSpeedMultiplier > 0 || Math.abs(targetFlightSpeed) > 0) {
        let turningRoll = (isBarrelRolling && !isClampedRoll) ? targetRoll : planeGroup.rotation.z;
        const turnFactor = vehicleType === 'boat' ? 0.08 : 0.025; // Boat turns sharper since it banks less
        planeGroup.rotation.y += turningRoll * turnFactor;

        // --- GRAVITY ACCELERATION/DECELERATION ---
        // Nose down = gain speed, Nose up = lose speed
        // planeGroup.rotation.x: negative is diving, positive is climbing
        const pitchRad = planeGroup.rotation.x;
        const gravityEffect = -Math.sin(pitchRad); // positive when diving

        if (gravityEffect > 0 && vehicleType === 'airplane') {
            // Accelerate in dive (reduced for softer feel)
            // Airplane only: helicopters and boats don't gain forward speed from vertical pitch in this model
            flightSpeedMultiplier += gravityEffect * 0.7 * delta;
        }
    }

    // --- SPEED RECOVERY (DRAG & THROTTLE) ---
    // Automatically return to the target throttle speed.
    // We update this even at speed 0 so the vehicle can start moving again.
    if (Math.abs(flightSpeedMultiplier) > 0.001 || Math.abs(targetFlightSpeed) > 0.001) {
        let recoveryRate = vehicleType === 'boat' ? 3.5 : 0.6; // Boat needs snappy throttle

        if (window._isRecoveringFromHeli) {
            if (keys.Shift || Math.abs(flightSpeedMultiplier - targetFlightSpeed) < 0.05) {
                window._isRecoveringFromHeli = false;
            }
        }

        if (!window._isRecoveringFromHeli && (keys.Shift || flightSpeedMultiplier < targetFlightSpeed)) {
            recoveryRate = 10.0; // Snappy responsiveness for active control/acceleration
        }
        flightSpeedMultiplier = THREE.MathUtils.lerp(flightSpeedMultiplier, targetFlightSpeed, recoveryRate * delta);

        // Keep speed in bounds based on vehicle type
        if (vehicleType === 'boat') {
            flightSpeedMultiplier = Math.max(-0.15, Math.min(0.33, flightSpeedMultiplier));
        } else {
            flightSpeedMultiplier = Math.max(0, Math.min(10, flightSpeedMultiplier));
        }
    }

    // Altitude and Speed constants
    const controlBaseAlt = Math.max(0, planeGroup.position.y - 45.5);
    const controlAlt = Math.round(controlBaseAlt * 25);
    const accelRate = 0.8 * delta;

    // Ground avoidance heights
    const terrainHeight = getElevation(planeGroup.position.x, planeGroup.position.z);
    let isWater = terrainHeight <= WATER_LEVEL + (vehicleType === 'boat' ? 0.3 : 0.1);
    const minFlightHeight = isWater ? terrainHeight + 5.5 : terrainHeight + 30;
    let restingHeight = minFlightHeight + (isWater ? 0 : 5);

    if (vehicleType === 'boat') {
        // Boat sits submerged by 0.5 units (like the sailboats)
        // Hull height at 0.8 scale is 1.6 units. Center at 0. Bottom at -0.8.
        // To have bottom at W.L - 0.5, center must be at W.L + 0.3
        restingHeight = isWater ? (WATER_LEVEL + 0.3) : (terrainHeight + 0.8);
    }

    // Move vehicle
    const currentKTS = BASE_FLIGHT_SPEED * Math.abs(flightSpeedMultiplier) * 60;
    // Lower threshold for isFreefalling to eliminate the "stuck in mid-air" dead zone
    const isFreefalling = (vehicleType === 'airplane' && currentKTS < 50 && planeGroup.position.y > restingHeight + 2) || (vehicleType === 'boat' && planeGroup.position.y > restingHeight + 0.1) || (vehicleType === 'helicopter' && Math.abs(flightSpeedMultiplier) < 0.01 && planeGroup.position.y > restingHeight + 2);

    // Calculate actual forward speed factor based on vehicle type and thresholds
    let moveSpeedFactor = 0;
    if (vehicleType === 'airplane') {
        moveSpeedFactor = (flightSpeedMultiplier > 0 && !isFreefalling) ? flightSpeedMultiplier : 0;
    } else if (vehicleType === 'helicopter') {
        moveSpeedFactor = Math.max(0, flightSpeedMultiplier - 0.33);
    } else if (vehicleType === 'boat') {
        // Boats can move if they are in the water OR if they are falling (drifting)
        moveSpeedFactor = (Math.abs(flightSpeedMultiplier) > 0 && (isWater || isFreefalling)) ? flightSpeedMultiplier : 0;
    }

    if (vehicleType === 'airplane') {
        if (moveSpeedFactor > 0) {
            planeGroup.translateZ(-(BASE_FLIGHT_SPEED * moveSpeedFactor));
            verticalVelocity = 0; // Reset gravity accumulation while flying normally

            // Low speed stall/sink mechanics
            if (currentKTS < 100 && planeGroup.position.y > minFlightHeight) {
                const stallFactor = Math.max(0, (100 - Math.max(50, currentKTS)) / 50);
                planeGroup.position.y -= 15 * stallFactor * delta;
            }
        }
    } else if (vehicleType === 'helicopter') {
        // Helicopters don't freefall, but we use verticalVelocity for smooth lift momentum
        let targetLiftSpeed = 0;

        // Manual altitude control (at all speeds for helicopter)
        if (!keys.Shift) {
            const isUp = invertYAxis ? keys.ArrowDown : keys.ArrowUp;
            const isDown = invertYAxis ? keys.ArrowUp : keys.ArrowDown;
            const startTimeUp = invertYAxis ? keyPressStartTime.ArrowDown : keyPressStartTime.ArrowUp;
            const startTimeDown = invertYAxis ? keyPressStartTime.ArrowUp : keyPressStartTime.ArrowDown;

            if (isUp) {
                const heldTime = (performance.now() - startTimeUp);
                const ramp = Math.min(1.0, heldTime / 3000); // 3 seconds to reach full acceleration
                targetLiftSpeed = 8 + 112 * (ramp * ramp); // Starts gently at 8, reaches 120
            } else if (isDown) {
                const heldTime = (performance.now() - startTimeDown);
                const ramp = Math.min(1.0, heldTime / 3000); // 3 seconds to reach full acceleration
                targetLiftSpeed = -(8 + 112 * (ramp * ramp)); // Starts gently at -8, reaches -120
            }
        }

        // Apply momentum (acceleration/deceleration)
        const liftLerp = (targetLiftSpeed === 0) ? 0.05 : 0.08; // Slower decay for a "coasting" feel
        verticalVelocity = THREE.MathUtils.lerp(verticalVelocity, targetLiftSpeed, liftLerp);

        if (Math.abs(verticalVelocity) > 0.1) {
            planeGroup.position.y += verticalVelocity * delta;
        }

        // Apply forward movement
        if (moveSpeedFactor > 0) {
            planeGroup.translateZ(-(BASE_FLIGHT_SPEED * moveSpeedFactor));
        }
    } else if (vehicleType === 'boat') {
        // Apply forward/backward movement
        if (Math.abs(moveSpeedFactor) > 0) {
            planeGroup.translateZ(-(BASE_FLIGHT_SPEED * moveSpeedFactor));
        }
    }

    if (isFreefalling) {
        // Freefall tumble & accelerating gravity
        const GRAVITY = 120; // units/sec² — feels weighty but not instant
        verticalVelocity -= GRAVITY * delta;

        // Cap terminal velocity so it doesn't go impossibly fast
        const TERMINAL_VELOCITY = -600;
        verticalVelocity = Math.max(verticalVelocity, TERMINAL_VELOCITY);

        planeGroup.position.y += verticalVelocity * delta;

        // Tumble chaos scales with fall speed for extra drama (Disabled for boat)
        if (vehicleType !== 'boat') {
            const tumbleIntensity = Math.min(1.5, Math.abs(verticalVelocity) / 300);
            planeGroup.rotation.x += (Math.sin(now * 0.002) + Math.cos(now * 0.0011)) * 0.8 * tumbleIntensity * delta;
            planeGroup.rotation.z += (Math.cos(now * 0.0025) + Math.sin(now * 0.0017)) * 0.8 * tumbleIntensity * delta;
            planeGroup.rotation.y += (Math.sin(now * 0.0015) + Math.cos(now * 0.0009)) * 0.5 * tumbleIntensity * delta;
        }

        // Keep drifting forward if there is residual speed
        if (Math.abs(moveSpeedFactor) > 0) {
            planeGroup.translateZ(-(BASE_FLIGHT_SPEED * moveSpeedFactor));
        }
    } else if (planeGroup.position.y <= restingHeight + 0.1) {
        // Grounded — rest flat peacefully, kill vertical velocity
        verticalVelocity = 0;
        targetPitch = 0;
        targetRoll = 0;
        while (planeGroup.rotation.x > Math.PI) planeGroup.rotation.x -= 2 * Math.PI;
        while (planeGroup.rotation.x < -Math.PI) planeGroup.rotation.x += 2 * Math.PI;
        while (planeGroup.rotation.z > Math.PI) planeGroup.rotation.z -= 2 * Math.PI;
        while (planeGroup.rotation.z < -Math.PI) planeGroup.rotation.z += 2 * Math.PI;

        planeGroup.rotation.x = THREE.MathUtils.lerp(planeGroup.rotation.x, 0, 0.05);
        planeGroup.rotation.z = THREE.MathUtils.lerp(planeGroup.rotation.z, 0, 0.05);
        planeGroup.position.y = THREE.MathUtils.lerp(planeGroup.position.y, restingHeight, 0.1); // Smooth landing

        if (Math.abs(moveSpeedFactor) > 0) {
            planeGroup.translateZ(-(BASE_FLIGHT_SPEED * moveSpeedFactor));
        }
    }

    // Speed controls

    if (keys.ArrowDown) {
        keys.ArrowUp = false;
    }

    // Apply Ground avoidance — hard clamp + kill velocity on impact (Disabled for boat)
    if (vehicleType !== 'boat' && planeGroup.position.y < minFlightHeight) {
        planeGroup.position.y = minFlightHeight; // Hard clamp, not lerp
        verticalVelocity = 0; // Kill accumulated gravity immediately on ground impact

        if (isWater && planeGroup.position.y < minFlightHeight + 2) {
            if (!pontoonGroup.visible) {
                pontoonGroup.scale.setScalar(0);
                pontoonDeploymentProgress = 0;
                pontoonGroup.visible = true;
                isDeployingPontoons = true;
            }
            if (flightSpeedMultiplier > 0.5) {
                flightSpeedMultiplier = THREE.MathUtils.lerp(flightSpeedMultiplier, 0.5, 0.015);
            }
            targetPitch = THREE.MathUtils.lerp(targetPitch, 0, 0.05);
            targetRoll = THREE.MathUtils.lerp(targetRoll, 0, 0.05);
        }
    }

    const maxFlightHeight = 2046; // ~50,000 ft display altitude ((2046 - 45.5) * 25 ≈ 50,000)
    if (planeGroup.position.y > maxFlightHeight) {
        planeGroup.position.y = maxFlightHeight;
    }

    if (controlAlt >= 2000 && pontoonGroup.visible && !isRetractingPontoons) {
        isRetractingPontoons = true;
    }

    const currentY = planeGroup.position.y;
    const isDescending = currentY < lastY;
    lastY = currentY;

    if (isWater && controlAlt < 1500 && isDescending && !pontoonGroup.visible) {
        pontoonGroup.scale.setScalar(0);
        pontoonDeploymentProgress = 0;
        pontoonGroup.visible = true;
        isDeployingPontoons = true;
    }

    // Camera follow
    const speedFactor = (flightSpeedMultiplier - 0.5) / 9.5;
    const diveFactor = Math.max(0, -planeGroup.rotation.x / (Math.PI / 4)); // 1.0 at 45 degree dive

    const zOffset = THREE.MathUtils.lerp(40, 60, speedFactor);
    const yOffset = THREE.MathUtils.lerp(12, 20, speedFactor);

    // FOV expands with speed AND dive/loop steepness, capped at 70 to avoid excessive distortion
    // We use a smoothed factor to prevent "jumping" when entering loops
    const maneuverFactor = Math.max(diveFactor, isLooping ? 3.0 : 0);
    smoothedManeuverFactor = THREE.MathUtils.lerp(smoothedManeuverFactor, maneuverFactor, 0.05);

    const baseFov = THREE.MathUtils.lerp(60, 85, speedFactor);
    const targetFov = Math.min(70, baseFov + (smoothedManeuverFactor * 15 * Math.min(1, flightSpeedMultiplier / 2)));

    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.05);
    camera.updateProjectionMatrix();

    // Pull back the camera during high-G maneuvers for extra scale
    const pullBack = smoothedManeuverFactor * 20 * Math.min(1, flightSpeedMultiplier / 2);
    _cameraOffset.set(0, yOffset, zOffset + pullBack);

    // Update Debug Telemetry
    if (debugMenu.style.display === 'block') {
        document.getElementById('debug-fov').textContent = Math.round(camera.fov);
        document.getElementById('debug-pullback').textContent = Math.round(pullBack);
        document.getElementById('debug-pitch').textContent = Math.round(planeGroup.rotation.x * 180 / Math.PI);
        document.getElementById('debug-palette').textContent = selectedPalette.name;
        document.getElementById('debug-speed-mult').textContent = flightSpeedMultiplier.toFixed(2);
        document.getElementById('debug-day-speed').textContent = daySpeedMultiplier.toFixed(1);

        document.getElementById('debug-target-speed').textContent = targetFlightSpeed.toFixed(2);
        document.getElementById('debug-maneuver').textContent = smoothedManeuverFactor.toFixed(2);
        document.getElementById('debug-world-x').textContent = Math.round(planeGroup.position.x);
        document.getElementById('debug-world-y').textContent = Math.round(planeGroup.position.y);
        document.getElementById('debug-world-z').textContent = Math.round(planeGroup.position.z);

        // Update Counters
        let totalTreesPine = 0, totalTreesDecid = 0, totalTreesPalm = 0, totalTreesDead = 0, totalTreesAutumn = 0, totalTreesCherry = 0;
        let totalHouses = 0, totalClouds = 0, totalRocks = 0, totalBushes = 0;
        let totalSnowmen = 0, totalCactus = 0, totalLighthouses = 0, totalCastles = 0, totalChunks = 0;
        let totalWindmills = 0, totalCampfires = 0;
        let totalBoats = 0, totalLilyPads = 0, totalPiers = 0, totalBirds = 0;
        chunks.forEach(chunkGroup => {
            if (chunkGroup.userData.counts) {
                totalTreesPine += chunkGroup.userData.counts.trees_pine || 0;
                totalTreesDecid += chunkGroup.userData.counts.trees_decid || 0;
                totalTreesPalm += chunkGroup.userData.counts.trees_palm || 0;
                totalTreesDead += chunkGroup.userData.counts.trees_dead || 0;
                totalTreesAutumn += chunkGroup.userData.counts.trees_autumn || 0;
                totalTreesCherry += chunkGroup.userData.counts.trees_cherry || 0;
                totalHouses += chunkGroup.userData.counts.houses;
                totalClouds += chunkGroup.userData.counts.clouds;
                totalRocks += chunkGroup.userData.counts.rocks;
                totalBushes += chunkGroup.userData.counts.bushes;
                totalSnowmen += chunkGroup.userData.counts.snowmen || 0;
                totalCactus += chunkGroup.userData.counts.cactus || 0;
                totalLighthouses += chunkGroup.userData.counts.lighthouses || 0;
                totalCastles += chunkGroup.userData.counts.castles || 0;
                totalWindmills += chunkGroup.userData.counts.windmills || 0;
                totalCampfires += chunkGroup.userData.counts.campfires || 0;
                totalBoats += chunkGroup.userData.counts.boats || 0;
                totalLilyPads += chunkGroup.userData.counts.lily_pads || 0;
                totalPiers += chunkGroup.userData.counts.piers || 0;
                totalBirds += chunkGroup.userData.counts.birds || 0;
                totalChunks += 1;
            }
        });
        document.getElementById('debug-chunks').textContent = totalChunks;
        document.getElementById('debug-trees-pine').textContent = totalTreesPine;
        document.getElementById('debug-trees-decid').textContent = totalTreesDecid;
        document.getElementById('debug-trees-palm').textContent = totalTreesPalm;
        document.getElementById('debug-trees-dead').textContent = totalTreesDead;
        document.getElementById('debug-trees-autumn').textContent = totalTreesAutumn;
        document.getElementById('debug-trees-cherry').textContent = totalTreesCherry;
        document.getElementById('debug-houses').textContent = totalHouses;
        document.getElementById('debug-clouds').textContent = totalClouds;
        document.getElementById('debug-rocks').textContent = totalRocks;
        document.getElementById('debug-bushes').textContent = totalBushes;
        document.getElementById('debug-snowmen').textContent = totalSnowmen;
        document.getElementById('debug-cactus').textContent = totalCactus;
        document.getElementById('debug-lighthouses').textContent = totalLighthouses;
        document.getElementById('debug-castles').textContent = totalCastles;
        document.getElementById('debug-windmills').textContent = totalWindmills;
        document.getElementById('debug-campfires').textContent = totalCampfires;
        document.getElementById('debug-boats').textContent = totalBoats;
        document.getElementById('debug-lily-pads').textContent = totalLilyPads;
        document.getElementById('debug-piers').textContent = totalPiers;
        document.getElementById('debug-birds').textContent = totalBirds;
    }

    // Add subtle camera vibration at high speeds/steep dives
    if (flightSpeedMultiplier > 4.0 && diveFactor > 0.5) {
        const shakeIntensity = (flightSpeedMultiplier - 4.0) * 0.05 * diveFactor;
        _cameraOffset.x += (Math.random() - 0.5) * shakeIntensity;
        _cameraOffset.y += (Math.random() - 0.5) * shakeIntensity;
    }

    // --- CAMERA UPDATES ---
    const transitionDuration = 1.25; // Seconds for full swoop
    const isBirdEye = cameraMode === 'birds-eye-close' || cameraMode === 'birds-eye-far' || cameraMode === 'birds-eye-ultra';

    if (isBirdEye) {
        cameraTransitionProgress = Math.min(1, cameraTransitionProgress + delta / transitionDuration);
    } else {
        cameraTransitionProgress = Math.max(0, cameraTransitionProgress - delta / transitionDuration);
    }

    // Smoothly transition between different bird's eye heights
    let targetBirdEyeHeight = 2000;
    if (cameraMode === 'birds-eye-close') targetBirdEyeHeight = 500;
    if (cameraMode === 'birds-eye-ultra') targetBirdEyeHeight = 5000;

    currentBirdEyeHeight = THREE.MathUtils.lerp(currentBirdEyeHeight, targetBirdEyeHeight, 0.05);

    // Cubic ease-in for the "swoop up" drama: t^3
    // This makes it start slow and accelerate significantly towards the top-down view.
    const easedT = cameraTransitionProgress * cameraTransitionProgress * cameraTransitionProgress;

    // 1. Calculate Follow State
    _idealCameraPos_Follow.copy(_cameraOffset).applyMatrix4(planeGroup.matrixWorld);

    _lookOffset.set(0, 0, -20);
    _idealLookTarget_Follow.copy(_lookOffset).applyMatrix4(planeGroup.matrixWorld);

    if (isLooping) {
        _up_Follow.set(0, 1, 0).applyQuaternion(planeGroup.quaternion);
    } else {
        _up_Follow.set(0, 1, 0);
    }

    // 2. Calculate Top-Down State
    _idealCameraPos_TopDown.set(planeGroup.position.x, planeGroup.position.y + currentBirdEyeHeight, planeGroup.position.z);
    _idealLookTarget_TopDown.copy(planeGroup.position);
    _up_TopDown.set(0, 0, -1); // North is UP

    // 3. Calculate Cinematic State
    const cinematicConfig = CINEMATIC_CONFIGS[currentCinematicIndex];
    if (cameraMode === 'cinematic') {
        cinematicTimer += delta;
        if (cinematicTimer > 10) { // Switch every 6 seconds
            cinematicTimer = 0;
            currentCinematicIndex = (currentCinematicIndex + 1) % CINEMATIC_CONFIGS.length;
        }

        // Smoothen the switches between cinematic offsets
        _cinematicOffsetCurrent.lerp(cinematicConfig.offset, 0.02);
        _cinematicLookTargetCurrent.lerp(cinematicConfig.lookOffset, 0.02);

        // Stabilize heading for steering
        _cinematicStableHeading = ChillFlightLogic.lerpAngle(_cinematicStableHeading, planeGroup.rotation.y, 0.05);
        _cinematicStableQuat.setFromAxisAngle(_yAxis, _cinematicStableHeading);
        _cinematicStableMatrix.makeRotationFromQuaternion(_cinematicStableQuat);
        _cinematicStableMatrix.setPosition(planeGroup.position);
    } else {
        // Keep heading in sync while not in cinematic mode for smooth entry
        _cinematicStableHeading = planeGroup.rotation.y;
    }

    _idealCameraPos_Cinematic.copy(_cinematicOffsetCurrent).applyMatrix4(_cinematicStableMatrix);
    _idealLookTarget_Cinematic.copy(_cinematicLookTargetCurrent).applyMatrix4(_cinematicStableMatrix);

    // 4. Blend FOV
    // Follow mode has dynamic FOV, Top-down is fixed at 60, Cinematic is per-config
    const followFov = targetFov;
    const topDownFov = 60;
    const cinematicFov = cinematicConfig.fov;

    let targetBlendedFov;
    if (cameraMode === 'cinematic') {
        targetBlendedFov = THREE.MathUtils.lerp(followFov, cinematicFov, 1.0); // Simple snap for FOV in cinematic
    } else {
        targetBlendedFov = THREE.MathUtils.lerp(followFov, topDownFov, easedT);
    }

    camera.fov = THREE.MathUtils.lerp(camera.fov, targetBlendedFov, 0.1);
    camera.updateProjectionMatrix();

    // 5. Blend Positions & Targets
    if (cameraMode === 'cinematic') {
        _idealCameraPos.copy(_idealCameraPos_Cinematic);
        _idealLookTarget.copy(_idealLookTarget_Cinematic);
        _idealUp.set(0, 1, 0); // Always world-up for cinematic
    } else {
        _idealCameraPos.lerpVectors(_idealCameraPos_Follow, _idealCameraPos_TopDown, easedT);
        _idealLookTarget.lerpVectors(_idealLookTarget_Follow, _idealLookTarget_TopDown, easedT);
        _idealUp.lerpVectors(_up_Follow, _up_TopDown, easedT);
    }

    // Apply smooth tracking to the results
    camera.position.lerp(_idealCameraPos, 0.15);
    _currentLookTarget.lerp(_idealLookTarget, 0.15);
    camera.up.lerp(_idealUp, 0.1).normalize();

    camera.lookAt(_currentLookTarget);

    // Update terrain chunks (only if the plane has moved ~50 units)
    if (planeGroup.position.distanceToSquared(_lastChunkUpdatePos) > 2500) {
        updateChunks();
        _lastChunkUpdatePos.copy(planeGroup.position);
    }

    // Celestial positions
    const orbitRadius = 8000;
    const sunY = -Math.cos(timeOfDay);
    const sunX = Math.sin(timeOfDay);
    const sunZ = Math.cos(timeOfDay) * 0.3;
    const dayFactor = Math.max(0, Math.min(1, (sunY + 0.5) * 2)); // 0.0 at SunY=-0.5 (4 AM), 1.0 at SunY=0 (6 AM)

    // Update water shader uniform — the GPU handles all wave displacement
    window.waterUniforms.uTime.value = now * 0.0015;

    // Animate Birds, Windmills, Lighthouses, Campfires, Chimney Smoke
    chunks.forEach(chunkGroup => {
        if (chunkGroup.userData.birds) {
            chunkGroup.userData.birds.forEach(bird => {
                const data = bird.userData;
                const flap = Math.sin(clock.elapsedTime * data.flapSpeed + data.flapPhase) * 0.5;
                if (data.wings) {
                    data.wings[0].rotation.z = flap;
                    data.wings[1].rotation.z = -flap;
                }
                bird.translateZ(-(data.speed * delta * 50));

                if (data.type === 'hawk') {
                    data.angle += data.circleSpeed * delta;
                    const targetX = data.circleCenter.x + Math.cos(data.angle) * data.circleRadius;
                    const targetZ = data.circleCenter.z + Math.sin(data.angle) * data.circleRadius;
                    bird.rotation.z = 0.3;
                    bird.lookAt(
                        data.circleCenter.x + Math.cos(data.angle + 0.1) * data.circleRadius,
                        bird.position.y,
                        data.circleCenter.z + Math.sin(data.angle + 0.1) * data.circleRadius
                    );
                    bird.position.set(targetX, bird.position.y, targetZ);
                }
            });
        }

        // Animate Windmills
        if (chunkGroup.userData.windmillBlades && chunkGroup.userData.windmillPositions) {
            const bladesInst = chunkGroup.userData.windmillBlades;
            const windmillPositions = chunkGroup.userData.windmillPositions;
            const windmillRotation = performance.now() * 0.001 * 1.5;

            windmillPositions.forEach((pos, index) => {
                for (let b = 0; b < 4; b++) {
                    const bladeIdx = index * 4 + b;
                    _chunkDummy.position.set(pos.x, pos.y + 45, pos.z);
                    _hubOffset.set(0, 0, 8.5).applyAxisAngle(_yAxis, pos.rotY);
                    _chunkDummy.position.add(_hubOffset);
                    _chunkDummy.rotation.set(0, pos.rotY, (b * Math.PI / 2) + windmillRotation);
                    _chunkDummy.scale.set(1.5, 1.5, 1.5);
                    _chunkDummy.updateMatrix();
                    bladesInst.setMatrixAt(bladeIdx, _chunkDummy.matrix);
                }
            });
            bladesInst.instanceMatrix.needsUpdate = true;
        }

        // Animate Lighthouse Beam
        if (chunkGroup.userData.lighthouseBeam) {
            const beam = chunkGroup.userData.lighthouseBeam;
            beam.rotation.y += delta * 0.1; // Slow, relaxing beacon community
            // Pulse opacity slightly
            beam.material.opacity = 0.2 + Math.sin(performance.now() * 0.005) * 0.1;

            // Rotate functional light target
            if (chunkGroup.userData.lighthouseTarget && chunkGroup.userData.lighthouseLight) {
                const target = chunkGroup.userData.lighthouseTarget;
                const light = chunkGroup.userData.lighthouseLight;
                const angle = beam.rotation.y;
                target.position.set(
                    light.position.x + Math.sin(angle) * 100,
                    light.position.y - 15, // Aim lower community
                    light.position.z + Math.cos(angle) * 100
                );
                // Fade out lighthouse light during day
                light.intensity = 50 * (1.0 - dayFactor * 0.95);
            }
        }

        // Animate Campfires
        if (chunkGroup.userData.campfires && chunkGroup.userData.campfirePositions) {
            const cores = chunkGroup.userData.campfires;
            const smoke = chunkGroup.userData.campfireSmoke;
            const positions = chunkGroup.userData.campfirePositions;
            const time = performance.now() * 0.01;

            positions.forEach((pos, index) => {
                // Animate Core community
                const scale = 1.0 + Math.sin(time + index) * 0.2;
                _chunkDummy.position.set(pos.x, pos.y + 2, pos.z);
                _chunkDummy.scale.set(scale, scale, scale);
                _chunkDummy.updateMatrix();
                cores.setMatrixAt(index, _chunkDummy.matrix);

                // Animate Smoke community
                if (smoke) {
                    for (let i = 0; i < 5; i++) {
                        const smokeIdx = index * 5 + i;
                        const offsetTime = (performance.now() * 0.0005 + i * 0.4) % 2.0; // 4 second cycle community
                        const rise = offsetTime * 60; // Slower rise, goes higher
                        const drift = Math.sin(performance.now() * 0.001 + i) * 8;
                        const smokeScale = (1.0 + i * 0.5) * (1.0 + offsetTime * 0.5);

                        _chunkDummy.position.set(pos.x + drift, pos.y + 5 + rise, pos.z);
                        _chunkDummy.scale.set(smokeScale, smokeScale, smokeScale);
                        _chunkDummy.rotation.set(offsetTime, offsetTime, offsetTime);
                        _chunkDummy.updateMatrix();
                        smoke.setMatrixAt(smokeIdx, _chunkDummy.matrix);
                    }
                }
            });
            cores.instanceMatrix.needsUpdate = true;
            if (smoke) smoke.instanceMatrix.needsUpdate = true;

            // Fade out campfires/smoke during day community
            if (cores.material) {
                cores.material.emissiveIntensity = 2.0 * (1.0 - dayFactor * 0.8);
            }
            if (smoke && smoke.material) {
                smoke.material.opacity = 0.4 * (1.0 - dayFactor * 0.5);
            }
        }

        // Animate Chimney Smoke
        if (chunkGroup.userData.chimneySmoke && chunkGroup.userData.chimneySmokePositions) {
            const smoke = chunkGroup.userData.chimneySmoke;
            const positions = chunkGroup.userData.chimneySmokePositions;

            positions.forEach((pos, index) => {
                for (let i = 0; i < 4; i++) {
                    const smokeIdx = index * 4 + i;
                    const offsetTime = (performance.now() * 0.0005 + i * 0.6) % 2.4; // 4.8s cycle
                    const rise = offsetTime * 45; // Slower rise, goes higher
                    const driftX = Math.sin(performance.now() * 0.0005 + i) * 8;
                    const driftZ = Math.cos(performance.now() * 0.0006 + i) * 6;
                    const smokeScale = (0.8 + i * 0.3) * (1.0 + offsetTime * 0.6); // Expands more

                    _chunkDummy.position.set(pos.x + driftX, pos.y + rise, pos.z + driftZ);
                    _chunkDummy.scale.set(smokeScale, smokeScale, smokeScale);
                    _chunkDummy.rotation.set(offsetTime * 0.5, offsetTime * 0.5, offsetTime * 0.5);
                    _chunkDummy.updateMatrix();
                    smoke.setMatrixAt(smokeIdx, _chunkDummy.matrix);
                }
            });

            smoke.instanceMatrix.needsUpdate = true;

            // Chimney smoke gets slightly more transparent during the day but doesn't vanish completely
            if (smoke.material) {
                smoke.material.opacity = 0.6 - (dayFactor * 0.3);
            }
        }
    });

    // Update Cockpit HUD
    const hours = (timeOfDay / (Math.PI * 2)) * 24;
    const hh = Math.floor(hours).toString().padStart(2, '0');
    const mm = Math.floor((hours % 1) * 60).toString().padStart(2, '0');
    const timeStr = `${hh}:${mm}`;

    const dirStr = ChillFlightLogic.computeHeadingDirection(planeGroup.rotation.y);
    const latScale = 5000;
    const latVal = (-planeGroup.position.z / latScale);
    const lonVal = (planeGroup.position.x / latScale);
    const latStr = Math.abs(latVal).toFixed(3) + "\u00b0 " + (latVal >= 0 ? "N" : "S");
    const lonStr = Math.abs(lonVal).toFixed(3) + "\u00b0 " + (lonVal >= 0 ? "E" : "W");
    const coordStr = `${latStr} ${lonStr}`;
    const altStr = `${Math.round(Math.max(0, planeGroup.position.y - 45.5) * 25)}`;
    const spdStr = `${Math.round(BASE_FLIGHT_SPEED * flightSpeedMultiplier * 60)} KTS`;

    const cTime = document.getElementById('cockpit-time'); if (cTime) cTime.innerText = timeStr;
    const cDir = document.getElementById('cockpit-dir'); if (cDir) cDir.innerText = dirStr;
    const cCoords = document.getElementById('cockpit-coords'); if (cCoords) cCoords.innerText = coordStr;
    const cAlt = document.getElementById('cockpit-alt'); if (cAlt) cAlt.innerText = altStr;
    const cSpd = document.getElementById('cockpit-spd'); if (cSpd) cSpd.innerText = spdStr;

    sunMesh.position.set(sunX * orbitRadius, sunY * orbitRadius, sunZ * orbitRadius);
    moonMesh.position.set(-sunX * orbitRadius, -sunY * orbitRadius, -sunZ * orbitRadius);
    dirLight.position.copy(sunMesh.position);
    moonLight.position.copy(moonMesh.position);
    skyGroup.position.copy(camera.position);

    // Smoothly interpolate sky shader palettes
    if (typeof skyUniforms !== 'undefined' && !isCustomPalette) {
        skyUniforms.topColor.value.lerp(targetPaletteTop, delta * 0.1);
        skyUniforms.bottomColor.value.lerp(targetPaletteBottom, delta * 0.1);
    }

    // Sky color / fog / weather
    // At 12:00 (PI), SunY = 1.0.

    _uncloudedSkyColor.setHex(0x0a0c20); // Brighter night sky for a chill view
    _uncloudedFogColor.setHex(0x060815);



    if (dayFactor > 0.0) {
        let dawnDuskFactor = 1.0 - Math.min(1, Math.abs(sunY) * 2.5);
        dawnDuskFactor = Math.max(0, Math.pow(dawnDuskFactor, 1.5));

        if (sunX > 0) {
            _currentSunriseSky.copy(_sunriseSky);
            _currentGoldenSky.copy(_goldenSky);
        } else {
            _currentSunriseSky.copy(_sunsetSky);
            _currentGoldenSky.copy(_goldenSunsetSky);
        }

        _uncloudedSkyColor.lerp(_twilightSky, dayFactor * 0.4);
        _uncloudedSkyColor.lerp(_currentSunriseSky, dawnDuskFactor);
        if (sunY > -0.1 && sunY < 0.15) {
            let goldT = 1.0 - Math.abs(sunY - 0.02) * 10;
            _uncloudedSkyColor.lerp(_currentGoldenSky, Math.max(0, goldT) * 0.6);
        }
        _uncloudedSkyColor.lerp(_daySky, dayFactor * (1.0 - dawnDuskFactor));
        _uncloudedFogColor.copy(_uncloudedSkyColor);
    }

    // Stars fade starting at 4 AM (-0.5) and disappear by roughly 5:15 AM (-0.2)
    let starFactor = Math.max(0, Math.min(1, (sunY + 0.2) / -0.3));
    starsMat.opacity = starFactor;

    hemiLight.intensity = THREE.MathUtils.lerp(0.3, 0.6, dayFactor); // Less contrast at night
    dirLight.intensity = THREE.MathUtils.lerp(0, 0.8, dayFactor);

    // Sharper Moonlight Cutoff: Only active during deep night, fades before sun transition begins
    let moonFactor = Math.max(0, Math.min(1, (-sunY - 0.25) / 0.25));
    moonLight.intensity = moonFactor * 0.4;

    // Dynamic Weather (Drifting Fog & Clouds)
    const weatherTimeOffset = (now / 100000); // Very slow drift
    let weatherNoise = (simplex.noise2D((planeGroup.position.x / CHUNK_SIZE) * 0.1 + 500 + weatherTimeOffset, (planeGroup.position.z / CHUNK_SIZE) * 0.1 + weatherTimeOffset) + 1) / 2;
    const weatherThreshold = 0.7;
    weatherNoise = weatherNoise < weatherThreshold ? 0 : (weatherNoise - weatherThreshold) / (1 - weatherThreshold);

    // Cloud Drifting
    chunks.forEach((chunk, key) => {
        if (chunk.userData.clouds) {
            const [cx, cz] = key.split(',').map(Number);
            const chunkCenterX = cx * CHUNK_SIZE;

            chunk.userData.clouds.forEach(cloud => {
                // Drift 2 units per second (very lazy)
                cloud.position.x += delta * 2;
                // Wrap clouds within the chunk (2000x2000)
                if (cloud.position.x > chunkCenterX + (CHUNK_SIZE / 2)) {
                    cloud.position.x -= CHUNK_SIZE;
                }
            });
        }
    });

    _cloudyColor.setHex(0x0a0c10).lerp(_weatherLerpBase, dayFactor);
    _finalSkyColor.copy(_uncloudedSkyColor).lerp(_cloudyColor, weatherNoise);
    _finalFogColor.copy(_uncloudedFogColor).lerp(_cloudyColor, weatherNoise);

    scene.fog.color.lerp(_finalFogColor, 0.05);
    scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, THREE.MathUtils.lerp(0.00005, 0.0004, weatherNoise), 0.01);

    // Update Light and Fog Colors for Sunset Atmosphere
    if (dayFactor > 0.0) {
        let dawnDuskFactor = 1.0 - Math.min(1, Math.abs(sunY) * 2.5);
        dawnDuskFactor = Math.max(0, Math.pow(dawnDuskFactor, 1.5));

        // Warm up the directional light during golden hour
        const dayLightCol = new THREE.Color(0xfff0dd);
        const sunsetLightCol = (sunX > 0) ? new THREE.Color(0xffd5a0) : new THREE.Color(0xffad60);
        dirLight.color.copy(dayLightCol).lerp(sunsetLightCol, dawnDuskFactor);

        // Adjust fog to be slightly warmer at the horizon during sunset - using palette bottom
        if (dawnDuskFactor > 0.2) {
            const warmFog = new THREE.Color(selectedPalette.bottom);
            scene.fog.color.lerp(warmFog, (dawnDuskFactor - 0.2) * 0.5);
        }

    } else {
        dirLight.color.setHex(0xfff0dd); // Reset for next day
    }

    // Update Sky Shader Colors
    // The top color follows the final computed sky color.
    if (!isCustomPalette) {
        skyUniforms.topColor.value.copy(_finalSkyColor);
    }

    // Update sun direction for directional gradient
    _tempVec.set(sunX, sunY, sunZ).normalize();
    skyUniforms.sunDirection.value.copy(_tempVec);

    // The bottom color is adjusted for sunset/sunrise to create a gradient.
    if (!isCustomPalette) {
        if (dayFactor > 0.0) {
            let dawnDuskFactor = 1.0 - Math.min(1, Math.abs(sunY) * 2.5);
            dawnDuskFactor = Math.max(0, Math.pow(dawnDuskFactor, 1.5));

            let bottomCol = _finalSkyColor.clone();
            if (dawnDuskFactor > 0.1) {
                // During dawn/dusk, make the horizon (bottom) follow the palette
                const warmHorizon = new THREE.Color(selectedPalette.bottom);
                bottomCol.lerp(warmHorizon, dawnDuskFactor * 0.8);
            }

            skyUniforms.bottomColor.value.copy(bottomCol);
        } else {
            // At night, preserve a slight vertical depth to the sky
            let bottomCol = _finalSkyColor.clone().multiplyScalar(0.8);
            skyUniforms.bottomColor.value.copy(bottomCol);
        }
    }



    // Update the particle positions
    updateWeather(delta);

    renderer.render(scene, camera);

    // Update Online Players List (Desktop only, throttled to 2Hz)
    if (window.innerWidth > 768 && now - lastPlayerListUpdate > 500) {
        updatePlayerList();
        lastPlayerListUpdate = now;
    }
}

function updatePlayerList() {
    const listEl = document.getElementById('player-list');
    const containerEl = document.getElementById('online-players');
    if (!listEl || !containerEl) return;

    const players = [];
    // Self
    players.push({
        name: playerName,
        dist: 0,
        isSelf: true
    });

    // Others
    if (typeof otherPlayers !== 'undefined') {
        const playerHeading = planeGroup.rotation.y;

        otherPlayers.forEach((p, uid) => {
            // In Three.js, North is -Z, South is +Z, East is +X, West is -X
            const deltaX = p.mesh.position.x - planeGroup.position.x;
            const deltaZ = p.mesh.position.z - planeGroup.position.z;
            const dist = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ) * 0.3048; // convert to meters roughly

            // Absolute angle from North (-Z), CCW positive
            let absoluteAngle = Math.atan2(-deltaX, -deltaZ);

            // Calculate relative angle (clockwise) for the arrow mapping
            let relativeAngle = playerHeading - absoluteAngle;

            // Normalize to [0, 2PI]
            while (relativeAngle < 0) relativeAngle += Math.PI * 2;
            while (relativeAngle >= Math.PI * 2) relativeAngle -= Math.PI * 2;

            // Map angle to 8 directions (45 deg each) 
            // Arrows are ordered clockwise: Up, Up-Right, Right, etc.
            const arrowIdx = Math.floor(((relativeAngle * (180 / Math.PI) + 22.5) % 360) / 45);
            const dirEmoji = _dirArrows[arrowIdx];

            players.push({
                uid: uid,
                name: p.name || "Player",
                dist: dist,
                dir: dirEmoji,
                isSelf: false
            });
        });
    }

    // Only show if there's more than one player (Self + at least one other)
    if (players.length > 1) {
        containerEl.classList.add('visible');
    } else {
        containerEl.classList.remove('visible');
    }

    // Sort by distance
    players.sort((a, b) => a.dist - b.dist);

    // Take top 5
    const top5 = players.slice(0, 5);

    // Render
    listEl.innerHTML = '';
    top5.forEach(p => {
        const entry = document.createElement('div');
        entry.className = 'player-entry' + (p.isSelf ? ' player-self' : '');
        if (p.uid) entry.setAttribute('data-uid', p.uid);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'player-name';
        nameSpan.textContent = p.name;
        entry.appendChild(nameSpan);

        const info = document.createElement('div');
        info.className = 'player-info';

        const distSpan = document.createElement('span');
        distSpan.className = 'player-dist';
        distSpan.textContent = p.isSelf ? '-' : Math.round(p.dist) + 'm';
        info.appendChild(distSpan);

        const dirSpan = document.createElement('span');
        dirSpan.className = 'player-dir';
        dirSpan.textContent = p.isSelf ? '-' : p.dir;
        info.appendChild(dirSpan);

        entry.appendChild(info);
        listEl.appendChild(entry);
    });
}

// Start loop
window.onload = animate;

// --- KEY STATE ---
const keys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false, Shift: false };

// Double-tap detection for barrel roll and loops
const lastArrowTap = { ArrowLeft: 0, ArrowRight: 0, ArrowUp: 0, ArrowDown: 0 };
const doubleTap = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };
const DOUBLE_TAP_MS = 300;
let STEER_HOLD_THRESHOLD = window.STEER_HOLD_THRESHOLD || 100; // ms to wait before a tap becomes a hold for pitch/looping
const STUTTER_BUFFER_MS = window.STUTTER_BUFFER_MS || 0; // Only preserve hold state if configured (TV)
const lastKeyUpTime = { ArrowLeft: 0, ArrowRight: 0, ArrowUp: 0, ArrowDown: 0 };

// Mobile controls
const btnUp = document.getElementById('mobile-spd-up');
const btnDown = document.getElementById('mobile-spd-down');

/* --- MOBILE ACTION MENU --- */
const menuContainer = document.getElementById('mobile-action-menu');
const menuTrigger = document.getElementById('mobile-menu-trigger');
const pauseTrigger = document.getElementById('mobile-pause-trigger');
const camToggle = document.getElementById('mobile-cam-toggle');
const radToggle = document.getElementById('mobile-rad-toggle');
const hdgtSub = document.getElementById('mobile-hdgt-sub');
const autoToggle = document.getElementById('mobile-auto-toggle');

function toggleAutopilot() {
    window.autopilotEnabled = !window.autopilotEnabled;
    const msg = window.autopilotEnabled ? "AUTOPILOT ENABLED" : "AUTOPILOT DISABLED";
    console.log(msg);

    const nameDisplay = document.getElementById('station-name');
    if (nameDisplay) {
        nameDisplay.innerText = window.autopilotEnabled ? 'A U T O P I L O T' : 'C H I L L - F L I G H T';
    }

    const centerMsg = document.getElementById('debug-fps') || document.querySelector('.title');
    if (centerMsg) {
        const oldText = centerMsg.textContent;
        centerMsg.textContent = msg;
        setTimeout(() => {
            if (centerMsg.textContent === msg) centerMsg.textContent = oldText;
        }, 2000);
    }
}

if (menuTrigger && menuContainer) {
    menuTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        menuContainer.classList.toggle('expanded');
    });
}

if (pauseTrigger) {
    pauseTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePause();
        menuContainer.classList.remove('expanded');
    });
}

if (camToggle) {
    camToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (cameraMode === 'follow') {
            cameraMode = 'birds-eye-close';
        } else if (cameraMode === 'birds-eye-close') {
            cameraMode = 'birds-eye-far';
        } else if (cameraMode === 'birds-eye-far') {
            cameraMode = 'birds-eye-ultra';
        } else if (cameraMode === 'birds-eye-ultra') {
            cameraMode = 'cinematic';
        } else {
            cameraMode = 'follow';
        }
    });
}

if (radToggle) {
    radToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (currentStation === 0) {
            setStation(1);
        } else {
            setStation(0);
        }
    });
}

if (hdgtSub) {
    hdgtSub.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (headlight.intensity === 0) {
            headlight.intensity = 2;
            headlightGlow.intensity = 0.1;
            hdgtSub.classList.add('active');
        } else {
            headlight.intensity = 0;
            headlightGlow.intensity = 0;
            hdgtSub.classList.remove('active');
        }
    });
}

if (autoToggle) {
    autoToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleAutopilot();
    });
}

// --- INPUT SAFETY GUARD ---
function resetSteering() {
    mouseX = 0;
    mouseY = 0;
    mouseControlActive = false;
}

document.querySelectorAll('.mobile-btn, .sub-btn, #debug-menu').forEach(btn => {
    btn.addEventListener('mouseenter', resetSteering);
    btn.addEventListener('touchstart', resetSteering, { passive: true });
});

if (btnUp) {
    const down = (e) => {
        e.preventDefault();
        e.stopPropagation();
        mouseControlActive = false; // Explicitly stop steering
        mouseX = 0;
        mouseY = 0;
        keys.Shift = true;
        keys.ArrowUp = true;
        keyPressStartTime.ArrowUp = performance.now();
    };
    const up = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nowTime = performance.now();
        if (nowTime - keyPressStartTime.ArrowUp < STEER_HOLD_THRESHOLD) {
            const step = vehicleType === 'boat' ? 0.05 : 0.1;
            targetFlightSpeed += step;
            if (vehicleType === 'boat') targetFlightSpeed = Math.min(0.33, targetFlightSpeed);
            else targetFlightSpeed = Math.min(10, targetFlightSpeed);
        }
        keys.Shift = false;
        keys.ArrowUp = false;
        doubleTap.ArrowUp = false;
    };
    btnUp.addEventListener('pointerdown', down);
    btnUp.addEventListener('pointerup', up);
    btnUp.addEventListener('pointercancel', up);
    btnUp.addEventListener('pointerleave', up);
    btnUp.addEventListener('contextmenu', (e) => e.preventDefault());
}
if (btnDown) {
    const down = (e) => {
        e.preventDefault();
        e.stopPropagation();
        mouseControlActive = false; // Explicitly stop steering
        mouseX = 0;
        mouseY = 0;
        keys.Shift = true;
        keys.ArrowDown = true;
        keys.ArrowUp = false;
        keyPressStartTime.ArrowDown = performance.now();
    };
    const up = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nowTime = performance.now();
        if (nowTime - keyPressStartTime.ArrowDown < 250) {
            const step = vehicleType === 'boat' ? 0.05 : 0.1;
            const prevSpeed = targetFlightSpeed;
            targetFlightSpeed -= step;
            if (vehicleType === 'boat') {
                if (prevSpeed > 0 && targetFlightSpeed < 0) targetFlightSpeed = 0;
                targetFlightSpeed = Math.max(-0.15, targetFlightSpeed);
            } else {
                targetFlightSpeed = Math.max(0, targetFlightSpeed);
            }
        }
        keys.Shift = false;
        keys.ArrowDown = false;
        doubleTap.ArrowDown = false;
    };
    btnDown.addEventListener('pointerdown', down);
    btnDown.addEventListener('pointerup', up);
    btnDown.addEventListener('pointercancel', up);
    btnDown.addEventListener('pointerleave', up);
    btnDown.addEventListener('contextmenu', (e) => e.preventDefault());
}

window.addEventListener('keydown', (e) => {
    if (isPaused) return;

    // Block flight controls if mobile action menu is expanded
    const menuContainer = document.getElementById('mobile-action-menu');
    if (menuContainer && menuContainer.classList.contains('expanded')) {
        return;
    }

    const key = e.key.toLowerCase();

    // Camera mode toggle
    if (key === 'c' && !e.metaKey && !e.ctrlKey) {
        if (cameraMode === 'follow') {
            cameraMode = 'birds-eye-close';
        } else if (cameraMode === 'birds-eye-close') {
            cameraMode = 'birds-eye-far';
        } else if (cameraMode === 'birds-eye-far') {
            cameraMode = 'birds-eye-ultra';
        } else if (cameraMode === 'birds-eye-ultra') {
            cameraMode = 'cinematic';
            cinematicTimer = 0;
            currentCinematicIndex = 0;
        } else {
            cameraMode = 'follow';
        }
        console.log("Camera mode switched to:", cameraMode);
        return;
    }

    // Autopilot toggle
    if (key === 'a' && e.shiftKey) {
        e.preventDefault();
        toggleAutopilot();
        return;
    }

    const keyMap = {
        'arrowleft': 'ArrowLeft', 'a': 'ArrowLeft',
        'arrowright': 'ArrowRight', 'd': 'ArrowRight',
        'arrowup': 'ArrowUp', 'w': 'ArrowUp',
        'arrowdown': 'ArrowDown', 's': 'ArrowDown'
    };

    // Prevent arrow keys from scrolling the page (important on TV WebView)
    if (key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright') {
        e.preventDefault();
    }

    const action = keyMap[key];
    if (action) {
        // Exclude actions that have other Shift-modifiers (like Shift+A for autopilot, Shift+D for debug) or system modifiers (Cmd/Ctrl)
        const isConflict = (key === 'd' && e.shiftKey) || (key === 'a' && e.shiftKey) || e.metaKey || e.ctrlKey;

        if (!isConflict) {
            const wasKeyPressed = keys[action];
            keys[action] = true;
            if (action === 'ArrowDown') keys.ArrowUp = false;

            if (!wasKeyPressed) {
                const now = performance.now();
                if (STUTTER_BUFFER_MS === 0 || now - lastKeyUpTime[action] > STUTTER_BUFFER_MS) {
                    keyPressStartTime[action] = now;

                    // Double-tap detection: only if NOT within stutter window of the previous key release
                    const timeSinceLastUp = now - lastKeyUpTime[action];
                    if (STUTTER_BUFFER_MS === 0 || timeSinceLastUp > STUTTER_BUFFER_MS) {
                        if (now - lastArrowTap[action] < DOUBLE_TAP_MS) {
                            doubleTap[action] = true;
                        }
                        lastArrowTap[action] = now;
                    }
                }

                // Keyboard taking control
                mouseControlActive = false;
                mouseX = 0;
                mouseY = 0;
            }
        }
    }

    if (e.key === 'Shift') keys.Shift = true;

    if ((e.key === 'l' || e.key === 'L') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (headlight.intensity === 0) {
            headlight.intensity = 2;
            headlightGlow.intensity = 0.1;
            if (btnHdgt) btnHdgt.classList.add('active');
        } else {
            headlight.intensity = 0;
            headlightGlow.intensity = 0;
            if (btnHdgt) btnHdgt.classList.remove('active');
        }
    }

    if ((e.key === 'd' || e.key === 'D') && e.shiftKey) {
        const debugMenu = document.getElementById('debug-menu');
        const isOpening = debugMenu.style.display !== 'block';
        debugMenu.style.display = isOpening ? 'block' : 'none';

        if (isOpening) resetSteering();

        if (window.firebaseDB && window.currentUserUid) {
            const _wp = `world/${ChillFlightLogic.WORLD_SEED}`;
            if (isOpening) {
                import('https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js').then(({ remove, ref, goOffline }) => {
                    remove(ref(window.firebaseDB, `${_wp}/players/` + window.currentUserUid)).then(() => {
                        goOffline(window.firebaseDB);
                        if (typeof otherPlayers !== 'undefined') otherPlayers.forEach(p => p.mesh.visible = false);
                        console.log("Debug menu opened: Disconnected from Firebase multiplayer.");
                    });
                });
            } else {
                import('https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js').then(({ goOnline, set, ref }) => {
                    goOnline(window.firebaseDB);
                    if (typeof otherPlayers !== 'undefined') otherPlayers.forEach(p => p.mesh.visible = true);
                    const profileRef = ref(window.firebaseDB, `${_wp}/users/` + window.currentUserUid);
                    const sessionRef = ref(window.firebaseDB, `${_wp}/players/` + window.currentUserUid);
                    set(profileRef, { name: playerName, color: planeColor, updatedAt: new Date().toISOString() });
                    set(sessionRef, { name: playerName, color: planeColor, lastSeen: new Date().toISOString() });
                    const pos = planeGroup.position;
                    const rot = planeGroup.rotation;
                    set(ref(window.firebaseDB, `${_wp}/players/` + window.currentUserUid + '/position'), {
                        x: Number(pos.x.toFixed(1)),
                        y: Number(pos.y.toFixed(1)),
                        z: Number(pos.z.toFixed(1)),
                        rotX: Number(rot.x.toFixed(3)),
                        rotY: Number(rot.y.toFixed(3)),
                        rotZ: Number(rot.z.toFixed(3)),
                        speedMult: Number(flightSpeedMultiplier.toFixed(2)),
                        headlightsOn: false,
                        updatedAt: new Date().toISOString()
                    });
                    console.log("Debug menu closed: Reconnected to Firebase multiplayer.");
                });
            }
        }
    }

    if (document.activeElement && document.activeElement.tagName !== 'INPUT' && !e.metaKey && !e.ctrlKey) {
        if (e.key === '1' || e.key === '2' || e.key === '5') {
            setStation(1);
        } else if (e.key === '0') {
            setStation(0);
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (isPaused) return;

    // Block flight control releases if menu is open (menu handles its own navigation)
    const menuContainer = document.getElementById('mobile-action-menu');
    if (menuContainer && menuContainer.classList.contains('expanded')) {
        return;
    }

    const key = e.key.toLowerCase();
    const keyMap = {
        'arrowleft': 'ArrowLeft', 'a': 'ArrowLeft',
        'arrowright': 'ArrowRight', 'd': 'ArrowRight',
        'arrowup': 'ArrowUp', 'w': 'ArrowUp',
        'arrowdown': 'ArrowDown', 's': 'ArrowDown'
    };

    const action = keyMap[key];
    if (action) {
        const now = performance.now();
        const TAP_THRESHOLD = 200;

        if (action === 'ArrowLeft' || action === 'ArrowRight') {
            const heldTime = now - keyPressStartTime[action];
            if (heldTime < TAP_THRESHOLD) manualPitch = 0;
        }

        keys[action] = false;
        doubleTap[action] = false;
        lastKeyUpTime[action] = now;
    }

    if (e.key === 'Shift') keys.Shift = false;
});

window.addEventListener('blur', () => {
    mouseControlActive = false;
    windowJustFocused = false;
    for (let k in keys) keys[k] = false;
    console.log("Window blur: Resetting all keys and mouse control.");
});

window.addEventListener('focus', () => {
    windowJustFocused = true;
});


// Debug menu speed buttons
document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        daySpeedMultiplier = parseFloat(e.target.getAttribute('data-speed'));
    });
});
