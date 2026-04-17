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
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

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
          const isDropTarget = dropTargetId === g.id && dragId !== g.id;
          return (
            <li
              key={g.id}
              className={[
                'group-item',
                isActive && 'group-item-active',
                isDropTarget && 'group-item-drop-target',
              ]
                .filter(Boolean)
                .join(' ')}
              draggable={!isRenaming}
              title={isRenaming ? undefined : 'Double-click to rename'}
              onClick={() => setActive(g.id)}
              onDoubleClick={() => startRename(g.id, g.name)}
              onContextMenu={(e) => {
                e.preventDefault();
                handleDelete(g.id, g.name);
              }}
              onDragStart={(e) => {
                setDragId(g.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragId && dragId !== g.id) setDropTargetId(g.id);
              }}
              onDragLeave={() => {
                if (dropTargetId === g.id) setDropTargetId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!dragId || dragId === g.id) return;
                const remaining = groups.map((x) => x.id).filter((id) => id !== dragId);
                const targetIdx = remaining.indexOf(g.id);
                remaining.splice(targetIdx, 0, dragId);
                reorder(remaining);
                setDragId(null);
                setDropTargetId(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setDropTargetId(null);
              }}
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
