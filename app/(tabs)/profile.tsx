import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Switch, Image, Pressable, Modal, Share as NativeShare, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import {
  Camera, GraduationCap, BadgeCheck, Star, CalendarRange, BellRing,
  User as UserIcon, ShieldCheck, ShieldAlert, LogOut, ChevronRight, Palette,
  Minus, Plus, PlayCircle, Share2, Smartphone,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import Animated, { FadeInDown, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import firestore from '@react-native-firebase/firestore';
import { spacing, radius } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/lib/store/authStore';
import { useAcademicData } from '@/lib/store/useAcademicData';
import { db } from '@/lib/firebase/client';
import { signOut, reauthenticateWithGoogle, reauthenticateWithPassword } from '@/lib/firebase/auth';
import { unregisterFcmToken, registerFcmToken } from '@/lib/firebase/fcm';
import { userApi, transcriptApi } from '@/lib/api/client';
import { useThemeStore } from '@/lib/store/themeStore';
import { useThemeColors } from '@/lib/store/themeStore';
import { useToastStore } from '@/lib/store/toastStore';
import { COURSE_DURATION_OPTIONS, MAX_COURSE_DURATION, MIN_COURSE_DURATION, formatAcademicSession, formatSessionInput, graduationSession, minimumDurationForSemesters, parseAcademicSession } from '@/lib/academic/timeline';
import { TourTarget } from '@/components/tour/TourTarget';
import { useAutoTour } from '@/lib/tour/useAutoTour';
import { useTourStore } from '@/lib/store/tourStore';
import { TOUR_CHAPTERS, USAGE_TOUR_VERSION } from '@/lib/tour/chapters';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { SwipeDownHandle } from '@/components/ui/SwipeDownHandle';

interface NotificationItem { id: string; title: string; body?: string; message?: string; read: boolean; createdAt?: { toMillis?: () => number } | number; }

/**
 * REBUILT to match the inspiration reference exactly (image 9,
 * "UserProfile" panel): avatar with edit badge, name/department/level,
 * a stats row, an Institution card, an Academic Preferences list, an
 * Account & Security list, Export Transcript, Log Out. Every piece of
 * existing business logic (avatar upload → Cloudinary, notification
 * preferences → Firestore, RTDB notification feed, delete account,
 * sign-out + FCM token cleanup) is preserved exactly — only the layout
 * changed, to light theme + this structure.
 */
function useNotifications(uid?: string) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  useEffect(() => {
    if (!uid) return;
    const ref = db.collection('notifications').doc(uid).collection('items')
      .orderBy('createdAt', 'desc').limit(30);
    return ref.onSnapshot((snap) => {
      setItems(snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<NotificationItem, 'id'>) })));
    });
  }, [uid]);
  return items;
}

const CLOUDINARY_CLOUD_NAME = 'dgqukbs8n';
const CLOUDINARY_UPLOAD_PRESET = 'acadegrade_avatars';
const ANDROID_APP_DOWNLOAD_URL = 'https://acadegrade.vercel.app/app/download/android';
const IOS_APP_DOWNLOAD_URL = 'https://acadegrade.vercel.app/app/download/ios';

