import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react-native';
import { radius, spacing } from '@/constants/theme';
import { useThemeColors } from '@/lib/store/themeStore';
import { useToastStore, type ToastType } from '@/lib/store/toastStore';

export function ToastHost() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const toast = useToastStore((state) => state.toast);
  const hide = useToastStore((state) => state.hide);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(hide, toast.duration);
    return () => clearTimeout(timer);
  }, [hide, toast]);

  if (!toast) return null;
  const accent = toastColor(toast.type, colors);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999, elevation: 30 }}>
      <Animated.View
        key={toast.id}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={[toast.title, toast.message].filter(Boolean).join('. ')}
        entering={FadeInDown.springify().damping(18)}
        exiting={FadeOutUp.duration(180)}
        style={{
          marginTop: insets.top + spacing.sm,
          marginHorizontal: spacing.lg,
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: `${accent}70`,
          shadowColor: '#000000',
          shadowOpacity: 0.2,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: `${accent}18` }}>
          <ToastIcon type={toast.type} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '900' }}>{toast.title}</Text>
          {!!toast.message && <Text style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 2 }}>{toast.message}</Text>}
        </View>
        <Pressable accessibilityLabel="Dismiss notification" onPress={hide} hitSlop={10}>
          <XCircle size={17} color={colors.textFaint} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function toastColor(type: ToastType, colors: ReturnType<typeof useThemeColors>) {
  if (type === 'success') return colors.success;
  if (type === 'error') return colors.danger;
  if (type === 'warning') return colors.warning;
  return colors.info;
}

function ToastIcon({ type, color }: { type: ToastType; color: string }) {
  if (type === 'success') return <CheckCircle2 size={18} color={color} />;
  if (type === 'error') return <XCircle size={18} color={color} />;
  if (type === 'warning') return <AlertTriangle size={18} color={color} />;
  return <Info size={18} color={color} />;
}
