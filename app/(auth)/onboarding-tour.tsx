import { useState, useRef } from 'react';
import { View, Text, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, interpolate, Extrapolation, FadeIn } from 'react-native-reanimated';
import { spacing, radius } from '@/constants/theme';
import { lightColors as c } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { HeroArt } from '@/components/ui/HeroArt';

const { width } = Dimensions.get('window');

const SLIDES = [
  { icon: 'TrendingUp' as const, title: 'Track Your Grades', body: 'Automatically calculate your GPA and PI, and track semester performance across all courses.' },
  { icon: 'Camera' as const, title: 'Scan, Don\u2019t Type', body: 'Point your camera at a result slip \u2014 AI reads every course and score for you to review.' },
  { icon: 'Sparkles' as const, title: 'See What\u2019s Ahead', body: 'AcadeMind forecasts your degree class and tells you exactly what you need to hit your target.' },
];

/**
 * NEW — this screen didn't meaningfully exist before (the previous
 * "onboarding-tour" was a single post-signup preference toggle, not this).
 * Rebuilt to match the reference's actual OnboardingTour panel: light
 * background, top bar with logo + Skip, a large hero visual, title +
 * description, dot pagination, Continue button, and a "Sign In" escape
 * hatch for people who already have an account. Reference uses real
 * photography here — substituted with the existing `HeroArt` (animated
 * icon) since no photo assets exist in this project; noted, not hidden.
 * Per explicit instruction: this sits between Welcome and Register —
 * "Continue" on the last slide leads to Register, not straight to sign-in.
 */
export default function OnboardingTour() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const isLast = index === SLIDES.length - 1;

  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { scrollX.value = e.contentOffset.x; } });

  function goNext() {
    if (isLast) {
      router.push('/(auth)/register');
    } else {
      scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.void }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.sm }}>
          <Logo size={28} showWordmark themeColors={c} />
          <Pressable onPress={() => router.push('/(auth)/register')}>
            <Text style={{ color: c.primary, fontWeight: '600', fontSize: 14 }}>Skip</Text>
          </Pressable>
        </View>

        <Animated.ScrollView
          horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler} scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={{ flex: 1 }}
        >
          {SLIDES.map((s, i) => (
            <Slide key={i} slide={s} index={i} scrollX={scrollX} />
          ))}
        </Animated.ScrollView>

        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: spacing.sm }}>
            {SLIDES.map((_, i) => (
              <View key={i} style={{ width: i === index ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i === index ? c.primary : c.border }} />
            ))}
          </View>
          <Button label={isLast ? 'Get Started' : 'Continue'} onPress={goNext} fullWidth />
          <Pressable onPress={() => router.push('/(auth)/login')} style={{ alignItems: 'center', paddingVertical: 4 }}>
            <Text style={{ color: c.textMuted, fontSize: 13 }}>
              Already have an account? <Text style={{ color: c.primary, fontWeight: '700' }}>Sign In</Text>
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Slide({ slide, index, scrollX }: { slide: (typeof SLIDES)[number]; index: number; scrollX: Animated.SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      opacity: interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(scrollX.value, inputRange, [0.9, 1, 0.9], Extrapolation.CLAMP) }],
    };
  });

  return (
    <View style={{ width, flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'center' }}>
      <Animated.View style={style} entering={FadeIn.duration(300)}>
        <View style={{ backgroundColor: c.overlay, borderRadius: radius.xl, height: 280, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl, overflow: 'hidden' }}>
          <HeroArt icon={slide.icon} size={110} color={c.primary} useAcademindLogo={slide.icon === 'Sparkles'} />
        </View>
        <Text style={{ color: c.text, fontSize: 24, fontWeight: '800', marginBottom: spacing.sm, textAlign: 'center' }}>{slide.title}</Text>
        <Text style={{ color: c.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 21 }}>{slide.body}</Text>
      </Animated.View>
    </View>
  );
}
