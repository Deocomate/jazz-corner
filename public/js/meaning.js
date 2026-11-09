// Bảng nghĩa (lookup sheet) cho trình đọc sách: bôi chọn một từ/cụm ngắn → hiện Merriam-Webster (có nút
// loa nghe phát âm) rồi nghĩa tiếng Việt ngắn gọn; bôi chọn câu/đoạn dài → nút "Translate" dịch sang tiếng Việt.
// Bảng nằm cố định (dưới màn hình trên điện thoại, góc phải dưới trên máy tính) nên không che dòng
// đang đọc và vẫn mở khi bỏ chọn; đóng bằng ✕, Esc hoặc chạm vào trang sách.
//   const meaning = createMeaningPanel(sheetEl);
//   meaning.show(text, range)  meaning.translate(text, range)  meaning.close()  meaning.firstDefinition(text)

export const MAX_WORDS = 4;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const mwUrl = (term) => `https://www.merriam-webster.com/dictionary/${encodeURIComponent(term)}`;
export const termOf = (text) => text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim();
export const isShort = (text) => {
  const term = termOf(text);
  return Boolean(term) && term.split(/\s+/).length <= MAX_WORDS && term.length <= 60;
};

// Bản ngắn: tối đa 2 từ loại × 2 nghĩa, mỗi từ loại một dòng, không kèm ví dụ (đã có ở phần tiếng Anh).
function renderVietnamese(vi) {
  if (!vi) return '';
  if (!vi.found) return `<section class="lk-vi" lang="vi"><p class="lk-label" lang="en">Vietnamese</p><p class="lk-muted" lang="en">No Vietnamese entry for this form.</p></section>`;
  if (vi.source === 'machine') {
    return `<section class="lk-vi" lang="vi"><p class="lk-label" lang="en">Vietnamese <span class="lk-note">machine translation</span></p><p>${esc(vi.translation)}</p></section>`;
  }
  const lines = vi.entries
    .slice(0, 2)
    .map((e) => `<p class="lk-vi-line"><span class="lk-pos" lang="en">${esc(e.pos)}</span> ${esc(e.senses.slice(0, 2).map((s) => s.text.replace(/[.;]+$/, '')).join('; '))}</p>`)
    .join('');
  return `<section class="lk-vi" lang="vi"><p class="lk-label" lang="en">Vietnamese <a href="${esc(vi.url)}" target="_blank" rel="noopener noreferrer" class="lk-note">Wiktionary ↗</a></p>${lines}</section>`;
}

const SPEAKER = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const speakButton = (word, audio) =>
  `<button type="button" class="lk-say" data-say="${esc(word)}"${audio ? ` data-audio="${esc(audio)}"` : ''} aria-label="Listen to “${esc(word)}”" title="Listen">${SPEAKER}</button>`;

function renderEnglish(data, term) {
  const more = `<a href="${esc(data.url || mwUrl(term))}" target="_blank" rel="noopener noreferrer" class="lk-note">Merriam-Webster ↗</a>`;
  // Không có mục MW thì vẫn cho nghe bằng giọng đọc của trình duyệt.
  const plain = (msg) => `<section class="lk-en"><p class="lk-label">English ${more}</p><p><span class="lk-hw">${esc(term)}</span>${speakButton(term)}</p><p class="lk-muted">${msg}</p></section>`;
  if (data.configured === false) return plain('Dictionary key not set — open the full entry on Merriam-Webster.');
  if (data.mwError) return plain('Merriam-Webster could not be reached right now.');
  if (!data.found) return plain('No Merriam-Webster entry for this form.');
  const entries = data.entries
    .map(
      (e) =>
        `<div class="lk-entry"><p><span class="lk-hw">${esc(e.headword)}</span>${e.pos ? `<span class="lk-pos">${esc(e.pos)}</span>` : ''}${e.pronunciation ? ` <span class="lk-muted">\\${esc(e.pronunciation)}\\</span>` : ''}${speakButton(e.headword.replace(/·/g, ''), e.audio)}</p><ol>${e.definitions
          .slice(0, 3)
          .map((d) => `<li>${esc(d)}</li>`)
          .join('')}</ol></div>`,
    )
    .join('');
  return `<section class="lk-en"><p class="lk-label">English ${more}</p>${entries}</section>`;
}

