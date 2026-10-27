// Reads text from a schedule image or PDF in the web browser.
//
// Images are read with Tesseract (open-source OCR) running inside the browser.
// PDFs are read with PDF.js: text-based PDFs give their text directly; scanned
// PDFs are turned into a picture and read with Tesseract. Nothing is uploaded:
// the files and the OCR engine both stay in this browser. The engine files are
// served from /assets/ocr (copied from the tesseract.js and pdfjs-dist packages).
import { groupIntoRows, parseScheduleText, readTable, type PositionedLine, type TableRegions } from './parser';
import type { ExtractedEvent } from './types';

export class OcrUnavailableError extends Error {}

export interface OcrResult {
  rows: string[];
  events: ExtractedEvent[];
}

type Progress = (stage: string, fraction?: number) => void;
const BASE = '/assets/ocr';

let tesseractLoad: Promise<any> | null = null;
function loadTesseract(): Promise<any> {
  tesseractLoad ??= new Promise((resolve, reject) => {
    const w = window as any;
    if (w.Tesseract) return resolve(w.Tesseract);
    const s = document.createElement('script');
    s.src = `${BASE}/tesseract.min.js`;
    s.onload = () => resolve(w.Tesseract);
    s.onerror = () => { tesseractLoad = null; reject(new OcrUnavailableError('The text reader could not be loaded. Check your internet connection and try again.')); };
    document.head.appendChild(s);
  });
  return tesseractLoad;
}

// Loaded with a real browser import so the bundler leaves PDF.js untouched.
const importUrl = new Function('u', 'return import(u)') as (u: string) => Promise<any>;
async function loadPdfJs() {
  const pdfjs = await importUrl(`${BASE}/pdf.min.js`);
  pdfjs.GlobalWorkerOptions.workerSrc = `${BASE}/pdf.worker.min.js`;
  return pdfjs;
}

async function ocr(image: string | HTMLCanvasElement, onProgress?: Progress, psm = '11'): Promise<PositionedLine[]> {
  const Tesseract = await loadTesseract();
  onProgress?.('Starting the text reader', 0);
  const worker = await Tesseract.createWorker('eng', 1, {
    workerPath: `${BASE}/worker.min.js`,
    corePath: BASE,
    langPath: BASE,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.('Reading text', m.progress);
    },
  });
  try {
    // Sparse-text mode finds every table cell (the default mode skips some),
    // and the cells are joined back into rows by their position afterwards.
    await worker.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: psm });
    const { data } = await worker.recognize(image, {}, { blocks: true });
    const lines: PositionedLine[] = [];
    for (const b of data.blocks ?? []) for (const p of b.paragraphs ?? []) for (const l of p.lines ?? []) {
      const text = String(l.text ?? '').trim();
      if (!text) continue;
      lines.push({ text, frame: { top: l.bbox.y0, left: l.bbox.x0, width: l.bbox.x1 - l.bbox.x0, height: l.bbox.y1 - l.bbox.y0 } });
    }
    return lines;
  } finally {
    await worker.terminate();
  }
}

function finish(lines: PositionedLine[]): OcrResult {
  const rows = groupIntoRows(lines);
  return { rows, events: readTable(lines) ?? parseScheduleText(rows) };
}

// --- Cleaning up photos before reading ---------------------------------------
// Phone photos of printed schedules are tilted, shadowed, tinted and blurry,
// and table borders get mistaken for letters. Each photo is cleaned up in the
// browser first: resized, evened out, turned black-and-white, straightened,
// and the table lines removed. Nothing leaves the device.

export async function loadImage(uri: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = uri;
  try { await img.decode(); } catch { throw new Error('This image could not be opened. It may be damaged or in an unsupported format.'); }
  return img;
}

/** Draws the image at a size Tesseract reads well (text roughly 30 px tall). */
export function resized(img: HTMLImageElement, targetWidth = 2000): HTMLCanvasElement {
  const scale = Math.max(0.5, Math.min(4, targetWidth / img.naturalWidth));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** Grey levels with shadows and paper tint divided out, stretched to full contrast. */
export function evenGray(c: HTMLCanvasElement): Uint8ClampedArray {
  const { width: w, height: h } = c;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const px = g.getImageData(0, 0, w, h).data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  // Background estimate: a heavily blurred small copy (text disappears, lighting stays).
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(w / 24)); small.height = Math.max(1, Math.round(h / 24));
  const sg = small.getContext('2d', { willReadFrequently: true })!;
  sg.filter = 'blur(2px)';
  sg.drawImage(c, 0, 0, small.width, small.height);
  const big = document.createElement('canvas');
  big.width = w; big.height = h;
  const bg2 = big.getContext('2d', { willReadFrequently: true })!;
  bg2.imageSmoothingQuality = 'high';
  bg2.drawImage(small, 0, 0, w, h);
  const bpx = bg2.getImageData(0, 0, w, h).data;
  const out = new Uint8ClampedArray(w * h);
  const hist = new Uint32Array(256);
  for (let i = 0; i < w * h; i++) {
    const bgv = 0.299 * bpx[i * 4] + 0.587 * bpx[i * 4 + 1] + 0.114 * bpx[i * 4 + 2];
    // Light text on a dark background is turned around later; here keep the ratio.
    const v = Math.min(255, (gray[i] / Math.max(1, bgv)) * 235);
    out[i] = v; hist[out[i]]++;
  }
  // Stretch so the darkest 1% is black and the lightest 1% is white.
  let lo = 0, hi = 255, acc = 0;
  for (; lo < 255 && (acc += hist[lo]) < w * h * 0.01; lo++);
  acc = 0;
  for (; hi > 0 && (acc += hist[hi]) < w * h * 0.01; hi--);
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < out.length; i++) out[i] = ((out[i] - lo) * 255) / span;
  return out;
}

