import { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Share, RefreshControl, Pressable, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ChevronDown, Share2, Bell, ArrowUpRight } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors, spacing, APP_NAME } from '@/constants/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { AIPulseBadge } from '@/components/ui/AIPulseBadge';
import { Badge } from '@/components/ui/Badge';
import { CGPAArc } from '@/components/dashboard/CGPAArc';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { BentoGrid, BentoTile, BentoStat } from '@/components/dashboard/BentoGrid';
import { SmartNudge } from '@/components/dashboard/SmartNudge';
import { useAcademicData } from '@/lib/store/useAcademicData';
import { useAuthStore } from '@/lib/store/authStore';
import { db } from '@/lib/firebase/client';
import { getGradeColor } from '@/lib/cgpa/gradeScale';

const { width } = Dimensions.get('window');

/**
 * REBUILT per the inspiration reference (image 14/15): header now shows
 * avatar + name + level + a bell (opens Notifications — no live unread
 * count yet, since no notifications screen/query exists in this codebase
 * to source a real number from; adding a fake count would be worse than
 * no badge), CGPA/PI as a proper segmented pill instead of two floating
 * chips, and a new "Recent Courses" list at the bottom matching the
 * reference exactly. CGPAArc itself rebuilt separately (see that file).
 */
export default function Dashboard() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const { semesters, allCourses, cgpa, pi, totalCredits, totalCourses, currentSemesterGPA, atRiskCount } = useAcademicData();
  const [refreshing, setRefreshing] = useState(false);
  const [outlookExpanded, setOutlookExpanded] = useState(false);
  const [hasGeneratedInsight] = useState(false);

  const gradeMode = profile?.gradeMode ?? 'cgpa';
  const primaryValue = gradeMode === 'cgpa' ? cgpa : pi;
  const primaryLabel = gradeMode === 'cgpa' ? 'CGPA' : 'PI';
  const trendData = semesters.map((s, i) => ({ x: i + 1, gpa: s.gpa, pi: s.pi }));

  const recentCourses = useMemo(
    () => [...allCourses].sort((a, b) => ((b.updatedAt as any)?.toMillis?.() ?? 0) - ((a.updatedAt as any)?.toMillis?.() ?? 0)).slice(0, 3),
    [allCourses]
  );

  async function toggleMetric(mode: 'cgpa' | 'pi') {
    if (!firebaseUser || mode === gradeMode) return;
    Haptics.selectionAsync();
    await db.collection('users').doc(firebaseUser.uid).update({ gradeMode: mode });
  }

  async function handleShare() {
    await Share.share({ message: `My ${primaryLabel} on ${APP_NAME} is ${primaryValue.toFixed(2)}/5.0.` });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 600); }} tintColor={colors.primary} />
        }
      >
        {/* HEADER — avatar, name, level, bell, share */}
        <Animated.View entering={FadeIn.duration(300)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: colors.border }} />
            ) : (
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.primary }}>
                <Text style={{ color: colors.primaryGlow, fontWeight: '800', fontSize: 15 }}>
                  {(profile?.fullName ?? 'S').charAt(0)}
                </Text>
              </View>
            )}
            <View>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
                {profile?.fullName?.split(' ')[0] ?? 'Student'}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {profile?.department ?? APP_NAME} · {profile?.currentLevel ?? ''} Level
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton icon={<Bell color={colors.textMuted} size={17} />} onPress={() => router.push('/(tabs)/profile')} />
            <IconButton icon={<Share2 color={colors.textMuted} size={17} />} onPress={handleShare} />
          </View>
        </Animated.View>

        <SmartNudge cgpa={primaryValue} atRiskCount={atRiskCount} hasGeneratedInsight={hasGeneratedInsight} />

        {/* HERO — gradient arc on glass, segmented CGPA/PI pill */}
        <GlassCard aiActive style={{ alignItems: 'center', marginBottom: spacing.sm, paddingVertical: spacing.xl }}>
          <CGPAArc value={primaryValue} label={primaryLabel} />
          <SegmentedToggle
            options={[{ key: 'cgpa', label: 'CGPA' }, { key: 'pi', label: 'True Mastery (PI)' }]}
            active={gradeMode}
            onChange={(k) => toggleMetric(k as 'cgpa' | 'pi')}
          />
        </GlassCard>

        <BentoGrid>
          <BentoTile span="half" delayMs={0}>
            <BentoStat label="Total Credits" value={totalCredits} />
          </BentoTile>
          <BentoTile span="half" delayMs={40}>
            <BentoStat label="Semester GPA" value={currentSemesterGPA.toFixed(2)} color={colors.primaryGlow} />
          </BentoTile>
          <BentoTile span="half" delayMs={80}>
            <BentoStat label="Courses Completed" value={totalCourses} />
          </BentoTile>
          <BentoTile span="half" delayMs={120} aiActive={atRiskCount > 0}>
            <BentoStat label="At Risk" value={atRiskCount} color={atRiskCount > 0 ? colors.danger : colors.text} />
          </BentoTile>

          {trendData.length > 1 && (
            <BentoTile span="full" delayMs={160}>
              <Text style={{ color: colors.text, fontWeight: '700', marginBottom: spacing.sm, fontSize: 13 }}>
                Performance Trend
              </Text>
              <TrendChart data={trendData} width={width - spacing.lg * 2 - 32} height={160} />
            </BentoTile>
          )}
        </BentoGrid>

        <View style={{ height: spacing.sm }} />

        {/* ACADEMIND AI CARD */}
        <Pressable onPress={() => { Haptics.selectionAsync(); setOutlookExpanded((v) => !v); }}>
          <GlassCard aiActive>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AIPulseBadge label="AcadeMind" />
              <ExpandIcon expanded={outlookExpanded} />
            </View>
            <Text style={{ color: colors.text, fontWeight: '700', marginTop: spacing.sm, marginBottom: 4 }}>
              Degree Outlook
            </Text>
            {outlookExpanded ? (
              <Animated.View entering={FadeIn.duration(250)}>
                <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: spacing.sm }}>
                  Open Insights for a full written analysis, risk breakdown, and the What-If calculator —
                  refreshes are limited to once every 12 hours to keep the analysis meaningful.
                </Text>
                <Pressable onPress={() => router.push('/(tabs)/insights')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: colors.primaryGlow, fontSize: 13, fontWeight: '700' }}>View Full Insights</Text>
                  <ArrowUpRight color={colors.primaryGlow} size={14} />
                </Pressable>
              </Animated.View>
            ) : (
              <Text style={{ color: colors.textFaint, fontSize: 12 }}>Tap to preview</Text>
            )}
          </GlassCard>
        </Pressable>

        {/* RECENT COURSES — new, matching the inspiration reference */}
        {recentCourses.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(350)} style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Recent Courses</Text>
              <Pressable onPress={() => router.push('/(tabs)/results')}>
                <Text style={{ color: colors.primaryGlow, fontSize: 12, fontWeight: '700' }}>View All</Text>
              </Pressable>
            </View>
            <View style={{ gap: 8 }}>
              {recentCourses.map((c) => (
                <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md }}>
                  <View style={{ flex: 1, paddingRight: spacing.sm }}>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>{c.title || c.code}</Text>
                    <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 2 }}>{c.code} · {c.units} units</Text>
                  </View>
                  {c.grade && <Badge label={c.grade} color={getGradeColor(c.grade)} />}
                </View>
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function IconButton({ icon, onPress }: { icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}
    >
      {icon}
    </Pressable>
  );
}

function ExpandIcon({ expanded }: { expanded: boolean }) {
  const rotation = useSharedValue(expanded ? 180 : 0);
  useEffect(() => {
    rotation.value = withTiming(expanded ? 180 : 0, { duration: 200 });
  }, [expanded]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <ChevronDown color={colors.textMuted} size={18} />
    </Animated.View>
  );
}

function SegmentedToggle({ options, active, onChange }: { options: { key: string; label: string }[]; active: string; onChange: (key: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.void, borderRadius: 999, padding: 4, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border }}>
      {options.map((opt) => {
        const isActive = opt.key === active;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={{
              paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
              backgroundColor: isActive ? colors.primary : 'transparent',
            }}
          >
            <Text style={{ color: isActive ? '#FFFFFF' : colors.textMuted, fontSize: 12, fontWeight: '700' }}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
