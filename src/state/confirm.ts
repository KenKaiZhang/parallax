import { create } from 'zustand';

export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

type ConfirmStore = {
  request: ConfirmRequest | null;
  ask: (r: ConfirmRequest) => void;
  close: () => void;
};

export const useConfirm = create<ConfirmStore>((set) => ({
  request: null,
  ask: (request) => set({ request }),
  close: () => set({ request: null }),
}));
