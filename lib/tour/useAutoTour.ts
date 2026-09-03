import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { TOUR_CHAPTERS, USAGE_TOUR_VERSION } from './chapters';
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
    // A completed/skipped flag only belongs to the guide version that wrote
    // it. This lets a future redesigned guide run for existing users instead
    // of being hidden forever by stale profile data.
    const hasCurrentRemoteProgress = profile?.mobileUsageTourVersion === USAGE_TOUR_VERSION;
    const completedRemotely = hasCurrentRemoteProgress
      ? profile?.mobileUsageTourCompletedChapters ?? []
      : [];
    if (
      !enabled
      || !profile
      || !hydrated
      || activeChapter
      || skippedLocally
      || (hasCurrentRemoteProgress && profile.mobileUsageTourSkipped)
      || completedLocally.includes(chapterId)
      || completedRemotely.includes(chapterId)
    ) return;

    const timer = setTimeout(() => startChapter(TOUR_CHAPTERS[chapterId]), delay);
    return () => clearTimeout(timer);
  }, [activeChapter, chapterId, completedLocally, delay, enabled, hydrated, profile, skippedLocally, startChapter]));
}
