/**
 * Time-windowed moving average smoother.
 * Samples older than `windowMs` are automatically discarded.
 */
export class MovingAverage {
  constructor(windowMs) {
    this.windowMs = windowMs;
    this.samples = [];
  }

  push(value) {
    const now = Date.now();
    this.samples.push({ value, time: now });
    const cutoff = now - this.windowMs;
    this.samples = this.samples.filter(s => s.time >= cutoff);
    return this.value;
  }

  get value() {
    if (this.samples.length === 0) return 0;
    return this.samples.reduce((acc, s) => acc + s.value, 0) / this.samples.length;
  }
}
