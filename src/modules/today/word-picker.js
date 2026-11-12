// Chọn Word of the Day từ chính sách và đề của người dùng — logic thuần, dễ test.
// Chỉ chọn từ C2 trở lên có trong từ điển dự án (có nghĩa, sắc thái, collocations).
// Trước đây còn lấy "từ dài ít gặp" trong văn bản, nhưng độ dài không đo được độ khó
// (ra cả magnificent, extraordinarily…) — người dùng thấy dễ, nên bỏ (2026-11-12).
import { ADVANCED } from './words.js';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+(?=[A-Z“"'‘(])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25 && s.length <= 400);
}

// Biên dịch regex một lần cho mỗi dạng từ.
const MATCHERS = ADVANCED.flatMap((entry) => entry.forms.map((form) => ({ entry, form, re: new RegExp(`\\b${escapeRe(form)}\\b`, 'i') })));

/**
 * chunks: [{ text, source: { type, label, url, bookId?, location?, testId? } }]
 * Trả về danh sách ứng viên { key, form, entry, sentence, source } — chỉ từ C2+ trong từ điển dự án.
 */
export function findCandidates(chunks) {
  const seen = new Map();
  for (const chunk of chunks) {
    for (const sentence of splitSentences(chunk.text)) {
      for (const { entry, form, re } of MATCHERS) {
        const key = entry.word.toLowerCase();
        if (!seen.has(key) && re.test(sentence)) seen.set(key, { key, form, entry, sentence, source: chunk.source });
      }
    }
  }
  return [...seen.values()];
}

/** Băm ổn định để thứ tự chọn cố định theo ngày. */
function hash(s) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

/** Chọn một ứng viên cho ngày `date`, bỏ qua các từ trong `exclude`; không có → null (dùng bộ dự phòng). */
export function pickCandidate(candidates, date, exclude = new Set()) {
  const usable = candidates.filter((c) => !exclude.has(c.key));
  return usable.sort((a, b) => hash(date + a.key) - hash(date + b.key))[0] || null;
}
