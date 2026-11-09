// Chấm điểm IELTS Reading: thuần logic, không đụng DB — dễ test.

/** Chuẩn hoá để so khớp: bỏ khoảng trắng thừa, chữ thường, dấu câu ở hai đầu. */
export function normalizeAnswer(value) {
  return String(value ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/^["'.,;:!?()]+|["'.,;:!?()]+$/g, '')
    .trim();
}

const TFNG_ALIASES = { t: 'true', true: 'true', f: 'false', false: 'false', ng: 'not given', 'not given': 'not given', notgiven: 'not given' };

export const countWords = (value) => (normalizeAnswer(value).match(/[^\s]+/g) || []).length;

/**
 * Chấm một câu. question: { answer, accepted:[], }, group: { type, word_limit }.
 * Trả về { isCorrect, note } — note giải thích khi sai vì vượt giới hạn từ.
 */
export function gradeAnswer(question, group, rawAnswer) {
  const given = normalizeAnswer(rawAnswer);
  if (!given) return { isCorrect: false, note: 'Bỏ trống' };
  const expected = normalizeAnswer(question.answer);

  switch (group.type) {
    case 'tfng':
      return { isCorrect: (TFNG_ALIASES[given] ?? given) === (TFNG_ALIASES[expected] ?? expected), note: null };
    case 'completion': {
      if (group.word_limit && countWords(rawAnswer) > group.word_limit) {
        return { isCorrect: false, note: `Vượt giới hạn ${group.word_limit} từ` };
      }
      const accepted = [expected, ...(question.accepted || []).map(normalizeAnswer)].filter(Boolean);
      return { isCorrect: accepted.includes(given), note: null };
    }
    default:
      return { isCorrect: given === expected, note: null };
  }
}

/** Hiển thị đáp án chuẩn cho người học (kèm biến thể được chấp nhận). */
export function correctDisplay(question, group) {
  if (group.type === 'completion' && question.accepted?.length) return `${question.answer} (chấp nhận: ${question.accepted.join(' / ')})`;
  if (group.type === 'mcq' || group.type === 'headings') {
    const opts = group.type === 'mcq' ? question.options : group.options;
    const hit = (opts || []).find((o) => normalizeAnswer(o.key) === normalizeAnswer(question.answer));
    return hit ? `${hit.key}. ${hit.text}` : question.answer;
  }
  return question.answer;
}

/** Bảng quy đổi band IELTS Academic Reading (chỉ dùng khi đề đủ 40 câu). */
const BANDS = [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5]];
export function estimateBand(score, total) {
  if (total !== 40) return null;
  return BANDS.find(([min]) => score >= min)?.[1] ?? null;
}
