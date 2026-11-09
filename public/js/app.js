// JS phía trình duyệt dùng chung. CSP chặn <script> inline và onclick="",
// nên mọi hành vi đặt ở đây và gắn qua thuộc tính data-*.

// <form data-confirm="Bạn chắc chứ?"> -> hỏi trước khi gửi.
document.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-confirm]');
  if (form && !window.confirm(form.dataset.confirm)) event.preventDefault();
});

// Chống bấm gửi 2 lần.
document.addEventListener('submit', (event) => {
  if (event.defaultPrevented) return;
  const button = event.target.querySelector('button[type="submit"]');
  if (button) setTimeout(() => (button.disabled = true), 0);
});

// <input|select data-autosubmit> -> tự gửi form khi đổi giá trị (VD: chọn ngày, bộ lọc).
document.addEventListener('change', (event) => {
  if (event.target.matches('[data-autosubmit]')) event.target.form?.requestSubmit();
});

// <a data-back> -> quay lại trang trước.
document.addEventListener('click', (event) => {
  if (event.target.closest('[data-back]')) {
    event.preventDefault();
    history.back();
  }
});

// Thông báo flash tự ẩn sau 5 giây.
document.querySelectorAll('[data-dismissible]').forEach((el) => {
  setTimeout(() => el.remove(), 5000);
});

/** Gọi API JSON có kèm CSRF token. Dùng: await api('/api/items', { method: 'POST', body: {...} }) */
window.api = async (url, { method = 'GET', body } = {}) => {
  const token = document.querySelector('meta[name="csrf-token"]')?.content;
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': token },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
  return data;
};

/** Tải tệp lên dạng thân request thô (không multipart). Trả về JSON server gửi về. */
window.uploadFile = async (url, file, name = 'file') => {
  const token = document.querySelector('meta[name="csrf-token"]')?.content;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      Accept: 'application/json',
      'x-csrf-token': token,
      'x-file-name': encodeURIComponent(name),
    },
    body: file,
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 413) throw new Error('The file is too large. Please choose a smaller file.');
  if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
  return data;
};

// Giọng đọc của trình duyệt dùng chung (window.voices). Xếp hạng để ưu tiên giọng neural/tự nhiên
// (Edge: "Microsoft … Online (Natural)", Chrome: "Google US English", Safari: Premium/Enhanced) thay vì
// giọng máy cũ (Zira/David). Người dùng chọn giọng nào thì nhớ theo từng accent trong localStorage.
//   voices.list('en-GB')  voices.pick('en-US')  voices.choose('en-US', name)  voices.isNatural(v)
//   voices.utterance(text, { lang, rate })  voices.onChange(fn)
window.voices = (() => {
  const tts = window.speechSynthesis;
  const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley/i;
  const langOf = (v) => String(v.lang || '').replace('_', '-');
  const score = (v) => {
    if (NOVELTY.test(v.name)) return -100;
    let s = 0;
    if (/natural|neural/i.test(v.name)) s += 40;
    if (/online/i.test(v.name)) s += 30;
    if (/google/i.test(v.name)) s += 25;
    if (/premium|enhanced/i.test(v.name)) s += 25;
    if (/siri/i.test(v.name)) s += 15;
    return s;
  };
  const key = (lang) => `jc:voice:${lang}`;
  const store = {
    get: (k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        v ? localStorage.setItem(k, v) : localStorage.removeItem(k);
      } catch {}
    },
  };
  const all = () => tts?.getVoices() || [];
  const list = (lang) =>
    all()
      .filter((v) => langOf(v) === lang && score(v) > -100)
      .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
  const chosenName = (lang) => store.get(key(lang));
  const pick = (lang = 'en-US') => {
    const options = list(lang);
    const saved = chosenName(lang);
    return options.find((v) => v.name === saved) || options[0] || list('en-US')[0] || all().find((v) => langOf(v).startsWith('en')) || null;
  };
  const listeners = new Set();
  tts?.addEventListener?.('voiceschanged', () => listeners.forEach((fn) => fn()));
  return {
    supported: Boolean(tts),
    list,
    pick,
    chosenName,
    isNatural: (v) => Boolean(v) && score(v) >= 25,
    choose: (lang, name) => store.set(key(lang), name),
    onChange: (fn) => listeners.add(fn),
    utterance(text, { lang = 'en-US', rate = 1 } = {}) {
      const u = new SpeechSynthesisUtterance(text);
      const v = pick(lang);
      if (v) u.voice = v;
      u.lang = v ? langOf(v) : lang;
      u.rate = rate;
      return u;
    },
  };
})();

// <button data-pronounce="word" data-audio="mp3?"> -> phát âm: file Merriam-Webster, lỗi/không có thì giọng trình duyệt.
{
  let player = null;
  const speak = (word) => {
    const tts = window.speechSynthesis;
    if (!tts) return;
    tts.cancel();
    tts.speak(window.voices.utterance(word.replace(/[·*]/g, ''), { rate: 0.9 }));
  };
  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-pronounce]');
    if (!btn) return;
    event.preventDefault();
    player?.pause();
    window.speechSynthesis?.cancel();
    if (!btn.dataset.audio) return speak(btn.dataset.pronounce);
    player = new Audio(btn.dataset.audio);
    btn.classList.add('is-playing');
    const done = () => btn.classList.remove('is-playing');
    player.addEventListener('ended', done);
    player.play().catch(() => {
      done();
      speak(btn.dataset.pronounce);
    });
  });
}

// <button data-dialog-cancel> trong <dialog> -> đóng hộp thoại.
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-dialog-cancel]');
  if (button) button.closest('dialog')?.close();
});