/** Otsu's threshold: the grey level that best splits ink from paper. */
function otsu(gray: Uint8ClampedArray): number {
  const hist = new Float64Array(256);
  for (const v of gray) hist[v]++;
  const total = gray.length;
  let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = 0, at = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; at = t; }
  }
  return at;
}

/** Erases long straight runs of ink (table borders), which Tesseract misreads as letters. */
function removeLines(ink: Uint8Array, w: number, h: number) {
  const minH = Math.round(w * 0.12), minV = Math.round(h * 0.12);
  const clear: number[] = [];
  for (let y = 0; y < h; y++) {
    let run = 0;
    for (let x = 0; x <= w; x++) {
      if (x < w && ink[y * w + x]) { run++; continue; }
      if (run >= minH) for (let k = x - run; k < x; k++) clear.push(y * w + k);
      run = 0;
    }
  }
  for (let x = 0; x < w; x++) {
    let run = 0;
    for (let y = 0; y <= h; y++) {
      if (y < h && ink[y * w + x]) { run++; continue; }
      if (run >= minV) for (let k = y - run; k < y; k++) clear.push(k * w + x);
      run = 0;
    }
  }
  for (const i of clear) ink[i] = 0;
}

/** The small tilt (in degrees) that makes text rows line up best. */
export function skewAngle(ink: Uint8Array, w: number, h: number): number {
  // Every row, every 3rd column, in 2-pixel bands; the angle whose bands are
  // the most uneven (sharp text rows with clean gaps between) wins.
  let best = 0, bestScore = -1;
  for (let a = -6; a <= 6; a += 0.25) {
    const t = Math.tan((a * Math.PI) / 180);
    const bands = new Float64Array(Math.ceil((h + w) / 2) + 2);
    const off = w * Math.abs(t);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x += 3) {
      if (!ink[y * w + x]) continue;
      const r = Math.floor((y - x * t + off) / 2);
      if (r >= 0 && r < bands.length) bands[r]++;
    }
    let score = 0;
    for (let i = 1; i < bands.length; i++) score += (bands[i] - bands[i - 1]) ** 2;
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return best;
}

/** Black where there is ink. Light text on a dark background is turned around. */
export function inkOf(gray: Uint8ClampedArray): Uint8Array {
  // A little below Otsu's level keeps blurry letters from bleeding together.
  const t = otsu(gray) * 0.9;
  const ink = new Uint8Array(gray.length);
  let dark = 0;
  for (let i = 0; i < gray.length; i++) if ((ink[i] = gray[i] < t ? 1 : 0)) dark++;
  if (dark > gray.length * 0.5) for (let i = 0; i < ink.length; i++) ink[i] = ink[i] ? 0 : 1;
  return ink;
}

