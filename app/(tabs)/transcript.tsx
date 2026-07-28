import { useState } from 'react';
import { View, Text, Switch, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { colors, spacing } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store/authStore';
import { transcriptApi } from '@/lib/api/client';

export default function Transcript() {
  const profile = useAuthStore((s) => s.profile);
  const [includePhoto, setIncludePhoto] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  async function generateAndShare() {
    setGenerating(true);
    try {
      // Backend does the PDF generation — mobile never generates client-side
      // (01_CONTEXT.md §9: "Client-side PDF generation — call the existing
      // API instead").
      const { pdfBase64 } = await transcriptApi.generate(includePhoto);
      const fileUri = `${FileSystem.cacheDirectory}transcript.pdf`;
      await FileSystem.writeAsStringAsync(fileUri, pdfBase64, { encoding: FileSystem.EncodingType.Base64 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'AcadeGrade Transcript' });
      }
    } finally {
      setGenerating(false);
    }
  }

  async function createPublicLink() {
    setSharing(true);
    try {
      const { url } = await transcriptApi.share();
      setShareUrl(url);
      await Clipboard.setStringAsync(url);
    } finally {
      setSharing(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.void }}>
      <View style={{ padding: spacing.lg }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.lg }}>Transcript</Text>

        <Card style={{ marginBottom: spacing.lg, alignItems: 'center' }}>
          {includePhoto && profile?.avatarUrl && (
            <Image source={{ uri: profile.avatarUrl }} style={{ width: 72, height: 72, borderRadius: 36, marginBottom: spacing.md }} />
          )}
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{profile?.fullName}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{profile?.matric} · {profile?.university}</Text>
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
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
          <Text style={{ color: colors.primaryGlow, fontSize: 13, marginTop: spacing.md, textAlign: 'center' }}>
            Link copied to clipboard: {shareUrl}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
