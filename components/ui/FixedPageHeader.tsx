import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft } from 'lucide-react-native';
import { radius, spacing } from '@/constants/theme';
import { useThemeColors } from '@/lib/store/themeStore';
import { TourTarget } from '@/components/tour/TourTarget';
import { HeaderFadeEdge } from '@/components/ui/HeaderFadeEdge';

interface FixedPageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  tourId?: string;
  edge?: 'fade' | 'line' | 'none';
  edgeVisible?: boolean;
}

/** A compact header intended to sit above, rather than inside, page scrolling. */
export function FixedPageHeader({ title, subtitle, onBack, right, tourId, edge = 'fade', edgeVisible = false }: FixedPageHeaderProps) {
  const colors = useThemeColors();

  const header = (
    <Animated.View
      entering={FadeInDown.springify().damping(20).stiffness(210)}
      style={{
        minHeight: 68,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.void,
        borderBottomWidth: edge === 'line' && edgeVisible ? 1 : 0,
        borderBottomColor: colors.borderSubtle,
        zIndex: 5,
      }}
    >
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          hitSlop={10}
          style={{ width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: spacing.md }}
        >
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
      ) : null}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 21, lineHeight: 27, fontWeight: '900', letterSpacing: -0.45 }}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 1 }}>{subtitle}</Text> : null}
      </View>

      {right ? <View style={{ marginLeft: spacing.md }}>{right}</View> : null}

      {edge === 'fade' ? <HeaderFadeEdge visible={edgeVisible} /> : null}
    </Animated.View>
  );

  return tourId ? <TourTarget tourId={tourId}>{header}</TourTarget> : header;
}
