  uniform float uAlpha;
  varying vec3 vLocalPosition;

  // Safe and highly compatible HSV to RGB
  vec3 hsv2rgb(vec3 c) {
      vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    // Calculate radial distance from center
    float dist = length(vLocalPosition.xy);
    
    // Normalize distance between inner radius (11000) and outer radius (13000)
    float radius = clamp((dist - 11000.0) / 2000.0, 0.0, 1.0);
    
    // Map radius (0.0 to 1.0) to hue (Red to Violet)
    float hue = (1.0 - radius) * 0.8;
    
    // Smoothly fade out edges of the rainbow band
    // A Gaussian-like curve that peaks at 0.5
    float edgeFade = smoothstep(0.0, 0.5, radius) * smoothstep(1.0, 0.5, radius);
    
    // Restored saturation slightly to 0.7 for better visibility
    vec3 color = hsv2rgb(vec3(hue, 0.7, 1.0));
    
    // Max alpha bumped to 0.10
    gl_FragColor = vec4(color, uAlpha * edgeFade * 0.10);
  }
