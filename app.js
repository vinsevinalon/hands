// Cosmic Particles - Hand Gesture Interactive Visualization
// Optimized Version

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FilesetResolver, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm';

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    particles: {
        // Adaptive particle count based on device performance
        get count() {
            const isMobile = /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
            const isLowEnd = navigator.hardwareConcurrency <= 4;

            if (isMobile || isLowEnd) return 15000;
            if (navigator.hardwareConcurrency >= 8) return 40000;
            return 25000;
        },
        backgroundCount: 200,
        defaultSize: 7.0,
    },
    rendering: {
        pixelRatio: Math.min(window.devicePixelRatio, 2),
        antialias: false,
        powerPreference: "high-performance",
        toneMappingExposure: 1.5,
    },
    bloom: {
        threshold: 0.1,
        strength: 2.0,
        radius: 0.5,
    },
    camera: {
        fov: 60,
        near: 0.1,
        far: 1000,
        positionZ: 40,
    },
    video: {
        width: 320, // Reduced from 640 for better performance
        height: 240, // Reduced from 480
        facingMode: "user",
    },
    handDetection: {
        fps: 20, // Throttled from 60 FPS
        numHands: 2,
    },
    gestures: {
        swipeThreshold: 0.15,
        swipeCooldown: 1000,
        swipeVelocityMin: 0.15,
        modeThresholds: {
            enter: 0.6,
            exit: 0.35,
            decay: 0.05
        }
    },
    filters: {
        freq: 60,
        minCutoff: 1.0,
        beta: 0.08,
        dCutoff: 1.0
    },
    physics: {
        smoothingFactor: 0.1,
        gestureSmoothingFactor: 0.15,
        windSmoothingFactor: 0.1,
        rotationSmoothingFactor: 0.15,
        baseRotationSpeed: 0.05,
        maxGestureRotationSpeed: 3.0,
        fistRotationMultiplier: 1.75,
        minRotationVelocity: 0.15,
        rotationIdleDecay: 0.15,
    },
};

// ============================================
// SCENE SETUP
// ============================================
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000510, 0.015);

const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    CONFIG.camera.near,
    CONFIG.camera.far
);
camera.position.z = CONFIG.camera.positionZ;

const renderer = new THREE.WebGLRenderer({
    antialias: CONFIG.rendering.antialias,
    powerPreference: CONFIG.rendering.powerPreference
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(CONFIG.rendering.pixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = CONFIG.rendering.toneMappingExposure;
document.body.appendChild(renderer.domElement);

// ============================================
// POST PROCESSING
// ============================================
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5, 0.4, 0.85
);
bloomPass.threshold = CONFIG.bloom.threshold;
bloomPass.strength = CONFIG.bloom.strength;
bloomPass.radius = CONFIG.bloom.radius;

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// ============================================
// TEXTURES
// ============================================
function createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.5)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(canvas);
}
const particleTex = createParticleTexture();

const galaxyPalette = [
    new THREE.Color(0x6ddcff),
    new THREE.Color(0xb892ff),
    new THREE.Color(0xffd6a5),
    new THREE.Color(0x80ffea),
    new THREE.Color(0xa7c7ff)
];

function getGalaxyColor() {
    const base = galaxyPalette[Math.floor(Math.random() * galaxyPalette.length)].clone();
    const intensity = 0.6 + Math.random() * 0.5;
    return base.multiplyScalar(intensity);
}

class LowPassFilter {
    constructor(alpha, initialValue = 0) {
        this.setAlpha(alpha);
        this.initialized = false;
        this.prev = initialValue;
    }
    setAlpha(alpha) {
        this.alpha = Math.max(0, Math.min(1, alpha));
    }
    filter(value) {
        let result;
        if (this.initialized) {
            result = this.alpha * value + (1 - this.alpha) * this.prev;
        } else {
            result = value;
            this.initialized = true;
        }
        this.prev = result;
        return result;
    }
}

class OneEuroFilter {
    constructor(freq, minCutoff = 1.0, beta = 0, dCutoff = 1.0) {
        this.freq = freq;
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = dCutoff;
        this.xFilter = new LowPassFilter(this.alpha(minCutoff));
        this.dxFilter = new LowPassFilter(this.alpha(dCutoff));
        this.lastTime = null;
    }
    alpha(cutoff) {
        const te = 1.0 / this.freq;
        const tau = 1.0 / (2 * Math.PI * cutoff);
        return 1.0 / (1.0 + tau / te);
    }
    filter(value, timestamp) {
        if (this.lastTime !== null) {
            const dt = timestamp - this.lastTime;
            if (dt > 0) {
                this.freq = 1.0 / dt;
            }
        }
        this.lastTime = timestamp;
        const dValue = this.xFilter.initialized ? (value - this.xFilter.prev) * this.freq : 0;
        const edValue = this.dxFilter.filter(dValue);
        const cutoff = this.minCutoff + this.beta * Math.abs(edValue);
        this.xFilter.setAlpha(this.alpha(cutoff));
        return this.xFilter.filter(value);
    }
}

const landmarkFilterBank = new Map();
const fingerVelocityHistory = new Map();
const gestureState = { active: 'Auto Mode', confidence: 0.4 };

