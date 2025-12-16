import EnhancedGestureDetector from '../ai/enhanced-detection.js';

let detector = null;

async function ensureDetector(modelPath) {
    if (detector) {
        return detector;
    }
    detector = new EnhancedGestureDetector();
    await detector.init(modelPath);
    return detector;
}

self.addEventListener('message', async (event) => {
    const { id, type, payload } = event.data;
    try {
        if (type === 'init') {
            const modelPath = payload?.modelPath || '/models/gesture-model.json';
            const instance = await ensureDetector(modelPath);
            self.postMessage({ id, type: 'init', result: { loaded: instance.useAI } });
        } else if (type === 'detect') {
            if (!detector) {
                throw new Error('Detector not initialized');
            }
            const result = await detector.detect(
                { landmarks: payload?.landmarks || [] },
                payload?.ruleBasedGesture || { name: 'None', confidence: 0 }
            );
            self.postMessage({ id, type: 'detect', result });
        } else if (type === 'reset') {
            detector?.reset();
            self.postMessage({ id, type: 'reset', result: true });
        } else if (type === 'dispose') {
            detector?.dispose();
            detector = null;
            self.postMessage({ id, type: 'dispose', result: true });
            self.close();
        } else {
            throw new Error(`Unknown worker action: ${type}`);
        }
    } catch (error) {
        self.postMessage({
            id,
            type: `${type}-error`,
            error: error?.message || String(error),
        });
    }
});
