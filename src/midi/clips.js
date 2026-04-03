/**
 * Clip launcher: maps state value ranges to MIDI note triggers.
 *
 * In Ableton/Bitwig, incoming MIDI notes on a dedicated channel trigger
 * clips in Session View. The DAW handles beat-quantized launch timing.
 * We just fire note-on/off; the DAW's launch quantization does the rest.
 *
 * Config shape (config.json -> clipLauncher):
 * {
 *   "enabled": true,
 *   "retriggerIntervalMs": 8000,
 *   "mappings": [
 *     {
 *       "source": "cpu",          // state key to watch
 *       "channel": 4,             // MIDI channel (1-16)
 *       "noteOnDurationMs": 200,  // how long to hold the note (DAW ignores duration usually)
 *       "ranges": [
 *         { "min": 0.0, "max": 0.33, "note": 36 },
 *         { "min": 0.33, "max": 0.66, "note": 37 },
 *         { "min": 0.66, "max": 1.0,  "note": 38 }
 *       ]
 *     }
 *   ]
 * }
 */

import { sendNote } from './output.js';

let clipConfig = null;

// Per-source tracking: { [source]: { lastNote, lastFiredAt } }
const clipState = {};

export function initClipLauncher(config) {
  clipConfig = config?.clipLauncher ?? null;
  if (clipConfig?.enabled) {
    console.log('[clips] clip launcher enabled');
  }
}

function noteForValue(ranges, value) {
  for (const range of ranges) {
    if (value >= range.min && value < range.max) return range.note;
  }
  // Handle value == 1.0 falling in last range
  const last = ranges[ranges.length - 1];
  if (last && value >= last.min) return last.note;
  return null;
}

/**
 * Called on every CC tick with the current state object.
 * Fires clip trigger notes when the active range changes or retrigger interval elapses.
 */
export function tickClips(state) {
  if (!clipConfig?.enabled) return;

  const now = Date.now();
  const retrigger = clipConfig.retriggerIntervalMs ?? 8000;

  for (const mapping of (clipConfig.mappings ?? [])) {
    const { source, channel, ranges, noteOnDurationMs = 200 } = mapping;
    const value = state[source];
    if (value == null || !ranges?.length) continue;

    const targetNote = noteForValue(ranges, value);
    if (targetNote == null) continue;

    const prev = clipState[source] ?? {};
    const noteChanged = targetNote !== prev.lastNote;
    const retriggerElapsed = now - (prev.lastFiredAt ?? 0) >= retrigger;

    if (noteChanged || retriggerElapsed) {
      sendNote(channel, targetNote, 100, noteOnDurationMs);
      clipState[source] = { lastNote: targetNote, lastFiredAt: now };

      if (noteChanged) {
        console.log(`[clips] ${source}=${value.toFixed(3)} -> ch${channel} note ${targetNote}`);
      }
    }
  }
}
