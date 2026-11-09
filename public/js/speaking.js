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

const player = createPlayer({
  audioUrl: config.audioUrl,
  audioVoice: config.audioVoice,
  segments: config.segments,
  onStatus: (text, warn) => {
    statusEl.textContent = text;
    statusEl.classList.toggle('text-amber-800', Boolean(warn));
  },
  onSegment: highlight,
});

$('[data-accent]').addEventListener('change', (e) => player.setAccent(e.target.value));
$('[data-rate]').addEventListener('change', (e) => player.setRate(Number(e.target.value)));
$('[data-loop]').addEventListener('change', (e) => player.setLoop(e.target.checked));
$('[data-play-all]').addEventListener('click', () => player.playAll(config.text, config.phrases));
$('[data-stop]').addEventListener('click', () => {
  shadowRun = null;
  player.stop();
  setShadowStatus('');
});

// --- Rhythm: phát từng cụm, bật/tắt nhấn ---
const pendingStress = {};
root.addEventListener('click', (e) => {
  const seg = e.target.closest('[data-play-seg]');
  if (seg) {
    const i = Number(seg.dataset.playSeg);
    player.playSegment(i, config.phrases[i]);
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
    save.textContent = 'Lưu chỉnh sửa';
  }
});
$('[data-save-markup]')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const existing = $$('.rw-edited').reduce((acc, w) => ({ ...acc, [w.dataset.wordIndex]: w.classList.contains('rw-stress') }), {});
  try {
    await window.api(`/api/speaking/items/${config.id}/markup`, { method: 'PUT', body: { stress: { ...existing, ...pendingStress } } });
    btn.textContent = 'Đã lưu ✓';
    btn.disabled = true;
  } catch (err) {
    btn.textContent = `Lỗi: ${err.message}`;
  }
});

// --- Read Aloud: nghe từng câu, chọn câu để ghi âm ---
let target = config.kind === 'word' ? config.text : null;
const targetLabel = $('[data-target-label]');
root.addEventListener('click', (e) => {
  const play = e.target.closest('[data-play-sentence]');
  if (play) player.playText(config.sentences[Number(play.dataset.playSentence)]);
  const pick = e.target.closest('[data-target-sentence]');
  if (pick) {
    const i = Number(pick.dataset.targetSentence);
    target = config.sentences[i];
    targetLabel.textContent = target;
    $$('.sentence').forEach((el) => el.classList.toggle('is-playing', el.dataset.sentence === String(i)));
    $('[data-record]').focus();
  }
  if (e.target.closest('[data-target-all]')) {
    target = null;
    targetLabel.textContent = 'toàn bộ đoạn (đọc liền)';
    $$('.sentence').forEach((el) => el.classList.remove('is-playing'));
  }
  const compare = e.target.closest('[data-compare-model]');
  if (compare) {
    const t = compare.dataset.compareModel;
    if (t && t !== config.text) player.playText(t);
    else player.playAll(config.text, config.phrases);
  }
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
  player.stop();
  const run = (shadowRun = {});
  if (step === '1') {
    setShadowStatus('Bước 1: nghe toàn bộ…');
    await player.playAll(config.text, config.phrases);
    if (shadowRun === run) setShadowStatus('Xong bước 1. Sang bước 2 để nhắc lại từng cụm.');
  }
  if (step === '2') {
    for (let i = 0; i < config.phrases.length && shadowRun === run; i++) {
      setShadowStatus(`Bước 2: nghe cụm ${i + 1}/${config.phrases.length}…`);
      const startedAt = Date.now();
      await player.playSegment(i, config.phrases[i]);
      if (shadowRun !== run) return;
      highlight(i);
      setShadowStatus(`Nhắc lại cụm ${i + 1}: “${config.phrases[i]}”`);
      await wait(Math.max(1200, (Date.now() - startedAt) * 1.4));
    }
    if (shadowRun === run) setShadowStatus('Xong bước 2. Sang bước 3 để nói bám theo.');
    highlight(-1);
  }
  if (step === '3') {
    setShadowStatus('Bước 3: đang ghi âm — nói bám theo audio…');
    const ok = await startRecording('shadowing');
    if (!ok) return setShadowStatus('');
    await player.playAll(config.text, config.phrases);
    if (recorder.active) await stopRecording();
  }
});

// --- Ghi âm ---
const recBtn = $('[data-record]');
const recTimer = $('[data-rec-timer]');
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
  recBtn.textContent = '■ Dừng';
  recBtn.classList.add('record-on');
  recBtn.setAttribute('aria-pressed', 'true');
  recStatus.textContent = 'Đang ghi âm…';
  return true;
}

async function stopRecording() {
  const result = await recorder.stop();
  recBtn.textContent = '● Ghi âm';
  recBtn.classList.remove('record-on');
  recBtn.setAttribute('aria-pressed', 'false');
  if (!result?.blob.size) return (recStatus.textContent = 'Bản ghi trống.');
  recStatus.textContent = 'Đang lưu bản ghi…';
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
    if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
    recStatus.textContent = 'Đã lưu. Đang mở lại danh sách bản ghi…';
    window.location.assign(`/speaking/items/${config.id}?mode=${config.mode}&saved=${data.id}#rec-${data.id}`);
  } catch (err) {
    recStatus.textContent = `Chưa lưu được bản ghi: ${err.message}`;
  }
}

recBtn.addEventListener('click', async () => {
  if (recorder.active) {
    player.stop();
    await stopRecording();
  } else await startRecording(config.mode);
});

// Phím tắt: R = ghi âm/dừng, Space ở ngoài ô nhập = nghe toàn bộ.
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select, button, a, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'r' || e.key === 'R') recBtn.click();
  if (e.key === ' ') {
    e.preventDefault();
    player.playAll(config.text, config.phrases);
  }
});
