export type LeafNode = {
  kind: 'leaf';
  id: string;
  cwd?: string;
};

export type SplitNode = {
  kind: 'split';
  id: string;
  dir: 'row' | 'column';
  ratio: number;
  a: PaneNode;
  b: PaneNode;
};

export type PaneNode = LeafNode | SplitNode;

export type Group = {
  id: string;
  name: string;
  notes: string;
  layout: PaneNode;
  cwd?: string;
};

export type PersistedState = {
  groups: Group[];
  activeGroupId: string | null;
  sidebarWidth?: number;
  sidebarHidden?: boolean;
  notesRatio?: number;
};
