import { spawn } from 'child_process';
import { EventEmitter } from 'events';

export const journal = new EventEmitter();

// Patterns that classify a journal line into an event type
const CLASSIFIERS = [
  { pattern: /\b(error|failed|failure|critical|fatal)\b/i, type: 'error',   intensity: 0.75 },
  { pattern: /\b(warning|warn)\b/i,                        type: 'error',   intensity: 0.4  },
  { pattern: /\b(started|activated|reached target)\b/i,    type: 'service', intensity: 0.45 },
  { pattern: /\b(stopped|deactivated|removed)\b/i,         type: 'service', intensity: 0.35 },
];

export function watchJournal() {
  const proc = spawn('journalctl', ['-f', '-n', '0', '--output=short-iso'], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  proc.stdout.on('data', chunk => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      for (const { pattern, type, intensity } of CLASSIFIERS) {
        if (pattern.test(line)) {
          journal.emit('event', { type, intensity, line });
          break; // first matching classifier wins
        }
      }
    }
  });

  proc.on('error', err => {
    console.warn('[journalctl] failed to start:', err.message);
  });

  proc.on('close', code => {
    if (code !== 0) console.warn('[journalctl] exited with code', code);
  });

  return proc;
}
