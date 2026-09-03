import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Camera, FileUp, HelpCircle, ImageIcon, RotateCcw, Sparkles, X } from 'lucide-react-native';
import { radius, spacing } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { useThemeColors } from '@/lib/store/themeStore';
import { useToastStore } from '@/lib/store/toastStore';
import type { CourseInput } from '@/types/course';
import { TourTarget } from '@/components/tour/TourTarget';
import { useAutoTour } from '@/lib/tour/useAutoTour';

interface ResultScannerModalProps {
  visible: boolean;
  loading: boolean;
  error: string | null;
  courses: CourseInput[] | null;
  saving?: boolean;
  onClose: () => void;
  onCapture: (base64: string, mimeType: string) => Promise<void>;
  onGallery: () => Promise<void>;
  onDocument: () => Promise<void>;
  onConfirm: () => Promise<void>;
  onReset: () => void;
  onManual: () => void;
}

export function ResultScannerModal({
  visible,
  loading,
  error,
  courses,
  saving,
  onClose,
  onCapture,
  onGallery,
  onDocument,
  onConfirm,
  onReset,
  onManual,
}: ResultScannerModalProps) {
  const colors = useThemeColors();
  const showToast = useToastStore((state) => state.show);
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const scanProgress = useSharedValue(0);
  useAutoTour('scanner', 700, visible);

  useEffect(() => {
    if (!visible) {
      setPreviewUri(null);
      setCapturing(false);
      scanProgress.value = 0;
      return;
    }
    scanProgress.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [scanProgress, visible]);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanProgress.value * 214 }],
    opacity: loading ? 1 : 0.72,
  }));

  async function capture() {
    if (!cameraRef.current || capturing || loading) return;
    setCapturing(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.78, base64: true });
      if (!picture?.base64) throw new Error('The camera did not return an image. Please try again.');
      setPreviewUri(picture.uri);
      await onCapture(picture.base64, 'image/jpeg');
    } catch (error: any) {
      setPreviewUri(null);
      showToast({ type: 'error', title: 'Camera capture failed', message: error?.message ?? 'Please try again or choose a file instead.' });
    } finally {
      setCapturing(false);
    }
  }

  async function requestCameraAccess() {
    try {
      const nextPermission = await requestPermission();
      if (!nextPermission.granted) {
        showToast({ type: 'warning', title: 'Camera access is needed', message: 'Allow camera access to scan a printed result.' });
      }
    } catch (error: any) {
      showToast({ type: 'error', title: 'Could not request camera access', message: error?.message ?? 'Please try again.' });
    }
  }

  function reset() {
    setPreviewUri(null);
    onReset();
  }

  const hasResults = !!courses?.length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
        <View
          style={{
            minHeight: 64,
            paddingHorizontal: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSubtle,
            backgroundColor: colors.deep,
          }}
        >
          <Pressable accessibilityLabel="Close scanner" onPress={onClose} hitSlop={10}>
            <X size={22} color={colors.text} />
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', flex: 1, textAlign: 'center' }}>
            AI Result Import
          </Text>
          <HelpCircle size={19} color={colors.textMuted} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
          showsVerticalScrollIndicator={false}
        >
          {!hasResults && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: spacing.sm, marginBottom: spacing.md, borderRadius: 12, backgroundColor: colors.primaryDim, borderWidth: 1, borderColor: `${colors.primary}35` }}>
              <Sparkles size={14} color={colors.primary} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, color: colors.textMuted, fontSize: 10, lineHeight: 15, marginLeft: 8 }}>
                AI scanning allows 5 result files per 15 minutes and 20 per day. Retakes only count after a file is submitted for analysis.
              </Text>
            </View>
          )}
          {!hasResults && (
            <TourTarget tourId="scanner-frame">
            <View
              style={{
                height: 276,
                borderRadius: radius.xl,
                overflow: 'hidden',
                backgroundColor: colors.deep,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {previewUri ? (
                <Image source={{ uri: previewUri }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
              ) : permission?.granted ? (
                <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" mode="picture" />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
                  <Camera size={32} color={colors.primary} />
                  <Text style={{ color: colors.text, fontWeight: '800', marginTop: spacing.md }}>Camera access is required</Text>
                  <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: 12, marginTop: 6, marginBottom: spacing.md }}>
                    Your photo is sent securely for course extraction and is not saved automatically.
                  </Text>
                  <Button label="Enable Camera" onPress={requestCameraAccess} themeColors={colors} />
                </View>
              )}

              {(permission?.granted || previewUri) && (
                <View style={{ position: 'absolute', inset: 18 }} pointerEvents="none">
                  <ScannerCorner top left color={colors.primaryGlow} />
                  <ScannerCorner top right color={colors.primaryGlow} />
                  <ScannerCorner bottom left color={colors.primaryGlow} />
                  <ScannerCorner bottom right color={colors.primaryGlow} />
                  <Animated.View
                    style={[
                      scanLineStyle,
                      {
                        position: 'absolute',
                        left: 4,
                        right: 4,
                        top: 4,
                        height: 2,
                        borderRadius: 2,
                        backgroundColor: colors.primaryGlow,
                        shadowColor: colors.primary,
                        shadowOpacity: 0.95,
                        shadowRadius: 12,
                      },
                    ]}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      top: 84,
                      alignSelf: 'center',
                      backgroundColor: 'rgba(7,9,15,0.72)',
                      borderRadius: radius.pill,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                      {loading ? 'Reading courses and scores…' : 'Align the result slip within the frame'}
                    </Text>
                  </View>
                </View>
              )}

              {permission?.granted && !previewUri && !loading && (
                <Pressable
                  accessibilityLabel="Capture result slip"
                  onPress={capture}
                  disabled={capturing}
                  style={{
                    position: 'absolute',
                    bottom: 18,
                    alignSelf: 'center',
                    width: 62,
                    height: 62,
                    borderRadius: 31,
                    borderWidth: 4,
                    borderColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255,255,255,0.22)',
                  }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF' }} />
                </Pressable>
              )}
            </View>
            </TourTarget>
          )}

          {loading && (
            <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: spacing.lg }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                  paddingVertical: 13,
                  borderRadius: radius.pill,
                  backgroundColor: colors.primaryDim,
                }}
              >
                <ActivityIndicator size="small" color={colors.primaryGlow} />
                <Text style={{ color: colors.primaryGlow, fontWeight: '700', fontSize: 13 }}>AI analysis in progress</Text>
              </View>
              {[0.82, 0.96, 0.74].map((width, index) => (
                <View
                  key={index}
                  style={{
                    height: 52,
                    width: `${width * 100}%`,
                    marginTop: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: colors.overlay,
                    borderWidth: 1,
                    borderColor: colors.borderSubtle,
                  }}
                />
              ))}
            </Animated.View>
          )}

          {!!error && !loading && !hasResults && (
            <View style={{ marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.dangerDim }}>
              <Text style={{ color: colors.danger, fontWeight: '800', marginBottom: 4 }}>We could not read that result</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>{error}</Text>
            </View>
          )}

          {hasResults && (
            <Animated.View entering={FadeIn.duration(250)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 }}>
                <Sparkles size={18} color={colors.gold} />
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>Review detected courses</Text>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: spacing.lg }}>
                Check CA and exam values before saving. AI extraction can make mistakes; incomplete rows will be marked for manual completion.
              </Text>
              {courses?.map((course, index) => {
                const total = course.caScore != null && course.examScore != null
                  ? course.caScore + course.examScore
                  : null;
                return (
                  <View
                    key={`${course.code}-${index}`}
                    style={{
                      padding: spacing.md,
                      marginBottom: spacing.sm,
                      borderRadius: radius.md,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>{course.code}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{course.title}</Text>
                      {!course.isAR && (
                        <Text style={{ color: colors.textFaint, fontSize: 10, marginTop: 4 }}>
                          CA {course.caScore ?? '—'}/30 · Exam {course.examScore ?? '—'}/70
                        </Text>
                      )}
                    </View>
                    <Text style={{ color: colors.textFaint, fontSize: 11, marginRight: spacing.md }}>{course.units} CR</Text>
                    <Text style={{ color: colors.primaryGlow, fontSize: 14, fontWeight: '800' }}>
                      {course.isAR ? 'AR' : total != null ? `${total}%` : 'ADD SCORE'}
                    </Text>
                  </View>
                );
              })}
            </Animated.View>
          )}

          {!loading && !hasResults && (
            <TourTarget tourId="scanner-sources" style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              <SourceButton icon={<ImageIcon size={17} color={colors.primary} />} label="Gallery" onPress={onGallery} />
              <SourceButton icon={<FileUp size={17} color={colors.primary} />} label="Document" onPress={onDocument} />
              {!!previewUri && <SourceButton icon={<RotateCcw size={17} color={colors.primary} />} label="Retake" onPress={reset} />}
            </TourTarget>
          )}
        </ScrollView>

        <TourTarget
          tourId="scanner-footer"
          style={{
            padding: spacing.lg,
            paddingBottom: spacing.xl,
            backgroundColor: colors.deep,
            borderTopWidth: 1,
            borderTopColor: colors.borderSubtle,
          }}
        >
          {hasResults ? (
            <>
              <Button
                label={`Confirm & Save ${courses?.length ?? 0} Courses`}
                onPress={onConfirm}
                loading={saving}
                fullWidth
                themeColors={colors}
              />
              <Pressable onPress={reset} style={{ alignItems: 'center', paddingTop: spacing.md }}>
                <Text style={{ color: colors.textMuted, fontWeight: '700', fontSize: 12 }}>Scan again</Text>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={onManual} style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
              <Text style={{ color: colors.primaryGlow, fontWeight: '700', fontSize: 12 }}>Enter details manually</Text>
            </Pressable>
          )}
        </TourTarget>
      </SafeAreaView>
    </Modal>
  );
}

function ScannerCorner({ top, bottom, left, right, color }: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean; color: string }) {
  return (
    <View
      style={{
        position: 'absolute',
        top: top ? 0 : undefined,
        bottom: bottom ? 0 : undefined,
        left: left ? 0 : undefined,
        right: right ? 0 : undefined,
        width: 34,
        height: 34,
        borderTopWidth: top ? 3 : 0,
        borderBottomWidth: bottom ? 3 : 0,
        borderLeftWidth: left ? 3 : 0,
        borderRightWidth: right ? 3 : 0,
        borderColor: color,
        borderRadius: 5,
      }}
    />
  );
}

function SourceButton({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 66,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {icon}
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
