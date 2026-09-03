import { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import database from '@react-native-firebase/database';
import { ArrowLeft, Bell, CheckCheck, TrendingUp, GraduationCap, Info } from 'lucide-react-native';
import { spacing, radius } from '@/constants/theme';
import { useThemeColors } from '@/lib/store/themeStore';
import { db } from '@/lib/firebase/client';
import { useAuthStore } from '@/lib/store/authStore';
import { TourTarget } from '@/components/tour/TourTarget';
import { useAutoTour } from '@/lib/tour/useAutoTour';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type?: 'semesterSaved' | 'degreeClass' | 'aiInsights' | 'system';
  read: boolean;
  createdAt?: { toMillis?: () => number } | number;
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
  const colors = useThemeColors();
  const [items, setItems] = useState<NotificationItem[]>([]);
  useAutoTour('notifications');

  useEffect(() => {
    if (!uid) return;
    const ref = db.collection('notifications').doc(uid).collection('items')
      .orderBy('createdAt', 'desc').limit(50);
    return ref.onSnapshot((snap) => {
      setItems(snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<NotificationItem, 'id'>) })));
    });
  }, [uid]);

  async function markAsRead(id: string) {
    if (!uid) return;
    const item = items.find((notification) => notification.id === id);
    await db.collection('notifications').doc(uid).collection('items').doc(id).update({ read: true });
    if (item && !item.read) {
      await database().ref(`notif_counts/${uid}/unread`).set(Math.max(0, unreadCount - 1));
    }
  }

  async function markAllRead() {
    if (!uid) return;
    const batch = firestore().batch();
    items.filter((n) => !n.read).forEach((n) => {
      batch.update(db.collection('notifications').doc(uid).collection('items').doc(n.id), { read: true });
    });
    if (items.some((n) => !n.read)) await batch.commit();
    await database().ref(`notif_counts/${uid}/unread`).set(0);
  }

  const unreadCount = items.filter((n) => !n.read).length;
  const formatDate = useMemo(() => (value: NotificationItem['createdAt']) => {
    const millis = typeof value === 'number' ? value : value?.toMillis?.() ?? 0;
    return millis ? new Date(millis).toLocaleDateString() : '';
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <TourTarget tourId="notifications-header" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg }}>
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
      </TourTarget>

      <TourTarget tourId="notifications-list" style={{ flex: 1 }}>
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
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{item.body ?? (item as any).message}</Text>
                {!!item.createdAt && <Text style={{ color: colors.textFaint, fontSize: 10, marginTop: 5 }}>{formatDate(item.createdAt)}</Text>}
              </View>
              {!item.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 4 }} />}
            </Pressable>
          );
        }}
      />
      </TourTarget>
    </SafeAreaView>
  );
}
