class DatasetCollector {
    constructor() {
        this.dataset = [];
        this.isRecording = false;
        this.currentLabel = null;
        this.sessionId = Date.now();
    }

    startRecording(gestureLabel) {
        this.isRecording = true;
        this.currentLabel = gestureLabel;
        console.log(`📹 Recording ${gestureLabel}...`);
    }

    stopRecording() {
        this.isRecording = false;
        console.log(`✓ Recorded ${this.dataset.length} samples for session ${this.sessionId}`);
        return this.dataset.length;
    }

    addSample(landmarks, metadata = {}) {
        if (!this.isRecording || !landmarks) return;
        
        this.dataset.push({
            landmarks: landmarks,
            label: this.currentLabel,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            metadata: metadata
        });
    }

    exportDataset(filename = null) {
        if (this.dataset.length === 0) {
            console.warn('No data to export');
            return;
        }

        const blob = new Blob([JSON.stringify(this.dataset, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `gesture-dataset-${this.sessionId}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log(`✓ Exported ${this.dataset.length} samples to ${a.download}`);
    }

    clearDataset() {
        this.dataset = [];
        this.sessionId = Date.now();
        console.log('Dataset cleared');
    }

    getStats() {
        const stats = {};
        this.dataset.forEach(sample => {
            stats[sample.label] = (stats[sample.label] || 0) + 1;
        });
        return {
            total: this.dataset.length,
            byLabel: stats,
            sessionId: this.sessionId
        };
    }
}

export default DatasetCollector;
