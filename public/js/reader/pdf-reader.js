// Trình đọc PDF: giữ bố cục trang (canvas) + lớp văn bản pdf.js để bôi chọn. Có zoom.
import * as pdfjsLib from '/vendor/pdfjs/pdf.min.mjs';
import { setupReader } from './common.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
const ZOOMS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

setupReader((ctx) => {
  let doc = null;
  let page = 1;
  let zoom = 1;
  let textDiv = null;
  let renderTask = null;
  let renderSeq = 0;

  async function resolveDest(dest) {
    try {
      const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
      if (!explicit) return null;
      const ref = explicit[0];
      return typeof ref === 'number' ? ref + 1 : (await doc.getPageIndex(ref)) + 1;
    } catch {
      return null;
    }
  }

  async function buildToc() {
    const outline = (await doc.getOutline()) || [];
    const out = [];
    const walk = async (items, depth) => {
      for (const it of items) {
        const p = await resolveDest(it.dest);
        if (p) out.push({ label: it.title, depth, location: { page: p } });
        if (it.items?.length && depth < 2) await walk(it.items, depth + 1);
      }
    };
    await walk(outline, 0);
    return out;
  }

  async function render() {
    const seq = ++renderSeq;
    renderTask?.cancel();
    const pdfPage = await doc.getPage(page);
    if (seq !== renderSeq) return;
    const base = pdfPage.getViewport({ scale: 1 });
    const available = Math.max(280, ctx.content.clientWidth || 800);
    const scale = Math.min(available / base.width, 1.6) * zoom;
    const viewport = pdfPage.getViewport({ scale });
    const ratio = window.devicePixelRatio || 1;

    const pageDiv = document.createElement('div');
    pageDiv.className = 'pdf-page';
    pageDiv.style.width = `${Math.floor(viewport.width)}px`;
    pageDiv.style.height = `${Math.floor(viewport.height)}px`;
    pageDiv.style.setProperty('--scale-factor', String(scale));
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    canvas.setAttribute('aria-hidden', 'true');
    textDiv = document.createElement('div');
    textDiv.className = 'textLayer';
    pageDiv.append(canvas, textDiv);

    renderTask = pdfPage.render({
      canvasContext: canvas.getContext('2d'),
      viewport,
      transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
    });
    try {
      await renderTask.promise;
    } catch (err) {
      if (err?.name === 'RenderingCancelledException') return;
      throw err;
    }
    if (seq !== renderSeq) return;

    const textContent = await pdfPage.getTextContent();
    const hasText = textContent.items.some((i) => i.str && i.str.trim());
    await new pdfjsLib.TextLayer({ textContentSource: textContent, container: textDiv, viewport }).render();
    if (seq !== renderSeq) return;

    ctx.content.replaceChildren(pageDiv);
    ctx.content.style.overflowX = viewport.width > available ? 'auto' : '';
    document.querySelector('[data-zoom-label]').textContent = `${Math.round(zoom * 100)}%`;
    ctx.showNotice(
      hasText
        ? ''
        : 'This page has no text layer (it is probably a scan): you can read it, but you cannot select, highlight or save text yet. OCR comes in a later phase.',
    );
    ctx.rendered();
  }

  const clampPage = (p) => Math.min(Math.max(1, Math.round(p || 1)), doc.numPages);

  return {
    toc: [],
    get totalUnits() {
      return doc?.numPages;
    },
    async init() {
      doc = await pdfjsLib.getDocument({
        url: ctx.config.fileUrl,
        cMapUrl: '/vendor/pdfjs/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: '/vendor/pdfjs/standard_fonts/',
        isEvalSupported: false,
      }).promise;
      this.toc = await buildToc();
      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(render, 250);
      });
    },
    async goTo(loc) {
      page = clampPage(loc?.page || 1);
      if (loc?.zoom) zoom = loc.zoom;
      await render();
      window.scrollTo({ top: 0 });
    },
    next() {
      if (page < doc.numPages) this.goTo({ page: page + 1 });
    },
    prev() {
      if (page > 1) this.goTo({ page: page - 1 });
    },
    adjust(delta) {
      const i = ZOOMS.findIndex((z) => z >= zoom - 0.001);
      zoom = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, (i < 0 ? 4 : i) + delta))];
      render();
    },
    location: () => ({ page, zoom }),
    label: () => (doc ? `Page ${page}/${doc.numPages}` : ''),
    progress: () => (doc ? page / doc.numPages : 0),
    sameUnit: (a, b) => Boolean(a && b && a.page === b.page),
    roots: () => (textDiv ? [textDiv] : []),
    async makeCover() {
      const first = await doc.getPage(1);
      const base = first.getViewport({ scale: 1 });
      const viewport = first.getViewport({ scale: 360 / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await first.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    },
  };
});
