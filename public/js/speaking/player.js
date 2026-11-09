// Phát audio mẫu. Thứ tự ưu tiên:
//   1. Giọng người thật Merriam-Webster (bài luyện từ, accent Mỹ, khi có file).
//   2. Giọng đọc trình duyệt đã chọn — mặc định là giọng neural/tự nhiên tốt nhất trên máy (window.voices).
//   3. File tổng hợp có mốc thời gian (bài mẫu, Zira) — mặc định chỉ khi máy không có giọng tự nhiên.
// Luôn báo rõ loại audio đang dùng qua onStatus().
const FILE = '__file';

export function createPlayer({ audioUrl, audioVoice, humanAudioUrl, segments, onStatus, onSegment, onEnd, onVoices }) {
  const tts = 'speechSynthesis' in window ? window.speechSynthesis : null;
  const voices = window.voices;
  let accent = 'us';
  let rate = 1;
  let loop = false;
  let audio = audioUrl ? new Audio(audioUrl) : null;
  let human = humanAudioUrl ? new Audio(humanAudioUrl) : null;
  let humanFailed = false;
  let rangeEnd = null;
  let stopped = true;
  let current = null; // { kind: 'file'|'human'|'tts', resolve }

  const lang = () => (accent === 'uk' ? 'en-GB' : 'en-US');
  const fileAllowed = () => Boolean(audio) && accent === 'us';
  const useHuman = () => Boolean(human) && !humanFailed && accent === 'us';
  /** Lựa chọn trong ô "Voice": FILE hoặc tên giọng trình duyệt. */
  function selected() {
    const saved = voices.chosenName(lang());
    if (saved === FILE && fileAllowed()) return FILE;
    const options = voices.list(lang());
    if (saved && options.some((v) => v.name === saved)) return saved;
    const best = voices.pick(lang());
    if (fileAllowed() && !voices.isNatural(best)) return FILE;
    return best?.name || (fileAllowed() ? FILE : '');
  }
  const useFile = () => fileAllowed() && selected() === FILE;
  const ttsVoice = () => voices.list(lang()).find((v) => v.name === selected()) || voices.pick(lang());

  function ttsLabel(v) {
    const quality = voices.isNatural(v)
      ? 'natural (neural) voice'
      : 'basic voice — for a more natural one, open this page in Microsoft Edge (Natural voices) or Chrome (Google voices)';
    return `your browser’s synthetic voice — ${v.name} (${v.lang}), ${quality}. Not a human speaker.`;
  }

  function describe() {
    onVoices?.();
    if (useHuman()) return onStatus('Playing: real human recording — Merriam-Webster (American English).');
    if (useFile()) return onStatus(`Playing: synthetic audio file — ${audioVoice || 'computer voice'}. Not a human speaker.`);
    if (!tts) return onStatus('This browser has no speech synthesis — use Chrome or Edge, or practise recording only.', true);
    const v = ttsVoice();
    if (v && v.lang.replace('_', '-') === lang()) return onStatus(`Playing: ${ttsLabel(v)}`, !voices.isNatural(v));
    if (v) return onStatus(`No ${lang()} voice on this device — using ${v.name} (${v.lang}) instead.`, true);
    return onStatus(voices.list('en-US').length ? 'This device has no English voice for the browser.' : 'Loading voices…', true);
  }

  if (tts) voices.onChange(describe);
  if (audio) {
    audio.addEventListener('timeupdate', () => {
      if (current?.kind !== 'file') return;
      if (rangeEnd != null && audio.currentTime >= rangeEnd) audio.pause(), finish();
      if (segments) {
        const i = segments.findIndex((s) => audio.currentTime >= s.start && audio.currentTime < s.end);
        if (i >= 0) onSegment(i);
      }
    });
    audio.addEventListener('ended', finish);
  }
  human?.addEventListener('ended', finish);
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

  /** File MW lỗi (mạng, bị chặn) → chuyển hẳn sang giọng trình duyệt cho phiên này. */
  function playHuman(text) {
    return new Promise((resolve) => {
      current = { kind: 'human', resolve };
      human.playbackRate = rate;
      human.currentTime = 0;
      human.play().catch(() => {
        humanFailed = true;
        current = null;
        describe();
        speak(text).then(resolve);
      });
    });
  }

  /**
   * Đọc bằng giọng trình duyệt. Văn bản dài được đọc từng câu: Chrome cắt ngang giọng Google sau ~15 giây
   * nếu đọc một lượt, và giọng online không phát sự kiện boundary nên tô sáng theo câu là chắc chắn nhất.
   */
  function speak(text, { segmentIndex = -1, charToSegment = null } = {}) {
    return new Promise((resolve) => {
      if (!tts) return resolve();
      tts.cancel();
      const prev = current;
      current = null;
      prev?.resolve();
      const chunks = [];
      const re = /[^.!?;]+[.!?;]*["”’)]*\s*/g;
      for (let m; (m = re.exec(text)); ) if (m[0].trim()) chunks.push({ text: m[0], at: m.index });
      if (!chunks.length) chunks.push({ text, at: 0 });
      const v = ttsVoice();
      const token = { kind: 'tts', resolve };
      current = token;
      if (segmentIndex >= 0) onSegment(segmentIndex);
      let i = 0;
      const next = () => {
        if (current !== token) return;
        if (i >= chunks.length) return finish();
        const chunk = chunks[i++];
        const u = new SpeechSynthesisUtterance(chunk.text);
        if (v) u.voice = v;
        u.lang = v ? v.lang.replace('_', '-') : lang();
        u.rate = rate;
        if (charToSegment) {
          onSegment(charToSegment(chunk.at));
          u.onboundary = (e) => onSegment(charToSegment(chunk.at + e.charIndex));
        }
        u.onend = next;
        u.onerror = (e) => (e.error === 'interrupted' || e.error === 'canceled' ? null : next());
        tts.speak(u);
      };
      next();
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
    /** Các lựa chọn cho ô "Voice" theo accent hiện tại. */
    voiceOptions() {
      const options = voices.list(lang()).map((v) => ({ value: v.name, label: `${v.name}${voices.isNatural(v) ? ' ★' : ''}` }));
      if (fileAllowed()) options.push({ value: FILE, label: `Built-in sample file — ${audioVoice || 'computer voice'} (timed)` });
      return { options, selected: selected(), human: useHuman() };
    },
    setVoice(name) {
      voices.choose(lang(), name);
      describe();
    },
    setRate(r) {
      rate = r;
      if (audio) audio.playbackRate = r;
      if (human) human.playbackRate = r;
    },
    setLoop(l) {
      loop = l;
    },
    hasTimedAudio: () => useFile() && Boolean(segments),
    /** Phát toàn bộ. phrases dùng để tô sáng khi đọc bằng giọng trình duyệt. */
    playAll(text, phrases = []) {
      return repeatWhileLooping(() => {
        if (useHuman()) return playHuman(text);
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
      if (human && !human.paused) human.pause();
      finish();
    },
    get isStopped() {
      return stopped;
    },
  };
}
