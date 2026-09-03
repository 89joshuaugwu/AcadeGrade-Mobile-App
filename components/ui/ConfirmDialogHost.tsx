import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, ShieldAlert, Sparkles } from 'lucide-react-native';
import { radius, spacing } from '@/constants/theme';
import { useThemeColors } from '@/lib/store/themeStore';
import { useConfirmDialogStore, type ConfirmDialogTone } from '@/lib/store/confirmDialogStore';
import { Button } from '@/components/ui/Button';
import { SwipeDownHandle } from '@/components/ui/SwipeDownHandle';

// Explicit rather than a newly hydrated palette property: this guarantees
// the red fill remains present after light/dark switches and Fast Refresh.
const DESTRUCTIVE_BUTTON_COLOR = '#B91C1C';
const DESTRUCTIVE_BUTTON_BORDER = '#991B1B';

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
      ? DESTRUCTIVE_BUTTON_COLOR
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
          <SwipeDownHandle onDismiss={hide} disabled={loading} color={colors.border} style={{ marginBottom: spacing.lg }} />

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

          <View style={{ gap: spacing.sm, marginTop: spacing.lg, width: '100%' }}>
            <View style={{ width: '100%', borderRadius: radius.md, backgroundColor: actionBackground, borderWidth: 1, borderColor: tone === 'danger' ? DESTRUCTIVE_BUTTON_BORDER : actionBackground, overflow: 'hidden' }}>
              <Button
                label={dialog.confirmLabel ?? 'Confirm'}
                variant={tone === 'danger' ? 'danger' : 'primary'}
                loading={loading}
                disabled={loading}
                onPress={confirm}
                fullWidth
                themeColors={colors}
                icon={tone === 'danger' && !loading ? <ShieldAlert size={17} color={actionForeground} /> : undefined}
              />
            </View>
            <Button
              label={dialog.cancelLabel ?? 'Keep it'}
              variant="secondary"
              disabled={loading}
              onPress={hide}
              fullWidth
              themeColors={colors}
            />
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
