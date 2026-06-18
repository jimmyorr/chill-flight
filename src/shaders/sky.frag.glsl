    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform vec3 sunDirection;
    uniform float offset;
    uniform float exponent;
    uniform float glowPower;
    uniform float mieFactor;
    uniform float uTime;
    uniform float uCloudDensity;
    uniform bool uShowClouds;
    uniform float uAuroraIntensity;
    uniform vec3 uCameraPos;
    varying vec3 vWorldPosition;
    varying vec3 vDirection;

    uniform sampler2D uNoiseTex;

    float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return texture2D(uNoiseTex, (i + u + 0.5) / 256.0).r;
    }

    float fbm(vec2 st) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i++) {
            value += amplitude * noise(st);
            st *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }

    void main() {
        vec3 dir = normalize(vDirection + vec3(0.0, offset, 0.0));
        float h = dir.y;
        
        // Calculate sun influence (0 to 1) based on direction
        float sunIntensity = max(0.0, dot(dir, sunDirection));
        
        // Base atmospheric scattering glow
        float glow = pow(sunIntensity, glowPower);
        
        // Mute the bottom color when away from the sun for realistic horizon falloff
        vec3 effectiveBottom = mix(topColor * 0.7, bottomColor, glow * mieFactor + (1.0 - mieFactor));
        
        // Base vertical gradient
        vec3 col = mix(effectiveBottom, topColor, max(pow(max(h, 0.0), exponent), 0.0));
        
        // --- STUNNING SUN BLOOM ---
        // 1. Wide, soft atmospheric scattering (takes on the sunset's bottomColor)
        vec3 wideGlow = bottomColor * pow(sunIntensity, 6.0) * 0.6 * (1.0 - h);
        // 2. Warm fiery mid-halo
        vec3 warmHalo = vec3(1.0, 0.6, 0.1) * pow(sunIntensity, 24.0) * 0.8;
        // 3. Intense hot core (bright golden-white, tighter)
        vec3 hotCore = vec3(1.0, 0.95, 0.8) * pow(sunIntensity, 512.0) * 2.5;
        // Screen blend the bloom so it brightens beautifully without blowing out completely
        vec3 totalGlow = wideGlow + warmHalo + hotCore;
        col = col + totalGlow * (vec3(1.0) - col);
        
        // --- VOLUMETRIC PROCEDURAL CLOUDS (DUAL LAYER PARALLAX) ---
        float cloudHeight = 3000.0;
        float distToPlane = cloudHeight - uCameraPos.y;
        
        // If below clouds (dist > 0), we look up (h > 0). If above clouds (dist < 0), we look down (h < 0).
        if (uShowClouds && (distToPlane * h) > 0.0) {
            float t = distToPlane / h;
            vec2 cloudUV = (uCameraPos.xz + dir.xz * t) / cloudHeight;
            vec2 sunDir2D = length(sunDirection.xz) > 0.001 ? normalize(sunDirection.xz) : vec2(1.0, 0.0);
            
            // Dim the sun's influence on clouds during a storm
            float stormDimming = 1.0 - uCloudDensity * 0.8;
            float sunProximity = pow(sunIntensity, 3.0) * stormDimming;
            
            // Darken the base cloud colors during a storm
            vec3 baseShadow = mix(vec3(0.15, 0.15, 0.2), vec3(0.05, 0.06, 0.08), uCloudDensity);
            vec3 baseBright = mix(vec3(0.9, 0.9, 0.95), vec3(0.4, 0.45, 0.5), uCloudDensity);
            
            vec3 shadowColor = mix(topColor * 0.5, baseShadow, 0.5);
            vec3 brightEdgeColor = mix(baseBright, bottomColor * 2.0, sunProximity);
            
            // Widen the density range for clearer skies and thicker storms
            float densityOffset = (uCloudDensity - 0.5) * 0.6;
            float horizonFade = smoothstep(0.0, 0.15, abs(h));

            // -- Layer 1: High Altitude (Cirrus/Altocumulus) --
            // Moves slower, larger scale, slightly more sparse
            vec2 driftHigh = vec2(uTime * 0.015, uTime * 0.0075);
            float nHigh = fbm((cloudUV + driftHigh) * 3.5);
            float alphaHigh = smoothstep(0.45 - densityOffset, 0.8 - densityOffset, nHigh) * horizonFade;
            
            if (alphaHigh > 0.0) {
                float nHigh_offset = fbm((cloudUV + driftHigh + sunDir2D * 0.04) * 3.5);
                float litEdgeHigh = smoothstep(0.1, -0.1, nHigh_offset - nHigh);
                vec3 cloudColorHigh = mix(shadowColor, brightEdgeColor, litEdgeHigh);
                float sunRimHigh = pow(sunIntensity, 16.0) * litEdgeHigh * stormDimming;
                cloudColorHigh += bottomColor * sunRimHigh * 1.5;
                // Mix high altitude layer first
                col = mix(col, cloudColorHigh, alphaHigh * 0.7);
            }

            // -- Layer 2: Low Altitude (Cumulus) --
            // Moves faster, normal scale
            vec2 driftLow = vec2(uTime * 0.03, uTime * 0.015);
            float nLow = fbm((cloudUV + driftLow) * 2.0);
            float alphaLow = smoothstep(0.4 - densityOffset, 0.75 - densityOffset, nLow) * horizonFade;
            
            if (alphaLow > 0.0) {
                float nLow_offset = fbm((cloudUV + driftLow + sunDir2D * 0.06) * 2.0);
                float litEdgeLow = smoothstep(0.1, -0.1, nLow_offset - nLow);
                vec3 cloudColorLow = mix(shadowColor, brightEdgeColor, litEdgeLow);
                float sunRimLow = pow(sunIntensity, 16.0) * litEdgeLow * stormDimming;
                cloudColorLow += bottomColor * sunRimLow * 2.0;
                // Mix low altitude layer on top
                col = mix(col, cloudColorLow, alphaLow * 0.9);
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
            
            // Shift the second UV's seam to South (where w=0, so it's safely ignored)
            float angle2 = angle > 0.0 ? angle - 3.14159 : angle + 3.14159;
            vec2 horizonUV2 = vec2(angle2, h) * uvScale + vec2(driftTime, driftTime * 0.2);
            
            // Blend the two noise maps to completely eliminate the wrapping seam
            float nHorizon = mix(fbm(horizonUV1), fbm(horizonUV2), w);
            
            // Fade out the upper bounds completely by 30 degrees up
            // Fade the bottom bounds softly into the horizon haze to eliminate hard cutoffs over water
            float vFade = (1.0 - smoothstep(0.15, 0.30, h)) * smoothstep(-0.02, 0.04, h);
            
            float densityOffset = (uCloudDensity - 0.5) * 0.4;
            
            // Elevation-based threshold: 
            // Thick and solid near the horizon (h=0), becoming sparse and puffy at the top
            float shapeThreshold = 0.30 - densityOffset + max(0.0, h) * 1.5;
            float alphaHorizon = smoothstep(shapeThreshold, shapeThreshold + 0.25, nHorizon) * vFade;
            
            if (alphaHorizon > 0.0) {
                float stormDimming = 1.0 - uCloudDensity * 0.8;
                float sunProximity = pow(sunIntensity, 3.0) * stormDimming;
                
                vec3 baseShadow = mix(vec3(0.15, 0.15, 0.2), vec3(0.05, 0.06, 0.08), uCloudDensity);
                vec3 baseBright = mix(vec3(0.95, 0.95, 1.0), vec3(0.4, 0.45, 0.5), uCloudDensity);
                
                vec3 shadowColor = mix(topColor * 0.5, baseShadow, 0.5);
                vec3 brightEdgeColor = mix(baseBright, bottomColor * 2.0, sunProximity);
                
                // Dynamic volumetric shadowing based on true sun position
                vec3 tangentU = normalize(vec3(dir.z, 0.0, -dir.x));
                vec3 tangentV = cross(dir, tangentU);
                vec2 sunOffsetDir = vec2(dot(sunDirection, tangentU), dot(sunDirection, tangentV));
                
                vec2 dynamicOffset = sunOffsetDir * 0.05 * uvScale;
                
                // Apply the seam blending to the shadowing offset as well
                float nOffset1 = fbm(horizonUV1 + dynamicOffset);
                float nOffset2 = fbm(horizonUV2 + dynamicOffset);
                float nHorizon_offset = mix(nOffset1, nOffset2, w);
                
                float litEdgeHorizon = smoothstep(0.05, -0.05, nHorizon_offset - nHorizon);
                
                vec3 cloudColorHorizon = mix(shadowColor, brightEdgeColor, litEdgeHorizon);
                
                float sunRimHorizon = pow(sunIntensity, 16.0) * litEdgeHorizon * stormDimming;
                cloudColorHorizon += bottomColor * sunRimHorizon * 2.0;
                
                // Blend them beautifully into the sky
                col = mix(col, cloudColorHorizon, alphaHorizon);
            }
        }

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
