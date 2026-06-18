    uniform float uTime;
    uniform float overcast;
    uniform float dayFactor;
    uniform vec3 uSunColor;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

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
        // Boiling surface
        vec2 uv = vUv * 5.0; // Larger features, less noisy
        uv.y += uTime * 0.05; // Slower movement
        float n = fbm(uv + fbm(uv + uTime * 0.1));
        
        vec3 color1 = uSunColor * 0.85; // Dynamic base color
        vec3 color2 = uSunColor;        // Dynamic hot spots
        vec3 baseColor = mix(color1, color2, n * 0.5 + 0.25); // Subtle blend
        
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
        fresnel = pow(fresnel, 3.0);
        baseColor += vec3(1.0, 0.9, 0.7) * fresnel * 0.4; // Softer rim light
        
        // Fade based on overcast and dayFactor
        float alpha = clamp(1.0 - overcast, 0.0, 1.0);
        alpha *= clamp(dayFactor * 2.0, 0.0, 1.0);
        
        gl_FragColor = vec4(baseColor, alpha);
    }
