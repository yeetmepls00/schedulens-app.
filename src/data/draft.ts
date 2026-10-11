// Holds an import between the Scan screen and the Verify screen.
// Nothing here is saved until the user taps Confirm.
import type { ExtractedEvent } from '../lib/types';

export interface ImportDraft {
  fileName: string;
  uri: string | null;
  kind: 'image' | 'pdf';
  rows: string[];
  events: ExtractedEvent[];
}

let draft: ImportDraft | null = null;
export const setDraft = (d: ImportDraft | null) => { draft = d; };
export const getDraft = () => draft;
