import { z } from 'zod';
import { emptyToUndefined } from '#lib/validate.js';

export const KIND_OPTIONS = [
  { value: 'word', label: 'Word / phrase' },
  { value: 'sentence', label: 'Sentence' },
  { value: 'passage', label: 'Passage' },
];
export const MODES = [
  { value: 'pronunciation', label: 'Pronunciation' },
  { value: 'rhythm', label: 'Rhythm and Intonation' },
  { value: 'read_aloud', label: 'Read Aloud' },
  { value: 'shadowing', label: 'Shadowing' },
];
export const modesFor = (kind) => (kind === 'word' ? MODES.filter((m) => m.value === 'pronunciation' || m.value === 'read_aloud') : MODES.filter((m) => m.value !== 'pronunciation'));
export const defaultMode = (kind) => (kind === 'word' ? 'pronunciation' : 'rhythm');

export const SOURCE_LABELS = { sample: 'Sample', manual: 'Typed by me', notebook: 'Notebook', book: 'Books', ielts: 'IELTS', ai: 'AI-generated' };

/** Đoán loại bài từ nội dung: ≤ 3 từ = từ/cụm; 1 câu = câu; còn lại = đoạn. */
export function guessKind(text) {
  const t = String(text || '').trim();
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words <= 3 && !/[.!?]\s+\S/.test(t)) return 'word';
  const sentences = (t.match(/[.!?]+(\s|$)/g) || []).length;
  return sentences > 1 ? 'passage' : 'sentence';
}

const optionalText = (max) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

export const itemSchema = z.object({
  text: z.string({ error: 'Please enter something to practise' }).trim().min(1, 'Please enter something to practise').max(3000, 'The text is too long (3,000 characters max) — please shorten it'),
  kind: z.preprocess(emptyToUndefined, z.enum(KIND_OPTIONS.map((k) => k.value)).optional()),
  title: optionalText(200),
  original_text: optionalText(5000),
  source_type: z.enum(['manual', 'notebook', 'book', 'ielts']).default('manual'),
  source_label: optionalText(300),
  source_url: z.preprocess(emptyToUndefined, z.string().trim().max(1000).regex(/^\/[^/]/, 'Invalid source link').optional()),
});

export const markupSchema = z.object({
  stress: z.record(z.string().regex(/^\d+$/), z.boolean()).refine((o) => Object.keys(o).length <= 1000),
});

export const recordingNoteSchema = z.object({
  note: optionalText(2000),
  needs_review: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
});

export const RECORDING_MODES = ['pronunciation', 'rhythm', 'read_aloud', 'shadowing', 'minimal_pairs'];
