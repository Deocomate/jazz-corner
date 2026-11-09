// Trang luyện nói: nghe mẫu, phát từng cụm, chỉnh trọng âm, shadowing 3 bước, ghi âm & lưu bản ghi.
import { createPlayer } from './speaking/player.js';
import { createRecorder, micErrorMessage } from './speaking/recorder.js';

const root = document.querySelector('[data-speaking]');
const config = JSON.parse(root.dataset.config);
const $ = (s) => root.querySelector(s);
const $$ = (s) => [...root.querySelectorAll(s)];
const statusEl = $('[data-audio-status]');

// --- Tô sáng cụm/câu đang phát ---
function highlight(index) {
  $$('.phrase.is-playing, .sentence.is-playing').forEach((el) => el.classList.remove('is-playing'));
  if (index >= 0) $$(`[data-seg-index="${index}"]`).forEach((el) => el.classList.add('is-playing'));
}

// Ô chọn giọng: dựng lại khi danh sách giọng của trình duyệt tải xong hoặc đổi accent.
const voiceSelect = $('[data-voice]');
function renderVoices() {
  if (!voiceSelect) return;
  const { options, selected, human } = player.voiceOptions();
  const hide = human || options.length < 2; // đang dùng giọng người thật thì ô chọn giọng không có tác dụng
  $('[data-voice-row]').hidden = hide;
  $('[data-voice-hint]').hidden = hide;
  voiceSelect.replaceChildren(...options.map((o) => new Option(o.label, o.value, false, o.value === selected)));
}

const player = createPlayer({
  audioUrl: config.audioUrl,
  audioVoice: config.audioVoice,
  humanAudioUrl: config.humanAudio,
  segments: config.segments,
  onStatus: (text, warn) => {
    statusEl.textContent = text;
    statusEl.classList.toggle('text-amber-800', Boolean(warn));
  },
  onSegment: highlight,
  onVoices: () => setTimeout(renderVoices),
});

voiceSelect?.addEventListener('change', (e) => player.setVoice(e.target.value));
$('[data-accent]').addEventListener('change', (e) => player.setAccent(e.target.value));
$('[data-rate]').addEventListener('change', (e) => player.setRate(Number(e.target.value)));
$('[data-loop]').addEventListener('change', (e) => player.setLoop(e.target.checked));
// --- Nghe: nút Listen thành Stop khi đang phát (dù phát từ nút nào trên trang) ---
const playBtn = $('[data-play-all]');
let playToken = null;
let mine = null; // <audio> bản thu đang phát khi So sánh
function setPlaying(on) {
  playBtn.setAttribute('aria-pressed', String(on));
  $('[data-play-icon]').textContent = on ? '■' : '▶';
  $('[data-play-label]').textContent = on ? 'Stop' : 'Listen';
}
function stopAll() {
  playToken = null;
  shadowRun = null;
  player.stop();
  if (mine && !mine.paused) mine.pause();
  setShadowStatus('');
  setPlaying(false);
}
/** Chạy một lượt phát; trả về false nếu bị dừng/thay bằng lượt khác giữa chừng. */
async function track(fn) {
  stopAll();
  const token = (playToken = {});
  setPlaying(true);
  try {
    await fn(() => playToken === token);
  } finally {
    if (playToken === token) {
      playToken = null;
      setPlaying(false);
    }
  }
}
/** Mẫu cho nội dung đang luyện: một câu đã chọn hoặc cả bài. */
function playModel(text = target) {
  if (text && text !== config.text) return player.playText(text);
  return player.playAll(config.text, config.phrases);
}
playBtn.addEventListener('click', () => (playToken ? stopAll() : track(() => playModel())));

// --- So sánh: phát mẫu rồi phát lần thu mới nhất ---
function playAudio(el) {
  return new Promise((resolve) => {
    const done = () => {
      el.removeEventListener('ended', done);
      el.removeEventListener('pause', done);
      resolve();
    };
    el.addEventListener('ended', done);
    el.addEventListener('pause', done);
    el.currentTime = 0;
    el.play().catch(done);
  });
}
function compare() {
  const latest = $('[data-latest-take] [data-recording-audio]');
  if (!latest) {
    // Chưa có bản thu: nút tự báo ngắn gọn thay vì hiện thêm dòng chữ dưới thanh.
    const btn = $('[data-compare]');
    btn.dataset.label ??= btn.innerHTML;
    btn.textContent = 'No take yet';
    clearTimeout(btn.resetTimer);
    btn.resetTimer = setTimeout(() => (btn.innerHTML = btn.dataset.label), 1600);
    return;
  }
  track(async (alive) => {
    recStatus.textContent = 'Comparing: model…';
    await playModel(latest.dataset.target || null);
    if (!alive()) return;
    recStatus.textContent = 'Comparing: your latest take…';
    mine = latest;
    await playAudio(latest);
    if (alive()) recStatus.textContent = '';
  });
}
$('[data-compare]').addEventListener('click', compare);
// Tự bấm nghe một bản thu → dừng giọng mẫu để không chồng tiếng.
root.addEventListener('play', (e) => e.target.matches('[data-recording-audio]') && e.target !== mine && stopAll(), true);

