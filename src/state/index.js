import { MovingAverage } from './smoother.js';

const smoothers = {
  cpu:        new MovingAverage(30_000),   // 30s window - slow tension changes
  ram:        new MovingAverage(90_000),   // 90s window - very slow density
  disk:       new MovingAverage(7_500),    // 7.5s window - medium texture
  net:        new MovingAverage(7_500),    // 7.5s window - medium rhythm
  errorLevel: new MovingAverage(20_000),   // 20s window - dissonance decay
};

// Global musical state: all values 0.0 - 1.0
export const state = {
  cpu:        0,
  ram:        0,
  disk:       0,
  net:        0,
  activity:   0,  // composite of disk + net + cpu
  errorLevel: 0,
};

export function updateState(key, rawValue) {
  const smoother = smoothers[key];
  if (!smoother) return;
  const clamped = Math.max(0, Math.min(1, rawValue));
  state[key] = smoother.push(clamped);
  // Recompute composite activity signal
  state.activity = state.cpu * 0.3 + state.disk * 0.35 + state.net * 0.35;
}
