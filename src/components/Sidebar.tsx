import { useRef } from 'react';

import {
  useGroups,
  SIDEBAR_MIN,
  SIDEBAR_MAX,
} from '../state/groups';
import { GroupList } from './GroupList';
import { NotesEditor } from './NotesEditor';

export function Sidebar() {
  const width = useGroups((s) => s.sidebarWidth);
  const hidden = useGroups((s) => s.sidebarHidden);
  const notesRatio = useGroups((s) => s.notesRatio);
  const setSidebarWidth = useGroups((s) => s.setSidebarWidth);
  const setNotesRatio = useGroups((s) => s.setNotesRatio);

  const sidebarRef = useRef<HTMLElement>(null);

  if (hidden) return null;

  const startResizeWidth = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const onMove = (ev: MouseEvent) => {
      const next = startWidth + (ev.clientX - startX);
      setSidebarWidth(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, next)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startResizeNotes = (e: React.MouseEvent) => {
    e.preventDefault();
    const sidebarRect = sidebarRef.current?.getBoundingClientRect();
    if (!sidebarRect) return;
    const sidebarTop = sidebarRect.top;
    const sidebarHeight = sidebarRect.height;

    const onMove = (ev: MouseEvent) => {
      // Notes occupies space from divider to bottom of sidebar.
      const notesHeight = sidebarRect.bottom - ev.clientY;
      const ratio = notesHeight / sidebarHeight;
      setNotesRatio(ratio);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    void sidebarTop; // keep for clarity; computed bottom below
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // flex-grow values that share the available space proportionally.
  const groupsGrow = Math.max(1, Math.round((1 - notesRatio) * 1000));
  const notesGrow = Math.max(1, Math.round(notesRatio * 1000));

  return (
    <aside ref={sidebarRef} className="sidebar" style={{ flexBasis: width, width }}>
      <div
        className="sidebar-section sidebar-section-groups"
        style={{ flexGrow: groupsGrow }}
      >
        <GroupList />
      </div>
      <div
        className="sidebar-resize-h"
        onMouseDown={startResizeNotes}
        title="Drag to resize"
      />
      <div
        className="sidebar-section sidebar-section-notes"
        style={{ flexGrow: notesGrow }}
      >
        <NotesEditor />
      </div>
      <div
        className="sidebar-resize-handle"
        onMouseDown={startResizeWidth}
        title="Drag to resize"
      />
    </aside>
  );
}
