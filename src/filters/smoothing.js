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

export { LowPassFilter, OneEuroFilter };
