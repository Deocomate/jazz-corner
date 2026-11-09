// Trình đọc EPUB: hiển thị từng chương thành một cột chữ dễ đọc, chỉnh cỡ chữ,
// nhớ vị trí theo chương + tỉ lệ cuộn. Nội dung sách được làm sạch trước khi hiển thị.
import { setupReader } from './common.js';

const ALLOWED = new Set(
  'p div span section article aside header footer main h1 h2 h3 h4 h5 h6 blockquote em i strong b u small sub sup br hr ul ol li dl dt dd a img figure figcaption table thead tbody tfoot tr td th pre code cite q abbr'.split(' '),
);
const DROP = new Set('script style iframe object embed form input button link meta noscript template audio video canvas'.split(' '));

setupReader((ctx) => {
  const { id } = ctx.config;
  let spine = [];
  let chapter = 0;
  let scrollRatio = 0;
  let tocEntries = [];
  let fontSize = Number(localStorage.getItem('epubFontSize')) || 19;
  let textRoot = null;

  const resolve = (base, href) => decodeURIComponent(new URL(href, `http://epub/${base}`).pathname.slice(1));
  const resourceUrl = (path) => `/books/${id}/epub-file?path=${encodeURIComponent(path)}`;

  function sanitize(node, chapterPath, out) {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        out.append(document.createTextNode(child.nodeValue));
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = child.localName.toLowerCase();
      if (DROP.has(tag)) continue;
      if (tag === 'image' || (tag === 'img' && child.getAttribute('src'))) {
        const src = child.getAttribute('src') || child.getAttribute('xlink:href') || child.getAttribute('href');
        if (src && !/^(https?:|data:|javascript:)/i.test(src)) {
          const img = document.createElement('img');
          img.src = resourceUrl(resolve(chapterPath, src));
          img.alt = child.getAttribute('alt') || '';
          img.loading = 'lazy';
          out.append(img);
        }
        continue;
      }
      if (tag === 'svg') {
        // Bìa EPUB hay dùng <svg><image/></svg>: chỉ lấy ảnh bên trong.
        sanitize(child, chapterPath, out);
        continue;
      }
      if (!ALLOWED.has(tag)) {
        sanitize(child, chapterPath, out); // giữ chữ, bỏ thẻ lạ
        continue;
      }
      const el = document.createElement(tag);
      if (tag === 'a') {
        const href = child.getAttribute('href') || '';
        if (/^https?:/i.test(href)) {
          el.href = href;
          el.target = '_blank';
          el.rel = 'noopener noreferrer';
        } else if (href && !/^(javascript|data):/i.test(href)) {
          const targetPath = resolve(chapterPath, href.split('#')[0] || chapterPath.split('/').pop());
          const idx = spine.indexOf(targetPath);
          if (idx >= 0) {
            el.href = '#';
            el.dataset.chapter = String(idx);
          }
        }
      }
      if ((tag === 'td' || tag === 'th') && child.getAttribute('colspan')) el.colSpan = Number(child.getAttribute('colspan')) || 1;
      sanitize(child, chapterPath, el);
      out.append(el);
    }
  }

  async function loadChapter() {
    const path = spine[chapter];
    const res = await fetch(resourceUrl(path));
    if (!res.ok) throw new Error(`chapter ${chapter + 1} could not be loaded`);
    const raw = await res.text();
    let parsed = new DOMParser().parseFromString(raw, 'application/xhtml+xml');
    if (parsed.querySelector('parsererror')) parsed = new DOMParser().parseFromString(raw, 'text/html');
    const wrapper = document.createElement('article');
    wrapper.className = 'epub-text';
    wrapper.lang = 'en';
    wrapper.style.fontSize = `${fontSize}px`;
    sanitize(parsed.body || parsed.documentElement, path, wrapper);
    ctx.content.replaceChildren(wrapper);
    textRoot = wrapper;
  }

  function restoreScroll() {
    const top = ctx.content.getBoundingClientRect().top + window.scrollY;
    const max = Math.max(0, ctx.content.offsetHeight - window.innerHeight + 120);
    window.scrollTo({ top: scrollRatio > 0 ? top + scrollRatio * max : 0 });
  }

  function readScroll() {
    const top = ctx.content.getBoundingClientRect().top + window.scrollY;
    const max = Math.max(1, ctx.content.offsetHeight - window.innerHeight + 120);
    return Math.min(1, Math.max(0, (window.scrollY - top) / max));
  }

  function seenRatio() {
    const doc = document.documentElement;
    if (window.scrollY + window.innerHeight >= doc.scrollHeight - 4) return 1;
    const r = ctx.content.getBoundingClientRect();
    if (!r.height) return 0;
    const footer = document.querySelector('.reader-footer')?.getBoundingClientRect().top ?? window.innerHeight;
    return Math.min(1, Math.max(0, (footer - r.top) / r.height));
  }

  let scrollTimer;
  window.addEventListener(
    'scroll',
    () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        scrollRatio = readScroll();
        ctx.moved();
      }, 300);
    },
    { passive: true },
  );
  ctx.content.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-chapter]');
    if (!link) return;
    e.preventDefault();
    adapter.goTo({ chapter: Number(link.dataset.chapter) });
  });

  const currentTocLabel = () => {
    let label = null;
    for (const t of tocEntries) if (t.chapter <= chapter) label = t.label;
    return label;
  };

  const adapter = {
    toc: [],
    get totalUnits() {
      return spine.length;
    },
    async init() {
      const data = await window.api(`/api/books/${id}/epub`);
      spine = data.spine;
      tocEntries = data.toc;
      this.toc = data.toc.map((t) => ({ label: t.label, location: { chapter: t.chapter } }));
    },
    async goTo(loc) {
      chapter = Math.min(Math.max(0, loc?.chapter ?? 0), spine.length - 1);
      scrollRatio = loc?.scroll ?? 0;
      await loadChapter();
      restoreScroll();
      ctx.rendered();
    },
    next() {
      if (chapter < spine.length - 1) this.goTo({ chapter: chapter + 1 });
    },
    prev() {
      if (chapter > 0) this.goTo({ chapter: chapter - 1 });
    },
    adjust(delta) {
      fontSize = Math.min(30, Math.max(14, fontSize + delta * 2));
      localStorage.setItem('epubFontSize', String(fontSize));
      if (textRoot) textRoot.style.fontSize = `${fontSize}px`;
    },
    location: () => ({ chapter, scroll: Math.round(scrollRatio * 1000) / 1000 }),
    label: () => {
      const toc = currentTocLabel();
      return `${toc ? toc : `Part ${chapter + 1}`} · ${chapter + 1}/${spine.length}`;
    },
    // Tiến độ = phần chương đã thấy (đáy chương hiện trên màn hình ⇒ đọc xong chương), nên chương cuối đạt 100%.
    progress: () => (spine.length ? (chapter + seenRatio()) / spine.length : 0),
    sameUnit: (a, b) => Boolean(a && b && a.chapter === b.chapter),
    roots: () => (textRoot ? [textRoot] : []),
  };
  return adapter;
});
