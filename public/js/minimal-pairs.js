// Bài nghe phân biệt cặp âm tối thiểu, dùng giọng tổng hợp của trình duyệt.
const pairs = JSON.parse(document.querySelector('[data-mp-data]').dataset.pairs);
const status = document.querySelector('[data-mp-status]');
const choices = document.querySelector('[data-mp-choices]');
const feedback = document.querySelector('[data-mp-feedback]');
const scoreEl = document.querySelector('[data-mp-score]');
const tts = window.speechSynthesis;
let current = null;
let answer = null;
let score = 0;
let total = 0;

function voice() {
  const voices = tts?.getVoices() || [];
  return voices.find((v) => v.lang === 'en-US') || voices.find((v) => v.lang?.startsWith('en'));
}
function say(word) {
  if (!tts) return;
  tts.cancel();
  const u = new SpeechSynthesisUtterance(word);
  const v = voice();
  if (v) u.voice = v;
  u.lang = v?.lang || 'en-US';
  u.rate = 0.85;
  tts.speak(u);
}
function describe() {
  if (!tts) return (status.textContent = 'Trình duyệt không hỗ trợ giọng đọc tổng hợp — bài nghe không dùng được trên thiết bị này.');
  const v = voice();
  status.textContent = v ? `Audio: giọng tổng hợp của trình duyệt — ${v.name} (${v.lang}). Không phải người đọc.` : 'Đang tải giọng đọc… (nếu không thấy, thiết bị chưa có giọng tiếng Anh).';
}
function nextPair() {
  current = pairs[Math.floor(Math.random() * pairs.length)];
  answer = Math.random() < 0.5 ? current.a : current.b;
  feedback.textContent = '';
  choices.replaceChildren(
    ...[current.a, current.b].map((w) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn-secondary py-4 font-serif text-xl';
      b.lang = 'en';
      b.textContent = w;
      b.addEventListener('click', () => choose(w));
      return b;
    }),
  );
}
function choose(word) {
  if (!answer) return;
  total += 1;
  const ok = word === answer;
  if (ok) score += 1;
  feedback.textContent = ok ? `✓ Đúng: “${answer}” ${current.sound}.` : `✗ Đó là “${answer}”. Mẹo: ${current.tip}`;
  feedback.className = `mt-3 text-sm ${ok ? 'text-emerald-800' : 'text-red-800'}`;
  scoreEl.textContent = `${score}/${total}`;
  answer = null;
  setTimeout(() => {
    nextPair();
    say(answer);
  }, 1400);
}

document.querySelector('[data-mp-play]').addEventListener('click', () => answer && say(answer));
document.querySelector('[data-mp-next]').addEventListener('click', nextPair);
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-say]');
  if (el) say(el.dataset.say);
});
tts?.addEventListener?.('voiceschanged', describe);
describe();
nextPair();
