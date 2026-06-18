    uniform float overcast;
    uniform float dayFactor;
    uniform vec3 uSunColor;
    varying vec2 vUv;

    void main() {
        float dist = distance(vUv, vec2(0.5));
        
        // Smooth, gentle falloff
        float alpha = pow(max(0.0, 1.0 - (dist * 2.0)), 2.5);
        
        // Use purely the natural sun color, no artificial white core
        vec3 color = uSunColor;
        
        // Very slight intensity boost
        color *= (1.0 + alpha * 0.2);
        
        // Lower overall opacity for maximum subtlety
        alpha *= 0.35;
        
        alpha *= clamp(1.0 - overcast, 0.0, 1.0);
        alpha *= clamp(dayFactor * 2.0, 0.0, 1.0);
        
        gl_FragColor = vec4(color, alpha);
    }
