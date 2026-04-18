import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

type SpawnOpts = {
  cwd?: string;
  cols: number;
  rows: number;
  groupId?: string;
  paneId?: string;
};
type SpawnResult = { id: string };

const MAX_BUFFER = 1_000_000; // ~1MB of binary terminal output per pty

const leafToPty = new Map<string, string>();
const spawning = new Map<string, Promise<string>>();
const buffers = new Map<string, string>(); // ptyId -> binary string
const subscribers = new Map<string, Set<(chunk: string) => void>>();
const unlisteners = new Map<string, UnlistenFn>();

function decodeBase64(b64: string): string {
  // atob returns a binary string (each char.charCodeAt is a byte 0-255)
  return atob(b64);
}

async function ensurePty(
  leafId: string,
  cwd: string | undefined,
  groupId: string | undefined,
): Promise<string> {
  const existing = leafToPty.get(leafId);
  if (existing) return existing;
  const pending = spawning.get(leafId);
  if (pending) return pending;

  const promise = (async () => {
    const opts: SpawnOpts = { cwd, cols: 80, rows: 24, groupId, paneId: leafId };
    const result = await invoke<SpawnResult>('pty_spawn', { opts });
    const ptyId = result.id;
    leafToPty.set(leafId, ptyId);
    buffers.set(ptyId, '');
    subscribers.set(ptyId, new Set());

    const unlisten = await listen<string>(`pty://${ptyId}/data`, (event) => {
      const chunk = decodeBase64(event.payload);
      let buf = buffers.get(ptyId) ?? '';
      buf += chunk;
      if (buf.length > MAX_BUFFER) buf = buf.slice(buf.length - MAX_BUFFER);
      buffers.set(ptyId, buf);
      for (const fn of subscribers.get(ptyId) ?? []) fn(chunk);
    });
    unlisteners.set(ptyId, unlisten);

    return ptyId;
  })();

  spawning.set(leafId, promise);
  try {
    return await promise;
  } finally {
    spawning.delete(leafId);
  }
}

export async function attachPty(
  leafId: string,
  opts: { cwd?: string; groupId?: string; onData: (chunk: string) => void },
): Promise<{ ptyId: string; detach: () => void }> {
  const ptyId = await ensurePty(leafId, opts.cwd, opts.groupId);
  const initial = buffers.get(ptyId);
  if (initial && initial.length > 0) opts.onData(initial);
  subscribers.get(ptyId)?.add(opts.onData);
  return {
    ptyId,
    detach: () => {
      subscribers.get(ptyId)?.delete(opts.onData);
    },
  };
}

export async function writePty(ptyId: string, data: string): Promise<void> {
  await invoke('pty_write', { id: ptyId, data });
}

export async function resizePty(ptyId: string, cols: number, rows: number): Promise<void> {
  await invoke('pty_resize', { id: ptyId, cols, rows });
}

export async function hasForegroundProcess(leafId: string): Promise<boolean> {
  const ptyId = leafToPty.get(leafId);
  if (!ptyId) return false;
  try {
    return await invoke<boolean>('pty_has_foreground_process', { id: ptyId });
  } catch {
    return false;
  }
}

export async function killLeafPty(leafId: string): Promise<void> {
  const ptyId = leafToPty.get(leafId);
  if (!ptyId) return;
  leafToPty.delete(leafId);
  buffers.delete(ptyId);
  subscribers.delete(ptyId);
  const off = unlisteners.get(ptyId);
  if (off) {
    off();
    unlisteners.delete(ptyId);
  }
  try {
    await invoke('pty_kill', { id: ptyId });
  } catch {
    // ignore
  }
}