// --- Rhythm: phát từng cụm, bật/tắt nhấn ---
const pendingStress = {};
root.addEventListener('click', (e) => {
  const seg = e.target.closest('[data-play-seg]');
  if (seg) {
    const i = Number(seg.dataset.playSeg);
    track(() => player.playSegment(i, config.phrases[i]));
  }
  const word = e.target.closest('[data-word-index]');
  if (word) {
    const on = !word.classList.contains('rw-stress');
    word.classList.toggle('rw-stress', on);
    word.classList.toggle('rw-weak', false);
    word.classList.add('rw-edited');
    word.setAttribute('aria-pressed', String(on));
    pendingStress[word.dataset.wordIndex] = on;
    const save = $('[data-save-markup]');
    save.disabled = false;
    save.textContent = 'Save changes';
  }
});
$('[data-save-markup]')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const existing = $$('.rw-edited').reduce((acc, w) => ({ ...acc, [w.dataset.wordIndex]: w.classList.contains('rw-stress') }), {});
  try {
    await window.api(`/api/speaking/items/${config.id}/markup`, { method: 'PUT', body: { stress: { ...existing, ...pendingStress } } });
    btn.textContent = 'Saved ✓';
    btn.disabled = true;
  } catch (err) {
    btn.textContent = `Error: ${err.message}`;
  }
});

// --- Read Aloud: nghe từng câu, chọn câu để ghi âm ---
let target = config.kind === 'word' ? config.text : null;
const targetLabel = $('[data-target-label]');
root.addEventListener('click', (e) => {
  const play = e.target.closest('[data-play-sentence]');
  if (play) track(() => player.playText(config.sentences[Number(play.dataset.playSentence)]));
  const pick = e.target.closest('[data-target-sentence]');
  if (pick) {
    const i = Number(pick.dataset.targetSentence);
    const again = pick.getAttribute('aria-pressed') === 'true';
    target = again ? null : config.sentences[i]; // chạm lại câu đang chọn = bỏ chọn
    targetLabel.textContent = target || 'the whole passage';
    $$('[data-target-sentence]').forEach((el) => el.setAttribute('aria-pressed', String(!again && el === pick)));
  }
  if (e.target.closest('[data-target-all]')) {
    target = null;
    targetLabel.textContent = 'the whole passage';
    $$('[data-target-sentence]').forEach((el) => el.setAttribute('aria-pressed', 'false'));
  }
  const model = e.target.closest('[data-compare-model]');
  if (model) track(() => playModel(model.dataset.compareModel || null));
});

// --- Shadowing 3 bước ---
const shadowStatus = $('[data-shadow-status]');
const setShadowStatus = (t) => shadowStatus && (shadowStatus.textContent = t);
let shadowRun = null;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
$('[data-transcript-toggle]')?.addEventListener('change', (e) => $('[data-transcript]').classList.toggle('is-hidden-text', !e.target.checked));
root.addEventListener('click', async (e) => {
  const step = e.target.closest('[data-step]')?.dataset.step;
  if (!step) return;
  if (step === '1') {
    track(async (alive) => {
      setShadowStatus('Step 1: listening to the whole text…');
      await player.playAll(config.text, config.phrases);
      if (alive()) setShadowStatus('Step 1 done. Go to step 2 to repeat phrase by phrase.');
    });
  }
  if (step === '2') {
    track(async (alive) => {
      for (let i = 0; i < config.phrases.length && alive(); i++) {
        setShadowStatus(`Step 2: listen to phrase ${i + 1}/${config.phrases.length}…`);
        const startedAt = Date.now();
        await player.playSegment(i, config.phrases[i]);
        if (!alive()) return;
        highlight(i);
        setShadowStatus(`Repeat phrase ${i + 1}: “${config.phrases[i]}”`);
        await wait(Math.max(1200, (Date.now() - startedAt) * 1.4));
      }
      if (alive()) setShadowStatus('Step 2 done. Go to step 3 to shadow the audio.');
      highlight(-1);
    });
  }
  if (step === '3') {
    stopAll();
    setShadowStatus('Step 3: recording — speak along with the audio…');
    const ok = await startRecording('shadowing');
    if (!ok) return setShadowStatus('');
    await track(() => (setShadowStatus('Step 3: recording — speak along with the audio…'), player.playAll(config.text, config.phrases)));
    if (recorder.active) await stopRecording();
  }
});

