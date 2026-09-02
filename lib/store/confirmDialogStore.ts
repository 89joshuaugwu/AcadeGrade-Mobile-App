import { create } from 'zustand';

export type ConfirmDialogTone = 'danger' | 'warning' | 'primary';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  onConfirm: () => void | Promise<void>;
}

interface ConfirmDialogState {
  dialog: ConfirmDialogOptions | null;
  show: (dialog: ConfirmDialogOptions) => void;
  hide: () => void;
}

export const useConfirmDialogStore = create<ConfirmDialogState>((set) => ({
  dialog: null,
  show: (dialog) => set({ dialog }),
  hide: () => set({ dialog: null }),
}));
