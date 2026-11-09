// Làm bài IELTS Reading: tự lưu, hẹn giờ (giữ hạn nộp khi tải lại), điều hướng câu,
// đánh dấu xem lại, kiểm tra từng câu (chế độ Luyện), xác nhận nộp, chuyển tab trên mobile.
import { attachSelectionBar } from './selection.js';
import { openNotebookDialog } from './notebook-save.js';
import { sendToSpeaking } from './speaking-handoff.js';

const root = document.querySelector('[data-take]');
const config = JSON.parse(root.dataset.config);
const saveStatus = document.querySelector('[data-save-status]');
const questions = [...document.querySelectorAll('[data-question]')];

function collect() {
  const answers = {};
  const flags = [];
  for (const q of questions) {
    const id = q.dataset.questionId;
    const radio = q.querySelector('input[type=radio][data-answer]:checked');
    const field = q.querySelector('select[data-answer], input:not([type=radio])[data-answer]');
    answers[id] = (radio ? radio.value : field?.value || '').trim();
    if (q.querySelector('[data-flag]')?.checked) flags.push(Number(id));
  }
  return { answers, flags };
}

function refreshPills() {
  const { answers, flags } = collect();
  for (const pill of document.querySelectorAll('[data-pill]')) {
    const id = pill.dataset.pill;
    pill.classList.toggle('is-answered', Boolean(answers[id]));
    pill.classList.toggle('is-flagged', flags.includes(Number(id)));
  }
  return Object.values(answers).filter((v) => !v).length;
}

// --- Tự lưu ---
let saveTimer = null;
let expired = false;
async function save() {
  saveStatus.textContent = 'Saving…';
  try {
    await window.api(`/api/ielts/attempts/${config.id}`, { method: 'PUT', body: collect() });
    saveStatus.textContent = `Saved at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  } catch (err) {
    saveStatus.textContent = 'Not saved';
    if (/time is up|already been submitted/i.test(err.message)) submitNow();
  }
}
function scheduleSave() {
  refreshPills();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 600);
}
root.addEventListener('input', (e) => {
  if (e.target.matches('[data-answer], [data-flag]')) scheduleSave();
  const limit = Number(e.target.dataset.wordLimit);
  if (limit) {
    const words = (e.target.value.trim().match(/\S+/g) || []).length;
    const hint = e.target.parentElement.querySelector('[data-word-count]');
    hint.textContent = `${words}/${limit} words${words > limit ? ' — over the limit, this answer will be marked wrong' : ''}`;
    hint.classList.toggle('text-red-700', words > limit);
  }
});
root.addEventListener('change', (e) => e.target.matches('[data-answer], [data-flag]') && scheduleSave());
window.addEventListener('pagehide', () => {
  if (expired) return;
  const token = document.querySelector('meta[name="csrf-token"]')?.content;
  fetch(`/api/ielts/attempts/${config.id}`, {
    method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json', 'x-csrf-token': token }, body: JSON.stringify(collect()),
  }).catch(() => {});
});

// --- Nộp bài ---
const dialog = document.querySelector('[data-submit-dialog]');
const form = document.querySelector('[data-submit-form]');
function submitNow() {
  expired = true;
  form.querySelector('[data-answers-json]').value = JSON.stringify(collect().answers);
  form.submit();
}
document.querySelector('[data-open-submit]').addEventListener('click', () => {
  const missing = refreshPills();
  const flagged = collect().flags.length;
  dialog.querySelector('[data-unanswered-text]').textContent =
    `${missing ? `${missing} question${missing > 1 ? 's are' : ' is'} still unanswered.` : 'You have answered every question.'}${flagged ? ` ${flagged} flagged for review.` : ''}`;
  dialog.showModal();
});
form.addEventListener('submit', () => {
  form.querySelector('[data-answers-json]').value = JSON.stringify(collect().answers);
});

// --- Hẹn giờ: tính theo hạn nộp của server (bù lệch giờ máy) ---
const timer = document.querySelector('[data-timer]');
if (config.deadline && timer) {
  const offset = Date.parse(config.serverNow) - Date.now();
  const deadline = Date.parse(config.deadline);
  const tick = () => {
    const left = Math.max(0, deadline - (Date.now() + offset));
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    timer.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    timer.classList.toggle('text-red-700', left < 5 * 60000);
    if (left <= 0) {
      clearInterval(handle);
      timer.textContent = 'Time is up';
      submitNow();
    }
  };
  const handle = setInterval(tick, 1000);
  tick();
}

// --- Kiểm tra từng câu (chế độ Luyện) ---
root.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-check]');
  if (!btn) return;
  const id = btn.dataset.check;
  const box = document.getElementById(`q-${id}`).querySelector('[data-feedback]');
  try {
    const r = await window.api(`/api/ielts/attempts/${config.id}/check/${id}`, { method: 'POST', body: { answer: collect().answers[id] } });
    box.className = `mt-2 rounded-lg p-3 text-sm ${r.isCorrect ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`;
    box.replaceChildren();
    const line = (text, cls = '') => Object.assign(document.createElement('p'), { textContent: text, className: cls });
    box.append(line(`${r.isCorrect ? '✓ Correct' : `✗ Not quite${r.note ? ` (${r.note})` : ''}`} — answer: ${r.correct}`, 'font-medium'));
    if (r.evidence) box.append(line(`“${r.evidence}”`, 'mt-1 font-serif italic'));
    if (r.explanation) box.append(line(r.explanation, 'mt-1'));
    box.hidden = false;
  } catch (err) {
    box.className = 'mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-900';
    box.textContent = err.message;
    box.hidden = false;
  }
});

// --- Tab mobile: giữ cả hai vùng trong trang, chỉ ẩn/hiện (không mất vị trí và nội dung đã nhập) ---
const panes = Object.fromEntries([...document.querySelectorAll('[data-pane]')].map((p) => [p.dataset.pane, p]));
const scrollMemory = {};
let currentTab = 'passage';
function showTab(name) {
  scrollMemory[currentTab] = window.scrollY;
  currentTab = name;
  for (const [key, pane] of Object.entries(panes)) pane.classList.toggle('is-hidden-mobile', key !== name);
  document.querySelectorAll('[data-tab]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  window.scrollTo({ top: scrollMemory[name] || 0 });
}
document.querySelectorAll('[data-tab]').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
showTab('passage');
// Bấm số câu trên mobile -> tự chuyển sang tab Câu hỏi.
document.querySelectorAll('[data-pill]').forEach((p) => p.addEventListener('click', () => currentTab !== 'questions' && showTab('questions')));

// --- Bôi chọn trong bài đọc: chỉ ở chế độ Luyện (bài hẹn giờ mở sau khi nộp) ---
if (panes.passage.hasAttribute('data-allow-speak')) {
  attachSelectionBar(panes.passage, document.querySelector('[data-selection-bar]'), {
    onAction: (action, text) => {
      const source = { type: 'ielts', label: config.title, url: `/ielts/attempts/${config.id}` };
      if (action === 'speak') sendToSpeaking({ text, sourceType: 'ielts', sourceLabel: source.label, sourceUrl: source.url });
      if (action === 'notebook') openNotebookDialog({ content: text.split(' ').length <= 8 ? text : '', excerpt: text, source });
    },
  });
}

refreshPills();
