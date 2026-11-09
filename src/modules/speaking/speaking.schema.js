import { z } from 'zod';
import { emptyToUndefined } from '#lib/validate.js';

export const KIND_OPTIONS = [
  { value: 'word', label: 'Từ / cụm từ' },
  { value: 'sentence', label: 'Câu' },
  { value: 'passage', label: 'Đoạn' },
];
export const MODES = [
  { value: 'pronunciation', label: 'Pronunciation' },
  { value: 'rhythm', label: 'Rhythm and Intonation' },
  { value: 'read_aloud', label: 'Read Aloud' },
  { value: 'shadowing', label: 'Shadowing' },
];
export const modesFor = (kind) => (kind === 'word' ? MODES.filter((m) => m.value === 'pronunciation' || m.value === 'read_aloud') : MODES.filter((m) => m.value !== 'pronunciation'));
export const defaultMode = (kind) => (kind === 'word' ? 'pronunciation' : 'rhythm');

export const SOURCE_LABELS = { sample: 'Bài mẫu', manual: 'Tự nhập', notebook: 'Notebook', book: 'Books', ielts: 'IELTS', ai: 'AI tạo' };

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
  text: z.string({ error: 'Vui lòng nhập nội dung để luyện' }).trim().min(1, 'Vui lòng nhập nội dung để luyện').max(3000, 'Nội dung quá dài (tối đa 3000 ký tự) — hãy rút ngắn'),
  kind: z.preprocess(emptyToUndefined, z.enum(KIND_OPTIONS.map((k) => k.value)).optional()),
  title: optionalText(200),
  original_text: optionalText(5000),
  source_type: z.enum(['manual', 'notebook', 'book', 'ielts']).default('manual'),
  source_label: optionalText(300),
  source_url: z.preprocess(emptyToUndefined, z.string().trim().max(1000).regex(/^\/[^/]/, 'Liên kết nguồn không hợp lệ').optional()),
});

export const markupSchema = z.object({
  stress: z.record(z.string().regex(/^\d+$/), z.boolean()).refine((o) => Object.keys(o).length <= 1000),
});

export const recordingNoteSchema = z.object({
  note: optionalText(2000),
  needs_review: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
});

export const RECORDING_MODES = ['pronunciation', 'rhythm', 'read_aloud', 'shadowing', 'minimal_pairs'];
