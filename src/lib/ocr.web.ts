// Reads text from a schedule image or PDF in the web browser.
//
// Images are read with Tesseract (open-source OCR) running inside the browser.
// PDFs are read with PDF.js: text-based PDFs give their text directly; scanned
// PDFs are turned into a picture and read with Tesseract. Nothing is uploaded:
// the files and the OCR engine both stay in this browser. The engine files are
// served from /assets/ocr (copied from the tesseract.js and pdfjs-dist packages).
import { groupIntoRows, parseScheduleText, type PositionedLine } from './parser';
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

async function ocr(image: string | HTMLCanvasElement, onProgress?: Progress): Promise<PositionedLine[]> {
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
    await worker.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: '11' });
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
  return { rows, events: parseScheduleText(rows) };
}

/** Small screenshots read better when enlarged first. */
async function prepareImage(uri: string): Promise<string | HTMLCanvasElement> {
  const img = new Image();
  img.src = uri;
  try { await img.decode(); } catch { throw new Error('This image could not be opened. It may be damaged or in an unsupported format.'); }
  if (img.naturalWidth >= 800) return uri;
  const scale = Math.min(3, 1200 / img.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function readScheduleImage(uri: string, onProgress?: Progress): Promise<OcrResult> {
  return finish(await ocr(await prepareImage(uri), onProgress));
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
      const scale = 2;
      const v = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = v.width; canvas.height = v.height;
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport: v }).promise;
      pageLines = (await ocr(canvas, onProgress)).map((l) => ({ ...l, frame: { ...l.frame!, top: offset + l.frame!.top / scale, left: l.frame!.left / scale, width: l.frame!.width / scale, height: l.frame!.height / scale } }));
    }
    lines.push(...pageLines);
    offset += view.height + 50;
  }
  return finish(lines);
}
