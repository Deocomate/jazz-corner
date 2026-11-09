import { z } from 'zod';
import { emptyToUndefined } from '#lib/validate.js';

export const KIND_OPTIONS = [
  { value: 'word', label: 'Từ & collocation', badge: 'badge-red' },
  { value: 'pattern', label: 'Mẫu câu & ngữ pháp', badge: 'badge-yellow' },
  { value: 'idiom', label: 'Idiom & cách diễn đạt', badge: 'badge-blue' },
  { value: 'discourse', label: 'Cách triển khai ý', badge: 'badge-green' },
  { value: 'ielts_mistake', label: 'Lỗi IELTS', badge: 'badge-gray' },
];
export const LANGUAGE_KINDS = KIND_OPTIONS.filter((k) => k.value !== 'ielts_mistake');

export const SOURCE_OPTIONS = [
  { value: 'manual', label: 'Tự thêm' },
  { value: 'book', label: 'Books' },
  { value: 'ielts', label: 'IELTS' },
  { value: 'word_of_day', label: 'Word of the Day' },
  { value: 'speaking', label: 'Speaking' },
];

export const SUGGESTED_TAGS = ['Academic Writing', 'Speaking', 'Văn chương'];

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
  kind: z.enum(KIND_OPTIONS.map((k) => k.value), { error: 'Chọn loại mục' }),
  content: z.string({ error: 'Vui lòng nhập nội dung chính' }).trim().min(1, 'Vui lòng nhập nội dung chính').max(500),
  meaning: optionalText(2000),
  note: optionalText(5000),
  example: optionalText(2000),
  excerpt: optionalText(5000),
  tags: tagsField,
});

// Trường nguồn chỉ được gửi từ code (API), không hiện trong form sửa.
export const sourceSchema = z.object({
  source_type: z.enum(SOURCE_OPTIONS.map((s) => s.value)).default('manual'),
  source_label: optionalText(300),
  source_url: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(1000).regex(/^\/[^/]/, 'Liên kết nguồn phải là đường dẫn trong ứng dụng').optional(),
  ),
  book_id: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
  location: z.record(z.string(), z.number()).optional(),
});

export const reviewSchema = z.object({
  result: z.enum(['remembered', 'again'], { error: 'Kết quả ôn không hợp lệ' }),
});
