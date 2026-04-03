/**
 * Config-driven MIDI mapping layer.
 * Reads continuous and event mappings from config.json and applies them.
 */

import { sendCC, sendNote } from './output.js';

let config = null;

// Tracks last value sent per state key: { [key]: { cc, channel, value } }
const lastCC = {};

export function initMapping(loadedConfig) {
  config = loadedConfig;
}

export function getLastCCValues() {
  return lastCC;
}

// Map a 0.0-1.0 value into [min, max] integer range
function mapValue(value01, min, max) {
  const clamped = Math.max(0, Math.min(1, value01));
  return Math.round(min + clamped * (max - min));
}

/**
 * Send CC (or other continuous) messages for the current state object.
 * Each key in state is looked up in config.continuous.
 */
export function sendStateMessages(state) {
  if (!config) return;
  for (const [key, mapping] of Object.entries(config.continuous)) {
    if (!mapping.enabled) continue;
    const value = state[key];
    if (value == null) continue;

    if (mapping.type === 'cc') {
      const ccVal = mapValue(value, mapping.valueMin ?? 0, mapping.valueMax ?? 127);
      sendCC(mapping.channel, mapping.cc, ccVal);
      lastCC[key] = { cc: mapping.cc, channel: mapping.channel, value: ccVal };
    }
    // Future: pitchbend, aftertouch, etc.
  }
}

/**
 * Fire a MIDI event from config.events using intensity (0.0-1.0) to scale velocity.
 */
export function fireEvent(type, intensity = 0.5) {
  if (!config) return;
  const mapping = config.events[type] ?? config.events.custom;
  if (!mapping || !mapping.enabled) return;

  const velocity = mapValue(intensity, mapping.velocityMin ?? 40, mapping.velocityMax ?? 100);
  sendNote(mapping.channel, mapping.note, velocity, mapping.durationMs ?? 500);
}
