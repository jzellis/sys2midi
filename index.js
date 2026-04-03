/**
 * sys2midi - Linux system metrics -> generative MIDI ambient engine
 *
 * Architecture:
 *   inputs/   -> raw metrics from systeminformation
 *   state/    -> smoothed 0-1 values per metric
 *   midi/     -> virtual ALSA port, config-driven CC + note + clip output
 *   events/   -> journalctl watcher, event queue, external trigger API
 *
 * Network: Node outputs to a virtual ALSA MIDI port.
 * Bridge to Ableton/Bitwig over network:
 *   - Install rtpmidid: pacman -S rtpmidid  (Arch) / apt install rtpmidid
 *   - It auto-exports all ALSA ports over RTP MIDI (Apple MIDI / Network MIDI)
 *   - On macOS: Audio MIDI Setup -> Network -> connect to this machine
 *   - On Windows: use rtpMIDI (Tobias Erichsen) to connect
 *   - On another Linux: qmidinet or another rtpmidid instance
 *
 * External event trigger (from shell scripts, hooks, etc.):
 *   Send a newline-delimited JSON message to stdin:
 *   echo '{"type":"notification","intensity":0.7}' | node index.js
 *   Or pipe to a running instance via a named pipe / socat.
 */

import { readFileSync } from 'fs';
import { createInterface } from 'readline';

import { openVirtualPort, closePort } from './src/midi/output.js';
import { initMapping, sendStateMessages, getLastCCValues } from './src/midi/mapping.js';
import { initClipLauncher, tickClips } from './src/midi/clips.js';
import { pollMetrics } from './src/inputs/index.js';
import { startEventWatcher, tickEvents, triggerEvent, getRecentEvents } from './src/events/index.js';
import { state } from './src/state/index.js';
import { renderDashboard, teardown } from './src/monitor.js';

// Load config
const config = JSON.parse(readFileSync(new URL('./config.json', import.meta.url)));
const { settings } = config;

initMapping(config);
initClipLauncher(config);

async function main() {
  const startTime = Date.now();
  const isTTY = process.stdout.isTTY;

  if (!isTTY) console.log('sys2midi starting...');

  openVirtualPort(settings.midiPortName);

  // Initial metric poll so state isn't zero on first CC burst
  await pollMetrics();

  startEventWatcher();

  // Metric poll loop
  setInterval(pollMetrics, settings.pollIntervalMs);

  // CC + clip output loop
  setInterval(() => {
    tickEvents();
    sendStateMessages(state);
    tickClips(state);
  }, settings.ccIntervalMs);

  // Dashboard / state log
  setInterval(() => {
    if (isTTY) {
      renderDashboard(state, getLastCCValues(), getRecentEvents(), settings.midiPortName, startTime);
    } else {
      const formatted = Object.fromEntries(
        Object.entries(state).map(([k, v]) => [k, v.toFixed(3)])
      );
      console.log('[state]', formatted);
    }
  }, 1000);

  // Stdin event injection (for external scripts / hooks)
  if (!process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin });
    rl.on('line', line => {
      if (!line.trim()) return;
      try {
        const msg = JSON.parse(line);
        if (msg.type) {
          triggerEvent(msg.type, msg.intensity ?? 0.5);
        }
      } catch {
        console.warn('[stdin] invalid JSON:', line.slice(0, 80));
      }
    });
  }

  process.on('SIGINT', () => {
    teardown();
    console.log('[sys2midi] shutting down');
    closePort();
    process.exit(0);
  });

  if (!isTTY) {
    console.log(`[sys2midi] running. CC interval: ${settings.ccIntervalMs}ms, poll: ${settings.pollIntervalMs}ms`);
  }
}

main().catch(err => {
  console.error('[sys2midi] fatal:', err);
  process.exit(1);
});