// ============================================
// SHADERS
// ============================================
const vShader = `
    uniform float uTime;
    uniform float uExpansion;
    uniform float uSwirl;
    uniform float uWiggle;
    uniform float uExplosion;
    uniform float uMaxSize;
    uniform vec3 uAttractorPos;
    uniform float uAttractorStrength;
    uniform vec3 uWindForce;
    uniform float uFreezeTime;
    uniform float uPulse;

    attribute vec3 aTarget;
    attribute float aRandom;

    varying vec3 vPos;
    varying float vAlpha;

    // Simplex noise function
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
        vec3 target = aTarget;

        // 1. Wiggle Effect (High freq noise)
        float wiggleNoise = snoise(vec3(target.x * 0.5, target.y * 0.5, uTime * 10.0));
        target += wiggleNoise * uWiggle * 2.0;

        // 2. Base Noise Movement
        float n = snoise(vec3(target.x * 0.1, target.y * 0.1, uTime * 0.3));
        target += n * 0.5;

        // 3. Swirl Effect
        float angle = uSwirl * length(target.xz) * 0.1;
        float s = sin(angle);
        float c = cos(angle);
        mat2 rot = mat2(c, -s, s, c);
        target.xz = rot * target.xz;

        // 4. Explosion (Distance from camera)
        vec3 dir = normalize(target);
        target += dir * uExplosion * 20.0 * aRandom;

        // 5. Expansion (Hand Open/Close)
        vec3 pos = mix(vec3(0.0), target, uExpansion);

        // 6. Attractor Effect (Pinch Gesture)
        if (uAttractorStrength > 0.0) {
            vec3 toAttractor = uAttractorPos - pos;
            float dist = length(toAttractor);
            pos += normalize(toAttractor) * uAttractorStrength * (1.0 / (dist + 1.0)) * 3.0;
        }

        // 7. Wind Force (Hand Direction)
        pos += uWindForce * aRandom * 0.5;

        // 8. Pulse Effect (Peace Sign)
        pos *= (1.0 + uPulse * sin(uTime * 5.0 + aRandom * 10.0) * 0.3);

        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPos;

        // Size with pulse
        float sizeMultiplier = 1.0 + uPulse * 0.5;
        gl_PointSize = (uMaxSize + aRandom * 3.0) * (1.0 / -mvPos.z) * sizeMultiplier;

        vPos = pos;
        vAlpha = 0.5 + 0.5 * n;
    }
`;

const fShader = `
    uniform sampler2D uTex;
    varying vec3 vPos;
    varying float vAlpha;

    void main() {
        vec4 tex = texture2D(uTex, gl_PointCoord);
        if (tex.a < 0.05) discard;

        float dist = length(vPos);
        vec3 colorCore = vec3(1.0, 0.7, 0.1); // Gold
        vec3 colorEdge = vec3(0.0, 0.5, 1.0); // Cyan Blue

        float mixFactor = smoothstep(0.0, 15.0, dist);
        vec3 finalColor = mix(colorCore, colorEdge, mixFactor);

        gl_FragColor = vec4(finalColor * 2.0, tex.a * vAlpha);
    }
`;

// ============================================
// PARTICLE SYSTEM
// ============================================
const PARTICLE_COUNT = CONFIG.particles.count;

const geo = new THREE.BufferGeometry();
const posArr = new Float32Array(PARTICLE_COUNT * 3);
const targetArr = new Float32Array(PARTICLE_COUNT * 3);
const randArr = new Float32Array(PARTICLE_COUNT);

for (let i = 0; i < PARTICLE_COUNT; i++) {
    posArr[i * 3] = 0;
    posArr[i * 3 + 1] = 0;
    posArr[i * 3 + 2] = 0;
    randArr[i] = Math.random();
}
geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
geo.setAttribute('aTarget', new THREE.BufferAttribute(targetArr, 3));
geo.setAttribute('aRandom', new THREE.BufferAttribute(randArr, 1));

const mat = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uExpansion: { value: 1.0 },
        uSwirl: { value: 0.0 },
        uWiggle: { value: 0.0 },
        uExplosion: { value: 0.0 },
        uMaxSize: { value: CONFIG.particles.defaultSize },
        uTex: { value: particleTex },
        uAttractorPos: { value: new THREE.Vector3(0, 0, 0) },
        uAttractorStrength: { value: 0.0 },
        uWindForce: { value: new THREE.Vector3(0, 0, 0) },
        uFreezeTime: { value: 0.0 },
        uPulse: { value: 0.0 }
    },
    vertexShader: vShader,
    fragmentShader: fShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});

const particles = new THREE.Points(geo, mat);
scene.add(particles);

