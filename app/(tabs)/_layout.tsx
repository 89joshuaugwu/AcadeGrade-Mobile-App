import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { LayoutDashboard, FileText, GraduationCap, MoreVertical, Settings, Bell, ChevronRight, Moon, Sun, Smartphone } from 'lucide-react-native';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';
import { radius, spacing } from '@/constants/theme';
import { useThemeColors, useThemeStore, type ThemeMode } from '@/lib/store/themeStore';
import { AcadeMindMark } from '@/components/ui/AcadeMindMark';
import { TourTarget } from '@/components/tour/TourTarget';
import { useAuthStore } from '@/lib/store/authStore';
import { useTourStore } from '@/lib/store/tourStore';
import { TOUR_CHAPTERS, USAGE_TOUR_VERSION } from '@/lib/tour/chapters';
import { registerTourAction } from '@/lib/tour/registry';

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
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const profile = useAuthStore((state) => state.profile);
  const activeChapter = useTourStore((state) => state.activeChapter);
  const completedLocally = useTourStore((state) => state.completedLocally);
  const skippedLocally = useTourStore((state) => state.skippedLocally);
  const tourHydrated = useTourStore((state) => state.hydrated);
  const startChapter = useTourStore((state) => state.startChapter);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const moreSnapPoints = useMemo(
    () => [220 + Math.min(insets.bottom, 24), 340 + Math.min(insets.bottom, 24)],
    [insets.bottom],
  );

  const openMore = useCallback(() => {
    setMoreExpanded(false);
    setMoreOpen(true);
    sheetRef.current?.present();
  }, []);
  const closeAnd = useCallback((fn: () => void) => { sheetRef.current?.dismiss(); fn(); }, []);
  const renderBackdrop = useCallback((props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" opacity={0.48} />, []);

  useEffect(() => registerTourAction('more-expand', () => sheetRef.current?.snapToIndex(1)), []);

  useEffect(() => {
    const hasCurrentRemoteProgress = profile?.mobileUsageTourVersion === USAGE_TOUR_VERSION;
    if (
      !moreOpen
      || !profile
      || !tourHydrated
      || activeChapter
      || skippedLocally
      || (hasCurrentRemoteProgress && profile.mobileUsageTourSkipped)
    ) return;
    const completed = hasCurrentRemoteProgress ? profile.mobileUsageTourCompletedChapters ?? [] : [];
    if (completed.includes('more') || completedLocally.includes('more')) return;
    const timer = setTimeout(() => startChapter(TOUR_CHAPTERS.more), 550);
    return () => clearTimeout(timer);
  }, [activeChapter, completedLocally, moreOpen, profile, skippedLocally, startChapter, tourHydrated]);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
          animation: 'fade',
        }}
        tabBar={(props) => <CylindricalTabBar {...props} onOpenMore={openMore} bottomInset={insets.bottom} colors={colors} />}
      >
        <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
        <Tabs.Screen name="results" options={{ title: 'Results', popToTopOnBlur: true }} />
        <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
        <Tabs.Screen name="transcript" options={{ title: 'Transcript' }} />
        <Tabs.Screen
          name="more"
          options={{ title: 'More' }}
          listeners={{ tabPress: (e) => { e.preventDefault(); openMore(); } }}
        />
        {/* Reachable via routing/the More sheet, hidden from the tab bar itself */}
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
      </Tabs>

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={moreSnapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
        onChange={(index) => setMoreExpanded(index === 1)}
        onDismiss={() => {
          setMoreOpen(false);
          setMoreExpanded(false);
        }}
      >
        <BottomSheetView style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
          <TourTarget tourId="more-destinations">
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.md }}>More</Text>
            <MoreRow colors={colors} icon={<Bell size={18} color={colors.primary} />} label="Notifications" onPress={() => closeAnd(() => router.push('/(tabs)/notifications'))} />
            <MoreRow colors={colors} icon={<Settings size={18} color={colors.primary} />} label="Settings" onPress={() => closeAnd(() => router.push('/(tabs)/profile'))} />
          </TourTarget>

          <TourTarget
            tourId="more-theme"
            onTourFocus={() => sheetRef.current?.snapToIndex(1)}
            style={moreExpanded
              ? { marginTop: spacing.xl, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSubtle }
              : { height: 0, opacity: 0, overflow: 'hidden' }}
          >
            {moreExpanded && (
              <Animated.View entering={FadeIn.duration(170)}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>Quick appearance</Text>
                <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 3, marginBottom: spacing.sm }}>Swipe this sheet up anytime to change the app theme.</Text>
                <View style={{ flexDirection: 'row', gap: 7 }}>
                  <ThemeChip mode="light" active={themeMode === 'light'} label="Light" icon={<Sun size={15} color={themeMode === 'light' ? '#FFFFFF' : colors.textMuted} />} onPress={setThemeMode} colors={colors} />
                  <ThemeChip mode="dark" active={themeMode === 'dark'} label="Dark" icon={<Moon size={15} color={themeMode === 'dark' ? '#FFFFFF' : colors.textMuted} />} onPress={setThemeMode} colors={colors} />
                  <ThemeChip mode="system" active={themeMode === 'system'} label="System" icon={<Smartphone size={15} color={themeMode === 'system' ? '#FFFFFF' : colors.textMuted} />} onPress={setThemeMode} colors={colors} />
                </View>
              </Animated.View>
            )}
          </TourTarget>
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}

