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

    float fbmMacro(vec2 st) {
        float value = 0.0;
        float amplitude = 0.65;
        for (int i = 0; i < 2; i++) {
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
        float baseSunIntensity = max(0.0, dot(dir, sunDirection));
        // Gradual fade for sun effects as sun dips below horizon
        float sunFade = smoothstep(-0.25, 0.0, sunDirection.y);
        float sunIntensity = baseSunIntensity * sunFade;
        
        // Base atmospheric scattering glow
        float glow = pow(sunIntensity, glowPower);
        
        // Mute the bottom color when away from the sun for realistic horizon falloff
        vec3 effectiveBottom = mix(topColor * 0.7, bottomColor, glow * mieFactor + (1.0 - mieFactor));
        
        // Base vertical gradient
        vec3 col = mix(effectiveBottom, topColor, max(pow(max(h, 0.0), exponent), 0.0));
        
        // Lower hemisphere continues the base color
        if (h < 0.0) {
            col = effectiveBottom;
        }
        
        // --- STUNNING SUN BLOOM ---
        // Atmospheric extinction: as the sun nears the horizon, dense atmosphere
        // shifts the sun core from midday bright-white to rich sunset gold, and softens the harsh core.
        float sunElev = sunDirection.y;
        float horizonExtinction = smoothstep(-0.01, 0.12, sunElev);

        // 1. Wide atmospheric scattering: Fades in early with sunFade to warmly illuminate
        //    the horizon during twilight before the sun itself emerges.
        vec3 wideGlow = bottomColor * pow(baseSunIntensity, 6.0) * 0.6 * (1.0 - max(h, 0.0));
        vec3 ambientSunGlow = wideGlow * sunFade;

        // 2. Direct sun disc (warm halo + hot core):
        //    - Warm halo emerges smoothly as sun reaches horizon
        float haloFade = smoothstep(-0.03, 0.06, sunElev);
        vec3 warmHalo = vec3(1.0, 0.6, 0.15) * pow(baseSunIntensity, 24.0) * 0.8 * haloFade;

        //    - Hot core shifts from golden-amber at the horizon to brilliant white higher up,
        //      softening its blinding intensity near the horizon so it doesn't glare unnaturally.
        vec3 coreColor = mix(vec3(1.0, 0.65, 0.25), vec3(1.0, 0.95, 0.8), horizonExtinction);
        float coreStrength = mix(0.8, 2.5, horizonExtinction) * smoothstep(-0.01, 0.05, sunElev);
        vec3 hotCore = coreColor * pow(baseSunIntensity, 512.0) * coreStrength;

        // Combined sun bloom
        vec3 totalGlow = ambientSunGlow + warmHalo + hotCore;

        // Soft horizon ground-fade: smooth 9-degree gradient below the horizon so there is NEVER
        // a sharp cut or shelf across the sun.
        totalGlow *= smoothstep(-0.12, 0.04, h);

        col = col + totalGlow * (vec3(1.0) - col);
        
        // --- VOLUMETRIC PROCEDURAL CLOUDS (DUAL LAYER PARALLAX) ---
        float cloudHeight = 3000.0;
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
            
            // Shadows are softly tinted by the ambient sky and horizon light rather than dropping to pure darkness
            vec3 ambientTint = mix(effectiveBottom, topColor, 0.35);
            vec3 shadowColor = mix(baseShadow, ambientTint * 1.1, 0.25);
            vec3 brightEdgeColor = mix(baseBright, bottomColor * 1.8, sunProximity * 0.75);
            
            // Dramatic sunset/sunrise cloud under-lighting
            float sunsetGlow = smoothstep(0.2, -0.05, sunDirection.y) * smoothstep(-0.2, 0.0, sunDirection.y);
            brightEdgeColor = mix(brightEdgeColor, bottomColor * 2.2, sunsetGlow * stormDimming * 0.8);
            
            // Widen the density range for clearer skies and thicker storms
            float densityOffset = (uCloudDensity - 0.5) * 0.6;
            float horizonFade = smoothstep(0.0, 0.15, abs(h));
            
            // Contrast softening at high density: multiple scattering in thick overcast softens sharp shadow boundaries
            float contrastFactor = mix(1.0, 0.65, uCloudDensity);

            // -- Layer 1: High Altitude (Cirrus/Altocumulus) --
            // Moves slower, larger scale, slightly more sparse
            vec2 driftHigh = vec2(uTime * 0.015, uTime * 0.0075);
            vec2 uvHigh = (cloudUV + driftHigh) * 3.5;
            float nHigh = fbm(uvHigh);
            float alphaHigh = smoothstep(0.45 - densityOffset, 0.8 - densityOffset, nHigh) * horizonFade;
            
            if (alphaHigh > 0.0) {
                // Macro-slope avoids high-frequency noise aliasing and striped ripple artifacts
                float nHighMacro = fbmMacro(uvHigh);
                float nHighMacro_offset = fbmMacro(uvHigh + sunDir2D * 0.12);
                float slopeHigh = nHighMacro - nHighMacro_offset;
                float litEdgeHigh = smoothstep(-0.15, 0.25, slopeHigh);
                
                float lightFactorHigh = mix(0.4, 1.0, litEdgeHigh);
                lightFactorHigh = mix(0.5, lightFactorHigh, contrastFactor);
                
                vec3 cloudColorHigh = mix(shadowColor, brightEdgeColor, lightFactorHigh);
                float sunRimHigh = pow(sunIntensity, 16.0) * litEdgeHigh * stormDimming;
                cloudColorHigh += bottomColor * sunRimHigh * 1.5;
                // Mix high altitude layer first
                col = mix(col, cloudColorHigh, alphaHigh * 0.7);
            }

            // -- Layer 2: Low Altitude (Cumulus) --
            // Moves faster, normal scale
            vec2 driftLow = vec2(uTime * 0.03, uTime * 0.015);
            vec2 uvLow = (cloudUV + driftLow) * 2.0;
            float nLow = fbm(uvLow);
            float alphaLow = smoothstep(0.4 - densityOffset, 0.75 - densityOffset, nLow) * horizonFade;
            
            if (alphaLow > 0.0) {
                float nLowMacro = fbmMacro(uvLow);
                float nLowMacro_offset = fbmMacro(uvLow + sunDir2D * 0.15);
                float slopeLow = nLowMacro - nLowMacro_offset;
                float litEdgeLow = smoothstep(-0.15, 0.25, slopeLow);
                
                float lightFactorLow = mix(0.35, 1.0, litEdgeLow);
                lightFactorLow = mix(0.5, lightFactorLow, contrastFactor);
                
                vec3 cloudColorLow = mix(shadowColor, brightEdgeColor, lightFactorLow);
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
                float stormDimming = 1.0 - uCloudDensity * 0.6;
                float sunProximity = pow(sunIntensity, 3.0) * stormDimming;
                
                vec3 baseBright = mix(vec3(0.95, 0.96, 0.98), vec3(0.72, 0.75, 0.80), uCloudDensity * 0.6);
                vec3 baseShadow = mix(vec3(0.55, 0.58, 0.64), vec3(0.42, 0.45, 0.50), uCloudDensity * 0.5);
                
                vec3 ambientTint = mix(effectiveBottom, topColor, 0.35);
                vec3 shadowColor = mix(baseShadow, ambientTint * 1.1, 0.25);
                vec3 brightEdgeColor = mix(baseBright, bottomColor * 1.8, sunProximity * 0.75);
                
                // Dramatic sunset/sunrise horizon cloud under-lighting
                float sunsetGlowHorizon = smoothstep(0.2, -0.05, sunDirection.y) * smoothstep(-0.2, 0.0, sunDirection.y);
                brightEdgeColor = mix(brightEdgeColor, bottomColor * 2.2, sunsetGlowHorizon * stormDimming * 0.8);
                
                // Dynamic volumetric shadowing based on true sun position
                vec3 tangentU = normalize(vec3(dir.z, 0.0, -dir.x));
                vec3 tangentV = cross(dir, tangentU);
                vec2 sunOffsetDir = vec2(dot(sunDirection, tangentU), dot(sunDirection, tangentV));
                
                vec2 dynamicOffset = sunOffsetDir * 0.06 * uvScale;
                
                // Use macro noise to prevent high-frequency ripple artifacts
                float nMacro1 = fbmMacro(horizonUV1);
                float nMacro2 = fbmMacro(horizonUV2);
                float nHorizonMacro = mix(nMacro1, nMacro2, w);
                
                float nOffset1 = fbmMacro(horizonUV1 + dynamicOffset);
                float nOffset2 = fbmMacro(horizonUV2 + dynamicOffset);
                float nHorizon_offset = mix(nOffset1, nOffset2, w);
                
                float slopeHorizon = nHorizonMacro - nHorizon_offset;
                float litEdgeHorizon = smoothstep(-0.15, 0.25, slopeHorizon);
                
                float lightFactorHorizon = mix(0.4, 1.0, litEdgeHorizon);
                lightFactorHorizon = mix(0.5, lightFactorHorizon, mix(1.0, 0.65, uCloudDensity));
                
                vec3 cloudColorHorizon = mix(shadowColor, brightEdgeColor, lightFactorHorizon);
                
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