// ============================================
// BACKGROUND BOKEH + GALAXY
// ============================================
const bgGeo = new THREE.BufferGeometry();
const bgPos = new Float32Array(CONFIG.particles.backgroundCount * 3);
for (let i = 0; i < CONFIG.particles.backgroundCount; i++) {
    bgPos[i * 3] = (Math.random() - 0.5) * 100;
    bgPos[i * 3 + 1] = (Math.random() - 0.5) * 60;
    bgPos[i * 3 + 2] = (Math.random() - 0.5) * 50 - 20;
}
bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
const bgMat = new THREE.PointsMaterial({
    color: 0x1a6bff,
    size: 2.5,
    map: particleTex,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
const bgPoints = new THREE.Points(bgGeo, bgMat);
scene.add(bgPoints);

const GALAXY_STAR_COUNT = 4000;
const galaxyGeo = new THREE.BufferGeometry();
const galaxyPositions = new Float32Array(GALAXY_STAR_COUNT * 3);
const galaxyColors = new Float32Array(GALAXY_STAR_COUNT * 3);
for (let i = 0; i < GALAXY_STAR_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 180 + Math.random() * 70;
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);
    galaxyPositions[i * 3] = x;
    galaxyPositions[i * 3 + 1] = y;
    galaxyPositions[i * 3 + 2] = z;
    const color = getGalaxyColor();
    galaxyColors[i * 3] = color.r;
    galaxyColors[i * 3 + 1] = color.g;
    galaxyColors[i * 3 + 2] = color.b;
}
galaxyGeo.setAttribute('position', new THREE.BufferAttribute(galaxyPositions, 3));
galaxyGeo.setAttribute('color', new THREE.BufferAttribute(galaxyColors, 3));
const galaxyMat = new THREE.PointsMaterial({
    size: 3.5,
    map: particleTex,
    transparent: true,
    opacity: 0.45,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
const galaxyField = new THREE.Points(galaxyGeo, galaxyMat);
scene.add(galaxyField);

scene.background = new THREE.Color(0x050c1c);

// ============================================
// SHAPE GENERATION FUNCTIONS
// ============================================
function getPointOnSphere() {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 10 + Math.random();
    return {
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta),
        z: r * Math.cos(phi)
    };
}

function getPointHeart() {
    let t = Math.random() * Math.PI * 2;
    let u = Math.random();
    const r = 0.6 * Math.cbrt(u);
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return { x: x * r, y: y * r, z: (Math.random() - 0.5) * 5 };
}

function getPointSaturn() {
    if (Math.random() < 0.6) {
        const p = getPointOnSphere();
        return { x: p.x * 0.6, y: p.y * 0.6, z: p.z * 0.6 };
    } else {
        const a = Math.random() * 6.28;
        const d = 8 + Math.random() * 8;
        return { x: Math.cos(a) * d, y: (Math.random() - 0.5), z: Math.sin(a) * d };
    }
}

function getPointFlower() {
    const u = Math.random() * 6.28;
    const v = Math.random() * 3.14;
    const r = 5 * (1 + Math.sin(5 * u));
    const rf = r * Math.sin(v);
    return { x: rf * Math.cos(u), y: rf * Math.sin(u), z: 5 * Math.cos(v) + (Math.random() - 0.5) };
}

function getPointBuddha() {
    const r = Math.random();
    if (r < 0.15) {
        const t = Math.random() * 6.28;
        const p = Math.acos(2 * Math.random() - 1);
        const rad = 2.5;
        return {
            x: rad * Math.sin(p) * Math.cos(t),
            y: rad * Math.sin(p) * Math.sin(t) + 7,
            z: rad * Math.cos(p)
        };
    } else if (r < 0.55) {
        const t = Math.random() * 6.28;
        const p = Math.acos(2 * Math.random() - 1);
        return {
            x: 4 * Math.sin(p) * Math.cos(t),
            y: 5 * Math.sin(p) * Math.sin(t),
            z: 4 * Math.cos(p)
        };
    } else {
        const a = Math.random() * 6.28;
        const d = 3 + Math.random() * 5;
        return { x: Math.cos(a) * d, y: -4 + (Math.random() * 2), z: Math.sin(a) * d };
    }
}

function getPointFireworks() {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 2 + Math.random() * 20;
    return {
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta),
        z: r * Math.cos(phi)
    };
}

// ============================================
// SHAPE MANAGEMENT
// ============================================
const shapes = ['sphere', 'heart', 'saturn', 'flower', 'buddha', 'fireworks'];
let currentShapeIndex = 0;

window.setShape = (type) => {
    const arr = geo.attributes.aTarget.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        let p;
        if (type === 'heart') p = getPointHeart();
        else if (type === 'saturn') p = getPointSaturn();
        else if (type === 'flower') p = getPointFlower();
        else if (type === 'buddha') p = getPointBuddha();
        else if (type === 'fireworks') p = getPointFireworks();
        else p = getPointOnSphere();
        arr[i * 3] = p.x;
        arr[i * 3 + 1] = p.y;
        arr[i * 3 + 2] = p.z;
    }
    geo.attributes.aTarget.needsUpdate = true;

    const shapeIdx = shapes.indexOf(type);
    if (shapeIdx !== -1) currentShapeIndex = shapeIdx;

    // Update active state only for shape buttons (buttons with onclick containing setShape)
    document.querySelectorAll('.btn').forEach(b => {
        const onclick = b.getAttribute('onclick');
        if (onclick && onclick.includes('setShape')) {
            b.classList.remove('active');
        }
    });
    
    if (window.event && window.event.target) {
        window.event.target.classList.add('active');
    } else {
        const btn = Array.from(document.querySelectorAll('.btn')).find(b => {
            const onclick = b.getAttribute('onclick');
            return onclick && onclick.includes(type);
        });
        if (btn) btn.classList.add('active');
    }
};

// ============================================
// UI EVENT HANDLERS
// ============================================
function initUIHandlers() {
    document.getElementById('glow-slider').addEventListener('input', (e) => {
        bloomPass.strength = parseFloat(e.target.value);
    });

    document.getElementById('size-slider').addEventListener('input', (e) => {
        mat.uniforms.uMaxSize.value = parseFloat(e.target.value);
    });

    // Gesture toggle button
    document.getElementById('gesture-toggle').addEventListener('click', () => {
        gestureDetectionEnabled = !gestureDetectionEnabled;
        const btn = document.getElementById('gesture-toggle');
        
        if (gestureDetectionEnabled) {
            btn.classList.remove('disabled');
            btn.classList.add('enabled');
            btn.innerHTML = '🖐️ Gestures: ON';
            console.log('Gesture detection enabled');
        } else {
            btn.classList.remove('enabled');
            btn.classList.add('disabled');
            btn.innerHTML = '🚫 Gestures: OFF';
            console.log('Gesture detection disabled');
        }
    });
}

const logElements = {};
const logElementIds = {
    hands: 'log-hands',
    openness: 'log-openness',
    gesture: 'log-gesture',
    expansion: 'log-expansion',
    swirl: 'log-swirl',
    wiggle: 'log-wiggle',
    explosion: 'log-explosion',
    size: 'log-size',
    movement: 'log-movement',
    swipe: 'log-swipe'
};

