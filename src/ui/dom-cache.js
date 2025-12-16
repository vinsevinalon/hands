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
    },
};

export default domCache;
