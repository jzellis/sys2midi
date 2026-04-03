/**
 * Live terminal dashboard.
 * Only activates when stdout is a TTY. Falls back to plain log otherwise.
 * Redraws every second using cursor-home + overwrite (no flicker clear).
 */

const BAR_WIDTH = 24;
const EVENT_ROWS = 8;

// ANSI helpers
const A = {
  home:       '\x1b[H',
  clearLine:  '\x1b[2K',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  reset:      '\x1b[0m',
  bold:       '\x1b[1m',
  dim:        '\x1b[2m',
  green:      '\x1b[32m',
  yellow:     '\x1b[33m',
  red:        '\x1b[31m',
  cyan:       '\x1b[36m',
  white:      '\x1b[37m',
  gray:       '\x1b[90m',
};

function color(value) {
  if (value < 0.4) return A.green;
  if (value < 0.7) return A.yellow;
  return A.red;
}

function bar(value, width = BAR_WIDTH) {
  const filled = Math.round(Math.max(0, Math.min(1, value)) * width);
  const empty  = width - filled;
  return color(value) + '\u2588'.repeat(filled) + A.dim + '\u2591'.repeat(empty) + A.reset;
}

function pct(value) {
  return (value * 100).toFixed(0).padStart(3) + '%';
}

function pad(str, len) {
  return str.slice(0, len).padEnd(len);
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function formatTime(ts) {
  return new Date(ts).toTimeString().slice(0, 8);
}

// ---- rows we need to track ----
// state rows + header + gap + events header + events + bottom gap
const METRIC_KEYS = ['cpu', 'ram', 'disk', 'net', 'activity', 'errorLevel'];
const TOTAL_LINES = 2 + 1 + METRIC_KEYS.length + 2 + 1 + EVENT_ROWS + 1;

let rendered = false;

export function renderDashboard(state, ccValues, recentEvents, portName, startTime) {
  if (!process.stdout.isTTY) return;

  const lines = [];

  const uptime = formatUptime(Date.now() - startTime);
  const title  = `${A.bold}${A.cyan}sys2midi${A.reset}  ${A.dim}${portName}${A.reset}`;
  const uptimeStr = `${A.dim}up ${uptime}${A.reset}`;
  lines.push(`  ${title}  ${uptimeStr}`);
  lines.push('');

  // Metric rows
  const labels = {
    cpu:        'CPU      ',
    ram:        'RAM      ',
    disk:       'Disk     ',
    net:        'Network  ',
    activity:   'Activity ',
    errorLevel: 'Error    ',
  };

  for (const key of METRIC_KEYS) {
    const val    = state[key] ?? 0;
    const ccInfo = ccValues[key];
    const ccStr  = ccInfo
      ? `  ${A.dim}CC${String(ccInfo.cc).padStart(2)} ch${ccInfo.channel}${A.reset}  ${A.white}${String(ccInfo.value).padStart(3)}${A.reset}`
      : '';
    lines.push(`  ${A.bold}${labels[key]}${A.reset} ${bar(val)}  ${pct(val)}${ccStr}`);
  }

  lines.push('');
  lines.push(`  ${A.bold}${A.white}RECENT EVENTS${A.reset}`);

  const events = recentEvents.slice(-EVENT_ROWS);
  // pad to always fill EVENT_ROWS so overwrite clears stale content
  while (events.length < EVENT_ROWS) events.unshift(null);

  for (const ev of events) {
    if (!ev) {
      lines.push('');
      continue;
    }
    const typeColor = ev.type === 'error' ? A.red : ev.type === 'service' ? A.cyan : A.yellow;
    const ts   = formatTime(ev.timestamp);
    const type = pad(ev.type, 12);
    const intStr = `[${ev.intensity.toFixed(2)}]`;
    const msg  = ev.line ? ev.line.slice(0, 55) : '';
    lines.push(`  ${A.dim}${ts}${A.reset}  ${typeColor}${type}${A.reset}${A.dim}${intStr}${A.reset}  ${msg}`);
  }

  lines.push('');

  // Build output: go home, then overwrite each line
  let out = A.home;
  for (const line of lines) {
    out += A.clearLine + line + '\n';
  }

  if (!rendered) {
    process.stdout.write(A.hideCursor);
    // Ensure we have enough space by printing blank lines first
    process.stdout.write('\n'.repeat(TOTAL_LINES));
    rendered = true;
  }

  process.stdout.write(out);
}

export function teardown() {
  if (process.stdout.isTTY) {
    process.stdout.write(A.showCursor + '\n');
  }
}
