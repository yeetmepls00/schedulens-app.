// Scan: choose a schedule image or PDF, read it, then go to Verify.
// Nothing is saved until the person checks every value on the Verify screen.
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Banner, Button, Card, Screen, T } from '../../components/ui';
import { setDraft } from '../../data/draft';
import { checkScheduleFile, MAX_FILE_MB, type FileKind } from '../../lib/fileCheck';
import { OcrUnavailableError, readScheduleImage, readSchedulePdf } from '../../lib/ocr';
import { colors, radius } from '../../theme/tokens';

export default function Scan() {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<{ text: string; fraction?: number } | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const web = Platform.OS === 'web';

  async function read(uri: string, fileName: string, kind: FileKind) {
    setBusy(true); setError(null); setStage({ text: 'Preparing' });
    try {
      const progress = (text: string, fraction?: number) => setStage({ text, fraction });
      const { rows, events } = kind === 'pdf' ? await readSchedulePdf(uri, progress) : await readScheduleImage(uri, progress);
      if (events.length === 0) {
        setError({ title: 'No event times found', message: rows.length
          ? 'Text was found, but no event times like “9:00-10:30 AM”. Try a clearer, straight-on image of the whole table, or enter the schedule manually.'
          : 'No text could be read from this file. Try a sharper, well-lit image, or enter the schedule manually.' });
        return;
      }
      setDraft({ fileName, uri: kind === 'image' ? uri : null, kind, rows, events });
      router.push('/verify');
    } catch (e) {
      setError({ title: 'Could not read the file', message: e instanceof OcrUnavailableError || e instanceof Error ? e.message : 'Please try another file.' });
    } finally { setBusy(false); setStage(null); }
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setError({ title: 'Camera is off', message: 'Turn on camera access in your settings, or choose a file instead.' }); return; }
    const r = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!r.canceled) await read(r.assets[0].uri, 'Camera photo', 'image');
  }

  async function chooseFile() {
    setError(null);
    const r = await DocumentPicker.getDocumentAsync({ type: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'], copyToCacheDirectory: true });
    if (r.canceled) return;
    const a = r.assets[0];
    const check = checkScheduleFile(a.name, a.mimeType, a.size);
    if ('error' in check) { setError({ title: 'Can’t use this file', message: check.error }); return; }
    await read(a.uri, a.name, check.kind);
  }

  return (
    <Screen title="Add a schedule">
      <T color={colors.textSecondary}>ScheduLens reads your schedule {web ? 'in this browser' : 'on this phone'}. The file is not uploaded anywhere.</T>
      {error && <Banner tone="error" title={error.title} message={error.message} />}
      {stage && (
        <Card style={{ gap: 8 }}>
          <T v="label">{stage.text}{stage.fraction !== undefined ? ` · ${Math.round(stage.fraction * 100)}%` : '…'}</T>
          <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.border, overflow: 'hidden' }}>
            <View style={{ height: 8, width: `${Math.round((stage.fraction ?? 0.05) * 100)}%`, backgroundColor: colors.strawberry }} />
          </View>
          <T v="caption" color={colors.textSecondary}>The first scan downloads the text reader (about 12 MB), so it takes longer.</T>
        </Card>
      )}
      <Card style={{ gap: 12 }}>
        {!web && <Button label="Take a photo" icon="camera" onPress={takePhoto} loading={busy} />}
        <Button label="Choose an image or PDF" icon="document" kind={web ? 'primary' : 'secondary'} onPress={chooseFile} loading={web && busy} disabled={!web && busy} />
        <Button label="Enter manually" icon="create" kind="tonal" onPress={() => router.push('/event/new')} disabled={busy} />
      </Card>
      <T v="caption" color={colors.textSecondary}>Supported: PNG, JPG and PDF, up to {MAX_FILE_MB} MB. A flat, well-lit image with the whole table visible gives the best results. You will check every value before anything is saved.</T>
    </Screen>
  );
}
