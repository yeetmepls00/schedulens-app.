// Reads text from a schedule photo or screenshot, on the phone.
//
// Uses Google ML Kit text recognition, which runs offline on Android and iOS.
// ML Kit is native code, so it works in a development build (npx expo run:android
// or eas build), NOT in the Expo Go app.
import { NativeModules } from 'react-native';
import { groupIntoRows, parseScheduleText, type PositionedLine } from './parser';
import type { ExtractedEvent } from './types';

export class OcrUnavailableError extends Error {}

export interface OcrResult {
  rows: string[];
  events: ExtractedEvent[];
}

export async function readScheduleImage(uri: string): Promise<OcrResult> {
  // Check first so Expo Go shows a clear message instead of crashing.
  if (!NativeModules.TextRecognition) {
    throw new OcrUnavailableError(
      'Text reading needs the ScheduLens development build. Expo Go cannot run it. You can still enter your schedule manually.',
    );
  }
  const TextRecognition = (await import('@react-native-ml-kit/text-recognition')).default;
  const result = await TextRecognition.recognize(uri);
  const lines: PositionedLine[] = result.blocks.flatMap((b) => b.lines.map((l) => ({ text: l.text, frame: l.frame })));
  const rows = groupIntoRows(lines);
  return { rows, events: parseScheduleText(rows) };
}
