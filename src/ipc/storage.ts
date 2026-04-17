import { invoke } from '@tauri-apps/api/core';
import type { PersistedState } from '../types';

export async function loadState(): Promise<PersistedState | null> {
  const raw = await invoke<string | null>('state_load');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

export async function saveState(state: PersistedState): Promise<void> {
  await invoke('state_save', { json: JSON.stringify(state) });
}
