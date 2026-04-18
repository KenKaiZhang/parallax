import { useState } from 'react';

import { useGroups } from '../state/groups';
import { useConfirm } from '../state/confirm';
import { allLeafIds } from '../state/layout';
import { PencilIcon, TrashIcon } from './icons';

export function GroupList() {
  const groups = useGroups((s) => s.groups);
  const activeId = useGroups((s) => s.activeGroupId);
  const setActive = useGroups((s) => s.setActiveGroup);
  const addGroup = useGroups((s) => s.addGroup);
  const renameGroup = useGroups((s) => s.renameGroup);
  const deleteGroup = useGroups((s) => s.deleteGroup);
  const reorder = useGroups((s) => s.reorderGroups);
  const askConfirm = useConfirm((s) => s.ask);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [drag, setDrag] = useState<{
    sourceId: string;
    targetId: string | null;
    pos: 'above' | 'below';
  } | null>(null);

  const submitRename = () => {
    if (renamingId) renameGroup(renamingId, draftName);
    setRenamingId(null);
  };

  const startRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setDraftName(currentName);
  };

  const handleDelete = (id: string, name: string) => {
    const group = groups.find((g) => g.id === id);
    const paneCount = group ? allLeafIds(group.layout).length : 0;
    const paneNoun = paneCount === 1 ? 'pane' : 'panes';
    askConfirm({
      title: `Delete "${name}"?`,
      message:
        paneCount > 0
          ? `This group has ${paneCount} active ${paneNoun}. Deleting it will close them and end any running processes.`
          : 'This group will be removed.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => deleteGroup(id),
    });
  };

  const startDrag = (sourceId: string) => (e: React.PointerEvent<HTMLLIElement>) => {
    if (e.button !== 0 || renamingId === sourceId) return;
    if ((e.target as HTMLElement).closest('button, input')) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let dragStarted = false;

    const updateHover = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const li = (el as Element | null)?.closest('li[data-group-id]') as HTMLElement | null;
      if (!li) {
        setDrag((d) => (d ? { ...d, targetId: null } : d));
        return;
      }
      const targetId = li.dataset.groupId!;
      const rect = li.getBoundingClientRect();
      const pos: 'above' | 'below' =
        ev.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
      setDrag({ sourceId, targetId, pos });
    };

    const onMove = (ev: PointerEvent) => {
      if (!dragStarted) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (dx * dx + dy * dy < 16) return;
        dragStarted = true;
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        setDrag({ sourceId, targetId: null, pos: 'above' });
      }
      updateHover(ev);
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      if (!dragStarted) return;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setDrag((curr) => {
        if (curr && curr.targetId && curr.targetId !== curr.sourceId) {
          const ordered = groups.map((x) => x.id).filter((id) => id !== curr.sourceId);
          const targetIdx = ordered.indexOf(curr.targetId);
          const insertIdx = curr.pos === 'above' ? targetIdx : targetIdx + 1;
          ordered.splice(insertIdx, 0, curr.sourceId);
          reorder(ordered);
        }
        return null;
      });
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  return (
    <div className="group-list">
      <div className="sidebar-section-header">
        <span>groups</span>
        <button
          className="icon-btn"
          onClick={() => {
            const id = addGroup();
            requestAnimationFrame(() => startRename(id, 'untitled'));
          }}
          title="New group (⌘T)"
          aria-label="New group"
        >
          +
        </button>
      </div>
      <ul className="group-items">
        {groups.map((g) => {
          const isActive = g.id === activeId;
          const isRenaming = renamingId === g.id;
          const isDropTarget =
            drag !== null && drag.targetId === g.id && drag.sourceId !== g.id;
          return (
            <li
              key={g.id}
              data-group-id={g.id}
              className={[
                'group-item',
                isActive && 'group-item-active',
                isDropTarget && drag?.pos === 'above' && 'drop-above',
                isDropTarget && drag?.pos === 'below' && 'drop-below',
              ]
                .filter(Boolean)
                .join(' ')}
              title={isRenaming ? undefined : 'Double-click to rename'}
              onClick={() => setActive(g.id)}
              onDoubleClick={() => startRename(g.id, g.name)}
              onContextMenu={(e) => {
                e.preventDefault();
                handleDelete(g.id, g.name);
              }}
              onPointerDown={startDrag(g.id)}
            >
              {isRenaming ? (
                <input
                  className="group-name-input"
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={submitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className="group-name">{g.name}</span>
                  <button
                    className="group-item-action"
                    title="Rename"
                    aria-label="Rename group"
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(g.id, g.name);
                    }}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    className="group-item-action group-item-action-danger"
                    title="Delete"
                    aria-label="Delete group"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(g.id, g.name);
                    }}
                  >
                    <TrashIcon />
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {groups.length === 0 && (
        <div className="empty-hint">No groups yet. Click + to add one.</div>
      )}
    </div>
  );
}
