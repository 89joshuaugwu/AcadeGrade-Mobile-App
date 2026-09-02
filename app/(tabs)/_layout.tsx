import { useRef, useCallback } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, Text, Pressable } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { LayoutDashboard, FileText, GraduationCap, MoreHorizontal, Settings, Bell, ChevronRight, Moon, Sun, Smartphone } from 'lucide-react-native';
import { spacing } from '@/constants/theme';
import { useThemeColors, useThemeStore, type ThemeMode } from '@/lib/store/themeStore';
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
  const colors = useThemeColors();
  const themeMode = useThemeStore((state) => state.mode);
  const setThemeMode = useThemeStore((state) => state.setMode);
  const router = useRouter();
  const sheetRef = useRef<BottomSheetModal>(null);

  const openMore = useCallback(() => sheetRef.current?.present(), []);
  const closeAnd = useCallback((fn: () => void) => { sheetRef.current?.dismiss(); fn(); }, []);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarShowLabel: true,
          tabBarStyle: {
            position: 'absolute', left: 0, right: 0, bottom: 0, height: 64,
            backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.borderSubtle,
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
        snapPoints={['32%', '52%']}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetView style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.md }}>More</Text>
          <MoreRow colors={colors} icon={<Bell size={18} color={colors.primary} />} label="Notifications" onPress={() => closeAnd(() => router.push('/(tabs)/notifications'))} />
          <MoreRow colors={colors} icon={<Settings size={18} color={colors.primary} />} label="Settings" onPress={() => closeAnd(() => router.push('/(tabs)/profile'))} />

          <View style={{ marginTop: spacing.xl, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>Quick appearance</Text>
            <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 3, marginBottom: spacing.sm }}>Swipe this sheet up anytime to change the app theme.</Text>
            <View style={{ flexDirection: 'row', gap: 7 }}>
              <ThemeChip mode="light" active={themeMode === 'light'} label="Light" icon={<Sun size={15} color={themeMode === 'light' ? '#FFFFFF' : colors.textMuted} />} onPress={setThemeMode} colors={colors} />
              <ThemeChip mode="dark" active={themeMode === 'dark'} label="Dark" icon={<Moon size={15} color={themeMode === 'dark' ? '#FFFFFF' : colors.textMuted} />} onPress={setThemeMode} colors={colors} />
              <ThemeChip mode="system" active={themeMode === 'system'} label="System" icon={<Smartphone size={15} color={themeMode === 'system' ? '#FFFFFF' : colors.textMuted} />} onPress={setThemeMode} colors={colors} />
            </View>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}

function ThemeChip({ mode, active, label, icon, onPress, colors }: { mode: ThemeMode; active: boolean; label: string; icon: React.ReactNode; onPress: (mode: ThemeMode) => void; colors: ReturnType<typeof useThemeColors> }) {
  return (
    <Pressable onPress={() => onPress(mode)} style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 11, backgroundColor: active ? colors.primary : colors.overlay, borderWidth: 1, borderColor: active ? colors.primaryGlow : colors.border }}>
      {icon}
      <Text style={{ color: active ? '#FFFFFF' : colors.textMuted, fontSize: 9, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

function MoreRow({ icon, label, onPress, colors }: { icon: React.ReactNode; label: string; onPress: () => void; colors: ReturnType<typeof useThemeColors> }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
        {icon}
      </View>
      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, flex: 1 }}>{label}</Text>
      <ChevronRight size={16} color={colors.textFaint} />
    </Pressable>
  );
}
