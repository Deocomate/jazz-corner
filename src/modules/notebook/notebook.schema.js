import { z } from 'zod';
import { emptyToUndefined } from '#lib/validate.js';

export const KIND_OPTIONS = [
  { value: 'note', label: 'Note', badge: 'badge-gray', dot: 'bg-slate-400' },
  { value: 'word', label: 'Word & collocation', badge: 'badge-red', dot: 'bg-brand-500' },
  { value: 'pattern', label: 'Sentence pattern & grammar', badge: 'badge-yellow', dot: 'bg-amber-500' },
  { value: 'idiom', label: 'Idiom & expression', badge: 'badge-blue', dot: 'bg-lav-700' },
  { value: 'discourse', label: 'Discourse move', badge: 'badge-green', dot: 'bg-emerald-600' },
  { value: 'ielts_mistake', label: 'IELTS mistake', badge: 'badge-red', dot: 'bg-red-700' },
];
export const LANGUAGE_KINDS = KIND_OPTIONS.filter((k) => k.value !== 'ielts_mistake');

export const SOURCE_OPTIONS = [
  { value: 'manual', label: 'Written by me' },
  { value: 'book', label: 'Books' },
  { value: 'ielts', label: 'IELTS' },
  { value: 'word_of_day', label: 'Word of the Day' },
  { value: 'speaking', label: 'Speaking' },
];

export const SUGGESTED_TAGS = ['Academic Writing', 'Speaking', 'Literature'];

const optionalText = (max) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

// Chuẩn hoá nhãn: "a, b ,a" -> "a, b"
const tagsField = z.preprocess(
  (v) => {
    const list = Array.isArray(v) ? v : String(v ?? '').split(',');
    const clean = [...new Set(list.map((t) => String(t).trim()).filter(Boolean))].slice(0, 10);
    return clean.length ? clean.join(', ') : undefined;
  },
  z.string().max(300).optional(),
);

export const itemSchema = z.object({
  kind: z.enum(KIND_OPTIONS.map((k) => k.value), { error: 'Choose a type' }),
  content: z.string({ error: 'Please enter the main text' }).trim().min(1, 'Please enter the main text').max(500),
  meaning: optionalText(2000),
  note: optionalText(5000),
  example: optionalText(2000),
  excerpt: optionalText(5000),
  tags: tagsField,
  // Ghi chép tự do chỉ vào hàng ôn khi người dùng chọn; các loại khác luôn vào hàng ôn.
  review: z.preprocess((v) => (v === undefined ? undefined : v === 'on' || v === 'true' || v === true), z.boolean().optional()),
});

// Ghi nhanh trong sổ tay: một ô chữ, dòng đầu là tiêu đề, phần còn lại là nội dung.
export const quickSchema = z.object({
  text: z.string({ error: 'Write down what you just learned' }).trim().min(1, 'Write down what you just learned').max(5000, 'The note is too long (5,000 characters max)'),
  kind: z.enum(KIND_OPTIONS.filter((k) => k.value !== 'ielts_mistake').map((k) => k.value)).default('note'),
  tags: tagsField,
  review: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
});

// Trường nguồn chỉ được gửi từ code (API), không hiện trong form sửa.
export const sourceSchema = z.object({
  source_type: z.enum(SOURCE_OPTIONS.map((s) => s.value)).default('manual'),
  source_label: optionalText(300),
  source_url: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(1000).regex(/^\/[^/]/, 'The source link must point inside the app').optional(),
  ),
  book_id: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
  location: z.record(z.string(), z.number()).optional(),
});

export const reviewSchema = z.object({
  result: z.enum(['remembered', 'again'], { error: 'Invalid review result' }),
});
