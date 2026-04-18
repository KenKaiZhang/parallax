import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

import { attachPty, resizePty, writePty } from '../ipc/pty';
import { registerPane, unregisterPane } from '../ipc/paneRegistry';
import { useGroups } from '../state/groups';
import { useSettings } from '../state/settings';
import { findTheme } from '../themes';
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

const APP_SHORTCUT_KEYS = new Set([
  'd', 'D', 'w', 'W', 't', 'T', 'b', 'B', '[', ']', '{', '}', ',',
]);

export function Terminal({ leafId, groupId, cwd, focused, onFocus }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const swapPanes = useGroups((s) => s.swapPanes);
  const fontFamily = useSettings((s) => s.fontFamily);
  const fontSize = useSettings((s) => s.fontSize);
  const themeId = useSettings((s) => s.themeId);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initial = useSettings.getState();
    const initialTheme = findTheme(initial.themeId);
    const term = new XTerm({
      fontFamily: initial.fontFamily,
      fontSize: initial.fontSize,
      lineHeight: 1.2,
      cursorBlink: true,
      allowProposedApi: true,
      theme: initialTheme.terminal,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    fitAddonRef.current = fitAddon;

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

    // Coalesce ResizeObserver bursts to one fit per frame. Without this, a single
    // split fires the observer 2-4 times → multiple SIGWINCHes → shells (zsh +
    // Starship etc.) re-emit the prompt for each, leaving stacked dotted lines.
    let pendingFit = 0;
    const scheduleFit = () => {
      if (pendingFit) return;
      pendingFit = requestAnimationFrame(() => {
        pendingFit = 0;
        safeFit();
      });
    };

    let cancelled = false;
    requestAnimationFrame(safeFit);
    // Webfonts (JetBrains Mono) load asynchronously. xterm caches glyph metrics
    // from whatever font was available at first measure — without this re-fit,
    // the terminal stays sized for the fallback font even after the woff2 lands.
    void document.fonts.ready.then(() => {
      if (!cancelled) safeFit();
    });
    let ptyId: string | null = null;
    let detach: (() => void) | null = null;
    const inputDisp = term.onData((data) => {
      if (ptyId) void writePty(ptyId, data);
    });
    // Debounce SIGWINCH separately from the visual fit. xterm reflows immediately
    // (so the user sees a responsive resize), but the shell only gets one SIGWINCH
    // per logical resize event — preventing the prompt from being re-emitted
    // multiple times for splits or rapid drags.
    let pendingResize: number | null = null;
    let lastDims: { cols: number; rows: number } | null = null;
    const resizeDisp = term.onResize(({ cols, rows }) => {
      lastDims = { cols, rows };
      if (pendingResize !== null) clearTimeout(pendingResize);
      pendingResize = window.setTimeout(() => {
        pendingResize = null;
        if (ptyId && lastDims) void resizePty(ptyId, lastDims.cols, lastDims.rows);
      }, 60);
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

    const observer = new ResizeObserver(scheduleFit);
    observer.observe(container);

    return () => {
      cancelled = true;
      if (pendingFit) cancelAnimationFrame(pendingFit);
      if (pendingResize !== null) clearTimeout(pendingResize);
      observer.disconnect();
      inputDisp.dispose();
      resizeDisp.dispose();
      detach?.();
      unregisterPane(leafId);
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [leafId, cwd, groupId]);

  // Apply font/theme changes live without tearing down the pty connection.
  useEffect(() => {
    const term = termRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term) return;
    term.options.fontFamily = fontFamily;
    term.options.fontSize = fontSize;
    term.options.theme = findTheme(themeId).terminal;
    // Wait for any new webfont referenced in fontFamily to actually load
    // before re-measuring cell dimensions; then force a renderer repaint so
    // the glyph atlas is rebuilt with the new font.
    void document.fonts.ready.then(() => {
      try {
        fitAddon?.fit();
        term.refresh(0, term.rows - 1);
      } catch {
        // term may have been disposed
      }
    });
  }, [fontFamily, fontSize, themeId]);

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
