// Phần dùng chung của trình đọc PDF/EPUB: thanh công cụ, mục lục, bookmark, highlight,
// thao tác khi bôi chọn, tự lưu vị trí đọc. Mỗi định dạng cung cấp một "adapter":
//   { init(), goTo(loc), next(), prev(), location(), label(), progress(), totalUnits,
//     sameUnit(locA, locB), roots(), toc, adjust(delta), makeCover?() }
import { markText, unmark } from './mark.js';
import { attachSelectionBar } from '../selection.js';
import { openNotebookDialog } from '../notebook-save.js';
import { sendToSpeaking } from '../speaking-handoff.js';
import { createMeaningPanel, isShort } from '../meaning.js';

const $ = (sel, root = document) => root.querySelector(sel);

export async function setupReader(createAdapter) {
  const root = $('[data-reader]');
  const config = JSON.parse(root.dataset.config);
  const content = $('[data-reader-content]', root);
  const ui = {
    loading: $('[data-reader-loading]', root),
    error: $('[data-reader-error]', root),
    notice: $('[data-reader-notice]', root),
    label: $('[data-location-label]', root),
    bar: $('[data-progress-bar]', root),
  };
  let marks = { bookmarks: [], highlights: [] };
  let pendingFind = config.find;
  let saveTimer = null;

  const ctx = {
    config,
    content,
    showNotice(text) {
      ui.notice.textContent = text || '';
      ui.notice.hidden = !text;
    },
    // Adapter gọi sau mỗi lần hiển thị trang/chương mới hoặc khi cuộn.
    rendered: () => afterRender(),
    moved: () => scheduleSave(),
  };
  const adapter = createAdapter(ctx);

  // --- Lưu vị trí ---
  const positionPayload = () => ({
    position: adapter.location(),
    label: adapter.label(),
    progress: Math.min(1, Math.max(0, adapter.progress())),
    totalUnits: adapter.totalUnits || undefined,
  });
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => window.api(`/api/books/${config.id}/position`, { method: 'PUT', body: positionPayload() }).catch(() => {}), 700);
    updateStatus();
  }
  const flushSave = () => {
    clearTimeout(saveTimer);
    const token = document.querySelector('meta[name="csrf-token"]')?.content;
    fetch(`/api/books/${config.id}/position`, {
      method: 'PUT',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
      body: JSON.stringify(positionPayload()),
    }).catch(() => {});
  };
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushSave());

  function updateStatus() {
    ui.label.textContent = adapter.label();
    ui.bar.style.width = `${Math.round(adapter.progress() * 100)}%`;
  }

  // --- Highlight trong nội dung đang hiển thị ---
  function afterRender() {
    const here = adapter.location();
    for (const r of adapter.roots()) unmark(r, 'hl');
    for (const h of marks.highlights) {
      if (!adapter.sameUnit(h.location, here)) continue;
      for (const r of adapter.roots()) if (markText(r, h.text, 'hl', { title: h.note || 'Highlight' })) break;
    }
    if (pendingFind) {
      for (const r of adapter.roots()) {
        const el = markText(r, pendingFind, 'hl-flash');
        if (el) {
          el.scrollIntoView({ block: 'center' });
          break;
        }
      }
      pendingFind = null;
    }
    scheduleSave();
  }

  // --- Danh sách bookmark/highlight ---
  const li = (html) => Object.assign(document.createElement('li'), { innerHTML: html });
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  function renderMarks() {
    const bl = $('[data-bookmark-list]');
    bl.replaceChildren();
    if (!marks.bookmarks.length) bl.append(li('<p class="text-sm text-muted">No bookmarks yet.</p>'));
    for (const b of marks.bookmarks) {
      const item = li(`<div class="flex items-center gap-2"><button type="button" class="flex-1 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-brand-50">${esc(b.label)}</button><button type="button" class="btn-ghost btn-sm" aria-label="Delete bookmark">✕</button></div>`);
      const [go, del] = item.querySelectorAll('button');
      go.addEventListener('click', () => goTo(b.location));
      del.addEventListener('click', async () => {
        await window.api(`/api/books/${config.id}/bookmarks/${b.id}`, { method: 'DELETE' });
        await loadMarks();
      });
      bl.append(item);
    }
    const hl = $('[data-highlight-list]');
    hl.replaceChildren();
    if (!marks.highlights.length) hl.append(li('<p class="text-sm text-muted">Select some text, then choose Highlight. Add a note to any highlight here.</p>'));
    for (const h of marks.highlights) {
      const item = li(`<div class="rounded-xl border border-line p-3"><button type="button" class="w-full text-left"><span class="block font-serif text-sm italic">“${esc(h.text.slice(0, 220))}${h.text.length > 220 ? '…' : ''}”</span>${h.note ? `<span class="mt-1 block text-sm">✎ ${esc(h.note)}</span>` : ''}<span class="mt-1 block text-xs text-muted">${esc(h.location_label || '')}</span></button><div class="mt-2 flex gap-1"><button type="button" class="btn-ghost btn-sm" data-act="note">Note</button><button type="button" class="btn-ghost btn-sm text-red-700" data-act="del">Delete</button></div></div>`);
      item.querySelector('button').addEventListener('click', () => goTo(h.location, h.text));
      item.querySelector('[data-act="note"]').addEventListener('click', () => editNote(h));
      item.querySelector('[data-act="del"]').addEventListener('click', async () => {
        await window.api(`/api/books/${config.id}/highlights/${h.id}`, { method: 'DELETE' });
        await loadMarks();
        afterRender();
      });
      hl.append(item);
    }
  }
  async function loadMarks() {
    marks = await window.api(`/api/books/${config.id}/marks`);
    renderMarks();
  }

  function closePanels() {
    document.querySelectorAll('dialog.side-panel[open]').forEach((d) => d.close());
  }
  async function goTo(location, find) {
    closePanels();
    pendingFind = find || null;
    await adapter.goTo(location);
  }

  // --- Ghi chú ---
  function askNote(quote, initial = '') {
    const dialog = $('[data-note-dialog]');
    $('[data-note-quote]', dialog).textContent = quote;
    const area = $('[data-note-text]', dialog);
    area.value = initial;
    return new Promise((resolve) => {
      const form = $('[data-note-form]', dialog);
      const done = (value) => {
        form.removeEventListener('submit', onSubmit);
        dialog.removeEventListener('close', onClose);
        resolve(value);
      };
      const onSubmit = (e) => {
        e.preventDefault();
        dialog.close();
        done(area.value.trim());
      };
      const onClose = () => done(null);
      form.addEventListener('submit', onSubmit);
      dialog.addEventListener('close', onClose);
      dialog.showModal();
      area.focus();
    });
  }
  async function editNote(h) {
    const note = await askNote(h.text, h.note || '');
    if (note === null) return;
    await window.api(`/api/books/${config.id}/highlights/${h.id}`, { method: 'PATCH', body: { note } });
    await loadMarks();
  }

  // --- Thao tác khi bôi chọn ---
  const sourceFor = (text) => {
    const location = adapter.location();
    const url = `/books/${config.id}?loc=${encodeURIComponent(JSON.stringify(location))}&find=${encodeURIComponent(text.slice(0, 300))}`;
    return { type: 'book', label: `${config.title} · ${adapter.label()}`, url, bookId: config.id, location };
  };
  async function saveHighlight(text, note) {
    await window.api(`/api/books/${config.id}/highlights`, {
      method: 'POST',
      body: { location: adapter.location(), label: adapter.label(), text, note: note || undefined },
    });
    await loadMarks();
    afterRender();
  }
  const meaning = createMeaningPanel($('[data-lookup-sheet]'));
  const selBar = $('[data-selection-bar]');
  const translateBtn = $('[data-sel-long]', selBar);
  const toolbar = $('.reader-toolbar', root);
  attachSelectionBar(content, selBar, {
    // Từ/cụm ngắn: tự hiện nghĩa. Câu/đoạn dài: hiện nút Translate.
    onShow: (text, range) => {
      translateBtn.hidden = isShort(text);
      return meaning.show(text, range);
    },
    topInset: () => Math.max(8, toolbar.getBoundingClientRect().bottom + 8),
    onAction: async (action, text, range) => {
      if (action === 'translate') return meaning.translate(text, range);
      if (action === 'highlight') return saveHighlight(text);
      const source = sourceFor(text);
      if (action === 'notebook') {
        const short = text.split(' ').length <= 8;
        const definition = await meaning.firstDefinition(text);
        const item = await openNotebookDialog({ content: short ? text : '', excerpt: text, kind: short ? 'word' : 'pattern', meaning: definition, source });
        if (item) ctx.showNotice('Saved to today’s page in your Notebook.');
        return;
      }
      if (action === 'speak') sendToSpeaking({ text, sourceType: 'book', sourceLabel: source.label, sourceUrl: source.url });
    },
  });
  // Chạm/bấm vào trang sách (không chọn gì) → đóng bảng nghĩa.
  content.addEventListener('click', () => {
    if (meaning.isOpen && window.getSelection()?.isCollapsed) meaning.close();
  });

  // --- Thanh công cụ ---
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.matches('[data-next]')) adapter.next();
    else if (t.matches('[data-prev]')) adapter.prev();
    else if (t.dataset.zoom) adapter.adjust(Number(t.dataset.zoom));
    else if (t.dataset.font) adapter.adjust(Number(t.dataset.font));
    else if (t.matches('[data-theme-toggle]')) setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    else if (t.matches('[data-add-bookmark]')) addBookmark();
    else if (t.dataset.panelOpen) document.querySelector(`[data-panel="${t.dataset.panelOpen}"]`).showModal();
  });
  document.querySelectorAll('[data-panel-close]').forEach((b) => b.addEventListener('click', closePanels));
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, dialog, [contenteditable]') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') adapter.next();
    if (e.key === 'ArrowLeft') adapter.prev();
  });
  async function addBookmark() {
    await window.api(`/api/books/${config.id}/bookmarks`, { method: 'POST', body: { location: adapter.location(), label: adapter.label() } });
    await loadMarks();
    ctx.showNotice(`Bookmark added: ${adapter.label()}`);
  }
  function setTheme(theme) {
    root.dataset.theme = theme;
    document.documentElement.dataset.readerTheme = theme; // header + thanh tab của trang cũng tối theo
    const btn = $('[data-theme-toggle]', root);
    const label = theme === 'dark' ? 'Light' : 'Dark';
    $('[data-theme-label]', btn).textContent = label;
    btn.setAttribute('aria-label', `${label} mode`);
    btn.title = `${label} mode`;
    btn.setAttribute('aria-pressed', String(theme === 'dark'));
    try {
      localStorage.setItem('readerTheme', theme);
    } catch {
      /* trình duyệt chặn lưu trữ: bỏ qua */
    }
  }
  try {
    setTheme(localStorage.getItem('readerTheme') || 'light');
  } catch {
    setTheme('light');
  }

  // --- Khởi động ---
  try {
    await adapter.init();
    renderToc(adapter.toc || []);
    await loadMarks();
    ui.loading.hidden = true;
    await adapter.goTo(config.position);
    if (!config.hasCover && adapter.makeCover) uploadCover(adapter.makeCover);
  } catch (err) {
    ui.loading.hidden = true;
    ui.error.textContent = `Could not open the book: ${err.message || err}. The file may be damaged — delete it and upload it again, or try a different file.`;
    ui.error.hidden = false;
  }

  function renderToc(toc) {
    const list = $('[data-toc-list]');
    $('[data-toc-empty]').hidden = toc.length > 0;
    for (const entry of toc) {
      const item = li(`<button type="button" class="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-brand-50" style="padding-left:${0.75 + (entry.depth || 0) * 1}rem">${esc(entry.label)}</button>`);
      item.querySelector('button').addEventListener('click', () => goTo(entry.location));
      list.append(item);
    }
  }
  async function uploadCover(make) {
    try {
      const blob = await make();
      if (blob) await window.uploadFile(`/api/books/${config.id}/cover`, blob, 'cover.jpg');
    } catch {
      /* ảnh bìa không bắt buộc */
    }
  }
}
