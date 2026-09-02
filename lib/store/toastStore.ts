import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastPayload {
  title: string;
  message?: string;
  type?: ToastType;
  duration?: number;
}

interface ToastItem extends ToastPayload {
  id: number;
  type: ToastType;
  duration: number;
}

interface ToastState {
  toast: ToastItem | null;
  show: (payload: ToastPayload) => void;
  hide: () => void;
}

let nextToastId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  show: (payload) => set({
    toast: {
      id: nextToastId++,
      type: payload.type ?? 'info',
      duration: payload.duration ?? 3500,
      ...payload,
    },
  }),
  hide: () => set({ toast: null }),
}));
