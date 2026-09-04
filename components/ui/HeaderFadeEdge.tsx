import { LinearGradient } from 'expo-linear-gradient';
import type { ViewStyle } from 'react-native';
import { useThemeColors } from '@/lib/store/themeStore';

interface HeaderFadeEdgeProps {
  height?: number;
  style?: ViewStyle;
}

/** Softens the point where fixed chrome meets content scrolling beneath it. */
export function HeaderFadeEdge({ height = 14, style }: HeaderFadeEdgeProps) {
  const colors = useThemeColors();

  return (
    <LinearGradient
      pointerEvents="none"
      colors={[colors.void, `${colors.void}D9`, `${colors.void}00`]}
      locations={[0, 0.38, 1]}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: -height,
        height,
        ...style,
      }}
    />
  );
}
