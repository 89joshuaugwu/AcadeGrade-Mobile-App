import { useRef, useCallback } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { LayoutDashboard, FileText, Sparkles, GraduationCap, MoreHorizontal, Settings, Bell, ChevronRight } from 'lucide-react-native';
import { colors, radius, glass, spacing, lightColors } from '@/constants/theme';

/**
 * REBUILT per the BizStock reference: 4 primary destinations
 * (Dashboard/Results/Insights/Transcript) + a "More" button that opens a
 * bottom sheet instead of cramming a 5th+6th tab into the bar. Settings
 * and Notifications live in that sheet. "profile" stays a real route
 * (reachable from the sheet) but is hidden from the tab bar itself via
 * `href: null`.
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
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarShowLabel: true,
          tabBarBackground: () => (
            // Changed radius.pill to specific top corner radii
            <View style={{ flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }}>
              <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 255, 255, 0.7)' }]} />
            </View>
          ),
          tabBarStyle: {
            height: 64,
            // Removed position absolute, left, right, and bottom properties
            backgroundColor: 'transparent',
            borderTopWidth: 1,
            borderColor: glass.borderTop,
            
            // Set only the top corners to be rounded
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            
            // Adjusted shadow to point slightly upwards (-4) instead of downwards
            elevation: 8,
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: -4 },
          },
          tabBarItemStyle: { paddingTop: 8 },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{ title: 'Dashboard', tabBarIcon: ({ color, focused }) => <TabIcon focused={focused}><LayoutDashboard color={color} size={22} /></TabIcon> }}
        />
        <Tabs.Screen
          name="results"
          options={{ title: 'Results', tabBarIcon: ({ color, focused }) => <TabIcon focused={focused}><FileText color={color} size={22} /></TabIcon> }}
        />
        <Tabs.Screen
          name="insights"
          options={{ title: 'Insights', tabBarIcon: ({ color, focused }) => <TabIcon focused={focused}><Sparkles color={color} size={22} /></TabIcon> }}
        />
        <Tabs.Screen
          name="transcript"
          options={{ title: 'Transcript', tabBarIcon: ({ color, focused }) => <TabIcon focused={focused}><GraduationCap color={color} size={22} /></TabIcon> }}
        />
        <Tabs.Screen
          name="more"
          options={{ title: 'More', tabBarIcon: ({ color, focused }) => <TabIcon focused={focused}><MoreHorizontal color={color} size={22} /></TabIcon> }}
          listeners={{ tabPress: (e) => { e.preventDefault(); openMore(); } }}
        />
        {/* Reachable via the More sheet, hidden from the tab bar itself */}
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

function TabIcon({ children, focused }: { children: React.ReactNode; focused: boolean }) {
  return (
    <View
      style={{
        padding: 8, borderRadius: 999,
        backgroundColor: focused ? `${colors.primary}22` : 'transparent',
        shadowColor: focused ? colors.primaryGlow : 'transparent',
        shadowOpacity: focused ? 0.8 : 0, shadowRadius: 8,
      }}
    >
      {children}
    </View>
  );
}
