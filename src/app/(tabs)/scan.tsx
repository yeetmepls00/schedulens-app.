// Scan: pick a schedule photo, read it on the phone, then go to Verify.
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Banner, Button, Card, Screen, T } from '../../components/ui';
import { setDraft } from '../../data/draft';
import { OcrUnavailableError, readScheduleImage } from '../../lib/ocr';
import { colors } from '../../theme/tokens';

export default function Scan() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function read(uri: string, fileName: string) {
    setBusy(true); setError(null);
    try {
      const { rows, events } = await readScheduleImage(uri);
      if (events.length === 0) {
        setError('No class times were found in this image. Try a clearer, straight-on photo, or enter the schedule manually.');
        return;
      }
      setDraft({ fileName, uri, kind: 'image', rows, events });
      router.push('/verify');
    } catch (e) {
      setError(e instanceof OcrUnavailableError ? e.message : 'The image could not be read. Please try another photo.');
    } finally { setBusy(false); }
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setError('Camera permission is off. You can turn it on in your phone settings, or choose an image instead.'); return; }
    const r = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!r.canceled) await read(r.assets[0].uri, 'Camera photo');
  }

  async function chooseImage() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!r.canceled) await read(r.assets[0].uri, r.assets[0].fileName ?? 'Schedule image');
  }

  async function choosePdf() {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (r.canceled) return;
    // Honest limitation: on-device PDF reading is not built yet.
    setError('Reading PDFs is not built yet. Please take a screenshot of the PDF and choose it as an image.');
  }

  return (
    <Screen title="Add a schedule">
      <T color={colors.textSecondary}>ScheduLens reads your schedule on this phone. The image is not uploaded anywhere.</T>
      {error && <Banner tone="error" title="Could not read" message={error} />}
      <Card style={{ gap: 12 }}>
        <Button label="Take a photo" icon="camera" onPress={takePhoto} loading={busy} />
        <Button label="Choose an image" icon="image" kind="secondary" onPress={chooseImage} disabled={busy} />
        <Button label="Choose a PDF" icon="document" kind="secondary" onPress={choosePdf} disabled={busy} />
        <Button label="Enter manually" icon="create" kind="tonal" onPress={() => router.push('/event/new')} disabled={busy} />
      </Card>
      <T v="caption" color={colors.textSecondary}>Tip: a flat, well-lit photo with the whole table visible gives the best results. You will check every value before anything is saved.</T>
    </Screen>
  );
}
