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
      doubleTap: {
        ArrowUp: false,
        ArrowDown: false,
        ArrowLeft: false,
        ArrowRight: false,
      },
      tripleTap: {
        ArrowUp: false,
        ArrowDown: false,
        ArrowLeft: false,
        ArrowRight: false,
      },
      keyPressStartTime: {
        ArrowLeft: 0,
        ArrowRight: 0,
        ArrowUp: 0,
        ArrowDown: 0,
      },
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
        steeringActive: false,
      },
      controlScheme:
        localStorage.getItem('chill_flight_control_scheme') || 'joystick',
      isPaused: false, // Updated every frame from game.js
      isFreeCamera: false, // Updated every frame from game.js
    };

    // Internal timing for double-taps
    this._lastKeyUpTime = {
      ArrowLeft: 0,
      ArrowRight: 0,
      ArrowUp: 0,
      ArrowDown: 0,
    };
    this._lastArrowTap = {
      ArrowLeft: 0,
      ArrowRight: 0,
      ArrowUp: 0,
      ArrowDown: 0,
    };
    this._tapCount = {
      ArrowLeft: 0,
      ArrowRight: 0,
      ArrowUp: 0,
      ArrowDown: 0,
    };
    this.DOUBLE_TAP_MS = 400;
    this.JOYSTICK_MAX_RADIUS = 50;
    this.JOYSTICK_SENSITIVITY = 0.5;
    this._windowJustFocused = false;

    // Mobile gesture tracking (for on-screen swipe/double-tap zones)
    this._activeGestureTouchId = null;
    this._activeGestureAction = null;
    this._lastFreeCamTouchX = 0;
    this._lastFreeCamTouchY = 0;

    // Gamepad state latches
    this._gamepadPauseLatched = false;
    this._lastGamepadButtons = [];

    // Callbacks for high-level actions (hooked by game.js)
    this.onCameraToggle = null;
    this.onAutopilotToggle = null;
    this.onHeadlightToggle = null;
    this.onDebugToggle = null;
    this.onRainbowToggle = null;
    this.onShootingStarToggle = null;
    this.onWeatherToggle = null;
    this.onPauseToggle = null;
    this.onMusicToggle = null;
    this.onThrottleChange = null; // function(deltaThrottle)
    this.onKeyRelease = null; // function(action, heldTime)
    this.onMenuToggle = null;
    this.onTripleTap = null; // function(action)

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
    window.addEventListener('contextmenu', (e) => {
      if (
        e.target.tagName !== 'INPUT' ||
        e.target.type === 'range' ||
        e.target.type === 'checkbox'
      ) {
        e.preventDefault();
      }
    });

    // Touch
    window.addEventListener('touchstart', this.handleTouchStart.bind(this), {
      passive: false,
    });
    window.addEventListener('touchmove', this.handleTouchMove.bind(this), {
      passive: false,
    });
    window.addEventListener('touchend', this.handleTouchEnd.bind(this));
  }

  resetMouseSteering() {
    this.state.mouse.controlActive = false;
    this.state.mouse.x = 0;
    this.state.mouse.y = 0;
  }

  isFlightKeyPressed() {
    return !!(
      this.state.keys.ArrowLeft ||
      this.state.keys.ArrowRight ||
      this.state.keys.ArrowUp ||
      this.state.keys.ArrowDown
    );
  }

  handleKeyDown(e) {
    // 1. Loading / Splash screen override: pressing Enter / Space clicks begin button
    const overlay = document.getElementById('loading-overlay');
    if (overlay && overlay.style.display !== 'none') {
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const btnContainer = document.getElementById('splash-btn-container');
        const beginBtn = document.getElementById('begin-btn');
        if (
          beginBtn &&
          btnContainer &&
          btnContainer.style.visibility === 'visible'
        ) {
          beginBtn.click();
          e.preventDefault();
          return;
        }
      }
      return;
    }

    // 2. Escape toggles pause (or closes achievements overlay if open)
    if (e.key === 'Escape') {
      const achievementsOverlay = document.getElementById(
        'achievements-overlay'
      );
      if (
        achievementsOverlay &&
        achievementsOverlay.style.display === 'flex' &&
        this.state.isPaused
      ) {
        achievementsOverlay.style.display = 'none';
        return;
      }
      if (this.onPauseToggle) {
        this.onPauseToggle();
        return;
      }
    }

    if (this.state.isPaused) return;

    // Block flight controls if mobile action menu is expanded
    const menuContainer = document.getElementById('mobile-action-menu');
    if (menuContainer && menuContainer.classList.contains('expanded')) return;

    // Ignore flight keys if typing into an input field
    if (
      document.activeElement &&
      document.activeElement.tagName === 'INPUT' &&
      document.activeElement.type !== 'checkbox'
    ) {
      return;
    }

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
      return;
    }
    if (key === 'p') {
      if (this.onMusicToggle) this.onMusicToggle();
      return;
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
        this.resetMouseSteering();
        const wasKeyPressed = this.state.keys[action];
        this.state.keys[action] = true;
        if (action === 'ArrowDown') this.state.keys.ArrowUp = false;

        if (!wasKeyPressed) {
          const now = performance.now();
          this.state.keyPressStartTime[action] = now;

          if (now - (this._lastArrowTap[action] || 0) < this.DOUBLE_TAP_MS) {
            this._tapCount[action] = (this._tapCount[action] || 0) + 1;
          } else {
            this._tapCount[action] = 1;
          }

          if (this._tapCount[action] === 2) {
            this.state.doubleTap[action] = true;
          } else if (this._tapCount[action] >= 3) {
            this.state.tripleTap[action] = true;
            this._tapCount[action] = 0;
            if (this.onTripleTap) this.onTripleTap(action);
          }
          this._lastArrowTap[action] = now;
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
    if (this.state.isPaused) return;

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
      const now = performance.now();
      const heldTime = now - (this.state.keyPressStartTime[action] || 0);
      this.state.keys[action] = false;
      this.state.doubleTap[action] = false;
      this.state.tripleTap[action] = false;
      this._lastKeyUpTime[action] = now;
      if (this.onKeyRelease) {
        this.onKeyRelease(action, heldTime);
      }
    }

    if (e.key === 'Shift') this.state.keys.Shift = false;
    if (e.key === '+' || e.key === '=') this.state.keys.Plus = false;
    if (e.key === '-' || e.key === '_') this.state.keys.Minus = false;
    if (key === 'q') this.state.keys.Q = false;
    if (key === 'e') this.state.keys.E = false;
  }

  handleBlur() {
    this._windowJustFocused = false;
    for (const k in this.state.keys) this.state.keys[k] = false;
    for (const k in this.state.doubleTap) this.state.doubleTap[k] = false;
    for (const k in this.state.tripleTap) this.state.tripleTap[k] = false;
    for (const k in this._tapCount) this._tapCount[k] = 0;
    this.state.mouse.controlActive = false;
    this.state.mouse.x = 0;
    this.state.mouse.y = 0;
    this.state.freeCam.dragging = false;
    this.state.joystick.active = false;
    this.state.joystick.touchId = null;
    this.state.touch.steeringId = null;
    this._activeGestureTouchId = null;
    this._activeGestureAction = null;
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
        !e.target.closest('#mobile-controls')
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
      return;
    }

    if (
      e.target.closest('#loading-overlay') ||
      e.target.closest('#cockpit-ui') ||
      e.target.closest('#debug-menu') ||
      e.target.closest('#debug-telemetry') ||
      e.target.closest('.title') ||
      e.target.closest('#mobile-controls') ||
      e.target.closest('#pause-overlay') ||
      e.target.closest('#achievements-overlay') ||
      e.target.closest('#mobile-action-menu') ||
      e.target.closest('.mobile-btn') ||
      e.target.closest('.sub-btn') ||
      e.target.closest('button') ||
      e.target.closest('input') ||
      e.target.closest('select') ||
      e.target.closest('a')
    ) {
      this.resetMouseSteering();
      return;
    }

    if (this.isFlightKeyPressed()) {
      return;
    }

    if (!this.state.isFreeCamera) {
      if (this._windowJustFocused) {
        this._windowJustFocused = false;
        return;
      }
      this.state.mouse.controlActive = true;
      this.state.gamepad.steeringActive = false;

      // Compute normalized mouse position with deadzone logic
      if (
        typeof ChillFlightLogic !== 'undefined' &&
        ChillFlightLogic.computeInputPosition
      ) {
        const pos = ChillFlightLogic.computeInputPosition(
          e.clientX,
          e.clientY,
          window.innerWidth,
          window.innerHeight
        );
        this.state.mouse.x = pos.x;
        this.state.mouse.y = pos.y;
      } else {
        const rect = document.body.getBoundingClientRect();
        this.state.mouse.x = (e.clientX / rect.width) * 2 - 1;
        this.state.mouse.y = -(e.clientY / rect.height) * 2 + 1;
      }
    }
  }

  handleTouchStart(e) {
    if (e.touches.length === 0) return;

    const target = e.target;
    const isUI =
      target.closest('#cockpit-ui') ||
      target.closest('#pause-overlay') ||
      target.closest('#achievements-overlay') ||
      target.closest('#loading-overlay') ||
      target.closest('#debug-menu') ||
      target.closest('#debug-telemetry') ||
      target.closest('.title') ||
      target.closest('#mobile-controls') ||
      target.closest('#mobile-action-menu') ||
      target.closest('.color-swatch');

    if (isUI) return;
    if (e.cancelable) e.preventDefault();

    if (this.state.isFreeCamera) {
      this.state.freeCam.dragging = true;
      this._lastFreeCamTouchX = e.changedTouches[0].clientX;
      this._lastFreeCamTouchY = e.changedTouches[0].clientY;
      return;
    }

    if (this.state.isPaused) return;

    const touch = e.changedTouches[0];
    const now = performance.now();
    const x = touch.clientX / window.innerWidth;
    const y = touch.clientY / window.innerHeight;

    // Gesture detection for screen zones (left/right/top/bottom third)
    let action = null;
    if (x < 0.33) action = 'ArrowLeft';
    else if (x > 0.66) action = 'ArrowRight';
    else if (y < 0.33) action = 'ArrowUp';
    else if (y > 0.66) action = 'ArrowDown';

    if (action) {
      const timeSinceLastTap = now - (this._lastArrowTap[action] || 0);
      if (timeSinceLastTap < this.DOUBLE_TAP_MS) {
        this._tapCount[action] = (this._tapCount[action] || 0) + 1;
      } else {
        this._tapCount[action] = 1;
      }
      this._lastArrowTap[action] = now;

      if (this._tapCount[action] === 2) {
        this.state.doubleTap[action] = true;
        this.state.keys[action] = true;
        this.state.keyPressStartTime[action] = now;
        this._activeGestureTouchId = touch.identifier;
        this._activeGestureAction = action;
      } else if (this._tapCount[action] >= 3) {
        const act = y < 0.33 ? 'ArrowUp' : action;
        this.state.tripleTap[act] = true;
        this.state.keys[act] = true;
        this.state.keyPressStartTime[act] = now;
        this._activeGestureTouchId = touch.identifier;
        this._activeGestureAction = act;
        this._tapCount[action] = 0;
        if (this.onTripleTap) this.onTripleTap(act);
      }
    }

    if (this.state.controlScheme === 'gyro') {
      // Gyro handles steering; gestures handle double/triple tap
      return;
    }

    if (this.state.controlScheme === 'joystick') {
      if (!this.state.joystick.active) {
        this.state.joystick.active = true;
        this.state.joystick.touchId = touch.identifier;
        this.state.joystick.startX = touch.clientX;
        this.state.joystick.startY = touch.clientY;
        this.state.mouse.controlActive = true;

        const joystickBase = document.getElementById('virtual-joystick-base');
        if (joystickBase) {
          joystickBase.style.left = `${touch.clientX}px`;
          joystickBase.style.top = `${touch.clientY}px`;
          joystickBase.classList.remove('joystick-hidden');
          joystickBase.classList.add('joystick-visible');
        }
      }

      if (this._activeGestureTouchId !== null) {
        // Suppress steering and hide joystick if gesture is active
        this.state.mouse.controlActive = false;
        this.state.mouse.x = 0;
        this.state.mouse.y = 0;
        this.state.joystick.active = false;
        this.state.joystick.touchId = null;
        const joystickBase = document.getElementById('virtual-joystick-base');
        if (joystickBase) {
          joystickBase.classList.remove('joystick-visible');
          joystickBase.classList.add('joystick-hidden');
        }
        const stick = document.getElementById('virtual-joystick-stick');
        if (stick) {
          stick.style.transform = 'translate(-50%, -50%)';
        }
      }
    } else {
      // Touch mode (absolute screen position)
      this.state.touch.steeringId = touch.identifier;
      if (
        typeof ChillFlightLogic !== 'undefined' &&
        ChillFlightLogic.computeInputPosition
      ) {
        const pos = ChillFlightLogic.computeInputPosition(
          touch.clientX,
          touch.clientY,
          window.innerWidth,
          window.innerHeight
        );
        this.state.mouse.x = pos.x;
        this.state.mouse.y = pos.y;
      }
      this.state.mouse.controlActive = true;

      if (this._activeGestureTouchId !== null) {
        this.state.mouse.controlActive = false;
        this.state.mouse.x = 0;
        this.state.mouse.y = 0;
      }
    }
  }

  handleTouchMove(e) {
    if (e.touches.length === 0) return;

    const target = e.target;
    const isUI =
      target.closest('#cockpit-ui') ||
      target.closest('#pause-overlay') ||
      target.closest('#achievements-overlay') ||
      target.closest('#loading-overlay') ||
      target.closest('#debug-menu') ||
      target.closest('#debug-telemetry') ||
      target.closest('.title') ||
      target.closest('#mobile-controls') ||
      target.closest('#mobile-action-menu') ||
      target.closest('.color-swatch');

    if (!isUI && !this.state.isPaused) {
      e.preventDefault();
    }

    if (isUI) return;

    if (this.state.freeCam.dragging && this.state.isFreeCamera) {
      const touch = e.changedTouches[0];
      this.state.freeCam.deltaX += touch.clientX - this._lastFreeCamTouchX;
      this.state.freeCam.deltaY += touch.clientY - this._lastFreeCamTouchY;
      this._lastFreeCamTouchX = touch.clientX;
      this._lastFreeCamTouchY = touch.clientY;
      return;
    }

    if (this.state.controlScheme === 'gyro') return;

    if (this.state.controlScheme === 'joystick' && this.state.joystick.active) {
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === this.state.joystick.touchId) {
          const touch = e.touches[i];
          const dx = touch.clientX - this.state.joystick.startX;
          const dy = touch.clientY - this.state.joystick.startY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const clampedDist = Math.min(dist, this.JOYSTICK_MAX_RADIUS);
          const angle = Math.atan2(dy, dx);
          const stickX = Math.cos(angle) * clampedDist;
          const stickY = Math.sin(angle) * clampedDist;

          const stick = document.getElementById('virtual-joystick-stick');
          if (stick) {
            stick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;
          }

          this.state.mouse.x =
            (stickX / this.JOYSTICK_MAX_RADIUS) * this.JOYSTICK_SENSITIVITY;
          this.state.mouse.y =
            -(stickY / this.JOYSTICK_MAX_RADIUS) * this.JOYSTICK_SENSITIVITY;
          this.state.mouse.controlActive = true;
          break;
        }
      }
    } else if (this.state.controlScheme === 'touch') {
      let steeringTouch = null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (
          e.changedTouches[i].identifier === this.state.touch.steeringId &&
          e.changedTouches[i].identifier !== this._activeGestureTouchId
        ) {
          steeringTouch = e.changedTouches[i];
          break;
        }
      }
      if (steeringTouch) {
        if (
          typeof ChillFlightLogic !== 'undefined' &&
          ChillFlightLogic.computeInputPosition
        ) {
          const pos = ChillFlightLogic.computeInputPosition(
            steeringTouch.clientX,
            steeringTouch.clientY,
            window.innerWidth,
            window.innerHeight
          );
          this.state.mouse.x = pos.x;
          this.state.mouse.y = pos.y;
        }
        this.state.mouse.controlActive = true;
      }
    }
  }

  handleTouchEnd(e) {
    // Joystick cleanup
    if (this.state.joystick.active) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.state.joystick.touchId) {
          this.state.joystick.active = false;
          this.state.joystick.touchId = null;
          this.state.mouse.controlActive = false;
          this.state.mouse.x = 0;
          this.state.mouse.y = 0;

          const joystickBase = document.getElementById('virtual-joystick-base');
          if (joystickBase) {
            joystickBase.classList.remove('joystick-visible');
            joystickBase.classList.add('joystick-hidden');
          }
          const stick = document.getElementById('virtual-joystick-stick');
          if (stick) {
            stick.style.transform = 'translate(-50%, -50%)';
          }
          break;
        }
      }
    }

    // Touch mode cleanup
    if (this.state.touch.steeringId !== null) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.state.touch.steeringId) {
          this.state.touch.steeringId = null;
          if (!this.state.joystick.active) {
            this.state.mouse.controlActive = false;
            this.state.mouse.x = 0;
            this.state.mouse.y = 0;
          }
          break;
        }
      }
    }

    // Gesture cleanup
    if (this._activeGestureTouchId !== null) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this._activeGestureTouchId) {
          if (this._activeGestureAction) {
            this.state.doubleTap[this._activeGestureAction] = false;
            this.state.tripleTap[this._activeGestureAction] = false;
            this.state.keys[this._activeGestureAction] = false;
          }
          this._activeGestureTouchId = null;
          this._activeGestureAction = null;
          break;
        }
      }
    }

    if (e.touches.length === 0) {
      this.state.mouse.controlActive = false;
      this.state.mouse.x = 0;
      this.state.mouse.y = 0;
      this.state.freeCam.dragging = false;
    }
  }

  pollGamepad(delta = 1 / 60) {
    const gamepads = navigator.getGamepads
      ? navigator.getGamepads()
      : navigator.webkitGetGamepads
        ? navigator.webkitGetGamepads()
        : [];

    let gp = null;
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i] && gamepads[i].connected) {
        gp = gamepads[i];
        break;
      }
    }

    if (!gp) {
      this._lastGamepadButtons = [];
      this.state.gamepad.steeringActive = false;
      return;
    }

    // 1. Flight Stick: Map Left Analog Stick (Axes 0 and 1) to Pitch and Roll
    let roll = gp.axes[0];
    let pitch = gp.axes[1];
    const deadzone = 0.15;
    if (Math.abs(roll) < deadzone) roll = 0;
    if (Math.abs(pitch) < deadzone) pitch = 0;

    if (Math.abs(gp.axes[0]) > deadzone || Math.abs(gp.axes[1]) > deadzone) {
      this.state.gamepad.x = roll;
      this.state.gamepad.y = pitch;
      this.state.gamepad.steeringActive = true;
    } else if (this.state.gamepad.steeringActive) {
      this.state.gamepad.x = 0;
      this.state.gamepad.y = 0;
      this.state.gamepad.steeringActive = false;
    }

    // 2. Throttle Triggers: RT (Button 7) to accelerate, LT (Button 6) to decelerate
    const rt =
      gp.buttons[7]?.value !== undefined
        ? gp.buttons[7].value
        : gp.buttons[7]?.pressed
          ? 1
          : 0;
    const lt =
      gp.buttons[6]?.value !== undefined
        ? gp.buttons[6].value
        : gp.buttons[6]?.pressed
          ? 1
          : 0;

    if (this.onThrottleChange) {
      if (rt > 0.1) {
        this.onThrottleChange((0.2 + rt * 1.0) * delta);
      }
      if (lt > 0.1) {
        this.onThrottleChange(-(0.2 + lt * 1.0) * delta);
      }
    }

    // 3. Pause: Map 'Start' or 'Menu' button (Button 9)
    if (gp.buttons[9]?.pressed) {
      if (!this._gamepadPauseLatched) {
        if (this.onPauseToggle) this.onPauseToggle();
        this._gamepadPauseLatched = true;
      }
    } else {
      this._gamepadPauseLatched = false;
    }

    // Toggle Action Menu: Map 'Select' or 'Back' button (Button 8)
    if (gp.buttons[8]?.pressed) {
      if (!this._gamepadSelectLatched) {
        if (this.onMenuToggle) this.onMenuToggle();
        this._gamepadSelectLatched = true;
      }
    } else {
      this._gamepadSelectLatched = false;
    }

    // Map Button 0 (A) to Enter for selection
    if (gp.buttons[0]?.pressed && !this._lastGamepadButtons[0]) {
      window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
    } else if (!gp.buttons[0]?.pressed && this._lastGamepadButtons[0]) {
      window.dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter'}));
    }

    // 4. Bumpers: Map LB (4) and RB (5) to ArrowLeft/ArrowRight (with double-tap detection)
    const bumperMap = [
      {btn: 4, key: 'ArrowLeft'},
      {btn: 5, key: 'ArrowRight'},
    ];

    bumperMap.forEach((map) => {
      const isPressed = gp.buttons[map.btn].pressed;
      const wasPressed = !!this._lastGamepadButtons[map.btn];

      if (isPressed && !wasPressed) {
        this.state.keys[map.key] = true;
        const now = performance.now();
        if (now - (this._lastArrowTap[map.key] || 0) < this.DOUBLE_TAP_MS) {
          this.state.doubleTap[map.key] = true;
        }
        this._lastArrowTap[map.key] = now;
        this.state.keyPressStartTime[map.key] = now;

        this.state.mouse.controlActive = false;
        this.state.mouse.x = 0;
        this.state.mouse.y = 0;
      } else if (!isPressed && wasPressed) {
        this.state.keys[map.key] = false;
        this.state.doubleTap[map.key] = false;
      }
    });

    // 5. D-Pad: Map to Arrow keys
    const dpadMap = [
      {btn: 12, key: 'ArrowUp'},
      {btn: 13, key: 'ArrowDown'},
      {btn: 14, key: 'ArrowLeft'},
      {btn: 15, key: 'ArrowRight'},
    ];

    dpadMap.forEach((map) => {
      const isPressed = gp.buttons[map.btn]?.pressed;
      const wasPressed = !!this._lastGamepadButtons[map.btn];
      if (isPressed && !wasPressed) {
        window.dispatchEvent(new KeyboardEvent('keydown', {key: map.key}));
      } else if (!isPressed && wasPressed) {
        window.dispatchEvent(new KeyboardEvent('keyup', {key: map.key}));
      }
    });

    // Update tracked buttons
    gp.buttons.forEach((btn, idx) => {
      this._lastGamepadButtons[idx] = btn.pressed;
    });
  }

  consumeDoubleTap(action) {
    if (this.state.doubleTap[action]) {
      this.state.doubleTap[action] = false;
      return true;
    }
    return false;
  }

  /**
   * Returns a unified steering vector {x, y, active} where x and y are between -1.0 and 1.0.
   * Resolves priority between Gamepad > Touch/Joystick/Mouse > Keyboard.
   */
  getSteering() {
    // 1. Gamepad takes highest priority
    if (this.state.gamepad.steeringActive) {
      return {
        x: this.state.gamepad.x,
        y: this.state.gamepad.y,
        active: true,
      };
    }

    // 2. Touch, Joystick, and Mouse use the unified mouse coordinates
    if (this.state.mouse.controlActive) {
      return {
        x: this.state.mouse.x,
        y: this.state.mouse.y,
        active: true,
      };
    }

    // 3. Keyboard (Arrow keys) return discrete 1/-1 values
    let kx = 0;
    let ky = 0;
    let kActive = false;

    if (this.state.keys.ArrowLeft) {
      kx = -1;
      kActive = true;
    }
    if (this.state.keys.ArrowRight) {
      kx = 1;
      kActive = true;
    }
    if (this.state.keys.ArrowUp) {
      ky = 1;
      kActive = true;
    }
    if (this.state.keys.ArrowDown) {
      ky = -1;
      kActive = true;
    }

    if (kActive) {
      return {x: kx, y: ky, active: true};
    }

    // No active steering
    return {x: 0, y: 0, active: false};
  }
}

window.InputManager = InputManager;
