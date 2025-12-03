import GestureClassifier from './gesture-classifier.js';

class EnhancedGestureDetector {
    constructor() {
        this.classifier = new GestureClassifier();
        this.isInitialized = false;
        this.useAI = false;
    }

    async init(modelPath = '/models/gesture-model.json') {
        try {
            const loaded = await this.classifier.loadModel(modelPath);
            this.useAI = loaded;
            this.isInitialized = true;
            return loaded;
        } catch (err) {
            console.warn('AI initialization failed, using rule-based detection:', err);
            this.useAI = false;
            this.isInitialized = true;
            return false;
        }
    }

    // Combine MediaPipe + AI classification
    async detect(mediapipeResult, ruleBasedGesture) {
        if (!this.isInitialized) {
            return {
                gesture: ruleBasedGesture.name,
                confidence: ruleBasedGesture.confidence,
                source: 'rule-based',
                metadata: {}
            };
        }

        if (!this.useAI || !mediapipeResult.landmarks || mediapipeResult.landmarks.length === 0) {
            return {
                gesture: ruleBasedGesture.name,
                confidence: ruleBasedGesture.confidence,
                source: 'rule-based',
                metadata: {}
            };
        }

        const aiGesture = await this.classifier.classify(
            mediapipeResult.landmarks,
            0.75 // Higher confidence threshold
        );
        
        // Fusion: Prefer AI when confident, fallback to rule-based
        if (aiGesture && aiGesture.confidence > 0.8) {
            return {
                gesture: aiGesture.gesture,
                confidence: aiGesture.confidence,
                source: 'AI',
                metadata: aiGesture.probabilities
            };
        }
        
        return {
            gesture: ruleBasedGesture.name,
            confidence: ruleBasedGesture.confidence,
            source: 'rule-based',
            metadata: {}
        };
    }

    reset() {
        if (this.classifier) {
            this.classifier.reset();
        }
    }

    dispose() {
        if (this.classifier) {
            this.classifier.dispose();
        }
        this.isInitialized = false;
        this.useAI = false;
    }
}

export default EnhancedGestureDetector;
