import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { TOUR_CHAPTERS } from './chapters';
import type { TourChapterId } from './types';
import { useAuthStore } from '@/lib/store/authStore';
import { useTourStore } from '@/lib/store/tourStore';

export function useAutoTour(chapterId: TourChapterId, delay = 650, enabled = true) {
  const profile = useAuthStore((state) => state.profile);
  const activeChapter = useTourStore((state) => state.activeChapter);
  const completedLocally = useTourStore((state) => state.completedLocally);
  const skippedLocally = useTourStore((state) => state.skippedLocally);
  const hydrated = useTourStore((state) => state.hydrated);
  const startChapter = useTourStore((state) => state.startChapter);

  useFocusEffect(useCallback(() => {
    const completedRemotely = profile?.mobileUsageTourCompletedChapters ?? [];
    if (
      !enabled
      || !profile
      || !hydrated
      || activeChapter
      || skippedLocally
      || profile.mobileUsageTourSkipped
      || completedLocally.includes(chapterId)
      || completedRemotely.includes(chapterId)
    ) return;

    const timer = setTimeout(() => startChapter(TOUR_CHAPTERS[chapterId]), delay);
    return () => clearTimeout(timer);
  }, [activeChapter, chapterId, completedLocally, delay, enabled, hydrated, profile, skippedLocally, startChapter]));
}
