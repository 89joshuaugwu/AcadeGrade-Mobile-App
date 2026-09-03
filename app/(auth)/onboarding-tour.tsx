import { useRef, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { Extrapolation, FadeIn, FadeInDown, interpolate, type SharedValue, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import {
  Bell, BookOpen, Camera, Check, ChevronLeft, ChevronRight,
  FileText, GraduationCap, LayoutDashboard, Link2, MoreHorizontal, Palette,
  Plus, ScanLine, Settings, ShieldCheck, Sparkles, Target, TrendingUp,
} from 'lucide-react-native';
import { radius, spacing } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { AcadeMindMark } from '@/components/ui/AcadeMindMark';
import { useAuthStore } from '@/lib/store/authStore';
import { useThemeColors } from '@/lib/store/themeStore';
import { useToastStore } from '@/lib/store/toastStore';
import { db } from '@/lib/firebase/client';

type TourKind = 'dashboard' | 'results' | 'semester' | 'scanner' | 'insights' | 'transcript' | 'more' | 'ready';

const SLIDES: { kind: TourKind; title: string; body: string; tip: string }[] = [
  { kind: 'dashboard', title: 'Your academic command centre', body: 'Dashboard combines your CGPA, PI, credits, recent grades, risk count, and performance trend into one quick view.', tip: 'Pull down on Dashboard whenever you want to refresh your latest academic data.' },
  { kind: 'results', title: 'A timeline that prevents mistakes', body: 'Results Hub follows your entry session and programme duration. It unlocks only the next missing semester, so duplicate levels cannot be created.', tip: 'If your programme length changes, update Academic Timeline in Settings and new semester slots unlock automatically.' },
  { kind: 'semester', title: 'One workspace for every semester', body: 'Open a semester to add or edit courses, import a six-character course code, share your own code, scan a result, and complete the semester.', tip: 'Complete a semester only after every imported course has a score. Completed data feeds Dashboard, Insights, and Transcript.' },
  { kind: 'scanner', title: 'Scan first, confirm before saving', body: 'Use the live camera, gallery, or a PDF. AcadeMind extracts courses and scores while you remain inside the scanner, then gives you a review step.', tip: 'Nothing is saved automatically. Check every detected value, correct anything unclear, then confirm.' },
  { kind: 'insights', title: 'Understand what your results mean', body: 'Forecast shows trajectory, What-If calculates a target, Risk identifies weak courses, and Written gives practical recommendations.', tip: 'AI limits are explained above each tool. Forecast and What-If automatically stop at your graduation point.' },
  { kind: 'transcript', title: 'A transcript ready to share', body: 'Completed semesters appear in your unofficial transcript. Export a PDF or create a secure public link that expires after 30 days.', tip: 'You control whether your photo appears, and you can revoke any active share link immediately.' },
  { kind: 'more', title: 'Everything personal lives in More', body: 'Open More for notifications and Settings. Change appearance quickly, manage alerts, correct your academic timeline, replay this tour, or export your transcript.', tip: 'Swipe the More sheet upward to reveal the quick Light, Dark, and System appearance controls.' },
  { kind: 'ready', title: 'You are ready to build your record', body: 'Start with Results, create the next semester, add your courses, and complete it when every score is ready. AcadeGrade handles the calculations and timeline.', tip: 'Your data remains editable, and destructive actions always ask for confirmation before anything is removed.' },
];

export default function OnboardingTour() {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const firebaseUser = useAuthStore((state) => state.firebaseUser);
  const profile = useAuthStore((state) => state.profile);
  const showToast = useToastStore((state) => state.show);
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const scrollX = useSharedValue(0);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const isLast = index === SLIDES.length - 1;
  const isReplay = Boolean(firebaseUser && profile);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollX.value = event.contentOffset.x; },
  });

  async function finishTour() {
    if (finishing) return;
    setFinishing(true);
    try {
      if (firebaseUser && profile) {
        await db.collection('users').doc(firebaseUser.uid).set({ mobileOnboardingCompleted: true }, { merge: true });
        router.replace('/(tabs)/dashboard');
      } else {
        router.replace('/(auth)/register');
      }
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Could not finish the tour',
        message: error?.message ?? 'Check your connection and try again.',
      });
    } finally {
      setFinishing(false);
    }
  }

  function goTo(nextIndex: number) {
    const safeIndex = Math.max(0, Math.min(SLIDES.length - 1, nextIndex));
    scrollRef.current?.scrollTo({ x: safeIndex * width, animated: true });
  }

  function goNext() {
    if (isLast) finishTour();
    else goTo(index + 1);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.void }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
          <Logo size={27} showWordmark themeColors={colors} />
          <View style={{ flex: 1 }} />
          <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.primaryDim, marginRight: spacing.sm }}>
            <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '900' }}>{index + 1} OF {SLIDES.length}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Skip app tour" onPress={finishTour} hitSlop={8} style={{ paddingHorizontal: 8, paddingVertical: 7 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '800' }}>Skip</Text>
          </Pressable>
        </View>

        <View style={{ height: 4, marginHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.overlay, overflow: 'hidden' }}>
          <Animated.View style={{ width: `${((index + 1) / SLIDES.length) * 100}%`, height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary }} />
        </View>

        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
          style={{ flex: 1 }}
        >
          {SLIDES.map((slide, slideIndex) => (
            <TourSlide key={slide.kind} slide={slide} index={slideIndex} width={width} scrollX={scrollX} />
          ))}
        </Animated.ScrollView>

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {index > 0 && (
              <Pressable accessibilityRole="button" accessibilityLabel="Previous tour step" onPress={() => goTo(index - 1)} style={{ width: 50, height: 50, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <ChevronLeft size={20} color={colors.text} />
              </Pressable>
            )}
            <View style={{ flex: 1 }}>
              <Button label={isLast ? (isReplay ? 'Enter Dashboard' : 'Create My Account') : 'Next'} onPress={goNext} loading={finishing} fullWidth themeColors={colors} icon={!isLast ? <ChevronRight size={17} color="#FFFFFF" /> : <Check size={17} color="#FFFFFF" />} />
            </View>
          </View>
          {!isReplay && (
            <Pressable onPress={() => router.push('/(auth)/login')} style={{ alignItems: 'center', paddingTop: spacing.md, paddingBottom: 2 }}>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Already use AcadeGrade? <Text style={{ color: colors.primary, fontWeight: '900' }}>Sign in</Text></Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function TourSlide({ slide, index, width, scrollX }: { slide: (typeof SLIDES)[number]; index: number; width: number; scrollX: SharedValue<number> }) {
  const colors = useThemeColors();
  const animatedStyle = useAnimatedStyle(() => {
    const range = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      opacity: interpolate(scrollX.value, range, [0.25, 1, 0.25], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(scrollX.value, range, [14, 0, 14], Extrapolation.CLAMP) },
        { scale: interpolate(scrollX.value, range, [0.94, 1, 0.94], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <View style={{ width, flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, justifyContent: 'center' }}>
      <Animated.View style={animatedStyle} entering={FadeIn.duration(250)}>
        <TourPreview kind={slide.kind} />
        <Text style={{ color: colors.text, fontSize: 23, lineHeight: 29, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center', marginTop: spacing.xl }}>{slide.title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: spacing.sm }}>{slide.body}</Text>
        <Animated.View entering={FadeInDown.delay(100).duration(250)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.primaryDim, borderWidth: 1, borderColor: `${colors.primary}35`, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg }}>
          <Sparkles size={14} color={colors.primary} style={{ marginTop: 2 }} />
          <Text style={{ color: colors.textMuted, fontSize: 11, lineHeight: 17, flex: 1 }}>{slide.tip}</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function TourPreview({ kind }: { kind: TourKind }) {
  const colors = useThemeColors();
  return (
    <View style={{ height: 265, borderRadius: 28, backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.border, padding: spacing.md, overflow: 'hidden', shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginRight: 5 }} />
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning, marginRight: 5 }} />
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
        <View style={{ flex: 1 }} />
        <Text style={{ color: colors.textFaint, fontSize: 8, fontWeight: '800' }}>ACADEGRADE GUIDE</Text>
      </View>
      {kind === 'dashboard' && <DashboardPreview />}
      {kind === 'results' && <ResultsPreview />}
      {kind === 'semester' && <SemesterPreview />}
      {kind === 'scanner' && <ScannerPreview />}
      {kind === 'insights' && <InsightsPreview />}
      {kind === 'transcript' && <TranscriptPreview />}
      {kind === 'more' && <MorePreview />}
      {kind === 'ready' && <ReadyPreview />}
    </View>
  );
}

function DashboardPreview() {
  const c = useThemeColors();
  return <><PreviewTitle icon={<LayoutDashboard size={14} color={c.primary} />} title="Dashboard" /><View style={{ backgroundColor: c.primaryHover, borderRadius: 16, padding: spacing.md }}><Text style={{ color: '#C7D2FE', fontSize: 9 }}>CURRENT CGPA</Text><Text style={{ color: '#FFFFFF', fontSize: 27, fontWeight: '900' }}>4.23</Text><Text style={{ color: '#FFFFFF', opacity: 0.8, fontSize: 8 }}>PI 4.40 · 118 credits</Text></View><View style={{ flexDirection: 'row', gap: 7, marginTop: 8 }}><MiniStat value="8" label="Semesters" color={c.info} /><MiniStat value="42" label="Courses" color={c.success} /><MiniStat value="2" label="At risk" color={c.danger} /></View><View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 46, marginTop: 9 }}>{[18, 28, 23, 36, 41, 35, 44].map((height, index) => <View key={index} style={{ flex: 1, height, borderRadius: 4, backgroundColor: index === 6 ? c.primary : c.primaryDim }} />)}</View></>;
}

function ResultsPreview() {
  const c = useThemeColors();
  return <><PreviewTitle icon={<FileText size={14} color={c.primary} />} title="Results Hub" /><View style={{ flexDirection: 'row', gap: 7, marginBottom: 8 }}><MiniStat value="6/8" label="Timeline" color={c.primary} /><MiniStat value="2025/26" label="Graduation" color={c.success} /></View>{['300L Second Semester', '400L First Semester'].map((label, index) => <View key={label} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 11, backgroundColor: c.surface, borderWidth: 1, borderColor: index ? c.primary : c.border, marginBottom: 7 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: index ? c.primary : c.success, marginRight: 8 }} /><View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: 10, fontWeight: '800' }}>{label}</Text><Text style={{ color: c.textMuted, fontSize: 8, marginTop: 2 }}>{index ? 'Next available slot' : 'Completed'}</Text></View>{index ? <Plus size={14} color={c.primary} /> : <Check size={14} color={c.success} />}</View>)}<View style={{ padding: 9, alignItems: 'center', borderRadius: 10, backgroundColor: c.primaryDim }}><Text style={{ color: c.primary, fontSize: 9, fontWeight: '900' }}>CREATE NEXT SEMESTER</Text></View></>;
}

function SemesterPreview() {
  const c = useThemeColors();
  return <><PreviewTitle icon={<BookOpen size={14} color={c.primary} />} title="Semester Workspace" /><View style={{ flexDirection: 'row', gap: 7, marginBottom: 9 }}>{[[Plus, 'Add'], [Camera, 'Scan'], [Link2, 'Code']].map(([Icon, label]: any) => <View key={label} style={{ flex: 1, alignItems: 'center', padding: 9, borderRadius: 10, backgroundColor: c.primaryDim }}><Icon size={14} color={c.primary} /><Text style={{ color: c.primary, fontSize: 8, fontWeight: '800', marginTop: 3 }}>{label}</Text></View>)}</View>{[['CSC401', 'Algorithms', 'A'], ['MTH402', 'Numerical Methods', 'B'], ['GST401', 'Research Methods', '—']].map((row) => <View key={row[0]} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.borderSubtle }}><Text style={{ color: c.textFaint, width: 48, fontSize: 8, fontWeight: '800' }}>{row[0]}</Text><Text style={{ color: c.text, flex: 1, fontSize: 9 }}>{row[1]}</Text><Text style={{ color: row[2] === 'A' ? c.success : row[2] === 'B' ? c.primary : c.warning, fontSize: 10, fontWeight: '900' }}>{row[2]}</Text></View>)}<View style={{ padding: 9, alignItems: 'center', borderRadius: 10, backgroundColor: c.overlay, marginTop: 8 }}><Text style={{ color: c.textMuted, fontSize: 8, fontWeight: '900' }}>COMPLETE WHEN EVERY SCORE IS READY</Text></View></>;
}

