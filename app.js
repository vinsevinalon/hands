// Cosmic Particles - Hand Gesture Interactive Visualization
// Optimized Version with AI Enhancement

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FilesetResolver, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm';
import EnhancedGestureDetector from './src/ai/enhanced-detection.js';
import DatasetCollector from './src/ai/training/dataset-collector.js';

// ============================================
// OBJECT POOL - Reduce GC pressure
// ============================================
const vector3Pool = {
    pool: [],
    get() {
        return this.pool.length > 0 ? this.pool.pop() : new THREE.Vector3();
    },
    release(v) {
        v.set(0, 0, 0);
        this.pool.push(v);
    }
};

// ============================================
// DOM ELEMENT CACHE - Reduce DOM queries
// ============================================
const domCache = {
    video: null,
    handCanvas: null,
    handCtx: null,
    loader: null,
    startBtn: null,
    wiggleVal: null,
    depthVal: null,
    gestureFeedbackEl: null,
    gestureFeedbackLabel: null,
    gestureFeedbackBar: null,
    cameraFeed: null,
    gestureToggle: null,
    hud: null,
    controlsToggle: null,
    particleColor: null,
    bokehColor: null,
    colorValue: null,
    bokehColorValue: null,
    initialized: false,
    
    init() {
        if (this.initialized) return;
        this.video = document.getElementById('input-video');
        this.cameraFeed = document.getElementById('camera-feed');
        this.handCanvas = document.getElementById('hand-canvas');
        this.handCtx = this.handCanvas?.getContext('2d', { willReadFrequently: true });
        this.loader = document.getElementById('loader');
        this.startBtn = document.getElementById('start-btn');
        this.wiggleVal = document.getElementById('wiggle-val');
        this.depthVal = document.getElementById('depth-val');
        this.gestureFeedbackEl = document.getElementById('gesture-feedback');
        this.gestureFeedbackLabel = document.getElementById('gesture-label');
        this.gestureFeedbackBar = document.getElementById('gesture-meter-fill');
        this.gestureToggle = document.getElementById('gesture-toggle');
        this.hud = document.getElementById('hud');
        this.controlsToggle = document.getElementById('controls-toggle');
        this.particleColor = document.getElementById('particle-color');
        this.bokehColor = document.getElementById('bokeh-color');
        this.colorValue = document.getElementById('color-value');
        this.bokehColorValue = document.getElementById('bokeh-color-value');
        this.initialized = true;
    }
};

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
        backgroundCount: 450,
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
    controls: {
        glow: {
            sliderMin: 0.0,
            sliderMax: 4.0,
            default: 0.0,
            step: 0.1,
            displayPrecision: 2,
            smoothing: 0.08,
            gamma: 1.35,
            strengthMin: 0.25,
            strengthMax: 3.5,
            radiusMin: 0.2,
            radiusMax: 0.85,
            thresholdMin: 0.2,
            thresholdMax: 0.85
        },
        size: {
            sliderMin: 1.0,
            sliderMax: 10.0,
            default: 9.9,
            step: 0.1,
            displayPrecision: 2,
            smoothing: 0.1,
            gamma: 1.15,
            baseMin: 2.5,
            baseMax: 9.5
        },
        density: {
            sliderMin: 0.0,
            sliderMax: 1.0,
            default: 1.0,
            step: 0.01,
            displayPrecision: 2,
            smoothing: 0.12,
            gamma: 0.85,
            minFactor: 0.02,
            maxFactor: 1.0
        },
        spacing: {
            sliderMin: 0.3,
            sliderMax: 4.0,
            default: 4.0,
            step: 0.1,
            displayPrecision: 2,
            smoothing: 0.12,
            gamma: 0.75
        },
        dotSize: {
            smoothing: 0.12,
            min: {
                sliderMin: 0.4,
                sliderMax: 2.0,
                default: 0.65,
                step: 0.05,
                displayPrecision: 2
            },
            max: {
                sliderMin: 1.0,
                sliderMax: 5.0,
                default: 2.95,
                step: 0.05,
                displayPrecision: 2
            }
        },
        halo: {
            sliderMin: 0.3,
            sliderMax: 2.5,
            default: 0.8,
            step: 0.05,
            displayPrecision: 2,
            smoothing: 0.1
        },
        bokehColor: {
            default: '#da1010'
        },
        color: {
            default: '#e0392c'
        }
    }
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
    powerPreference: CONFIG.rendering.powerPreference,
    alpha: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(CONFIG.rendering.pixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = CONFIG.rendering.toneMappingExposure;
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);
Object.assign(renderer.domElement.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '2',
    pointerEvents: 'none'
});

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
    new THREE.Color(0x5ef3ff),
    new THREE.Color(0x3895ff),
    new THREE.Color(0x8ab6ff),
    new THREE.Color(0x6fe1ff),
    new THREE.Color(0x9ddcff)
];

const COLOR_CURVE = [
    { stop: 0.0, color: new THREE.Color(0xa0f6ff) },
    { stop: 0.3, color: new THREE.Color(0x73bfff) },
    { stop: 0.6, color: new THREE.Color(0x3f7cff) },
    { stop: 1.0, color: new THREE.Color(0x1e42ff) }
];

function getColorByBias(bias) {
    const clamped = THREE.MathUtils.clamp(bias, 0, 1);
    for (let i = 0; i < COLOR_CURVE.length - 1; i++) {
        const current = COLOR_CURVE[i];
        const next = COLOR_CURVE[i + 1];
        if (clamped >= current.stop && clamped <= next.stop) {
            const t = (clamped - current.stop) / (next.stop - current.stop);
            return current.color.clone().lerp(next.color, t);
        }
    }
    return COLOR_CURVE[COLOR_CURVE.length - 1].color.clone();
}

function accelColor(color, amount) {
    return color.clone().multiplyScalar(amount);
}

