import { useCallback, useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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
  const capHeight = Math.min(8, Math.max(5, height * 0.42));

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
      <View
        style={{
          height: capHeight,
          marginHorizontal: 6,
          backgroundColor: colors.void,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderBottomWidth: 1,
          borderBottomColor: `${colors.border}A3`,
          borderLeftColor: `${colors.border}66`,
          borderRightColor: `${colors.border}66`,
          borderBottomLeftRadius: 22,
          borderBottomRightRadius: 22,
          overflow: 'hidden',
        }}
      />
      <LinearGradient
        colors={[`${colors.void}A8`, `${colors.void}70`, `${colors.void}2E`, `${colors.void}00`]}
        locations={[0, 0.28, 0.66, 1]}
        style={{
          flex: 1,
          marginHorizontal: 14,
          borderBottomLeftRadius: 20,
          borderBottomRightRadius: 20,
        }}
      />
    </Animated.View>
  );
}