function ScannerPreview() {
  const c = useThemeColors();
  return <><PreviewTitle icon={<ScanLine size={14} color={c.primary} />} title="AI Result Scanner" /><View style={{ flex: 1, borderRadius: 17, backgroundColor: '#101827', borderWidth: 1, borderColor: c.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}><View style={{ position: 'absolute', left: 18, right: 18, top: 22, bottom: 22, borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 12, opacity: 0.75 }} /><View style={{ position: 'absolute', left: 22, right: 22, top: '48%', height: 2, backgroundColor: c.primaryGlow, shadowColor: c.primaryGlow, shadowOpacity: 1, shadowRadius: 8 }} /><ScanLine size={34} color="#FFFFFF" /><Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800', marginTop: 9 }}>Keep the result inside the frame</Text></View><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary }} /><Text style={{ color: c.textMuted, fontSize: 8 }}>Capture → AI review → Confirm</Text></View></>;
}

function InsightsPreview() {
  const c = useThemeColors();
  return <><PreviewTitle icon={<AcadeMindMark size={15} />} title="AI Insights" /><View style={{ flexDirection: 'row', padding: 3, backgroundColor: c.surface, borderRadius: 10, marginBottom: 8 }}>{['Forecast', 'What-If', 'Risk', 'Written'].map((label, index) => <View key={label} style={{ flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8, backgroundColor: index === 0 ? c.primaryHover : 'transparent' }}><Text style={{ color: index === 0 ? '#FFFFFF' : c.textMuted, fontSize: 7, fontWeight: '900' }}>{label}</Text></View>)}</View><View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 82, gap: 8, padding: 10, borderRadius: 13, backgroundColor: c.surface }}>{[33, 45, 38, 58, 68].map((height, index) => <View key={index} style={{ flex: 1, height, borderRadius: 5, backgroundColor: index >= 3 ? `${c.primary}75` : c.primaryDim, borderWidth: index >= 3 ? 1 : 0, borderColor: c.primary }} />)}<GraduationCap size={18} color={c.success} style={{ position: 'absolute', right: 8, top: 7 }} /></View><View style={{ flexDirection: 'row', gap: 7, marginTop: 8 }}><MiniStat value="4.31" label="Next CGPA" color={c.primary} /><MiniStat value="1" label="Sem left" color={c.warning} /><MiniStat value="Low" label="Risk" color={c.success} /></View></>;
}

