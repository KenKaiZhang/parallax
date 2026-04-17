import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { Sidebar } from './components/Sidebar';
import { PaneTree } from './components/PaneTree';
import { ConfirmDialog } from './components/ConfirmDialog';
import { useGroups, startPersistence, flushPersistence } from './state/groups';

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
          closeFocused();
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
