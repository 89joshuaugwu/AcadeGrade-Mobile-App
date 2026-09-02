import { create } from 'zustand';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, lightColors } from '@/constants/theme';

export type ThemeMode = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'acadegrade:themeMode';

interface ThemeState {
  mode: ThemeMode;
  hydrated: boolean;
  setMode: (mode: ThemeMode) => void;
  hydrate: () => Promise<void>;
}

/**
 * EXTENDED: now supports 'system' (follows the OS appearance setting) and
 * persists the choice via AsyncStorage — previously in-memory only,
 * resetting to light on every cold launch.
 *
 * All navigable application screens resolve their palette through
 * `useThemeColors()`. The welcome screen intentionally remains dark to
 * match the native splash and avoid a cold-start color flash.
 */
export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'light',
  hydrated: false,
  setMode: (mode) => {
    set({ mode });
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
  },
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        set({ mode: stored, hydrated: true });
        return;
      }
    } catch {}
    set({ hydrated: true });
  },
}));

/** Resolves 'system' against the OS appearance setting; screens rebuilt to use this respond live to the toggle. */
export function useThemeColors() {
  const mode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  const resolved = mode === 'system' ? (systemScheme ?? 'light') : mode;
  return resolved === 'dark' ? colors : lightColors;
}

export function useResolvedThemeMode(): 'light' | 'dark' {
  const mode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  return mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
}
