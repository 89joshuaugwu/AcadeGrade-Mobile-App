import { Animated, PanResponder, type StyleProp, View, type ViewStyle } from 'react-native';
import { useMemo, useState } from 'react';
import { radius } from '@/constants/theme';

interface SwipeDownHandleProps {
  onDismiss: () => void;
  color: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Native Modals create their own view root, so this intentionally uses
 * React Native's PanResponder instead of GestureDetector. It works in every
 * modal/sheet root while keeping the gesture confined to the grab handle.
 */
export function SwipeDownHandle({ onDismiss, color, disabled = false, style }: SwipeDownHandleProps) {
  const [translateY] = useState(() => new Animated.Value(0));
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => !disabled && gesture.dy > 6 && Math.abs(gesture.dx) < 24,
    onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      const shouldDismiss = !disabled && (gesture.dy > 42 || gesture.vy > 0.65);
      if (shouldDismiss) {
        Animated.timing(translateY, { toValue: 180, duration: 120, useNativeDriver: true }).start(({ finished }) => {
          if (finished) onDismiss();
        });
        return;
      }
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
    },
    onPanResponderTerminate: () => Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }).start(),
  }), [disabled, onDismiss, translateY]);

  return (
    <Animated.View
      accessibilityRole="adjustable"
      accessibilityLabel="Swipe down to close"
      {...panResponder.panHandlers}
      style={[{ alignSelf: 'center', paddingVertical: 8 }, style, { transform: [{ translateY }] }]}
    >
      <View style={{ width: 40, height: 4, borderRadius: radius.pill, backgroundColor: color }} />
    </Animated.View>
  );
}
