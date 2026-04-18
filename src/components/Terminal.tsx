import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

import { attachPty, resizePty, writePty } from '../ipc/pty';
import { registerPane, unregisterPane } from '../ipc/paneRegistry';
import { useGroups } from '../state/groups';
import { GripIcon } from './icons';

import '@xterm/xterm/css/xterm.css';

const DROP_TARGET_CLASS = 'pane-drop-target';

function findLeafAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  return (el as Element | null)?.closest('[data-leaf-id]')?.getAttribute('data-leaf-id') ?? null;
}

type Props = {
  leafId: string;
  groupId: string;
  cwd?: string;
  focused: boolean;
  onFocus: () => void;
};

const APP_SHORTCUT_KEYS = new Set(['d', 'D', 'w', 'W', 't', 'T', '[', ']', '{', '}']);

export function Terminal({ leafId, groupId, cwd, focused, onFocus }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const swapPanes = useGroups((s) => s.swapPanes);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new XTerm({
      fontFamily: '"SF Mono", Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      allowProposedApi: true,
      theme: {
        background: '#0f1115',
        foreground: '#e4e4e7',
        cursor: '#e4e4e7',
        cursorAccent: '#0f1115',
        selectionBackground: '#374151',
        black: '#15171b',
        brightBlack: '#52525b',
        red: '#f87171',
        brightRed: '#fca5a5',
        green: '#4ade80',
        brightGreen: '#86efac',
        yellow: '#facc15',
        brightYellow: '#fde047',
        blue: '#60a5fa',
        brightBlue: '#93c5fd',
        magenta: '#c084fc',
        brightMagenta: '#d8b4fe',
        cyan: '#22d3ee',
        brightCyan: '#67e8f9',
        white: '#e4e4e7',
        brightWhite: '#fafafa',
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    // Prevent xterm from swallowing our app-level Cmd shortcuts.
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true;
      if (event.metaKey && APP_SHORTCUT_KEYS.has(event.key)) return false;
      // Shift+Enter → send "\" + CR. Claude Code's input parser treats
      // backslash-then-Enter as "newline in input buffer" universally (no
      // terminal config required). The brief backslash echo is replaced by
      // the newline once Claude processes it.
      if (event.shiftKey && event.key === 'Enter') {
        if (ptyId) void writePty(ptyId, '\\\r');
        return false;
      }
      return true;
    });

    term.open(container);
    termRef.current = term;

    const safeFit = () => {
      try {
        fitAddon.fit();
      } catch {
        // container may be 0×0 momentarily; retry next frame
      }
    };

    requestAnimationFrame(safeFit);

    let cancelled = false;
    let ptyId: string | null = null;
    let detach: (() => void) | null = null;
    const inputDisp = term.onData((data) => {
      if (ptyId) void writePty(ptyId, data);
    });
    const resizeDisp = term.onResize(({ cols, rows }) => {
      if (ptyId) void resizePty(ptyId, cols, rows);
    });

    const onData = (chunk: string) => {
      if (cancelled) return;
      try {
        const bytes = new Uint8Array(chunk.length);
        for (let i = 0; i < chunk.length; i++) bytes[i] = chunk.charCodeAt(i);
        term.write(bytes);
      } catch {
        // term may have been disposed in a race with an in-flight chunk
      }
    };

    void attachPty(leafId, { cwd, groupId, onData }).then((handle) => {
      if (cancelled) {
        handle.detach();
        return;
      }
      ptyId = handle.ptyId;
      detach = handle.detach;
      registerPane(leafId, handle.ptyId);
      // Sync initial size after attach so the shell knows the real dims.
      void resizePty(handle.ptyId, term.cols, term.rows);
    });

    const observer = new ResizeObserver(() => safeFit());
    observer.observe(container);

    return () => {
      cancelled = true;
      observer.disconnect();
      inputDisp.dispose();
      resizeDisp.dispose();
      detach?.();
      unregisterPane(leafId);
      term.dispose();
      termRef.current = null;
    };
  }, [leafId, cwd, groupId]);

  useEffect(() => {
    if (focused) {
      requestAnimationFrame(() => termRef.current?.focus());
    }
  }, [focused]);

  return (
    <div
      ref={wrapperRef}
      className={`pane ${focused ? 'pane-focused' : ''}`}
      data-leaf-id={leafId}
      onPointerDown={onFocus}
    >
      <div
        className="pane-header"
        title="Drag to swap with another pane"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();

          const sourceId = leafId;
          let lastHover: string | null = null;

          const setHover = (id: string | null) => {
            if (id === lastHover) return;
            if (lastHover) {
              document
                .querySelector(`[data-leaf-id="${lastHover}"]`)
                ?.classList.remove(DROP_TARGET_CLASS);
            }
            if (id && id !== sourceId) {
              document
                .querySelector(`[data-leaf-id="${id}"]`)
                ?.classList.add(DROP_TARGET_CLASS);
            }
            lastHover = id;
          };

          const onMove = (ev: PointerEvent) => {
            setHover(findLeafAt(ev.clientX, ev.clientY));
          };
          const onUp = (ev: PointerEvent) => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            const target = findLeafAt(ev.clientX, ev.clientY);
            setHover(null);
            if (target && target !== sourceId) {
              swapPanes(groupId, sourceId, target);
            }
          };

          document.body.style.cursor = 'grabbing';
          document.body.style.userSelect = 'none';
          document.addEventListener('pointermove', onMove);
          document.addEventListener('pointerup', onUp);
        }}
      >
        <GripIcon />
      </div>
      <div ref={containerRef} className="pane-terminal" />
    </div>
  );
}
