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

const voice = () => window.voices.pick('en-US');
function say(word) {
  if (!tts) return;
  tts.cancel();
  tts.speak(window.voices.utterance(word, { rate: 0.85 }));
}
function describe() {
  if (!tts) return (status.textContent = 'This browser has no speech synthesis, so the listening quiz cannot run on this device.');
  const v = voice();
  status.textContent = v ? `Audio: your browser’s synthetic voice — ${v.name} (${v.lang}). Not a human speaker.` : 'Loading voices… (if none appear, this device has no English voice).';
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
  feedback.textContent = ok ? `✓ Correct: “${answer}” ${current.sound}.` : `✗ It was “${answer}”. Tip: ${current.tip}`;
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
window.voices.onChange(describe);
describe();
nextPair();
