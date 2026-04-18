import { create } from 'zustand';
import { v4 as uuid } from 'uuid';

import type { Group, PersistedState } from '../types';
import {
  allLeafIds,
  closeLeaf,
  firstLeafId,
  newLeaf,
  setSplitRatio,
  splitLeaf,
  swapLeaves,
} from './layout';
import { killLeafPty } from '../ipc/pty';
import { loadState, saveState } from '../ipc/storage';

export const SIDEBAR_MIN = 180;
export const SIDEBAR_MAX = 480;
export const SIDEBAR_DEFAULT = 240;
export const NOTES_RATIO_MIN = 0.1;
export const NOTES_RATIO_MAX = 0.9;
export const NOTES_RATIO_DEFAULT = 0.5;

type Store = {
  groups: Group[];
  activeGroupId: string | null;
  focusedPaneByGroup: Record<string, string>;
  sidebarWidth: number;
  sidebarHidden: boolean;
  notesRatio: number;
  loaded: boolean;

  loadFromDisk: () => Promise<void>;
  addGroup: (name?: string, opts?: { activate?: boolean }) => string;
  renameGroup: (id: string, name: string) => void;
  appendNotes: (id: string, text: string) => void;
  deleteGroup: (id: string) => void;
  reorderGroups: (orderedIds: string[]) => void;
  setActiveGroup: (id: string) => void;
  updateNotes: (id: string, notes: string) => void;
  splitFocused: (dir: 'row' | 'column') => void;
  closeFocused: () => void;
  setSplitRatio: (groupId: string, splitId: string, ratio: number) => void;
  swapPanes: (groupId: string, idA: string, idB: string) => void;
  setFocus: (groupId: string, leafId: string) => void;
  cycleGroup: (delta: 1 | -1) => void;
  cyclePane: (delta: 1 | -1) => void;
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;
  setNotesRatio: (ratio: number) => void;
};

function makeGroup(name: string): Group {
  return {
    id: uuid(),
    name,
    notes: '',
    layout: newLeaf(),
  };
}

function clampSidebarWidth(width: number | undefined): number {
  if (typeof width !== 'number' || Number.isNaN(width)) return SIDEBAR_DEFAULT;
  return Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, width));
}

function clampNotesRatio(ratio: number | undefined): number {
  if (typeof ratio !== 'number' || Number.isNaN(ratio)) return NOTES_RATIO_DEFAULT;
  return Math.max(NOTES_RATIO_MIN, Math.min(NOTES_RATIO_MAX, ratio));
}

