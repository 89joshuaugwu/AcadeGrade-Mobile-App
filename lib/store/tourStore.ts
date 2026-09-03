import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { TourChapter, TourChapterId } from '@/lib/tour/types';

interface TourState {
  activeChapter: TourChapter | null;
  stepIndex: number;
  completedLocally: TourChapterId[];
  stepProgress: Partial<Record<TourChapterId, number>>;
  skippedLocally: boolean;
  ownerUid: string | null;
  hydrated: boolean;
  startChapter: (chapter: TourChapter, force?: boolean) => void;
  setStepIndex: (index: number) => void;
  completeChapterLocally: (chapter: TourChapterId) => void;
  pauseChapter: () => void;
  skipAllLocally: () => void;
  resetForReplay: () => void;
  setHydrated: (hydrated: boolean) => void;
  setOwner: (uid: string) => void;
}

export const useTourStore = create<TourState>()(persist(
  (set, get) => ({
    activeChapter: null,
    stepIndex: 0,
    completedLocally: [],
    stepProgress: {},
    skippedLocally: false,
    ownerUid: null,
    hydrated: false,
    startChapter: (chapter, force = false) => {
      const state = get();
      if (state.activeChapter || (!force && (state.skippedLocally || state.completedLocally.includes(chapter.id)))) return;
      const savedStep = force ? 0 : Math.min(state.stepProgress[chapter.id] ?? 0, chapter.steps.length - 1);
      set({ activeChapter: chapter, stepIndex: Math.max(0, savedStep) });
    },
    setStepIndex: (stepIndex) => set((state) => ({
      stepIndex,
      stepProgress: state.activeChapter
        ? { ...state.stepProgress, [state.activeChapter.id]: stepIndex }
        : state.stepProgress,
    })),
    completeChapterLocally: (chapter) => set((state) => {
      const stepProgress = { ...state.stepProgress };
      delete stepProgress[chapter];
      return {
        activeChapter: null,
        stepIndex: 0,
        stepProgress,
        completedLocally: state.completedLocally.includes(chapter) ? state.completedLocally : [...state.completedLocally, chapter],
      };
    }),
    pauseChapter: () => set({ activeChapter: null, stepIndex: 0 }),
    skipAllLocally: () => set({ activeChapter: null, stepIndex: 0, stepProgress: {}, skippedLocally: true }),
    resetForReplay: () => set({ activeChapter: null, stepIndex: 0, completedLocally: [], stepProgress: {}, skippedLocally: false }),
    setHydrated: (hydrated) => set({ hydrated }),
    setOwner: (uid) => {
      if (get().ownerUid === uid) return;
      set({ ownerUid: uid, activeChapter: null, stepIndex: 0, completedLocally: [], stepProgress: {}, skippedLocally: false });
    },
  }),
  {
    name: 'acadegrade:usage-tour-v1',
    storage: createJSONStorage(() => AsyncStorage),
    partialize: (state) => ({
      completedLocally: state.completedLocally,
      stepProgress: state.stepProgress,
      skippedLocally: state.skippedLocally,
      ownerUid: state.ownerUid,
    }),
    onRehydrateStorage: () => (state) => state?.setHydrated(true),
  },
));
