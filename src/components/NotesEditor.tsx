import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useGroups } from '../state/groups';

export function NotesEditor() {
  const activeId = useGroups((s) => s.activeGroupId);
  const group = useGroups((s) => s.groups.find((g) => g.id === activeId) ?? null);
  const updateNotes = useGroups((s) => s.updateNotes);

  const [editing, setEditing] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) taRef.current?.focus();
  }, [editing]);

  // Reset editing state when switching groups so each group opens in render mode.
  useEffect(() => {
    setEditing(false);
  }, [group?.id]);

  return (
    <div className="notes-editor">
      <div className="sidebar-section-header">
        <span>notes</span>
      </div>
      {!group ? (
        <div className="empty-hint">No group selected.</div>
      ) : editing ? (
        <textarea
          ref={taRef}
          key={group.id}
          className="notes-textarea"
          value={group.notes}
          placeholder="What's the context for this group? (markdown supported)"
          onChange={(e) => updateNotes(group.id, e.target.value)}
          onBlur={() => setEditing(false)}
          spellCheck={false}
        />
      ) : (
        <div
          className="notes-rendered"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setEditing(true);
            }
          }}
        >
          {group.notes.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{group.notes}</ReactMarkdown>
          ) : (
            <span className="notes-placeholder">
              What's the context for this group? (markdown supported)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
