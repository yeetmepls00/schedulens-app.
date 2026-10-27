// Draws the weekly timetable onto a canvas, in the person's timetable colors,
// and saves it as a photo (PNG) or a PDF. Runs on the web only.
import { DAY_SHORT, formatTime } from './time';
import { colorFor, layoutDay, textOn, type TimetableStyle } from './timetable';
import type { ScheduleEvent } from './types';
import { saveFile } from './save-file';

const SCALE = 2; // sharp on phone screens and in print

export async function drawTimetable(events: ScheduleEvent[], style: TimetableStyle, title: string): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const days = style.days;
  const visible = events.filter((e) => days.includes(e.weekday));
  // Fit the hours to the events so nothing is cut off.
  const startH = Math.min(style.startHour, ...visible.map((e) => Math.floor(e.startMin / 60)));
  const endH = Math.max(style.endHour, ...visible.map((e) => Math.ceil(e.endMin / 60)));
  const hours = Math.max(1, endH - startH);
  const W = 1200, pad = 36, timeW = 70, headH = 44, titleH = 70, hourH = 64;
  const colW = (W - pad * 2 - timeW) / days.length;
  const H = pad * 2 + titleH + headH + hours * hourH + 30;

  const c = document.createElement('canvas');
  c.width = W * SCALE; c.height = H * SCALE;
  const g = c.getContext('2d')!;
  g.scale(SCALE, SCALE);
  g.fillStyle = style.background; g.fillRect(0, 0, W, H);

  g.fillStyle = style.text; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.font = '600 34px Fredoka, Nunito, sans-serif';
  g.fillText(title, W / 2, pad + titleH / 2 - 6);

  const top = pad + titleH + headH, left = pad + timeW;
  g.font = '700 18px Nunito, sans-serif';
  days.forEach((d, i) => g.fillText(DAY_SHORT[d], left + colW * i + colW / 2, pad + titleH + headH / 2));

  g.strokeStyle = style.gridLine; g.lineWidth = 1;
  g.textAlign = 'right'; g.font = '600 14px Nunito, sans-serif'; g.fillStyle = style.mutedText;
  for (let h = 0; h <= hours; h++) {
    const y = top + h * hourH;
    g.beginPath(); g.moveTo(left, y); g.lineTo(left + colW * days.length, y); g.stroke();
    if (h < hours) g.fillText(formatTime((startH + h) * 60).replace(':00', ''), left - 10, y + 2);
  }
  for (let i = 0; i <= days.length; i++) {
    const x = left + colW * i;
    g.beginPath(); g.moveTo(x, top); g.lineTo(x, top + hours * hourH); g.stroke();
  }

  g.textAlign = 'left'; g.textBaseline = 'top';
  days.forEach((d, i) => {
    for (const { event: e, column, columns } of layoutDay(visible.filter((x) => x.weekday === d))) {
      const x = left + colW * i + (colW / columns) * column + 3;
      const w = colW / columns - 6;
      const y = top + ((e.startMin - startH * 60) / 60) * hourH + 2;
      const h = Math.max(26, ((e.endMin - e.startMin) / 60) * hourH - 4);
      const fill = colorFor(e, events, style);
      g.fillStyle = fill;
      g.beginPath(); g.roundRect(x, y, w, h, 10); g.fill();
      g.fillStyle = textOn(fill);
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      g.font = '700 15px Nunito, sans-serif';
      const lines = wrap(g, e.title, w - 12).slice(0, Math.max(1, Math.floor((h - 26) / 18)));
      lines.forEach((t, n) => g.fillText(t, x + 6, y + 6 + n * 18));
      g.font = '600 12px Nunito, sans-serif';
      const sub = [`${formatTime(e.startMin)}–${formatTime(e.endMin)}`, style.showRoom && e.location].filter(Boolean).join(' · ');
      if (8 + lines.length * 18 + 14 <= h) g.fillText(sub, x + 6, y + 8 + lines.length * 18);
      g.restore();
    }
  });

  g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillStyle = style.mutedText; g.font = '600 13px Nunito, sans-serif';
  g.fillText('Made with ScheduLens', W - pad, H - 12);
  return c;
}

function wrap(g: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = []; let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > width && line) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

const stamp = () => new Date().toISOString().slice(0, 10);

export async function exportTimetablePng(events: ScheduleEvent[], style: TimetableStyle, title: string) {
  const c = await drawTimetable(events, style, title);
  const blob = await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error('Could not draw the picture'))), 'image/png'));
  return saveFile(blob, `timetable-${stamp()}.png`, 'My timetable');
}

export async function exportTimetablePdf(events: ScheduleEvent[], style: TimetableStyle, title: string) {
  const c = await drawTimetable(events, style, title);
  const { jsPDF } = await import('jspdf');
  const w = c.width / SCALE, h = c.height / SCALE;
  const pdf = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'px', format: [w, h] });
  pdf.addImage(c.toDataURL('image/png'), 'PNG', 0, 0, w, h);
  return saveFile(pdf.output('blob'), `timetable-${stamp()}.pdf`, 'My timetable');
}
