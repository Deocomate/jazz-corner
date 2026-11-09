// Lấy chữ từ PDF ngay trên server (dùng bản legacy của pdf.js cho Node).
// Chỉ đọc vài trang được yêu cầu để nhanh với sách dày.

let pdfjsPromise = null;
const loadPdfjs = () => (pdfjsPromise ??= import('pdfjs-dist/legacy/build/pdf.mjs'));

/** Trả về [{ page, text }] cho các trang hợp lệ trong `pages`. PDF scan (không có chữ) trả text rỗng. */
export async function pdfPagesText(buffer, pages) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: true, verbosity: 0 }).promise;
  try {
    const wanted = [...new Set(pages)].filter((p) => p >= 1 && p <= doc.numPages);
    const out = [];
    for (const p of wanted) {
      const content = await (await doc.getPage(p)).getTextContent();
      out.push({ page: p, text: content.items.map((i) => i.str + (i.hasEOL ? '\n' : ' ')).join('').replace(/\s+/g, ' ').trim() });
    }
    return { numPages: doc.numPages, pages: out };
  } finally {
    await doc.destroy();
  }
}