function grayCanvas(gray: Uint8ClampedArray, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const img = g.createImageData(w, h);
  for (let i = 0; i < gray.length; i++) { img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = gray[i]; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  return c;
}

/** The photo straightened and evened out, in grey and in black-and-white without table lines. */
export function cleaned(c: HTMLCanvasElement): { gray: HTMLCanvasElement; bw: HTMLCanvasElement } {
  const { width: w, height: h } = c;
  let gray = evenGray(c);
  const angle = skewAngle(inkOf(gray), w, h);
  if (Math.abs(angle) >= 0.25) {
    const rot = document.createElement('canvas');
    rot.width = w; rot.height = h;
    const rg = rot.getContext('2d', { willReadFrequently: true })!;
    rg.fillStyle = '#fff'; rg.fillRect(0, 0, w, h);
    rg.translate(w / 2, h / 2); rg.rotate((-angle * Math.PI) / 180); rg.drawImage(grayCanvas(gray, w, h), -w / 2, -h / 2);
    const px = rg.getImageData(0, 0, w, h).data;
    gray = new Uint8ClampedArray(w * h);
    for (let i = 0; i < gray.length; i++) gray[i] = px[i * 4];
  }
  const ink = inkOf(gray);
  removeLines(ink, w, h);
  const out = new Uint8ClampedArray(w * h);
  for (let i = 0; i < ink.length; i++) out[i] = ink[i] ? 0 : 255;
  return { gray: grayCanvas(gray, w, h), bw: grayCanvas(out, w, h) };
}

/** How useful a reading is: events found matter most, then times and day words. */
function score(r: OcrResult): number {
  const text = r.rows.join('\n');
  const times = (text.match(/\d{1,2}:\d{2}/g) ?? []).length;
  const days = (text.match(/\b(?:mon|tue|wed|thu|fri|sat|sun|mwf|tth|mw)\w*/gi) ?? []).length;
  return r.events.length * 10 + times * 2 + days;
}

export async function readScheduleImage(uri: string, onProgress?: Progress): Promise<OcrResult> {
  const img = await loadImage(uri);
  return finish(await readCanvasLines(resized(img), onProgress));
}

/** Cleans a picture of a schedule, reads a few versions of it and keeps the reading that finds the most. */
export async function readCanvasLines(big: HTMLCanvasElement, onProgress?: Progress): Promise<PositionedLine[]> {
  onProgress?.('Cleaning up the photo');
  const clean = cleaned(big);
  const tries: [HTMLCanvasElement, string][] = [[clean.gray, '11'], [clean.bw, '11'], [big, '11']];
  let best: { lines: PositionedLine[]; score: number } | null = null;
  for (let i = 0; i < tries.length; i++) {
    const [image, psm] = tries[i];
    const lines = await ocr(image, (stage, f) => onProgress?.(`${stage} (pass ${i + 1} of ${tries.length})`, f), psm);
    const s = score(finish(lines));
    if (!best || s > best.score) best = { lines, score: s };
  }
  return closerLook(clean.gray, best!.lines, onProgress);
}

/**
 * Registration forms print the subject codes and days small and faint, and they
 * are often missed. Those two columns are cut out, enlarged and read again.
 */
async function closerLook(page: HTMLCanvasElement, lines: PositionedLine[], onProgress?: Progress): Promise<PositionedLine[]> {
  const regions: TableRegions = {};
  if (!readTable(lines, regions)) return lines;
  let out = lines;
  for (const box of [regions.code, regions.days]) {
    if (!box || box.width < 20) continue;
    const scale = 3;
    const c = document.createElement('canvas');
    c.width = Math.round(box.width * scale); c.height = Math.round(box.height * scale);
    const g = c.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(page, box.left, box.top, box.width, box.height, 0, 0, c.width, c.height);
    onProgress?.('Checking codes and days');
    const found = (await ocr(c, undefined, '6')).map((l) => ({
      text: l.text,
      frame: { left: box.left + l.frame!.left / scale, top: box.top + l.frame!.top / scale, width: l.frame!.width / scale, height: l.frame!.height / scale },
    }));
    if (!found.length) continue;
    // Keep the closer reading in place of what the full-page pass saw there.
    const inside = (l: PositionedLine) => {
      const cx = l.frame!.left + l.frame!.width / 2, cy = l.frame!.top + l.frame!.height / 2;
      return cx > box.left && cx < box.left + box.width && cy > box.top && cy < box.top + box.height;
    };
    out = [...out.filter((l) => !l.frame || !inside(l) || l.frame.width > box.width), ...found];
  }
  return out;
}

/** Pages read from a PDF. Long documents are cut off to keep the browser responsive. */
const MAX_PDF_PAGES = 5;

export async function readSchedulePdf(uri: string, onProgress?: Progress): Promise<OcrResult> {
  onProgress?.('Opening the PDF');
  const pdfjs = await loadPdfJs();
  const bytes = new Uint8Array(await (await fetch(uri)).arrayBuffer());
  let doc;
  try { doc = await pdfjs.getDocument({ data: bytes }).promise; }
  catch (e: any) {
    throw new Error(/password/i.test(String(e?.message)) ? 'This PDF is password-protected. Remove the password and try again.' : 'This file is not a readable PDF.');
  }
  const lines: PositionedLine[] = [];
  const pages = Math.min(doc.numPages, MAX_PDF_PAGES);
  let offset = 0;
  for (let n = 1; n <= pages; n++) {
    const page = await doc.getPage(n);
    const view = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    let pageLines: PositionedLine[] = content.items
      .filter((it: any) => typeof it.str === 'string' && it.str.trim())
      .map((it: any) => {
        const h = Math.abs(it.height || it.transform[3] || 10);
        return { text: it.str.trim(), frame: { top: offset + view.height - it.transform[5] - h, left: it.transform[4], width: it.width, height: h } };
      });
    if (pageLines.map((l) => l.text).join('').length < 20) {
      // No text layer: this is a scanned PDF. Draw the page and read it with OCR.
      onProgress?.(`Scanning page ${n} of ${pages}`);
      const scale = 2000 / view.width;
      const v = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = v.width; canvas.height = v.height;
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport: v }).promise;
      pageLines = (await readCanvasLines(canvas, onProgress)).map((l) => ({ ...l, frame: { ...l.frame!, top: offset + l.frame!.top / scale, left: l.frame!.left / scale, width: l.frame!.width / scale, height: l.frame!.height / scale } }));
    }
    lines.push(...pageLines);
    offset += view.height + 50;
  }
  return finish(lines);
}
