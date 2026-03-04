
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';


// --- Basic Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- Starry Sky ---
const starVertices = [];
for (let i = 0; i < 20000; i++) {
    const x = (Math.random() - 0.5) * 4000, y = (Math.random() - 0.5) * 4000, z = (Math.random() - 0.5) * 4000;
    starVertices.push(x, y, z);
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 2 });
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

// --- Lighting & Post-processing ---
const pointLight = new THREE.PointLight(0xffffff, 2, 100);
pointLight.position.set(3, 3, 3);
scene.add(pointLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.1));
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.1, 0.2, 0.1));


// --- Phase 1: Bloch Sphere ---
const sphereGroup = new THREE.Group();

// Main sphere with Fresnel effect
const fresnelMaterial = new THREE.ShaderMaterial({ uniforms: { uOpacity: { value: 1.0 }, uTime: { value: 0.0 }, uColor: { value: new THREE.Color(0x00ffff) } }, vertexShader: `varying vec3 vNormal; varying vec3 vLookAt; void main() { vec4 worldPosition = modelMatrix * vec4(position, 1.0); vNormal = normalize(normalMatrix * normal); vLookAt = normalize(cameraPosition - worldPosition.xyz); gl_Position = projectionMatrix * viewMatrix * worldPosition; }`, fragmentShader: `
        uniform float uOpacity;
        uniform float uTime;
        uniform vec3 uColor;
        varying vec3 vNormal;
        varying vec3 vLookAt;

        void main() {
            float fresnel = pow(1.0 - dot(vNormal, vLookAt), 4.0);
            float wave = sin(vNormal.x * 10.0 + uTime * 2.0) * cos(vNormal.y * 10.0 + uTime * 2.0) * 0.1;
            float halo = smoothstep(0.7, 1.0, fresnel) * (0.5 + wave);
            gl_FragColor = vec4(uColor, (fresnel + halo) * uOpacity);
        }
    `, transparent: true, blending: THREE.AdditiveBlending });
const sphereGeometry = new THREE.SphereGeometry(1.5, 64, 64);
const boxGeometry = new THREE.BoxGeometry(2.2, 2.2, 2.2, 32, 32, 32);

sphereGeometry.morphAttributes.position = [new THREE.Float32BufferAttribute(boxGeometry.attributes.position.array, 3)];

const mainSphere = new THREE.Mesh(sphereGeometry, fresnelMaterial);
mainSphere.morphTargetInfluences = [0];
sphereGroup.add(mainSphere);

// Equatorial ring
const ringGeometry = new THREE.RingGeometry(1.5, 1.55, 64);
const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
const ring = new THREE.Mesh(ringGeometry, ringMaterial);
ring.rotation.x = Math.PI / 2;
sphereGroup.add(ring);

// Axes
const axisMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.2 });
const axisRadius = 0.01;
const axisLength = 3.5;
const xAxis = new THREE.Mesh(new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8), axisMaterial);
xAxis.rotation.z = Math.PI / 2;
sphereGroup.add(xAxis);
const yAxis = new THREE.Mesh(new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8), axisMaterial);
sphereGroup.add(yAxis);
const zAxis = new THREE.Mesh(new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8), axisMaterial);
zAxis.rotation.x = Math.PI / 2;
sphereGroup.add(zAxis);

// State Vector (Arrow)
const stateVector = new THREE.ArrowHelper(
    new THREE.Vector3(1, 1, 1).normalize(), // Initial direction
    new THREE.Vector3(0, 0, 0), // Origin
    1.5, // length
    0xffffff, // color
    0.2, // headLength
    0.1 // headWidth
);
sphereGroup.add(stateVector);



scene.add(sphereGroup);

const blochFormulaContainer = document.getElementById('bloch-formula-container');
if (blochFormulaContainer) {
    katex.render("|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle", blochFormulaContainer, { throwOnError: false });
    gsap.to(blochFormulaContainer, { opacity: 1, duration: 2, delay: 0.5 });
}


