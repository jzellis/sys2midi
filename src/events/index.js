/**
 * Event detection and routing.
 * Watches journalctl, accumulates error level, fires MIDI events via mapping.
 */

import { journal, watchJournal } from './journalctl.js';
import { fireEvent } from '../midi/mapping.js';
import { updateState } from '../state/index.js';

// Error accumulator decays toward zero each tick
const ERROR_DECAY = 0.94;
const ERROR_BUMP  = 0.25;

let errorAccum = 0;

// Ring buffer of recent events for the monitor
const RECENT_MAX = 20;
const recentEvents = [];

export function getRecentEvents() {
  return recentEvents;
}

function recordEvent(type, intensity, line) {
  recentEvents.push({ type, intensity, line, timestamp: Date.now() });
  if (recentEvents.length > RECENT_MAX) recentEvents.shift();
}

// Simple per-type cooldown to prevent event floods (ms)
const COOLDOWN_MS = {
  error:        3000,
  service:      2000,
  notification: 1500,
  custom:       1000,
};
const lastFired = {};

function canFire(type) {
  const cooldown = COOLDOWN_MS[type] ?? 1000;
  const last = lastFired[type] ?? 0;
  return Date.now() - last >= cooldown;
}

function fire(type, intensity, line) {
  if (!canFire(type)) return;
  lastFired[type] = Date.now();
  fireEvent(type, intensity);
  recordEvent(type, intensity, line);
  if (!process.stdout.isTTY) {
    console.log(`[event] ${type} (intensity=${intensity.toFixed(2)})`);
  }
}

export function startEventWatcher() {
  watchJournal();

  journal.on('event', ({ type, intensity, line }) => {
    fire(type, intensity, line);

    if (type === 'error') {
      errorAccum = Math.min(1, errorAccum + ERROR_BUMP * intensity);
    }
  });
}

/** Called every CC tick to decay errorLevel and push it into state. */
export function tickEvents() {
  errorAccum *= ERROR_DECAY;
  updateState('errorLevel', errorAccum);
}

/** External API: trigger an event from a script or stdin hook. */
export function triggerEvent(type, intensity = 0.5) {
  const clamped = Math.max(0, Math.min(1, intensity));
  fire(type, clamped, '(external trigger)');
  if (type === 'error') {
    errorAccum = Math.min(1, errorAccum + ERROR_BUMP * clamped);
  }
}
