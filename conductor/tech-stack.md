# Technology Stack: Chill Flight

## 1. Programming Language: JavaScript (ES6)
- The core of the project is written in vanilla JavaScript (ES6+), utilizing the latest features while ensuring broad platform compatibility.
- Non-module script tags are primarily used for general game logic, while `multiplayer.js` utilizes ES Modules for Firebase interaction.

## 2. Frontend & Graphics: Three.js
- **Three.js**: The primary 3D graphics engine, used for all rendering, lighting, and terrain generation.
- **Low-Poly Models**: All game assets (planes, landscape elements) are designed with a low-poly aesthetic to prioritize performance and a consistent visual style.
- **Dynamic Terrain**: Procedural terrain generation logic is implemented in `terrain.js` and `noise.js`.

## 3. Backend & Multiplayer: Firebase
- **Firebase Realtime Database**: Used for low-latency synchronization of player position, rotation, and flight speed.
- **Firebase Auth**: Enables anonymous authentication for persistent player identities and data tracking.
- **Firebase App Check**: Ensures that only authorized clients (using reCAPTCHA v3) can interact with the Firebase backend.
- **Firebase Analytics**: Tracks user engagement and performance metrics.

## 4. Cross-platform Framework: Capacitor
- **Capacitor**: The cross-platform bridge for deploying the web application as native Android and iOS apps.
- **Capacitor Config**: The project utilizes `capacitor.config.json` for managing platform-specific configurations.
- **Platform-Specific Scripts**: `native-adapter.js` handles any necessary abstractions between web and native environments.

## 5. Audio & Media Integration: YouTube
- **YouTube IFrame API**: Integrated directly into the cockpit UI to provide a personalized, in-game radio experience.
- **Minimalist Audio**: No engine sound or procedural ambient audio is currently used, prioritizing the user's selected soundtrack.

## 6. Target Environments
- **Web**: Primary development and distribution target.
- **Mobile (Android/iOS)**: Deployed using Capacitor for a native-like experience.
- **Android TV**: Supported via Capacitor and the specific `build:tv` script.
