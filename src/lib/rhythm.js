// Gợi ý nhịp điệu cho một câu/đoạn tiếng Anh — luật đơn giản, có thể sai, người dùng chỉnh được:
//  • cụm ý: ngắt ở dấu câu và trước liên từ/giới từ khi cụm đã dài
//  • từ nội dung (danh, động, tính, trạng từ) thường được nhấn; từ chức năng thường đọc nhẹ
//  • nối âm: từ kết thúc bằng phụ âm + từ sau bắt đầu bằng nguyên âm

const FUNCTION_WORDS = new Set(
  `a an the and but or nor so yet of to in on at for from by with as than that this these those
   is am are was were be been being have has had do does did can could will would shall should may might must
   i me my you your he him his she her it its we us our they them their there here
   some any not no if then when while which who whom whose what where how
   into onto upon about over under after before through between`.split(/\s+/),
);
// Từ thường KHÔNG đọc nhẹ dù là từ chức năng (phủ định, từ để hỏi đứng đầu…).
const ALWAYS_STRONG = new Set(['not', 'no', "don't", "can't", "won't", "isn't", "aren't", "didn't", "doesn't", 'never']);
const BREAK_BEFORE = new Set(['and', 'but', 'or', 'because', 'although', 'though', 'while', 'which', 'who', 'that', 'before', 'after', 'when', 'if', 'of', 'to', 'at', 'in', 'on', 'for', 'with']);
const VOWEL_START = /^[aeiou]/i;
const CONSONANT_END = /[bcdfgjklmnpqrstvxz]$/i;

const clean = (w) => w.toLowerCase().replace(/[^a-z']/g, '');

/** Tách đoạn thành câu (giữ dấu câu). */
export function splitSentences(text) {
  return (String(text).replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || []).map((s) => s.trim()).filter(Boolean);
}

/**
 * Phân tích văn bản -> [{ phrases: [{ words: [{ text, index, stressed, weak, linkNext }] }] }] theo câu.
 * `stressOverrides`: { [index]: true|false } do người dùng chỉnh (index = vị trí từ trong cả văn bản).
 */
export function analyzeRhythm(text, { stressOverrides = {}, phrases: givenPhrases = null } = {}) {
  let index = 0;
  const makeWord = (raw) => {
    const w = clean(raw);
    const isFunction = FUNCTION_WORDS.has(w) && !ALWAYS_STRONG.has(w);
    const i = index++;
    const auto = !isFunction && w.length > 0;
    const stressed = i in stressOverrides ? Boolean(stressOverrides[i]) : auto;
    return { text: raw, index: i, stressed, weak: !stressed && isFunction, edited: i in stressOverrides, linkNext: false };
  };
  const markLinks = (words) => {
    for (let k = 0; k < words.length - 1; k++) {
      const a = words[k].text;
      const b = words[k + 1].text;
      words[k].linkNext = !/[,.;:!?]$/.test(a) && CONSONANT_END.test(clean(a)) && VOWEL_START.test(clean(b));
    }
    return words;
  };

  // Có sẵn cụm (bài mẫu có mốc thời gian): giữ nguyên cách chia của bài.
  if (givenPhrases?.length) {
    return [{ phrases: givenPhrases.map((p) => ({ words: markLinks(p.split(/\s+/).filter(Boolean).map(makeWord)) })) }];
  }

  return splitSentences(text).map((sentence) => {
    const tokens = sentence.split(/\s+/).filter(Boolean);
    const phrases = [];
    let current = [];
    tokens.forEach((tok, k) => {
      const w = clean(tok);
      if (current.length >= 3 && BREAK_BEFORE.has(w) && k < tokens.length - 1) {
        phrases.push(current);
        current = [];
      }
      current.push(tok);
      if (/[,;:—–]$/.test(tok)) {
        phrases.push(current);
        current = [];
      }
    });
    if (current.length) phrases.push(current);
    return { phrases: phrases.map((p) => ({ words: markLinks(p.map(makeWord)) })) };
  });
}

/** Cụm ý dạng chuỗi (dùng cho phát từng cụm bằng giọng tổng hợp). */
export const phraseTexts = (analysis) => analysis.flatMap((s) => s.phrases.map((p) => p.words.map((w) => w.text).join(' ')));
