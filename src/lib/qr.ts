// Reading group QR codes on the web, from a picture or the camera.
import jsQR from 'jsqr';

export const APP_URL = 'https://schedulens.vercel.app';

/** The link a group QR code holds. Scanning it with any phone camera opens Join Group. */
export const joinLink = (code: string) => `${APP_URL}/join?code=${encodeURIComponent(code)}`;

/** Pulls the invite code out of a scanned QR: a join link, or a plain code from older QR codes. */
export function codeFromQr(text: string): string | null {
  const t = text.trim();
  try { const c = new URL(t).searchParams.get('code'); if (c) return c.toUpperCase(); } catch { /* not a link */ }
  return /^[A-Z0-9-]{4,16}$/i.test(t) ? t.toUpperCase() : null;
}

/** Looks for a QR code in an image (any size). */
export function readQrFromImage(uri: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const r = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
      resolve(r?.data ?? null);
    };
    img.onerror = () => reject(new Error('That file is not a picture we can read.'));
    img.src = uri;
  });
}

/** Reads one video frame; returns the QR text if there is one. */
export function readQrFromVideo(video: HTMLVideoElement, canvas: HTMLCanvasElement): string | null {
  if (!video.videoWidth) return null;
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(video, 0, 0);
  return jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data ?? null;
}

/** Shares the app link (share sheet on phones, copy elsewhere). Returns 'shared' | 'copied'. */
export async function shareApp(): Promise<'shared' | 'copied'> {
  const text = 'Try ScheduLens, a free scheduler: snap your schedule and get a calendar.';
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try { await navigator.share({ title: 'ScheduLens', text, url: APP_URL }); return 'shared'; }
    catch (e) { if (e instanceof Error && e.name === 'AbortError') return 'shared'; }
  }
  await navigator.clipboard.writeText(`${text} ${APP_URL}`);
  return 'copied';
}
