import { useRef, useCallback } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, Text, Pressable } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { LayoutDashboard, FileText, GraduationCap, MoreHorizontal, Settings, Bell, ChevronRight } from 'lucide-react-native';
import { spacing, lightColors } from '@/constants/theme';
import { AcadeMindMark } from '@/components/ui/AcadeMindMark';

/**
 * REBUILT per direct reference (flush-bottom solid white bar, rounded top
 * corners, no blur/floating pill) — replaces the earlier glass/floating
 * version. Insights tab icon is now the AcadeMind logo instead of a
 * generic Sparkles icon, matching the "replace that icon everywhere" note.
 * `notifications` explicitly registered with `href: null` as cheap
 * insurance against ever auto-appearing in the bar, even though it lives
 * outside `(tabs)/` and shouldn't be picked up regardless.
 */
export default function TabsLayout() {
  const router = useRouter();
  const sheetRef = useRef<BottomSheetModal>(null);

  const openMore = useCallback(() => sheetRef.current?.present(), []);
  const closeAnd = useCallback((fn: () => void) => { sheetRef.current?.dismiss(); fn(); }, []);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: lightColors.primary,
          tabBarInactiveTintColor: lightColors.textMuted,
          tabBarShowLabel: true,
          tabBarStyle: {
            position: 'absolute', left: 0, right: 0, bottom: 0, height: 64,
            backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: lightColors.borderSubtle,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            elevation: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 },
          },
          tabBarItemStyle: { paddingTop: 8 },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        }}
      >
        <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }} />
        <Tabs.Screen name="results" options={{ title: 'Results', tabBarIcon: ({ color, size }) => <FileText color={color} size={size} /> }} />
        <Tabs.Screen name="insights" options={{ title: 'Insights', tabBarIcon: () => <AcadeMindMark size={22} /> }} />
        <Tabs.Screen name="transcript" options={{ title: 'Transcript', tabBarIcon: ({ color, size }) => <GraduationCap color={color} size={size} /> }} />
        <Tabs.Screen
          name="more"
          options={{ title: 'More', tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} /> }}
          listeners={{ tabPress: (e) => { e.preventDefault(); openMore(); } }}
        />
        {/* Reachable via routing/the More sheet, hidden from the tab bar itself */}
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
      </Tabs>

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['32%']}
        backgroundStyle={{ backgroundColor: lightColors.surface }}
        handleIndicatorStyle={{ backgroundColor: lightColors.border }}
      >
        <BottomSheetView style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
          <Text style={{ color: lightColors.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.md }}>More</Text>
          <MoreRow icon={<Bell size={18} color={lightColors.primary} />} label="Notifications" onPress={() => closeAnd(() => router.push('/(tabs)/notifications'))} />
          <MoreRow icon={<Settings size={18} color={lightColors.primary} />} label="Settings" onPress={() => closeAnd(() => router.push('/(tabs)/profile'))} />
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}

function MoreRow({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: lightColors.borderSubtle }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: lightColors.primaryDim, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
        {icon}
      </View>
      <Text style={{ color: lightColors.text, fontWeight: '600', fontSize: 14, flex: 1 }}>{label}</Text>
      <ChevronRight size={16} color={lightColors.textFaint} />
    </Pressable>
  );
}
