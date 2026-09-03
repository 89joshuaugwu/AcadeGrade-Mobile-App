import { useRef, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { radius, spacing } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { HeroArt } from '@/components/ui/HeroArt';
import { Logo } from '@/components/ui/Logo';
import { useAuthStore } from '@/lib/store/authStore';
import { useThemeColors } from '@/lib/store/themeStore';
import { db } from '@/lib/firebase/client';
import { useToastStore } from '@/lib/store/toastStore';
import { isStudentProfileComplete } from '@/lib/auth/profileCompletion';

const SLIDES = [
  { icon: 'TrendingUp' as const, title: 'Track Your Grades', body: 'Automatically calculate your GPA and PI, and track semester performance across all courses.' },
  { icon: 'Camera' as const, title: 'Scan, Don\u2019t Type', body: 'Point your camera at a result slip \u2014 AI reads every course and score for you to review.' },
  { icon: 'Sparkles' as const, title: 'See What\u2019s Ahead', body: 'AcadeMind forecasts your degree class and tells you exactly what you need to hit your target.' },
];

/** Short product introduction shown between Welcome and registration. */
export default function OnboardingTour() {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const firebaseUser = useAuthStore((state) => state.firebaseUser);
  const profile = useAuthStore((state) => state.profile);
  const showToast = useToastStore((state) => state.show);
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const scrollX = useSharedValue(0);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const isLast = index === SLIDES.length - 1;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollX.value = event.contentOffset.x; },
  });

  async function finishTour() {
    if (finishing) return;
    setFinishing(true);
    try {
      // Legacy authenticated profiles may still arrive here with the old
      // introduction flag unset. Finish the intro without touching the
      // separate contextual usage-tour progress.
      if (firebaseUser && isStudentProfileComplete(profile)) {
        await db.collection('users').doc(firebaseUser.uid).set({ mobileOnboardingCompleted: true }, { merge: true });
        router.replace('/(tabs)/dashboard');
      } else {
        showToast({ type: 'info', title: 'Finish setting up first', message: 'Add your student details before starting the app tour.' });
        router.replace('/(auth)/register');
      }
    } catch (error: any) {
      showToast({ type: 'error', title: 'Could not finish introduction', message: error?.message ?? 'Check your connection and try again.' });
    } finally {
      setFinishing(false);
    }
  }

  function goNext() {
    if (isLast) finishTour();
    else scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.void }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.sm }}>
          <Logo size={28} showWordmark themeColors={colors} />
          <Pressable accessibilityRole="button" accessibilityLabel="Skip introduction" onPress={finishTour} disabled={finishing} hitSlop={8}>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Skip</Text>
          </Pressable>
        </View>

        <Animated.ScrollView
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          ref={scrollRef}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
          style={{ flex: 1 }}
        >
          {SLIDES.map((slide, slideIndex) => (
            <Slide key={slide.title} slide={slide} index={slideIndex} width={width} scrollX={scrollX} />
          ))}
        </Animated.ScrollView>

        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: spacing.sm }}>
            {SLIDES.map((slide, slideIndex) => (
              <View key={slide.title} style={{ width: slideIndex === index ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: slideIndex === index ? colors.primary : colors.border }} />
            ))}
          </View>
          <Button label={isLast ? 'Get Started' : 'Continue'} onPress={goNext} loading={finishing} fullWidth themeColors={colors} />
          {!firebaseUser && (
            <Pressable onPress={() => router.push('/(auth)/login')} style={{ alignItems: 'center', paddingVertical: 4 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                Already have an account? <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign In</Text>
              </Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function Slide({ slide, index, width, scrollX }: { slide: (typeof SLIDES)[number]; index: number; width: number; scrollX: SharedValue<number> }) {
  const colors = useThemeColors();
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      opacity: interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(scrollX.value, inputRange, [0.9, 1, 0.9], Extrapolation.CLAMP) }],
    };
  });

  return (
    <View style={{ width, flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'center' }}>
      <Animated.View style={animatedStyle} entering={FadeIn.duration(300)}>
        <View style={{ backgroundColor: colors.overlay, borderRadius: radius.xl, height: 280, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl, overflow: 'hidden' }}>
          <HeroArt icon={slide.icon} size={110} color={colors.primary} useAcademindLogo={slide.icon === 'Sparkles'} />
        </View>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: spacing.sm, textAlign: 'center' }}>{slide.title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 21 }}>{slide.body}</Text>
      </Animated.View>
    </View>
  );
}
