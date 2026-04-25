// --- FIREBASE MULTIPLAYER ---
// This MUST be a <script type="module"> because Firebase uses ESM CDN imports.
// All game globals (planeGroup, scene, otherPlayers, etc.) are available as window globals
// because the plain <script> tags before this have run synchronously.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";
import { initializeAppCheck, ReCaptchaV3Provider, getToken } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app-check.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getDatabase, ref, set, update, get, onValue, onDisconnect, onChildAdded, onChildChanged, onChildRemoved } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

function initMultiplayer() {
    const firebaseConfig = {
        apiKey: "AIzaSyCPeDeN9w52WynaSSasPIeGYZCO7Dq6IRw",
        authDomain: "chill-flight.firebaseapp.com",
        databaseURL: "https://chill-flight-default-rtdb.firebaseio.com",
        projectId: "chill-flight",
        storageBucket: "chill-flight.firebasestorage.app",
        messagingSenderId: "164886656663",
        appId: "1:164886656663:web:249418e3fe76d60a4d1bd2",
        measurementId: "G-N6RGBLQCZ8"
    };

    const app = initializeApp(firebaseConfig);
    const analytics = getAnalytics(app);

    // App Check — reCAPTCHA v3 (site key is public; secret key stays server-side)
    const appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider('6LfyyIEsAAAAANhEtJpPFwPYSs4Egde3RHFxnokB'),
        isTokenAutoRefreshEnabled: true
    });
    getToken(appCheck)
        .then((response) => {
            console.log("✅ App Check: Verified");
        })
        .catch((err) => {
            console.error("❌ App Check: Failed", err.message);
        });
    const auth = getAuth(app);
    const db = getDatabase(app);

    // Helpers for CSV packing optimization: x,y,z,rotX,rotY,rotZ,speed,lights,vehicle
    const packPos = (p, r, s, l, v) => `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)},${r.x.toFixed(3)},${r.y.toFixed(3)},${r.z.toFixed(3)},${s.toFixed(2)},${l?1:0},${v==='helicopter'?1:0}`;
    const unpackPos = (csv) => {
        if (typeof csv !== 'string') return csv || {};
        const v = csv.split(',');
        return {
            x: parseFloat(v[0]), y: parseFloat(v[1]), z: parseFloat(v[2]),
            rotX: parseFloat(v[3]), rotY: parseFloat(v[4]), rotZ: parseFloat(v[5]),
            speedMult: parseFloat(v[6]), headlightsOn: v[7] === '1',
            vehicleType: v[8] === '1' ? 'helicopter' : 'airplane'
        };
    };

    const ENABLE_MULTIPLAYER_HEADLIGHTS = false;

    // otherPlayers must be on window so game.js (a plain script) can read it
    // Module-scoped const/let never lands on window, unlike top-level var in plain <script>s
    window.otherPlayers = new Map();
    let playerUid = null;
    let multiplayerActive = false;

    // --- OFFLINE / ONLINE INDICATOR ---
    function setMultiplayerOfflineBanner(isOffline) {
        const title = document.getElementById('online-title');
        if (!title) return;
        if (isOffline) {
            title.textContent = 'OFFLINE';
            title.style.color = 'rgba(255,100,100,0.7)';
        } else {
            title.textContent = 'ONLINE';
            title.style.color = '';
        }
    }

    // Listen to Firebase .info/connected for real-time connection state
    const connectedRef = ref(db, '.info/connected');
    onValue(connectedRef, (snap) => {
        const isConnected = snap.val() === true;
        setMultiplayerOfflineBanner(!isConnected);
        if (!isConnected && multiplayerActive) {
            // Remove all remote planes so stale players don't persist
            window.otherPlayers.forEach((p) => {
                if (typeof scene !== 'undefined') scene.remove(p.mesh);
            });
            window.otherPlayers.clear();
        }
    });

    // Also respond to browser-level network events
    window.addEventListener('offline', () => {
        console.log('Network offline — multiplayer paused.');
        setMultiplayerOfflineBanner(true);
        window.otherPlayers.forEach((p) => {
            if (typeof scene !== 'undefined') scene.remove(p.mesh);
        });
        window.otherPlayers.clear();
    });

    window.addEventListener('online', () => {
        console.log('Network online — Firebase will reconnect automatically.');
        // Firebase SDK reconnects itself; the connectedRef listener above will update the banner
    });

    // Global server offset for deterministic time
    window.serverTimeOffset = 0;
    const offsetRef = ref(db, ".info/serverTimeOffset");
    onValue(offsetRef, (snap) => {
        window.serverTimeOffset = snap.val() || 0;
    });

    // Expose DB globally for debug menu & periodic sync in game.js
    window.firebaseDB = db;

    function createOtherPlaneMesh(uid, forcedColor) {
        const group = new THREE.Group();
        const airplaneModel = new THREE.Group();
        const helicopterModel = new THREE.Group();
        group.add(airplaneModel);
        group.add(helicopterModel);

        const color = forcedColor !== undefined ? forcedColor : getPlaneColor(uid);
        const mat = createMaterial({ color: color, flatShading: true });

        // --- AIRPLANE MODEL ---
        const bodyGeo = new THREE.BoxGeometry(4, 4, 16);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.userData.isBody = true;
        airplaneModel.add(body);
        const cp = new THREE.Mesh(windowGeo, windowMat);
        cp.position.set(0, 2.5, -2);
        airplaneModel.add(cp);
        const w = new THREE.Mesh(wingGeo, wingMat);
        w.position.set(0, 0, -1);
        airplaneModel.add(w);
        const t = new THREE.Mesh(tailGeo, wingMat);
        t.position.set(0, 0, 7);
        airplaneModel.add(t);
        const r = new THREE.Mesh(rudderGeo, mat);
        r.userData.isBody = true;
        r.position.set(0, 2.5, 7);
        airplaneModel.add(r);

        const propGroup = new THREE.Group();
        propGroup.position.set(0, 0, -8.5);
        airplaneModel.add(propGroup);
        const propCenterGeo = new THREE.CylinderGeometry(0.8, 0.8, 2, 8);
        propCenterGeo.rotateX(Math.PI / 2);
        const propCenter = new THREE.Mesh(propCenterGeo, createMaterial({ color: 0x333333 }));
        propGroup.add(propCenter);
        const bladeGeo = new THREE.BoxGeometry(12, 0.4, 0.4);
        const bladeMat = createMaterial({ color: 0x222222 });
        const blade1 = new THREE.Mesh(bladeGeo, bladeMat);
        const blade2 = new THREE.Mesh(bladeGeo, bladeMat);
        blade2.rotation.z = Math.PI / 2;
        propGroup.add(blade1);
        propGroup.add(blade2);

        // --- HELICOPTER MODEL ---
        const heliBodyGeo = new THREE.BoxGeometry(5, 5, 8);
        const heliBody = new THREE.Mesh(heliBodyGeo, mat);
        heliBody.userData.isBody = true;
        helicopterModel.add(heliBody);
        const heliCockpit = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 3), windowMat);
        heliCockpit.position.set(0, 0.5, -3);
        helicopterModel.add(heliCockpit);
        const tailBoom = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 10), mat);
        tailBoom.userData.isBody = true;
        tailBoom.position.set(0, 1, 8);
        helicopterModel.add(tailBoom);

        const mainRotorGroup = new THREE.Group();
        mainRotorGroup.position.set(0, 3, 0);
        helicopterModel.add(mainRotorGroup);
        const rotorCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 8), createMaterial({ color: 0x333333 }));
        mainRotorGroup.add(rotorCenter);
        const mainBlade = new THREE.Mesh(new THREE.BoxGeometry(24, 0.2, 1.5), bladeMat);
        mainRotorGroup.add(mainBlade);
        const mainBlade2 = mainBlade.clone();
        mainBlade2.rotation.y = Math.PI / 2;
        mainRotorGroup.add(mainBlade2);

        const tailRotorGroup = new THREE.Group();
        tailRotorGroup.position.set(1.2, 1, 13);
        helicopterModel.add(tailRotorGroup);
        const tailRotorBlade = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 0.4), bladeMat);
        tailRotorBlade.rotation.y = Math.PI / 2;
        tailRotorGroup.add(tailRotorBlade);
        const tailRotorBlade2 = tailRotorBlade.clone();
        tailRotorBlade2.rotation.x = Math.PI / 2;
        tailRotorGroup.add(tailRotorBlade2);

        const skidMat = createMaterial({ color: 0x333333 });
        const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 10), skidMat);
        skidL.position.set(-2.5, -3.5, 0);
        helicopterModel.add(skidL);
        const skidR = skidL.clone();
        skidR.position.x = 2.5;
        helicopterModel.add(skidR);

        let headlight = null;
        let headlightGlow = null;

        if (ENABLE_MULTIPLAYER_HEADLIGHTS) {
            headlight = new THREE.SpotLight(0xffd1a3, 0);
            headlight.position.set(0, 0, -10);
            const headlightTarget = new THREE.Object3D();
            headlightTarget.position.set(0, -20, -100);
            group.add(headlightTarget);
            headlight.target = headlightTarget;
            headlight.angle = Math.PI / 4;
            headlight.penumbra = 1.0;
            headlight.distance = 1500;
            headlight.decay = 2.0;
            headlightGlow = new THREE.PointLight(0xffd1a3, 0, 50);
            headlightGlow.position.set(0, 5, 0);
            group.add(headlightGlow);
            group.add(headlight);
        }

        group.userData = {
            airplaneModel,
            helicopterModel,
            headlight,
            headlightGlow,
            propeller: propGroup,
            mainRotor: mainRotorGroup,
            tailRotor: tailRotorGroup
        };

        return group;
    }

    signInAnonymously(auth)
        .then(async (result) => {
            playerUid = result.user.uid;
            multiplayerActive = true;
            window.currentUserUid = playerUid;
            console.log("Logged in anonymously! ID:", playerUid);

            let worldPrefix;
            let roomIndex = 1;

            async function findAvailableRoom(baseSeed) {
                console.log(`🔎 Finding available room for seed: ${baseSeed}...`);
                while (true) {
                    const testPrefix = `world/${baseSeed}_room_${roomIndex}`;
                    const playersRef = ref(db, `${testPrefix}/players`);
                    try {
                        const snapshot = await get(playersRef);
                        let count = 0;
                        if (snapshot.exists()) {
                            const players = snapshot.val();
                            const now = new Date();
                            for (const uid in players) {
                                const lastSeen = players[uid].lastSeen;
                                if (lastSeen) {
                                    const lastSeenDate = new Date(lastSeen);
                                    if (now - lastSeenDate < 60000) { // Only count if seen in last 60 seconds
                                        count++;
                                    }
                                } else {
                                    // If no lastSeen, assume they are active for now (new player)
                                    count++;
                                }
                            }
                        }
                        console.log(`🏠 Checking Room ${roomIndex} (${testPrefix}): ${count} active players`);
                        if (count < 10) {
                            console.log(`✅ Joined Room ${roomIndex}`);
                            return { testPrefix, roomIndex };
                        }
                    } catch (err) {
                        console.error("❌ Room check failed:", err);
                        return { testPrefix, roomIndex }; // Fallback to current if query fails
                    }
                    roomIndex++;
                }
            }

            const roomData = await findAvailableRoom(ChillFlightLogic.WORLD_SEED);
            worldPrefix = roomData.testPrefix;
            roomIndex = roomData.roomIndex;

            // Update UI with Room Number
            const title = document.getElementById('online-title');
            if (title) {
                title.textContent = `ONLINE - RM ${roomIndex}`;
                title.style.color = '';
            }

            if (planeMat) {
                if (!hasSavedColor) {
                    planeColor = getPlaneColor(playerUid);
                }
                planeMat.color.setHex(planeColor);

                const nameInput = document.getElementById('player-name-input');
                if (nameInput) nameInput.value = playerName;
            }

            const profileRef = ref(db, `users/` + playerUid);
            const sessionRef = ref(db, `${worldPrefix}/players/` + playerUid);

            const updatePlayerProfile = () => {
                update(profileRef, {
                    name: playerName,
                    color: planeColor,
                    updatedAt: new Date().toISOString()
                });
                update(sessionRef, {
                    name: playerName,
                    color: planeColor,
                    lastSeen: new Date().toISOString()
                });
            };
            window.updatePlayerProfile = updatePlayerProfile;

            get(profileRef).then((snapshot) => {
                if (snapshot.exists()) {
                    const profile = snapshot.val();
                    playerName = profile.name || playerName;
                    planeColor = profile.color !== undefined ? profile.color : planeColor;
                    console.log("Profile restored from Firebase:", playerName);
                    localStorage.setItem('chill_flight_name', playerName);
                    localStorage.setItem('chill_flight_color', planeColor.toString());
                } else {
                    console.log("No Firebase profile found, using local defaults.");
                }

                if (planeMat) {
                    planeMat.color.setHex(planeColor);
                    const nameInput = document.getElementById('player-name-input');
                    if (nameInput) nameInput.value = playerName;
                }

                updateActiveSwatch();
                updatePlayerProfile();
            });

            const nameInput = document.getElementById('player-name-input');
            const colorOptions = document.getElementById('plane-color-options');

            const updateActiveSwatch = () => {
                if (!colorOptions) return;
                colorOptions.querySelectorAll('.color-swatch').forEach(sw => {
                    const swColor = parseInt(sw.getAttribute('data-color'));
                    if (swColor === planeColor) {
                        sw.classList.add('active');
                    } else {
                        sw.classList.remove('active');
                    }
                });
            };

            // Initial UI sync
            updateActiveSwatch();

            if (nameInput) {
                nameInput.addEventListener('input', (e) => {
                    playerName = e.target.value || window.defaultCallsign;
                    localStorage.setItem('chill_flight_name', playerName);
                    updatePlayerProfile();
                });

                nameInput.addEventListener('blur', (e) => {
                    if (!e.target.value.trim()) {
                        e.target.value = window.defaultCallsign;
                        playerName = window.defaultCallsign;
                        localStorage.setItem('chill_flight_name', playerName);
                        updatePlayerProfile();
                    }
                });
            }

            if (colorOptions) {
                colorOptions.addEventListener('click', (e) => {
                    if (e.target.classList.contains('color-swatch')) {
                        planeColor = parseInt(e.target.getAttribute('data-color'));
                        localStorage.setItem('chill_flight_color', planeColor.toString());
                        if (planeMat) {
                            planeMat.color.setHex(planeColor);
                        }
                        updateActiveSwatch();
                        updatePlayerProfile();
                    }
                });
            }

            onDisconnect(sessionRef).remove();

            const initialPos = planeGroup.position;
            const initialRot = planeGroup.rotation;
            update(sessionRef, {
                position: packPos(initialPos, initialRot, flightSpeedMultiplier, false, vehicleType),
                lastSeen: new Date().toISOString()
            });

            const playersRef = ref(db, `${worldPrefix}/players`);
            onChildAdded(playersRef, (snapshot) => {
                const snapKey = snapshot.key;
                if (snapKey === playerUid) return;

                const data = snapshot.val();
                const posData = unpackPos(data.position);

                if (posData.x === undefined || isNaN(posData.x)) return;

                if (otherPlayers.has(snapKey)) {
                    const oldP = otherPlayers.get(snapKey);
                    scene.remove(oldP.mesh);
                    otherPlayers.delete(snapKey);
                }

                const mesh = createOtherPlaneMesh(snapKey, data.color);

                // Toggle model visibility
                mesh.userData.airplaneModel.visible = (posData.vehicleType === 'airplane');
                mesh.userData.helicopterModel.visible = (posData.vehicleType === 'helicopter');

                if (ENABLE_MULTIPLAYER_HEADLIGHTS && mesh.userData.headlight) {
                    const isLightsOn = posData.headlightsOn || false;
                    mesh.userData.headlight.intensity = isLightsOn ? 2 : 0;
                    mesh.userData.headlightGlow.intensity = isLightsOn ? 0.1 : 0;
                }

                scene.add(mesh);
                otherPlayers.set(snapshot.key, {
                    mesh,
                    name: data.name || "Player",
                    targetPos: new THREE.Vector3(posData.x || 0, posData.y || 200, posData.z || 0),
                    targetRotX: posData.rotX || 0,
                    targetRotY: posData.rotY || 0,
                    targetRotZ: posData.rotZ || 0,
                    targetSpeedMult: posData.speedMult !== undefined ? posData.speedMult : 1,
                    targetVehicleType: posData.vehicleType,
                    targetQuat: new THREE.Quaternion(),
                    lastReceivedMs: Date.now(),
                    stateBuffer: [{
                        timestamp: Date.now(),
                        pos: new THREE.Vector3(posData.x || 0, posData.y || 200, posData.z || 0),
                        rotX: posData.rotX || 0,
                        rotY: posData.rotY || 0,
                        rotZ: posData.rotZ || 0,
                        speedMult: posData.speedMult !== undefined ? posData.speedMult : 1
                    }]
                });
            });

            onChildChanged(playersRef, (snapshot) => {
                const snapKey = snapshot.key;
                if (snapKey === playerUid) return;
                const data = snapshot.val();
                const p = otherPlayers.get(snapKey);

                if (!p) return;

                if (data.color !== undefined) {
                    p.mesh.traverse(child => {
                        if (child.isMesh && child.userData.isBody) {
                            if (child.material && child.material.color) {
                                child.material.color.setHex(data.color);
                            }
                        }
                    });
                }

                if (data.name) p.name = data.name;

                if (data.position) {
                    const posData = unpackPos(data.position);
                    p.lastReceivedMs = Date.now();

                    // Update targets
                    p.targetRotX = posData.rotX || 0;
                    p.targetRotY = posData.rotY || 0;
                    p.targetRotZ = posData.rotZ || 0;
                    p.targetSpeedMult = posData.speedMult !== undefined ? posData.speedMult : 1;
                    p.targetPos.set(posData.x || 0, posData.y || 200, posData.z || 0);
                    p.targetVehicleType = posData.vehicleType;

                    if (!p.stateBuffer) p.stateBuffer = [];
                    p.stateBuffer.push({
                        timestamp: Date.now(),
                        pos: new THREE.Vector3(posData.x || 0, posData.y || 200, posData.z || 0),
                        rotX: posData.rotX || 0,
                        rotY: posData.rotY || 0,
                        rotZ: posData.rotZ || 0,
                        speedMult: posData.speedMult !== undefined ? posData.speedMult : 1
                    });
                    if (p.stateBuffer.length > 20) p.stateBuffer.shift();

                    // Toggle model visibility
                    p.mesh.userData.airplaneModel.visible = (p.targetVehicleType === 'airplane');
                    p.mesh.userData.helicopterModel.visible = (p.targetVehicleType === 'helicopter');

                    if (ENABLE_MULTIPLAYER_HEADLIGHTS && p.mesh.userData.headlight) {
                        const isLightsOn = posData.headlightsOn || false;
                        p.mesh.userData.headlight.intensity = isLightsOn ? 2 : 0;
                        p.mesh.userData.headlightGlow.intensity = isLightsOn ? 0.1 : 0;
                    }
                }
            });

            onChildRemoved(playersRef, (snapshot) => {
                const p = otherPlayers.get(snapshot.key);
                if (p) {
                    scene.remove(p.mesh);
                    otherPlayers.delete(snapshot.key);
                }
            });

            // Local GC: remove stale players after 10 seconds
            setInterval(() => {
                const now = Date.now();
                const expirationTime = 10000;
                otherPlayers.forEach((p, key) => {
                    if (now - p.lastReceivedMs > expirationTime) {
                        console.log("Removing inactive player locally:", key);
                        scene.remove(p.mesh);
                        otherPlayers.delete(key);
                    }
                });
            }, 5000);
 
            // State for Adaptive Thresholds
            let lastSentPos = new THREE.Vector3();
            let lastSentRot = new THREE.Euler();
            let lastSentSpeed = 0;
            let lastSentLights = false;
            let hasSentInitial = false;
            let lastSyncTime = Date.now();

            function scheduleNextSync() {
                if (!navigator.onLine || !window.firebaseDB) {
                    setTimeout(scheduleNextSync, 1000);
                    return;
                }

                const debugMenu = document.getElementById('debug-menu');
                if (debugMenu && debugMenu.style.display === 'block') {
                    setTimeout(scheduleNextSync, 1000);
                    return;
                }

                // 1. Determine tickRate
                let tickRate = 5000; // Stopped (Heartbeat)
                const isSteering = typeof keys !== 'undefined' && (keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight);
                
                if (isSteering) {
                    tickRate = 100; // 10Hz maneuvering
                } else if (flightSpeedMultiplier > 0) {
                    tickRate = 250; // 4Hz straight flight
                }

                // 2. Evaluate movement thresholds or heartbeat
                const pos = planeGroup.position;
                const rot = planeGroup.rotation;

                let headlightsOn = false;
                planeGroup.children.forEach(c => {
                    if (c.type === 'SpotLight' && c.intensity > 0) headlightsOn = true;
                });

                const distMoved = pos.distanceTo(lastSentPos);
                const rotChanged = Math.abs(rot.x - lastSentRot.x) + Math.abs(rot.y - lastSentRot.y) + Math.abs(rot.z - lastSentRot.z);
                const speedChanged = Math.abs(flightSpeedMultiplier - lastSentSpeed) > 0.01;
                const lightsChanged = headlightsOn !== lastSentLights;
                const vehicleChanged = vehicleType !== window.lastSentVehicle;
                const isHeartbeat = (Date.now() - lastSyncTime) >= 5000;

                // Thresholds: distance > 2.0 or rotation > 0.02 (total angular change)
                if (!hasSentInitial || distMoved > 2.0 || rotChanged > 0.02 || speedChanged || lightsChanged || vehicleChanged || isHeartbeat) {
                    update(sessionRef, {
                        position: packPos(pos, rot, flightSpeedMultiplier, headlightsOn, vehicleType),
                        lastSeen: new Date().toISOString()
                    });
                    
                    lastSentPos.copy(pos);
                    lastSentRot.copy(rot);
                    lastSentSpeed = flightSpeedMultiplier;
                    lastSentLights = headlightsOn;
                    window.lastSentVehicle = vehicleType;
                    hasSentInitial = true;
                    lastSyncTime = Date.now();
                }

                setTimeout(scheduleNextSync, tickRate);
                }

                // Start the sync loop
                scheduleNextSync();
                })
        .catch((error) => {
            console.warn("Firebase auth failed (offline or config error):", error.code || error.message);
            setMultiplayerOfflineBanner(true);
            // Game continues without multiplayer — no crash
        });
} // End initMultiplayer

if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
    document.addEventListener("deviceready", initMultiplayer, false);
} else {
    // Browser fallback
    initMultiplayer();
}
