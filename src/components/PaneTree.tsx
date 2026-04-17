import { useRef } from 'react';

import { useGroups } from '../state/groups';
import type { PaneNode, SplitNode } from '../types';
import { Terminal } from './Terminal';

type Props = {
  groupId: string;
  node: PaneNode;
  focusedLeafId: string | null;
};

export function PaneTree({ groupId, node, focusedLeafId }: Props) {
  const setFocus = useGroups((s) => s.setFocus);

  if (node.kind === 'leaf') {
    return (
      <Terminal
        leafId={node.id}
        cwd={node.cwd}
        focused={focusedLeafId === node.id}
        onFocus={() => setFocus(groupId, node.id)}
      />
    );
  }
  return <Splitter groupId={groupId} node={node} focusedLeafId={focusedLeafId} />;
}

type SplitterProps = {
  groupId: string;
  node: SplitNode;
  focusedLeafId: string | null;
};

function Splitter({ groupId, node, focusedLeafId }: SplitterProps) {
  const setRatio = useGroups((s) => s.setSplitRatio);
  const containerRef = useRef<HTMLDivElement>(null);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const isRow = node.dir === 'row';

    const onMove = (ev: MouseEvent) => {
      const total = isRow ? rect.width : rect.height;
      if (total <= 0) return;
      const offset = isRow ? ev.clientX - rect.left : ev.clientY - rect.top;
      setRatio(groupId, node.id, offset / total);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = isRow ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const aPct = `${(node.ratio * 100).toFixed(3)}%`;
  const bPct = `${((1 - node.ratio) * 100).toFixed(3)}%`;

  return (
    <div ref={containerRef} className={`split split-${node.dir}`}>
      <div className="split-child" style={{ flexBasis: aPct }}>
        <PaneTree groupId={groupId} node={node.a} focusedLeafId={focusedLeafId} />
      </div>
      <div
        className={`split-divider divider-${node.dir}`}
        onMouseDown={startDrag}
      />
      <div className="split-child" style={{ flexBasis: bPct }}>
        <PaneTree groupId={groupId} node={node.b} focusedLeafId={focusedLeafId} />
      </div>
    </div>
  );
}
