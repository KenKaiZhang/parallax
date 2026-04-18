import { useEffect } from 'react';

import {
  DEFAULT_FONT_FAMILY,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  useSettings,
} from '../state/settings';
import { THEMES } from '../themes';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SettingsModal({ open, onClose }: Props) {
  const fontFamily = useSettings((s) => s.fontFamily);
  const fontSize = useSettings((s) => s.fontSize);
  const themeId = useSettings((s) => s.themeId);
  const setFontFamily = useSettings((s) => s.setFontFamily);
  const setFontSize = useSettings((s) => s.setFontSize);
  const setThemeId = useSettings((s) => s.setThemeId);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card settings-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Settings</h2>

        <section className="settings-section">
          <h3 className="settings-section-title">Theme</h3>
          <div className="theme-grid">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`theme-swatch ${themeId === t.id ? 'theme-swatch-active' : ''}`}
                onClick={() => setThemeId(t.id)}
                title={t.name}
              >
                <div className="theme-swatch-preview">
                  <span style={{ background: t.ui.bg1 }} />
                  <span style={{ background: t.ui.bg3 }} />
                  <span style={{ background: t.ui.accent }} />
                  <span style={{ background: t.terminal.green }} />
                  <span style={{ background: t.terminal.yellow }} />
                  <span style={{ background: t.terminal.red }} />
                </div>
                <span className="theme-swatch-name">{t.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h3 className="settings-section-title">Terminal font</h3>
          <label className="settings-row">
            <span className="settings-label">Family</span>
            <input
              className="settings-input"
              type="text"
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              spellCheck={false}
              placeholder={DEFAULT_FONT_FAMILY}
            />
          </label>
          <label className="settings-row">
            <span className="settings-label">Size</span>
            <input
              className="settings-input settings-input-narrow"
              type="number"
              min={FONT_SIZE_MIN}
              max={FONT_SIZE_MAX}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            className="settings-reset"
            onClick={() => setFontFamily(DEFAULT_FONT_FAMILY)}
          >
            Reset font to default
          </button>
        </section>

        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