const TAB_ITEMS = [
  { name: 'dashboard', label: 'Dashboard', tourId: 'nav-dashboard', Icon: LayoutDashboard },
  { name: 'results', label: 'Results', tourId: 'nav-results', Icon: FileText },
  { name: 'insights', label: 'Insights', tourId: 'nav-insights', Icon: undefined },
  { name: 'transcript', label: 'Transcript', tourId: 'nav-transcript', Icon: GraduationCap },
  { name: 'more', label: 'More', tourId: 'nav-more', Icon: MoreVertical },
] as const;

function CylindricalTabBar({ state, navigation, onOpenMore, bottomInset, colors }: any & { onOpenMore: () => void; bottomInset: number; colors: ReturnType<typeof useThemeColors> }) {
  const activeRouteName = state.routes[state.index]?.name;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingBottom: Math.max(bottomInset, spacing.sm), paddingHorizontal: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 430, minHeight: 64, paddingHorizontal: 7, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 18 }}>
        {TAB_ITEMS.map((item) => {
          const routeIndex = state.routes.findIndex((route: { name: string }) => route.name === item.name);
          if (routeIndex < 0) return null;
          const focused = activeRouteName === item.name;
          const route = state.routes[routeIndex];
          const Icon = item.Icon;
          const iconColor = focused ? colors.primaryGlow : colors.textMuted;
          const onPress = () => {
            if (item.name === 'more') {
              onOpenMore();
              return;
            }
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (event.defaultPrevented) return;
            // The custom tab bar must reproduce the native tab bar's
            // pop-to-root behaviour. Otherwise a previously opened semester
            // remains the active Results destination.
            if (item.name === 'results') {
              navigation.navigate(route.name, { screen: 'index' });
              return;
            }
            if (!focused) navigation.navigate(route.name);
          };

          return (
            <TourTarget key={item.name} tourId={item.tourId}>
              <Pressable accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={item.label} onPress={onPress} style={{ minHeight: 50, justifyContent: 'center' }}>
                <Animated.View
                  layout={Layout.springify().damping(18).stiffness(220)}
                  entering={FadeIn.duration(160)}
                  style={{ minWidth: focused ? 106 : 46, height: 50, paddingHorizontal: focused ? 13 : 0, gap: focused ? 7 : 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: focused ? colors.primaryDim : 'transparent', borderWidth: focused ? 1 : 0, borderColor: focused ? `${colors.primary}55` : 'transparent' }}
                >
                  {item.name === 'insights' ? <View style={{ opacity: focused ? 1 : 0.58 }}><AcadeMindMark size={21} /></View> : Icon ? <Icon size={21} color={iconColor} strokeWidth={focused ? 2.7 : 2.1} /> : null}
                  {focused && <Animated.Text entering={FadeIn.duration(150)} style={{ color: colors.primaryGlow, fontSize: 11, fontWeight: '900' }} numberOfLines={1}>{item.label}</Animated.Text>}
                </Animated.View>
              </Pressable>
            </TourTarget>
          );
        })}
      </View>
    </View>
  );
}

function ThemeChip({ mode, active, label, icon, onPress, colors }: { mode: ThemeMode; active: boolean; label: string; icon: React.ReactNode; onPress: (mode: ThemeMode) => void; colors: ReturnType<typeof useThemeColors> }) {
  return (
    <Pressable onPress={() => onPress(mode)} style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 11, backgroundColor: active ? colors.primaryHover : colors.overlay, borderWidth: 1, borderColor: active ? colors.primaryGlow : colors.border }}>
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