function TranscriptPreview() {
  const c = useThemeColors();
  return <><PreviewTitle icon={<GraduationCap size={14} color={c.primary} />} title="Unofficial Transcript" /><View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 13, padding: 10 }}><View style={{ alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#CBD5E1', paddingBottom: 7 }}><GraduationCap size={18} color="#4F46E5" /><Text style={{ color: '#111827', fontSize: 10, fontWeight: '900', marginTop: 3 }}>ACADEMIC TRANSCRIPT</Text><Text style={{ color: '#64748B', fontSize: 7 }}>Ada Student · Computer Science</Text></View>{['100L First Semester', '100L Second Semester'].map((label) => <View key={label} style={{ marginTop: 8 }}><View style={{ backgroundColor: '#111827', padding: 5 }}><Text style={{ color: '#FFFFFF', fontSize: 7, fontWeight: '900' }}>{label}</Text></View><View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 5 }}><Text style={{ color: '#475569', fontSize: 7 }}>Courses and grades</Text><Text style={{ color: '#111827', fontSize: 7, fontWeight: '900' }}>GPA 4.25</Text></View></View>)}</View><View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 8 }}><PreviewAction icon={<FileText size={11} color={c.primary} />} label="PDF" /><PreviewAction icon={<Link2 size={11} color={c.primary} />} label="Share link" /></View></>;
}

function MorePreview() {
  const c = useThemeColors();
  return <><PreviewTitle icon={<MoreHorizontal size={14} color={c.primary} />} title="More" />{[[Bell, 'Notifications', 'Academic updates'], [Settings, 'Settings', 'Profile and preferences'], [Palette, 'Quick appearance', 'Light · Dark · System']].map(([Icon, title, subtitle]: any) => <View key={title} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, marginBottom: 8 }}><View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: c.primaryDim, alignItems: 'center', justifyContent: 'center' }}><Icon size={15} color={c.primary} /></View><View style={{ flex: 1, marginLeft: 9 }}><Text style={{ color: c.text, fontSize: 10, fontWeight: '900' }}>{title}</Text><Text style={{ color: c.textMuted, fontSize: 8, marginTop: 2 }}>{subtitle}</Text></View><ChevronRight size={14} color={c.textFaint} /></View>)}</>;
}

