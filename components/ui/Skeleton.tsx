import { useEffect } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { radius } from '@/constants/theme';
import { useThemeColors } from '@/lib/store/themeStore';

interface SkeletonPulseProps {
  children: React.ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** One lightweight pulse drives every placeholder inside a screen skeleton. */
export function SkeletonPulse({ children, accessibilityLabel = 'Content is loading', style }: SkeletonPulseProps) {
  const opacity = useSharedValue(0.52);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    opacity.value = reduceMotion
      ? 0.72
      : withRepeat(withTiming(0.96, { duration: 900 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(140)}
      exiting={reduceMotion ? undefined : FadeOut.duration(180)}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      style={[style, animatedStyle]}
    >
      {children}
    </Animated.View>
  );
}

interface SkeletonBlockProps {
  width?: DimensionValue;
  height: number;
  borderRadius?: number;
  flex?: number;
  style?: StyleProp<ViewStyle>;
}

export function SkeletonBlock({ width = '100%', height, borderRadius = radius.md, flex, style }: SkeletonBlockProps) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        {
          width: flex ? undefined : width,
          height,
          flex,
          borderRadius,
          backgroundColor: colors.overlay,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
        },
        style,
      ]}
    />
  );
}

export function SkeletonLine({ width = '100%', height = 10, style }: { width?: DimensionValue; height?: number; style?: StyleProp<ViewStyle> }) {
  return <SkeletonBlock width={width} height={height} borderRadius={height / 2} style={style} />;
}

export function SkeletonCircle({ size, style }: { size: number; style?: StyleProp<ViewStyle> }) {
  return <SkeletonBlock width={size} height={size} borderRadius={size / 2} style={style} />;
}
