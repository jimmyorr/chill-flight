    varying vec2 vUv;
    void main() {
        vUv = uv;
        mat4 modelView = modelViewMatrix;
        
        // Extract scale from modelViewMatrix to preserve scaling
        float scaleX = length(vec3(modelView[0].x, modelView[0].y, modelView[0].z));
        float scaleY = length(vec3(modelView[1].x, modelView[1].y, modelView[1].z));
        float scaleZ = length(vec3(modelView[2].x, modelView[2].y, modelView[2].z));

        // Spherical billboarding
        modelView[0][0] = scaleX; modelView[0][1] = 0.0; modelView[0][2] = 0.0;
        modelView[1][0] = 0.0; modelView[1][1] = scaleY; modelView[1][2] = 0.0;
        modelView[2][0] = 0.0; modelView[2][1] = 0.0; modelView[2][2] = scaleZ;
        
        gl_Position = projectionMatrix * modelView * vec4(position, 1.0);
    }