export default function Profile() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const profileHeaderTop = Math.max(insets.top, 24) + spacing.md;
  const router = useRouter();
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const profile = useAuthStore((s) => s.profile);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const showToast = useToastStore((s) => s.show);
  const { cgpa, totalCredits, atRiskCount, semesters, loading: academicLoading } = useAcademicData();
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notifs, setNotifs] = useState(profile?.notificationPreferences ?? { semesterSaved: true, degreeClass: true, aiInsights: true, adminBroadcasts: true });
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [timelineSheetOpen, setTimelineSheetOpen] = useState(false);
  const [timelineEntry, setTimelineEntry] = useState('');
  const [timelineDuration, setTimelineDuration] = useState(4);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [savingTimeline, setSavingTimeline] = useState(false);
  const [shareAppOpen, setShareAppOpen] = useState(false);
  const [sharePlatform, setSharePlatform] = useState<'android' | 'ios'>('android');
  const [iosDownloadAvailable, setIosDownloadAvailable] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const profileScrollY = useSharedValue(0);
  const resetTourForReplay = useTourStore((state) => state.resetForReplay);
  const startTourChapter = useTourStore((state) => state.startChapter);
  useAutoTour('settings', 650, !academicLoading);

  const onProfileScroll = useAnimatedScrollHandler((event) => {
    profileScrollY.value = event.contentOffset.y;
  });
  const avatarHeaderStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.max(profileScrollY.value / 104, 0), 1);
    const size = interpolate(progress, [0, 1], [88, 42]);
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      left: interpolate(progress, [0, 1], [(width - 88) / 2, spacing.lg]),
      top: interpolate(progress, [0, 1], [6, 4]),
    };
  });
  const largeIdentityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(profileScrollY.value, [0, 55, 88], [1, 0.35, 0]),
    transform: [{ translateY: interpolate(profileScrollY.value, [0, 88], [0, -10]) }],
  }));
  const compactIdentityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(profileScrollY.value, [45, 105], [0, 1]),
    transform: [{ translateX: interpolate(profileScrollY.value, [45, 105], [-8, 0]) }],
  }));
  const headerSurfaceStyle = useAnimatedStyle(() => ({ opacity: interpolate(profileScrollY.value, [25, 95], [0, 1]) }));

  useEffect(() => { setNotifs(profile?.notificationPreferences ?? { semesterSaved: true, degreeClass: true, aiInsights: true, adminBroadcasts: true }); }, [profile?.notificationPreferences]);

  useEffect(() => {
    return db.collection('config').doc('settings').onSnapshot((snapshot) => {
      const iosUrl = snapshot.data()?.mobileAppLinks?.iosUrl;
      setIosDownloadAvailable(typeof iosUrl === 'string' && iosUrl.trim().length > 0);
    }, () => setIosDownloadAvailable(false));
  }, []);

  const notificationItems = useNotifications(uid);
  const unreadCount = notificationItems.filter((n) => !n.read).length;

  async function updateNotifPref(key: keyof NonNullable<typeof notifs>, value: boolean) {
    if (!uid) return;
    const next = { ...notifs, [key]: value };
    setNotifs(next);
    await db.collection('users').doc(uid).update({ notificationPreferences: next });
  }

  async function toggleGradeMode() {
    if (!uid) return;
    await db.collection('users').doc(uid).update({ gradeMode: profile?.gradeMode === 'pi' ? 'cgpa' : 'pi' });
  }

  async function enablePushNotifications() {
    if (!uid) return;
    try {
      await registerFcmToken(uid);
      showToast({ type: 'success', title: 'Notifications enabled', message: 'You will receive important academic updates here.' });
    } catch (error: any) {
      const denied = String(error?.message ?? '').toLowerCase().includes('permission');
      showToast({
        type: denied ? 'warning' : 'error',
        title: denied ? 'Notifications are off' : 'Could not enable notifications',
        message: denied ? 'Allow notifications for AcadeGrade in your device settings, then try again.' : (error?.message ?? 'Please try again.'),
      });
    }
  }

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, base64: true });
    if (result.canceled || !uid) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', `data:image/jpeg;base64,${result.assets[0].base64}`);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      await db.collection('users').doc(uid).update({ avatarUrl: data.secure_url });
    } finally {
      setUploading(false);
    }
  }

  async function handleExportTranscript() {
    setExporting(true);
    try {
      const pdfBuffer = await transcriptApi.generate(true);
      const file = new File(Paths.cache, 'transcript.pdf');
      file.create({ overwrite: true });
      file.write(new Uint8Array(pdfBuffer));
      const fileUri = file.uri;
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'AcadeGrade Transcript' });
      }
    } catch (e: any) {
      showToast({ type: 'error', title: 'Export failed', message: e.message ?? 'Could not generate transcript.' });
    } finally {
      setExporting(false);
    }
  }

  async function handleLogout() {
    try {
      if (uid) await unregisterFcmToken(uid);
    } catch {
      // Signing out must still work if token cleanup is unavailable offline.
    } finally {
      await signOut();
    }
  }

  function handleDeleteAccount() {
    setDeletePassword('');
    setDeleteError(null);
    setDeleteSheetOpen(true);
  }

  function openTimelineSettings() {
    setTimelineEntry(profile?.entrySession || profile?.currentSession || '');
    setTimelineDuration(profile?.courseDuration ?? Math.max(4, minimumDurationForSemesters(semesters)));
    setTimelineError(null);
    setTimelineSheetOpen(true);
  }

  async function saveTimeline() {
    if (!uid) return;
    const entryStart = parseAcademicSession(timelineEntry);
    if (entryStart == null) {
      setTimelineError('Use consecutive years in YYYY/YYYY format, for example 2022/2023.');
      return;
    }
    const minimumDuration = Math.max(
      minimumDurationForSemesters(semesters),
      Math.ceil((Number(profile?.currentLevel) || 100) / 100),
    );
    if (timelineDuration < minimumDuration) {
      setTimelineError(`Your existing level/results require at least ${minimumDuration} years.`);
      return;
    }

    setSavingTimeline(true);
    setTimelineError(null);
    try {
      const batch = db.batch();
      batch.update(db.collection('users').doc(uid), {
        entrySession: timelineEntry,
        currentSession: timelineEntry,
        courseDuration: timelineDuration,
        graduationSession: graduationSession(timelineEntry, timelineDuration),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      semesters.forEach((semester) => {
        const yearOffset = Math.max(0, Math.floor(Number(semester.level) / 100) - 1);
        batch.update(
          db.collection('users').doc(uid).collection('semesters').doc(semester.id),
          { session: formatAcademicSession(entryStart + yearOffset), updatedAt: firestore.FieldValue.serverTimestamp() },
        );
      });
      await batch.commit();
      setTimelineSheetOpen(false);
      showToast({ type: 'success', title: 'Academic timeline updated', message: `Graduation session is now ${graduationSession(timelineEntry, timelineDuration)}.` });
    } catch (error: any) {
      setTimelineError(error?.message ?? 'Could not update your academic timeline.');
    } finally {
      setSavingTimeline(false);
    }
  }

  async function replayAppTour() {
    if (!uid) return;
    await db.collection('users').doc(uid).set({
      mobileUsageTourVersion: USAGE_TOUR_VERSION,
      mobileUsageTourCompletedChapters: [],
      mobileUsageTourSkipped: false,
      mobileUsageTourCompleted: false,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    resetTourForReplay();
    router.replace('/(tabs)/dashboard');
    setTimeout(() => startTourChapter(TOUR_CHAPTERS.dashboard, true), 450);
  }

  function openShareApp() {
    setSharePlatform('android');
    setShareAppOpen(true);
  }

  const selectedDownloadUrl = sharePlatform === 'android' ? ANDROID_APP_DOWNLOAD_URL : IOS_APP_DOWNLOAD_URL;
  const selectedPlatformAvailable = sharePlatform === 'android' || iosDownloadAvailable;

  async function shareSelectedAppLink() {
    if (!selectedPlatformAvailable) return;
    try {
      await NativeShare.share({
        title: 'AcadeGrade mobile app',
        message: `Track your grades with AcadeGrade. Download the ${sharePlatform === 'android' ? 'Android' : 'iOS'} app: ${selectedDownloadUrl}`,
        url: selectedDownloadUrl,
      });
    } catch (error: any) {
      showToast({ type: 'error', title: 'Could not open share', message: error?.message ?? 'Please try again.' });
    }
  }

  async function confirmDeleteAccount() {
    setDeleteError(null);
    setDeleting(true);
    try {
      const isGoogle = firebaseUser?.providerData.some((provider) => provider.providerId === 'google.com');
      if (isGoogle) await reauthenticateWithGoogle();
      else await reauthenticateWithPassword(deletePassword);
      await userApi.deleteAccount();
      setDeleteSheetOpen(false);
      await signOut();
    } catch (e: any) {
      setDeleteError(e?.message ?? 'Please verify your credentials and try again.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.void }}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: profileHeaderTop + 72, backgroundColor: c.void, borderBottomWidth: 1, borderBottomColor: c.borderSubtle, zIndex: 4 }, headerSurfaceStyle]} />
      <TourTarget tourId="settings-profile" style={{ position: 'absolute', top: profileHeaderTop, left: 0, right: 0, height: 176, zIndex: 5 }}>
        <Animated.View style={[{ position: 'absolute', overflow: 'visible' }, avatarHeaderStyle]}>
          <Pressable onPress={pickAvatar} style={{ flex: 1 }} accessibilityLabel="Change profile picture">
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 999 }} />
            ) : (
              <View style={{ flex: 1, borderRadius: 999, backgroundColor: c.primaryDim, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: c.primary, fontSize: 22, fontWeight: '800' }}>{profile?.fullName?.[0] ?? '?'}</Text>
              </View>
            )}
            <View style={{ position: 'absolute', bottom: -2, right: -2, width: 27, height: 27, borderRadius: 14, backgroundColor: c.primaryHover, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.void }}>
              {uploading ? <Text style={{ color: '#fff', fontSize: 10 }}>…</Text> : <Camera size={13} color="#fff" />}
            </View>
          </Pressable>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 116, left: 0, right: 0, alignItems: 'center' }, largeIdentityStyle]}>
          <Text style={{ color: c.text, fontSize: 19, fontWeight: '800' }}>{profile?.fullName}</Text>
          <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 2 }}>{profile?.department} · {profile?.currentLevel} Level</Text>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 70, right: spacing.lg, top: 18 }, compactIdentityStyle]}>
          <Text style={{ color: c.text, fontSize: 15, fontWeight: '900' }} numberOfLines={1}>{profile?.fullName}</Text>
          <Text style={{ color: c.textMuted, fontSize: 10, marginTop: 1 }} numberOfLines={1}>{profile?.department} · {profile?.currentLevel} Level</Text>
        </Animated.View>
      </TourTarget>
      <Animated.ScrollView ref={scrollRef as any} onScroll={onProfileScroll} scrollEventThrottle={16} contentContainerStyle={{ padding: spacing.lg, paddingTop: profileHeaderTop + 176, paddingBottom: 120 }}>
        {/* AVATAR + IDENTITY */}
        <Animated.View entering={FadeInDown.duration(300)} style={{ display: 'none', alignItems: 'center', marginBottom: spacing.lg }}>
          <TourTarget tourId="settings-profile-legacy" onTourFocus={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} style={{ alignItems: 'center' }}>
          <Pressable onPress={pickAvatar} style={{ marginBottom: spacing.sm }}>
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={{ width: 88, height: 88, borderRadius: 44 }} />
            ) : (
              <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: c.primaryDim, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: c.primary, fontSize: 30, fontWeight: '800' }}>{profile?.fullName?.[0] ?? '?'}</Text>
              </View>
            )}
            <View style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: c.primaryHover, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.void }}>
              {uploading ? <Text style={{ color: '#fff', fontSize: 10 }}>…</Text> : <Camera size={13} color="#fff" />}
            </View>
          </Pressable>
          <Text style={{ color: c.text, fontSize: 19, fontWeight: '800' }}>{profile?.fullName}</Text>
          <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 2 }}>{profile?.department} · {profile?.currentLevel} Level</Text>
          </TourTarget>
        </Animated.View>

        {/* STATS ROW */}
        {academicLoading ? (
          <SkeletonPulse accessibilityLabel="Loading academic totals" style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
            <SkeletonBlock flex={1} height={70} />
            <SkeletonBlock flex={1} height={70} />
            <SkeletonBlock flex={1} height={70} />
          </SkeletonPulse>
        ) : (
          <Animated.View entering={FadeInDown.delay(60).duration(300)} style={{ flexDirection: 'row', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }}>
            <StatCell value={cgpa.toFixed(2)} label="Current GPA" />
            <Divider />
            <StatCell value={String(totalCredits)} label="Credits" />
            <Divider />
            <StatCell value={String(atRiskCount)} label="At Risk" danger={atRiskCount > 0} />
          </Animated.View>
        )}

        {/* INSTITUTION */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={{ marginBottom: spacing.lg }}>
          <SectionLabel label="Institution" />
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md }}>
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: c.primaryDim, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
              <GraduationCap size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{profile?.university}</Text>
              <Text style={{ color: c.textFaint, fontSize: 11 }}>{profile?.programme}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.successDim, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
              <BadgeCheck size={12} color={c.success} />
              <Text style={{ color: c.success, fontSize: 10, fontWeight: '700' }}>Verified</Text>
            </View>
          </View>
        </Animated.View>

        {/* ACADEMIC PREFERENCES */}
        <TourTarget tourId="settings-academic" onTourFocus={() => scrollRef.current?.scrollTo({ y: 300, animated: true })}>
        <Animated.View entering={FadeInDown.delay(140).duration(300)} style={{ marginBottom: spacing.lg }}>
          <SectionLabel label="Academic Preferences" />
          <View style={{ gap: 8 }}>
            <ListRow icon={<Star size={16} color={c.gold} />} title="Primary Metric" subtitle={profile?.gradeMode === 'pi' ? 'True Mastery (PI)' : 'CGPA (4.0 Scale)'} onPress={toggleGradeMode} />
            <ListRow icon={<Palette size={16} color={c.primary} />} title="Appearance" subtitle={themeMode === 'system' ? 'System default' : themeMode === 'dark' ? 'Dark mode' : 'Light mode'} onPress={() => setThemeSheetOpen(true)} />
            <ListRow icon={<CalendarRange size={16} color={c.primary} />} title="Academic Timeline" subtitle={`${profile?.courseDuration ?? 4} years · ${profile?.entrySession || profile?.currentSession || 'Set entry session'} → ${profile?.graduationSession || graduationSession(profile?.entrySession || profile?.currentSession || '', profile?.courseDuration ?? 4) || 'Set graduation'}`} onPress={openTimelineSettings} />
            <TourTarget tourId="settings-replay" onTourFocus={() => scrollRef.current?.scrollTo({ y: 430, animated: true })}>
              <ListRow icon={<PlayCircle size={16} color={c.primary} />} title="Replay Usage Guide" subtitle="Restart every contextual screen guide" onPress={replayAppTour} />
            </TourTarget>
            <ListRow icon={<BellRing size={16} color={c.primary} />} title="Push Notifications" subtitle="Manage alerts on this device" onPress={enablePushNotifications} />
            <ListRow icon={<Share2 size={16} color={c.primary} />} title="Share AcadeGrade" subtitle="Show a download QR code or send the app link" onPress={openShareApp} />
            <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md }}>
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 13, marginBottom: spacing.sm }}>
                <BellRing size={13} color={c.primary} /> Grade Alerts
              </Text>
              <NotifRow label="Semester saved" value={!!notifs.semesterSaved} onChange={(v) => updateNotifPref('semesterSaved', v)} />
              <NotifRow label="Degree class change" value={!!notifs.degreeClass} onChange={(v) => updateNotifPref('degreeClass', v)} />
              <NotifRow label="AI insights ready" value={!!notifs.aiInsights} onChange={(v) => updateNotifPref('aiInsights', v)} />
              <NotifRow label="Admin broadcasts" value={!!notifs.adminBroadcasts} onChange={(v) => updateNotifPref('adminBroadcasts', v)} last />
            </View>
          </View>
        </Animated.View>
        </TourTarget>

        {/* ACCOUNT & SECURITY */}
        <TourTarget tourId="settings-account" onTourFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        <Animated.View entering={FadeInDown.delay(180).duration(300)} style={{ marginBottom: spacing.lg }}>
          <SectionLabel label="Account & Security" />
          <View style={{ gap: 8 }}>
            <ListRow icon={<UserIcon size={16} color={c.primary} />} title="Personal Info" subtitle={profile?.email} />
            <ListRow icon={<ShieldCheck size={16} color={c.danger} />} title="Delete Account" subtitle="Permanently erase your data" onPress={handleDeleteAccount} danger />
          </View>
        </Animated.View>

        <Button
          label={exporting ? 'Exporting…' : 'Export Academic Transcript'}
          variant="secondary"
          onPress={handleExportTranscript}
          loading={exporting}
          fullWidth
        />
        <View style={{ height: spacing.md }} />
        <Pressable onPress={handleLogout} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: spacing.md }}>
          <LogOut size={16} color={c.danger} />
          <Text style={{ color: c.danger, fontWeight: '700', fontSize: 14 }}>Log Out</Text>
        </Pressable>
        </TourTarget>

        {unreadCount > 0 && (
          <Text style={{ color: c.textFaint, fontSize: 11, textAlign: 'center', marginTop: spacing.sm }}>
            {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
          </Text>
        )}
      </Animated.ScrollView>

      <Modal visible={themeSheetOpen} transparent animationType="fade" onRequestClose={() => setThemeSheetOpen(false)}>
        <Pressable onPress={() => setThemeSheetOpen(false)} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,9,15,0.55)' }}>
          <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xxl }}>
            <SwipeDownHandle onDismiss={() => setThemeSheetOpen(false)} color={c.border} style={{ marginBottom: spacing.sm }} />
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 4 }}>Appearance</Text>
            <Text style={{ color: c.textMuted, fontSize: 13, marginBottom: spacing.lg }}>Choose how AcadeGrade looks on this device.</Text>
            {(['light', 'dark', 'system'] as const).map((mode) => (
              <Pressable key={mode} onPress={() => { setThemeMode(mode); setThemeSheetOpen(false); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: c.borderSubtle }}>
                <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }}>{mode === 'system' ? 'System default' : mode === 'dark' ? 'Dark mode' : 'Light mode'}</Text>
                {themeMode === mode && <BadgeCheck size={18} color={c.primary} />}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={shareAppOpen} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setShareAppOpen(false)}>
        <Pressable onPress={() => setShareAppOpen(false)} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,4,12,0.72)' }}>
          <Animated.View entering={FadeInDown.springify().damping(21)}>
            <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: c.deep, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: c.border, padding: spacing.lg, paddingBottom: Math.max(spacing.xl, insets.bottom + spacing.md) }}>
              <SwipeDownHandle onDismiss={() => setShareAppOpen(false)} color={c.border} style={{ marginBottom: spacing.lg }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
                <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: c.primaryDim, alignItems: 'center', justifyContent: 'center' }}><Share2 size={21} color={c.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 19, fontWeight: '900' }}>Share AcadeGrade</Text>
                  <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 3 }}>Choose a platform, then scan or share its secure download link.</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
                <SharePlatformChip label="Android" selected={sharePlatform === 'android'} onPress={() => setSharePlatform('android')} colors={c} />
                <SharePlatformChip label="iOS" selected={sharePlatform === 'ios'} onPress={() => setSharePlatform('ios')} unavailable={!iosDownloadAvailable} colors={c} />
              </View>

              {selectedPlatformAvailable ? (
                <View style={{ alignItems: 'center' }}>
                  <View style={{ padding: 12, borderRadius: 18, backgroundColor: '#FFFFFF', marginBottom: spacing.md }}>
                    <QRCode value={selectedDownloadUrl} size={172} color="#10131E" backgroundColor="#FFFFFF" />
                  </View>
                  <Text style={{ color: c.text, fontSize: 14, fontWeight: '800' }}>Scan to download for {sharePlatform === 'android' ? 'Android' : 'iOS'}</Text>
                  <Text style={{ color: c.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 4, marginBottom: spacing.lg }}>The QR code uses AcadeGrade’s branded download page, so future releases stay up to date.</Text>
                  <Button label={`Share ${sharePlatform === 'android' ? 'Android' : 'iOS'} link`} onPress={shareSelectedAppLink} fullWidth themeColors={c} />
                </View>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: spacing.xl, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border }}>
                  <Smartphone size={28} color={c.textFaint} />
                  <Text style={{ color: c.text, fontSize: 15, fontWeight: '800', marginTop: spacing.sm }}>iOS is coming soon</Text>
                  <Text style={{ color: c.textMuted, fontSize: 11, textAlign: 'center', marginTop: 4, paddingHorizontal: spacing.xl }}>We will enable the iOS QR code as soon as the App Store download URL is available.</Text>
                </View>
              )}
              <View style={{ height: spacing.sm }} />
              <Button label="Close" variant="secondary" onPress={() => setShareAppOpen(false)} fullWidth themeColors={c} />
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <Modal visible={timelineSheetOpen} transparent statusBarTranslucent animationType="fade" onRequestClose={() => { if (!savingTimeline) setTimelineSheetOpen(false); }}>
        <Pressable disabled={savingTimeline} onPress={() => setTimelineSheetOpen(false)} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,4,12,0.72)' }}>
          <Animated.View entering={FadeInDown.springify().damping(21)}>
            <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: c.deep, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: c.border, padding: spacing.lg, paddingBottom: Math.max(spacing.xl, insets.bottom + spacing.md) }}>
              <SwipeDownHandle onDismiss={() => setTimelineSheetOpen(false)} disabled={savingTimeline} color={c.border} style={{ marginBottom: spacing.lg }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
                <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: c.primaryDim, alignItems: 'center', justifyContent: 'center' }}><CalendarRange size={22} color={c.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 19, fontWeight: '900' }}>Academic timeline</Text>
                  <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 3 }}>Correct your entry year or programme length.</Text>
                </View>
              </View>

              <Input label="Entry session" placeholder="2022/2023" value={timelineEntry} onChangeText={(value) => setTimelineEntry(formatSessionInput(value))} maxLength={9} keyboardType="number-pad" themeColors={c} />

              <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm }}>Programme duration</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm }}>
                <Pressable accessibilityLabel="Reduce duration" onPress={() => setTimelineDuration((value) => Math.max(MIN_COURSE_DURATION, value - 1))} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: c.overlay, alignItems: 'center', justifyContent: 'center' }}><Minus size={18} color={c.text} /></Pressable>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: c.text, fontSize: 24, fontWeight: '900' }}>{timelineDuration}</Text>
                  <Text style={{ color: c.textMuted, fontSize: 10 }}>years · {timelineDuration * 2} semesters</Text>
                </View>
                <Pressable accessibilityLabel="Increase duration" onPress={() => setTimelineDuration((value) => Math.min(MAX_COURSE_DURATION, value + 1))} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: c.primaryDim, alignItems: 'center', justifyContent: 'center' }}><Plus size={18} color={c.primary} /></Pressable>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 3, marginBottom: spacing.md }}>
                {COURSE_DURATION_OPTIONS.map((duration) => (
                  <Pressable key={duration} onPress={() => setTimelineDuration(duration)} style={{ minWidth: 52, paddingHorizontal: 10, paddingVertical: 9, alignItems: 'center', borderRadius: 10, backgroundColor: timelineDuration === duration ? c.primaryDim : c.surface, borderWidth: 1, borderColor: timelineDuration === duration ? c.primary : c.border }}>
                    <Text style={{ color: timelineDuration === duration ? c.primary : c.textMuted, fontSize: 11, fontWeight: '800' }}>{duration} yrs</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {parseAcademicSession(timelineEntry) != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.primaryDim, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
                  <View><Text style={{ color: c.textMuted, fontSize: 10 }}>EXPECTED GRADUATION</Text><Text style={{ color: c.text, fontWeight: '900', marginTop: 3 }}>{graduationSession(timelineEntry, timelineDuration)}</Text></View>
                  <GraduationCap size={23} color={c.primary} />
                </View>
              )}

              {!!timelineError && <View accessibilityRole="alert" style={{ backgroundColor: c.dangerDim, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}><Text style={{ color: c.text, fontSize: 12, lineHeight: 18, fontWeight: '700' }}>{timelineError}</Text></View>}

              <Button label="Save academic timeline" onPress={saveTimeline} loading={savingTimeline} fullWidth themeColors={c} />
              <View style={{ height: spacing.sm }} />
              <Button label="Cancel" variant="secondary" disabled={savingTimeline} onPress={() => setTimelineSheetOpen(false)} fullWidth themeColors={c} />
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <Modal visible={deleteSheetOpen} transparent statusBarTranslucent animationType="fade" onRequestClose={() => { if (!deleting) setDeleteSheetOpen(false); }}>
        <Pressable disabled={deleting} onPress={() => setDeleteSheetOpen(false)} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,4,12,0.76)' }}>
          <Animated.View entering={FadeInDown.springify().damping(21)}>
          <Pressable
            accessibilityRole="alert"
            onPress={(event) => event.stopPropagation()}
            style={{
              backgroundColor: c.deep,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderColor: c.border,
              padding: spacing.lg,
              paddingBottom: Math.max(spacing.xl, insets.bottom + spacing.md),
            }}
          >
            <SwipeDownHandle onDismiss={() => setDeleteSheetOpen(false)} disabled={deleting} color={c.border} style={{ marginBottom: spacing.lg }} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg }}>
              <View style={{ width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: c.dangerDim, borderWidth: 1, borderColor: `${c.danger}42` }}>
                <ShieldAlert size={23} color={c.danger} />
              </View>
              <View style={{ flex: 1, paddingTop: 2 }}>
                <Text style={{ color: c.text, fontSize: 19, lineHeight: 25, fontWeight: '900' }}>Delete your account?</Text>
                <Text style={{ color: c.textMuted, fontSize: 13, lineHeight: 19, marginTop: 5 }}>Your semesters, courses, transcript data, and account will be permanently erased.</Text>
              </View>
            </View>
            {firebaseUser?.providerData.some((provider) => provider.providerId === 'google.com') ? (
              <View style={{ backgroundColor: c.overlay, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
                <Text style={{ color: c.text, fontSize: 13, fontWeight: '700' }}>Identity check required</Text>
                <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 18, marginTop: 3 }}>Google will ask you to sign in again before deletion.</Text>
              </View>
            ) : (
              <Input label="Your password" value={deletePassword} onChangeText={setDeletePassword} secureTextEntry themeColors={c} />
            )}
            {!!deleteError && (
              <View accessibilityRole="alert" style={{ backgroundColor: c.dangerDim, borderRadius: radius.md, borderWidth: 1, borderColor: `${c.danger}55`, padding: spacing.md, marginBottom: spacing.md }}>
                <Text style={{ color: c.text, fontSize: 12, lineHeight: 18, fontWeight: '700' }}>{deleteError}</Text>
              </View>
            )}
            <Button label="Delete everything" variant="danger" loading={deleting} disabled={!firebaseUser?.providerData.some((provider) => provider.providerId === 'google.com') && !deletePassword} onPress={confirmDeleteAccount} fullWidth themeColors={c} />
            <View style={{ height: spacing.sm }} />
            <Button label="Keep my account" variant="secondary" disabled={deleting} onPress={() => setDeleteSheetOpen(false)} fullWidth themeColors={c} />
          </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function SectionLabel({ label }: { label: string }) {
  const c = useThemeColors();
  return <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm }}>{label}</Text>;
}

