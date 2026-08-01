import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import database from '@react-native-firebase/database';
import { ArrowLeft, Bell, CheckCheck, TrendingUp, GraduationCap, Info } from 'lucide-react-native';
import { lightColors as colors, spacing, radius } from '@/constants/theme';
import { useAuthStore } from '@/lib/store/authStore';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type?: 'semesterSaved' | 'degreeClass' | 'aiInsights' | 'system';
  read: boolean;
  createdAt: number;
}

const ICONS: Record<string, React.ComponentType<any>> = {
  semesterSaved: GraduationCap,
  degreeClass: TrendingUp,
  aiInsights: Bell,
  system: Info,
};

/**
 * NEW — no dedicated notifications screen existed before. Reads from the
 * same `notifications/{uid}` RTDB path already used for the unread-count
 * preview on the Profile screen (see that file's `useNotifications` hook) —
 * same data source, this is just the full list + mark-as-read view.
 * Reachable from the "More" sheet in the tab bar.
 */
export default function Notifications() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const [items, setItems] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!uid) return;
    const ref = database().ref(`notifications/${uid}`).orderByChild('createdAt').limitToLast(50);
    const onValue = ref.on('value', (snap) => {
      const val = snap.val() ?? {};
      const list = Object.entries(val).map(([id, v]: [string, any]) => ({ id, ...v })) as NotificationItem[];
      setItems(list.sort((a, b) => b.createdAt - a.createdAt));
    });
    return () => ref.off('value', onValue);
  }, [uid]);

  async function markAsRead(id: string) {
    if (!uid) return;
    await database().ref(`notifications/${uid}/${id}/read`).set(true);
  }

  async function markAllRead() {
    if (!uid) return;
    const updates: Record<string, boolean> = {};
    items.forEach((n) => { if (!n.read) updates[`notifications/${uid}/${n.id}/read`] = true; });
    if (Object.keys(updates).length > 0) await database().ref().update(updates);
  }

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>Notifications</Text>
        </View>
        {unreadCount > 0 && (
          <Pressable onPress={markAllRead} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <CheckCheck size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: spacing.xxl }}>
            <Bell size={40} color={colors.textFaint} />
            <Text style={{ color: colors.textMuted, marginTop: spacing.md }}>No notifications yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const Icon = ICONS[item.type ?? 'system'] ?? Info;
          return (
            <Pressable
              onPress={() => markAsRead(item.id)}
              style={{
                flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md,
                backgroundColor: item.read ? colors.surface : colors.primaryDim,
                borderWidth: 1, borderColor: item.read ? colors.border : colors.primary,
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{item.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{item.body}</Text>
              </View>
              {!item.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 4 }} />}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}
