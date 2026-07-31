import { create } from 'zustand';
import { colors, lightColors } from '@/constants/theme';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
}

/**
 * Defaults to light — per direct request, matching the inspiration
 * references. In-memory only for now (no `@react-native-async-storage`
 * in the current dependency set) — resets to light on every cold app
 * launch. Add the async-storage dependency for real persistence when
 * that trade-off matters.
 */
export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'light',
  toggle: () => set((s) => ({ mode: s.mode === 'light' ? 'dark' : 'light' })),
  setMode: (mode) => set({ mode }),
}));

/** Screens rebuilt in this round use this instead of the static `colors` import — see theme.ts scope note. */
export function useThemeColors() {
  const mode = useThemeStore((s) => s.mode);
  return mode === 'light' ? lightColors : colors;
}