function cacheLogElements() {
    Object.entries(logElementIds).forEach(([key, id]) => {
        logElements[key] = document.getElementById(id);
    });
}

function updateLog(key, value) {
    if (logElements[key]) {
        logElements[key].innerText = value;
    }
}

function filterLandmarks(landmarks, timestampMs) {
    if (!landmarks) return [];
    const timestamp = timestampMs / 1000;
    return landmarks.map((hand, handIndex) => hand.map((landmark, landmarkIndex) => {
        const filtered = { ...landmark };
        ['x', 'y', 'z'].forEach(axis => {
            const key = `${handIndex}-${landmarkIndex}-${axis}`;
            if (!landmarkFilterBank.has(key)) {
                landmarkFilterBank.set(
                    key,
                    new OneEuroFilter(
                        CONFIG.filters.freq,
                        CONFIG.filters.minCutoff,
                        CONFIG.filters.beta,
                        CONFIG.filters.dCutoff
                    )
                );
            }
            filtered[axis] = landmarkFilterBank.get(key).filter(landmark[axis], timestamp);
        });
        return filtered;
    }));
}

function updateGestureFeedback(label, confidence = 0) {
    if (!gestureFeedbackEl || !gestureFeedbackLabel || !gestureFeedbackBar) return;
    gestureFeedbackLabel.innerText = label;
    const clamped = Math.max(0, Math.min(1, confidence));
    gestureFeedbackBar.style.width = `${(clamped * 100).toFixed(1)}%`;
    gestureFeedbackEl.style.opacity = 0.35 + clamped * 0.65;
}

function commitGestureState(label, intensity = 0.05) {
    const thresholds = CONFIG.gestures.modeThresholds;
    if (gestureState.active === label) {
        gestureState.confidence = Math.min(1, gestureState.confidence + intensity);
    } else {
        gestureState.confidence = Math.max(0, gestureState.confidence - thresholds.decay);
        if (gestureState.confidence <= thresholds.exit) {
            gestureState.active = label;
            gestureState.confidence = thresholds.enter + intensity;
        }
    }
    updateGestureFeedback(gestureState.active, gestureState.confidence);
}

// ============================================
// HAND DETECTION
// ============================================
let video, handCanvas, handCtx, loader, startBtn, wiggleVal, depthVal, gestureFeedbackEl, gestureFeedbackLabel, gestureFeedbackBar;

let handLandmarker = null;
let lastVideoTime = -1;
let lastDetectionTime = 0;
const detectionInterval = 1000 / CONFIG.handDetection.fps; // Throttled to 20 FPS

// Physics State
let smoothedExpansion = 0.5;
let smoothedSwirl = 0.0;
let smoothedWiggle = 0.0;
let smoothedExplosion = 0.0;
let prevTips = [];

// Gesture State
let smoothedAttractorStrength = 0.0;
let smoothedWindForce = new THREE.Vector3();
let smoothedPulse = 0.0;
let freezeTimeTarget = 1.0;
let currentGesture = 'None';
let gestureDetectionEnabled = true;

// Rotation Control
let targetRotationSpeed = CONFIG.physics.baseRotationSpeed;
let smoothedRotationSpeed = CONFIG.physics.baseRotationSpeed;
let prevFistAngle = null;
let lastGestureSampleTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

function decayRotationTarget() {
    targetRotationSpeed += (CONFIG.physics.baseRotationSpeed - targetRotationSpeed) * CONFIG.physics.rotationIdleDecay;
}

// Swipe Detection
let prevHandX = null;
let swipeStartX = null;
let swipeStartTime = null;
let lastSwipeTime = 0;

async function initHandDetection() {
    try {
        loader.innerText = "Loading AI Core...";
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: CONFIG.handDetection.numHands
        });

        loader.innerText = "AI Ready. Starting Camera...";
        startWebcam();
    } catch (err) {
        console.error("Hand detection init error:", err);
        loader.innerText = "AI Error: " + err.message + " - Click to retry";
        startBtn.style.display = 'block';
        startBtn.innerText = "RETRY";
    }
}

function startWebcam() {
    loader.innerText = "Requesting Camera...";
    navigator.mediaDevices.getUserMedia({
        video: {
            width: { ideal: CONFIG.video.width },
            height: { ideal: CONFIG.video.height },
            facingMode: CONFIG.video.facingMode
        }
    }).then((stream) => {
        video.srcObject = stream;
        video.addEventListener('loadeddata', () => {
            loader.style.display = 'none';
            startBtn.style.display = 'none';
            handCanvas.width = CONFIG.video.width;
            handCanvas.height = CONFIG.video.height;
            console.log("Camera started successfully");
            detectHands();
        });
        video.play().catch(e => {
            console.error("Video play error:", e);
            loader.innerText = "Click to Start";
            startBtn.style.display = 'block';
        });
    }).catch(e => {
        console.error("Camera error:", e);
        loader.innerText = "Camera Access Denied: " + e.message;
        startBtn.style.display = 'block';
        startBtn.innerText = "RETRY CAMERA";
    });
}

function initStartButton() {
    startBtn.addEventListener('click', () => {
        if (!handLandmarker) {
            initHandDetection();
        } else {
            startWebcam();
        }
    });
}

function detectHands() {
    if (!handLandmarker || !video.videoWidth) {
        requestAnimationFrame(detectHands);
        return;
    }

    const now = performance.now();

    // Throttle hand detection to configured FPS
    if (video.currentTime !== lastVideoTime && (now - lastDetectionTime) >= detectionInterval) {
        lastVideoTime = video.currentTime;
        lastDetectionTime = now;

        try {
            const result = handLandmarker.detectForVideo(video, now);
            result.landmarks = filterLandmarks(result.landmarks, now);
            drawHandLandmarks(result);
            processGestures(result);
        } catch (err) {
            console.error("Detection error:", err);
        }
    }

    requestAnimationFrame(detectHands);
}

