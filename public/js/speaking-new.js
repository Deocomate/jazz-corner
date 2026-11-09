// Điền sẵn form tạo bài luyện từ nội dung chuyển sang (Books / IELTS) — xem speaking-handoff.js.
const form = document.querySelector('[data-speaking-form]');
let draft = null;
try {
  draft = JSON.parse(sessionStorage.getItem('speakingDraft') || 'null');
} catch {
  draft = null;
}
if (form && draft && new URLSearchParams(location.search).get('from') === 'handoff' && Date.now() - draft.at < 30 * 60000) {
  const set = (name, value) => {
    const el = form.querySelector(`[data-field="${name}"]`);
    if (el && value != null) el.value = value;
  };
  set('text', draft.text);
  set('originalText', draft.text);
  set('sourceType', draft.sourceType);
  set('sourceLabel', draft.sourceLabel);
  set('sourceUrl', draft.sourceUrl);
  if (draft.sourceLabel) {
    form.querySelector('[data-source-line]').hidden = false;
    const link = form.querySelector('[data-source-link]');
    link.textContent = draft.sourceLabel;
    link.href = draft.sourceUrl || '#';
  }
  form.querySelector('[data-original-box]').hidden = false;
  form.querySelector('[data-original-view]').textContent = draft.text;
  sessionStorage.removeItem('speakingDraft');
  form.querySelector('[data-field="text"]').focus();
}
