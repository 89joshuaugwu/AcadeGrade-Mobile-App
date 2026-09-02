import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, ShieldAlert, Sparkles } from 'lucide-react-native';
import { radius, spacing } from '@/constants/theme';
import { useThemeColors } from '@/lib/store/themeStore';
import { useConfirmDialogStore, type ConfirmDialogTone } from '@/lib/store/confirmDialogStore';

export function ConfirmDialogHost() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const dialog = useConfirmDialogStore((state) => state.dialog);
  const hide = useConfirmDialogStore((state) => state.hide);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (dialog) setLoading(false);
  }, [dialog]);

  if (!dialog) return null;

  const tone = dialog.tone ?? 'danger';
  const accent = toneColor(tone, colors);
  const actionBackground = tone === 'primary'
    ? colors.primaryHover
    : tone === 'danger'
      ? colors.dangerAction
      : accent;
  const actionForeground = tone === 'warning' ? '#1C1005' : '#FFFFFF';

  async function confirm() {
    if (!dialog || loading) return;
    setLoading(true);
    try {
      await Haptics.notificationAsync(
        tone === 'danger'
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
      );
      await dialog.onConfirm();
      hide();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      transparent
      statusBarTranslucent
      animationType="none"
      visible
      onRequestClose={() => { if (!loading) hide(); }}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          entering={FadeIn.duration(180)}
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(2, 4, 12, 0.76)' }}
        >
          <Pressable
            accessibilityLabel="Cancel confirmation"
            disabled={loading}
            onPress={hide}
            style={{ flex: 1 }}
          />
        </Animated.View>

        <Animated.View
          entering={SlideInDown.springify().damping(21).stiffness(190)}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={{
            marginHorizontal: spacing.sm,
            marginBottom: Math.max(insets.bottom, spacing.sm),
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: spacing.lg,
            borderRadius: radius.xl,
            backgroundColor: colors.deep,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: '#000000',
            shadowOpacity: 0.35,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: -8 },
            elevation: 24,
          }}
        >
          <View
            style={{
              width: 38,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: colors.border,
              alignSelf: 'center',
              marginBottom: spacing.lg,
            }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.lg,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `${accent}16`,
                borderWidth: 1,
                borderColor: `${accent}42`,
              }}
            >
              <DialogIcon tone={tone} color={accent} />
            </View>
            <View style={{ flex: 1, paddingTop: 2 }}>
              <Text style={{ color: colors.text, fontSize: 19, lineHeight: 25, fontWeight: '900' }}>
                {dialog.title}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 5 }}>
                {dialog.message}
              </Text>
            </View>
          </View>

          {tone === 'danger' && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                marginTop: spacing.lg,
                paddingHorizontal: spacing.md,
                paddingVertical: 10,
                borderRadius: radius.md,
                backgroundColor: colors.dangerDim,
              }}
            >
              <ShieldAlert size={15} color={colors.danger} />
              <Text style={{ color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: '700', flex: 1 }}>
                This action cannot be undone.
              </Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={dialog.cancelLabel ?? 'Cancel'}
              disabled={loading}
              onPress={hide}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 50,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.md,
                backgroundColor: colors.overlay,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: loading ? 0.55 : pressed ? 0.72 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>
                {dialog.cancelLabel ?? 'Keep it'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={dialog.confirmLabel ?? 'Confirm'}
              accessibilityState={{ disabled: loading, busy: loading }}
              disabled={loading}
              onPress={confirm}
              style={({ pressed }) => ({
                flex: 1.25,
                minHeight: 50,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.md,
                backgroundColor: actionBackground,
                opacity: loading ? 0.72 : pressed ? 0.84 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              {loading ? (
                <ActivityIndicator color={actionForeground} />
              ) : (
                <Text style={{ color: actionForeground, fontSize: 14, fontWeight: '900' }}>
                  {dialog.confirmLabel ?? 'Confirm'}
                </Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function toneColor(tone: ConfirmDialogTone, colors: ReturnType<typeof useThemeColors>) {
  if (tone === 'danger') return colors.danger;
  if (tone === 'warning') return colors.warning;
  return colors.primary;
}

function DialogIcon({ tone, color }: { tone: ConfirmDialogTone; color: string }) {
  if (tone === 'danger') return <ShieldAlert size={23} color={color} />;
  if (tone === 'warning') return <AlertTriangle size={23} color={color} />;
  return <Sparkles size={23} color={color} />;
}
