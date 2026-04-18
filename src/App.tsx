import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { Sidebar } from './components/Sidebar';
import { PaneTree } from './components/PaneTree';
import { ConfirmDialog } from './components/ConfirmDialog';
import { useGroups, startPersistence, flushPersistence } from './state/groups';
import { useConfirm } from './state/confirm';
import { startCliListener } from './ipc/cli';
import { startDragDropListener } from './ipc/dragDrop';
import { hasForegroundProcess } from './ipc/pty';
import { firstLeafId } from './state/layout';

import './App.css';

function App() {
  const loaded = useGroups((s) => s.loaded);
  const loadFromDisk = useGroups((s) => s.loadFromDisk);
  const groups = useGroups((s) => s.groups);
  const activeGroupId = useGroups((s) => s.activeGroupId);
  const focusedPaneByGroup = useGroups((s) => s.focusedPaneByGroup);
  const sidebarHidden = useGroups((s) => s.sidebarHidden);
  const splitFocused = useGroups((s) => s.splitFocused);
  const closeFocused = useGroups((s) => s.closeFocused);
  const addGroup = useGroups((s) => s.addGroup);
  const cycleGroup = useGroups((s) => s.cycleGroup);
  const cyclePane = useGroups((s) => s.cyclePane);
  const toggleSidebar = useGroups((s) => s.toggleSidebar);

  useEffect(() => {
    void loadFromDisk().then(() => startPersistence());
  }, [loadFromDisk]);

  useEffect(() => {
    let unlistenPromise: Promise<() => void> | null = null;
    try {
      unlistenPromise = startCliListener();
    } catch {
      // not in Tauri (plain vite preview); ignore
    }
    return () => {
      void unlistenPromise?.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    let unlistenPromise: Promise<() => void> | null = null;
    try {
      unlistenPromise = startDragDropListener();
    } catch {
      // not in Tauri; ignore
    }
    return () => {
      void unlistenPromise?.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    let unlistenPromise: Promise<() => void> | null = null;
    try {
      unlistenPromise = getCurrentWindow().onCloseRequested(async () => {
        await flushPersistence();
      });
    } catch {
      // not running in Tauri (e.g. plain vite dev) — ignore
    }
    return () => {
      void unlistenPromise?.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const requestClose = async () => {
      const { activeGroupId, focusedPaneByGroup, groups } = useGroups.getState();
      if (!activeGroupId) return;
      const group = groups.find((g) => g.id === activeGroupId);
      if (!group) return;
      const leafId = focusedPaneByGroup[activeGroupId] ?? firstLeafId(group.layout);
      const busy = await hasForegroundProcess(leafId);
      if (!busy) {
        closeFocused();
        return;
      }
      useConfirm.getState().ask({
        title: 'Close pane?',
        message: 'A process is still running in this pane. Closing will terminate it.',
        confirmLabel: 'Close',
        destructive: true,
        onConfirm: () => closeFocused(),
      });
    };

    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey) return;
      switch (e.key) {
        case 'd':
        case 'D':
          e.preventDefault();
          splitFocused(e.shiftKey ? 'column' : 'row');
          return;
        case 'w':
        case 'W':
          e.preventDefault();
          void requestClose();
          return;
        case 't':
        case 'T':
          e.preventDefault();
          addGroup();
          return;
        case 'b':
        case 'B':
          e.preventDefault();
          toggleSidebar();
          return;
        case '[':
        case '{':
          e.preventDefault();
          if (e.shiftKey) cyclePane(-1);
          else cycleGroup(-1);
          return;
        case ']':
        case '}':
          e.preventDefault();
          if (e.shiftKey) cyclePane(1);
          else cycleGroup(1);
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [splitFocused, closeFocused, addGroup, cycleGroup, cyclePane, toggleSidebar]);

  if (!loaded) {
    return <div className="loading">loading…</div>;
  }

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;

  return (
    <div className="app">
      <Sidebar />
      <main className="workspace">
        <header className="workspace-header">
          <div className="workspace-header-left">
            <button
              className="icon-btn workspace-toggle"
              onClick={toggleSidebar}
              title={sidebarHidden ? 'Show sidebar (⌘B)' : 'Hide sidebar (⌘B)'}
              aria-label="Toggle sidebar"
            >
              {sidebarHidden ? '›' : '‹'}
            </button>
            <span className="workspace-title">{activeGroup?.name ?? '—'}</span>
          </div>
          <span className="workspace-hint">
            ⌘D split · ⇧⌘D split↓ · ⌘W close · ⌘T new · ⌘[ ⌘] groups · ⌘B sidebar
          </span>
        </header>
        <div className="workspace-panes">
          {activeGroup && (
            <PaneTree
              groupId={activeGroup.id}
              node={activeGroup.layout}
              focusedLeafId={focusedPaneByGroup[activeGroup.id] ?? null}
            />
          )}
        </div>
      </main>
      <ConfirmDialog />
    </div>
  );
}

export default App;
