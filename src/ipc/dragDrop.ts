import { getCurrentWindow } from '@tauri-apps/api/window';
import type { UnlistenFn } from '@tauri-apps/api/event';

import { writePty } from './pty';
import { findLeafAtPoint, ptyIdForLeaf } from './paneRegistry';
import { useGroups } from '../state/groups';

const DROP_TARGET_CLASS = 'pane-drop-target';

function setHover(leafId: string | null): void {
  document.querySelectorAll(`.${DROP_TARGET_CLASS}`).forEach((el) => {
    if (!leafId || (el as HTMLElement).dataset.leafId !== leafId) {
      el.classList.remove(DROP_TARGET_CLASS);
    }
  });
  if (!leafId) return;
  const el = document.querySelector(`[data-leaf-id="${leafId}"]`);
  el?.classList.add(DROP_TARGET_CLASS);
}

function focusedPtyId(): string | null {
  const { activeGroupId, focusedPaneByGroup } = useGroups.getState();
  if (!activeGroupId) return null;
  const leafId = focusedPaneByGroup[activeGroupId];
  if (!leafId) return null;
  return ptyIdForLeaf(leafId) ?? null;
}

// Try CSS-pixel coords first, then physical-pixel coords as a fallback.
// On macOS WKWebView, position from Tauri 2 has historically come through in
// CSS pixels, but the docs aren't explicit and the implementation may vary by
// version. Trying both makes the hit-test robust.
function leafFromPosition(x: number, y: number): string | null {
  const direct = findLeafAtPoint(x, y);
  if (direct) return direct;
  const dpr = window.devicePixelRatio || 1;
  if (dpr === 1) return null;
  return findLeafAtPoint(x / dpr, y / dpr);
}

export async function startDragDropListener(): Promise<UnlistenFn> {
  // Tauri 2 dispatches drag-drop on the *window* channel for single-webview
  // setups (WebviewKind::WindowContent). Listening on the webview channel
  // silently never fires for our app shape. See tauri-runtime-wry lib.rs:4695.
  return getCurrentWindow().onDragDropEvent((event) => {
    const payload = event.payload;
    if (payload.type === 'leave') {
      setHover(null);
      return;
    }
    const leafId = leafFromPosition(payload.position.x, payload.position.y);

    if (payload.type === 'enter' || payload.type === 'over') {
      setHover(leafId);
      return;
    }

    // type === 'drop'
    setHover(null);
    if (payload.paths.length === 0) return;
    // Hit-test can be inaccurate when devtools is open (Tauri known limitation).
    // Fall back to the focused pane so drops never silently disappear.
    const ptyId = (leafId && ptyIdForLeaf(leafId)) ?? focusedPtyId();
    if (!ptyId) return;
    // Unquoted, no trailing space — lets Claude Code's input parser detect
    // image paths and render the [Image N] chip. Trade-off: paths with spaces
    // aren't shell-safe; the user can quote manually before pressing Enter.
    void writePty(ptyId, payload.paths.join(' '));
  });
}