function drawHandLandmarks(result) {
    handCtx.save();
    handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);

    if (result.landmarks) {
        for (const landmarks of result.landmarks) {
            // Draw connections
            const connections = [
                [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
                [0, 5], [5, 6], [6, 7], [7, 8], // Index
                [0, 9], [9, 10], [10, 11], [11, 12], // Middle
                [0, 13], [13, 14], [14, 15], [15, 16], // Ring
                [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
                [5, 9], [9, 13], [13, 17] // Palm
            ];

            handCtx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
            handCtx.lineWidth = 2;

            for (const [start, end] of connections) {
                const startPoint = landmarks[start];
                const endPoint = landmarks[end];
                handCtx.beginPath();
                handCtx.moveTo(startPoint.x * handCanvas.width, startPoint.y * handCanvas.height);
                handCtx.lineTo(endPoint.x * handCanvas.width, endPoint.y * handCanvas.height);
                handCtx.stroke();
            }

            // Draw landmarks
            for (const landmark of landmarks) {
                handCtx.beginPath();
                handCtx.arc(
                    landmark.x * handCanvas.width,
                    landmark.y * handCanvas.height,
                    5, 0, 2 * Math.PI
                );
                handCtx.fillStyle = 'rgba(255, 170, 0, 0.9)';
                handCtx.fill();
                handCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                handCtx.lineWidth = 1;
                handCtx.stroke();
            }
        }
    }

    handCtx.restore();
}

// ============================================
// GESTURE DETECTION FUNCTIONS
// ============================================
function getHandScale(hand) {
    const wrist = hand[0];
    const indexBase = hand[5];
    const pinkyBase = hand[17];
    const palmWidth = Math.hypot(indexBase.x - pinkyBase.x, indexBase.y - pinkyBase.y);
    const palmLength = Math.hypot(hand[9].x - wrist.x, hand[9].y - wrist.y);
    return Math.max(0.01, (palmWidth + palmLength) * 0.5);
}

function getPalmTwistAngle(hand) {
    const wrist = hand[0];
    const indexBase = hand[5];
    const pinkyBase = hand[17];

    const wristToIndex = new THREE.Vector3(
        indexBase.x - wrist.x,
        indexBase.y - wrist.y,
        (indexBase.z || 0) - (wrist.z || 0)
    );
    const wristToPinky = new THREE.Vector3(
        pinkyBase.x - wrist.x,
        pinkyBase.y - wrist.y,
        (pinkyBase.z || 0) - (wrist.z || 0)
    );
    const palmNormal = new THREE.Vector3().crossVectors(wristToIndex, wristToPinky).normalize();
    const palmAxis = new THREE.Vector3(
        indexBase.x - pinkyBase.x,
        indexBase.y - pinkyBase.y,
        (indexBase.z || 0) - (pinkyBase.z || 0)
    ).normalize();

    const horizontalAngle = Math.atan2(palmAxis.y, palmAxis.x);
    const depthAngle = Math.atan2(palmNormal.z, palmNormal.x);
    return horizontalAngle + depthAngle * 0.5;
}

function normalizeAngleDiff(angle) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function handleFistRotation(hand, deltaTime) {
    const twistAngle = getPalmTwistAngle(hand);

    if (prevFistAngle === null) {
        prevFistAngle = twistAngle;
        return false;
    }

    const deltaAngle = normalizeAngleDiff(twistAngle - prevFistAngle);
    prevFistAngle = twistAngle;

    const rotationVelocity = deltaAngle / Math.max(deltaTime, 0.016);
    if (Math.abs(rotationVelocity) < CONFIG.physics.minRotationVelocity) {
        return false;
    }

    const adjustedVelocity = THREE.MathUtils.clamp(
        rotationVelocity * CONFIG.physics.fistRotationMultiplier,
        -CONFIG.physics.maxGestureRotationSpeed,
        CONFIG.physics.maxGestureRotationSpeed
    );
    targetRotationSpeed = adjustedVelocity;
    return true;
}

function countExtendedFingers(hand) {
    const fingerTips = [8, 12, 16, 20];
    const fingerPIPs = [6, 10, 14, 18];
    const handScale = getHandScale(hand);
    const fingerThreshold = Math.max(0.02, 0.18 * handScale);
    const thumbThreshold = Math.max(0.02, 0.35 * handScale);
    let count = 0;

    const thumbDist = Math.abs(hand[4].x - hand[2].x);
    if (thumbDist > thumbThreshold) count++;

    fingerTips.forEach((tip, i) => {
        const yDiff = hand[fingerPIPs[i]].y - hand[tip].y;
        if (yDiff > fingerThreshold) count++;
    });

    return count;
}

function detectPinch(hand) {
    const thumb = hand[4];
    const index = hand[8];
    const dist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
    return dist < 0.45 * getHandScale(hand);
}

function getPinchCenter(hand) {
    return {
        x: (hand[4].x + hand[8].x) / 2,
        y: (hand[4].y + hand[8].y) / 2,
        z: (hand[4].z + hand[8].z) / 2
    };
}

function detectPeaceSign(hand) {
    const handScale = getHandScale(hand);
    const fingerLiftThreshold = Math.max(0.015, 0.12 * handScale);
    const indexUp = hand[8].y < hand[6].y - fingerLiftThreshold;
    const middleUp = hand[12].y < hand[10].y - fingerLiftThreshold;

    const palm = hand[9];
    const ringDist = Math.hypot(hand[16].x - palm.x, hand[16].y - palm.y) / handScale;
    const pinkyDist = Math.hypot(hand[20].x - palm.x, hand[20].y - palm.y) / handScale;

    return indexUp && middleUp && ringDist < 0.65 && pinkyDist < 0.65;
}

function detectFist(hand) {
    const palm = hand[9];
    const tips = [4, 8, 12, 16, 20];
    const threshold = Math.max(0.04, 0.55 * getHandScale(hand));

    let closedCount = 0;
    tips.forEach(t => {
        const dist = Math.hypot(hand[t].x - palm.x, hand[t].y - palm.y);
        if (dist < threshold) closedCount++;
    });

    return closedCount >= 4;
}

function getHandDirection(hand) {
    const wrist = hand[0];
    const middle = hand[12];
    return {
        x: middle.x - wrist.x,
        y: middle.y - wrist.y
    };
}

function aggregateHandData(hands) {
    const fingerTipIndices = [4, 8, 12, 16, 20];
    const aggregate = {
        tipPositions: [],
        openness: 0,
        avgHandSize: 0,
        direction: { x: 0, y: 0 }
    };

    if (!hands.length) {
        return aggregate;
    }

    hands.forEach(hand => {
        const wrist = hand[0];
        let tipDist = 0;

        fingerTipIndices.forEach(index => {
            const tip = hand[index];
            const distance = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
            tipDist += distance;
            aggregate.tipPositions.push({ x: tip.x, y: tip.y });
        });

        aggregate.openness += tipDist / fingerTipIndices.length;
        aggregate.avgHandSize += Math.hypot(hand[12].x - wrist.x, hand[12].y - wrist.y);
        const direction = getHandDirection(hand);
        aggregate.direction.x += direction.x;
        aggregate.direction.y += direction.y;
    });

    const invCount = 1 / hands.length;
    aggregate.openness *= invCount;
    aggregate.avgHandSize *= invCount;
    aggregate.direction.x *= invCount;
    aggregate.direction.y *= invCount;

    return aggregate;
}

function computeTipMovement(currentTips) {
    if (!prevTips.length || prevTips.length !== currentTips.length) {
        prevTips = currentTips;
        return 0;
    }

    let movement = 0;
    for (let i = 0; i < currentTips.length; i++) {
        const dx = currentTips[i].x - prevTips[i].x;
        const dy = currentTips[i].y - prevTips[i].y;
        movement += Math.sqrt(dx * dx + dy * dy);
    }

    prevTips = currentTips;
    return movement * 10.0;
}

function applyDirectionalWind(direction, magnitude, target) {
    if (!target) return;
    target.set(direction.x * magnitude, -direction.y * magnitude, 0);
}

function applyFingerForceFields(hands, deltaTime) {
    const force = new THREE.Vector3();
    if (!hands || !hands.length) {
        fingerVelocityHistory.clear();
        return force;
    }

    const dt = Math.max(deltaTime, 0.016);
    hands.forEach((hand, handIndex) => {
        const fingerTipIndices = [8, 12, 16, 20];
        fingerTipIndices.forEach(tipIndex => {
            const tip = hand[tipIndex];
            const key = `${handIndex}-${tipIndex}`;
            const prev = fingerVelocityHistory.get(key);
            if (prev) {
                const vx = (tip.x - prev.x) / dt;
                const vy = (tip.y - prev.y) / dt;
                force.x += vx;
                force.y -= vy;
            }
            fingerVelocityHistory.set(key, { x: tip.x, y: tip.y, z: tip.z || 0 });
        });
    });

    return force.multiplyScalar(6.5);
}

function detectSwipe(hand) {
    const wrist = hand[0];
    const currentX = wrist.x;
    const now = Date.now();

    if (now - lastSwipeTime < CONFIG.gestures.swipeCooldown) {
        return null;
    }

    if (swipeStartX === null) {
        swipeStartX = currentX;
        swipeStartTime = now;
        prevHandX = currentX;
        return null;
    }

    const totalDelta = currentX - swipeStartX;
    const timeDelta = (now - swipeStartTime) / 1000;
    const velocity = Math.abs(totalDelta) / Math.max(timeDelta, 0.001);

    updateLog('swipe', `${Math.abs(totalDelta).toFixed(2)} (${velocity.toFixed(2)} v)`);

    let swipeDirection = null;

    if (Math.abs(totalDelta) > CONFIG.gestures.swipeThreshold && velocity > CONFIG.gestures.swipeVelocityMin) {
        if (totalDelta > 0) {
            swipeDirection = 'right';
        } else {
            swipeDirection = 'left';
        }

        lastSwipeTime = now;
        swipeStartX = null;
        swipeStartTime = null;
        prevHandX = null;
    } else if (timeDelta > 1.5) {
        swipeStartX = currentX;
        swipeStartTime = now;
        prevHandX = currentX;
    } else {
        prevHandX = currentX;
    }

    return swipeDirection;
}

function changeShape(direction) {
    if (direction === 'right') {
        currentShapeIndex = (currentShapeIndex + 1) % shapes.length;
    } else if (direction === 'left') {
        currentShapeIndex = (currentShapeIndex - 1 + shapes.length) % shapes.length;
    }

    const shapeName = shapes[currentShapeIndex];
    setShape(shapeName);
    console.log(`✓ Swiped ${direction}: Changed to ${shapeName}`);
}

function processGestures(result) {
    const hands = result.landmarks || [];
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const deltaTime = Math.max(0.001, (now - lastGestureSampleTime) / 1000);
    lastGestureSampleTime = now;
    let rotationGestureActive = false;

    updateLog('hands', hands.length);

    let targetAttractorStrength = 0.0;
    let targetWindForce = new THREE.Vector3(0, 0, 0);
    let targetPulse = 0.0;
    currentGesture = 'None';

    // Check if gesture detection is enabled
    if (!gestureDetectionEnabled) {
        // Auto mode when gestures are disabled
        const t = Date.now() * 0.001;
        smoothedExpansion = 0.8 + Math.sin(t) * 0.2;
        smoothedSwirl = Math.sin(t * 0.5) * 0.5;
        smoothedWiggle = 0;
        smoothedExplosion = 0;
        freezeTimeTarget = 1.0;
        smoothedAttractorStrength *= 0.95;
        smoothedWindForce.multiplyScalar(0.95);
        smoothedPulse *= 0.95;
        currentGesture = 'Gestures Disabled';
        prevHandX = null;
        prevTips = [];
        prevFistAngle = null;
        targetRotationSpeed = CONFIG.physics.baseRotationSpeed;
        wiggleVal.innerText = "DISABLED";
        depthVal.innerText = "DISABLED";
        updateLog('openness', "N/A");
        updateLog('gesture', currentGesture);
        updateLog('expansion', smoothedExpansion.toFixed(3));
        updateLog('swirl', smoothedSwirl.toFixed(3));
        updateLog('wiggle', "0.000");
        updateLog('explosion', "0.000");
        updateLog('size', "N/A");
        updateLog('movement', "0.000");
        fingerVelocityHistory.clear();
        commitGestureState(currentGesture, 0.1);
        return;
    }

    let movement = 0;

    if (hands.length > 0) {
        const aggregatedHands = aggregateHandData(hands);
        const hand = hands[0];
        const fingerCount = countExtendedFingers(hand);
        const fingerFieldForce = applyFingerForceFields(hands, deltaTime);

        const isFist = detectFist(hand);
        let isPinching = false;
        let isPeaceSign = false;
        if (isFist) {
            currentGesture = '✊ Rotate Fist';
            freezeTimeTarget = 1.0;
            targetAttractorStrength = 0.0;
            targetWindForce.set(0, 0, 0);
            targetPulse = 0.0;
            rotationGestureActive = handleFistRotation(hand, deltaTime);
        } else {
            prevFistAngle = null;
            isPinching = detectPinch(hand);
            if (isPinching) {
                currentGesture = '👌 Pinch (Attract)';
                const pinchCenter = getPinchCenter(hand);
                mat.uniforms.uAttractorPos.value.set(
                    (pinchCenter.x - 0.5) * 60,
                    (0.5 - pinchCenter.y) * 45,
                    (pinchCenter.z || 0) * 20
                );
                targetAttractorStrength = 5.0;
                targetWindForce.set(0, 0, 0);
                targetPulse = 0.0;
                freezeTimeTarget = 1.0;
            } else {
                isPeaceSign = detectPeaceSign(hand);
                if (isPeaceSign) {
                    currentGesture = '✌️ Peace (Pulse)';
                    targetPulse = 1.0;
                    targetAttractorStrength = 0.0;
                    targetWindForce.set(0, 0, 0);
                    freezeTimeTarget = 1.0;
                } else if (fingerCount === 5) {
                    const swipeDirection = detectSwipe(hand);
                    if (swipeDirection) {
                        changeShape(swipeDirection);
                        currentGesture = swipeDirection === 'right' ? '🖐️➡️ Swipe Right' : '🖐️⬅️ Swipe Left';
                        targetAttractorStrength = 0.0;
                        targetWindForce.set(0, 0, 0);
                        targetPulse = 0.0;
                        freezeTimeTarget = 1.0;
                    } else {
                        currentGesture = '🖐️ Five Fingers (Expand)';
                        smoothedExplosion = Math.min(1.5, smoothedExplosion + 0.03);
                        targetAttractorStrength = 0.0;
                        applyDirectionalWind(aggregatedHands.direction, 8, targetWindForce);
                        targetPulse = 0.0;
                        freezeTimeTarget = 1.0;
                    }
                } else if (fingerCount === 1) {
                    currentGesture = '☝️ One Finger (Collapse)';
                    smoothedExpansion = Math.max(0, smoothedExpansion - 0.03);
                    targetAttractorStrength = 0.0;
                    targetWindForce.set(0, 0, 0);
                    targetPulse = 0.0;
                    freezeTimeTarget = 1.0;
                } else {
                    currentGesture = `🤚 ${fingerCount} Fingers`;
                    applyDirectionalWind(aggregatedHands.direction, 5, targetWindForce);
                    targetAttractorStrength = 0.0;
                    targetPulse = 0.0;
                    freezeTimeTarget = 1.0;
                }
            }
        }

        // Calculate expansion, wiggle, and other effects
        movement = computeTipMovement(aggregatedHands.tipPositions);
        smoothedWiggle += (movement - smoothedWiggle) * CONFIG.physics.smoothingFactor;
        wiggleVal.innerText = Math.round(smoothedWiggle * 100) + "%";
        updateLog('movement', movement.toFixed(3));
        updateLog('wiggle', smoothedWiggle.toFixed(3));

        // Explosion
        let targetExplosion = (0.3 - aggregatedHands.avgHandSize) * 4.0;
        targetExplosion = Math.max(0, Math.min(1, targetExplosion));
        smoothedExplosion += (targetExplosion - smoothedExplosion) * CONFIG.physics.smoothingFactor;
        if (smoothedExplosion > 0.5) depthVal.innerText = "FAR (EXPLODE)";
        else depthVal.innerText = "NEAR (STABLE)";
        updateLog('size', aggregatedHands.avgHandSize.toFixed(3));
        updateLog('explosion', smoothedExplosion.toFixed(3));

        // Expansion
        let openness = (aggregatedHands.openness - 0.1) * 3.5;
        openness = Math.max(0, Math.min(1, openness));
        smoothedExpansion += (openness - smoothedExpansion) * CONFIG.physics.smoothingFactor;
        updateLog('openness', openness.toFixed(3));
        updateLog('expansion', smoothedExpansion.toFixed(3));
        updateLog('gesture', currentGesture);

        if (!isFist && !isPinching) {
            targetWindForce.add(fingerFieldForce);
        }

        // Smooth gesture effects
        smoothedAttractorStrength += (targetAttractorStrength - smoothedAttractorStrength) * CONFIG.physics.gestureSmoothingFactor;
        smoothedWindForce.lerp(targetWindForce, CONFIG.physics.windSmoothingFactor);
        smoothedPulse += (targetPulse - smoothedPulse) * CONFIG.physics.smoothingFactor;

        // Two hand swirl
        if (hands.length === 2) {
            const dx = hands[1][0].x - hands[0][0].x;
            const dy = hands[1][0].y - hands[0][0].y;
            const angle = Math.atan2(dy, dx);
            smoothedSwirl += (angle * 2.0 - smoothedSwirl) * 0.05;
        } else {
            smoothedSwirl *= 0.95;
        }
        updateLog('swirl', smoothedSwirl.toFixed(3));

    } else {
        // Auto mode when no hands detected
        const t = Date.now() * 0.001;
        smoothedExpansion = 0.8 + Math.sin(t) * 0.2;
        smoothedSwirl = Math.sin(t * 0.5) * 0.5;
        smoothedWiggle = 0;
        smoothedExplosion = 0;
        freezeTimeTarget = 1.0;
        smoothedAttractorStrength *= 0.95;
        smoothedWindForce.multiplyScalar(0.95);
        smoothedPulse *= 0.95;
        currentGesture = 'Auto Mode';
        prevHandX = null;
        prevTips = [];
        prevFistAngle = null;
        wiggleVal.innerText = "AUTO";
        depthVal.innerText = "AUTO";
        updateLog('openness', "AUTO");
        updateLog('gesture', currentGesture);
        updateLog('expansion', smoothedExpansion.toFixed(3));
        updateLog('swirl', smoothedSwirl.toFixed(3));
        updateLog('wiggle', "0.000");
        updateLog('explosion', "0.000");
        updateLog('size', "N/A");
        updateLog('movement', "0.000");
        targetRotationSpeed = CONFIG.physics.baseRotationSpeed;
        fingerVelocityHistory.clear();
    }

    if (!rotationGestureActive) {
        decayRotationTarget();
    }

    const gestureEnergy = Math.min(
        0.3,
        0.05 + movement * 0.01 + smoothedPulse * 0.05 + smoothedWindForce.length() * 0.02
    );
    commitGestureState(currentGesture, gestureEnergy);
}

// ============================================
// ANIMATION LOOP
// ============================================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // Freeze time effect
    mat.uniforms.uFreezeTime.value += (freezeTimeTarget - mat.uniforms.uFreezeTime.value) * CONFIG.physics.smoothingFactor;
    mat.uniforms.uTime.value += delta * mat.uniforms.uFreezeTime.value;

    // Apply smoothed values to uniforms
    mat.uniforms.uExpansion.value = smoothedExpansion;
    mat.uniforms.uSwirl.value = smoothedSwirl;
    mat.uniforms.uWiggle.value = smoothedWiggle;
    mat.uniforms.uExplosion.value = smoothedExplosion;

    // Apply gesture effects
    mat.uniforms.uAttractorStrength.value = smoothedAttractorStrength;
    mat.uniforms.uWindForce.value.copy(smoothedWindForce);
    mat.uniforms.uPulse.value = smoothedPulse;

    smoothedRotationSpeed += (targetRotationSpeed - smoothedRotationSpeed) * CONFIG.physics.rotationSmoothingFactor;
    const rotationDelta = delta * smoothedRotationSpeed * mat.uniforms.uFreezeTime.value;
    particles.rotation.y += rotationDelta;
    bgPoints.rotation.y -= rotationDelta * 0.65;
    galaxyField.rotation.y -= rotationDelta * 0.45;
    galaxyField.rotation.x = THREE.MathUtils.lerp(galaxyField.rotation.x, Math.sin(clock.elapsedTime * 0.05) * 0.1, 0.05);
    composer.render();
}

