// Checks a chosen schedule file before it is read.
export const MAX_FILE_MB = 10;
const IMAGE = /\.(png|jpe?g|webp)$/i;
const PDF = /\.pdf$/i;

export type FileKind = 'image' | 'pdf';

/** Returns the kind of file, or an error message the user can act on. */
export function checkScheduleFile(name: string, mimeType: string | undefined, size: number | undefined): { kind: FileKind } | { error: string } {
  const mime = (mimeType ?? '').toLowerCase();
  const kind: FileKind | undefined =
    mime === 'application/pdf' || PDF.test(name) ? 'pdf'
    : /^image\/(png|jpe?g|webp)$/.test(mime) || IMAGE.test(name) ? 'image'
    : undefined;
  if (!kind) {
    if (/^image\/hei[cf]$/.test(mime) || /\.hei[cf]$/i.test(name)) return { error: 'HEIC photos are not supported yet. Take a screenshot of the photo, or change your camera setting to “Most Compatible” (JPG).' };
    return { error: 'This file type is not supported. Choose a PNG, JPG, or PDF file.' };
  }
  if (size !== undefined && size > MAX_FILE_MB * 1024 * 1024) return { error: `This file is larger than ${MAX_FILE_MB} MB. Choose a smaller file or crop the image to the schedule.` };
  if (size === 0) return { error: 'This file is empty. Choose another file.' };
  return { kind };
}
