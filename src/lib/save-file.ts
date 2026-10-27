// Hands a file to the person: the share sheet when the phone supports sharing
// files (installed apps often block downloads), otherwise a normal download.
// Returns false if they closed the share sheet.
export async function saveFile(blob: Blob, name: string, title: string): Promise<boolean> {
  try {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return true;
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return false;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}
