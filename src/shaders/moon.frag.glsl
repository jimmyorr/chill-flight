    uniform float uTime;
    uniform float overcast;
    uniform float dayFactor;
    uniform float moonPhase;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vObjectNormal;

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

    void main() {
        vec2 uv = vUv * 6.0;
        float v1 = voronoi(uv);
        float v2 = voronoi(uv * 2.0 + uTime * 0.004);
        float n = v1 * 0.7 + v2 * 0.3;
        
        vec3 baseCol = vec3(0.85, 0.85, 0.95);
        vec3 darkCol = vec3(0.8, 0.8, 0.9);
        vec3 color = mix(darkCol, baseCol, smoothstep(0.3, 0.7, n));
        
        vec3 normal = normalize(vNormal);
        vec3 objNormal = normalize(vObjectNormal);
        
        float phaseAngle = moonPhase * 6.283185307;
        vec3 lightDir = normalize(vec3(sin(phaseAngle), 0.0, cos(phaseAngle)));
        
        float illum = dot(objNormal, lightDir);
        float phaseMask = smoothstep(-0.05, 0.05, illum);
        
        // Earthshine is basically invisible, just a tiny bit of opacity
        float baseAlpha = mix(0.02, 1.0, phaseMask);
        
        // Fresnel rim glow only on the lit portion
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
        fresnel = pow(fresnel, 3.0);
        color += vec3(0.95, 0.95, 1.0) * fresnel * 0.15 * phaseMask;
        
        // Final alpha includes the phase mask (so the dark side is transparent)
        float alpha = baseAlpha * clamp(1.0 - overcast, 0.0, 1.0);
        
        gl_FragColor = vec4(color, alpha);
    }
