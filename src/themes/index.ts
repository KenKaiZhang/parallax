// Theme schema. Each theme defines the full UI token set (mapped to CSS custom
// properties on :root) and the full xterm.js terminal palette. The two are
// derived from the same color scheme so the chrome and the terminal stay
// visually coherent.

export type UiTokens = {
  bg0: string;
  bg1: string;
  bg2: string;
  bg3: string;
  border: string;
  borderStrong: string;
  text: string;
  textDim: string;
  textMuted: string;
  textStrong: string;
  accent: string;
  accentSoft: string;
  danger: string;
};

export type TerminalPalette = {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  black: string;
  brightBlack: string;
  red: string;
  brightRed: string;
  green: string;
  brightGreen: string;
  yellow: string;
  brightYellow: string;
  blue: string;
  brightBlue: string;
  magenta: string;
  brightMagenta: string;
  cyan: string;
  brightCyan: string;
  white: string;
  brightWhite: string;
};

export type Theme = {
  id: string;
  name: string;
  ui: UiTokens;
  terminal: TerminalPalette;
};

export const THEMES: Theme[] = [
  {
    id: 'parallax-dark',
    name: 'Parallax Dark',
    ui: {
      bg0: '#0b0c0f',
      bg1: '#0f1115',
      bg2: '#14171c',
      bg3: '#1a1d23',
      border: '#24272e',
      borderStrong: '#2e323a',
      text: '#e4e4e7',
      textDim: '#71717a',
      textMuted: '#9ca3af',
      textStrong: '#fafafa',
      accent: '#818cf8',
      accentSoft: 'rgba(129, 140, 248, 0.18)',
      danger: '#ef4444',
    },
    terminal: {
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
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    ui: {
      bg0: '#11111b',
      bg1: '#1e1e2e',
      bg2: '#181825',
      bg3: '#313244',
      border: '#313244',
      borderStrong: '#45475a',
      text: '#cdd6f4',
      textDim: '#7f849c',
      textMuted: '#a6adc8',
      textStrong: '#f5f5f5',
      accent: '#cba6f7',
      accentSoft: 'rgba(203, 166, 247, 0.18)',
      danger: '#f38ba8',
    },
    terminal: {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      cursor: '#f5e0dc',
      cursorAccent: '#1e1e2e',
      selectionBackground: '#585b70',
      black: '#45475a',
      brightBlack: '#585b70',
      red: '#f38ba8',
      brightRed: '#f38ba8',
      green: '#a6e3a1',
      brightGreen: '#a6e3a1',
      yellow: '#f9e2af',
      brightYellow: '#f9e2af',
      blue: '#89b4fa',
      brightBlue: '#89b4fa',
      magenta: '#f5c2e7',
      brightMagenta: '#f5c2e7',
      cyan: '#94e2d5',
      brightCyan: '#94e2d5',
      white: '#bac2de',
      brightWhite: '#a6adc8',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    ui: {
      bg0: '#191a21',
      bg1: '#282a36',
      bg2: '#21222c',
      bg3: '#44475a',
      border: '#383a4a',
      borderStrong: '#44475a',
      text: '#f8f8f2',
      textDim: '#6272a4',
      textMuted: '#bd93f9',
      textStrong: '#ffffff',
      accent: '#bd93f9',
      accentSoft: 'rgba(189, 147, 249, 0.18)',
      danger: '#ff5555',
    },
    terminal: {
      background: '#282a36',
      foreground: '#f8f8f2',
      cursor: '#f8f8f2',
      cursorAccent: '#282a36',
      selectionBackground: '#44475a',
      black: '#21222c',
      brightBlack: '#6272a4',
      red: '#ff5555',
      brightRed: '#ff6e6e',
      green: '#50fa7b',
      brightGreen: '#69ff94',
      yellow: '#f1fa8c',
      brightYellow: '#ffffa5',
      blue: '#bd93f9',
      brightBlue: '#d6acff',
      magenta: '#ff79c6',
      brightMagenta: '#ff92df',
      cyan: '#8be9fd',
      brightCyan: '#a4ffff',
      white: '#f8f8f2',
      brightWhite: '#ffffff',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    ui: {
      bg0: '#15161e',
      bg1: '#1a1b26',
      bg2: '#16161e',
      bg3: '#2f334d',
      border: '#292e42',
      borderStrong: '#3b4261',
      text: '#a9b1d6',
      textDim: '#565f89',
      textMuted: '#9aa5ce',
      textStrong: '#c0caf5',
      accent: '#7aa2f7',
      accentSoft: 'rgba(122, 162, 247, 0.18)',
      danger: '#f7768e',
    },
    terminal: {
      background: '#1a1b26',
      foreground: '#a9b1d6',
      cursor: '#c0caf5',
      cursorAccent: '#1a1b26',
      selectionBackground: '#33467c',
      black: '#15161e',
      brightBlack: '#414868',
      red: '#f7768e',
      brightRed: '#f7768e',
      green: '#9ece6a',
      brightGreen: '#9ece6a',
      yellow: '#e0af68',
      brightYellow: '#e0af68',
      blue: '#7aa2f7',
      brightBlue: '#7aa2f7',
      magenta: '#bb9af7',
      brightMagenta: '#bb9af7',
      cyan: '#7dcfff',
      brightCyan: '#7dcfff',
      white: '#a9b1d6',
      brightWhite: '#c0caf5',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    ui: {
      bg0: '#242933',
      bg1: '#2e3440',
      bg2: '#2a2f3a',
      bg3: '#3b4252',
      border: '#3b4252',
      borderStrong: '#434c5e',
      text: '#d8dee9',
      textDim: '#6f7888',
      textMuted: '#a8b1c2',
      textStrong: '#eceff4',
      accent: '#88c0d0',
      accentSoft: 'rgba(136, 192, 208, 0.20)',
      danger: '#bf616a',
    },
    terminal: {
      background: '#2e3440',
      foreground: '#d8dee9',
      cursor: '#d8dee9',
      cursorAccent: '#2e3440',
      selectionBackground: '#434c5e',
      black: '#3b4252',
      brightBlack: '#4c566a',
      red: '#bf616a',
      brightRed: '#bf616a',
      green: '#a3be8c',
      brightGreen: '#a3be8c',
      yellow: '#ebcb8b',
      brightYellow: '#ebcb8b',
      blue: '#81a1c1',
      brightBlue: '#81a1c1',
      magenta: '#b48ead',
      brightMagenta: '#b48ead',
      cyan: '#88c0d0',
      brightCyan: '#8fbcbb',
      white: '#e5e9f0',
      brightWhite: '#eceff4',
    },
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    ui: {
      bg0: '#1d2021',
      bg1: '#282828',
      bg2: '#1f2122',
      bg3: '#3c3836',
      border: '#3c3836',
      borderStrong: '#504945',
      text: '#ebdbb2',
      textDim: '#928374',
      textMuted: '#bdae93',
      textStrong: '#fbf1c7',
      accent: '#fabd2f',
      accentSoft: 'rgba(250, 189, 47, 0.18)',
      danger: '#fb4934',
    },
    terminal: {
      background: '#282828',
      foreground: '#ebdbb2',
      cursor: '#ebdbb2',
      cursorAccent: '#282828',
      selectionBackground: '#504945',
      black: '#3c3836',
      brightBlack: '#928374',
      red: '#fb4934',
      brightRed: '#fb4934',
      green: '#b8bb26',
      brightGreen: '#b8bb26',
      yellow: '#fabd2f',
      brightYellow: '#fabd2f',
      blue: '#83a598',
      brightBlue: '#83a598',
      magenta: '#d3869b',
      brightMagenta: '#d3869b',
      cyan: '#8ec07c',
      brightCyan: '#8ec07c',
      white: '#ebdbb2',
      brightWhite: '#fbf1c7',
    },
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    ui: {
      bg0: '#00212b',
      bg1: '#002b36',
      bg2: '#01303d',
      bg3: '#073642',
      border: '#073642',
      borderStrong: '#586e75',
      text: '#93a1a1',
      textDim: '#586e75',
      textMuted: '#839496',
      textStrong: '#fdf6e3',
      accent: '#268bd2',
      accentSoft: 'rgba(38, 139, 210, 0.20)',
      danger: '#dc322f',
    },
    terminal: {
      background: '#002b36',
      foreground: '#93a1a1',
      cursor: '#93a1a1',
      cursorAccent: '#002b36',
      selectionBackground: '#073642',
      black: '#073642',
      brightBlack: '#586e75',
      red: '#dc322f',
      brightRed: '#cb4b16',
      green: '#859900',
      brightGreen: '#586e75',
      yellow: '#b58900',
      brightYellow: '#657b83',
      blue: '#268bd2',
      brightBlue: '#839496',
      magenta: '#d33682',
      brightMagenta: '#6c71c4',
      cyan: '#2aa198',
      brightCyan: '#93a1a1',
      white: '#eee8d5',
      brightWhite: '#fdf6e3',
    },
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    ui: {
      bg0: '#1c1f25',
      bg1: '#21252b',
      bg2: '#1e2228',
      bg3: '#2c313a',
      border: '#2c313a',
      borderStrong: '#3e4451',
      text: '#abb2bf',
      textDim: '#5c6370',
      textMuted: '#9da5b4',
      textStrong: '#ffffff',
      accent: '#61afef',
      accentSoft: 'rgba(97, 175, 239, 0.18)',
      danger: '#e06c75',
    },
    terminal: {
      background: '#21252b',
      foreground: '#abb2bf',
      cursor: '#528bff',
      cursorAccent: '#21252b',
      selectionBackground: '#3e4451',
      black: '#3f4451',
      brightBlack: '#4f5666',
      red: '#e05561',
      brightRed: '#ff616e',
      green: '#8cc265',
      brightGreen: '#a5e075',
      yellow: '#d18f52',
      brightYellow: '#f0a45d',
      blue: '#4aa5f0',
      brightBlue: '#4dc4ff',
      magenta: '#c162de',
      brightMagenta: '#de73ff',
      cyan: '#42b3c2',
      brightCyan: '#4cd1e0',
      white: '#d7dae0',
      brightWhite: '#e6e6e6',
    },
  },
];

export const DEFAULT_THEME_ID = 'parallax-dark';

export function findTheme(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

// CSS variable name table — keep in sync with App.css :root block.
const UI_VAR: Record<keyof UiTokens, string> = {
  bg0: '--bg-0',
  bg1: '--bg-1',
  bg2: '--bg-2',
  bg3: '--bg-3',
  border: '--border',
  borderStrong: '--border-strong',
  text: '--text',
  textDim: '--text-dim',
  textMuted: '--text-muted',
  textStrong: '--text-strong',
  accent: '--accent',
  accentSoft: '--accent-soft',
  danger: '--danger',
};

export function applyThemeToDocument(theme: Theme): void {
  const root = document.documentElement;
  for (const key of Object.keys(theme.ui) as (keyof UiTokens)[]) {
    root.style.setProperty(UI_VAR[key], theme.ui[key]);
  }
}
