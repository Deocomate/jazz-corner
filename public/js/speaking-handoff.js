// Chuyển một đoạn văn sang Speaking: lưu nháp vào sessionStorage rồi mở form tạo bài luyện
// (không đưa nội dung dài lên URL). Trang /speaking/new đọc nháp và điền sẵn.
export function sendToSpeaking({ text, sourceType = 'manual', sourceLabel = '', sourceUrl = '', notebookItemId = null }) {
  sessionStorage.setItem(
    'speakingDraft',
    JSON.stringify({ text, sourceType, sourceLabel, sourceUrl, notebookItemId, at: Date.now() }),
  );
  window.location.href = '/speaking/new?from=handoff';
}
