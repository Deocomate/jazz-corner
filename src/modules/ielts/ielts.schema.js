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
  { value: 'practice', label: 'Practice', hint: 'No time limit; check each question and see the explanation straight away.' },
  { value: 'exam', label: 'Exam', hint: 'Timed; answers are shown only after you submit.' },
];

const optionalText = (max) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

export const testSchema = z.object({
  title: z.string({ error: 'Please enter a test title' }).trim().min(1, 'Please enter a test title').max(200),
  description: optionalText(2000),
  time_limit_minutes: z.coerce.number({ error: 'Enter a number of minutes' }).int('Use a whole number').min(1, 'At least 1 minute').max(240, 'At most 240 minutes'),
});

export const passageSchema = z.object({
  title: z.string({ error: 'Please enter a passage title' }).trim().min(1, 'Please enter a passage title').max(300),
  position: z.coerce.number().int().min(1).max(10).default(1),
  body: z.string({ error: 'Please paste the passage text' }).trim().min(20, 'The passage is too short').max(30000),
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
    type: z.enum(QUESTION_TYPES.map((t) => t.value), { error: 'Choose a question type' }),
    instructions: z.string({ error: 'Please enter the instructions' }).trim().min(1, 'Please enter the instructions').max(2000),
    options_text: optionalText(5000),
    word_limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(10).optional()),
  })
  .superRefine((g, ctx) => {
    if (g.type !== 'headings') return;
    const opts = parseOptionLines(g.options_text);
    if (opts.length < 2) ctx.addIssue({ code: 'custom', path: ['options_text'], message: 'Add at least 2 headings, one per line (e.g. i. ...)' });
    else if (opts.some((o) => !o.key)) ctx.addIssue({ code: 'custom', path: ['options_text'], message: 'Each line must start with a label, e.g. "iv. The cost of change"' });
  });

export const questionSchema = z.object({
  number: z.coerce.number({ error: 'The question number must be a number' }).int().min(1, 'Numbers start at 1').max(200),
  prompt: z.string({ error: 'Please enter the question' }).trim().min(1, 'Please enter the question').max(2000),
  options_text: optionalText(3000),
  answer: z.string({ error: 'Please enter the answer' }).trim().min(1, 'Please enter the answer').max(300),
  accepted_text: optionalText(2000),
  explanation: optionalText(3000),
  evidence: optionalText(3000),
});
