// Chọn Word of the Day từ chính sách và đề của người dùng — logic thuần, dễ test.
// Ưu tiên: từ nâng cao có trong từ điển dự án (có nghĩa, sắc thái, collocations)
// > từ dài/ít gặp khác trong văn bản, xếp theo độ "học thuật" (xem advancedScore).
import { WORDS, lookupLexicon, isAdvanced } from './words.js';

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
   absolutely apparently obviously recently seriously suddenly certainly finally actually
   afterwards altogether announced apartment appearance appointment challenge chocolate classroom colleague
   committee comfortable condition confident connection customers dangerous daughter decisions delicious
   democracy determine difficult discovery discussion disappeared electricity emergency employees encourage
   equipment establish excellent excitement exercise expensive explained financial furniture generation
   gradually happiness household hospital impossible improvement increased increasingly incredible independent
   indicated influence instructions interesting interview introduced invitation landscape literature locations
   magazine marketing materials meanwhile mentioned midnight neighbour neighbourhood neighborhood newspaper
   nonetheless nowadays operation ourselves particularly passenger permanent photograph physical possible
   practical preparation previous primarily principle priorities processes programme properly provided
   published realised realized recognise recognize recommend reference religious remaining represent
   requirements residents resources responsibility restaurant scientific scientists secondary sensitive
   sentences shoulders similarly specific standards statement structure substantial successful suggested
   telephone temperature traditional transport treatment unfortunately universe vegetables whispered
   understanding approximately organisation organization management investment atmosphere advantage advantages
   disadvantages alternative appropriate concentrate definition experiment explanation frequently identified
   imagination impression individuals instrument intelligent international investigation necessarily
   occasionally originally permission personality presentation protection publication punishment reasonable
   reflection relatively representative satisfaction specifically temporarily translation transportation
   volunteers everyone anything nothing somebody anywhere something lighthouse beginning remember paragraph
   attempted continues developed different eventually expression important increasing obviously certainly`.split(/\s+/),
);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+(?=[A-Z“"'‘(])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25 && s.length <= 400);
}

// Đuôi gợi ý từ học thuật gốc Latin/Hy Lạp (ubiquitous, propensity, exacerbate…).
const LATINATE = /(ous|ity|ism|ise|ize|ate|ible|escent|ence|ance|ious|ial|ic|ary|ude|ify)$/;
// Đuôi thường chỉ là từ quen thuộc ghép thêm (carefully, happiness, wonderful, comfortable…).
const DERIVED = /(ingly|fully|lessly|ness|ments?|ings?|ed|ly|ful|less|ers?|able|ships?|wards?)$/;

/** Điểm "nâng cao" của một từ ngoài từ điển: dài + đuôi học thuật cộng điểm, đuôi phái sinh trừ điểm. */
export function advancedScore(form) {
  let score = form.length;
  if (LATINATE.test(form)) score += 3;
  if (DERIVED.test(form)) score -= 4;
  return score;
}

/**
 * chunks: [{ text, source: { type, label, url, bookId?, location?, testId? } }]
 * Trả về danh sách ứng viên { key, form, entry|null, sentence, source }.
 * Mục cơ bản trong từ điển (vd. "deliberate") không thành ứng viên.
 */
export function findCandidates(chunks) {
  const seen = new Map();
  const entries = WORDS.filter(isAdvanced);
  for (const chunk of chunks) {
    for (const sentence of splitSentences(chunk.text)) {
      const lower = sentence.toLowerCase();
      // 1) Từ / cụm nâng cao có trong từ điển (kể cả idiom nhiều chữ)
      for (const entry of entries) {
        for (const form of entry.forms) {
          if (!new RegExp(`\\b${escapeRe(form)}\\b`, 'i').test(lower)) continue;
          const key = entry.word.toLowerCase();
          if (!seen.has(key) || !seen.get(key).entry) seen.set(key, { key, form, entry, sentence, source: chunk.source });
        }
      }
      // 2) Từ dài, viết thường (không phải tên riêng), không quá thông dụng, không thuộc từ điển dự án
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

/** Số từ ngoài từ điển điểm cao nhất được đưa vào vòng chọn theo ngày. */
const TOP_UNKNOWN = 8;

/** Chọn một ứng viên cho ngày `date`, bỏ qua các từ trong `exclude`. */
export function pickCandidate(candidates, date, exclude = new Set()) {
  const usable = candidates.filter((c) => !exclude.has(c.key));
  const order = (list) => [...list].sort((a, b) => hash(date + a.key) - hash(date + b.key));
  const known = order(usable.filter((c) => c.entry));
  if (known.length) return known[0];
  const unknown = usable
    .filter((c) => !c.entry && advancedScore(c.form) >= 9)
    .sort((a, b) => advancedScore(b.form) - advancedScore(a.form));
  return order(unknown.slice(0, TOP_UNKNOWN))[0] || null;
}
