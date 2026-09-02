import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, Image, Pressable, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import {
  Camera, GraduationCap, BadgeCheck, Star, CalendarDays, BellRing,
  User as UserIcon, ShieldCheck, ShieldAlert, LogOut, ChevronRight, Palette,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { spacing, radius } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/lib/store/authStore';
import { useAcademicData } from '@/lib/store/useAcademicData';
import { db } from '@/lib/firebase/client';
import { signOut, reauthenticateWithGoogle, reauthenticateWithPassword } from '@/lib/firebase/auth';
import { unregisterFcmToken, requestNotificationPermission, registerFcmToken } from '@/lib/firebase/fcm';
import { userApi, transcriptApi } from '@/lib/api/client';
import { useThemeStore } from '@/lib/store/themeStore';
import { useThemeColors } from '@/lib/store/themeStore';
import { useToastStore } from '@/lib/store/toastStore';

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

export default function Profile() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const profile = useAuthStore((s) => s.profile);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const showToast = useToastStore((s) => s.show);
  const { cgpa, totalCredits, atRiskCount } = useAcademicData();
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notifs, setNotifs] = useState(profile?.notificationPreferences ?? { semesterSaved: true, degreeClass: true, aiInsights: true, adminBroadcasts: true });
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { setNotifs(profile?.notificationPreferences ?? { semesterSaved: true, degreeClass: true, aiInsights: true, adminBroadcasts: true }); }, [profile?.notificationPreferences]);

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
    const granted = await requestNotificationPermission();
    if (granted) {
      await registerFcmToken(uid);
      showToast({ type: 'success', title: 'Notifications enabled', message: 'You will receive important academic updates here.' });
    } else {
      showToast({ type: 'warning', title: 'Notifications are off', message: 'Enable notifications for AcadeGrade in your device settings to receive updates.' });
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
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {/* AVATAR + IDENTITY */}
        <Animated.View entering={FadeInDown.duration(300)} style={{ alignItems: 'center', marginBottom: spacing.lg }}>
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
        </Animated.View>

        {/* STATS ROW */}
        <Animated.View entering={FadeInDown.delay(60).duration(300)} style={{ flexDirection: 'row', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }}>
          <StatCell value={cgpa.toFixed(2)} label="Current GPA" />
          <Divider />
          <StatCell value={String(totalCredits)} label="Credits" />
          <Divider />
          <StatCell value={String(atRiskCount)} label="At Risk" danger={atRiskCount > 0} />
        </Animated.View>

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
        <Animated.View entering={FadeInDown.delay(140).duration(300)} style={{ marginBottom: spacing.lg }}>
          <SectionLabel label="Academic Preferences" />
          <View style={{ gap: 8 }}>
            <ListRow icon={<Star size={16} color={c.gold} />} title="Primary Metric" subtitle={profile?.gradeMode === 'pi' ? 'True Mastery (PI)' : 'CGPA (4.0 Scale)'} onPress={toggleGradeMode} />
            <ListRow icon={<Palette size={16} color={c.primary} />} title="Appearance" subtitle={themeMode === 'system' ? 'System default' : themeMode === 'dark' ? 'Dark mode' : 'Light mode'} onPress={() => setThemeSheetOpen(true)} />
            <ListRow icon={<CalendarDays size={16} color={c.primary} />} title="Current Session" subtitle={profile?.currentSession ?? '—'} />
            <ListRow icon={<BellRing size={16} color={c.primary} />} title="Push Notifications" subtitle="Manage alerts on this device" onPress={enablePushNotifications} />
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

        {/* ACCOUNT & SECURITY */}
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

        {unreadCount > 0 && (
          <Text style={{ color: c.textFaint, fontSize: 11, textAlign: 'center', marginTop: spacing.sm }}>
            {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
          </Text>
        )}
      </ScrollView>

      <Modal visible={themeSheetOpen} transparent animationType="fade" onRequestClose={() => setThemeSheetOpen(false)}>
        <Pressable onPress={() => setThemeSheetOpen(false)} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,9,15,0.55)' }}>
          <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xxl }}>
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
            <View style={{ width: 38, height: 4, borderRadius: radius.pill, backgroundColor: c.border, alignSelf: 'center', marginBottom: spacing.lg }} />
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

function NotifRow({ label, value, onChange, last }: { label: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  const c = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.borderSubtle }}>
      <Text style={{ color: c.textMuted, fontSize: 13 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.primary, false: c.border }} thumbColor="#FFFFFF" />
    </View>
  );
}
