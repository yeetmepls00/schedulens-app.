// Saves the schedule as an .ics file and opens the share sheet, so it can be
// added to Google Calendar, Apple Calendar, or Outlook. Used by Vault,
// Import Success, and Data & Privacy.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { getSetting } from '../data/db';
import { buildIcs } from './ics';
import type { ScheduleEvent } from './types';

export class MissingTermDatesError extends Error {}

export async function exportIcs(events: ScheduleEvent[]) {
  const start = getSetting<string | null>('termStart', null), end = getSetting<string | null>('termEnd', null);
  if (!start || !end) throw new MissingTermDatesError('Set your term start and end dates in Settings first, so repeating events stop at the end of the term.');
  const text = buildIcs(events, new Date(start), new Date(end));
  if (Platform.OS === 'web') return download('schedulens.ics', text, 'text/calendar');
  const file = new File(Paths.cache, 'schedulens.ics');
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/calendar', UTI: 'public.calendar-event' });
}

/** Shares any text as a file (used by "Download my data"). */
export async function shareText(name: string, text: string, mimeType: string) {
  if (Platform.OS === 'web') return download(name, text, mimeType);
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType });
}

function download(name: string, text: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
