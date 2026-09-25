function checkGyroSupport() {
  let supported = false;
  if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
    supported = true;
  } else {
    // On iOS, deviceorientation might not fire until permission is granted.
    // So we check if the API exists AND if it's a mobile/touch device.
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (window.DeviceOrientationEvent && hasTouch) {
      supported = true;
    }
  }

  // Show gyro button if supported
  if (supported && gyroSchemeBtn) {
    gyroSchemeBtn.style.display = '';
  }

  // Show the entire control scheme toggle on touch devices
  if (supported || 'ontouchstart' in window || navigator.maxTouchPoints > 0) {
    if (controlSchemeToggle) {
      controlSchemeToggle.style.display = '';
    }
  }
}
checkGyroSupport();

// Set active state on scheme buttons from saved preference
if (controlSchemeToggle) {
  const schemeBtns = controlSchemeToggle.querySelectorAll('.scheme-btn');
  schemeBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.scheme === currentControlScheme);
  });

  schemeBtns.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      let scheme = btn.dataset.scheme;

      // Request gyro permission on iOS if selecting gyro
      if (
        scheme === 'gyro' &&
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'
      ) {
        try {
          const permissionState =
            await DeviceOrientationEvent.requestPermission();
          if (permissionState !== 'granted') {
            alert('Gyro permission denied.');
            return; // Don't switch to gyro
          }
        } catch (err) {
          console.error('Error requesting gyro permission', err);
          return;
        }
      }

      currentControlScheme = scheme;
      if (typeof inputManager !== 'undefined') {
        inputManager.state.controlScheme = scheme;
      }
      gyroEnabled = scheme === 'gyro';
      localStorage.setItem('chill_flight_control_scheme', scheme);
      gyroBasePitch = null;
      gyroBaseRoll = null;

      // Update button active states
      schemeBtns.forEach((b) => {
        b.classList.toggle('active', b.dataset.scheme === scheme);
      });

      const recalibrateBtn = document.getElementById('mobile-recalibrate-btn');
      if (recalibrateBtn) {
        recalibrateBtn.style.display = scheme === 'gyro' ? '' : 'none';
      }

      // Reset steering state when switching
      mouseX = 0;
      mouseY = 0;
      mouseControlActive = false;
      joystickActive = false;
      joystickTouchId = null;
      const _jBase = document.getElementById('virtual-joystick-base');
      if (_jBase) {
        _jBase.classList.remove('joystick-visible');
        _jBase.classList.add('joystick-hidden');
      }
      const _jStick = document.getElementById('virtual-joystick-stick');
      if (_jStick) {
        _jStick.style.transform = 'translate(-50%, -50%)';
      }
    });
  });
}

const _zee = new THREE.Vector3(0, 0, 1);
const _q0 = new THREE.Quaternion();
const _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const _euler = new THREE.Euler();

function getDeviceQuaternion(alpha, beta, gamma, orient) {
  const degToRad = Math.PI / 180;
  _euler.set(
    beta * degToRad,
    (alpha || 0) * degToRad,
    -(gamma || 0) * degToRad,
    'YXZ'
  );
  const q = new THREE.Quaternion();
  q.setFromEuler(_euler);
  q.multiply(_q1);
  q.multiply(_q0.setFromAxisAngle(_zee, -orient * degToRad));
  return q;
}

var gyroBaseQuat = null;
var gyroBaseGravity = null;
const recalibrateBtn = document.getElementById('mobile-recalibrate-btn');
if (recalibrateBtn) {
  recalibrateBtn.style.display = currentControlScheme === 'gyro' ? '' : 'none';
  recalibrateBtn.addEventListener('click', (e) => {
    e.preventDefault();
    gyroBaseQuat = null;
    gyroBaseGravity = null;

    // Provide a little UI feedback (e.g. green icon temporarily)
    recalibrateBtn.style.color = '#4caf50';
    recalibrateBtn.style.borderColor = '#4caf50';
    setTimeout(() => {
      recalibrateBtn.style.color = '';
      recalibrateBtn.style.borderColor = '';
    }, 1500);
  });
}

const _gyroGravityWorld = new THREE.Vector3(0, -1, 0);
const _gyroCurrentGravity = new THREE.Vector3();
const _gyroCurrentQuatInv = new THREE.Quaternion();
const _gyroRelQuat = new THREE.Quaternion();
const _gyroRelEuler = new THREE.Euler();

function handleGyroData(alpha, beta, gamma) {
  if (currentControlScheme !== 'gyro' || isPaused) return;
  if (beta === null || gamma === null) return;

  let orientation = 0;
  if (typeof window.orientation !== 'undefined') {
    orientation = window.orientation;
  } else if (window.screen && window.screen.orientation) {
    orientation = window.screen.orientation.angle || 0;
  }

  const currentQuat = getDeviceQuaternion(alpha, beta, gamma, orientation);

  // Gravity is -Y in the World Frame (Three.js deviceorientation convention)
  _gyroCurrentQuatInv.copy(currentQuat).invert();
  _gyroCurrentGravity
    .copy(_gyroGravityWorld)
    .applyQuaternion(_gyroCurrentQuatInv);

  if (!gyroBaseQuat) {
    gyroBaseQuat = currentQuat.clone();
    gyroBaseGravity = _gyroCurrentGravity.clone();
  }

  // Pitch is the rotation around the local X axis
  _gyroRelQuat.copy(gyroBaseQuat).invert().multiply(currentQuat);
  _gyroRelEuler.setFromQuaternion(_gyroRelQuat, 'XYZ');
  // Removed negation to match original landscape gyro polarity
  let diffPitch = _gyroRelEuler.x * (180 / Math.PI);

  // Roll is the tilt of the right side of the device towards gravity
  let currentRollAngle =
    Math.asin(THREE.MathUtils.clamp(_gyroCurrentGravity.x, -1, 1)) *
    (180 / Math.PI);
  let baseRollAngle =
    Math.asin(THREE.MathUtils.clamp(gyroBaseGravity.x, -1, 1)) *
    (180 / Math.PI);
  let diffRoll = currentRollAngle - baseRollAngle;

  let targetX = diffRoll / gyroSensitivity;
  if (targetX > 1) targetX = 1;
  if (targetX < -1) targetX = -1;

  let targetY = diffPitch / gyroSensitivity;
  if (targetY > 1) targetY = 1;
  if (targetY < -1) targetY = -1;

  mouseX = targetX;
  mouseY = targetY;
  mouseControlActive = true;
}

if (
  typeof Capacitor !== 'undefined' &&
  Capacitor.Plugins &&
  Capacitor.Plugins.Motion
) {
  Capacitor.Plugins.Motion.addListener('orientation', (event) => {
    handleGyroData(event.alpha, event.beta, event.gamma);
  });
} else {
  window.addEventListener('deviceorientation', (event) => {
    handleGyroData(event.alpha, event.beta, event.gamma);
  });
}
