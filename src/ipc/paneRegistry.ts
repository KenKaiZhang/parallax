// Module-level map of mounted pane wrappers. Lets non-React listeners
// (file-drop, future global hit-tests) resolve a screen point → leaf/pty.
const leafToPty = new Map<string, string>();

export function registerPane(leafId: string, ptyId: string): void {
  leafToPty.set(leafId, ptyId);
}

export function unregisterPane(leafId: string): void {
  leafToPty.delete(leafId);
}

export function ptyIdForLeaf(leafId: string): string | undefined {
  return leafToPty.get(leafId);
}

export function findLeafAtPoint(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const pane = (el as Element).closest('[data-leaf-id]') as HTMLElement | null;
  return pane?.dataset.leafId ?? null;
}
