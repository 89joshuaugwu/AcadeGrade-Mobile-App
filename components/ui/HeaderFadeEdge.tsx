import { useCallback, useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeScrollEvent, NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useThemeColors } from '@/lib/store/themeStore';

interface HeaderFadeEdgeProps {
  height?: number;
  visible?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Tracks whether scrollable content has moved beneath a fixed page header. */
export function useHeaderScrollEdge(threshold = 4) {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextVisible = event.nativeEvent.contentOffset.y > threshold;
    if (visibleRef.current === nextVisible) return;
    visibleRef.current = nextVisible;
    setVisible(nextVisible);
  }, [threshold]);

  return { edgeVisible: visible, onHeaderScroll: onScroll };
}

/** A scroll-activated hairline that dissolves into a soft content fade. */
export function HeaderFadeEdge({ height = 14, visible = true, style }: HeaderFadeEdgeProps) {
  const colors = useThemeColors();
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, { duration: visible ? 220 : 150 });
  }, [progress, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -3 }],
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
        colors={[`${colors.border}00`, colors.border, colors.border, `${colors.border}00`]}
        locations={[0, 0.12, 0.88, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ height: 1 }}
      />
      <LinearGradient
        colors={[`${colors.void}D9`, `${colors.void}73`, `${colors.void}00`]}
        locations={[0, 0.44, 1]}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}
