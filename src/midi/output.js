import midi from 'midi';

const output = new midi.Output();

export function openVirtualPort(name = 'System Ambient Engine') {
  output.openVirtualPort(name);
  console.log(`[midi] virtual port opened: "${name}"`);
}

// channel: 1-16 (converted internally to 0-15)
export function sendCC(channel, cc, value) {
  const status = 0xB0 | ((channel - 1) & 0x0F);
  output.sendMessage([status, cc & 0x7F, Math.round(value) & 0x7F]);
}

export function sendNoteOn(channel, note, velocity) {
  const status = 0x90 | ((channel - 1) & 0x0F);
  output.sendMessage([status, note & 0x7F, Math.round(velocity) & 0x7F]);
}

export function sendNoteOff(channel, note) {
  const status = 0x80 | ((channel - 1) & 0x0F);
  output.sendMessage([status, note & 0x7F, 0]);
}

export function sendNote(channel, note, velocity, durationMs = 500) {
  sendNoteOn(channel, note, velocity);
  setTimeout(() => sendNoteOff(channel, note), durationMs);
}

export function closePort() {
  output.closePort();
}
