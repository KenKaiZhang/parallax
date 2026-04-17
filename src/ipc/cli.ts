import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import { useGroups } from '../state/groups';

type CliMessage = {
  cmd: string;
  group: string;
  pane: string;
  args: { text?: string; name?: string };
};

export async function startCliListener(): Promise<UnlistenFn> {
  return listen<CliMessage>('parallax://cli', (event) => {
    const { cmd, group, args } = event.payload;
    const store = useGroups.getState();
    const target = store.groups.find((g) => g.id === group);
    if (!target) return;

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
    }
  });
}
