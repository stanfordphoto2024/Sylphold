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
            float fresnel = 1.0 - abs(dot(vNormal, vLookAt));
            fresnel = pow(fresnel, 2.0);
            vec3 finalColor = mix(uColor, vec3(1.0), fresnel * 0.5);
            gl_FragColor = vec4(finalColor, fresnel * uOpacity);
        }
    `, transparent: true, side: THREE.DoubleSide });

const sphereGeometry = new THREE.SphereGeometry(1.5, 64, 64);
const mainSphere = new THREE.Mesh(sphereGeometry, fresnelMaterial);
sphereGroup.add(mainSphere);

// Bloch sphere labels |0⟩ and |1⟩
const label0 = document.getElementById('label-0');
const label1 = document.getElementById('label-1');

function updateLabels() {
    const vector0 = new THREE.Vector3(0, 0, 1.8);
    const vector1 = new THREE.Vector3(0, 0, -1.8);
    
    vector0.applyMatrix4(mainSphere.matrixWorld);
    vector1.applyMatrix4(mainSphere.matrixWorld);
    
    vector0.project(camera);
    vector1.project(camera);
    
    const x0 = (vector0.x * 0.5 + 0.5) * window.innerWidth;
    const y0 = (-vector0.y * 0.5 + 0.5) * window.innerHeight;
    const x1 = (vector1.x * 0.5 + 0.5) * window.innerWidth;
    const y1 = (-vector1.y * 0.5 + 0.5) * window.innerHeight;
    
    label0.style.left = `${x0}px`;
    label0.style.top = `${y0}px`;
    label1.style.left = `${x1}px`;
    label1.style.top = `${y1}px`;
    
    if (typeof katex !== 'undefined') {
        katex.render('|0\\rangle', label0);
        katex.render('|1\\rangle', label1);
    }
}

// --- Phase 2: Quantum State Visualization ---
let blochSphereState = { theta: 0, phi: 0 };
let animationPhase = 0;

// State vector visualization
const stateVectorGroup = new THREE.Group();
const arrowHelper = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 1.2, 0xff0000, 0.3, 0.1);
stateVectorGroup.add(arrowHelper);

// --- Phase 3: Interactive Quantum Circuit ---
let circuitElements = [];
let currentGateIndex = 0;

// --- Phase 4: Final Visualization ---
let finalState = null;
let measurementResult = null;

// --- Animation and Controls ---
let clock = new THREE.Clock();
let isAnimating = true;

function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();
    
    // Update star rotation
    stars.rotation.y += 0.0002;
    
    // Update Bloch sphere
    if (fresnelMaterial.uniforms.uTime) {
        fresnelMaterial.uniforms.uTime.value = elapsed;
    }
    
    // Update quantum state
    if (animationPhase === 1) {
        blochSphereState.theta = Math.sin(elapsed * 0.5) * Math.PI;
        blochSphereState.phi = elapsed * 0.3;
        
        const x = Math.sin(blochSphereState.theta) * Math.cos(blochSphereState.phi);
        const y = Math.sin(blochSphereState.theta) * Math.sin(blochSphereState.phi);
        const z = Math.cos(blochSphereState.theta);
        
        arrowHelper.setDirection(new THREE.Vector3(x, y, z));
        arrowHelper.position.copy(sphereGroup.position);
    }
    
    // Update circuit visualization
    if (animationPhase === 2 && circuitElements.length > 0) {
        circuitElements.forEach((element, index) => {
            if (index === currentGateIndex) {
                element.material.emissive.setHex(0x444444);
            } else {
                element.material.emissive.setHex(0x000000);
            }
        });
        
        if (Math.floor(elapsed * 2) % 2 === 0) {
            currentGateIndex = (currentGateIndex + 1) % circuitElements.length;
        }
    }
    
    // Update final state
    if (animationPhase === 3) {
        if (finalState) {
            finalState.rotation.y += 0.01;
        }
    }
    
    // Update formula displays
    if (typeof katex !== 'undefined') {
        const formulaContainer = document.getElementById('formula-container');
        const finalFormulaContainer = document.getElementById('final-formula-container');
        const blochFormulaContainer = document.getElementById('bloch-formula-container');
        
        if (formulaContainer && formulaContainer.style.opacity > 0) {
            katex.render('\\psi = \\alpha|0\\rangle + \\beta|1\\rangle', formulaContainer);
        }
        
        if (finalFormulaContainer && finalFormulaContainer.style.opacity > 0) {
            katex.render('\\langle\\psi|\\psi\\rangle = 1', finalFormulaContainer);
        }
        
        if (blochFormulaContainer && blochFormulaContainer.style.opacity > 0) {
            katex.render('\\theta = ' + blochSphereState.theta.toFixed(2) + ', \\phi = ' + blochSphereState.phi.toFixed(2), blochFormulaContainer);
        }
    }
    
    updateLabels();
    
    if (controls) controls.update();
    
    if (composer) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }
}

// --- Event Listeners ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) {
        composer.setSize(window.innerWidth, window.innerHeight);
    }
});

// --- GSAP Animations ---
if (typeof gsap !== 'undefined') {
    // Fade in formula
    gsap.to('#formula-container', { opacity: 1, duration: 2, delay: 1 });
    
    // Fade in final formula
    gsap.to('#final-formula-container', { opacity: 1, duration: 2, delay: 3 });
    
    // Fade in Bloch formula
    gsap.to('#bloch-formula-container', { opacity: 1, duration: 2, delay: 5 });
    
    // Fade in error rate counter
    gsap.to('#error-rate-counter', { opacity: 1, duration: 1, delay: 7 });
    
    // Fade in Bloch labels
    gsap.to('.bloch-label', { opacity: 0.7, duration: 1, delay: 2 });
}

// --- Initialize Scene ---
scene.add(sphereGroup);
scene.add(stateVectorGroup);

// Start animation
animate();

// --- Phase Transitions ---
setTimeout(() => { animationPhase = 1; }, 2000);
setTimeout(() => { animationPhase = 2; }, 6000);
setTimeout(() => { animationPhase = 3; }, 10000);
setTimeout(() => { animationPhase = 4; }, 14000);