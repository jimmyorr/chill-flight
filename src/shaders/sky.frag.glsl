    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform vec3 sunDirection;
    uniform float offset;
    uniform float exponent;
    uniform float glowPower;
    uniform float mieFactor;
    uniform float uTime;
    uniform float uCloudDensity;
    uniform float uCloudHeight;
    uniform bool uShowClouds;
    uniform float uAuroraIntensity;
    uniform vec3 uCameraPos;
    varying vec3 vWorldPosition;
    varying vec3 vDirection;

    void main() {
        vec3 dir = normalize(vDirection + vec3(0.0, offset, 0.0));
        float h = dir.y;
        
        // Calculate sun influence (0 to 1) based on direction
        float baseSunIntensity = max(0.0, dot(dir, sunDirection));
        // Gradual fade for sun effects as sun dips below horizon
        float sunFade = smoothstep(-0.25, 0.0, sunDirection.y);
        float sunIntensity = baseSunIntensity * sunFade;
        
        // Horizon base color matches bottomColor 360 degrees around the player,
        // blending seamlessly with the directional fog, which uses the same
        // skyColorAt() (constants.js, prepended to this shader by sky.js).
        vec3 effectiveBottom = bottomColor;
        vec3 col = skyColorAt(dir, topColor, bottomColor, sunDirection, 1.0);

        // Moonlit nights: a soft halo around the moon, fading into the sky.
        float moonAlign = max(dot(dir, uMoonDir), 0.0);
        col += vec3(0.5, 0.58, 0.75) * uMoonBright
             * (pow(moonAlign, 60.0) * 0.3 + pow(moonAlign, 8.0) * 0.06);
        
        // --- PROCEDURAL CLOUDS: cirrus, mackerel sky and cumulus layers ---
        float cloudHeight = uCloudHeight > 0.0 ? uCloudHeight : 3000.0;
        float distToPlane = cloudHeight - uCameraPos.y;
        
        // If below clouds (dist > 0), we look up (h > 0). If above clouds (dist < 0), we look down (h < 0).
        if (uShowClouds && (distToPlane * h) > 0.0) {
            float t = distToPlane / h;
            vec2 cloudUV = (uCameraPos.xz + dir.xz * t) / cloudHeight;
            vec2 sunDir2D = length(sunDirection.xz) > 0.001 ? normalize(sunDirection.xz) : vec2(1.0, 0.0);
            
            // Dim direct sun slightly in overcast conditions, but keep plenty of ambient scatter
            float stormDimming = 1.0 - uCloudDensity * 0.6;
            float sunProximity = pow(sunIntensity, 3.0) * stormDimming;
            
            // Soft, billowy base tones: bright crests remain luminous (0.75-0.95),
            // and shadows stay soft (0.42-0.55) instead of collapsing into harsh, pitch-black mud
            vec3 baseBright = mix(vec3(0.95, 0.96, 0.98), vec3(0.72, 0.75, 0.80), uCloudDensity * 0.6);
            vec3 baseShadow = mix(vec3(0.55, 0.58, 0.64), vec3(0.42, 0.45, 0.50), uCloudDensity * 0.5);
            // A storm deck is darker than the overcast sky in its gaps
            float storm = stormDeck(uCloudDensity);
            stormDeckShade(storm, baseBright, baseShadow);
            
            // Shadows are softly tinted by the ambient sky and horizon light rather than dropping to pure darkness
            vec3 ambientTint = mix(effectiveBottom, topColor, 0.35);
            vec3 shadowColor = mix(baseShadow, ambientTint * 1.1, 0.25);
            vec3 brightEdgeColor = mix(baseBright, bottomColor * 1.8, sunProximity * 0.75);
            
            // Sunrise/sunset lighting (gold toward the sun, pink away, cool shadows)
            duskCloudLight(dir, sunDir2D, stormDimming, sunDirection, topColor, bottomColor, brightEdgeColor, shadowColor);
            
            // Widen the density range for clearer skies and thicker storms
            float densityOffset = (uCloudDensity - 0.5) * 0.6;
            float horizonFade = smoothstep(0.0, 0.15, abs(h));
            
            // Contrast softening at high density: multiple scattering in thick overcast softens sharp shadow boundaries
            float contrastFactor = mix(1.0, 0.65, uCloudDensity);
            float sunRim = pow(sunIntensity, 16.0) * stormDimming;

            // -- Layer 1: Cirrus streaks (highest, slowest) --
            // High clouds see the sun a little longer, so they keep their
            // sunset color after the lower ones have gone dark
            if (uCloudTypes.y > 0.0) {
                vec2 uvCirrus = (cloudUV + CLOUD_WIND * uTime * 0.012) * 2.0;
                float alphaCirrus = smoothstep(0.3, 0.55, cirrusShape(uvCirrus)) * horizonFade * uCloudTypes.y
                                  * cirrusViewFade(dir);
                if (alphaCirrus > 0.0) {
                    vec3 cirrusSun = normalize(sunDirection + vec3(0.0, 0.05, 0.0));
                    vec3 cirrusBright = mix(baseBright, bottomColor * 1.8, sunProximity * 0.75);
                    vec3 cirrusShadow = mix(baseShadow, ambientTint * 1.1, 0.25);
                    duskCloudLight(dir, sunDir2D, stormDimming, cirrusSun, topColor, bottomColor, cirrusBright, cirrusShadow);
                    // Thin and bright: mostly lit, with a soft rim toward the sun
                    vec3 cirrusColor = mix(cirrusShadow, cirrusBright, 0.8) + bottomColor * sunRim * 1.2;
                    col = mix(col, cirrusColor, alphaCirrus * 0.6);
                }
            }

            // -- Layer 2: Mackerel sky (rows of small puffs) --
            if (uCloudTypes.z > 0.0) {
                vec2 uvMackerel = (cloudUV + CLOUD_WIND * uTime * 0.02) * 4.5;
                // Fine rows shimmer near the horizon, so they fade out sooner.
                // A wide edge band: thin puffs are see-through at their edges
                float shapeMackerel = mackerelShape(uvMackerel);
#ifdef ANIME_SKY
                // Crisp puffs, with the edge softening as the rows shrink with
                // distance (fwidth: how much the shape changes per pixel)
                float aaMackerel = max(0.04, fwidth(shapeMackerel));
                float alphaMackerel = smoothstep(0.42 - aaMackerel, 0.42 + aaMackerel, shapeMackerel)
                                    * smoothstep(0.08, 0.35, abs(h)) * uCloudTypes.z;
#else
                float alphaMackerel = smoothstep(0.2, 0.6, shapeMackerel)
                                    * smoothstep(0.08, 0.35, abs(h)) * uCloudTypes.z;
#endif
                if (alphaMackerel > 0.0) {
                    // Thick centers are shaded from below; the sunward side
                    // and thin edges are lit
                    float thickness = smoothstep(0.35, 0.8, shapeMackerel);
                    float edge = smoothstep(0.2, 0.7, mackerelShape(uvMackerel + sunDir2D * 0.02));
                    float lit = mix(1.0, 0.55, max(thickness * 0.7, edge * 0.5));
#ifdef ANIME_SKY
                    // Two tones: lit, with a lavender rim on the side away
                    // from the sun (shading by thickness reads as rings)
                    float awayMackerel = mackerelShape(uvMackerel - sunDir2D * 0.03);
                    lit = mix(0.35, 1.0, smoothstep(0.3, 0.42, awayMackerel));
                    vec3 mackerelColor = mix(shadowColor * vec3(0.94, 0.88, 1.1), brightEdgeColor, lit);
                    float mackerelOpacity = 0.95;
#else
                    vec3 mackerelColor = mix(shadowColor, brightEdgeColor, lit);
                    float mackerelOpacity = 0.85;
#endif
                    mackerelColor += bottomColor * sunRim * 1.5;
                    col = mix(col, mackerelColor, alphaMackerel * mackerelOpacity);
                }
            }

            // -- Layer 3: Puffy cumulus (lowest, fastest) --
            // Warped noise curls the edges into billows; fine detail breaks
            // them up up close and fades with distance so it doesn't shimmer
            if (uCloudTypes.x > 0.0) {
                vec2 uvLow = (cloudUV + CLOUD_WIND * uTime * 0.034) * 2.0;
                vec2 q;
                float detail = smoothstep(0.05, 0.3, abs(h));
                float nLow = cumulusShape(uvLow, detail, q);
                // Crisp edges far away; softer up close, where a crisp edge
                // looks like a paper cutout
                float closeness = 1.0 - smoothstep(1200.0, 4000.0, t);
                float edgeStart = 0.42 - densityOffset - uCloudCover;
                float edgeWidth = mix(0.16, 0.32, closeness);
#ifdef ANIME_SKY
                // Crisp, cut-paper edges
                edgeWidth *= 0.5;
#endif
                float alphaLow = smoothstep(edgeStart, edgeStart + edgeWidth, nLow)
                               * horizonFade * uCloudTypes.x;
                
                if (alphaLow > 0.0) {
                    float nLowMacro = fbmMacro(q);
                    float nLowMacro_offset = fbmMacro(q + sunDir2D * 0.15);
                    float slopeLow = nLowMacro - nLowMacro_offset;
                    float litEdgeLow = smoothstep(-0.15, 0.25, slopeLow);
                    // Thick cores are darker than the thin edges
                    float thickness = smoothstep(0.5, 0.8, nLow);
                    
                    float lightFactorLow = mix(0.35, 1.0, litEdgeLow) * mix(1.0, 0.8, thickness);
                    lightFactorLow = mix(0.5, lightFactorLow, contrastFactor);
                    // Thin edges let light through, so they're bright rather
                    // than shadowed (no dark outline against the sky)
                    float thinEdge = 1.0 - smoothstep(edgeStart, edgeStart + edgeWidth * 1.5, nLow);
                    lightFactorLow = mix(lightFactorLow, 1.0, thinEdge * 0.75 * (1.0 - storm * 0.7));
                    
#ifdef ANIME_SKY
                    // Two tones: lit and a lavender shade
                    lightFactorLow = mix(0.35, 1.0, smoothstep(0.5, 0.65, lightFactorLow));
                    vec3 cloudColorLow = mix(shadowColor * vec3(0.94, 0.88, 1.1), brightEdgeColor, lightFactorLow);
#else
                    vec3 cloudColorLow = mix(shadowColor, brightEdgeColor, lightFactorLow);
#endif
                    cloudColorLow += bottomColor * sunRim * litEdgeLow * 2.0;
                    col = mix(col, cloudColorLow, alphaLow * 0.92);
                }
            }
        }

        // --- HORIZON CUMULUS CLOUDS ---
        // Rendered on a cylindrical band hugging the horizon
        if (uShowClouds && h > -0.05 && h < 0.30) {
            float driftTime = uTime * 0.001;
            float angle = atan(dir.x, dir.z);
            
            // The atan function wraps from -PI to PI when looking North, causing a sharp vertical seam.
            // We fix this by crossfading to a shifted UV space (horizonUV2) right at the seam.
            // Using a very tight window (0.05 radians) prevents blurry smudges during overcast weather.
            float w = smoothstep(3.14159 - 0.05, 3.14159, abs(angle));
            
            vec2 uvScale = vec2(5.0, 15.0);
            // A slow vertical drift makes them convect upwards and slowly morph over time
            vec2 horizonUV1 = vec2(angle, h) * uvScale + vec2(driftTime, driftTime * 0.2);
            
            float nHorizon = fbm(horizonUV1);
            vec2 horizonUV2;
            
            // Branch to avoid calculating secondary noise octaves across 98.4% of the sky
            if (w > 0.0) {
                // Shift the second UV's seam to South (where w=0, so it's safely ignored)
                float angle2 = angle > 0.0 ? angle - 3.14159 : angle + 3.14159;
                horizonUV2 = vec2(angle2, h) * uvScale + vec2(driftTime, driftTime * 0.2);
                
                // Blend the two noise maps to completely eliminate the wrapping seam
                nHorizon = mix(nHorizon, fbm(horizonUV2), w);
            }
            
            // Fade out the upper bounds completely by 30 degrees up
            // Fade the bottom bounds softly into the horizon haze to eliminate hard cutoffs over water
            float vFade = (1.0 - smoothstep(0.15, 0.30, h)) * smoothstep(-0.02, 0.04, h);
            
            float densityOffset = (uCloudDensity - 0.5) * 0.4;
            
            // Elevation-based threshold: 
            // Thick and solid near the horizon (h=0), becoming sparse and puffy at the top
            float shapeThreshold = 0.30 - densityOffset + max(0.0, h) * 1.5;
#ifdef ANIME_SKY
            // Crisp, cut-paper edges
            float horizonEdge = 0.07;
#else
            float horizonEdge = 0.25;
#endif
            float alphaHorizon = smoothstep(shapeThreshold, shapeThreshold + horizonEdge, nHorizon) * vFade;
            
            if (alphaHorizon > 0.0) {
                float stormDimming = 1.0 - uCloudDensity * 0.6;
                float sunProximity = pow(sunIntensity, 3.0) * stormDimming;
                
                vec3 baseBright = mix(vec3(0.95, 0.96, 0.98), vec3(0.72, 0.75, 0.80), uCloudDensity * 0.6);
                vec3 baseShadow = mix(vec3(0.55, 0.58, 0.64), vec3(0.42, 0.45, 0.50), uCloudDensity * 0.5);
                float stormHorizon = stormDeck(uCloudDensity);
                stormDeckShade(stormHorizon, baseBright, baseShadow);
                
                vec3 ambientTint = mix(effectiveBottom, topColor, 0.35);
                vec3 shadowColor = mix(baseShadow, ambientTint * 1.1, 0.25);
                vec3 brightEdgeColor = mix(baseBright, bottomColor * 1.8, sunProximity * 0.75);
                
                // Sunrise/sunset lighting (gold toward the sun, pink away, cool shadows)
                vec2 sunDirH = length(sunDirection.xz) > 0.001 ? normalize(sunDirection.xz) : vec2(1.0, 0.0);
                duskCloudLight(dir, sunDirH, stormDimming, sunDirection, topColor, bottomColor, brightEdgeColor, shadowColor);
                
                // Dynamic volumetric shadowing based on true sun position
                vec3 tangentU = normalize(vec3(dir.z, 0.0, -dir.x));
                vec3 tangentV = cross(dir, tangentU);
                vec2 sunOffsetDir = vec2(dot(sunDirection, tangentU), dot(sunDirection, tangentV));
                
                vec2 dynamicOffset = sunOffsetDir * 0.06 * uvScale;
                
                // Use macro noise to prevent high-frequency ripple artifacts
                float nHorizonMacro = fbmMacro(horizonUV1);
                float nHorizon_offset = fbmMacro(horizonUV1 + dynamicOffset);
                
                if (w > 0.0) {
                    nHorizonMacro = mix(nHorizonMacro, fbmMacro(horizonUV2), w);
                    nHorizon_offset = mix(nHorizon_offset, fbmMacro(horizonUV2 + dynamicOffset), w);
                }

                
                float slopeHorizon = nHorizonMacro - nHorizon_offset;
                float litEdgeHorizon = smoothstep(-0.15, 0.25, slopeHorizon);
                
                float lightFactorHorizon = mix(0.4, 1.0, litEdgeHorizon);
                lightFactorHorizon = mix(0.5, lightFactorHorizon, mix(1.0, 0.65, uCloudDensity));
                
#ifdef ANIME_SKY
                // Two tones: lit and a lavender shade
                lightFactorHorizon = mix(0.3, 1.0, smoothstep(0.55, 0.62, lightFactorHorizon));
                vec3 cloudColorHorizon = mix(shadowColor * vec3(0.94, 0.88, 1.1), brightEdgeColor, lightFactorHorizon);
#else
                vec3 cloudColorHorizon = mix(shadowColor, brightEdgeColor, lightFactorHorizon);
#endif
                
                float sunRimHorizon = pow(sunIntensity, 16.0) * litEdgeHorizon * stormDimming;
                cloudColorHorizon += bottomColor * sunRimHorizon * 2.0;
                
                // Blend them beautifully into the sky
                col = mix(col, cloudColorHorizon, alphaHorizon);
            }
        }

#ifdef ANIME_TOWERS
        // --- TOWERING CUMULUS (anime style; shapes in TOWER_GLSL) ---
        // Lavender bodies with bright rims along their tops and sunward
        // sides, like the backdrops of a Ghibli sky
        if (uShowClouds) {
            vec2 azHere = normalize(dir.xz + vec2(1e-5));
            vec2 sunAz = length(sunDirection.xz) > 0.001 ? normalize(sunDirection.xz) : vec2(1.0, 0.0);
            // The light's direction across the sky here: up, tipped toward
            // whichever side the sun is on
            float sunAcross = dot(vec2(azHere.y, -azHere.x), sunAz);
            vec2 lightDir = normalize(vec2(-sunAcross * 0.8, 1.0));
            // A point is lit when a step toward the light leaves the cloud: a
            // bright band along the tops and sunward sides of the whole
            // outline (shading each puff separately would notch the inside)
            float bestToward;
            float best = towerDistance(dir, uTime, lightDir * 0.7, bestToward);
            float towerAlpha = towerAlphaAt(best, h, uCloudDensity);
            if (towerAlpha > 0.0) {
                float stormDimming = 1.0 - uCloudDensity * 0.6;
                float sunProximity = pow(sunIntensity, 3.0) * stormDimming;
                vec3 baseBright = mix(vec3(0.95, 0.96, 0.98), vec3(0.72, 0.75, 0.80), uCloudDensity * 0.6);
                vec3 baseShadow = mix(vec3(0.55, 0.58, 0.64), vec3(0.42, 0.45, 0.50), uCloudDensity * 0.5);
                stormDeckShade(stormDeck(uCloudDensity), baseBright, baseShadow);
                vec3 ambientTint = mix(effectiveBottom, topColor, 0.35);
                vec3 shadowColor = mix(baseShadow, ambientTint * 1.1, 0.25);
                vec3 brightEdgeColor = mix(baseBright, bottomColor * 1.8, sunProximity * 0.75);
                duskCloudLight(dir, sunAz, stormDimming, sunDirection, topColor, bottomColor, brightEdgeColor, shadowColor);
                float lit = smoothstep(-0.03, 0.03, bestToward);
                vec3 towerColor = mix(shadowColor * vec3(0.94, 0.88, 1.1), brightEdgeColor, mix(0.6, 1.0, lit));
                towerColor += bottomColor * pow(sunIntensity, 16.0) * stormDimming * lit * 1.5;
                col = mix(col, towerColor, towerAlpha * 0.96);
            }
        }
#endif

        // --- AURORA BOREALIS ---
        // Only renders when uAuroraIntensity > 0 (night + high latitude).
        // Hybrid: one wide sine wave gives the curtain sweep; an fBm brightness
        // mask breaks the uniform stripe look into organic patches of light.
        if (uAuroraIntensity > 0.001 && h > 0.0) {
            // Project onto the upper-sky dome using the xz plane
            vec2 auv = dir.xz / (h + 0.1);

            // Speed up the animation so the aurora visibly dances and pulses in real time
            float tSlow = uTime * 0.40;
            float tMed  = uTime * 0.80;

            // Organic UV warp: gives the curtains a natural flowing twist
            float warp = fbm(auv * 0.9 + vec2(tSlow * 0.6, tSlow * 0.35));

            // Primary curtain: reduced amplitude (0.25 not 0.5) so the troughs
            // stay at ~0.37 instead of 0 — no pure-black gaps between bands
            float sweep = sin((auv.x + warp * 1.4) * 2.2 + tMed * 0.45) * 0.25 + 0.62;

            // Second harmonic: very subtle, just adds organic variation
            float sweep2 = sin((auv.x + warp * 0.9) * 3.5 - tMed * 0.3 + 2.1) * 0.12 + 0.50;

            float curtain = sweep * 0.78 + sweep2 * 0.22;

            // fBm brightness mask: some curtain patches glow brighter, others dimmer
            float brightMask = fbm(auv * 1.8 + vec2(tSlow * 0.35, tMed * 0.25 + 0.6));
            curtain *= (brightMask * 1.2 + 0.4);

            // Low smoothstep floor so the dim inter-band areas still emit a faint glow
            curtain = smoothstep(0.08, 0.88, curtain);

            // Soft vertical fade: aurora blends to zero right at the horizon (h=0)
            float vFade = smoothstep(0.0, 0.15, h) * smoothstep(0.72, 0.30, h);

            // Compress the dynamic range: this makes low intensities (like 0.08) pop beautifully
            // without letting peak storms (1.0) blow out into a blinding neon light.
            float curvedIntensity = pow(uAuroraIntensity, 0.3);
            
            // Add a smooth fade at the very bottom to prevent it popping in when crossing the 0.001 threshold
            curvedIntensity *= smoothstep(0.0, 0.05, uAuroraIntensity);
            
            float auroraAlpha = curtain * vFade * curvedIntensity;

            // Three-band colour gradient: green core, teal edge, purple top
            vec3 auroraGreen  = vec3(0.05, 0.90, 0.45);
            vec3 auroraTeal   = vec3(0.0,  0.75, 0.70);
            vec3 auroraViolet = vec3(0.52, 0.15, 0.75);

            // Separate fBm layer controls which hue dominates in each patch
            float hueShift = fbm(auv * 1.8 + vec2(-tSlow * 0.4, tSlow * 0.8));
            vec3 auroraColor = mix(auroraGreen, auroraTeal,   smoothstep(0.35, 0.58, hueShift));
            auroraColor      = mix(auroraColor, auroraViolet, smoothstep(0.58, 0.82, hueShift));

            // Screen blend so the aurora brightens without crushing the star field
            // A gentle 0.45 multiplier keeps the peak storms vivid but incredibly chill
            vec3 auroraContrib = auroraColor * auroraAlpha * 0.45;
            col = col + auroraContrib * (vec3(1.0) - col);
        }

        gl_FragColor = vec4(col, 1.0);
    }