// --- Ghi âm ---
const recBtn = $('[data-record]');
const recTimer = $('[data-rec-timer]');
const recLabel = $('[data-rec-label]');
const recState = $('[data-rec-state]');
const recStatus = $('[data-rec-status]');
const micError = $('[data-mic-error]');
const recorder = createRecorder({
  onTick: (ms) => (recTimer.textContent = `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`),
});
let recordMode = config.mode;

async function startRecording(mode = config.mode) {
  micError.hidden = true;
  try {
    await recorder.start();
  } catch (err) {
    micError.textContent = micErrorMessage(err);
    micError.hidden = false;
    return false;
  }
  recordMode = mode;
  recLabel.textContent = '■ Stop';
  recTimer.hidden = false;
  recState.textContent = 'Recording:';
  recBtn.classList.add('record-on');
  recBtn.setAttribute('aria-pressed', 'true');
  recStatus.textContent = '';
  return true;
}

async function stopRecording() {
  const result = await recorder.stop();
  recLabel.textContent = '● Record';
  recTimer.hidden = true;
  recTimer.textContent = '00:00';
  recState.textContent = 'Practising:';
  recBtn.classList.remove('record-on');
  recBtn.setAttribute('aria-pressed', 'false');
  if (!result?.blob.size) return (recStatus.textContent = 'The recording is empty.');
  recStatus.textContent = 'Saving the recording…';
  try {
    const token = document.querySelector('meta[name="csrf-token"]')?.content;
    const res = await fetch(`/api/speaking/items/${config.id}/recordings`, {
      method: 'POST',
      headers: {
        'Content-Type': result.blob.type || 'audio/webm',
        'x-csrf-token': token,
        'x-mode': recordMode,
        'x-duration': String(result.durationMs),
        'x-target': encodeURIComponent(target || ''),
      },
      body: result.blob,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    recStatus.textContent = 'Saved. Reloading your recordings…';
    window.location.assign(`/speaking/items/${config.id}?mode=${config.mode}&saved=${data.id}#rec-${data.id}`);
  } catch (err) {
    recStatus.textContent = `The recording was not saved: ${err.message}`;
  }
}

recBtn.addEventListener('click', async () => {
  if (recorder.active) {
    stopAll();
    await stopRecording();
  } else {
    stopAll();
    await startRecording(config.mode);
  }
});

// Phím tắt: R = thu/dừng, Space = nghe/dừng, C = so sánh (khi không gõ trong ô nhập).
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select, button, a, summary, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'r' || e.key === 'R') recBtn.click();
  if (e.key === 'c' || e.key === 'C') compare();
  if (e.key === ' ') {
    e.preventDefault();
    playBtn.click();
  }
});

// --- Lịch sử bản thu: lọc theo chế độ; mở sẵn khi link trỏ tới một bản thu cũ ---
const recHistory = $('[data-history]');
recHistory?.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-filter]');
  if (!chip) return;
  recHistory.querySelectorAll('[data-filter]').forEach((c) => {
    c.classList.toggle('is-on', c === chip);
    c.setAttribute('aria-pressed', String(c === chip));
  });
  recHistory.querySelectorAll('[data-rec-mode]').forEach((li) => (li.hidden = Boolean(chip.dataset.filter) && li.dataset.recMode !== chip.dataset.filter));
});
const hashEl = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
if (recHistory && hashEl && recHistory.contains(hashEl)) {
  recHistory.open = true;
  hashEl.scrollIntoView();
}

// --- Menu ⋯ và bảng cài đặt: đóng khi chạm ra ngoài / Esc; nút xem bản gốc ---
// Máy tính (lg): cài đặt luôn hiện trong thẻ ở cột phải, không phải bảng bật/tắt.
const wide = window.matchMedia('(min-width: 1024px)');
const settings = $('[data-settings]');
const syncSettings = () => (settings.open = wide.matches);
syncSettings();
wide.addEventListener('change', syncSettings);
const popovers = $$('details[data-more], details[data-settings]');
const closable = () => popovers.filter((d) => d !== settings || !wide.matches);
document.addEventListener('click', (e) => closable().forEach((d) => d.open && !d.contains(e.target) && (d.open = false)));
document.addEventListener('keydown', (e) => e.key === 'Escape' && closable().forEach((d) => (d.open = false)));
$('[data-show-original]')?.addEventListener('click', () => {
  const box = $('[data-original]');
  box.hidden = false;
  $('[data-more]').open = false;
  box.scrollIntoView({ block: 'nearest' });
});
