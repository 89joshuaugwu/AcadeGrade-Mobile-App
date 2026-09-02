import { useMemo, useState, useEffect } from 'react';
import { Alert, Image, Pressable, ScrollView, Share, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Copy, Download, GraduationCap, ImageIcon, Link2, Share2, Trash2 } from 'lucide-react-native';
import { radius, spacing } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store/authStore';
import { useAcademicData } from '@/lib/store/useAcademicData';
import { transcriptApi } from '@/lib/api/client';
import { db } from '@/lib/firebase/client';
import { useThemeColors } from '@/lib/store/themeStore';
import { useToastStore } from '@/lib/store/toastStore';
import { getGradeColor } from '@/lib/cgpa/gradeScale';

interface SharedTranscript {
  id: string;
  expiresAt?: any;
  createdAt?: any;
  showPhoto?: boolean;
}

const PUBLIC_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://acadegrade.vercel.app';

function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function degreeClassFor(cgpa: number) {
  if (cgpa >= 4.5) return 'First Class Honours';
  if (cgpa >= 3.5) return 'Second Class Honours (Upper Division)';
  if (cgpa >= 2.4) return 'Second Class Honours (Lower Division)';
  if (cgpa >= 1.5) return 'Third Class Honours';
  return cgpa >= 1 ? 'Pass' : 'Not Classified';
}

