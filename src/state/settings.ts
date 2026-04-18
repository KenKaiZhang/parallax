import { create } from 'zustand';

import { DEFAULT_THEME_ID } from '../themes';

export const FONT_SIZE_MIN = 9;
export const FONT_SIZE_MAX = 28;
export const FONT_SIZE_DEFAULT = 13;

export const DEFAULT_FONT_FAMILY =
  '"JetBrains Mono", "SF Mono", Menlo, Monaco, "Courier New", monospace';

export type Settings = {
  fontFamily: string;
  fontSize: number;
  themeId: string;
};

type SettingsStore = Settings & {
  setFontFamily: (family: string) => void;
  setFontSize: (size: number) => void;
  setThemeId: (id: string) => void;
  hydrate: (s: Partial<Settings> | undefined) => void;
};

function clampSize(size: number | undefined): number {
  if (typeof size !== 'number' || Number.isNaN(size)) return FONT_SIZE_DEFAULT;
  return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, Math.round(size)));
}

export const useSettings = create<SettingsStore>((set) => ({
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: FONT_SIZE_DEFAULT,
  themeId: DEFAULT_THEME_ID,

  setFontFamily: (family) => {
    const trimmed = family.trim();
    set({ fontFamily: trimmed.length > 0 ? trimmed : DEFAULT_FONT_FAMILY });
  },
  setFontSize: (size) => set({ fontSize: clampSize(size) }),
  setThemeId: (id) => set({ themeId: id }),
  hydrate: (s) => {
    if (!s) return;
    set({
      fontFamily:
        typeof s.fontFamily === 'string' && s.fontFamily.trim().length > 0
          ? s.fontFamily
          : DEFAULT_FONT_FAMILY,
      fontSize: clampSize(s.fontSize),
      themeId: typeof s.themeId === 'string' ? s.themeId : DEFAULT_THEME_ID,
    });
  },
}));

export function snapshotSettings(): Settings {
  const { fontFamily, fontSize, themeId } = useSettings.getState();
  return { fontFamily, fontSize, themeId };
}
