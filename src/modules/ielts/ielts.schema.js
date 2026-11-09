import { z } from 'zod';
import { emptyToUndefined } from '#lib/validate.js';

export const QUESTION_TYPES = [
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'tfng', label: 'True / False / Not Given' },
  { value: 'headings', label: 'Matching Headings' },
  { value: 'completion', label: 'Completion' },
];
export const typeLabel = (type) => QUESTION_TYPES.find((t) => t.value === type)?.label ?? type;

export const TFNG_OPTIONS = [
  { value: 'TRUE', label: 'TRUE' },
  { value: 'FALSE', label: 'FALSE' },
  { value: 'NOT GIVEN', label: 'NOT GIVEN' },
];

export const MODES = [
  { value: 'practice', label: 'Luyện', hint: 'Không giới hạn giờ, kiểm tra từng câu và xem giải thích ngay.' },
  { value: 'exam', label: 'Làm đề', hint: 'Có hẹn giờ, chỉ mở đáp án sau khi nộp.' },
];

const optionalText = (max) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

export const testSchema = z.object({
  title: z.string({ error: 'Vui lòng nhập tên đề' }).trim().min(1, 'Vui lòng nhập tên đề').max(200),
  description: optionalText(2000),
  time_limit_minutes: z.coerce.number({ error: 'Phải là số phút' }).int('Phải là số nguyên').min(1, 'Ít nhất 1 phút').max(240, 'Tối đa 240 phút'),
});

export const passageSchema = z.object({
  title: z.string({ error: 'Vui lòng nhập tiêu đề bài đọc' }).trim().min(1, 'Vui lòng nhập tiêu đề bài đọc').max(300),
  position: z.coerce.number().int().min(1).max(10).default(1),
  body: z.string({ error: 'Vui lòng dán nội dung bài đọc' }).trim().min(20, 'Bài đọc quá ngắn').max(30000),
});

/** "A. text" / "i) text" mỗi dòng một lựa chọn -> [{ key, text }]. */
export function parseOptionLines(raw, { upper = false } = {}) {
  return String(raw ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^([A-Za-z]{1,6})[.)]\s+(.+)$/);
      if (!m) return { key: null, text: line };
      return { key: upper ? m[1].toUpperCase() : m[1].toLowerCase(), text: m[2].trim() };
    });
}
export const optionsToLines = (options) => (options || []).map((o) => `${o.key}. ${o.text}`).join('\n');

export const groupSchema = z
  .object({
    passage_id: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
    position: z.coerce.number().int().min(1).max(50).default(1),
    type: z.enum(QUESTION_TYPES.map((t) => t.value), { error: 'Chọn dạng câu hỏi' }),
    instructions: z.string({ error: 'Vui lòng nhập hướng dẫn' }).trim().min(1, 'Vui lòng nhập hướng dẫn').max(2000),
    options_text: optionalText(5000),
    word_limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(10).optional()),
  })
  .superRefine((g, ctx) => {
    if (g.type !== 'headings') return;
    const opts = parseOptionLines(g.options_text);
    if (opts.length < 2) ctx.addIssue({ code: 'custom', path: ['options_text'], message: 'Cần ít nhất 2 tiêu đề, mỗi dòng một tiêu đề (VD: i. ...)' });
    else if (opts.some((o) => !o.key)) ctx.addIssue({ code: 'custom', path: ['options_text'], message: 'Mỗi dòng phải bắt đầu bằng ký hiệu, VD: "iv. The cost of change"' });
  });

export const questionSchema = z.object({
  number: z.coerce.number({ error: 'Số câu phải là số' }).int().min(1, 'Số câu từ 1').max(200),
  prompt: z.string({ error: 'Vui lòng nhập câu hỏi' }).trim().min(1, 'Vui lòng nhập câu hỏi').max(2000),
  options_text: optionalText(3000),
  answer: z.string({ error: 'Vui lòng nhập đáp án' }).trim().min(1, 'Vui lòng nhập đáp án').max(300),
  accepted_text: optionalText(2000),
  explanation: optionalText(3000),
  evidence: optionalText(3000),
});
