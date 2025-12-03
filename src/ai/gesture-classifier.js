import * as tf from '@tensorflow/tfjs';

class GestureClassifier {
    constructor() {
        this.model = null;
        this.gestureHistory = [];
        this.historySize = 10; // Temporal smoothing
        this.isReady = false;
    }

    async loadModel(modelPath) {
        try {
            // Load pre-trained or custom model
            this.model = await tf.loadLayersModel(modelPath);
            this.isReady = true;
            console.log('✓ AI Gesture classifier loaded');
            return true;
        } catch (err) {
            console.warn('Model not found, using rule-based detection:', err.message);
            this.isReady = false;
            return false;
        }
    }

    // Extract features from MediaPipe landmarks
    extractFeatures(landmarks) {
        if (!landmarks || landmarks.length === 0) return null;
        
        const features = [];
        
        landmarks.forEach(hand => {
            // Normalize hand landmarks relative to wrist
            const wrist = hand[0];
            
            // Distance features (21 landmarks × 3 coordinates = 63 features)
            hand.forEach(point => {
                features.push(
                    point.x - wrist.x,
                    point.y - wrist.y,
                    (point.z || 0) - (wrist.z || 0)
                );
            });
            
            // Angle features between finger segments
            const fingerIndices = [
                [0, 1, 2, 3, 4],   // Thumb
                [0, 5, 6, 7, 8],   // Index
                [0, 9, 10, 11, 12], // Middle
                [0, 13, 14, 15, 16], // Ring
                [0, 17, 18, 19, 20] // Pinky
            ];
            
            fingerIndices.forEach(indices => {
                for (let i = 0; i < indices.length - 1; i++) {
                    const p1 = hand[indices[i]];
                    const p2 = hand[indices[i + 1]];
                    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                    features.push(angle);
                }
            });
        });
        
        return tf.tensor2d([features]);
    }

    // Temporal smoothing with LSTM-style memory
    async classify(landmarks, confidence = 0.75) {
        if (!this.model || !this.isReady) return null;
        
        const features = this.extractFeatures(landmarks);
        if (!features) return null;
        
        try {
            const prediction = this.model.predict(features);
            const probabilities = await prediction.data();
            
            // Add to history for temporal smoothing
            this.gestureHistory.push(Array.from(probabilities));
            if (this.gestureHistory.length > this.historySize) {
                this.gestureHistory.shift();
            }
            
            // Average predictions over time
            const smoothed = this.smoothPredictions();
            const maxProb = Math.max(...smoothed);
            const gestureIndex = smoothed.indexOf(maxProb);
            
            features.dispose();
            prediction.dispose();
            
            if (maxProb < confidence) {
                return { gesture: 'unknown', confidence: maxProb };
            }
            
            const gestures = ['fist', 'open', 'pinch', 'peace', 'point', 'swipe_left', 'swipe_right'];
            return {
                gesture: gestures[gestureIndex],
                confidence: maxProb,
                probabilities: smoothed
            };
        } catch (err) {
            console.error('Classification error:', err);
            features.dispose();
            return null;
        }
    }

    smoothPredictions() {
        if (this.gestureHistory.length === 0) return [];
        
        const numClasses = this.gestureHistory[0].length;
        const averaged = new Array(numClasses).fill(0);
        
        this.gestureHistory.forEach(probs => {
            probs.forEach((prob, i) => {
                averaged[i] += prob;
            });
        });
        
        return averaged.map(sum => sum / this.gestureHistory.length);
    }

    reset() {
        this.gestureHistory = [];
    }

    dispose() {
        if (this.model) {
            this.model.dispose();
            this.model = null;
        }
        this.gestureHistory = [];
        this.isReady = false;
    }
}

export default GestureClassifier;