export function createMeaningPanel(sheet) {
  const body = sheet.querySelector('[data-sel-meaning]');
  const title = sheet.querySelector('[data-lookup-title]');
  const cache = new Map(); // term -> Promise<data>
  let shown = null;

  const fetchOnce = (key, url) => {
    if (!cache.has(key)) cache.set(key, window.api(url).catch((err) => ({ error: err.message })));
    return cache.get(key);
  };

  const open = (heading, html) => {
    title.textContent = heading;
    body.innerHTML = html;
    body.scrollTop = 0;
    sheet.hidden = false;
    // Thêm khoảng trống cuối trang để luôn cuộn được chữ lên trên bảng (chương ngắn).
    document.documentElement.classList.add('lookup-open');
  };
  const close = () => {
    sheet.hidden = true;
    shown = null;
    document.documentElement.classList.remove('lookup-open');
  };

  // Trên điện thoại bảng chiếm nửa dưới: nếu che mất chữ đang chọn (và thanh thao tác nằm ngay dưới
  // chữ trên màn hình cảm ứng) thì cuộn trang lên.
  const reveal = (range) => {
    if (!range || sheet.hidden || window.innerWidth >= 768) return;
    const rect = range.getBoundingClientRect();
    const below = window.matchMedia?.('(pointer: coarse)').matches ? 96 : 16;
    const limit = window.innerHeight - sheet.offsetHeight;
    if (rect.bottom + below > limit) window.scrollBy({ top: rect.bottom + below - limit, behavior: 'smooth' });
  };

  // Nút loa: file phát âm Merriam-Webster (người đọc thật); không có/lỗi thì giọng đọc của trình duyệt.
  let player = null;
  const speak = (word) => {
    const tts = window.speechSynthesis;
    if (!tts) return;
    tts.cancel();
    tts.speak(window.voices.utterance(word, { rate: 0.9 }));
  };
  body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-say]');
    if (!btn) return;
    e.preventDefault();
    player?.pause();
    window.speechSynthesis?.cancel();
    if (!btn.dataset.audio) return speak(btn.dataset.say);
    player = new Audio(btn.dataset.audio);
    btn.classList.add('is-playing');
    const done = () => btn.classList.remove('is-playing');
    player.addEventListener('ended', done);
    player.play().catch(() => {
      done();
      speak(btn.dataset.say);
    });
  });

  sheet.querySelector('[data-lookup-close]').addEventListener('click', close);
  document.addEventListener('keydown', (e) => e.key === 'Escape' && !sheet.hidden && close());

  return {
    close,
    get isOpen() {
      return !sheet.hidden;
    },
    /** Vùng chọn mới: từ/cụm ngắn → tra nghĩa; dài hơn → đóng bảng (dùng nút Translate). */
    async show(text, range) {
      if (!isShort(text)) return close();
      const term = termOf(text);
      shown = term;
      open(term, '<p class="lk-muted">Looking up…</p>');
      const data = await fetchOnce(`w:${term}`, `/api/dictionary?word=${encodeURIComponent(term)}`);
      if (shown !== term) return;
      body.innerHTML = data.error
        ? `<p class="lk-muted">${esc(data.error)}</p><p class="mt-2"><a href="${esc(data.url || mwUrl(term))}" target="_blank" rel="noopener noreferrer" class="lk-note">Merriam-Webster ↗</a></p>`
        : renderEnglish(data, term) + renderVietnamese(data.vi);
      body.scrollTop = 0;
      reveal(range);
    },
    /** Dịch câu/đoạn đã chọn sang tiếng Việt (dịch máy). */
    async translate(text, range) {
      const key = text.slice(0, 500);
      shown = `t:${key}`;
      const quote = `<blockquote class="lk-quote" lang="en">${esc(text.length > 220 ? `${text.slice(0, 220)}…` : text)}</blockquote>`;
      open('Translation', `${quote}<p class="lk-muted">Translating…</p>`);
      const data = await fetchOnce(shown, `/api/dictionary/translate?text=${encodeURIComponent(key)}`);
      if (shown !== `t:${key}`) return;
      body.innerHTML = data.error
        ? `${quote}<p class="lk-muted">${esc(data.error)}</p>`
        : `${quote}<section class="lk-vi" lang="vi"><p class="lk-label" lang="en">Vietnamese <span class="lk-note">machine translation</span></p><p class="lk-vi-main">${esc(data.translation)}</p></section>${text.length > 500 ? '<p class="lk-muted">Only the first 500 characters were translated.</p>' : ''}`;
      body.scrollTop = 0;
      reveal(range);
    },
    /** Nghĩa đã tra được (để điền sẵn khi lưu vào Notebook): định nghĩa MW đầu tiên · nghĩa tiếng Việt. */
    async firstDefinition(text) {
      const key = `w:${termOf(text)}`;
      if (!cache.has(key)) return '';
      const data = await cache.get(key);
      const en = data?.found ? data.entries[0]?.definitions[0] || '' : '';
      const vi = data?.vi?.found ? (data.vi.source === 'machine' ? data.vi.translation : data.vi.entries[0].senses.slice(0, 2).map((s) => s.text.replace(/[.;]+$/, '')).join('; ')) : '';
      return [en, vi && `VI: ${vi}`].filter(Boolean).join(' · ');
    },
  };
}