// --- Phase 2: Data Breathing & Interactive Particles ---
const particleCount = 1000000;
const positions = new Float32Array(particleCount * 3);
const isLogical = new Float32Array(particleCount);
const gridSize = 100;
const logicalQubitIndices = new Set();
for (let i = 0; i < 48; i++) logicalQubitIndices.add(Math.floor(Math.random() * particleCount));
for (let i = 0; i < particleCount; i++) {
    const x = (i % gridSize) - gridSize / 2, y = Math.floor((i / gridSize) % gridSize) - gridSize / 2, z = Math.floor(i / (gridSize * gridSize)) - gridSize / 2;
    positions.set([x * 1.5, y * 1.5, z * 1.5], i * 3);
    isLogical[i] = logicalQubitIndices.has(i) ? 1.0 : 0.0;
}
const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
particleGeometry.setAttribute('isLogical', new THREE.BufferAttribute(isLogical, 1));
const particleMaterial = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0.0 }, uOpacity: { value: 0.0 }, uDimFactor: { value: 1.0 }, uMouse: { value: new THREE.Vector2(10, 10) }, uColor1: { value: new THREE.Color('blue') }, uColor2: { value: new THREE.Color('gold') } }, vertexShader: `attribute float isLogical; varying float vIsLogical; varying float vHeight; uniform float uTime; uniform vec2 uMouse; void main() { vIsLogical = isLogical; vec4 modelPos = modelMatrix * vec4(position, 1.0); if (isLogical < 0.5) { modelPos.y += (sin(modelPos.x * 0.05 + uTime * 0.5) + cos(modelPos.z * 0.05 + uTime * 0.5)) * 5.0; } vHeight = modelPos.y; vec4 viewPos = viewMatrix * modelPos; vec4 projectedPos = projectionMatrix * viewPos; vec2 screenPos = projectedPos.xy / projectedPos.w; float distance = length(screenPos - uMouse); if (distance < 0.4) { viewPos.xyz += normalize(viewPos.xyz) * ((0.4 - distance) / 0.4) * 15.0; } gl_Position = projectionMatrix * viewPos; gl_PointSize = 150.0 / -viewPos.z; if (isLogical > 0.5) { gl_PointSize *= 5.0; } }`, fragmentShader: `uniform float uOpacity; uniform float uDimFactor; uniform vec3 uColor1; uniform vec3 uColor2; varying float vIsLogical; varying float vHeight; void main() { if (vIsLogical > 0.5) { gl_FragColor = vec4(1.0, 0.84, 0.0, uOpacity); } else { gl_FragColor = vec4(mix(uColor1, uColor2, clamp((vHeight + 30.0) / 60.0, 0.0, 1.0)) * uDimFactor, uOpacity); } }`, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);

// --- qLDPC Energy Lines ---
const logicalQubitPositions = [];
for (const index of logicalQubitIndices) logicalQubitPositions.push(new THREE.Vector3(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]));
const lineVertices = [];
for (let i = 0; i < logicalQubitPositions.length; i++) {
    const p1 = logicalQubitPositions[i], p2 = logicalQubitPositions[(i + 1) % logicalQubitPositions.length];
    lineVertices.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
}
const lineGeometry = new THREE.BufferGeometry();
lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lineVertices, 3));
const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
const energyLines = new THREE.LineSegments(lineGeometry, lineMaterial);
scene.add(energyLines);

// --- Red "Error" Particles ---
const errorParticleCount = 500;
const errorParticleGeometry = new THREE.BufferGeometry();
const errorParticlePositions = new Float32Array(errorParticleCount * 3);
const errorParticleInitialPositions = [];
const errorParticleArrivalTimes = [];

for (let i = 0; i < errorParticleCount; i++) {
    // Start from a wide range of positions outside the initial view
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 15 + Math.random() * 10;
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);
    errorParticlePositions[i * 3] = x;
    errorParticlePositions[i * 3 + 1] = y;
    errorParticlePositions[i * 3 + 2] = z;
    errorParticleInitialPositions.push(new THREE.Vector3(x, y, z));
    // Each particle will complete its journey at a random point (between 50% and 100%) in the animation's progress
    errorParticleArrivalTimes.push(0.5 + Math.random() * 0.5);
}
errorParticleGeometry.setAttribute('position', new THREE.BufferAttribute(errorParticlePositions, 3));

