import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { ChevronLeft, ChevronRight, CircleHelp, Sparkles, X } from 'lucide-react-native';
import { radius, spacing } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { db } from '@/lib/firebase/client';
import { useAuthStore } from '@/lib/store/authStore';
import { useThemeColors } from '@/lib/store/themeStore';
import { useToastStore } from '@/lib/store/toastStore';
import { useTourStore } from '@/lib/store/tourStore';
import { ALL_TOUR_CHAPTER_IDS, USAGE_TOUR_VERSION } from '@/lib/tour/chapters';
import { getTourTarget, runTourAction } from '@/lib/tour/registry';
import type { TourTargetRect } from '@/lib/tour/types';

const EDGE = 16;
const TARGET_PADDING = 7;

export function UsageTourHost() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const uid = useAuthStore((state) => state.firebaseUser?.uid);
  const profile = useAuthStore((state) => state.profile);
  const showToast = useToastStore((state) => state.show);
  const activeChapter = useTourStore((state) => state.activeChapter);
  const stepIndex = useTourStore((state) => state.stepIndex);
  const completedLocally = useTourStore((state) => state.completedLocally);
  const setStepIndex = useTourStore((state) => state.setStepIndex);
  const completeChapterLocally = useTourStore((state) => state.completeChapterLocally);
  const skipAllLocally = useTourStore((state) => state.skipAllLocally);
  const setTourOwner = useTourStore((state) => state.setOwner);
  const [targetRect, setTargetRect] = useState<TourTargetRect | null>(null);
  const [cardHeight, setCardHeight] = useState(245);
  const [showSkipChoice, setShowSkipChoice] = useState(false);

  const step = activeChapter?.steps[stepIndex];

  useEffect(() => {
    if (!step || !activeChapter) return;
    AccessibilityInfo.announceForAccessibility(
      `${activeChapter.label}. Step ${stepIndex + 1} of ${activeChapter.steps.length}. ${step.title}. ${step.description}`,
    );
  }, [activeChapter, step, stepIndex]);

  useEffect(() => {
    if (uid) setTourOwner(uid);
  }, [setTourOwner, uid]);

  useEffect(() => {
    if (!step) {
      setTargetRect(null);
      setShowSkipChoice(false);
      return;
    }

    let cancelled = false;
    setTargetRect(null);
    setShowSkipChoice(false);

    async function locate(attempt = 0) {
      if (cancelled || !step) return;
      runTourAction(step.enterAction);
      const target = step.target ? getTourTarget(step.target) : undefined;
      target?.focus?.();
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 380 : 140));
      if (cancelled) return;
      const measured = await target?.measure();
      if (measured && measured.width > 1 && measured.height > 1) {
        const visible = measured.y < height - insets.bottom && measured.y + measured.height > insets.top;
        if (visible) {
          setTargetRect(measured);
          return;
        }
      }
      if (attempt < 8) setTimeout(() => locate(attempt + 1), 120);
    }

    locate();
    return () => { cancelled = true; };
  }, [height, insets.bottom, insets.top, step]);

  const spotlight = useMemo(() => {
    if (!targetRect) return null;
    const x = Math.max(EDGE / 2, targetRect.x - TARGET_PADDING);
    const y = Math.max(insets.top / 2, targetRect.y - TARGET_PADDING);
    return {
      x,
      y,
      width: Math.min(width - x - EDGE / 2, targetRect.width + TARGET_PADDING * 2),
      height: Math.min(height * 0.36, height - y - insets.bottom / 2, targetRect.height + TARGET_PADDING * 2),
    };
  }, [height, insets.bottom, insets.top, targetRect, width]);

  const cardTop = useMemo(() => {
    const minTop = Math.max(insets.top + 12, 24);
    const maxTop = Math.max(minTop, height - insets.bottom - cardHeight - 18);
    if (!spotlight) return Math.max(minTop, Math.min(maxTop, (height - cardHeight) / 2));
    const below = spotlight.y + spotlight.height + 16;
    if (below + cardHeight <= height - insets.bottom - 14) return below;
    return Math.max(minTop, Math.min(maxTop, spotlight.y - cardHeight - 16));
  }, [cardHeight, height, insets.bottom, insets.top, spotlight]);

  if (!activeChapter || !step) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === activeChapter.steps.length - 1;
  const resolvedCardWidth = Math.min(420, width - EDGE * 2);

  async function completeChapter() {
    const chapterId = activeChapter!.id;
    const hasCurrentRemoteProgress = profile?.mobileUsageTourVersion === USAGE_TOUR_VERSION;
    const remoteCompleted = hasCurrentRemoteProgress
      ? profile?.mobileUsageTourCompletedChapters ?? []
      : [];
    const allCompleted = new Set([...remoteCompleted, ...completedLocally, chapterId]);
    completeChapterLocally(chapterId);
    if (!uid) return;
    try {
      await db.collection('users').doc(uid).set({
        mobileUsageTourVersion: USAGE_TOUR_VERSION,
        mobileUsageTourCompletedChapters: hasCurrentRemoteProgress
          ? firestore.FieldValue.arrayUnion(chapterId)
          : [chapterId],
        mobileUsageTourSkipped: false,
        mobileUsageTourCompleted: ALL_TOUR_CHAPTER_IDS.every((id) => allCompleted.has(id)),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch {
      showToast({ type: 'warning', title: 'Tour progress saved on this device', message: 'Cloud sync will be tried again when you replay or finish another section.' });
    }
  }

  async function skipEntireTour() {
    skipAllLocally();
    if (!uid) return;
    try {
      await db.collection('users').doc(uid).set({
        mobileUsageTourVersion: USAGE_TOUR_VERSION,
        mobileUsageTourSkipped: true,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch {
      showToast({ type: 'warning', title: 'Guide skipped on this device' });
    }
  }

  return (
    <Modal transparent statusBarTranslucent visible animationType="none" onRequestClose={() => setShowSkipChoice(true)}>
      <View style={{ flex: 1 }} accessibilityViewIsModal>
        <Svg width={width} height={height} style={{ position: 'absolute', inset: 0 }} pointerEvents="none">
          <Defs>
            <Mask id="usage-tour-cutout">
              <Rect x="0" y="0" width={width} height={height} fill="#FFFFFF" />
              {spotlight && <Rect x={spotlight.x} y={spotlight.y} width={spotlight.width} height={spotlight.height} rx={18} fill="#000000" />}
            </Mask>
          </Defs>
          <Rect x="0" y="0" width={width} height={height} fill="rgba(4, 7, 18, 0.82)" mask="url(#usage-tour-cutout)" />
        </Svg>

        {spotlight && (
          <Animated.View
            entering={FadeIn.duration(220)}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: spotlight.x,
              top: spotlight.y,
              width: spotlight.width,
              height: spotlight.height,
              borderRadius: 18,
              borderWidth: 2,
              borderColor: colors.primaryGlow,
              shadowColor: colors.primary,
              shadowOpacity: 0.9,
              shadowRadius: 18,
              elevation: 12,
            }}
          />
        )}

        <Animated.View
          key={step.id}
          entering={FadeInDown.springify().damping(22).stiffness(210)}
          onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
          style={{
            position: 'absolute',
            left: (width - resolvedCardWidth) / 2,
            top: cardTop,
            width: resolvedCardWidth,
            maxHeight: height - Math.max(insets.top, 16) - Math.max(insets.bottom, 16) - 20,
            backgroundColor: colors.deep,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.xl,
            overflow: 'hidden',
            shadowColor: '#000000',
            shadowOpacity: 0.38,
            shadowRadius: 26,
            shadowOffset: { width: 0, height: 12 },
            elevation: 30,
          }}
        >
          <View style={{ height: 4, backgroundColor: colors.overlay }}>
            <View style={{ width: `${((stepIndex + 1) / activeChapter.steps.length) * 100}%`, height: '100%', backgroundColor: colors.primary }} />
          </View>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
                {stepIndex === 0 ? <Sparkles size={18} color={colors.primary} /> : <CircleHelp size={18} color={colors.primary} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }}>{activeChapter.label.toUpperCase()} · {stepIndex + 1} OF {activeChapter.steps.length}</Text>
                <Text style={{ color: colors.text, fontSize: 18, lineHeight: 23, fontWeight: '900', marginTop: 3 }}>{step.title}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Skip usage guide" hitSlop={8} onPress={() => setShowSkipChoice(true)} style={{ padding: 3 }}>
                <X size={19} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: spacing.md }}>{step.description}</Text>

            {showSkipChoice ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg }}>
                <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '800' }}>Skip the complete usage guide?</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 }}>You can restart it later from Settings.</Text>
                <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                  <Button label="Continue learning" onPress={() => setShowSkipChoice(false)} fullWidth themeColors={colors} />
                  <Button label="Skip complete guide" variant="secondary" onPress={skipEntireTour} fullWidth themeColors={colors} />
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg }}>
                {!isFirst && (
                  <Pressable accessibilityRole="button" accessibilityLabel="Previous guide step" onPress={() => setStepIndex(stepIndex - 1)} style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronLeft size={20} color={colors.text} />
                  </Pressable>
                )}
                <View style={{ flex: 1 }}>
                  <Button
                    label={isLast ? `Finish ${activeChapter.label}` : 'Next'}
                    onPress={() => isLast ? completeChapter() : setStepIndex(stepIndex + 1)}
                    icon={!isLast ? <ChevronRight size={17} color="#FFFFFF" /> : undefined}
                    fullWidth
                    themeColors={colors}
                  />
                </View>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
