function updateFlightCamera(delta, nowTime) {
  // --- CAMERA UPDATES ---

  if (isFreeCamera) {
    // Free movement logic
    const moveSpeed = (keys.Shift ? 1000 : 250) * delta;
    const rotateSpeedDrag = 0.005;

    // Rotation from Drag (respecting invertYAxis)
    camera.rotation.y += freeCamDeltaX * rotateSpeedDrag;
    camera.rotation.x +=
      freeCamDeltaY * rotateSpeedDrag * (invertYAxis ? -1 : 1);
    camera.rotation.z = 0;

    freeCamDeltaX = 0;
    freeCamDeltaY = 0;

    // Translation
    _freeCamFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    _freeCamSide.set(1, 0, 0).applyQuaternion(camera.quaternion);

    if (keys.ArrowUp) camera.position.addScaledVector(_freeCamFwd, moveSpeed);
    if (keys.ArrowDown)
      camera.position.addScaledVector(_freeCamFwd, -moveSpeed);
    if (keys.ArrowLeft)
      camera.position.addScaledVector(_freeCamSide, -moveSpeed);
    if (keys.ArrowRight)
      camera.position.addScaledVector(_freeCamSide, moveSpeed);
    if (keys.E) camera.position.y += moveSpeed;
    if (keys.Q) camera.position.y -= moveSpeed;

    // Still update chunks based on camera position
    if (camera.position.distanceToSquared(_lastChunkUpdatePos) > 10000) {
      updateChunks();
      _lastChunkUpdatePos.copy(camera.position);
    }
  } else {
    let targetProgress = 0;
    if (cameraMode === 'first-person') targetProgress = 0.5;
    else if (cameraMode === 'birds-eye-close' || cameraMode === 'birds-eye-far')
      targetProgress = 1.0;

    let speed = 0.25; // Slower transitions for all modes

    if (cameraTransitionProgress < targetProgress) {
      cameraTransitionProgress = Math.min(
        targetProgress,
        cameraTransitionProgress + delta * speed
      );
    } else if (cameraTransitionProgress > targetProgress) {
      cameraTransitionProgress = Math.max(
        targetProgress,
        cameraTransitionProgress - delta * speed
      );
    }

    // Smoothly transition between different bird's eye heights
    let targetBirdEyeHeight = 2000;
    if (cameraMode === 'birds-eye-close') targetBirdEyeHeight = 500;

    currentBirdEyeHeight = THREE.MathUtils.lerp(
      currentBirdEyeHeight,
      targetBirdEyeHeight,
      1 - Math.pow(1 - 0.05, delta * 60)
    );

    // Cubic ease-in for the "swoop up" drama: t^3
    // This makes it start slow and accelerate significantly towards the top-down view.
    const easedT =
      cameraTransitionProgress *
      cameraTransitionProgress *
      cameraTransitionProgress;

    // 1. Calculate Follow State

    // Smooth the plane's rotation to create camera inertia.
    // If doing acrobatic loops/rolls, snap it to avoid the camera getting lost.
    if (isLooping || isBarrelRolling) {
      _cameraAnchorQuat.copy(planeGroup.quaternion);
    } else {
      _cameraAnchorQuat.slerp(
        planeGroup.quaternion,
        1 - Math.pow(1 - 0.15, delta * 60)
      );
    }

    _cameraAnchorMatrix.makeRotationFromQuaternion(_cameraAnchorQuat);
    _cameraAnchorMatrix.setPosition(planeGroup.position);

    _idealCameraPos_Follow
      .copy(_cameraOffset)
      .applyMatrix4(_cameraAnchorMatrix);

    _lookOffset.set(0, 0, -20);
    _idealLookTarget_Follow.copy(_lookOffset).applyMatrix4(_cameraAnchorMatrix);

    if (isLooping) {
      _up_Follow.set(0, 1, 0).applyQuaternion(_cameraAnchorQuat);
    } else {
      _up_Follow.set(0, 1, 0);
    }

    // 1.5 Calculate First Person State
    _idealCameraPos_FirstPerson
      .set(0, 1.0, -50)
      .applyMatrix4(planeGroup.matrixWorld);
    _idealLookTarget_FirstPerson
      .set(0, 1.0, -70)
      .applyMatrix4(planeGroup.matrixWorld);
    _up_FirstPerson.set(0, 1, 0).applyQuaternion(planeGroup.quaternion);

    // 2. Calculate Top-Down State
    _idealCameraPos_TopDown.set(
      planeGroup.position.x,
      planeGroup.position.y + currentBirdEyeHeight,
      planeGroup.position.z
    );
    _idealLookTarget_TopDown.copy(planeGroup.position);
    _up_TopDown.set(0, 0, -1); // North is UP

    // 3. Calculate Cinematic State
    const cinematicConfig = CINEMATIC_CONFIGS[currentCinematicIndex];
    if (cameraMode === 'cinematic') {
      // Smoothen the switches between cinematic offsets
      const hasOffsetJumped =
        _cinematicOffsetCurrent.distanceToSquared(cinematicConfig.offset) >
        0.001;
      if (hasOffsetJumped) {
        _cinematicOffsetCurrent.lerp(cinematicConfig.offset, 0.02 * delta * 60);
        _cinematicLookTargetCurrent.lerp(
          cinematicConfig.lookOffset,
          0.02 * delta * 60
        );
      }

      // Optimize: Only recalculate matrix if plane has moved or rotated, or if offset is still transitioning
      const rotationChanged =
        Math.abs(_cinematicStableHeading - planeGroup.rotation.y) > 0.0001;
      // Check position change without expensive extra calculations
      const positionChanged =
        Math.abs(_cinematicStableMatrix.elements[12] - planeGroup.position.x) >
          0.1 ||
        Math.abs(_cinematicStableMatrix.elements[13] - planeGroup.position.y) >
          0.1 ||
        Math.abs(_cinematicStableMatrix.elements[14] - planeGroup.position.z) >
          0.1;

      if (rotationChanged || positionChanged || hasOffsetJumped) {
        _cinematicStableHeading = ChillFlightLogic.lerpAngle(
          _cinematicStableHeading,
          planeGroup.rotation.y,
          0.05 * delta * 60
        );
        _cinematicStableQuat.setFromAxisAngle(_yAxis, _cinematicStableHeading);
        _cinematicStableMatrix.makeRotationFromQuaternion(_cinematicStableQuat);
        _cinematicStableMatrix.setPosition(planeGroup.position);
      }
    } else {
      // Keep heading in sync while not in cinematic mode for smooth entry
      _cinematicStableHeading = planeGroup.rotation.y;
    }

    _idealCameraPos_Cinematic
      .copy(_cinematicOffsetCurrent)
      .applyMatrix4(_cinematicStableMatrix);
    _idealLookTarget_Cinematic
      .copy(_cinematicLookTargetCurrent)
      .applyMatrix4(_cinematicStableMatrix);

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

    camera.fov = THREE.MathUtils.lerp(
      camera.fov,
      targetBlendedFov,
      1 - Math.pow(1 - 0.1, delta * 60)
    );
    camera.updateProjectionMatrix();

    // 5. Blend Positions & Targets
    if (cameraMode === 'cinematic') {
      _idealCameraPos.copy(_idealCameraPos_Cinematic);
      _idealLookTarget.copy(_idealLookTarget_Cinematic);
      _idealUp.set(0, 1, 0); // Always world-up for cinematic
    } else {
      const p = cameraTransitionProgress;
      if (p < 0.5) {
        const t = p / 0.5;
        const easedSegT = t * t * (3 - 2 * t); // smoothstep
        _idealCameraPos.lerpVectors(
          _idealCameraPos_Follow,
          _idealCameraPos_FirstPerson,
          easedSegT
        );
        _idealLookTarget.lerpVectors(
          _idealLookTarget_Follow,
          _idealLookTarget_FirstPerson,
          easedSegT
        );
        _idealUp.lerpVectors(_up_Follow, _up_FirstPerson, easedSegT);
      } else {
        const t = (p - 0.5) / 0.5;
        const easedSegT = t * t * (3 - 2 * t); // smoothstep
        _idealCameraPos.lerpVectors(
          _idealCameraPos_FirstPerson,
          _idealCameraPos_TopDown,
          easedSegT
        );
        _idealLookTarget.lerpVectors(
          _idealLookTarget_FirstPerson,
          _idealLookTarget_TopDown,
          easedSegT
        );
        _idealUp.lerpVectors(_up_FirstPerson, _up_TopDown, easedSegT);
      }
    }

    // Camera collision avoidance with terrain & water surface
    const idealTerrainHeight = getElevation(
      _idealCameraPos.x,
      _idealCameraPos.z
    );
    const minCamSurface = Math.max(WATER_LEVEL, idealTerrainHeight);
    if (_idealCameraPos.y < minCamSurface + 2.0) {
      _idealCameraPos.y = minCamSurface + 2.0;
    }

    // Apply smooth tracking to the results
    // We use smoothedDelta and a higher lerp factor for a more "locked-in" feel.
    if (isIntroTransitionActive) {
      // Update the virtual tracking camera (steady state lag)
      _virtualCameraPos.lerp(
        _idealCameraPos,
        1 - Math.pow(1 - 0.25, delta * 60)
      );
      _virtualLookTarget.lerp(
        _idealLookTarget,
        1 - Math.pow(1 - 0.25, delta * 60)
      );

      const progress = (now - introTransitionStartTime) / 1250;
      if (progress < 1) {
        // Ease In Out Cubic
        const easedProgress =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const activeCamTarget = isVRPresenting ? cameraDolly : camera;

        // Interpolate visual camera between start and virtual tracking camera
        _currentLookTarget.lerpVectors(
          _introLookTargetStart,
          _virtualLookTarget,
          easedProgress
        );
        activeCamTarget.position.lerpVectors(
          _introCameraPosStart,
          _virtualCameraPos,
          easedProgress
        );
      } else {
        isIntroTransitionActive = false;
        const activeCamTarget = isVRPresenting ? cameraDolly : camera;
        activeCamTarget.position.copy(_virtualCameraPos);
        _currentLookTarget.copy(_virtualLookTarget);
      }
    } else {
      const activeCamTarget = isVRPresenting ? cameraDolly : camera;
      if (isLooping) {
        // In acrobatic loops, lock camera position directly to avoid inertia lag causing lookAt inversion
        activeCamTarget.position.copy(_idealCameraPos);
        _currentLookTarget.copy(_idealLookTarget);
      } else {
        activeCamTarget.position.lerp(
          _idealCameraPos,
          1 - Math.pow(1 - 0.25, delta * 60)
        );
        _currentLookTarget.lerp(
          _idealLookTarget,
          1 - Math.pow(1 - 0.25, delta * 60)
        );
      }
    }

    const activeCamTarget = isVRPresenting ? cameraDolly : camera;

    // Hard clamp to prevent dipping below terrain during fast movement
    const actualTerrainHeight = getElevation(
      activeCamTarget.position.x,
      activeCamTarget.position.z
    );
    if (activeCamTarget.position.y < actualTerrainHeight + 1.0) {
      activeCamTarget.position.y = actualTerrainHeight + 1.0;
    }

    if (isLooping) {
      // During vertical loops, up vector must match the inverted plane to prevent gimbal lock at 90°
      activeCamTarget.up.copy(_idealUp);
    } else if (!isVRPresenting) {
      activeCamTarget.up
        .lerp(_idealUp, 1 - Math.pow(1 - 0.1, delta * 60))
        .normalize();
    } else {
      activeCamTarget.up.set(0, 1, 0); // Keep world up stable in VR during normal flight
    }

    activeCamTarget.lookAt(_currentLookTarget);

    // Update terrain chunks (only if the plane has moved ~50 units)
    if (planeGroup.position.distanceToSquared(_lastChunkUpdatePos) > 2500) {
      updateChunks();
      _lastChunkUpdatePos.copy(planeGroup.position);
    }
  }

  // Celestial positions
  const sunOrbitRadius = 8000;
  const moonOrbitRadius = 7500; // Moon is closer so it renders in front of sun during overlaps

  // 1. Realistic Sun Path
  const latitude = currentLatRad;
  const declination = 0.409; // Summer tilt
  const hourAngle = timeOfDay + Math.PI;

  const sunY =
    Math.sin(latitude) * Math.sin(declination) +
    Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  const sunX = -Math.cos(declination) * Math.sin(hourAngle);
  const sunZ =
    Math.cos(latitude) * Math.sin(declination) -
    Math.sin(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  // Spread dayFactor over a wider sun angle so sunrise/sunset lighting builds up gradually,
  // drawing out the visual transition rather than hitting full intensity right at 6:00 AM.
  // We must ensure the offset (-0.5) is deeper than dawnDuskFactor's fadeout (-0.4) to prevent abrupt clipping!
  const dayFactor = Math.max(0, Math.min(1, (sunY + 0.5) / 0.8)); // 0.0 at SunY=-0.5 (4 AM), 1.0 at SunY=0.3 (~7:15 AM)

  // Feed dayFactor to the performance monitor for shadow night culling
  performanceMonitor.updateDayFactor(dayFactor);

  // 2. Fixed Moon Position (West-Southwest Sky near Horizon)

  // Set WSW fixed position (approx. -126 degrees azimuth)
  const baseMoonAngle = -2.2;
  // Low elevation (~10 degrees above the horizon)
  const baseMoonElev = 0.18;

  // Slow lunar wobble: drifts slightly over time so it feels alive
  const moonWobbleSpeed = passedServerNow * 0.00005;
  const moonWobbleX = Math.sin(moonWobbleSpeed) * 0.03;
  const moonWobbleY = Math.cos(moonWobbleSpeed) * 0.015;

  const moonY = Math.sin(baseMoonElev + moonWobbleY);
  const moonX =
    Math.cos(baseMoonAngle + moonWobbleX) *
    Math.cos(baseMoonElev + moonWobbleY);
  const moonZ =
    Math.sin(baseMoonAngle + moonWobbleX) *
    Math.cos(baseMoonElev + moonWobbleY);

  // Update water shader uniform — the GPU handles all wave displacement
  window.waterUniforms.uTime.value = now * 0.0015;

  // Update global animation time for GPU-offloaded objects
  if (!window.animationUniforms) window.animationUniforms = {uTime: {value: 0}};
  window.animationUniforms.uTime.value = performance.now() * 0.001;

  // Update global opacity materials outside of chunk loop
  if (typeof fireMat !== 'undefined') {
    fireMat.emissiveIntensity = 2.0 * (1.0 - dayFactor * 0.8);
  }
  if (typeof smokeMat !== 'undefined') {
    smokeMat.opacity = 0.4 * (1.0 - dayFactor * 0.5);
  }
  if (typeof whiteSmokeMat !== 'undefined') {
    whiteSmokeMat.opacity = 0.6 - dayFactor * 0.3;
  }

  // Animate Birds
  const activeBirds = typeof birdChunks !== 'undefined' ? birdChunks : chunks;
  activeBirds.forEach((chunkGroup) => {
    // Optimization: Distance culling (6000 units)
    const checkPos = chunkGroup.userData.worldPosition || chunkGroup.position;
    if (checkPos.distanceToSquared(camera.position) > 36000000) return;

    if (chunkGroup.userData.birds) {
      chunkGroup.userData.birds.forEach((bird) => {
        bird.visible = dayFactor > 0.1;
        if (!bird.visible) return;

        const data = bird.userData;
        const flapSpeed = data.flapSpeed || 2;
        const flapPhase = data.flapPhase || 0;
        const flapDuration = data.flapDuration || 4.0;
        const soarDuration = data.soarDuration || 6.0;

        const totalCycle = flapDuration + soarDuration;
        const cycleProgress =
          (clock.getElapsed() + flapPhase * 10) % totalCycle;
        const isSoaring = cycleProgress > flapDuration;

        let flap = 0;
        if (!isSoaring) {
          let amplitude = 0.5;
          const transitionTime = 0.5; // 0.5s smooth fade envelope
          if (cycleProgress < transitionTime) {
            amplitude *= cycleProgress / transitionTime;
          } else if (flapDuration - cycleProgress < transitionTime) {
            amplitude *= (flapDuration - cycleProgress) / transitionTime;
          }
          flap =
            Math.sin(clock.getElapsed() * flapSpeed + flapPhase) * amplitude;
        }
        if (data.wings) {
          data.wings[0].rotation.z = flap;
          data.wings[1].rotation.z = flap;
        }
        bird.translateZ(-(data.speed * delta * 50));

        if (data.type === 'hawk' || data.type === 'seagull') {
          data.angle += data.circleSpeed * delta;
          const targetX =
            data.circleCenter.x + Math.cos(data.angle) * data.circleRadius;
          const targetZ =
            data.circleCenter.z + Math.sin(data.angle) * data.circleRadius;

          let targetY = bird.position.y;
          let tiltZ = 0.3; // Bank angle for circling
          let tiltX = 0; // Pitch angle

          // Seagull diving logic
          if (data.type === 'seagull') {
            if (data.isDiving) {
              data.diveTimer += delta;
              const diveProgress = data.diveTimer / data.diveDuration;
              if (diveProgress > 1.0) {
                data.isDiving = false;
                data.diveTimer = 0;
              } else {
                // Parabolic dive towards WATER_LEVEL
                const baseHeight = data.circleCenter.y;
                // We want to dive down to water level and back up
                const diveDepth = baseHeight - WATER_LEVEL - 5;
                // sine wave from 0 to PI makes a parabola-like curve
                const diveOffset = Math.sin(diveProgress * Math.PI) * diveDepth;
                targetY = baseHeight - diveOffset;

                // Pitch down then up
                tiltX = Math.sin(diveProgress * Math.PI * 2) * -0.8;
                tiltZ = 0; // Stop banking while diving
              }
            } else {
              data.diveTimer += delta;
              if (data.diveTimer > data.nextDiveWait) {
                data.isDiving = true;
                data.diveTimer = 0;
                data.diveDuration = 3.0 + Math.random() * 2.0;
                data.nextDiveWait = 10.0 + Math.random() * 20.0;
              }
            }
          }

          bird.lookAt(
            data.circleCenter.x +
              Math.cos(data.angle - 0.1) * data.circleRadius,
            data.type === 'seagull' && data.isDiving
              ? targetY
              : bird.position.y,
            data.circleCenter.z + Math.sin(data.angle - 0.1) * data.circleRadius
          );

          bird.rotation.z = tiltZ;
          bird.rotation.x += tiltX;

          bird.position.set(targetX, targetY, targetZ);
        } else if (data.type === 'goose') {
          // Prevent geese from flying into the volcano or terrain
          const groundY = getElevation(bird.position.x, bird.position.z);
          const minClearance = 250;
          if (bird.position.y < groundY + minClearance) {
            bird.position.y +=
              (groundY + minClearance - bird.position.y) * 3.0 * delta;
          }
        }

        // Collide check (goose trigger)
        if (
          data.type === 'goose' &&
          typeof Achievements !== 'undefined' &&
          !isFreeCamera
        ) {
          const distToPlaneSq = bird.position.distanceToSquared(
            planeGroup.position
          );
          if (distToPlaneSq < 625) {
            Achievements.unlock('geese_police');
          }
        }
      });
    }
  });

  // Animate Lighthouse Beam directly if active chunk is present
  if (typeof chunks !== 'undefined' && chunks.has('5,2')) {
    const chunkGroup = chunks.get('5,2');
    if (chunkGroup && chunkGroup.userData.lighthouseBeam) {
      const beam = chunkGroup.userData.lighthouseBeam;
      beam.rotation.y += delta * 0.15; // Slower sweep

      // Fade on after sunset and fade off before sunrise using dayFactor
      const fadeFactor = 1.0 - dayFactor;
      beam.visible = fadeFactor > 0;

      if (beam.visible) {
        const baseOpacity =
          LIGHTHOUSE_BEAM_OPACITY_MIN +
          (Math.sin(performance.now() * 0.002) * 0.5 + 0.5) *
            (LIGHTHOUSE_BEAM_OPACITY_MAX - LIGHTHOUSE_BEAM_OPACITY_MIN);
        beam.material.opacity = baseOpacity * fadeFactor;
      }

      // Check for gatsby achievement (Lighthouse flyby)
      if (typeof Achievements !== 'undefined' && !isFreeCamera) {
        beam.getWorldPosition(_lighthouseBeamWorldPos);
        const distSq = planeGroup.position.distanceToSquared(
          _lighthouseBeamWorldPos
        );
        if (distSq < 22500) {
          Achievements.unlock('gatsby');
          console.log(
            `[Lighthouse flyby] Position: X = ${_lighthouseBeamWorldPos.x.toFixed(1)}, Z = ${_lighthouseBeamWorldPos.z.toFixed(1)} (${(_lighthouseBeamWorldPos.x / 5000).toFixed(2)} ${_lighthouseBeamWorldPos.x >= 0 ? 'East' : 'West'}, ${(-_lighthouseBeamWorldPos.z / 5000).toFixed(2)} ${_lighthouseBeamWorldPos.z <= 0 ? 'North' : 'South'})`
          );
        }
      }

      // Rotate functional light target
      if (
        chunkGroup.userData.lighthouseTarget &&
        chunkGroup.userData.lighthouseLight
      ) {
        const target = chunkGroup.userData.lighthouseTarget;
        const light = chunkGroup.userData.lighthouseLight;

        if (beam.visible) {
          // Align target perfectly with the beam's Z-axis trajectory
          const distance = 600; // Doubled distance for scaled lighthouse
          target.position.set(
            light.position.x + Math.sin(beam.rotation.y) * distance,
            light.position.y - Math.sin(beam.rotation.x) * distance, // Account for downward tilt
            light.position.z + Math.cos(beam.rotation.y) * distance
          );
          light.intensity = LIGHTHOUSE_LIGHT_INTENSITY * fadeFactor;
        } else {
          light.intensity = 0;
        }
      }
    }
  }

  // Animate Watercraft (Sailboats & Pirate Ships)
  // Performance optimization:
  // 1. Only iterate watercraftChunks (chunks containing boats) rather than all loaded chunks.
  // 2. Beyond 1,500 units, boats stagger GPU buffer attribute updates to once
  //    every 30 frames to drastically reduce PCIe bus traffic while preventing visual snapping.
  // 3. When time speed is paused (daySpeedMultiplier === 0), freeze updates once initialized.
  const activeWatercraft =
    typeof watercraftChunks !== 'undefined' ? watercraftChunks : chunks;

  const isTimePaused =
    typeof daySpeedMultiplier !== 'undefined' && daySpeedMultiplier === 0;

  if (typeof window._frameCount === 'undefined') window._frameCount = 0;
  window._frameCount++;

  activeWatercraft.forEach((chunkGroup) => {
    if (isTimePaused && chunkGroup.userData.boatsInitialized) return;
    chunkGroup.userData.boatsInitialized = true;

    const checkPos = chunkGroup.userData.worldPosition || chunkGroup.position;
    const distSq = checkPos.distanceToSquared(camera.position);

    // Completely cull animation updates beyond 6000 units
    if (distSq > 36000000) return;

    // Throttle GPU updates for distant boats (between 2000 and 6000 units)
    if (distSq > 4000000) {
      const chunkHash =
        Math.abs(chunkGroup.userData.chunkX + chunkGroup.userData.chunkZ) || 0;
      if ((window._frameCount + chunkHash) % 30 !== 0) {
        return;
      }
    }

    // Animate Sailboats (Drifting & Bobbing)
    if (
      chunkGroup.userData.boatHulls &&
      chunkGroup.userData.sailboatPositions
    ) {
      const hulls = chunkGroup.userData.boatHulls;
      const masts = chunkGroup.userData.boatMasts;
      const sails = chunkGroup.userData.boatSails;
      const rims = chunkGroup.userData.boatRims;
      const decks = chunkGroup.userData.boatDecks;
      const booms = chunkGroup.userData.boatBooms;
      const positions = chunkGroup.userData.sailboatPositions;

      positions.forEach((pos, index) => {
        const driftPhase = _boatHash(index, 1) * Math.PI * 2;
        const driftSpeed = 0.03 + _boatHash(index, 2) * 0.04; // Extremely slow drifting
        const doesDrift = _boatHash(index, 3) < 0.8; // 80% drift, 20% completely anchored in place
        const isAnchored = doesDrift && _boatHash(index, 4) < 0.6; // 60% of drifting ones are on a tight anchor, 40% are loose

        let driftRadius = 0;
        if (doesDrift) {
          driftRadius = isAnchored
            ? 4 + _boatHash(index, 5) * 4
            : 15 + _boatHash(index, 5) * 15;
        }

        let dx = 0;
        let dz = 0;
        let yawOffset = Math.sin(clock.getElapsed() * 0.4 + driftPhase) * 0.05; // Gentle sway

        if (driftRadius > 0) {
          const t = clock.getElapsed() * driftSpeed + driftPhase;
          dx = Math.sin(t * 1.6) * driftRadius;
          dz = Math.cos(t * 1.0) * driftRadius;

          // Tangent of the slow drift Lissajous trajectory for orientation heading
          const tx = 1.6 * Math.cos(t * 1.6) * driftRadius;
          const tz = -1.0 * Math.sin(t * 1.0) * driftRadius;

          // Compute angle of movement
          const tangentYaw = Math.atan2(tx, tz);
          yawOffset += tangentYaw;
        }

        // Bobbing & Wave dynamics (Roll/Pitch)
        const bobTime = clock.getElapsed() * 1.2 + driftPhase;
        const dy = Math.sin(bobTime) * 0.15;
        const roll = Math.sin(bobTime * 0.8) * 0.04;
        const pitch = Math.cos(bobTime * 1.1) * 0.03;

        _boatDummy.position.set(pos.x + dx, pos.y + dy, pos.z + dz);
        _boatDummy.rotation.set(0, 0, 0);
        _boatDummy.rotation.y = pos.rotY + yawOffset;
        _boatDummy.rotation.x = pitch;
        _boatDummy.rotation.z = roll;
        _boatDummy.scale.set(1.8, 1.8, 1.8);
        _boatDummy.updateMatrix();

        if (Array.isArray(hulls)) {
          const colorIdx = chunkGroup.userData.boatColorIndices[index];
          const instIdx = chunkGroup.userData.boatInstIndices[index];
          hulls[colorIdx].setMatrixAt(instIdx, _boatDummy.matrix);
        } else {
          hulls.setMatrixAt(index, _boatDummy.matrix);
        }

        masts.setMatrixAt(index, _boatDummy.matrix);
        sails.setMatrixAt(index, _boatDummy.matrix);
        if (rims) rims.setMatrixAt(index, _boatDummy.matrix);
        if (decks) decks.setMatrixAt(index, _boatDummy.matrix);
        if (booms) booms.setMatrixAt(index, _boatDummy.matrix);

        if (chunkGroup.userData.boatReflections) {
          _boatDummy.position.set(pos.x + dx, pos.y - dy, pos.z + dz);
          _boatDummy.rotation.set(0, 0, 0);
          _boatDummy.rotation.y = pos.rotY + yawOffset;
          _boatDummy.rotation.x = -pitch;
          _boatDummy.rotation.z = -roll;
          _boatDummy.scale.set(1.8, -1.8, 1.8);
          _boatDummy.updateMatrix();
          chunkGroup.userData.boatReflections.setMatrixAt(
            index,
            _boatDummy.matrix
          );
        }
      });

      if (Array.isArray(hulls)) {
        hulls.forEach((h) => {
          if (h) h.instanceMatrix.needsUpdate = true;
        });
      } else {
        hulls.instanceMatrix.needsUpdate = true;
      }

      masts.instanceMatrix.needsUpdate = true;
      sails.instanceMatrix.needsUpdate = true;
      if (rims) rims.instanceMatrix.needsUpdate = true;
      if (decks) decks.instanceMatrix.needsUpdate = true;
      if (booms) booms.instanceMatrix.needsUpdate = true;
      if (chunkGroup.userData.boatReflections) {
        chunkGroup.userData.boatReflections.instanceMatrix.needsUpdate = true;
      }
    }

    // Animate Pirate Ships (Patrolling & Bobbing)
    if (
      chunkGroup.userData.pirateHulls &&
      chunkGroup.userData.pirateShipPositions
    ) {
      const hulls = chunkGroup.userData.pirateHulls;
      const rims = chunkGroup.userData.pirateRims;
      const decks = chunkGroup.userData.pirateDecks;
      const masts = chunkGroup.userData.pirateMasts;
      const flags = chunkGroup.userData.pirateFlags;
      const jollyRogers = chunkGroup.userData.pirateJollyRogers;
      const sailInsts = chunkGroup.userData.pirateSails;
      const positions = chunkGroup.userData.pirateShipPositions;

      const sailCounts = _pirateSailCounts.fill(0);

      positions.forEach((pos, index) => {
        const patrolRadius = 40 + _boatHash(index, 7) * 30;
        const patrolSpeed = 0.05 + _boatHash(index, 8) * 0.03;
        const patrolPhase = _boatHash(index, 9) * Math.PI * 2;

        const t = clock.getElapsed() * patrolSpeed + patrolPhase;
        const dx = Math.cos(t) * patrolRadius;
        const dz = Math.sin(t) * patrolRadius;

        const tangentYaw = Math.atan2(-Math.sin(t), Math.cos(t));

        // Bobbing & Wave dynamics (Roll/Pitch)
        const bobTime = clock.getElapsed() * 0.8 + patrolPhase;
        const dy = Math.sin(bobTime) * 0.25;
        const roll = Math.sin(bobTime * 0.7) * 0.03;
        const pitch = Math.cos(bobTime * 0.9) * 0.02;

        _boatDummy.position.set(pos.x + dx, pos.y + dy, pos.z + dz);
        _boatDummy.rotation.set(0, 0, 0);
        _boatDummy.rotation.y = tangentYaw + Math.PI;
        _boatDummy.rotation.x = pitch;
        _boatDummy.rotation.z = roll;
        _boatDummy.scale.set(2.5, 2.5, 2.5);
        _boatDummy.updateMatrix();

        const colorIdx = pos.bodyId;
        const instIdx = sailCounts[colorIdx]++;
        sailInsts[colorIdx].setMatrixAt(instIdx, _boatDummy.matrix);

        hulls.setMatrixAt(index, _boatDummy.matrix);
        rims.setMatrixAt(index, _boatDummy.matrix);
        decks.setMatrixAt(index, _boatDummy.matrix);
        masts.setMatrixAt(index, _boatDummy.matrix);
        flags.setMatrixAt(index, _boatDummy.matrix);
        jollyRogers.setMatrixAt(index, _boatDummy.matrix);

        if (chunkGroup.userData.pirateReflections) {
          _boatDummy.position.set(pos.x + dx, pos.y - dy, pos.z + dz);
          _boatDummy.rotation.set(0, 0, 0);
          _boatDummy.rotation.y = tangentYaw + Math.PI;
          _boatDummy.rotation.x = -pitch;
          _boatDummy.rotation.z = -roll;
          _boatDummy.scale.set(2.5, -2.5, 2.5);
          _boatDummy.updateMatrix();
          chunkGroup.userData.pirateReflections.setMatrixAt(
            index,
            _boatDummy.matrix
          );
        }
      });

      hulls.instanceMatrix.needsUpdate = true;
      rims.instanceMatrix.needsUpdate = true;
      decks.instanceMatrix.needsUpdate = true;
      masts.instanceMatrix.needsUpdate = true;
      flags.instanceMatrix.needsUpdate = true;
      jollyRogers.instanceMatrix.needsUpdate = true;
      sailInsts.forEach((inst) => {
        if (inst) inst.instanceMatrix.needsUpdate = true;
      });
      if (chunkGroup.userData.pirateReflections) {
        chunkGroup.userData.pirateReflections.instanceMatrix.needsUpdate = true;
      }
    }
  });

  // Update Cockpit HUD
  const hudTarget = isFreeCamera ? camera : planeGroup;
  const hudHeadingY = isFreeCamera ? camera.rotation.y : planeGroup.rotation.y;

  const hours = (timeOfDay / (Math.PI * 2)) * 24;
  const hh = Math.floor(hours).toString().padStart(2, '0');
  const mm = Math.floor((hours % 1) * 60)
    .toString()
    .padStart(2, '0');
  const timeStr = `${hh}:${mm}`;

  const dirStr = ChillFlightLogic.computeHeadingDirection(hudHeadingY);
  const latVal = -hudTarget.position.z / latScale;
  const lonVal = hudTarget.position.x / latScale;
  const latStr =
    Math.abs(latVal).toFixed(3) + '\u00b0 ' + (latVal >= 0 ? 'N' : 'S');
  const lonStr =
    Math.abs(lonVal).toFixed(3) + '\u00b0 ' + (lonVal >= 0 ? 'E' : 'W');
  const coordStr = `${latStr} ${lonStr}`;
  const altStr = `${Math.round(Math.max(0, hudTarget.position.y - 45.5) * 25)}`;
  const spdStr = `${Math.round(BASE_FLIGHT_SPEED * flightSpeedMultiplier * 60)} KTS`;

  updateDOM('cockpit-time', timeStr);
  updateDOM('cockpit-dir', dirStr);
  updateDOM('cockpit-coords', coordStr);
  updateDOM('cockpit-alt', altStr);
  updateDOM('cockpit-spd', spdStr);

  sunMesh.position.set(
    sunX * sunOrbitRadius,
    sunY * sunOrbitRadius,
    sunZ * sunOrbitRadius
  );
  moonMesh.position.set(
    moonX * moonOrbitRadius,
    moonY * moonOrbitRadius,
    moonZ * moonOrbitRadius
  );
}
window.updateFlightCamera = updateFlightCamera;