function ReadyPreview() {
  const c = useThemeColors();
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 78, height: 78, borderRadius: 28, backgroundColor: c.successDim, borderWidth: 1, borderColor: `${c.success}55`, alignItems: 'center', justifyContent: 'center' }}><ShieldCheck size={37} color={c.success} /></View><Text style={{ color: c.text, fontSize: 18, fontWeight: '900', marginTop: spacing.lg }}>Your plan. Your results.</Text><Text style={{ color: c.textMuted, fontSize: 10, textAlign: 'center', lineHeight: 16, marginTop: 6, paddingHorizontal: spacing.xl }}>A guided timeline from your first semester to graduation.</Text><View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg }}><Target size={14} color={c.primary} /><View style={{ width: 50, height: 2, backgroundColor: c.primary, marginHorizontal: 6 }} /><TrendingUp size={14} color={c.success} /><View style={{ width: 50, height: 2, backgroundColor: c.success, marginHorizontal: 6 }} /><GraduationCap size={17} color={c.gold} /></View></View>;
}

function PreviewTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  const c = useThemeColors();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: spacing.sm }}>{icon}<Text style={{ color: c.text, fontSize: 11, fontWeight: '900' }}>{title}</Text></View>;
}

function MiniStat({ value, label, color }: { value: string; label: string; color: string }) {
  const c = useThemeColors();
  return <View style={{ flex: 1, alignItems: 'center', padding: 8, borderRadius: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}><Text numberOfLines={1} style={{ color, fontSize: value.length > 5 ? 9 : 13, fontWeight: '900' }}>{value}</Text><Text style={{ color: c.textFaint, fontSize: 7, marginTop: 2 }}>{label}</Text></View>;
}

function PreviewAction({ icon, label }: { icon: React.ReactNode; label: string }) {
  const c = useThemeColors();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>{icon}<Text style={{ color: c.textMuted, fontSize: 8, fontWeight: '800' }}>{label}</Text></View>;
}
