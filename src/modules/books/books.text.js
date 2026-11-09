// Lấy đoạn chữ từ sách quanh vị trí đang đọc (cho Word of the Day).
import { readFile } from '#lib/storage.js';
import { parseEpub } from '#lib/epub.js';
import { extractEntry } from '#lib/zip.js';
import { pdfPagesText } from '#lib/pdf-text.js';

const stripHtml = (html) =>
  html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .trim();

/**
 * Trả về [{ text, location, label }] cho vài chương/trang bắt đầu từ vị trí đang đọc.
 * Lỗi đọc tệp (hỏng, thiếu) -> trả mảng rỗng, không làm hỏng trang Today.
 */
export async function textSamples(book, { units = 4 } = {}) {
  try {
    const buffer = await readFile('books', book.stored_name);
    if (!buffer) return [];
    if (book.format === 'epub') {
      const epub = parseEpub(buffer);
      const start = Math.min(book.position?.chapter ?? 0, epub.spine.length - 1);
      const out = [];
      for (let c = start; c < Math.min(epub.spine.length, start + units); c++) {
        const html = extractEntry(buffer, epub.entries, epub.spine[c])?.toString('utf8') ?? '';
        const label = [...epub.toc].reverse().find((t) => t.chapter <= c)?.label || `Part ${c + 1}`;
        out.push({ text: stripHtml(html), location: { chapter: c }, label });
      }
      return out;
    }
    const start = book.position?.page ?? 1;
    const { pages } = await pdfPagesText(buffer, Array.from({ length: units + 2 }, (_, i) => start + i));
    return pages.map((p) => ({ text: p.text, location: { page: p.page }, label: `Page ${p.page}` }));
  } catch {
    return [];
  }
}
