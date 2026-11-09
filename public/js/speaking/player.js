// Phát audio mẫu: tệp audio có mốc thời gian (bài mẫu) hoặc giọng tổng hợp của trình duyệt.
// Luôn báo rõ loại audio đang dùng qua onStatus().

const pickVoice = (voices, lang) =>
  voices.find((v) => v.lang === lang && /natural|online/i.test(v.name)) ||
  voices.find((v) => v.lang === lang) ||
  voices.find((v) => v.lang?.startsWith(lang.slice(0, 2)) && v.lang.includes(lang.slice(3)));

export function createPlayer({ audioUrl, audioVoice, segments, onStatus, onSegment, onEnd }) {
  const tts = 'speechSynthesis' in window ? window.speechSynthesis : null;
  let voices = [];
  let accent = 'us';
  let rate = 1;
  let loop = false;
  let audio = audioUrl ? new Audio(audioUrl) : null;
  let rangeEnd = null;
  let stopped = true;
  let current = null; // { kind: 'file'|'tts', resolve }

  const lang = () => (accent === 'uk' ? 'en-GB' : 'en-US');
  const useFile = () => Boolean(audio) && accent === 'us';

  function describe() {
    if (useFile()) return onStatus(`Đang dùng: audio tổng hợp từ tệp — ${audioVoice || 'giọng máy'}. Không phải người đọc.`);
    if (!tts) return onStatus('Trình duyệt này không hỗ trợ giọng đọc tổng hợp — hãy dùng Chrome/Edge, hoặc chỉ luyện ghi âm.', true);
    const v = pickVoice(voices, lang());
    if (v) return onStatus(`Đang dùng: giọng tổng hợp của trình duyệt — ${v.name} (${v.lang}). Không phải người đọc.`);
    const fallback = pickVoice(voices, 'en-US') || voices.find((x) => x.lang?.startsWith('en'));
    if (fallback) return onStatus(`Thiết bị không có giọng ${lang()} — tạm dùng ${fallback.name} (${fallback.lang}).`, true);
    return onStatus(voices.length ? 'Thiết bị chưa có giọng tiếng Anh nào cho trình duyệt.' : 'Đang tải danh sách giọng đọc…', true);
  }

  if (tts) {
    const load = () => {
      voices = tts.getVoices();
      describe();
    };
    load();
    tts.addEventListener?.('voiceschanged', load);
  }
  if (audio) {
    audio.addEventListener('timeupdate', () => {
      if (rangeEnd != null && audio.currentTime >= rangeEnd) audio.pause(), finish();
      if (segments) {
        const i = segments.findIndex((s) => audio.currentTime >= s.start && audio.currentTime < s.end);
        if (i >= 0) onSegment(i);
      }
    });
    audio.addEventListener('ended', finish);
  }
  describe();

  function finish() {
    const c = current;
    current = null;
    rangeEnd = null;
    onSegment(-1);
    c?.resolve();
    if (!c) return;
    onEnd?.();
  }

  function playFile(start = 0, end = null) {
    return new Promise((resolve) => {
      current = { kind: 'file', resolve };
      audio.playbackRate = rate;
      audio.currentTime = start;
      rangeEnd = end;
      audio.play().catch(() => finish());
    });
  }

  function speak(text, { segmentIndex = -1, charToSegment = null } = {}) {
    return new Promise((resolve) => {
      if (!tts) return resolve();
      tts.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang();
      const v = pickVoice(voices, lang()) || pickVoice(voices, 'en-US');
      if (v) u.voice = v;
      u.rate = rate;
      current = { kind: 'tts', resolve };
      if (segmentIndex >= 0) onSegment(segmentIndex);
      if (charToSegment) u.onboundary = (e) => onSegment(charToSegment(e.charIndex));
      u.onend = finish;
      u.onerror = finish;
      tts.speak(u);
    });
  }

  async function repeatWhileLooping(fn) {
    stopped = false;
    do await fn();
    while (loop && !stopped);
  }

  return {
    setAccent(a) {
      accent = a;
      describe();
    },
    setRate(r) {
      rate = r;
      if (audio) audio.playbackRate = r;
    },
    setLoop(l) {
      loop = l;
    },
    hasTimedAudio: () => useFile() && Boolean(segments),
    /** Phát toàn bộ. phrases dùng để tô sáng khi đọc bằng giọng trình duyệt. */
    playAll(text, phrases = []) {
      return repeatWhileLooping(() => {
        if (useFile()) return playFile(0, null);
        const offsets = [];
        let pos = 0;
        for (const p of phrases) {
          const at = text.indexOf(p, pos);
          offsets.push(at < 0 ? pos : at);
          pos = at < 0 ? pos : at + p.length;
        }
        const charToSegment = (c) => offsets.reduce((acc, off, i) => (c >= off ? i : acc), 0);
        return speak(text, { charToSegment: phrases.length ? charToSegment : null });
      });
    },
    /** Phát một cụm/câu: dùng mốc thời gian nếu có, nếu không thì đọc bằng giọng trình duyệt. */
    playSegment(index, text) {
      return repeatWhileLooping(() => {
        const seg = segments?.[index];
        if (useFile() && seg && seg.text === text) return playFile(seg.start, seg.end);
        return speak(text, { segmentIndex: index });
      });
    },
    playText(text) {
      return repeatWhileLooping(() => speak(text));
    },
    stop() {
      stopped = true;
      tts?.cancel();
      if (audio && !audio.paused) audio.pause();
      finish();
    },
    get isStopped() {
      return stopped;
    },
  };
}
