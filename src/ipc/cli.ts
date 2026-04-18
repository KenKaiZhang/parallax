import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import { useGroups } from '../state/groups';
import {
  allLeafIds,
  closeLeaf,
  firstLeafId,
  newLeaf,
  splitLeaf,
} from '../state/layout';
import { killLeafPty, writePty } from './pty';
import { ptyIdForLeaf } from './paneRegistry';

type CliArgs = {
  text?: string;
  name?: string;
  id?: string;
  dir?: 'h' | 'v';
  direction?: 'next' | 'prev';
  enter?: boolean;
};

type CliMessage = {
  cmd: string;
  group: string;
  pane: string;
  args: CliArgs;
};

export async function startCliListener(): Promise<UnlistenFn> {
  return listen<CliMessage>('parallax://cli', (event) => {
    const { cmd, group, args } = event.payload;
    const store = useGroups.getState();
    const target = store.groups.find((g) => g.id === group);

    // Notes / group commands need the calling group context.
    if (target) {
      switch (cmd) {
        case 'notes.append':
          if (typeof args?.text === 'string') store.appendNotes(target.id, args.text);
          return;
        case 'notes.set':
          if (typeof args?.text === 'string') store.updateNotes(target.id, args.text);
          return;
        case 'group.rename':
          if (typeof args?.name === 'string') store.renameGroup(target.id, args.name);
          return;
        case 'group.new':
          if (typeof args?.name === 'string') store.addGroup(args.name, { activate: false });
          return;
        case 'pane.split': {
          const dir = args?.dir === 'h' ? 'row' : args?.dir === 'v' ? 'column' : null;
          if (!dir) return;
          const focused = store.focusedPaneByGroup[target.id] ?? firstLeafId(target.layout);
          const { root, newLeafId } = splitLeaf(target.layout, focused, dir, target.cwd);
          useGroups.setState((s) => ({
            groups: s.groups.map((g) => (g.id === target.id ? { ...g, layout: root } : g)),
            focusedPaneByGroup: {
              ...s.focusedPaneByGroup,
              [target.id]: newLeafId,
            },
          }));
          return;
        }
        case 'pane.focus': {
          const leaves = allLeafIds(target.layout);
          if (leaves.length === 0) return;
          const current = store.focusedPaneByGroup[target.id] ?? leaves[0];
          const idx = leaves.indexOf(current);
          let next = idx;
          if (args?.direction === 'next') next = (idx + 1) % leaves.length;
          else if (args?.direction === 'prev') next = (idx - 1 + leaves.length) % leaves.length;
          else return;
          store.setFocus(target.id, leaves[next]);
          return;
        }
        case 'pane.close': {
          const focused = store.focusedPaneByGroup[target.id] ?? firstLeafId(target.layout);
          void killLeafPty(focused);
          const { root, focusFallback } = closeLeaf(target.layout, focused);
          if (!root) {
            const fresh = newLeaf(target.cwd);
            useGroups.setState((s) => ({
              groups: s.groups.map((g) => (g.id === target.id ? { ...g, layout: fresh } : g)),
              focusedPaneByGroup: { ...s.focusedPaneByGroup, [target.id]: fresh.id },
            }));
            return;
          }
          useGroups.setState((s) => ({
            groups: s.groups.map((g) => (g.id === target.id ? { ...g, layout: root } : g)),
            focusedPaneByGroup: {
              ...s.focusedPaneByGroup,
              [target.id]: focusFallback ?? firstLeafId(root),
            },
          }));
          return;
        }
        case 'pane.send': {
          if (typeof args?.text !== 'string') return;
          const focused = store.focusedPaneByGroup[target.id];
          if (!focused) return;
          const ptyId = ptyIdForLeaf(focused);
          if (!ptyId) return;
          const payload = args.enter ? args.text + '\r' : args.text;
          void writePty(ptyId, payload);
          return;
        }
      }
    }

    // group.activate doesn't depend on the calling group; CLI resolves the ref to an ID.
    if (cmd === 'group.activate' && typeof args?.id === 'string') {
      if (store.groups.some((g) => g.id === args.id)) {
        store.setActiveGroup(args.id);
      }
    }
  });
}
