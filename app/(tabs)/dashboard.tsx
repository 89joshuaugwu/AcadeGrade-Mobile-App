import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Share, RefreshControl, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ChevronDown, Share2 } from 'lucide-react-native';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors, spacing, APP_NAME } from '@/constants/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { AIPulseBadge } from '@/components/ui/AIPulseBadge';
import { CGPAArc } from '@/components/dashboard/CGPAArc';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { BentoGrid, BentoTile, BentoStat } from '@/components/dashboard/BentoGrid';
import { SmartNudge } from '@/components/dashboard/SmartNudge';
import { useAcademicData } from '@/lib/store/useAcademicData';
import { useAuthStore } from '@/lib/store/authStore';
import { db } from '@/lib/firebase/client';

const { width } = Dimensions.get('window');

export default function Dashboard() {
  const profile = useAuthStore((s) => s.profile);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const { semesters, cgpa, pi, totalCredits, totalCourses, currentSemesterGPA, atRiskCount } = useAcademicData();
  const [refreshing, setRefreshing] = useState(false);
  const [outlookExpanded, setOutlookExpanded] = useState(false);
  const [hasGeneratedInsight] = useState(false); // flips true once Insights tab is visited this session

  const gradeMode = profile?.gradeMode ?? 'cgpa';
  const primaryValue = gradeMode === 'cgpa' ? cgpa : pi;
  const primaryLabel = gradeMode === 'cgpa' ? 'CGPA' : 'PI';
  const trendData = semesters.map((s, i) => ({ x: i + 1, gpa: s.gpa, pi: s.pi }));

  async function toggleMetric() {
    if (!firebaseUser) return;
    Haptics.selectionAsync();
    await db.collection('users').doc(firebaseUser.uid).update({ gradeMode: gradeMode === 'cgpa' ? 'pi' : 'cgpa' });
  }

  async function handleShare() {
    await Share.share({
      message: `My ${primaryLabel} on ${APP_NAME} is ${primaryValue.toFixed(2)}/5.0.`,
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 600); }} tintColor={colors.primary} />
        }
      >
        {/* Greeting row — trimmed to make room for the smart nudge below it,
            per progressive-disclosure research (scrollytelling over crowded
            dashboards): lead with what matters today, not a static header. */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md }}>
          <View>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Welcome back,</Text>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>
              {profile?.fullName?.split(' ')[0] ?? 'Student'}
            </Text>
          </View>
          <Pressable
            onPress={handleShare}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}
          >
            <Share2 color={colors.textMuted} size={18} />
          </Pressable>
        </View>

        <SmartNudge cgpa={primaryValue} atRiskCount={atRiskCount} hasGeneratedInsight={hasGeneratedInsight} />

        {/* Hero glass tile — the CGPAArc, now on a translucent Liquid Glass
            surface with a soft primary-glow bleed instead of a flat panel. */}
        <GlassCard aiActive style={{ alignItems: 'center', marginBottom: spacing.sm, paddingVertical: spacing.xl }}>
          <CGPAArc value={primaryValue} label={primaryLabel} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
            <MetricPill label="CGPA" active={gradeMode === 'cgpa'} onPress={toggleMetric} />
            <MetricPill label="True Mastery (PI)" active={gradeMode === 'pi'} onPress={toggleMetric} />
          </View>
        </GlassCard>

        {/* Bento grid — variable tile sizes instead of a uniform 2x2 KPI
            grid, per 2026 modular-dashboard research. The at-risk tile is
            visually louder (danger wash) only when it's non-zero — this is
            the "guide user attention" principle, not decoration for its
            own sake. */}
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
                CGPA vs True Mastery
              </Text>
              <TrendChart data={trendData} width={width - spacing.lg * 2 - 32} height={160} />
            </BentoTile>
          )}
        </BentoGrid>

        <View style={{ height: spacing.sm }} />

        {/* Progressive disclosure — collapsed by default, expands on tap.
            Per research: "complex data through scrollytelling instead of
            crowded dashboards... reduces cognitive load." */}
        <Pressable onPress={() => { Haptics.selectionAsync(); setOutlookExpanded((v) => !v); }}>
          <GlassCard>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AIPulseBadge label="AcadeMind" />
              <ExpandIcon expanded={outlookExpanded} />
            </View>
            <Text style={{ color: colors.text, fontWeight: '700', marginTop: spacing.sm, marginBottom: 4 }}>
              Degree Outlook
            </Text>
            {outlookExpanded ? (
              <Animated.View entering={FadeIn.duration(250)}>
                <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>
                  Open Insights for a full written analysis, risk breakdown, and the What-If calculator —
                  refreshes are limited to once every 12 hours to keep the analysis meaningful.
                </Text>
              </Animated.View>
            ) : (
              <Text style={{ color: colors.textFaint, fontSize: 12 }}>Tap to preview</Text>
            )}
          </GlassCard>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
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

function MetricPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Text
      onPress={onPress}
      style={{
        color: active ? '#FFFFFF' : colors.textMuted,
        backgroundColor: active ? colors.primary : 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: '600',
        overflow: 'hidden',
      }}
    >
      {label}
    </Text>
  );
}
