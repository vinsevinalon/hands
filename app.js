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
    },
    physics: {
        smoothingFactor: 0.1,
        gestureSmoothingFactor: 0.15,
        windSmoothingFactor: 0.1,
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
// BACKGROUND BOKEH
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
    color: 0x0044aa,
    size: 2.0,
    map: particleTex,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
scene.add(new THREE.Points(bgGeo, bgMat));

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

// ============================================
// HAND DETECTION
// ============================================
let video, handCanvas, handCtx, loader, startBtn, wiggleVal, depthVal;

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
function countExtendedFingers(hand) {
    const fingerTips = [8, 12, 16, 20];
    const fingerPIPs = [6, 10, 14, 18];
    let count = 0;

    // Thumb
    const thumbDist = Math.abs(hand[4].x - hand[2].x);
    if (thumbDist > 0.04) count++;

    // Other fingers
    fingerTips.forEach((tip, i) => {
        const yDiff = hand[fingerPIPs[i]].y - hand[tip].y;
        if (yDiff > 0.03) count++;
    });

    return count;
}

function detectPinch(hand) {
    const thumb = hand[4];
    const index = hand[8];
    const dist = Math.sqrt(
        Math.pow(thumb.x - index.x, 2) +
        Math.pow(thumb.y - index.y, 2)
    );
    return dist < 0.08;
}

function getPinchCenter(hand) {
    return {
        x: (hand[4].x + hand[8].x) / 2,
        y: (hand[4].y + hand[8].y) / 2,
        z: (hand[4].z + hand[8].z) / 2
    };
}

function detectPeaceSign(hand) {
    // Index and middle should be extended
    const indexUp = hand[8].y < hand[6].y - 0.03;
    const middleUp = hand[12].y < hand[10].y - 0.03;

    // Ring and pinky should be down
    const palm = hand[9];
    const ringDist = Math.sqrt(
        Math.pow(hand[16].x - palm.x, 2) +
        Math.pow(hand[16].y - palm.y, 2)
    );
    const pinkyDist = Math.sqrt(
        Math.pow(hand[20].x - palm.x, 2) +
        Math.pow(hand[20].y - palm.y, 2)
    );

    return indexUp && middleUp && ringDist < 0.12 && pinkyDist < 0.12;
}

function detectFist(hand) {
    const palm = hand[9];
    const tips = [4, 8, 12, 16, 20];

    let closedCount = 0;
    tips.forEach(t => {
        const dist = Math.sqrt(
            Math.pow(hand[t].x - palm.x, 2) +
            Math.pow(hand[t].y - palm.y, 2)
        );
        if (dist < 0.10) closedCount++;
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

    document.getElementById('log-swipe').innerText = `${Math.abs(totalDelta).toFixed(2)} (${velocity.toFixed(2)} v)`;

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
    const hands = result.landmarks;

    document.getElementById('log-hands').innerText = hands.length;

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
        wiggleVal.innerText = "DISABLED";
        depthVal.innerText = "DISABLED";
        document.getElementById('log-openness').innerText = "N/A";
        document.getElementById('log-gesture').innerText = currentGesture;
        document.getElementById('log-expansion').innerText = smoothedExpansion.toFixed(3);
        document.getElementById('log-swirl').innerText = smoothedSwirl.toFixed(3);
        document.getElementById('log-wiggle').innerText = "0.000";
        document.getElementById('log-explosion').innerText = "0.000";
        document.getElementById('log-size').innerText = "N/A";
        document.getElementById('log-movement').innerText = "0.000";
        return;
    }

    if (hands.length > 0) {
        const hand = hands[0];
        const fingerCount = countExtendedFingers(hand);

        const isFist = detectFist(hand);
        if (isFist) {
            currentGesture = '✊ Fist (Freeze)';
            freezeTimeTarget = 0.0;
            targetAttractorStrength = 0.0;
            targetWindForce.set(0, 0, 0);
            targetPulse = 0.0;
        } else {
            const isPinching = detectPinch(hand);
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
                const isPeaceSign = detectPeaceSign(hand);
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
                        const direction = getHandDirection(hand);
                        targetWindForce.set(direction.x * 8, -direction.y * 8, 0);
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
                    const direction = getHandDirection(hand);
                    targetWindForce.set(direction.x * 5, -direction.y * 5, 0);
                    targetAttractorStrength = 0.0;
                    targetPulse = 0.0;
                    freezeTimeTarget = 1.0;
                }
            }
        }

        // Calculate expansion, wiggle, and other effects
        let totalOpenness = 0;
        let currentTips = [];
        let avgHandSize = 0;

        hands.forEach(hand => {
            const wrist = hand[0];
            const tips = [4, 8, 12, 16, 20];
            let tipDist = 0;
            tips.forEach(t => {
                const d = Math.sqrt(Math.pow(hand[t].x - wrist.x, 2) + Math.pow(hand[t].y - wrist.y, 2));
                tipDist += d;
                currentTips.push({ x: hand[t].x, y: hand[t].y });
            });
            totalOpenness += (tipDist / 5);
            const size = Math.sqrt(Math.pow(hand[12].x - wrist.x, 2) + Math.pow(hand[12].y - wrist.y, 2));
            avgHandSize += size;
        });

        // Wiggle
        let movement = 0;
        if (prevTips.length === currentTips.length) {
            for (let i = 0; i < currentTips.length; i++) {
                const dx = currentTips[i].x - prevTips[i].x;
                const dy = currentTips[i].y - prevTips[i].y;
                movement += Math.sqrt(dx * dx + dy * dy);
            }
            movement *= 10.0;
        }
        prevTips = currentTips;
        smoothedWiggle += (movement - smoothedWiggle) * CONFIG.physics.smoothingFactor;
        wiggleVal.innerText = Math.round(smoothedWiggle * 100) + "%";
        document.getElementById('log-movement').innerText = movement.toFixed(3);
        document.getElementById('log-wiggle').innerText = smoothedWiggle.toFixed(3);

        // Explosion
        avgHandSize /= hands.length;
        let targetExplosion = (0.3 - avgHandSize) * 4.0;
        targetExplosion = Math.max(0, Math.min(1, targetExplosion));
        smoothedExplosion += (targetExplosion - smoothedExplosion) * CONFIG.physics.smoothingFactor;
        if (smoothedExplosion > 0.5) depthVal.innerText = "FAR (EXPLODE)";
        else depthVal.innerText = "NEAR (STABLE)";
        document.getElementById('log-size').innerText = avgHandSize.toFixed(3);
        document.getElementById('log-explosion').innerText = smoothedExplosion.toFixed(3);

        // Expansion
        let openness = (totalOpenness / hands.length - 0.1) * 3.5;
        openness = Math.max(0, Math.min(1, openness));
        smoothedExpansion += (openness - smoothedExpansion) * CONFIG.physics.smoothingFactor;
        document.getElementById('log-openness').innerText = openness.toFixed(3);
        document.getElementById('log-expansion').innerText = smoothedExpansion.toFixed(3);
        document.getElementById('log-gesture').innerText = currentGesture;

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
        document.getElementById('log-swirl').innerText = smoothedSwirl.toFixed(3);

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
        wiggleVal.innerText = "AUTO";
        depthVal.innerText = "AUTO";
        document.getElementById('log-openness').innerText = "AUTO";
        document.getElementById('log-gesture').innerText = currentGesture;
        document.getElementById('log-expansion').innerText = smoothedExpansion.toFixed(3);
        document.getElementById('log-swirl').innerText = smoothedSwirl.toFixed(3);
        document.getElementById('log-wiggle').innerText = "0.000";
        document.getElementById('log-explosion').innerText = "0.000";
        document.getElementById('log-size').innerText = "N/A";
        document.getElementById('log-movement').innerText = "0.000";
    }
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

    particles.rotation.y += delta * 0.05 * mat.uniforms.uFreezeTime.value;
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
