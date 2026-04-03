import si from 'systeminformation';
import { updateState } from '../state/index.js';

// Normalisation ceilings - tune these for your hardware
const DISK_MAX_OPS_PER_SEC = 500;   // total r+w IOPS considered "full"
const NET_MAX_BYTES_PER_SEC = 12.5e6; // 100 Mbps

let lastDiskRead = null;

export async function pollMetrics() {
  try {
    const [cpu, mem, disk, nets] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.disksIO(),
      si.networkStats(),
    ]);

    // CPU: currentLoad is already 0-100
    updateState('cpu', cpu.currentLoad / 100);

    // RAM: fraction of total that is used
    updateState('ram', 1 - mem.available / mem.total);

    // Disk: rIO_sec + wIO_sec (ops/sec), handle null on first poll
    if (disk && disk.rIO_sec != null) {
      const ops = (disk.rIO_sec ?? 0) + (disk.wIO_sec ?? 0);
      updateState('disk', ops / DISK_MAX_OPS_PER_SEC);
    }

    // Network: sum first interface's rx+tx bytes/sec
    const iface = Array.isArray(nets) ? nets[0] : nets;
    if (iface) {
      const bps = (iface.rx_sec ?? 0) + (iface.tx_sec ?? 0);
      updateState('net', bps / NET_MAX_BYTES_PER_SEC);
    }
  } catch (err) {
    // Non-fatal - metrics will just hold their last smoothed value
    console.warn('[inputs] poll error:', err.message);
  }
}
