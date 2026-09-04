import { useCallback, useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeScrollEvent, NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import { useThemeColors } from '@/lib/store/themeStore';

interface HeaderFadeEdgeProps {
  height?: number;
  visible?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Tracks whether scrollable content has moved beneath a fixed page header. */
export function useHeaderScrollEdge(threshold = 6) {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = Math.max(0, event.nativeEvent.contentOffset.y);
    // Hysteresis avoids flashing the edge while a list settles around y=0.
    const nextVisible = visibleRef.current ? offset > 1 : offset > threshold;
    if (visibleRef.current === nextVisible) return;
    visibleRef.current = nextVisible;
    setVisible(nextVisible);
  }, [threshold]);

  return { edgeVisible: visible, onHeaderScroll: onScroll };
}

/** A scroll-activated hairline that dissolves into a soft content fade. */
export function HeaderFadeEdge({ height = 18, visible = true, style }: HeaderFadeEdgeProps) {
  const colors = useThemeColors();
  const progress = useSharedValue(visible ? 1 : 0);
  const curveHeight = Math.min(11, Math.max(8, height * 0.5));

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 320 : 190,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -1.5 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: -height,
        height,
      }, animatedStyle, style]}
    >
      <LinearGradient
        colors={[`${colors.void}C2`, `${colors.void}82`, `${colors.void}36`, `${colors.void}00`]}
        locations={[0, 0.32, 0.7, 1]}
        style={{
          position: 'absolute',
          top: 0,
          left: 10,
          right: 10,
          height,
        }}
      />
      <Svg
        width="100%"
        height={curveHeight}
        viewBox="0 0 100 12"
        preserveAspectRatio="none"
      >
        <Defs>
          <SvgLinearGradient id="header-edge-stroke" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={colors.textMuted} stopOpacity={0.18} />
            <Stop offset="10%" stopColor={colors.textMuted} stopOpacity={0.58} />
            <Stop offset="22%" stopColor={colors.textMuted} stopOpacity={0.78} />
            <Stop offset="50%" stopColor={colors.textMuted} stopOpacity={0.88} />
            <Stop offset="78%" stopColor={colors.textMuted} stopOpacity={0.78} />
            <Stop offset="90%" stopColor={colors.textMuted} stopOpacity={0.58} />
            <Stop offset="100%" stopColor={colors.textMuted} stopOpacity={0.18} />
          </SvgLinearGradient>
        </Defs>
        {/* Inverse cap: /────────\ — a level centre with ends curving down. */}
        <Path d="M 0 0 H 100 V 10 C 96 10 96 2 86 2 H 14 C 4 2 4 10 0 10 Z" fill={colors.void} />
        <Path
          d="M 0 10 C 4 10 4 2 14 2 H 86 C 96 2 96 10 100 10"
          fill="none"
          stroke="url(#header-edge-stroke)"
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </Svg>
    </Animated.View>
  );
}
