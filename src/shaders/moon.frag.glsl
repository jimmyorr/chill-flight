    uniform float uTime;
    uniform float overcast;
    uniform float dayFactor;
    uniform vec3 uSunDirectionWorld;
    uniform mat3 uMoonRotMat;
    uniform float uCloudDensity;
    uniform float uCloudHeight;
    uniform vec3 uMoonSkyDir;
    uniform vec3 uCameraPos;
    uniform sampler2D uMoonMap;
    uniform float uHasMoonMap;
    uniform bool uShowClouds;
    uniform float offset;
    uniform float uSkyTime;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vObjectNormal;

    const float CIRRUS_HEIGHT = 3.0;
    const float MACKEREL_HEIGHT = 2.0;

    vec2 highCloudUV(vec3 dir, float h, float H) {
        float t = max(H - uCameraPos.y, 1.0) / h;
        return (uCameraPos.xz + dir.xz * t) / H;
    }

    vec2 random2(vec2 p) {
        return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
    }

    float voronoi(vec2 x) {
        vec2 n = floor(x);
        vec2 f = fract(x);
        float res = 8.0;
        for(int j=-1; j<=1; j++)
        for(int i=-1; i<=1; i++) {
            vec2 g = vec2(float(i),float(j));
            vec2 o = random2(n + g);
            o = 0.5 + 0.5*sin(uTime * 0.01 + 6.2831 * o);
            vec2 r = g + o - f;
            float d = dot(r,r);
            res = min(res, d);
        }
        return sqrt(res);
    }

    vec2 getUV(vec3 normal) {
        float u = 0.5 + atan(normal.x, normal.z) / 6.283185307;
        float v = 0.5 + asin(normal.y) / 3.14159265;
        return vec2(u, v);
    }

    // Exact per-pixel cloud coverage matching sky.frag.glsl (cirrus, mackerel,
    // cumulus, and horizon clouds) so clouds drift seamlessly across both the
    // sunlit crescent and dark limb even when the moon swells 5-10x on a trip
    float getCloudCoverage(vec3 dir) {
        float h = dir.y;
        float cloudHeight = uCloudHeight > 0.0 ? uCloudHeight : 3000.0;
        float distToPlane = cloudHeight - uCameraPos.y;
        bool seesDeck = (distToPlane * h) > 0.0 && distToPlane > 0.0;
        float cover = 0.0;

        if (seesDeck || h > 0.0) {
            float densityOffset = (uCloudDensity - 0.5) * 0.6;
            float horizonFade = smoothstep(0.0, 0.15, abs(h));

            if (uCloudTypes.y > 0.0 && h > 0.0) {
                vec2 uvCirrus = (highCloudUV(dir, h, cloudHeight * CIRRUS_HEIGHT)
                                 + CLOUD_WIND * uSkyTime * 0.012) * 2.0;
                #ifdef ANIME_SKY
                float aCirrus = animeCirrusShape(uvCirrus).x * horizonFade
                              * smoothstep(0.0, 0.35, uCloudTypes.y) * cirrusViewFade(dir) * 0.95;
                #else
                float aCirrus = smoothstep(0.3, 0.55, cirrusShape(uvCirrus)) * horizonFade
                              * uCloudTypes.y * cirrusViewFade(dir) * 0.6;
                #endif
                cover = 1.0 - (1.0 - cover) * (1.0 - aCirrus);
            }

            if (uCloudTypes.z > 0.0 && h > 0.0) {
                vec2 uvMackerel = (highCloudUV(dir, h, cloudHeight * MACKEREL_HEIGHT)
                                   + CLOUD_WIND * uSkyTime * 0.02) * 4.5;
                float shapeMackerel = mackerelShape(uvMackerel);
                #ifdef ANIME_SKY
                float aaMackerel = max(0.04, fwidth(shapeMackerel));
                float aMackerel = smoothstep(0.42 - aaMackerel, 0.42 + aaMackerel, shapeMackerel)
                                * smoothstep(0.08, 0.35, abs(h)) * uCloudTypes.z * 0.95;
                #else
                float aMackerel = smoothstep(0.2, 0.6, shapeMackerel)
                                * smoothstep(0.08, 0.35, abs(h)) * uCloudTypes.z * 0.85;
                #endif
                cover = 1.0 - (1.0 - cover) * (1.0 - aMackerel);
            }

            if (seesDeck && uCloudTypes.x > 0.0) {
                float t = distToPlane / h;
                vec2 cloudUV = (uCameraPos.xz + dir.xz * t) / cloudHeight;
                vec2 uvLow = (cloudUV + CLOUD_WIND * uSkyTime * 0.034) * 2.0;
                vec2 q;
                float detail = smoothstep(0.05, 0.3, abs(h));
                float nLow = cumulusShape(uvLow, detail, q);
                float closeness = 1.0 - smoothstep(1200.0, 4000.0, t);
                float edgeStart = 0.42 - densityOffset - uCloudCover;
                float edgeWidth = mix(0.16, 0.32, closeness);
                #ifdef ANIME_SKY
                edgeWidth *= 0.5;
                #endif
                float aLow = smoothstep(edgeStart, edgeStart + edgeWidth, nLow)
                           * horizonFade * uCloudTypes.x * 0.92;
                cover = 1.0 - (1.0 - cover) * (1.0 - aLow);
            }
        }

        if (h > -0.05 && h < 0.30) {
            float driftTime = uSkyTime * 0.001;
            float angle = atan(dir.x, dir.z);
            float w = smoothstep(3.14159 - 0.05, 3.14159, abs(angle));
            vec2 uvScale = vec2(5.0, 15.0);
            vec2 horizonUV1 = vec2(angle, h) * uvScale + vec2(driftTime, driftTime * 0.2);
            float nHorizon = fbm(horizonUV1);
            if (w > 0.0) {
                float angle2 = angle > 0.0 ? angle - 3.14159 : angle + 3.14159;
                nHorizon = mix(nHorizon, fbm(vec2(angle2, h) * uvScale + vec2(driftTime, driftTime * 0.2)), w);
            }
            float vFade = (1.0 - smoothstep(0.15, 0.30, h)) * smoothstep(-0.02, 0.04, h);
            float shapeThreshold = 0.30 - (uCloudDensity - 0.5) * 0.4 + max(0.0, h) * 1.5;
            #ifdef ANIME_SKY
            float horizonEdge = 0.07;
            #else
            float horizonEdge = 0.25;
            #endif
            float aHorizon = smoothstep(shapeThreshold, shapeThreshold + horizonEdge, nHorizon) * vFade
                           * (1.0 - smoothstep(0.0, 300.0, -distToPlane));
            cover = 1.0 - (1.0 - cover) * (1.0 - aHorizon);
        }

        return clamp(cover, 0.0, 1.0);
    }

    void main() {
        vec3 objNormal = normalize(vObjectNormal);
        vec3 worldNormal = normalize(uMoonRotMat * objNormal);

        // Crater texture from object-space normals (stable on the geometry)
        vec2 objUv = getUV(objNormal);
        vec2 uv = objUv * 6.0;

        float v1 = voronoi(uv);
        float v2 = voronoi(uv * 2.0 + uTime * 0.004);
        float n = v1 * 0.7 + v2 * 0.3;

        // Slight warm tint at night, neutral during day
        vec3 nightTint = vec3(0.90, 0.88, 0.82);
        vec3 dayTint = vec3(0.85, 0.85, 0.95);
        vec3 baseCol = mix(nightTint, dayTint, dayFactor);
        vec3 darkCol = baseCol * 0.92;
        vec3 color = mix(darkCol, baseCol, smoothstep(0.3, 0.7, n));
        // The real near side: its maria and bright highlands, Tycho's rays.
        // Object space has z toward the camera and x to screen right, so
        // longitude 0 faces us with east to the right, north up.
        if (uHasMoonMap > 0.5) {
            float albedo = texture2D(uMoonMap, objUv).r;
            color = baseCol * mix(0.62, 1.12, smoothstep(0.08, 0.75, albedo));
        }

        // Phase lighting in world space - softer terminator for natural look
        float illum = dot(worldNormal, normalize(uSunDirectionWorld));
        float phaseMask = smoothstep(-0.12, 0.12, illum);

        // Earthshine: subtle glow on the dark side so maria faintly read inside the crescent
        float earthshine = mix(0.06, 0.02, dayFactor);
        float baseAlpha = mix(earthshine, 1.0, phaseMask);

        // Fresnel rim glow on the lit portion (from unscaled billboard sphere Z)
        float fresnel = 1.0 - max(objNormal.z, 0.0);
        fresnel = pow(fresnel, 3.0);
        color += vec3(0.95, 0.95, 1.0) * fresnel * 0.18 * phaseMask;

        // Cloud occlusion - moon fades behind every cloud layer pixel by pixel
        vec3 viewDirWorld = normalize((vec4(-vViewPosition, 0.0) * viewMatrix).xyz);
        vec3 skyDir = normalize(viewDirWorld * 25000.0 + vec3(0.0, offset, 0.0));
        float cloudCover = uShowClouds ? getCloudCoverage(skyDir) : 0.0;
        #ifdef ANIME_TOWERS
        // ...and behind the anime style's towering horizon clouds
        if (uShowClouds) {
            float towerDist = towerDistance(skyDir, uSkyTime, vec2(0.0));
            cloudCover = max(cloudCover, towerAlphaAt(towerDist, skyDir.y, uCloudDensity) * 0.96);
        }
        #endif

        // Fade moon opacity: fully visible at night, subtle silhouette during day
        float dayFade = mix(1.0, 0.08, dayFactor);

        // Final alpha: phase × weather × cloud occlusion × day fade
        float alpha = baseAlpha * clamp(1.0 - overcast, 0.0, 1.0) * (1.0 - cloudCover) * dayFade;

        gl_FragColor = vec4(color, alpha);
    }
