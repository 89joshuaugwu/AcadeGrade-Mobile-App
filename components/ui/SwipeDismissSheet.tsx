import React, { useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

interface SwipeDismissSheetProps {
  children: React.ReactNode;
  onDismiss: () => void;
  disabled?: boolean;
  /** For scrollable sheets, only capture a downward drag at scroll position 0. */
  canStart?: () => boolean;
  style?: StyleProp<ViewStyle>;
}

/** Gives native Modal sheets the body-pan behaviour of a real bottom sheet. */
export function SwipeDismissSheet({ children, onDismiss, disabled = false, canStart, style }: SwipeDismissSheetProps) {
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useMemo(() => {
    const shouldStart = (_: unknown, gesture: { dx: number; dy: number }) => (
      !disabled
      && (canStart?.() ?? true)
      && gesture.dy > 8
      && Math.abs(gesture.dx) < 28
    );

    const restore = () => {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 240,
      }).start();
    };

    return PanResponder.create({
      onMoveShouldSetPanResponder: shouldStart,
      onMoveShouldSetPanResponderCapture: shouldStart,
      onPanResponderMove: (_, gesture) => {
        translateY.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldDismiss = !disabled && (gesture.dy > 72 || gesture.vy > 0.72);
        if (!shouldDismiss) {
          restore();
          return;
        }

        Animated.timing(translateY, {
          toValue: 520,
          duration: 180,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished) return;
          onDismiss();
          requestAnimationFrame(() => translateY.setValue(0));
        });
      },
      onPanResponderTerminate: restore,
      onPanResponderTerminationRequest: () => false,
    });
  }, [canStart, disabled, onDismiss, translateY]);

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[style, { transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}
