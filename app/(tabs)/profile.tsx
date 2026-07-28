import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, Image, Alert, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import database from '@react-native-firebase/database';
import { colors, spacing } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store/authStore';
import { db } from '@/lib/firebase/client';
import { signOut } from '@/lib/firebase/auth';
import { unregisterFcmToken } from '@/lib/firebase/fcm';
import { userApi } from '@/lib/api/client';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
}

/**
 * In-app notifications, synced via Realtime Database — matches web's use of
 * RTDB "specifically for low-latency notification unread counts"
 * (01_CONTEXT.md §5). Path assumed as `notifications/{uid}` mirroring that
 * same low-latency intent; confirm the exact RTDB path against
 * lib/firebase/rtdb.ts on web before shipping if it differs.
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

// Same unsigned Cloudinary preset the web app uses (2_student_features.md §6).
const CLOUDINARY_CLOUD_NAME = 'dgqukbs8n';
const CLOUDINARY_UPLOAD_PRESET = 'acadegrade_avatars';

export default function Profile() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const [uploading, setUploading] = useState(false);
  const [notifs, setNotifs] = useState(profile?.notificationPreferences ?? {});

  useEffect(() => {
    setNotifs(profile?.notificationPreferences ?? {});
  }, [profile?.notificationPreferences]);

  async function updateNotifPref(key: keyof NonNullable<typeof notifs>, value: boolean) {
    if (!uid) return;
    const next = { ...notifs, [key]: value };
    setNotifs(next);
    await db.collection('users').doc(uid).update({ notificationPreferences: next });
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

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      await db.collection('users').doc(uid).update({ avatarUrl: data.secure_url });
    } finally {
      setUploading(false);
    }
  }

  async function handleLogout() {
    if (uid) await unregisterFcmToken(uid);
    await signOut();
  }

  async function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This permanently wipes all your semesters, courses, and transcript data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await userApi.deleteAccount();
            await signOut();
          },
        },
      ]
    );
  }

  const notificationItems = useNotifications(uid);
  const unreadCount = notificationItems.filter((n) => !n.read).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>Profile & Settings</Text>
          {unreadCount > 0 && (
            <View style={{ backgroundColor: colors.danger, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{unreadCount} new</Text>
            </View>
          )}
        </View>

        {notificationItems.length > 0 && (
          <Card style={{ marginBottom: spacing.lg }}>
            <Text style={{ color: colors.text, fontWeight: '700', marginBottom: spacing.sm }}>Notifications</Text>
            {notificationItems.slice(0, 5).map((n) => (
              <View key={n.id} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
                <Text style={{ color: n.read ? colors.textMuted : colors.text, fontWeight: n.read ? '400' : '700', fontSize: 13 }}>
                  {n.title}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{n.body}</Text>
              </View>
            ))}
          </Card>
        )}

        <Card style={{ alignItems: 'center', marginBottom: spacing.lg }}>
          {profile?.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={{ width: 80, height: 80, borderRadius: 40, marginBottom: spacing.md }} />
          ) : (
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryDim, marginBottom: spacing.md, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.primaryGlow, fontSize: 28, fontWeight: '800' }}>
                {profile?.fullName?.[0] ?? '?'}
              </Text>
            </View>
          )}
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{profile?.fullName}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.md }}>{profile?.email}</Text>
          <Button label={uploading ? 'Uploading…' : 'Change Avatar'} variant="secondary" onPress={pickAvatar} loading={uploading} />
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={{ color: colors.text, fontWeight: '700', marginBottom: spacing.md }}>Notifications</Text>
          <NotifRow label="Semester saved" value={!!notifs.semesterSaved} onChange={(v) => updateNotifPref('semesterSaved', v)} />
          <NotifRow label="Degree class change" value={!!notifs.degreeClass} onChange={(v) => updateNotifPref('degreeClass', v)} />
          <NotifRow label="AI insights ready" value={!!notifs.aiInsights} onChange={(v) => updateNotifPref('aiInsights', v)} />
          <NotifRow label="Admin broadcasts" value={!!notifs.adminBroadcasts} onChange={(v) => updateNotifPref('adminBroadcasts', v)} />
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={{ color: colors.text, fontWeight: '700', marginBottom: spacing.md }}>Preferences</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            Primary metric and record mode are managed from the Dashboard toggle and Results screen respectively.
          </Text>
        </Card>

        <Button label="Log Out" variant="secondary" onPress={handleLogout} fullWidth />
        <View style={{ height: spacing.md }} />
        <Button label="Delete Account" variant="danger" onPress={handleDeleteAccount} fullWidth />
      </ScrollView>
    </SafeAreaView>
  );
}

function NotifRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
      <Text style={{ color: colors.textMuted, fontSize: 14 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#FFFFFF" />
    </View>
  );
}