function getGalaxyColor(bias = Math.random()) {
    const primary = galaxyPalette[Math.floor(Math.random() * galaxyPalette.length)].clone();
    const accent = getColorByBias(bias);
    return primary.multiply(accelColor(accent, 0.5 + Math.random() * 0.5));
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
// AI ENHANCEMENT
// ============================================
let enhancedDetector = null;
let dataCollector = null;
let aiEnabled = false;
let trainingMode = false;
const controlState = {
    glow: {
        value: CONFIG.controls.glow.default,
        target: CONFIG.controls.glow.default
    },
    size: {
        value: CONFIG.controls.size.default,
        target: CONFIG.controls.size.default
    },
    density: {
        value: CONFIG.controls.density.default,
        target: CONFIG.controls.density.default
    },
    spacing: {
        value: CONFIG.controls.spacing.default,
        target: CONFIG.controls.spacing.default
    },
    dotMin: {
        value: CONFIG.controls.dotSize.min.default,
        target: CONFIG.controls.dotSize.min.default
    },
    dotMax: {
        value: CONFIG.controls.dotSize.max.default,
        target: CONFIG.controls.dotSize.max.default
    },
    halo: {
        value: CONFIG.controls.halo.default,
        target: CONFIG.controls.halo.default
    }
};
const particleColor = new THREE.Color(CONFIG.controls.color.default);
const bokehColor = new THREE.Color(CONFIG.controls.bokehColor.default);

// ============================================
// MEMOIZATION CACHE
// ============================================
const memoCache = {
    handScale: new Map(),
    frameId: 0,
    
    nextFrame() {
        this.frameId++;
        if (this.frameId > 10000) this.frameId = 0;
    },
    
    getHandScale(hand, currentFrame) {
        const key = `${currentFrame}`;
        if (this.handScale.has(key)) {
            return this.handScale.get(key);
        }
        const wrist = hand[0];
        const indexBase = hand[5];
        const pinkyBase = hand[17];
        const palmWidth = Math.hypot(indexBase.x - pinkyBase.x, indexBase.y - pinkyBase.y);
        const palmLength = Math.hypot(hand[9].x - wrist.x, hand[9].y - wrist.y);
        const scale = Math.max(0.01, (palmWidth + palmLength) * 0.5);
        this.handScale.set(key, scale);
        if (this.handScale.size > 10) {
            const firstKey = this.handScale.keys().next().value;
            this.handScale.delete(firstKey);
        }
        return scale;
    },
    
    clearFrame() {
        // Only clear old entries periodically
        if (this.frameId % 60 === 0) {
            this.handScale.clear();
        }
    }
};

function setParticleColor(hexValue) {
    if (!hexValue) return;
    try {
        particleColor.set(hexValue);
        sharedUniforms.uBaseColor.value.copy(particleColor);
        if (domCache.colorValue) {
            domCache.colorValue.innerText = hexValue.toUpperCase();
        }
    } catch (e) {
        console.warn('Invalid color value', hexValue, e);
    }
}

function setBokehColor(hexValue) {
    if (!hexValue) return;
    try {
        bokehColor.set(hexValue);
        const len = bokehMaterials.length;
        for (let i = 0; i < len; i++) {
            bokehMaterials[i].color.copy(bokehColor);
            bokehMaterials[i].needsUpdate = true;
        }
        if (domCache.bokehColorValue) {
            domCache.bokehColorValue.innerText = hexValue.toUpperCase();
        }
    } catch (err) {
        console.warn('Invalid bokeh color', hexValue, err);
    }
}

// ============================================
// SHADERS
// ============================================
// Shared simplex noise function (deduplicated)
const simplexNoiseGLSL = `
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
`;
const vShader = `
    uniform float uTime;
    uniform float uExpansion;
    uniform float uSwirl;
    uniform float uWiggle;
    uniform float uExplosion;
    uniform float uMaxSize;
    uniform float uDotSizeMin;
    uniform float uDotSizeMax;
    uniform float uSpacing;
    uniform vec3 uAttractorPos;
    uniform float uAttractorStrength;
    uniform vec3 uWindForce;
    uniform float uFreezeTime;
    uniform float uPulse;
    uniform vec3 uBaseColor;
    uniform float uFlow;

    attribute vec3 aTarget;
    attribute float aRandom;
    attribute float aSizeBias;

    varying vec3 vPos;
    varying float vAlpha;
    varying float vGlow;

    ${simplexNoiseGLSL}

    void main() {
        vec3 target = aTarget * uSpacing;
        float flow = clamp(uFlow, 0.0, 2.0);

        // 1. Wiggle Effect (High freq noise)
        float wiggleNoise = snoise(vec3(target.x * 0.45, target.y * 0.45, uTime * 5.0 + aRandom * 6.0));
        float wigglePower = (0.2 + flow * 0.6) * uWiggle;
        target += wiggleNoise * wigglePower;

        // 2. Base Noise Movement
        float n = snoise(vec3(target.x * 0.08, target.y * 0.08, uTime * 0.25));
        float baseNoise = mix(0.05, 0.55, clamp(flow * 0.5, 0.0, 1.0));
        target += n * baseNoise;

        // 3. Swirl Effect
        float swirlAmount = uSwirl * (0.25 + flow * 0.5);
        float angle = swirlAmount * length(target.xz) * 0.08;
        float s = sin(angle);
        float c = cos(angle);
        mat2 rot = mat2(c, -s, s, c);
        target.xz = rot * target.xz;

        // 4. Explosion (Distance from camera)
        vec3 dir = normalize(target);
        float explosionFactor = mix(6.0, 20.0, clamp(flow * 0.6, 0.0, 1.0));
        target += dir * uExplosion * explosionFactor * (0.3 + 0.7 * aRandom);

        // 5. Expansion (Hand Open/Close)
        vec3 pos = mix(vec3(0.0), target, uExpansion);

        // 6. Attractor Effect (Pinch Gesture)
        if (uAttractorStrength > 0.0) {
            vec3 toAttractor = uAttractorPos - pos;
            float dist = length(toAttractor);
            pos += normalize(toAttractor) * uAttractorStrength * (1.0 / (dist + 1.0)) * 3.0;
        }

        // 7. Wind Force (Hand Direction)
        float windScale = 0.2 + flow * 0.6;
        pos += uWindForce * (aRandom * 0.4 + windScale);

        // 8. Pulse Effect (Peace Sign)
        pos *= (1.0 + uPulse * sin(uTime * 4.5 + aRandom * 10.0) * (0.25 + flow * 0.2));

        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPos;

        // Size with pulse
        float sizeMultiplier = 1.0 + uPulse * 1.5 + flow * 0.35;
        float perParticleSize = mix(uDotSizeMin, uDotSizeMax, clamp(aSizeBias, 0.0, 1.0));
        float finalSize = uMaxSize * perParticleSize;
        gl_PointSize = finalSize * (1.0 / -mvPos.z) * sizeMultiplier;

        vPos = pos;
        vAlpha = 0.4 + 0.6 * smoothstep(-1.0, 1.0, n);
        float radial = clamp(length(pos) / (40.0 * max(uSpacing, 0.2)), 0.0, 1.0);
        vGlow = (1.0 - radial) * (0.4 + flow * 0.3);
    }
`;

const fShader = `
    uniform sampler2D uTex;
    uniform float uFlow;
    uniform vec3 uBaseColor;
    varying vec3 vPos;
    varying float vAlpha;
    varying float vGlow;

    void main() {
        vec4 tex = texture2D(uTex, gl_PointCoord);
        if (tex.a < 0.05) discard;

        float dist = length(vPos);
        float mixFactor = smoothstep(0.0, 18.0, dist);
        vec3 deepTone = uBaseColor * vec3(0.15, 0.2, 0.35);
        vec3 midTone = uBaseColor * 0.8 + vec3(0.05, 0.1, 0.2);
        vec3 highlight = normalize(uBaseColor + vec3(0.4, 0.6, 0.9));
        vec3 glowColor = mix(midTone, deepTone, mixFactor);
        glowColor = mix(glowColor, highlight, vGlow * (0.5 + mixFactor * 0.5));
        float energy = clamp(uFlow, 0.0, 2.0);
        glowColor *= 1.0 + energy * 0.35;

        float alpha = tex.a * vAlpha * (0.65 + vGlow * 0.4 + energy * 0.2);
        gl_FragColor = vec4(glowColor, alpha);
    }
`;

const lineVShader = `
    uniform float uTime;
    uniform float uExpansion;
    uniform float uSwirl;
    uniform float uWiggle;
    uniform float uExplosion;
    uniform float uSpacing;
    uniform vec3 uAttractorPos;
    uniform float uAttractorStrength;
    uniform vec3 uWindForce;
    uniform float uPulse;
    uniform float uFlow;

    attribute float aRandom;

    varying float vLineAlpha;
    varying float vLineGlow;

    ${simplexNoiseGLSL}

    void main() {
        vec3 target = position * uSpacing;
        float flow = clamp(uFlow, 0.0, 2.0);
        float wiggleNoise = snoise(vec3(target.x * 0.2, target.y * 0.2, uTime * 3.5 + aRandom * 4.0));
        target += wiggleNoise * uWiggle * (0.4 + flow * 0.4);
        float n = snoise(vec3(target.x * 0.06, target.y * 0.06, uTime * 0.18));
        target += n * (0.15 + flow * 0.15);
        float angle = uSwirl * (0.15 + flow * 0.35) * length(target.xz) * 0.08;
        float s = sin(angle);
        float c = cos(angle);
        mat2 rot = mat2(c, -s, s, c);
        target.xz = rot * target.xz;
        vec3 dir = normalize(target + vec3(aRandom * 0.3));
        target += dir * uExplosion * (10.0 + flow * 10.0) * (0.25 + 0.75 * aRandom);
        vec3 pos = mix(vec3(0.0), target, uExpansion);
        if (uAttractorStrength > 0.0) {
            vec3 toAttractor = uAttractorPos - pos;
            float dist = length(toAttractor);
            pos += normalize(toAttractor) * uAttractorStrength * (1.0 / (dist + 1.0)) * 2.5;
        }
        pos += uWindForce * (0.2 + flow * 0.6);
        pos *= (1.0 + uPulse * (0.1 + flow * 0.1));
        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPos;
        float heightFade = smoothstep(-20.0, 20.0, pos.y);
        vLineAlpha = (0.35 + 0.45 * heightFade) * (0.7 + flow * 0.3);
        vLineGlow = heightFade;
    }
`;

const lineFShader = `
    uniform float uFlow;
    uniform vec3 uBaseColor;
    varying float vLineAlpha;
    varying float vLineGlow;
    void main() {
        float energy = clamp(uFlow, 0.0, 2.0);
        vec3 baseColor = mix(uBaseColor * 0.35, uBaseColor * 1.5 + vec3(0.2, 0.3, 0.4), vLineGlow);
        baseColor *= 1.0 + energy * 0.4;
        gl_FragColor = vec4(baseColor, vLineAlpha);
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
const sizeBiasArr = new Float32Array(PARTICLE_COUNT);

geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
geo.setAttribute('aTarget', new THREE.BufferAttribute(targetArr, 3));
geo.setAttribute('aRandom', new THREE.BufferAttribute(randArr, 1));
geo.setAttribute('aSizeBias', new THREE.BufferAttribute(sizeBiasArr, 1));

const sharedUniforms = {
    uTime: { value: 0 },
    uExpansion: { value: 1.0 },
    uSwirl: { value: 0.0 },
    uWiggle: { value: 0.0 },
    uExplosion: { value: 0.0 },
    uMaxSize: { value: CONFIG.particles.defaultSize },
    uDotSizeMin: { value: CONFIG.controls.dotSize.min.default },
    uDotSizeMax: { value: CONFIG.controls.dotSize.max.default },
    uSpacing: { value: CONFIG.controls.spacing.default },
    uTex: { value: particleTex },
    uAttractorPos: { value: new THREE.Vector3(0, 0, 0) },
    uAttractorStrength: { value: 0.0 },
    uWindForce: { value: new THREE.Vector3(0, 0, 0) },
    uFreezeTime: { value: 0.0 },
    uPulse: { value: 0.0 },
    uFlow: { value: 0.0 },
    uBaseColor: { value: new THREE.Color(CONFIG.controls.color.default) }
};

const mat = new THREE.ShaderMaterial({
    uniforms: sharedUniforms,
    vertexShader: vShader.replace('${simplexNoiseGLSL}', simplexNoiseGLSL),
    fragmentShader: fShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});

const cosmicCluster = new THREE.Group();
scene.add(cosmicCluster);

const particles = new THREE.Points(geo, mat);
cosmicCluster.add(particles);

const sphereLineGeometry = new THREE.BufferGeometry();
sphereLineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
sphereLineGeometry.setAttribute('aRandom', new THREE.BufferAttribute(new Float32Array(0), 1));
const sphereLineMaterial = new THREE.ShaderMaterial({
    uniforms: sharedUniforms,
    vertexShader: lineVShader.replace('${simplexNoiseGLSL}', simplexNoiseGLSL),
    fragmentShader: lineFShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});
const sphereLines = new THREE.LineSegments(sphereLineGeometry, sphereLineMaterial);
sphereLines.visible = false;
cosmicCluster.add(sphereLines);

// ============================================
// LAZY BACKGROUND INITIALIZATION
// ============================================
let backgroundsLoaded = false;
let bgPoints, bgPointsLarge, galaxyField, bgMat, bgMatLarge, galaxyMat;
const bokehMaterials = [];
const BASE_BOKEH_SIZE = 2.5;
const LARGE_BOKEH_SIZE = BASE_BOKEH_SIZE * 2.25;
const GALAXY_STAR_COUNT = 4000;
const BASE_GALAXY_SIZE = 0.6;

function loadBackgrounds() {
    if (backgroundsLoaded) return;
    backgroundsLoaded = true;
    
    // Background Bokeh
    const bgGeo = new THREE.BufferGeometry();
const bgPos = new Float32Array(CONFIG.particles.backgroundCount * 3);
for (let i = 0; i < CONFIG.particles.backgroundCount; i++) {
    bgPos[i * 3] = (Math.random() - 0.5) * 100;
    bgPos[i * 3 + 1] = (Math.random() - 0.5) * 60;
    bgPos[i * 3 + 2] = (Math.random() - 0.5) * 50 - 20;
}
bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
bgMat = new THREE.PointsMaterial({
    color: new THREE.Color(CONFIG.controls.bokehColor.default),
    size: BASE_BOKEH_SIZE,
    map: particleTex,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
bokehMaterials.push(bgMat);
bgPoints = new THREE.Points(bgGeo, bgMat);
cosmicCluster.add(bgPoints);

const bgGeoLarge = new THREE.BufferGeometry();
const largeCount = Math.floor(CONFIG.particles.backgroundCount * 0.35);
const bgPosLarge = new Float32Array(largeCount * 3);
for (let i = 0; i < largeCount; i++) {
    bgPosLarge[i * 3] = (Math.random() - 0.5) * 120;
    bgPosLarge[i * 3 + 1] = (Math.random() - 0.5) * 80;
    bgPosLarge[i * 3 + 2] = (Math.random() - 0.5) * 70 - 30;
}
bgGeoLarge.setAttribute('position', new THREE.BufferAttribute(bgPosLarge, 3));
bgMatLarge = new THREE.PointsMaterial({
    color: new THREE.Color(CONFIG.controls.bokehColor.default),
    size: LARGE_BOKEH_SIZE,
    map: particleTex,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
bokehMaterials.push(bgMatLarge);
bgPointsLarge = new THREE.Points(bgGeoLarge, bgMatLarge);
cosmicCluster.add(bgPointsLarge);

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
    const color = getGalaxyColor(i / GALAXY_STAR_COUNT);
    galaxyColors[i * 3] = color.r;
    galaxyColors[i * 3 + 1] = color.g;
    galaxyColors[i * 3 + 2] = color.b;
}
galaxyGeo.setAttribute('position', new THREE.BufferAttribute(galaxyPositions, 3));
galaxyGeo.setAttribute('color', new THREE.BufferAttribute(galaxyColors, 3));
galaxyMat = new THREE.PointsMaterial({
    size: BASE_GALAXY_SIZE,
    map: particleTex,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexColors: true
});
galaxyField = new THREE.Points(galaxyGeo, galaxyMat);
cosmicCluster.add(galaxyField);

console.log('Backgrounds loaded lazily');
}

scene.background = null;

// ============================================
// SHAPE GENERATION FUNCTIONS
// ============================================
let structuredSpherePattern = null;
let structuredNovaPattern = null;

function regenerateSpherePattern() {
    structuredSpherePattern = generateLayeredSpherePattern(PARTICLE_COUNT);
}

function getSpherePattern() {
    if (
        !structuredSpherePattern ||
        structuredSpherePattern.count !== PARTICLE_COUNT ||
        !structuredSpherePattern.linePositions
    ) {
        regenerateSpherePattern();
    }
    return structuredSpherePattern;
}

function regenerateNovaPattern() {
    structuredNovaPattern = generateNovaPattern(PARTICLE_COUNT);
}

function getNovaPattern() {
    if (
        !structuredNovaPattern ||
        structuredNovaPattern.count !== PARTICLE_COUNT ||
        !structuredNovaPattern.linePositions
    ) {
        regenerateNovaPattern();
    }
    return structuredNovaPattern;
}

function generateLayeredSpherePattern(desiredCount) {
    const basePositions = [];
    const baseSizes = [];
    const lineSegments = [];

    const pushPoint = (x, y, z, sizeBias) => {
        const idx = basePositions.length;
        basePositions.push({ x, y, z });
        baseSizes.push(THREE.MathUtils.clamp(sizeBias, 0, 1));
        return idx;
    };

    const connectLoop = (indices) => {
        if (!indices || indices.length < 2) return;
        for (let i = 0; i < indices.length; i++) {
            const a = indices[i];
            const b = indices[(i + 1) % indices.length];
            lineSegments.push([a, b]);
        }
    };

    const connectRings = (ringA, ringB) => {
        if (!ringA || !ringB || !ringA.length || !ringB.length) return;
        const len = Math.max(ringA.length, ringB.length);
        for (let i = 0; i < len; i++) {
            const a = ringA[Math.floor((i / len) * ringA.length)];
            const b = ringB[Math.floor((i / len) * ringB.length)];
            lineSegments.push([a, b]);
        }
    };

    const outerRingMeta = [];
    const innerRingMeta = [];

    const buildLatLongLayers = (radius, latSteps, baseSegments, sizeScale, verticalScale = 1, metaStore = null) => {
        let prevRing = null;
        for (let i = 0; i <= latSteps; i++) {
            const v = i / latSteps;
            const theta = (v - 0.5) * Math.PI;
            const y = radius * Math.sin(theta) * verticalScale;
            const ringRadius = Math.abs(radius * Math.cos(theta));
            const normalized = 1 - Math.abs(v - 0.5) * 2;
            let ringIndices = [];
            if (ringRadius < 0.05) {
                const idx = pushPoint(0, y, 0, sizeScale * 0.9);
                ringIndices = [idx];
            } else {
                const segments = Math.max(12, Math.floor(baseSegments * (0.3 + normalized * 0.7) * (ringRadius / radius)));
                for (let j = 0; j < segments; j++) {
                    const phi = (j / segments) * Math.PI * 2;
                    const x = ringRadius * Math.cos(phi);
                    const z = ringRadius * Math.sin(phi);
                    const sizeBias = sizeScale * (0.6 + normalized * 0.4);
                    const idx = pushPoint(x, y, z, sizeBias);
                    ringIndices.push(idx);
                }
            }
            connectLoop(ringIndices);
            if (prevRing) {
                connectRings(prevRing, ringIndices);
            }
            prevRing = ringIndices;
            if (metaStore) {
                metaStore.push({ y, indices: ringIndices });
            }
        }
    };

    const addAccentRing = (radius, y, segments, sizeBias, metaStore = null) => {
        const ringIndices = [];
        for (let j = 0; j < segments; j++) {
            const phi = (j / segments) * Math.PI * 2;
            const x = radius * Math.cos(phi);
            const z = radius * Math.sin(phi);
            const idx = pushPoint(x, y, z, sizeBias);
            ringIndices.push(idx);
        }
        connectLoop(ringIndices);
        if (metaStore) {
            metaStore.push({ y, indices: ringIndices });
        }
        return ringIndices;
    };

    const outerRadius = 12.5;
    buildLatLongLayers(outerRadius, 30, 54, 0.9, 0.95, outerRingMeta);

    const accentOffsets = [0.0, 0.18, -0.18, 0.35, -0.35, 0.55, -0.55];
    accentOffsets.forEach(offset => {
        const y = offset * outerRadius * 0.95;
        const radius = Math.sqrt(Math.max(outerRadius * outerRadius - y * y, 0));
        const ring = addAccentRing(radius, y, 96, 0.95, outerRingMeta);
        const closest = outerRingMeta.reduce((closestRing, candidate) => {
            if (candidate.indices === ring) return closestRing;
            if (!closestRing) return candidate;
            return Math.abs(candidate.y - y) < Math.abs(closestRing.y - y) ? candidate : closestRing;
        }, null);
        if (closest) {
            connectRings(ring, closest.indices);
        }
    });

    const innerRadius = outerRadius * 0.42;
    buildLatLongLayers(innerRadius, 18, 42, 0.65, 1.0, innerRingMeta);

    const equatorialStacks = 9;
    let prevStack = null;
    for (let i = 0; i < equatorialStacks; i++) {
        const t = (i / (equatorialStacks - 1)) - 0.5;
        const widthFactor = Math.cos(t * Math.PI);
        const radius = innerRadius * (0.25 + 0.65 * Math.abs(widthFactor));
        const y = t * innerRadius * 0.9;
        const ring = addAccentRing(radius, y, Math.floor(48 + 20 * widthFactor), 0.75 + widthFactor * 0.25, innerRingMeta);
        if (prevStack) {
            connectRings(prevStack, ring);
        }
        prevStack = ring;
    }

    const flattenIndices = meta => meta.reduce((acc, ring) => acc.concat(ring.indices), []);
    const outerAll = flattenIndices(outerRingMeta);
    const innerAll = flattenIndices(innerRingMeta);

    const connectCollections = (source, target, step = 3) => {
        if (!source.length || !target.length) return;
        for (let i = 0; i < source.length; i += step) {
            const idxA = source[i];
            const idxB = target[Math.floor((i / source.length) * target.length) % target.length];
            lineSegments.push([idxA, idxB]);
        }
    };

    connectCollections(outerAll, innerAll, 5);

    const connectNearestWithin = (indices, hops = 2) => {
        const len = indices.length;
        if (len < 3) return;
        for (let i = 0; i < len; i++) {
            for (let h = 1; h <= hops; h++) {
                const a = indices[i];
                const b = indices[(i + h) % len];
                lineSegments.push([a, b]);
            }
        }
    };

    innerRingMeta.forEach(ringMeta => connectNearestWithin(ringMeta.indices, 3));

    const uniqueCount = basePositions.length;
    const positions = new Array(desiredCount);
    const sizeBiases = new Array(desiredCount);
    for (let i = 0; i < desiredCount; i++) {
        const idx = i % uniqueCount;
        positions[i] = basePositions[idx];
        sizeBiases[i] = baseSizes[idx];
    }

    const linePositions = new Float32Array(lineSegments.length * 6);
    const lineRandoms = new Float32Array(lineSegments.length * 2);
    lineSegments.forEach((pair, segmentIndex) => {
        const a = basePositions[pair[0]];
        const b = basePositions[pair[1]];
        const offset = segmentIndex * 6;
        linePositions[offset] = a.x;
        linePositions[offset + 1] = a.y;
        linePositions[offset + 2] = a.z;
        linePositions[offset + 3] = b.x;
        linePositions[offset + 4] = b.y;
        linePositions[offset + 5] = b.z;
        const bias = THREE.MathUtils.clamp((baseSizes[pair[0]] + baseSizes[pair[1]]) * 0.5, 0.0, 1.0);
        const variance = THREE.MathUtils.clamp(bias + (Math.random() - 0.5) * 0.2, 0.0, 1.0);
        lineRandoms[segmentIndex * 2] = variance;
        lineRandoms[segmentIndex * 2 + 1] = variance;
    });

    return {
        positions,
        sizes: sizeBiases,
        linePositions,
        lineRandoms,
        count: desiredCount
    };
}

function generateNovaPattern(desiredCount) {
    const radialSpokes = 32;
    const ringsPerSpoke = 10;
    const spokes = [];
    const positions = [];
    const sizes = [];
    const lineSegments = [];

    for (let s = 0; s < radialSpokes; s++) {
        const angle = (s / radialSpokes) * Math.PI * 2;
        const dir = new THREE.Vector3(Math.cos(angle), Math.sin(angle * 0.5), Math.sin(angle));
        dir.normalize();
        const spoke = [];
        for (let r = 0; r < ringsPerSpoke; r++) {
            const radius = 3 + r * 2.2;
            const jitter = (Math.random() - 0.5) * 0.8;
            const pos = dir.clone().multiplyScalar(radius + jitter);
            positions.push({ x: pos.x, y: pos.y, z: pos.z });
            const bias = THREE.MathUtils.clamp(r / ringsPerSpoke + Math.random() * 0.1, 0, 1);
            sizes.push(0.5 + bias * 0.8);
            spoke.push(positions.length - 1);
            if (r > 0) {
                lineSegments.push([spoke[r - 1], spoke[r]]);
            }
        }
        spokes.push(spoke);
    }

    const crossConnections = 12;
    for (let i = 0; i < spokes.length; i++) {
        const current = spokes[i];
        const next = spokes[(i + 1) % spokes.length];
        for (let r = 0; r < Math.min(current.length, next.length); r += Math.max(1, Math.floor(current.length / crossConnections))) {
            lineSegments.push([current[r], next[r]]);
        }
    }

    const uniqueCount = positions.length;
    const outputPositions = new Array(desiredCount);
    const outputSizes = new Array(desiredCount);
    for (let i = 0; i < desiredCount; i++) {
        const idx = i % uniqueCount;
        outputPositions[i] = positions[idx];
        outputSizes[i] = sizes[idx];
    }

    const linePositions = new Float32Array(lineSegments.length * 6);
    const lineRandoms = new Float32Array(lineSegments.length * 2);
    lineSegments.forEach((pair, segmentIndex) => {
        const a = positions[pair[0]];
        const b = positions[pair[1]];
        const offset = segmentIndex * 6;
        linePositions[offset] = a.x;
        linePositions[offset + 1] = a.y;
        linePositions[offset + 2] = a.z;
        linePositions[offset + 3] = b.x;
        linePositions[offset + 4] = b.y;
        linePositions[offset + 5] = b.z;
        const variance = Math.random();
        lineRandoms[segmentIndex * 2] = variance;
        lineRandoms[segmentIndex * 2 + 1] = variance;
    });

    return {
        positions: outputPositions,
        sizes: outputSizes,
        linePositions,
        lineRandoms,
        count: desiredCount
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
const shapes = ['sphere', 'fireworks'];
let currentShapeIndex = 0;

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

function setShape(type) {
    const arr = geo.attributes.aTarget.array;
    const randArr = geo.attributes.aRandom.array;
    const sizeBiasAttr = geo.attributes.aSizeBias.array;
    const useStructuredSphere = type === 'sphere';
    const useNova = type === 'fireworks';
    const spherePattern = useStructuredSphere ? getSpherePattern() : null;
    const novaPattern = useNova ? getNovaPattern() : null;

    // Dispose old line geometry buffers before creating new ones
    if (sphereLineGeometry.attributes.position) {
        sphereLineGeometry.attributes.position.array = null;
    }
    if (sphereLineGeometry.attributes.aRandom) {
        sphereLineGeometry.attributes.aRandom.array = null;
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        let p;
        let sizeFactor = Math.random();
        if (useStructuredSphere && spherePattern) {
            const idx = i % spherePattern.positions.length;
            p = spherePattern.positions[idx];
            sizeFactor = spherePattern.sizes[idx];
            randArr[i] = Math.random();
        } else if (useNova && novaPattern) {
            const idx = i % novaPattern.positions.length;
            p = novaPattern.positions[idx];
            sizeFactor = novaPattern.sizes[idx];
            randArr[i] = Math.random();
        } else {
            p = getPointOnSphere();
            randArr[i] = Math.random();
        }
        arr[i * 3] = p.x;
        arr[i * 3 + 1] = p.y;
        arr[i * 3 + 2] = p.z;
        sizeBiasAttr[i] = sizeFactor;
    }
    geo.attributes.aTarget.needsUpdate = true;
    geo.attributes.aRandom.needsUpdate = true;
    geo.attributes.aSizeBias.needsUpdate = true;

    const patternSource = useStructuredSphere ? spherePattern : (useNova ? novaPattern : null);
    if (patternSource && patternSource.linePositions) {
        sphereLineGeometry.setAttribute('position', new THREE.BufferAttribute(patternSource.linePositions, 3));
        if (patternSource.lineRandoms) {
            sphereLineGeometry.setAttribute('aRandom', new THREE.BufferAttribute(patternSource.lineRandoms, 1));
        }
        sphereLineGeometry.computeBoundingSphere();
        sphereLineGeometry.setDrawRange(0, patternSource.linePositions.length / 3);
        sphereLines.visible = true;
    } else {
        sphereLineGeometry.setDrawRange(0, 0);
        sphereLines.visible = false;
    }

    const shapeIdx = shapes.indexOf(type);
    if (shapeIdx !== -1) currentShapeIndex = shapeIdx;

    document.querySelectorAll('[data-shape]').forEach(btn => {
        if (btn.dataset.shape === type) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

window.setShape = setShape;

// ============================================
// UI EVENT HANDLERS
// ============================================
function initUIHandlers() {
    const setupSlider = ({ sliderId, displayId, stateKey, config }) => {
        const slider = document.getElementById(sliderId);
        if (!slider) return;
        slider.min = config.sliderMin;
        slider.max = config.sliderMax;
        slider.step = (config.step ?? 0.01).toString();
        slider.value = config.default;
        const valueEl = document.getElementById(displayId);
        const updateDisplay = (value) => {
            if (valueEl) {
                valueEl.innerText = Number(value).toFixed(config.displayPrecision ?? 2);
            }
        };
        updateDisplay(config.default);
        slider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (controlState[stateKey]) {
                controlState[stateKey].target = val;
            }
            updateDisplay(val);
        });
    };

    setupSlider({
        sliderId: 'glow-slider',
        displayId: 'glow-value',
        stateKey: 'glow',
        config: CONFIG.controls.glow
    });
    setupSlider({
        sliderId: 'size-slider',
        displayId: 'size-value',
        stateKey: 'size',
        config: CONFIG.controls.size
    });
    setupSlider({
        sliderId: 'density-slider',
        displayId: 'density-value',
        stateKey: 'density',
        config: CONFIG.controls.density
    });
    setupSlider({
        sliderId: 'spacing-slider',
        displayId: 'spacing-value',
        stateKey: 'spacing',
        config: CONFIG.controls.spacing
    });
    setupSlider({
        sliderId: 'dot-min-slider',
        displayId: 'dot-min-value',
        stateKey: 'dotMin',
        config: CONFIG.controls.dotSize.min
    });
    setupSlider({
        sliderId: 'dot-max-slider',
        displayId: 'dot-max-value',
        stateKey: 'dotMax',
        config: CONFIG.controls.dotSize.max
    });
    setupSlider({
        sliderId: 'halo-slider',
        displayId: 'halo-value',
        stateKey: 'halo',
        config: CONFIG.controls.halo
    });

    const particleColorPicker = document.getElementById('particle-color');
    if (particleColorPicker) {
        particleColorPicker.value = CONFIG.controls.color.default;
        particleColorPicker.addEventListener('input', (e) => {
            setParticleColor(e.target.value);
        });
    }

    const bokehColorPicker = document.getElementById('bokeh-color');
    if (bokehColorPicker) {
        bokehColorPicker.value = CONFIG.controls.bokehColor.default;
        bokehColorPicker.addEventListener('input', (e) => {
            setBokehColor(e.target.value);
        });
    }

    // Gesture toggle button
    if (domCache.gestureToggle) {
        domCache.gestureToggle.addEventListener('click', () => {
            gestureDetectionEnabled = !gestureDetectionEnabled;
            
            if (gestureDetectionEnabled) {
                domCache.gestureToggle.classList.remove('disabled');
                domCache.gestureToggle.classList.add('enabled');
                domCache.gestureToggle.innerHTML = '🖐️ Gestures: ON';
                console.log('Gesture detection enabled');
            } else {
                domCache.gestureToggle.classList.remove('enabled');
                domCache.gestureToggle.classList.add('disabled');
                domCache.gestureToggle.innerHTML = '🚫 Gestures: OFF';
                console.log('Gesture detection disabled');
            }
        });
    }
}

function initControlPanelToggle() {
    if (!domCache.hud || !domCache.controlsToggle) return;

    const updateToggleLabel = () => {
        domCache.controlsToggle.innerText = domCache.hud.classList.contains('hidden') ? 'Show Controls' : 'Hide Controls';
    };

    domCache.controlsToggle.addEventListener('click', () => {
        domCache.hud.classList.toggle('hidden');
        updateToggleLabel();
    });

    updateToggleLabel();
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
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                logElements[key].innerText = value;
            }, { timeout: 100 });
        } else {
            logElements[key].innerText = value;
        }
    }
}

function filterLandmarks(landmarks, timestampMs) {
    if (!landmarks) return [];
    const timestamp = timestampMs / 1000;
    return landmarks.map((hand, handIndex) => hand.map((landmark, landmarkIndex) => {
        const filtered = { ...landmark };
        ['x', 'y', 'z'].forEach(axis => {
            // Use reduced filter key - share filters across similar landmarks
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

// Clear unused filters when hands disappear
function clearUnusedFilters(activeHandCount) {
    if (activeHandCount === 0 && landmarkFilterBank.size > 0) {
        landmarkFilterBank.clear();
        fingerVelocityHistory.clear();
    }
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
let video, handCanvas, handCtx, loader, startBtn, wiggleVal, depthVal, gestureFeedbackEl, gestureFeedbackLabel, gestureFeedbackBar, cameraFeed;

function updateHandCanvasSize() {
    if (!handCanvas) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    handCanvas.width = width;
    handCanvas.height = height;
    handCanvas.style.width = `${width}px`;
    handCanvas.style.height = `${height}px`;
}

let handLandmarker = null;
let lastVideoTime = -1;
let lastDetectionTime = 0;
const detectionInterval = 1000 / CONFIG.handDetection.fps; // Throttled to 20 FPS

// ============================================
// AI INITIALIZATION
// ============================================
async function initAI() {
    try {
        enhancedDetector = new EnhancedGestureDetector();
        const loaded = await enhancedDetector.init('/models/gesture-model.json');
        
        if (loaded) {
            aiEnabled = true;
            console.log('✅ AI enhancement loaded successfully');
            updateLog('gesture', '🤖 AI Mode Active');
        } else {
            console.log('⚠️ AI model not found, using rule-based detection');
            aiEnabled = false;
        }
        
        // Initialize data collector for training
        dataCollector = new DatasetCollector();
        
        return loaded;
    } catch (err) {
        console.error('AI initialization error:', err);
        aiEnabled = false;
        return false;
    }
}

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
let flowUniformValue = 0.0;

// Rotation Control
let targetRotationSpeed = CONFIG.physics.baseRotationSpeed;
let smoothedRotationSpeed = CONFIG.physics.baseRotationSpeed;
let prevFistAngle = null;
let lastGestureSampleTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
let cosmicRotation = 0;

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
        if (cameraFeed) {
            cameraFeed.srcObject = stream;
        }
        video.addEventListener('loadeddata', () => {
            loader.style.display = 'none';
            startBtn.style.display = 'none';
            updateHandCanvasSize();
            console.log("Camera started successfully");
            detectHands();
        });
        video.play().catch(e => {
            console.error("Video play error:", e);
            loader.innerText = "Click to Start";
            startBtn.style.display = 'block';
        });
        cameraFeed?.play?.().catch(err => {
            console.warn('Camera feed playback failed', err);
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

    // Skip detection if page is not visible
    if (!isPageVisible) {
        requestAnimationFrame(detectHands);
        return;
    }

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
    const neonGreen = '#39ff14';
    const neonPink = '#ff2d95';

    handCtx.save();
    handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    
    // Only draw if hands are detected
    if (!result.landmarks || result.landmarks.length === 0) {
        handCtx.restore();
        return;
    }
    
    handCtx.font = '12px Rajdhani, sans-serif';
    handCtx.textBaseline = 'middle';

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

            handCtx.strokeStyle = neonGreen;
            handCtx.lineWidth = 2;
            handCtx.shadowColor = neonGreen;
            handCtx.shadowBlur = 8;

            for (const [start, end] of connections) {
                const startPoint = landmarks[start];
                const endPoint = landmarks[end];
                handCtx.beginPath();
                handCtx.moveTo(startPoint.x * handCanvas.width, startPoint.y * handCanvas.height);
                handCtx.lineTo(endPoint.x * handCanvas.width, endPoint.y * handCanvas.height);
                handCtx.stroke();
            }

            handCtx.shadowColor = neonPink;
            handCtx.shadowBlur = 6;

            // Draw landmarks + indices
            landmarks.forEach((landmark, idx) => {
                const x = landmark.x * handCanvas.width;
                const y = landmark.y * handCanvas.height;
                handCtx.beginPath();
                handCtx.arc(x, y, 5, 0, 2 * Math.PI);
                handCtx.fillStyle = neonPink;
                handCtx.fill();
                handCtx.strokeStyle = '#ffffff';
                handCtx.lineWidth = 1;
                handCtx.stroke();
                handCtx.fillStyle = neonGreen;
                handCtx.shadowColor = 'rgba(0,0,0,0.6)';
                handCtx.shadowBlur = 0;
                handCtx.fillText(idx.toString(), x + 8, y);
                handCtx.shadowColor = neonPink;
                handCtx.shadowBlur = 6;
            });
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

function handleExpansionRotation(hand, deltaTime) {
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
    const threshold = Math.max(0.04, 0.55 * memoCache.getHandScale(hand, memoCache.frameId));

    let closedCount = 0;
    const tipsLen = tips.length;
    for (let i = 0; i < tipsLen; i++) {
        const t = tips[i];
        const dist = Math.hypot(hand[t].x - palm.x, hand[t].y - palm.y);
        if (dist < threshold) closedCount++;
    }

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

    const handsLen = hands.length;
    for (let h = 0; h < handsLen; h++) {
        const hand = hands[h];
        const wrist = hand[0];
        let tipDist = 0;

        const tipsLen = fingerTipIndices.length;
        for (let i = 0; i < tipsLen; i++) {
            const index = fingerTipIndices[i];
            const tip = hand[index];
            const distance = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
            tipDist += distance;
            aggregate.tipPositions.push({ x: tip.x, y: tip.y });
        }

        aggregate.openness += tipDist / tipsLen;
        aggregate.avgHandSize += Math.hypot(hand[12].x - wrist.x, hand[12].y - wrist.y);
        const direction = getHandDirection(hand);
        aggregate.direction.x += direction.x;
        aggregate.direction.y += direction.y;
    }

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
    const force = vector3Pool.get();
    if (!hands || !hands.length) {
        fingerVelocityHistory.clear();
        const result = force.clone();
        vector3Pool.release(force);
        return result;
    }

    const dt = Math.max(deltaTime, 0.016);
    const handsLen = hands.length;
    for (let h = 0; h < handsLen; h++) {
        const hand = hands[h];
        const handIndex = h;
        const fingerTipIndices = [8, 12, 16, 20];
        const tipsLen = fingerTipIndices.length;
        
        for (let i = 0; i < tipsLen; i++) {
            const tipIndex = fingerTipIndices[i];
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
        }
    }

    force.multiplyScalar(6.5);
    const result = force.clone();
    vector3Pool.release(force);
    return result;
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
    
    // Update memoization frame
    memoCache.nextFrame();

    updateLog('hands', hands.length);
    
    // Clear filters when no hands are detected
    clearUnusedFilters(hands.length);

    let targetAttractorStrength = 0.0;
    let targetWindForce = vector3Pool.get();
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

    if (hands.length === 0) {
        const t = Date.now() * 0.001;
        smoothedExpansion = 0.8 + Math.sin(t) * 0.2;
        smoothedSwirl = Math.sin(t * 0.5) * 0.5;
        smoothedWiggle = 0;
        smoothedExplosion = 0;
        freezeTimeTarget = 1.0;
        smoothedAttractorStrength *= 0.95;
        smoothedWindForce.multiplyScalar(0.95);
        smoothedPulse *= 0.95;
        currentGesture = aiEnabled ? '🤖 AI Auto Mode' : 'Auto Mode';
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
        updateLog('size', "AUTO");
        updateLog('movement', "0.000");
        targetRotationSpeed = CONFIG.physics.baseRotationSpeed;
        fingerVelocityHistory.clear();
        
        // Reset AI detector
        if (enhancedDetector) {
            enhancedDetector.reset();
        }
        
        if (!rotationGestureActive) {
            decayRotationTarget();
        }
        commitGestureState(currentGesture, 0.05);
        return;
        updateLog('expansion', smoothedExpansion.toFixed(3));
        updateLog('swirl', smoothedSwirl.toFixed(3));
        updateLog('wiggle', "0.000");
        updateLog('explosion', "0.000");
        updateLog('size', "N/A");
        updateLog('movement', "0.000");
        targetRotationSpeed = CONFIG.physics.baseRotationSpeed;
        fingerVelocityHistory.clear();
        if (!rotationGestureActive) {
            decayRotationTarget();
        }
        commitGestureState(currentGesture, 0.05);
        return;
    }

    if (hands.length > 0) {
        const aggregatedHands = aggregateHandData(hands);
        const hand = hands[0];
        const fingerCount = countExtendedFingers(hand);
        const fingerFieldForce = applyFingerForceFields(hands, deltaTime);

        const isFist = detectFist(hand);
        let isPinching = false;
        let isPeaceSign = false;
        let ruleBasedGesture = { name: 'None', confidence: 0.5 };

        if (fingerCount === 5) {
            const swipeDirection = detectSwipe(hand);
            if (swipeDirection) {
                changeShape(swipeDirection);
                ruleBasedGesture = {
                    name: swipeDirection === 'right' ? '🖐️➡️ Swipe Right' : '🖐️⬅️ Swipe Left',
                    confidence: 0.9
                };
                currentGesture = ruleBasedGesture.name;
                targetAttractorStrength = 0.0;
                targetWindForce.set(0, 0, 0);
                targetPulse = 0.0;
                freezeTimeTarget = 1.0;
            } else {
                ruleBasedGesture = { name: '🖐️ Rotate + Expand', confidence: 0.85 };
                currentGesture = ruleBasedGesture.name;
                smoothedExplosion = Math.min(1.5, smoothedExplosion + 0.03);
                targetAttractorStrength = 0.0;
                applyDirectionalWind(aggregatedHands.direction, 8, targetWindForce);
                targetPulse = 0.0;
                freezeTimeTarget = 1.0;
                rotationGestureActive = handleExpansionRotation(hand, deltaTime);
            }
        } else {
            prevFistAngle = null;
            if (isFist) {
                ruleBasedGesture = { name: '✊ Collapse', confidence: 0.9 };
                currentGesture = ruleBasedGesture.name;
                freezeTimeTarget = 0.7;
                smoothedExpansion = Math.max(0, smoothedExpansion - 0.04);
                targetAttractorStrength = 0.0;
                targetWindForce.set(0, 0, 0);
                targetPulse = 0.0;
            } else {
                isPinching = detectPinch(hand);
                if (isPinching) {
                    ruleBasedGesture = { name: '👌 Pinch (Attract)', confidence: 0.85 };
                    currentGesture = ruleBasedGesture.name;
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
                        ruleBasedGesture = { name: '✌️ Peace (Pulse)', confidence: 0.85 };
                        currentGesture = ruleBasedGesture.name;
                        targetPulse = 1.0;
                        targetAttractorStrength = 0.0;
                        targetWindForce.set(0, 0, 0);
                        freezeTimeTarget = 1.0;
                    } else if (fingerCount === 1) {
                        ruleBasedGesture = { name: '☝️ One Finger (Collapse)', confidence: 0.8 };
                        currentGesture = ruleBasedGesture.name;
                        smoothedExpansion = Math.max(0, smoothedExpansion - 0.03);
                        targetAttractorStrength = 0.0;
                        targetWindForce.set(0, 0, 0);
                        targetPulse = 0.0;
                        freezeTimeTarget = 1.0;
                    } else {
                        ruleBasedGesture = { name: `🤚 ${fingerCount} Fingers`, confidence: 0.7 };
                        currentGesture = ruleBasedGesture.name;
                        applyDirectionalWind(aggregatedHands.direction, 5, targetWindForce);
                        targetAttractorStrength = 0.0;
                        targetPulse = 0.0;
                        freezeTimeTarget = 1.0;
                    }
                }
            }
        }

        // AI Enhancement - Try to improve gesture detection
        if (enhancedDetector && aiEnabled) {
            enhancedDetector.detect(result, ruleBasedGesture).then(aiResult => {
                if (aiResult.source === 'AI' && aiResult.confidence > 0.85) {
                    currentGesture = `🤖 ${aiResult.gesture}`;
                    if (aiResult.confidence > 0.9) {
                        console.log(`AI: ${aiResult.gesture} (${(aiResult.confidence * 100).toFixed(1)}%)`);
                    }
                    updateLog('gesture', currentGesture);
                }
            }).catch(err => {
                console.warn('AI detection error:', err);
            });
        }

        // Training mode - collect data
        if (trainingMode && dataCollector && dataCollector.isRecording) {
            dataCollector.addSample(result.landmarks, {
                gesture: currentGesture,
                fingerCount: fingerCount,
                handScale: memoCache.getHandScale(hand, memoCache.frameId)
            });
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
    }

    if (!rotationGestureActive) {
        decayRotationTarget();
    }

    const gestureEnergy = Math.min(
        0.3,
        0.05 + movement * 0.01 + smoothedPulse * 0.05 + smoothedWindForce.length() * 0.02
    );
    commitGestureState(currentGesture, gestureEnergy);
    
    // Release pooled vector
    vector3Pool.release(targetWindForce);
}

// ============================================
// ANIMATION LOOP
// ============================================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    
    // Lazy load backgrounds after first render
    if (!backgroundsLoaded) {
        loadBackgrounds();
    }
    
    // Clear memoization cache periodically
    memoCache.clearFrame();

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
    const flowTarget = THREE.MathUtils.clamp(
        smoothedWiggle * 1.1 +
        smoothedWindForce.length() * 0.35 +
        Math.abs(smoothedSwirl) * 0.4 +
        smoothedPulse * 0.8 +
        smoothedExplosion * 0.35,
        0,
        2.5
    );
    flowUniformValue += (flowTarget - flowUniformValue) * 0.08;
    sharedUniforms.uFlow.value = flowUniformValue;

    // Smoothly apply manual control adjustments so glow/size evolve more naturally
    const glowControl = CONFIG.controls.glow;
    controlState.glow.value += (controlState.glow.target - controlState.glow.value) * glowControl.smoothing;
    const glowNorm = THREE.MathUtils.clamp(
        (controlState.glow.value - glowControl.sliderMin) / (glowControl.sliderMax - glowControl.sliderMin),
        0,
        1
    );
    const glowPerceptual = Math.pow(glowNorm, glowControl.gamma);
    bloomPass.strength = THREE.MathUtils.lerp(glowControl.strengthMin, glowControl.strengthMax, glowPerceptual);
    bloomPass.radius = THREE.MathUtils.lerp(glowControl.radiusMin, glowControl.radiusMax, glowPerceptual);
    bloomPass.threshold = THREE.MathUtils.lerp(glowControl.thresholdMax, glowControl.thresholdMin, glowPerceptual);

    const sizeControl = CONFIG.controls.size;
    controlState.size.value += (controlState.size.target - controlState.size.value) * sizeControl.smoothing;
    const sizeNorm = THREE.MathUtils.clamp(
        (controlState.size.value - sizeControl.sliderMin) / (sizeControl.sliderMax - sizeControl.sliderMin),
        0,
        1
    );
    const sizePerceptual = Math.pow(sizeNorm, sizeControl.gamma);
    const baseSize = THREE.MathUtils.lerp(sizeControl.baseMin, sizeControl.baseMax, sizePerceptual);
    mat.uniforms.uMaxSize.value = baseSize;

    const densityControl = CONFIG.controls.density;
    controlState.density.value += (controlState.density.target - controlState.density.value) * densityControl.smoothing;
    const densityNorm = THREE.MathUtils.clamp(
        (controlState.density.value - densityControl.sliderMin) / (densityControl.sliderMax - densityControl.sliderMin),
        0,
        1
    );
    const densityFactor = THREE.MathUtils.lerp(
        densityControl.minFactor,
        densityControl.maxFactor,
        Math.pow(densityNorm, densityControl.gamma)
    );
    const activeParticleCount = Math.max(1, Math.floor(PARTICLE_COUNT * densityFactor));
    if (geo.drawRange.count !== activeParticleCount) {
        geo.setDrawRange(0, activeParticleCount);
    }

    const spacingControl = CONFIG.controls.spacing;
    controlState.spacing.value += (controlState.spacing.target - controlState.spacing.value) * spacingControl.smoothing;
    const spacingNorm = THREE.MathUtils.clamp(
        (controlState.spacing.value - spacingControl.sliderMin) / (spacingControl.sliderMax - spacingControl.sliderMin),
        0,
        1
    );
    const spacingPerceptual = Math.pow(spacingNorm, spacingControl.gamma);
    const spacingValue = THREE.MathUtils.lerp(
        spacingControl.sliderMin,
        spacingControl.sliderMax,
        spacingPerceptual
    );
    mat.uniforms.uSpacing.value = spacingValue;

    const dotControl = CONFIG.controls.dotSize;
    controlState.dotMin.value += (controlState.dotMin.target - controlState.dotMin.value) * dotControl.smoothing;
    controlState.dotMax.value += (controlState.dotMax.target - controlState.dotMax.value) * dotControl.smoothing;
    const dotMin = THREE.MathUtils.clamp(
        controlState.dotMin.value,
        dotControl.min.sliderMin,
        dotControl.min.sliderMax
    );
    let dotMax = THREE.MathUtils.clamp(
        controlState.dotMax.value,
        dotControl.max.sliderMin,
        dotControl.max.sliderMax
    );
    dotMax = Math.max(dotMax, dotMin + 0.05);
    mat.uniforms.uDotSizeMin.value = dotMin;
    mat.uniforms.uDotSizeMax.value = dotMax;
    const haloControl = CONFIG.controls.halo;
    controlState.halo.value += (controlState.halo.target - controlState.halo.value) * haloControl.smoothing;
    const haloScale = THREE.MathUtils.clamp(
        controlState.halo.value,
        haloControl.sliderMin,
        haloControl.sliderMax
    );
    bgMat.size = BASE_BOKEH_SIZE * haloScale;
    if (typeof bgMatLarge !== 'undefined') {
        bgMatLarge.size = LARGE_BOKEH_SIZE * haloScale;
        bgMatLarge.needsUpdate = true;
    }
    galaxyMat.size = BASE_GALAXY_SIZE * (0.4 + haloScale * 0.6);
    bgMat.needsUpdate = true;
    galaxyMat.needsUpdate = true;

    smoothedRotationSpeed += (targetRotationSpeed - smoothedRotationSpeed) * CONFIG.physics.rotationSmoothingFactor;
    const rotationDelta = delta * smoothedRotationSpeed * mat.uniforms.uFreezeTime.value;
    cosmicRotation += rotationDelta;
    cosmicCluster.rotation.y = cosmicRotation;
    
    if (backgroundsLoaded) {
        bgPoints.rotation.y = -cosmicRotation * 0.3;
        galaxyField.rotation.y = -cosmicRotation * 0.5;
        galaxyField.rotation.x = THREE.MathUtils.lerp(
            galaxyField.rotation.x,
            Math.sin(clock.elapsedTime * 0.05) * 0.1,
            0.05
        );
    }
    
    composer.render();
}

// ============================================
// WINDOW RESIZE HANDLER (DEBOUNCED)
// ============================================
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
        updateHandCanvasSize();
    }, 200);
});

// ============================================
// PAGE VISIBILITY API - Pause when hidden
// ============================================
let isPageVisible = true;
document.addEventListener('visibilitychange', () => {
    isPageVisible = !document.hidden;
    if (isPageVisible) {
        console.log('Page visible - resuming');
    } else {
        console.log('Page hidden - pausing hand detection');
    }
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
    
    // Dispose AI resources
    if (enhancedDetector) {
        enhancedDetector.dispose();
    }

    console.log('Resources cleaned up');
});

// ============================================
// INITIALIZATION
// ============================================
function init() {
    // Initialize DOM cache first
    domCache.init();
    
    // Initialize DOM element references (legacy support)
    video = domCache.video;
    cameraFeed = domCache.cameraFeed;
    handCanvas = domCache.handCanvas;
    handCtx = domCache.handCtx;
    loader = domCache.loader;
    startBtn = domCache.startBtn;
    wiggleVal = domCache.wiggleVal;
    depthVal = domCache.depthVal;
    gestureFeedbackEl = domCache.gestureFeedbackEl;
    gestureFeedbackLabel = domCache.gestureFeedbackLabel;
    gestureFeedbackBar = domCache.gestureFeedbackBar;
    updateHandCanvasSize();
    cacheLogElements();
    updateGestureFeedback('Initializing', 0.2);

    setParticleColor(CONFIG.controls.color.default);
    setBokehColor(CONFIG.controls.bokehColor.default);
    setShape('sphere');
    initUIHandlers();
    initControlPanelToggle();
    initStartButton();
    
    // Initialize AI
    initAI().then(loaded => {
        if (loaded) {
            console.log('✅ AI-enhanced gesture detection ready');
        } else {
            console.log('ℹ️ Using rule-based gesture detection');
        }
    });
    
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