const errorParticleMaterial = new THREE.PointsMaterial({
    color: 0xff0000,
    size: 0.08,
    transparent: true,
    opacity: 0.0, // Initially invisible
    blending: THREE.AdditiveBlending
});

const errorParticles = new THREE.Points(errorParticleGeometry, errorParticleMaterial);
scene.add(errorParticles);

// --- Animation and Interaction ---
let isAnimating = false;
let hasAnimatedOnce = false;
window.addEventListener('click', () => {
    if (isAnimating || hasAnimatedOnce) return;
    isAnimating = true;
    hasAnimatedOnce = true;
    controls.enabled = false;

    const tl = gsap.timeline({
        onComplete: () => {
            // Sphere and error particles have faded out via opacity animations.
            // This triggers the next phase.
            showQLDPC();
        }
    });

    // Hide the Bloch sphere formula
    if (blochFormulaContainer) {
        gsap.killTweensOf(blochFormulaContainer); // Stop any ongoing animations
        tl.to(blochFormulaContainer, { opacity: 0, duration: 0.5 }, 0);
    }
    tl.to([label0, label1], { opacity: 0, duration: 1.0 }, 0);

    // 2. Animate red error particles attacking the sphere
    tl.to(errorParticleMaterial, { opacity: 0.8, duration: 1.5 }, 0);

    let hasCollapsed = false;

    const animationControl = { progress: 0 };
    tl.to(animationControl, {
        progress: 1,
        duration: 3.0,
        ease: 'power1.inOut',
        onUpdate: () => {
            // Timing for color change, morphing, and scaling
            const startEffectProgress = 0.8;
            const endEffectProgress = 1.0;
            const effectRange = endEffectProgress - startEffectProgress;
            const currentEffectProgress = Math.max(0, (animationControl.progress - startEffectProgress) / effectRange);
            const easedEffectProgress = Math.pow(currentEffectProgress, 2); // For a faster end

            const positions = errorParticles.geometry.attributes.position.array;
            const sphereRadius = 1.5;
            let collisionDetected = false;

            const effectiveRadius = sphereRadius * (1.0 - easedEffectProgress);

            for (let i = 0; i < errorParticleCount; i++) {
                const initialPos = errorParticleInitialPositions[i];
                const arrivalTime = errorParticleArrivalTimes[i];
                const particleProgress = Math.min(1.0, animationControl.progress / arrivalTime);
                const currentPos = initialPos.clone().multiplyScalar(1 - particleProgress);

                if (currentPos.length() < sphereRadius) {
                    // Particle has reached or passed the original sphere boundary.
                    if (!hasCollapsed) collisionDetected = true;

                    if (easedEffectProgress > 0) {
                        // If we are in the shrinking phase, make these particles stick to the shrinking surface.
                        currentPos.setLength(effectiveRadius);
                    } else {
                        // Before shrinking, they stick to the original surface.
                        currentPos.setLength(sphereRadius);
                    }
                } else if (easedEffectProgress > 0) {
                    // If we are in the shrinking phase and the particle hasn't reached the sphere yet, hide it.
                    currentPos.set(Infinity, Infinity, Infinity);
                }

                positions[i * 3] = currentPos.x;
                positions[i * 3 + 1] = currentPos.y;
                positions[i * 3 + 2] = currentPos.z;
            }
            errorParticles.geometry.attributes.position.needsUpdate = true;

            if (collisionDetected && !hasCollapsed) {
                hasCollapsed = true;
                const targetPole = Math.random() > 0.5 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, -1, 0);
                const currentDirection = { ...stateVector.direction };
                gsap.to(currentDirection, {
                    x: targetPole.x,
                    y: targetPole.y,
                    z: targetPole.z,
                    duration: 2.5,
                    ease: 'power3.in',
                    onUpdate: () => {
                        stateVector.setDirection(new THREE.Vector3(currentDirection.x, currentDirection.y, currentDirection.z).normalize());
                    }
                });
            }

            // Color change
            fresnelMaterial.uniforms.uColor.value.lerpColors(new THREE.Color(0x00ffff), new THREE.Color(0xff0000), easedEffectProgress);

            // Opacity and Morphing
            fresnelMaterial.uniforms.uOpacity.value = 1.0 - easedEffectProgress;
            if (mainSphere.geometry.morphAttributes.position) {
                mainSphere.morphTargetInfluences[0] = easedEffectProgress;
            }

            // Scaling down
            mainSphere.scale.setScalar(1.0 - easedEffectProgress);

            // When shrinking starts, immediately hide the ring, axes, and state vector
            if (easedEffectProgress > 0) {
                if (ring.visible) { // Prevent this from running on every frame
                    ring.visible = false;
                    xAxis.visible = false;
                    yAxis.visible = false;
                    zAxis.visible = false;
                    stateVector.visible = false;
                }
            }
        }
    }, 0.5);

    // 4. After the collapse, transition to the 1M particle grid
    tl.to(particleMaterial.uniforms.uOpacity, {
        value: 1,
        duration: 2,
        ease: 'power2.inOut'
    }, 2.5); // Overlap with the end of the collapse animation

    // 5. Fade out error particles as they are absorbed
    tl.to(errorParticleMaterial, { opacity: 0.0, duration: 2.0 }, 3.0);

    // 6. Zoom out to reveal the full grid
    tl.to(camera.position, { z: 50, duration: 4, ease: 'power2.inOut' }, 3.0);
});

