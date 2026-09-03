import { type StyleProp, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { radius } from '@/constants/theme';

interface SwipeDownHandleProps {
  onDismiss: () => void;
  color: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A deliberately small gesture target so text inputs and sheet scroll views
 * keep their native behaviour, while the familiar handle always dismisses a
 * sheet with a decisive downward pull. */
export function SwipeDownHandle({ onDismiss, color, disabled = false, style }: SwipeDownHandleProps) {
  const translateY = useSharedValue(0);
  const gesture = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      const shouldDismiss = !disabled && (event.translationY > 42 || event.velocityY > 650);
      translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
      if (shouldDismiss) runOnJS(onDismiss)();
    });
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View accessibilityRole="adjustable" accessibilityLabel="Swipe down to close" style={[{ alignSelf: 'center', paddingVertical: 8 }, style, animatedStyle]}>
        <View style={{ width: 40, height: 4, borderRadius: radius.pill, backgroundColor: color }} />
      </Animated.View>
    </GestureDetector>
  );
}
