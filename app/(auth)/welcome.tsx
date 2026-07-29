import { useRef, useState } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
  FadeInDown,
} from 'react-native-reanimated';
import { colors, spacing, APP_NAME } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { AuthGlow } from '@/components/ui/AuthGlow';
import { HeroArt } from '@/components/ui/HeroArt';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    title: 'Know exactly where you stand',
    body: 'Track your CGPA and Performance Index side by side, updated the instant you add a result.',
    icon: 'TrendingUp' as const,
  },
  {
    title: 'Scan results, skip the typing',
    body: 'Snap a photo of your result slip — AI extracts every course and score for you to review.',
    icon: 'Camera' as const,
  },
  {
    title: 'See where you\u2019re headed',
    body: 'AI forecasts your degree class and tells you exactly what GPA you need to hit your target.',
    icon: 'Target' as const,
  },
];

/**
 * UPGRADED per acadegrade-ui-upgrade-prompt.md §1: animated glow background
 * (was flat colors.void), emoji hero art replaced with HeroArt (animated
 * SVG+icon, since assets/lottie/ had no real Lottie files), parallax +
 * scale on inactive slides instead of a hard cut, staggered CTA entrance.
 * Carousel logic/navigation targets unchanged.
 */
export default function Welcome() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  return (
    <View style={{ flex: 1 }}>
      <AuthGlow />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ alignItems: 'center', paddingTop: spacing.xl }}>
          <Text style={{ color: colors.primaryGlow, fontSize: 24, fontWeight: '800' }}>{APP_NAME}</Text>
        </View>

        <Animated.ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        >
          {SLIDES.map((item, i) => (
            <Slide key={i} item={item} index={i} scrollX={scrollX} />
          ))}
        </Animated.ScrollView>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: spacing.xl }}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === index ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === index ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>

        <Animated.View
          entering={FadeInDown.delay(150).duration(350)}
          style={{ paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: spacing.lg }}
        >
          <Button label="Get Started" onPress={() => router.push('/(auth)/register')} fullWidth />
          <Button
            label="I already have an account"
            variant="ghost"
            onPress={() => router.push('/(auth)/login')}
            fullWidth
          />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

function Slide({ item, index, scrollX }: { item: (typeof SLIDES)[number]; index: number; scrollX: Animated.SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    const scale = interpolate(scrollX.value, inputRange, [0.85, 1, 0.85], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, inputRange, [0.4, 1, 0.4], Extrapolation.CLAMP);
    const translateY = interpolate(scrollX.value, inputRange, [18, 0, 18], Extrapolation.CLAMP);
    return { transform: [{ scale }, { translateY }], opacity };
  });

  return (
    <View style={{ width, padding: spacing.xxl, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <Animated.View style={[style, { alignItems: 'center' }]}>
        <View style={{ marginBottom: spacing.xl }}>
          <HeroArt icon={item.icon} />
        </View>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: spacing.md }}>
          {item.title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 16, textAlign: 'center', lineHeight: 24 }}>
          {item.body}
        </Text>
      </Animated.View>
    </View>
  );
}