function showQLDPC() {
    const finalFormulaContainer = document.getElementById('final-formula-container');
    katex.render("\\text{Logical Qubits} = \\frac{N_{\\text{physical}}}{d^2}", finalFormulaContainer, { throwOnError: false });

    const tl = gsap.timeline({ onComplete: () => { controls.enabled = true; isAnimating = false; } });
    tl.to(particleMaterial.uniforms.uDimFactor, { value: 0.1, duration: 3, ease: 'power2.out' }, 0)
      .to(finalFormulaContainer, { opacity: 1, duration: 3, ease: 'power2.out' }, 0)
      .to(energyLines.material, { opacity: 0.6, duration: 3, ease: 'power2.out' }, 0);
}

// --- UI & Render Loop ---
const label0 = document.getElementById('label-0');
const label1 = document.getElementById('label-1');
katex.render("|0\\rangle", label0, { throwOnError: false });
katex.render("|1\\rangle", label1, { throwOnError: false });
const label0Pos = new THREE.Vector3(0, 1.7, 0);
const label1Pos = new THREE.Vector3(0, -1.7, 0);
let errorRate = 0.0125;
const errorRateCounter = document.getElementById('error-rate-counter');
const mouse = new THREE.Vector2(10, 10);
window.addEventListener('mousemove', (event) => { mouse.x = (event.clientX / window.innerWidth) * 2 - 1; mouse.y = -(event.clientY / window.innerHeight) * 2 + 1; particleMaterial.uniforms.uMouse.value.copy(mouse); });
window.addEventListener('mouseleave', () => { mouse.set(10, 10); particleMaterial.uniforms.uMouse.value.copy(mouse); });

const clock = new THREE.Clock();
function animate() {
    const elapsedTime = clock.getElapsedTime();
    particleMaterial.uniforms.uTime.value = elapsedTime;
    fresnelMaterial.uniforms.uTime.value = elapsedTime;
    if (!isAnimating) {
        sphereGroup.rotation.y += 0.002;

    } else if (sphereGroup.visible === false) {
        if (errorRate > 0.00000001) {
            errorRate *= 0.95;
            errorRateCounter.textContent = `PHYS_ERR: ${errorRate.toFixed(8)}`;
        } else {
            errorRate = 0;
            errorRateCounter.textContent = `PHYS_ERR: ${errorRate.toFixed(8)}`;
        }
    }
    requestAnimationFrame(animate);
    controls.update();
    composer.render();

    // Update label positions
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    [label0, label1].forEach((label, i) => {
        const pos = i === 0 ? label0Pos : label1Pos;
        const worldPos = pos.clone().applyMatrix4(sphereGroup.matrixWorld);
        const screenPos = worldPos.project(camera);

        const x = (screenPos.x * width / 2) + width / 2;
        const y = -(screenPos.y * height / 2) + height / 2;

        label.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
    });
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});
