    uniform float uTime;
    uniform float overcast;
    uniform float dayFactor;
    uniform vec3 uSunDirectionWorld;
    uniform mat3 uMoonRotMat;
    uniform sampler2D uNoiseTex;
    uniform float uCloudDensity;
    uniform vec3 uMoonSkyDir;
    uniform vec3 uCameraPos;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vObjectNormal;

    vec2 random2(vec2 p) {
        return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
    }

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

    // Approximate cloud coverage at the moon's sky position
    // Uses the same noise texture and drift as the sky shader's volumetric clouds
    float getCloudCoverage() {
        float h = uMoonSkyDir.y;
        if (h < 0.01) return 0.0; // Below horizon — no overhead clouds visible

        float cloudHeight = 3000.0;
        float distToPlane = cloudHeight - uCameraPos.y;
        // Only occlude when camera is below the cloud plane looking up
        if (distToPlane <= 0.0) return 0.0;

        float t = distToPlane / h;
        vec2 cloudUV = (uCameraPos.xz + uMoonSkyDir.xz * t) / cloudHeight;

        float densityOffset = (uCloudDensity - 0.5) * 0.6;

        // Sample both cloud layers with matching drift
        vec2 driftHigh = vec2(uTime * 0.015, uTime * 0.0075);
        float nHigh = fbm((cloudUV + driftHigh) * 3.5);
        float alphaHigh = smoothstep(0.45 - densityOffset, 0.8 - densityOffset, nHigh);

        vec2 driftLow = vec2(uTime * 0.03, uTime * 0.015);
        float nLow = fbm((cloudUV + driftLow) * 2.0);
        float alphaLow = smoothstep(0.4 - densityOffset, 0.75 - densityOffset, nLow);

        // Combine layers (same weights as sky shader)
        return min(1.0, alphaHigh * 0.7 + alphaLow * 0.9);
    }

    void main() {
        vec3 normal = normalize(vNormal);
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

        // Phase lighting in world space — softer terminator for natural look
        float illum = dot(worldNormal, normalize(uSunDirectionWorld));
        float phaseMask = smoothstep(-0.12, 0.12, illum);

        // Earthshine: faint glow on the dark side
        float baseAlpha = mix(0.02, 1.0, phaseMask);

        // Fresnel rim glow only on the lit portion
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
        fresnel = pow(fresnel, 3.0);
        color += vec3(0.95, 0.95, 1.0) * fresnel * 0.15 * phaseMask;

        // Cloud occlusion — moon fades behind clouds
        float cloudCover = getCloudCoverage();

        // Fade moon opacity: fully visible at night, subtle silhouette during day
        float dayFade = mix(1.0, 0.08, dayFactor);

        // Final alpha: phase × weather × cloud occlusion × day fade
        float alpha = baseAlpha * clamp(1.0 - overcast, 0.0, 1.0) * (1.0 - cloudCover) * dayFade;

        gl_FragColor = vec4(color, alpha);
    }
