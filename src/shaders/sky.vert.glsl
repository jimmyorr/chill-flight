    varying vec3 vDirection;
    void main() {
        vDirection = position.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
