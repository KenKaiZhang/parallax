import { useGroups } from '../state/groups';

export function NotesEditor() {
  const activeId = useGroups((s) => s.activeGroupId);
  const group = useGroups((s) => s.groups.find((g) => g.id === activeId) ?? null);
  const updateNotes = useGroups((s) => s.updateNotes);

  return (
    <div className="notes-editor">
      <div className="sidebar-section-header">
        <span>notes</span>
      </div>
      {group ? (
        <textarea
          key={group.id}
          className="notes-textarea"
          value={group.notes}
          placeholder="What's the context for this group?"
          onChange={(e) => updateNotes(group.id, e.target.value)}
          spellCheck={false}
        />
      ) : (
        <div className="empty-hint">No group selected.</div>
      )}
    </div>
  );
}