function StatCell({ value, label, danger }: { value: string; label: string; danger?: boolean }) {
  const c = useThemeColors();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: danger ? c.danger : c.text, fontSize: 18, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: c.textFaint, fontSize: 10, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Divider() {
  const c = useThemeColors();
  return <View style={{ width: 1, backgroundColor: c.border, marginVertical: 4 }} />;
}

function ListRow({ icon, title, subtitle, onPress, danger }: { icon: React.ReactNode; title: string; subtitle?: string; onPress?: () => void; danger?: boolean }) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: c.overlay, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? c.danger : c.text, fontWeight: '700', fontSize: 13 }}>{title}</Text>
        {subtitle && <Text style={{ color: c.textFaint, fontSize: 11, marginTop: 1 }} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {onPress && <ChevronRight size={16} color={c.textFaint} />}
    </Pressable>
  );
}

function SharePlatformChip({ label, selected, unavailable, onPress, colors }: { label: string; selected: boolean; unavailable?: boolean; onPress: () => void; colors: ReturnType<typeof useThemeColors> }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, minHeight: 48, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: selected ? colors.primaryHover : colors.surface, borderWidth: 1, borderColor: selected ? colors.primaryGlow : colors.border }}>
      <Text style={{ color: selected ? '#FFFFFF' : colors.text, fontSize: 13, fontWeight: '800' }}>{label}</Text>
      {unavailable && <Text style={{ color: selected ? 'rgba(255,255,255,0.78)' : colors.textFaint, fontSize: 9, marginTop: 2 }}>Coming soon</Text>}
    </Pressable>
  );
}

function NotifRow({ label, value, onChange, last }: { label: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  const c = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.borderSubtle }}>
      <Text style={{ color: c.textMuted, fontSize: 13 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.primary, false: c.border }} thumbColor="#FFFFFF" />
    </View>
  );
}
