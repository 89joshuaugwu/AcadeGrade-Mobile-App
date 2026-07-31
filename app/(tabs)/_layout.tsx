import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LayoutDashboard, FileText, Sparkles, GraduationCap, Settings } from 'lucide-react-native';
import { colors, radius, glass } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: true,
        tabBarBackground: () => (
          <View style={{ flex: 1, borderRadius: radius.pill, overflow: 'hidden' }}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.wash }]} />
          </View>
        ),
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 20,
          height: 64,
          borderRadius: radius.pill,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: glass.borderTop,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        },
        tabBarItemStyle: { paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused}><LayoutDashboard color={color} size={22} /></TabIcon>,
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: 'Results',
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused}><FileText color={color} size={22} /></TabIcon>,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused}><Sparkles color={color} size={22} /></TabIcon>,
        }}
      />
      <Tabs.Screen
        name="transcript"
        options={{
          title: 'Transcript',
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused}><GraduationCap color={color} size={22} /></TabIcon>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused}><Settings color={color} size={22} /></TabIcon>,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ children, focused }: { children: React.ReactNode; focused: boolean }) {
  return (
    <View
      style={{
        padding: 8,
        borderRadius: 999,
        backgroundColor: focused ? `${colors.primary}22` : 'transparent',
        shadowColor: focused ? colors.primaryGlow : 'transparent',
        shadowOpacity: focused ? 0.8 : 0,
        shadowRadius: 8,
      }}
    >
      {children}
    </View>
  );
}