export default function Transcript() {
  const colors = useThemeColors();
  const uid = useAuthStore((state) => state.firebaseUser?.uid);
  const firebaseUser = useAuthStore((state) => state.firebaseUser);
  const profile = useAuthStore((state) => state.profile);
  const showToast = useToastStore((state) => state.show);
  const { semesters, coursesBySemester } = useAcademicData();
  const [includePhoto, setIncludePhoto] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharedLinks, setSharedLinks] = useState<SharedTranscript[]>([]);

  const completedSemesters = useMemo(
    () => semesters.filter((semester) => semester.isComplete),
    [semesters],
  );

  const summary = useMemo(() => {
    let totalCredits = 0;
    let totalPoints = 0;
    let totalPiPoints = 0;
    completedSemesters.forEach((semester) => {
      totalCredits += semester.creditLoaded || 0;
      totalPoints += (semester.gpa || 0) * (semester.creditLoaded || 0);
      totalPiPoints += (semester.pi || 0) * (semester.creditLoaded || 0);
    });
    return {
      credits: totalCredits,
      cgpa: totalCredits ? totalPoints / totalCredits : 0,
      pi: totalCredits ? totalPiPoints / totalCredits : 0,
    };
  }, [completedSemesters]);

  useEffect(() => {
    if (!uid) return;
    return db.collection('shared_transcripts').where('uid', '==', uid).onSnapshot(
      (snapshot) => {
        const now = Date.now();
        const links = snapshot.docs
          .map((document) => ({ id: document.id, ...(document.data() as any) }) as SharedTranscript)
          .filter((link) => (toDate(link.expiresAt)?.getTime() ?? 0) > now)
          .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0));
        setSharedLinks(links);
      },
      () => setSharedLinks([]),
    );
  }, [uid]);

  async function generateAndShare() {
    setGenerating(true);
    try {
      const pdfBuffer = await transcriptApi.generate(includePhoto);
      const safeName = (profile?.fullName || 'Student').replace(/[^a-z0-9]+/gi, '_');
      const file = new File(Paths.cache, `${safeName}_Transcript.pdf`);
      file.create({ overwrite: true });
      file.write(new Uint8Array(pdfBuffer));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Share AcadeGrade Transcript' });
        showToast({ type: 'success', title: 'Transcript generated', message: 'Your PDF is ready to share or save.' });
      } else {
        Alert.alert('Transcript generated', `Saved temporarily at ${file.uri}`);
      }
    } catch (error: any) {
      Alert.alert('Could not generate transcript', error?.message ?? 'Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function createPublicLink() {
    setSharing(true);
    try {
      const result = await transcriptApi.share(includePhoto);
      setShareUrl(result.shareUrl);
      await Clipboard.setStringAsync(result.shareUrl);
      showToast({ type: 'success', title: 'Share link copied', message: 'The public link remains active for 30 days.' });
    } catch (error: any) {
      Alert.alert('Could not create link', error?.message ?? 'Please try again.');
    } finally {
      setSharing(false);
    }
  }

  async function copyLink(url: string) {
    await Clipboard.setStringAsync(url);
    setShareUrl(url);
    showToast({ type: 'success', title: 'Link copied' });
  }

  function revokeLink(link: SharedTranscript) {
    Alert.alert(
      'Delete shared link?',
      'Anyone with this link will immediately lose access to the shared transcript.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete link',
          style: 'destructive',
          onPress: async () => {
            try {
              await db.collection('shared_transcripts').doc(link.id).delete();
              if (shareUrl?.endsWith(link.id)) setShareUrl(null);
              showToast({ type: 'success', title: 'Shared link deleted' });
            } catch (error: any) {
              Alert.alert('Could not delete link', error?.message ?? 'Please try again.');
            }
          },
        },
      ],
    );
  }

  const photoUrl = profile?.avatarUrl || firebaseUser?.photoURL || null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.6 }}>Unofficial Transcript</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 3 }}>Preview, export, and securely share your completed academic record.</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          <Pressable
            onPress={() => setIncludePhoto((value) => !value)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, borderRadius: radius.md, borderWidth: 1, borderColor: includePhoto ? colors.primary : colors.border, backgroundColor: includePhoto ? colors.primaryDim : colors.surface }}
          >
            <ImageIcon size={15} color={includePhoto ? colors.primaryGlow : colors.textMuted} />
            <Text style={{ color: includePhoto ? colors.primaryGlow : colors.textMuted, fontWeight: '800', fontSize: 10 }}>{includePhoto ? 'Photo On' : 'Photo Off'}</Text>
            <Switch value={includePhoto} onValueChange={setIncludePhoto} style={{ transform: [{ scaleX: 0.65 }, { scaleY: 0.65 }], marginHorizontal: -7 }} trackColor={{ true: colors.primary, false: colors.border }} />
          </Pressable>
          <View style={{ flex: 1 }}><Button label="Share Link" variant="secondary" icon={<Link2 size={15} color={colors.text} />} onPress={createPublicLink} loading={sharing} fullWidth themeColors={colors} /></View>
        </View>
        <Button label="Generate & Share PDF" icon={<Download size={16} color="#FFFFFF" />} onPress={generateAndShare} loading={generating} fullWidth themeColors={colors} />

        {!!shareUrl && (
          <Animated.View entering={FadeInDown.duration(220)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primaryDim, borderWidth: 1, borderColor: colors.primary }}>
            <View style={{ flex: 1 }}><Text style={{ color: colors.primaryGlow, fontWeight: '800', fontSize: 11 }}>Link copied</Text><Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 3 }} numberOfLines={1}>{shareUrl}</Text></View>
            <Pressable onPress={() => Share.share({ title: 'AcadeGrade Transcript', message: shareUrl })} hitSlop={8}><Share2 size={18} color={colors.primaryGlow} /></Pressable>
          </Animated.View>
        )}

        {sharedLinks.length > 0 && (
          <Card themeColors={colors} style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: spacing.md }}><Link2 size={16} color={colors.primary} /><Text style={{ color: colors.text, fontWeight: '900', fontSize: 13 }}>Active shared transcripts</Text></View>
            {sharedLinks.map((link, index) => {
              const url = `${PUBLIC_BASE_URL}/share/${link.id}`;
              const expiry = toDate(link.expiresAt);
              return (
                <View key={link.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: index ? 1 : 0, borderTopColor: colors.borderSubtle }}>
                  <View style={{ flex: 1 }}><Text style={{ color: colors.textMuted, fontSize: 10 }}>Expires {expiry?.toLocaleDateString() ?? 'soon'} · {link.showPhoto === false ? 'No photo' : 'Photo included'}</Text><Text style={{ color: colors.text, fontSize: 10, marginTop: 3 }} numberOfLines={1}>{url}</Text></View>
                  <Pressable onPress={() => copyLink(url)} hitSlop={8} style={{ padding: 8 }}><Copy size={16} color={colors.primary} /></Pressable>
                  <Pressable onPress={() => revokeLink(link)} hitSlop={8} style={{ padding: 8 }}><Trash2 size={16} color={colors.danger} /></Pressable>
                </View>
              );
            })}
          </Card>
        )}

        <TranscriptPreview
          colors={colors}
          profile={profile}
          photoUrl={photoUrl}
          showPhoto={includePhoto}
          semesters={completedSemesters}
          coursesBySemester={coursesBySemester}
          summary={summary}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function TranscriptPreview({ colors, profile, photoUrl, showPhoto, semesters, coursesBySemester, summary }: any) {
  return (
    <View style={{ marginTop: spacing.lg, backgroundColor: '#FFFFFF', borderRadius: radius.lg, padding: spacing.lg, shadowColor: '#000000', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}>
      <View style={{ alignItems: 'center', paddingBottom: spacing.md, borderBottomWidth: 2, borderBottomColor: '#111827' }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}><GraduationCap size={23} color="#4F46E5" /></View>
        <Text style={{ color: '#111827', fontWeight: '900', fontSize: 15, textAlign: 'center', textTransform: 'uppercase' }}>{profile?.university || 'University Academic Record'}</Text>
        <Text style={{ color: '#6B7280', fontWeight: '800', fontSize: 9, letterSpacing: 1.4, marginTop: 5 }}>STUDENT UNOFFICIAL TRANSCRIPT</Text>
        <Text style={{ color: '#9CA3AF', fontSize: 8, marginTop: 4 }}>Generated by AcadeGrade</Text>
      </View>

      <View style={{ flexDirection: 'row', padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: '#111827' }}>
        {showPhoto && photoUrl && <Image source={{ uri: photoUrl }} style={{ width: 58, height: 70, marginRight: spacing.md, backgroundColor: '#F3F4F6' }} resizeMode="cover" />}
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#111827', fontWeight: '900', fontSize: 13 }}>{profile?.fullName || 'Student'}</Text>
          <Text style={{ color: '#4B5563', fontSize: 9, marginTop: 4 }}>Matric: {profile?.matric || '—'}</Text>
          <Text style={{ color: '#4B5563', fontSize: 9, marginTop: 3 }}>{profile?.department || 'Department not set'}</Text>
          <Text style={{ color: '#4B5563', fontSize: 9, marginTop: 3 }}>{profile?.programme || 'Programme not set'}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', marginVertical: spacing.md, backgroundColor: '#F3F4F6', borderRadius: 8, paddingVertical: spacing.sm }}>
        <PaperMetric label="CGPA" value={summary.cgpa.toFixed(2)} />
        <PaperMetric label="PI" value={summary.pi.toFixed(2)} />
        <PaperMetric label="CREDITS" value={String(summary.credits)} />
      </View>
      <Text style={{ color: '#111827', fontSize: 10, fontWeight: '900', marginBottom: spacing.md }}>{degreeClassFor(summary.cgpa)}</Text>

      {semesters.length ? semesters.map((semester: any) => (
        <View key={semester.id} style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#111827', paddingHorizontal: spacing.sm, paddingVertical: 7 }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 9 }}>{semester.label}</Text>
            <Text style={{ color: '#C7D2FE', fontWeight: '900', fontSize: 9 }}>GPA {Number(semester.gpa || 0).toFixed(2)}</Text>
          </View>
          {(coursesBySemester[semester.id] ?? []).map((course: any, index: number) => (
            <View key={course.id} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 34, paddingHorizontal: spacing.sm, borderWidth: 1, borderTopWidth: index ? 0 : 1, borderColor: '#D1D5DB' }}>
              <View style={{ flex: 1 }}><Text style={{ color: '#111827', fontWeight: '800', fontSize: 8 }}>{course.code}</Text><Text style={{ color: '#6B7280', fontSize: 7 }} numberOfLines={1}>{course.title}</Text></View>
              <Text style={{ color: '#4B5563', fontSize: 8, width: 28, textAlign: 'center' }}>{course.units}</Text>
              <Text style={{ color: getGradeColor(course.grade ?? 'F'), fontWeight: '900', fontSize: 9, width: 28, textAlign: 'center' }}>{course.isAR ? 'AR' : course.grade}</Text>
              <Text style={{ color: '#111827', fontWeight: '800', fontSize: 8, width: 34, textAlign: 'right' }}>{course.totalScore == null || course.isAR ? '—' : course.totalScore}</Text>
            </View>
          ))}
        </View>
      )) : (
        <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}><Text style={{ color: '#6B7280', fontSize: 10 }}>Complete a semester to populate your transcript.</Text></View>
      )}

      <Text style={{ color: '#9CA3AF', fontSize: 7, textAlign: 'center', borderTopWidth: 1, borderTopColor: '#D1D5DB', paddingTop: spacing.sm }}>Generated by AcadeGrade · Not an official university document</Text>
    </View>
  );
}

function PaperMetric({ label, value }: { label: string; value: string }) {
  return <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: '#6B7280', fontSize: 7, fontWeight: '800' }}>{label}</Text><Text style={{ color: '#111827', fontSize: 13, fontWeight: '900', marginTop: 2 }}>{value}</Text></View>;
}
