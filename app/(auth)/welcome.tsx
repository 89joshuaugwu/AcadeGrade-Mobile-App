import { useRef, useState } from 'react';
import { View, Text, Dimensions, FlatList, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, spacing, APP_NAME, APP_TAGLINE } from '@/constants/theme';
import { Button } from '@/components/ui/Button';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    title: 'Know exactly where you stand',
    body: 'Track your CGPA and Performance Index side by side, updated the instant you add a result.',
    emoji: '📊',
  },
  {
    title: 'Scan results, skip the typing',
    body: 'Snap a photo of your result slip — AI extracts every course and score for you to review.',
    emoji: '📸',
  },
  {
    title: 'See where you\u2019re headed',
    body: 'AI forecasts your degree class and tells you exactly what GPA you need to hit your target.',
    emoji: '🎯',
  },
];

export default function Welcome() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(i);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <View style={{ alignItems: 'center', paddingTop: spacing.xl }}>
        <Text style={{ color: colors.primaryGlow, fontSize: 24, fontWeight: '800' }}>{APP_NAME}</Text>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <Animated.View entering={FadeIn.duration(400)} style={{ width, padding: spacing.xxl, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <Text style={{ fontSize: 72, marginBottom: spacing.xl }}>{item.emoji}</Text>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: spacing.md }}>
              {item.title}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 16, textAlign: 'center', lineHeight: 24 }}>
              {item.body}
            </Text>
          </Animated.View>
        )}
        style={{ flex: 1 }}
      />

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

      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: spacing.lg }}>
        <Button label="Get Started" onPress={() => router.push('/(auth)/register')} fullWidth />
        <Button
          label="I already have an account"
          variant="ghost"
          onPress={() => router.push('/(auth)/login')}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}
