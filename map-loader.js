// map-loader.js

(function() {
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    window.addEventListener('drop', (e) => {
        e.preventDefault();

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            
            // Only accept images
            if (!file.type.match('image.*')) {
                console.warn("Dropped file is not an image.");
                return;
            }

            const reader = new FileReader();

            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const pixels = imgData.data;
                    
                    // Extract Luminance with alpha pre-multiplication (so transparent regions are correctly 0)
                    const floatData = new Float32Array(canvas.width * canvas.height);
                    for (let i = 0; i < floatData.length; i++) {
                        const idx = i * 4;
                        const r = pixels[idx];
                        const g = pixels[idx + 1];
                        const b = pixels[idx + 2];
                        const a = pixels[idx + 3] / 255.0;
                        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) * a;
                        floatData[i] = luminance; // 0-255 range
                    }
                    
                    // Update the logic engine
                    window.ChillFlightLogic.customMap = {
                        data: floatData,
                        width: canvas.width,
                        height: canvas.height
                    };
                    
                    console.log(`Custom heightmap loaded: ${canvas.width}x${canvas.height}`);
                    
                    // Force terrain rebuild
                    if (typeof chunks !== 'undefined' && typeof updateChunks === 'function') {
                        // Dispose all previous procedural chunks manually
                        chunks.forEach((group, key) => {
                            group.traverse(child => {
                                if (child.isMesh || child.isInstancedMesh) {
                                    child.geometry.dispose();
                                }
                            });
                            if (typeof scene !== 'undefined') {
                                scene.remove(group);
                            }
                        });
                        chunks.clear();
                        
                        // Reset plane position and state
                        if (typeof planeGroup !== 'undefined') {
                            planeGroup.position.set(0, 1000, 0); 
                            planeGroup.rotation.set(0, 0, 0);
                        }
                        
                        try {
                            if (typeof targetFlightSpeed !== 'undefined') {
                                targetFlightSpeed = 1.0; // Cruise speed
                                flightSpeedMultiplier = 1.0;
                            }
                        } catch(e) {}
                        
                        updateChunks();
                    } else {
                        console.warn("chunks or updateChunks is not available yet.");
                    }
                };
                img.src = event.target.result;
            };

            reader.readAsDataURL(file);
        }
    });
})();