// ============================================
// WINDOW RESIZE HANDLER
// ============================================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================
// CLEANUP ON PAGE UNLOAD
// ============================================
window.addEventListener('beforeunload', () => {
    if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }

    // Dispose Three.js resources
    geo.dispose();
    bgGeo.dispose();
    mat.dispose();
    bgMat.dispose();
    galaxyGeo.dispose();
    galaxyMat.dispose();
    particleTex.dispose();
    renderer.dispose();

    console.log('Resources cleaned up');
});

// ============================================
// INITIALIZATION
// ============================================
function init() {
    // Initialize DOM element references
    video = document.getElementById('input-video');
    handCanvas = document.getElementById('hand-canvas');
    handCtx = handCanvas.getContext('2d');
    loader = document.getElementById('loader');
    startBtn = document.getElementById('start-btn');
    wiggleVal = document.getElementById('wiggle-val');
    depthVal = document.getElementById('depth-val');
    gestureFeedbackEl = document.getElementById('gesture-feedback');
    gestureFeedbackLabel = document.getElementById('gesture-label');
    gestureFeedbackBar = document.getElementById('gesture-meter-fill');
    cacheLogElements();
    updateGestureFeedback('Initializing', 0.2);

    setShape('sphere');
    initUIHandlers();
    initStartButton();
    initHandDetection();
    animate();
    console.log(`Initialized with ${PARTICLE_COUNT.toLocaleString()} particles`);
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
