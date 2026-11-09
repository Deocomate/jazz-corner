// Chọn Word of the Day từ chính sách và đề của người dùng — logic thuần, dễ test.
// Ưu tiên: từ có trong từ điển dự án (có nghĩa, sắc thái, collocations) > từ dài/ít gặp khác trong văn bản.
import { WORDS, lookupLexicon } from './words.js';

// Từ dài nhưng quá thông dụng — không chọn làm Word of the Day.
const COMMON = new Set(
  `something different important everything sometimes beautiful community questions including available education
   everybody understand interested information government development experience particular themselves
   especially remembered character beginning following generally everywhere necessary situation national
   whatever certainly yesterday president political continued described direction completely probably
   understood knowledge organized organised throughout television business families children thousands
   happening wonderful afternoon breakfast somewhere sometimes otherwise according countries individual
   considered university relationship environment technology important attention difference conversation
   immediately opportunity especially personally professional performance population production
   significant themselves therefore nevertheless additional basically currently definitely eventually
   absolutely apparently obviously recently seriously suddenly certainly finally actually`.split(/\s+/),
);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+(?=[A-Z“"'‘(])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25 && s.length <= 400);
}

/**
 * chunks: [{ text, source: { type, label, url, bookId?, location?, testId? } }]
 * Trả về danh sách ứng viên { key, form, entry|null, sentence, source }.
 */
export function findCandidates(chunks) {
  const seen = new Map();
  for (const chunk of chunks) {
    for (const sentence of splitSentences(chunk.text)) {
      const lower = sentence.toLowerCase();
      // 1) Từ / cụm có trong từ điển (kể cả idiom nhiều chữ)
      for (const entry of WORDS) {
        for (const form of entry.forms) {
          if (!new RegExp(`\\b${escapeRe(form)}\\b`, 'i').test(lower)) continue;
          const key = entry.word.toLowerCase();
          if (!seen.has(key) || !seen.get(key).entry) seen.set(key, { key, form, entry, sentence, source: chunk.source });
        }
      }
      // 2) Từ dài, viết thường (không phải tên riêng), không quá thông dụng
      for (const m of sentence.matchAll(/\b[a-z]{9,}\b/g)) {
        const form = m[0];
        if (COMMON.has(form) || lookupLexicon(form)) continue;
        if (!seen.has(form)) seen.set(form, { key: form, form, entry: null, sentence, source: chunk.source });
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

/** Chọn một ứng viên cho ngày `date`, bỏ qua các từ trong `exclude`. */
export function pickCandidate(candidates, date, exclude = new Set()) {
  const usable = candidates.filter((c) => !exclude.has(c.key));
  const order = (list) => [...list].sort((a, b) => hash(date + a.key) - hash(date + b.key));
  return order(usable.filter((c) => c.entry))[0] || order(usable.filter((c) => !c.entry))[0] || null;
}
