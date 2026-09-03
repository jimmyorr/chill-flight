class InputManager {
  constructor() {
    this.state = {
      keys: {
        ArrowUp: false,
        ArrowDown: false,
        ArrowLeft: false,
        ArrowRight: false,
        Shift: false,
        Plus: false,
        Minus: false,
        Q: false,
        E: false,
      },
      doubleTap: {},
      tripleTap: {},
      mouse: {
        x: 0,
        y: 0,
        controlActive: false,
      },
      joystick: {
        active: false,
        startX: 0,
        startY: 0,
        touchId: null,
      },
      freeCam: {
        dragging: false,
        deltaX: 0,
        deltaY: 0,
      },
      touch: {
        steeringId: null,
      },
      gyro: {
        active: false,
      },
      gamepad: {
        x: 0,
        y: 0,
      },
      controlScheme:
        localStorage.getItem('chill_flight_control_scheme') || 'joystick',
      isPaused: false, // Set from game.js
      isFreeCamera: false, // Set from game.js
    };

    // Internal timing for double-taps
    this._lastKeyUpTime = {};
    this._lastArrowTap = {};
    this._tapCount = {};
    this._keyPressStartTime = {
      ArrowLeft: 0,
      ArrowRight: 0,
      ArrowUp: 0,
      ArrowDown: 0,
    };
    this.STUTTER_BUFFER_MS = 50; // Constants from game.js
    this.DOUBLE_TAP_MS = 300;
    this.JOYSTICK_MAX_RADIUS = 50;
    this.JOYSTICK_SENSITIVITY = 0.5;
    this._windowJustFocused = false;

    // Callbacks for specific actions (set by game.js)
    this.onCameraToggle = null;
    this.onAutopilotToggle = null;
    this.onHeadlightToggle = null;
    this.onDebugToggle = null;
    this.onRainbowToggle = null;
    this.onShootingStarToggle = null;
    this.onWeatherToggle = null;

    this.initListeners();
  }

  initListeners() {
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('keyup', this.handleKeyUp.bind(this));
    window.addEventListener('blur', this.handleBlur.bind(this));
    window.addEventListener('focus', this.handleFocus.bind(this));

    // Mouse
    window.addEventListener('mousedown', this.handleMouseDown.bind(this));
    window.addEventListener('mouseup', this.handleMouseUp.bind(this));
    window.addEventListener('mousemove', this.handleMouseMove.bind(this));
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch
    window.addEventListener('touchstart', this.handleTouchStart.bind(this), {
      passive: false,
    });
    window.addEventListener('touchmove', this.handleTouchMove.bind(this), {
      passive: false,
    });
    window.addEventListener('touchend', this.handleTouchEnd.bind(this));

    // Gyro
    window.addEventListener(
      'deviceorientation',
      this.handleDeviceOrientation.bind(this)
    );
  }

  handleKeyDown(e) {
    if (this.state.isPaused) return;

    // Block flight controls if mobile action menu is expanded
    const menuContainer = document.getElementById('mobile-action-menu');
    if (menuContainer && menuContainer.classList.contains('expanded')) return;

    const key = e.key.toLowerCase();

    // Specific Action Hotkeys
    if (key === 's' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      if (this.onShootingStarToggle) this.onShootingStarToggle();
      return;
    }
    if (key === 'u' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      if (this.onRainbowToggle) this.onRainbowToggle();
      return;
    }
    if (key === 'c' && !e.metaKey && !e.ctrlKey) {
      if (this.onCameraToggle) this.onCameraToggle();
      return;
    }
    if (key === 'a' && e.shiftKey) {
      e.preventDefault();
      if (this.onAutopilotToggle) this.onAutopilotToggle();
      return;
    }
    if (
      (e.key === 'l' || e.key === 'L') &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey
    ) {
      if (this.onHeadlightToggle) this.onHeadlightToggle();
      return;
    }
    if (
      (e.key === 'd' || e.key === 'D') &&
      e.shiftKey &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey
    ) {
      if (this.onDebugToggle) this.onDebugToggle();
      return;
    }
    if (key === 'g') {
      if (this.onWeatherToggle) this.onWeatherToggle();
    }

    const keyMap = {
      arrowleft: 'ArrowLeft',
      a: 'ArrowLeft',
      arrowright: 'ArrowRight',
      d: 'ArrowRight',
      arrowup: 'ArrowUp',
      w: 'ArrowUp',
      arrowdown: 'ArrowDown',
      s: 'ArrowDown',
    };

    if (
      key === 'arrowup' ||
      key === 'arrowdown' ||
      key === 'arrowleft' ||
      key === 'arrowright'
    ) {
      e.preventDefault();
    }

    const action = keyMap[key];
    if (action) {
      const isConflict =
        (key === 'd' && e.shiftKey) ||
        (key === 'a' && e.shiftKey) ||
        e.metaKey ||
        e.ctrlKey;
      if (!isConflict) {
        const wasKeyPressed = this.state.keys[action];
        this.state.keys[action] = true;
        if (action === 'ArrowDown') this.state.keys.ArrowUp = false;

        if (!wasKeyPressed) {
          const now = performance.now();
          if (
            this.STUTTER_BUFFER_MS === 0 ||
            now - (this._lastKeyUpTime[action] || 0) > this.STUTTER_BUFFER_MS
          ) {
            this._keyPressStartTime[action] = now;

            const timeSinceLastUp = now - (this._lastKeyUpTime[action] || 0);
            if (
              this.STUTTER_BUFFER_MS === 0 ||
              timeSinceLastUp > this.STUTTER_BUFFER_MS
            ) {
              if (
                now - (this._lastArrowTap[action] || 0) <
                this.DOUBLE_TAP_MS
              ) {
                this._tapCount[action] = (this._tapCount[action] || 0) + 1;
              } else {
                this._tapCount[action] = 1;
              }

              if (this._tapCount[action] === 2) {
                this.state.doubleTap[action] = true;
              } else if (this._tapCount[action] >= 3) {
                this.state.tripleTap[action] = true;
              }
              this._lastArrowTap[action] = now;
            }
          }

          this.state.mouse.controlActive = false;
          this.state.mouse.x = 0;
          this.state.mouse.y = 0;
        }
      }
    }

    if (e.key === 'Shift') this.state.keys.Shift = true;
    if (e.key === '+' || e.key === '=') this.state.keys.Plus = true;
    if (e.key === '-' || e.key === '_') this.state.keys.Minus = true;
    if (key === 'q') this.state.keys.Q = true;
    if (key === 'e') this.state.keys.E = true;
  }

  handleKeyUp(e) {
    const key = e.key.toLowerCase();
    const keyMap = {
      arrowleft: 'ArrowLeft',
      a: 'ArrowLeft',
      arrowright: 'ArrowRight',
      d: 'ArrowRight',
      arrowup: 'ArrowUp',
      w: 'ArrowUp',
      arrowdown: 'ArrowDown',
      s: 'ArrowDown',
    };

    if (
      key === 'arrowup' ||
      key === 'arrowdown' ||
      key === 'arrowleft' ||
      key === 'arrowright'
    ) {
      e.preventDefault();
    }

    const action = keyMap[key];
    if (action) {
      this.state.keys[action] = false;
      this._lastKeyUpTime[action] = performance.now();
    }

    if (e.key === 'Shift') this.state.keys.Shift = false;
    if (e.key === '+' || e.key === '=') this.state.keys.Plus = false;
    if (e.key === '-' || e.key === '_') this.state.keys.Minus = false;
    if (key === 'q') this.state.keys.Q = false;
    if (key === 'e') this.state.keys.E = false;
  }

  handleBlur() {
    this.state.keys.ArrowUp =
      this.state.keys.ArrowDown =
      this.state.keys.ArrowLeft =
      this.state.keys.ArrowRight =
        false;
    this.state.keys.Shift = false;
    this.state.keys.Plus = false;
    this.state.keys.Minus = false;
    this.state.keys.Q = false;
    this.state.keys.E = false;

    this.state.doubleTap = {};
    this.state.tripleTap = {};
    this._tapCount = {};
  }

  handleFocus() {
    this._windowJustFocused = true;
  }

  handleMouseDown(e) {
    if (this.state.isFreeCamera) {
      if (
        !e.target.closest('#loading-overlay') &&
        !e.target.closest('#cockpit-ui') &&
        !e.target.closest('#debug-menu') &&
        !e.target.closest('#debug-telemetry') &&
        !e.target.closest('.title') &&
        !e.target.closest('#mobile-controls') &&
        !e.target.closest('#online-players')
      ) {
        this.state.freeCam.dragging = true;
      }
    }
  }

  handleMouseUp() {
    this.state.freeCam.dragging = false;
  }

  handleMouseMove(e) {
    if (this.state.isPaused) return;

    if (this.state.freeCam.dragging && this.state.isFreeCamera) {
      this.state.freeCam.deltaX += e.movementX || 0;
      this.state.freeCam.deltaY += e.movementY || 0;
    }

    if (!this.state.isFreeCamera) {
      if (this._windowJustFocused) {
        this._windowJustFocused = false;
        return;
      }
      this.state.mouse.controlActive = true;
      // Clear movement keys
      this.state.keys.ArrowUp =
        this.state.keys.ArrowDown =
        this.state.keys.ArrowLeft =
        this.state.keys.ArrowRight =
          false;

      const rect = document.body.getBoundingClientRect();
      this.state.mouse.x = (e.clientX / rect.width) * 2 - 1;
      this.state.mouse.y = -(e.clientY / rect.height) * 2 + 1;
    }
  }

  handleTouchStart(e) {
    if (this.state.isFreeCamera || this.state.isPaused) return;

    // Ignore UI touches
    if (
      e.target.closest('#cockpit-ui') ||
      e.target.closest('#mobile-controls') ||
      e.target.closest('#debug-menu')
    )
      return;

    // Check if this is a touch on the native action menu which shouldn't steer
    const menuContainer = document.getElementById('mobile-action-menu');
    if (menuContainer && menuContainer.contains(e.target)) return;

    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (
        this.state.controlScheme === 'joystick' &&
        !this.state.joystick.active
      ) {
        this.state.joystick.active = true;
        this.state.joystick.touchId = t.identifier;
        this.state.joystick.startX = t.clientX;
        this.state.joystick.startY = t.clientY;
        this.state.mouse.controlActive = true;
      } else if (
        this.state.controlScheme === 'touch' &&
        this.state.touch.steeringId === null
      ) {
        this.state.touch.steeringId = t.identifier;
        this.state.mouse.controlActive = true;

        const rect = document.body.getBoundingClientRect();
        this.state.mouse.x = (t.clientX / rect.width) * 2 - 1;
        this.state.mouse.y = -(t.clientY / rect.height) * 2 + 1;
      }
    }
  }

  handleTouchMove(e) {
    if (this.state.isFreeCamera || this.state.isPaused) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];

      if (
        this.state.controlScheme === 'joystick' &&
        this.state.joystick.active &&
        t.identifier === this.state.joystick.touchId
      ) {
        e.preventDefault();
        let dx = t.clientX - this.state.joystick.startX;
        let dy = t.clientY - this.state.joystick.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > this.JOYSTICK_MAX_RADIUS) {
          dx = (dx / dist) * this.JOYSTICK_MAX_RADIUS;
          dy = (dy / dist) * this.JOYSTICK_MAX_RADIUS;
        }

        this.state.mouse.x =
          (dx / this.JOYSTICK_MAX_RADIUS) * this.JOYSTICK_SENSITIVITY;
        this.state.mouse.y =
          -(dy / this.JOYSTICK_MAX_RADIUS) * this.JOYSTICK_SENSITIVITY;
      } else if (
        this.state.controlScheme === 'touch' &&
        t.identifier === this.state.touch.steeringId
      ) {
        e.preventDefault();
        const rect = document.body.getBoundingClientRect();
        this.state.mouse.x = (t.clientX / rect.width) * 2 - 1;
        this.state.mouse.y = -(t.clientY / rect.height) * 2 + 1;
      }
    }
  }

  handleTouchEnd(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];

      if (
        this.state.joystick.active &&
        t.identifier === this.state.joystick.touchId
      ) {
        this.state.joystick.active = false;
        this.state.joystick.touchId = null;
        this.state.mouse.x = 0;
        this.state.mouse.y = 0;
      }

      if (t.identifier === this.state.touch.steeringId) {
        this.state.touch.steeringId = null;
        this.state.mouse.x = 0;
        this.state.mouse.y = 0;
      }
    }
  }

  handleDeviceOrientation(event) {
    if (this.state.controlScheme !== 'gyro' || this.state.isPaused) return;

    let beta = event.beta;
    let gamma = event.gamma;

    if (beta === null || gamma === null) return;

    let roll = 0;
    let pitch = 0;
    const isLandscape = window.innerWidth > window.innerHeight;

    if (isLandscape) {
      roll = beta;
      pitch = gamma;
      if (
        window.screen &&
        window.screen.orientation &&
        window.screen.orientation.type === 'landscape-secondary'
      ) {
        roll = -roll;
        pitch = -pitch;
      } else if (
        typeof window.orientation !== 'undefined' &&
        window.orientation === -90
      ) {
        roll = -roll;
        pitch = -pitch;
      }
    } else {
      roll = gamma;
      pitch = beta;
    }

    if (pitch > 90) pitch = 90;
    if (pitch < -90) pitch = -90;

    const pitchOffset = isLandscape ? 0 : 45;
    pitch = pitch - pitchOffset;

    let normPitch = pitch / 45;
    let normRoll = roll / 45;

    normPitch = Math.max(-1, Math.min(1, normPitch));
    normRoll = Math.max(-1, Math.min(1, normRoll));

    const deadzone = 0.05;
    if (Math.abs(normPitch) < deadzone) normPitch = 0;
    if (Math.abs(normRoll) < deadzone) normRoll = 0;

    // Gyro maps directly to mouseX/mouseY
    this.state.mouse.x = normRoll;
    this.state.mouse.y = -normPitch;
  }

  pollGamepad() {
    if (this.state.isPaused) return;
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

    let gpX = 0,
      gpY = 0;

    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp) {
        // Left stick
        const axisX = gp.axes[0];
        const axisY = gp.axes[1];

        // D-Pad
        const dpadUp = gp.buttons[12]?.pressed;
        const dpadDown = gp.buttons[13]?.pressed;
        const dpadLeft = gp.buttons[14]?.pressed;
        const dpadRight = gp.buttons[15]?.pressed;

        const deadzone = 0.15;

        if (Math.abs(axisX) > deadzone) gpX = axisX;
        if (Math.abs(axisY) > deadzone) gpY = -axisY;

        if (dpadUp) gpY = 1;
        if (dpadDown) gpY = -1;
        if (dpadLeft) gpX = -1;
        if (dpadRight) gpX = 1;

        if (gpX !== 0 || gpY !== 0) {
          this.state.mouse.controlActive = false;
          this.state.mouse.x = 0;
          this.state.mouse.y = 0;
        }
      }
    }

    this.state.gamepad.x = gpX;
    this.state.gamepad.y = gpY;
  }

  consumeDoubleTap(action) {
    if (this.state.doubleTap[action]) {
      this.state.doubleTap[action] = false;
      return true;
    }
    return false;
  }
}

window.InputManager = InputManager;
