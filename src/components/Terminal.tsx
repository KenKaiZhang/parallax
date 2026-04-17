import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

import { attachPty, resizePty, writePty } from '../ipc/pty';

import '@xterm/xterm/css/xterm.css';

type Props = {
  leafId: string;
  cwd?: string;
  focused: boolean;
  onFocus: () => void;
};

const APP_SHORTCUT_KEYS = new Set(['d', 'D', 'w', 'W', 't', 'T', '[', ']', '{', '}']);

export function Terminal({ leafId, cwd, focused, onFocus }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);

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

    void attachPty(leafId, { cwd, onData }).then((handle) => {
      if (cancelled) {
        handle.detach();
        return;
      }
      ptyId = handle.ptyId;
      detach = handle.detach;
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
      term.dispose();
      termRef.current = null;
    };
  }, [leafId, cwd]);

  useEffect(() => {
    if (focused) {
      requestAnimationFrame(() => termRef.current?.focus());
    }
  }, [focused]);

  return (
    <div
      ref={wrapperRef}
      className={`pane ${focused ? 'pane-focused' : ''}`}
      onPointerDown={onFocus}
    >
      <div ref={containerRef} className="pane-terminal" />
    </div>
  );
}
