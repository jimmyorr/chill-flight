// --- FIREBASE MULTIPLAYER ---
console.log("📡 Multiplayer: Script loading (Non-module mode)...");

async function startMultiplayer() {
    try {
        console.log("📡 Multiplayer: Fetching Firebase modules via dynamic import...");

        // Using dynamic imports to bypass the 401 error caused by the server's module-blocking
        const [
            { initializeApp },
            { getAnalytics },
            { getAuth, signInAnonymously },
            { getDatabase, ref, set, update, get, onValue, onDisconnect, onChildAdded, onChildChanged, onChildRemoved }
        ] = await Promise.all([
            import("https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js"),
            import("https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js"),
            import("https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js"),
            import("https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js")
        ]);

        console.log("📡 Multiplayer: Firebase modules loaded successfully.");

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

        try {
            getAnalytics(app);
        } catch (e) {
            console.warn("⚠️ Multiplayer: Analytics blocked.");
        }

        const auth = getAuth(app);
        const db = getDatabase(app);

        const packPos = (p, r, s, l, v) => `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)},${r.x.toFixed(3)},${r.y.toFixed(3)},${r.z.toFixed(3)},${s.toFixed(2)},${l ? 1 : 0},${v === 'helicopter' ? 1 : 0}`;
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

        let playerUid = null;
        let multiplayerActive = false;

        function setMultiplayerOfflineBanner(isOffline) {
            const title = document.getElementById('online-title');
            if (!title) return;
            title.textContent = isOffline ? 'OFFLINE' : 'ONLINE';
            title.style.color = isOffline ? 'rgba(255,100,100,0.7)' : '';
        }

        const connectedRef = ref(db, '.info/connected');
        onValue(connectedRef, (snap) => {
            const isConnected = snap.val() === true;
            setMultiplayerOfflineBanner(!isConnected);
            if (!isConnected && multiplayerActive) {
                otherPlayers.forEach((p) => { if (typeof scene !== 'undefined') scene.remove(p.mesh); });
                otherPlayers.clear();
            }
        });

        serverTimeOffset = 0;
        onValue(ref(db, ".info/serverTimeOffset"), (snap) => {
            serverTimeOffset = snap.val() || 0;
        });

        firebaseDB = db;


        function createOtherPlaneMesh(uid, forcedColor) {
            const group = new THREE.Group();
            const airplaneModel = new THREE.Group();
            const helicopterModel = new THREE.Group();
            group.add(airplaneModel); group.add(helicopterModel);

            const color = forcedColor !== undefined ? forcedColor : ChillFlightLogic.getPlaneColor(uid);
            const mat = createMaterial({ color: color, flatShading: true });

            // Airplane Model
            airplaneModel.add(new THREE.Mesh(new THREE.BoxGeometry(4, 4, 16), mat));
            const cp = new THREE.Mesh(windowGeo, windowMat); cp.position.set(0, 2.5, -2); airplaneModel.add(cp);
            const w = new THREE.Mesh(wingGeo, wingMat); w.position.set(0, 0, -1); airplaneModel.add(w);
            const t = new THREE.Mesh(tailGeo, wingMat); t.position.set(0, 0, 7); airplaneModel.add(t);
            const r = new THREE.Mesh(rudderGeo, mat); r.position.set(0, 2.5, 7); airplaneModel.add(r);
            const propGroup = new THREE.Group(); propGroup.position.set(0, 0, -8.5); airplaneModel.add(propGroup);
            const bladeGeo = new THREE.BoxGeometry(12, 0.4, 0.4); const bladeMat = createMaterial({ color: 0x222222 });
            const b1 = new THREE.Mesh(bladeGeo, bladeMat); const b2 = b1.clone(); b2.rotation.z = Math.PI / 2;
            propGroup.add(b1); propGroup.add(b2);

            // Helicopter Model
            helicopterModel.add(new THREE.Mesh(new THREE.BoxGeometry(5, 5, 8), mat));
            const hcp = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 3), windowMat); hcp.position.set(0, 0.5, -3); helicopterModel.add(hcp);
            const tail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 10), mat); tail.position.set(0, 1, 8); helicopterModel.add(tail);
            const mainRotor = new THREE.Group(); mainRotor.position.set(0, 3, 0); helicopterModel.add(mainRotor);
            const mb1 = new THREE.Mesh(new THREE.BoxGeometry(24, 0.2, 1.5), bladeMat); mainRotor.add(mb1);
            const mb2 = mb1.clone(); mb2.rotation.y = Math.PI / 2; mainRotor.add(mb2);

            group.userData = { airplaneModel, helicopterModel, propeller: propGroup, mainRotor };
            return group;
        }

        const loginResult = await signInAnonymously(auth);
        playerUid = loginResult.user.uid;
        multiplayerActive = true;
        currentUserUid = playerUid;
        console.log("✅ Logged in anonymously:", playerUid);

        let worldPrefix = `world/${ChillFlightLogic.WORLD_SEED}_room_1`;
        const profileRef = ref(db, `users/` + playerUid);
        const sessionRef = ref(db, `${worldPrefix}/players/` + playerUid);

        // --- INITIAL SESSION WRITE (Denormalize immediately from localStorage) ---
        update(sessionRef, {
            name: playerName,
            color: planeColor,
            lastSeen: new Date().toISOString()
        });

        // --- RESTORE PROFILE FROM FIREBASE ---
        get(profileRef).then((snapshot) => {
            if (snapshot.exists()) {
                const profile = snapshot.val();
                playerName = profile.name || playerName;
                planeColor = profile.color !== undefined ? profile.color : planeColor;
                console.log("📡 Profile restored from Firebase:", playerName);

                localStorage.setItem('chill_flight_name', playerName);
                localStorage.setItem('chill_flight_color', planeColor.toString());

                // Update UI and session again with confirmed profile data
                const nameInput = document.getElementById('player-name-input');
                if (nameInput) nameInput.value = playerName;
                const splashInput = document.getElementById('splash-name-input');
                if (splashInput) splashInput.value = playerName;
                if (typeof planeMat !== 'undefined' && planeMat) planeMat.color.setHex(planeColor);

                update(sessionRef, { name: playerName, color: planeColor });
            }
        });

        const updatePlayerProfile = () => {
            update(profileRef, { name: playerName, color: planeColor, updatedAt: new Date().toISOString() });
            update(sessionRef, { name: playerName, color: planeColor, lastSeen: new Date().toISOString() });
        };

        // --- UI WIRING ---
        const nameInput = document.getElementById('player-name-input');
        const splashInput = document.getElementById('splash-name-input');
        let nameUpdateTimeout = null;

        const handleNameChange = (e) => {
            let newName = (e.target.value || '').trim();
            playerName = newName || defaultCallsign;
            playerName = playerName.substring(0, 15);
            localStorage.setItem('chill_flight_name', playerName);

            // Sync other input if it exists
            if (e.target === nameInput && splashInput) splashInput.value = e.target.value;
            if (e.target === splashInput && nameInput) nameInput.value = e.target.value;

            // Debounce the Firebase update to prevent spamming on every keystroke
            if (nameUpdateTimeout) clearTimeout(nameUpdateTimeout);
            nameUpdateTimeout = setTimeout(() => {
                updatePlayerProfile();
            }, 500);
        };

        if (nameInput) nameInput.addEventListener('input', handleNameChange);
        if (splashInput) splashInput.addEventListener('input', handleNameChange);

        const colorOptions = document.getElementById('plane-color-options');
        if (colorOptions) {
            colorOptions.addEventListener('click', (e) => {
                if (e.target.classList.contains('color-swatch')) {
                    planeColor = parseInt(e.target.getAttribute('data-color'));
                    localStorage.setItem('chill_flight_color', planeColor.toString());
                    if (typeof planeMat !== 'undefined' && planeMat) planeMat.color.setHex(planeColor);

                    // Update swatches
                    colorOptions.querySelectorAll('.color-swatch').forEach(sw => {
                        sw.classList.toggle('active', parseInt(sw.getAttribute('data-color')) === planeColor);
                    });
                    updatePlayerProfile();
                }
            });
        }

        onDisconnect(sessionRef).remove();

        const playersRef = ref(db, `${worldPrefix}/players`);

        onChildAdded(playersRef, (snapshot) => {
            const snapKey = snapshot.key;
            if (snapKey === playerUid) return;
            const data = snapshot.val();

            // Ignore players locally if they haven't updated in over 60 seconds
            if (data.lastSeen) {
                const lastSeenTime = new Date(data.lastSeen).getTime();
                const now = Date.now() + (typeof serverTimeOffset !== 'undefined' ? serverTimeOffset : 0);
                if (now - lastSeenTime > 60000) {
                    console.log(`👻 Ignoring stale ghost player ${snapKey}...`);
                    return; // Skip adding them to the scene locally
                }
            }

            const posData = unpackPos(data.position);
            const mesh = createOtherPlaneMesh(snapKey, data.color);

            const remoteName = data.name || "Player";
            console.log(`📡 Player joined: ${remoteName} (${snapKey})`);

            if (typeof scene !== 'undefined') scene.add(mesh);
            otherPlayers.set(snapKey, {
                mesh,
                name: remoteName,
                targetPos: new THREE.Vector3(posData.x, posData.y, posData.z),
                lastReceivedMs: Date.now()
            });
        });

        onChildChanged(playersRef, (snapshot) => {
            const p = otherPlayers.get(snapshot.key);
            if (!p) return;
            const data = snapshot.val();
            const posData = unpackPos(data.position);

            p.targetPos.set(posData.x, posData.y, posData.z);
            p.mesh.position.copy(p.targetPos);
            p.lastReceivedMs = Date.now();

            if (data.name && data.name !== p.name) {
                console.log(`📡 Player renamed: ${p.name} -> ${data.name}`);
                p.name = data.name;
            }
        });

        onChildRemoved(playersRef, (snapshot) => {
            const p = otherPlayers.get(snapshot.key);
            if (p) { if (typeof scene !== 'undefined') scene.remove(p.mesh); otherPlayers.delete(snapshot.key); }
        });

        function cleanupStalePlayers() {
            const now = Date.now();
            otherPlayers.forEach((p, uid) => {
                // If we haven't received an update from this player in 60 seconds, remove them locally
                if (now - p.lastReceivedMs > 60000) {
                    console.log(`🧹 Local cleanup: Player ${uid} timed out.`);
                    if (typeof scene !== 'undefined') scene.remove(p.mesh);
                    otherPlayers.delete(uid);
                }
            });
            setTimeout(cleanupStalePlayers, 10000); // check every 10 seconds
        }
        cleanupStalePlayers();

        function sync() {
            if (typeof planeGroup !== 'undefined') {
                update(sessionRef, {
                    position: packPos(planeGroup.position, planeGroup.rotation, flightSpeedMultiplier, false, vehicleType),
                    lastSeen: new Date().toISOString()
                });
            }
            setTimeout(sync, 250);
        }
        sync();

    } catch (err) {
        console.error("❌ Multiplayer startup failed:", err);
    }
}

// Ensure game globals are ready before starting
if (typeof Capacitor !== 'undefined' && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform()) {
    document.addEventListener("deviceready", startMultiplayer, false);
} else {
    // Wait for DOM and game initialization
    if (document.readyState === 'complete') {
        startMultiplayer();
    } else {
        window.addEventListener('load', startMultiplayer);
    }
}
