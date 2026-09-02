import { useState } from 'react';
import { View, Text, Switch, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { spacing } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store/authStore';
import { transcriptApi } from '@/lib/api/client';
import { useThemeColors } from '@/lib/store/themeStore';

/** Converted to light theme this round — structure/logic unchanged. */
export default function Transcript() {
  const colors = useThemeColors();
  const profile = useAuthStore((s) => s.profile);
  const [includePhoto, setIncludePhoto] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  async function generateAndShare() {
    setGenerating(true);
    try {
      const pdfBuffer = await transcriptApi.generate(includePhoto);
      const file = new File(Paths.cache, 'transcript.pdf');
      file.create({ overwrite: true });
      file.write(new Uint8Array(pdfBuffer));
      const fileUri = file.uri;

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'AcadeGrade Transcript' });
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
      const { shareUrl } = await transcriptApi.share(includePhoto);
      setShareUrl(shareUrl);
      await Clipboard.setStringAsync(shareUrl);
    } catch (error: any) {
      Alert.alert('Could not create link', error?.message ?? 'Please try again.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <View style={{ padding: spacing.lg }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.lg }}>Transcript</Text>

        <Card themeColors={colors} style={{ marginBottom: spacing.lg, alignItems: 'center' }}>
          {includePhoto && profile?.avatarUrl && (
            <Image source={{ uri: profile.avatarUrl }} style={{ width: 72, height: 72, borderRadius: 36, marginBottom: spacing.md }} />
          )}
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{profile?.fullName}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{profile?.matric} · {profile?.university}</Text>
        </Card>

        <Card themeColors={colors} style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>Show photo on transcript</Text>
            <Switch
              value={includePhoto}
              onValueChange={setIncludePhoto}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Card>

        <Button label="Generate & Share PDF" onPress={generateAndShare} loading={generating} fullWidth />
        <View style={{ height: spacing.md }} />
        <Button label="Create Public Share Link" variant="secondary" onPress={createPublicLink} loading={sharing} fullWidth />

        {shareUrl && (
          <Text style={{ color: colors.primary, fontSize: 13, marginTop: spacing.md, textAlign: 'center' }}>
            Link copied to clipboard: {shareUrl}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