export const useGroups = create<Store>((set, get) => ({
  groups: [],
  activeGroupId: null,
  focusedPaneByGroup: {},
  sidebarWidth: SIDEBAR_DEFAULT,
  sidebarHidden: false,
  notesRatio: NOTES_RATIO_DEFAULT,
  loaded: false,

  loadFromDisk: async () => {
    const state = await loadState();
    if (!state || state.groups.length === 0) {
      const initial = makeGroup('untitled');
      set({
        groups: [initial],
        activeGroupId: initial.id,
        focusedPaneByGroup: { [initial.id]: firstLeafId(initial.layout) },
        sidebarWidth: clampSidebarWidth(state?.sidebarWidth),
        sidebarHidden: state?.sidebarHidden ?? false,
        notesRatio: clampNotesRatio(state?.notesRatio),
        loaded: true,
      });
      return;
    }
    const focusedPaneByGroup: Record<string, string> = {};
    for (const g of state.groups) {
      focusedPaneByGroup[g.id] = firstLeafId(g.layout);
    }
    const activeGroupId =
      state.activeGroupId && state.groups.some((g) => g.id === state.activeGroupId)
        ? state.activeGroupId
        : state.groups[0].id;
    set({
      groups: state.groups,
      activeGroupId,
      focusedPaneByGroup,
      sidebarWidth: clampSidebarWidth(state.sidebarWidth),
      sidebarHidden: state.sidebarHidden ?? false,
      notesRatio: clampNotesRatio(state.notesRatio),
      loaded: true,
    });
  },

  addGroup: (name, opts) => {
    const group = makeGroup(name?.trim() || 'untitled');
    const activate = opts?.activate ?? true;
    set((s) => ({
      groups: [...s.groups, group],
      activeGroupId: activate ? group.id : s.activeGroupId,
      focusedPaneByGroup: {
        ...s.focusedPaneByGroup,
        [group.id]: firstLeafId(group.layout),
      },
    }));
    return group.id;
  },

  renameGroup: (id, name) => {
    set((s) => ({
      groups: s.groups.map((g) => (g.id === id ? { ...g, name: name.trim() || g.name } : g)),
    }));
  },

  appendNotes: (id, text) => {
    set((s) => ({
      groups: s.groups.map((g) => {
        if (g.id !== id) return g;
        const sep = g.notes.length > 0 && !g.notes.endsWith('\n') ? '\n' : '';
        return { ...g, notes: g.notes + sep + text };
      }),
    }));
  },

  deleteGroup: (id) => {
    const target = get().groups.find((g) => g.id === id);
    if (target) {
      for (const leafId of allLeafIds(target.layout)) {
        void killLeafPty(leafId);
      }
    }
    set((s) => {
      const remaining = s.groups.filter((g) => g.id !== id);
      const focusCopy = { ...s.focusedPaneByGroup };
      delete focusCopy[id];
      let nextActive = s.activeGroupId;
      if (s.activeGroupId === id) {
        const idx = s.groups.findIndex((g) => g.id === id);
        nextActive = remaining[idx]?.id ?? remaining[idx - 1]?.id ?? remaining[0]?.id ?? null;
      }
      if (remaining.length === 0) {
        const fresh = makeGroup('untitled');
        return {
          groups: [fresh],
          activeGroupId: fresh.id,
          focusedPaneByGroup: { [fresh.id]: firstLeafId(fresh.layout) },
        };
      }
      return {
        groups: remaining,
        activeGroupId: nextActive,
        focusedPaneByGroup: focusCopy,
      };
    });
  },

  reorderGroups: (orderedIds) => {
    set((s) => {
      const byId = new Map(s.groups.map((g) => [g.id, g]));
      const reordered = orderedIds
        .map((id) => byId.get(id))
        .filter((g): g is Group => Boolean(g));
      // Append any groups that were missing from the order list (safety net)
      for (const g of s.groups) {
        if (!orderedIds.includes(g.id)) reordered.push(g);
      }
      return { groups: reordered };
    });
  },

  setActiveGroup: (id) => {
    set({ activeGroupId: id });
  },

  updateNotes: (id, notes) => {
    set((s) => ({
      groups: s.groups.map((g) => (g.id === id ? { ...g, notes } : g)),
    }));
  },

  splitFocused: (dir) => {
    const { activeGroupId, focusedPaneByGroup, groups } = get();
    if (!activeGroupId) return;
    const group = groups.find((g) => g.id === activeGroupId);
    if (!group) return;
    const focusedLeaf = focusedPaneByGroup[activeGroupId] ?? firstLeafId(group.layout);
    const { root, newLeafId } = splitLeaf(group.layout, focusedLeaf, dir, group.cwd);
    set((s) => ({
      groups: s.groups.map((g) => (g.id === activeGroupId ? { ...g, layout: root } : g)),
      focusedPaneByGroup: { ...s.focusedPaneByGroup, [activeGroupId]: newLeafId },
    }));
  },

  closeFocused: () => {
    const { activeGroupId, focusedPaneByGroup, groups } = get();
    if (!activeGroupId) return;
    const group = groups.find((g) => g.id === activeGroupId);
    if (!group) return;
    const focusedLeaf = focusedPaneByGroup[activeGroupId] ?? firstLeafId(group.layout);
    void killLeafPty(focusedLeaf);
    const { root, focusFallback } = closeLeaf(group.layout, focusedLeaf);
    if (!root) {
      // Last pane closed - auto-create a fresh leaf so group always has ≥1 pane.
      const fresh = newLeaf(group.cwd);
      set((s) => ({
        groups: s.groups.map((g) => (g.id === activeGroupId ? { ...g, layout: fresh } : g)),
        focusedPaneByGroup: { ...s.focusedPaneByGroup, [activeGroupId]: fresh.id },
      }));
      return;
    }
    set((s) => ({
      groups: s.groups.map((g) => (g.id === activeGroupId ? { ...g, layout: root } : g)),
      focusedPaneByGroup: {
        ...s.focusedPaneByGroup,
        [activeGroupId]: focusFallback ?? firstLeafId(root),
      },
    }));
  },

  setSplitRatio: (groupId, splitId, ratio) => {
    set((s) => ({
      groups: s.groups.map((g) =>
        g.id === groupId ? { ...g, layout: setSplitRatio(g.layout, splitId, ratio) } : g,
      ),
    }));
  },

  swapPanes: (groupId, idA, idB) => {
    if (idA === idB) return;
    set((s) => ({
      groups: s.groups.map((g) =>
        g.id === groupId ? { ...g, layout: swapLeaves(g.layout, idA, idB) } : g,
      ),
    }));
  },

  setFocus: (groupId, leafId) => {
    set((s) => ({
      focusedPaneByGroup: { ...s.focusedPaneByGroup, [groupId]: leafId },
    }));
  },

  cycleGroup: (delta) => {
    const { groups, activeGroupId } = get();
    if (groups.length === 0) return;
    const idx = groups.findIndex((g) => g.id === activeGroupId);
    const next = (idx + delta + groups.length) % groups.length;
    set({ activeGroupId: groups[next].id });
  },

  cyclePane: (delta) => {
    const { groups, activeGroupId, focusedPaneByGroup } = get();
    if (!activeGroupId) return;
    const group = groups.find((g) => g.id === activeGroupId);
    if (!group) return;
    const leaves = allLeafIds(group.layout);
    if (leaves.length === 0) return;
    const focused = focusedPaneByGroup[activeGroupId] ?? leaves[0];
    const idx = leaves.indexOf(focused);
    const next = (idx + delta + leaves.length) % leaves.length;
    set((s) => ({
      focusedPaneByGroup: { ...s.focusedPaneByGroup, [activeGroupId]: leaves[next] },
    }));
  },

  setSidebarWidth: (width) => {
    set({ sidebarWidth: clampSidebarWidth(width) });
  },

  toggleSidebar: () => {
    set((s) => ({ sidebarHidden: !s.sidebarHidden }));
  },

  setNotesRatio: (ratio) => {
    set({ notesRatio: clampNotesRatio(ratio) });
  },
}));

const PERSIST_DEBOUNCE = 400;
let persistTimer: number | null = null;

function snapshot(state: Store): PersistedState {
  return {
    groups: state.groups,
    activeGroupId: state.activeGroupId,
    sidebarWidth: state.sidebarWidth,
    sidebarHidden: state.sidebarHidden,
    notesRatio: state.notesRatio,
  };
}

export function startPersistence() {
  let prev = snapshot(useGroups.getState());
  useGroups.subscribe((state) => {
    if (!state.loaded) return;
    const next = snapshot(state);
    if (
      next.groups === prev.groups &&
      next.activeGroupId === prev.activeGroupId &&
      next.sidebarWidth === prev.sidebarWidth &&
      next.sidebarHidden === prev.sidebarHidden &&
      next.notesRatio === prev.notesRatio
    ) {
      return;
    }
    prev = next;
    if (persistTimer != null) clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => {
      void saveState(next);
    }, PERSIST_DEBOUNCE);
  });
}

export async function flushPersistence() {
  if (persistTimer != null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const state = useGroups.getState();
  if (!state.loaded) return;
  await saveState(snapshot(state));
}
