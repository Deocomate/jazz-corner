import { z } from 'zod';
import { emptyToUndefined } from '#lib/validate.js';

// Vị trí: PDF {page, zoom}; EPUB {chapter, scroll(0..1), fontSize}. Giữ linh hoạt nhưng giới hạn kích thước.
export const locationSchema = z
  .object({
    page: z.number().int().min(1).max(100000).optional(),
    zoom: z.number().min(0.25).max(5).optional(),
    chapter: z.number().int().min(0).max(100000).optional(),
    scroll: z.number().min(0).max(1).optional(),
    fontSize: z.number().int().min(12).max(40).optional(),
  })
  .strict();

export const positionSchema = z.object({
  position: locationSchema,
  label: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  progress: z.number().min(0).max(1),
  totalUnits: z.number().int().min(1).max(100000).optional(),
});

export const bookmarkSchema = z.object({
  location: locationSchema,
  label: z.string({ error: 'The bookmark needs a name' }).trim().min(1, 'The bookmark needs a name').max(200),
});

export const highlightSchema = z.object({
  location: locationSchema,
  label: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  text: z.string({ error: 'No text selected' }).trim().min(1, 'No text selected').max(5000),
  note: z.preprocess(emptyToUndefined, z.string().trim().max(5000).optional()),
});

export const highlightNoteSchema = z.object({
  note: z.preprocess(emptyToUndefined, z.string().trim().max(5000).optional()),
});
