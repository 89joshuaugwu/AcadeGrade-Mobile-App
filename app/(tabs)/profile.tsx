import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, Image, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import database from '@react-native-firebase/database';
import {
  Camera, GraduationCap, BadgeCheck, Star, CalendarDays, BellRing,
  User as UserIcon, ShieldCheck, FileDown, LogOut, ChevronRight,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { spacing, radius, lightColors as c } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store/authStore';
import { useAcademicData } from '@/lib/store/useAcademicData';
import { db } from '@/lib/firebase/client';
import { signOut } from '@/lib/firebase/auth';
import { unregisterFcmToken } from '@/lib/firebase/fcm';
import { userApi, transcriptApi } from '@/lib/api/client';

interface NotificationItem { id: string; title: string; body: string; read: boolean; createdAt: number; }

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
    const ref = database().ref(`notifications/${uid}`).orderByChild('createdAt').limitToLast(30);
    const onValue = ref.on('value', (snap) => {
      const val = snap.val() ?? {};
      const list = Object.entries(val).map(([id, v]: [string, any]) => ({ id, ...v })) as NotificationItem[];
      setItems(list.sort((a, b) => b.createdAt - a.createdAt));
    });
    return () => ref.off('value', onValue);
  }, [uid]);
  return items;
}

const CLOUDINARY_CLOUD_NAME = 'dgqukbs8n';
const CLOUDINARY_UPLOAD_PRESET = 'acadegrade_avatars';

export default function Profile() {
  const profile = useAuthStore((s) => s.profile);
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const { cgpa, totalCredits, atRiskCount } = useAcademicData();
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notifs, setNotifs] = useState(profile?.notificationPreferences ?? {});

  useEffect(() => { setNotifs(profile?.notificationPreferences ?? {}); }, [profile?.notificationPreferences]);

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
      const { pdfBase64 } = await transcriptApi.generate(true);
      const fileUri = `${FileSystem.cacheDirectory}transcript.pdf`;
      await FileSystem.writeAsStringAsync(fileUri, pdfBase64, { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'AcadeGrade Transcript' });
      }
    } catch (e: any) {
      Alert.alert('Failed', e.message ?? 'Could not generate transcript.');
    } finally {
      setExporting(false);
    }
  }

  async function handleLogout() {
    if (uid) await unregisterFcmToken(uid);
    await signOut();
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This permanently wipes all your semesters, courses, and transcript data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { await userApi.deleteAccount(); await signOut(); } },
      ]
    );
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
            <View style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.void }}>
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
            <ListRow icon={<CalendarDays size={16} color={c.primary} />} title="Current Session" subtitle={profile?.currentSession ?? '—'} />
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
    </SafeAreaView>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm }}>{label}</Text>;
}

function StatCell({ value, label, danger }: { value: string; label: string; danger?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: danger ? c.danger : c.text, fontSize: 18, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: c.textFaint, fontSize: 10, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Divider() {
  return <View style={{ width: 1, backgroundColor: c.border, marginVertical: 4 }} />;
}

function ListRow({ icon, title, subtitle, onPress, danger }: { icon: React.ReactNode; title: string; subtitle?: string; onPress?: () => void; danger?: boolean }) {
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
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.borderSubtle }}>
      <Text style={{ color: c.textMuted, fontSize: 13 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.primary, false: c.border }} thumbColor="#FFFFFF" />
    </View>
  );
}
