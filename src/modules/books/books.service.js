// Nghiệp vụ sách: tải lên, đọc cấu trúc EPUB, lưu vị trí, bookmark, highlight.
import path from 'node:path';
import { notFound } from '#lib/errors.js';
import { validate } from '#lib/validate.js';
import { parseEpub, mimeFor } from '#lib/epub.js';
import { extractEntry, ZipError } from '#lib/zip.js';
import { saveFile, readFile, removeFile } from '#lib/storage.js';
import * as repo from './books.repo.js';
import { positionSchema, bookmarkSchema, highlightSchema, highlightNoteSchema } from './books.schema.js';

const isPdf = (buf) => buf.length > 4 && buf.subarray(0, 5).toString('latin1') === '%PDF-';
const isZip = (buf) => buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b;
const imageExt = (buf) => {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.length > 8 && buf.subarray(1, 4).toString('latin1') === 'PNG') return 'png';
  if (buf.length > 12 && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
};
const titleFromFileName = (name) =>
  path.parse(name || 'Sách không tên').name.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Sách không tên';

const parseJson = (s) => {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};
const decorate = (b) => b && { ...b, position: parseJson(b.position_json), percent: Math.round((b.progress || 0) * 100) };

// Cấu trúc EPUB được giữ trong bộ nhớ cho vài sách gần nhất để mở chương nhanh.
const epubCache = new Map();
async function loadEpub(book) {
  if (epubCache.has(book.stored_name)) return epubCache.get(book.stored_name);
  const buffer = await readFile('books', book.stored_name);
  if (!buffer) throw notFound('Không tìm thấy tệp sách trên máy. Hãy xoá và tải lại sách.');
  const parsed = { buffer, ...parseEpub(buffer) };
  epubCache.set(book.stored_name, parsed);
  if (epubCache.size > 3) epubCache.delete(epubCache.keys().next().value);
  return parsed;
}

export const listBooks = async () => (await repo.listBooks()).map(decorate);
export const lastOpenedBook = async () => decorate(await repo.findLastOpened());

export async function getBook(id) {
  const book = await repo.findBook(id);
  if (!book) throw notFound('Không tìm thấy sách.');
  return decorate(book);
}

/** Tải sách lên. Trả { ok, data: book } hoặc { ok: false, errors: { _form } } với lý do dễ hiểu. */
export async function uploadBook(buffer, originalName, { origin = 'mine', title = null } = {}) {
  if (!buffer?.length) return { ok: false, errors: { _form: 'Tệp trống. Hãy chọn lại tệp PDF hoặc EPUB.' } };
  const fallbackTitle = title || titleFromFileName(originalName);

  if (isPdf(buffer)) {
    const storedName = await saveFile('books', buffer, 'pdf');
    const id = await repo.createBook({
      title: fallbackTitle, format: 'pdf', storedName, originalName: originalName || 'book.pdf', sizeBytes: buffer.length, origin,
    });
    return { ok: true, data: await getBook(id) };
  }

  if (isZip(buffer)) {
    let epub;
    try {
      epub = parseEpub(buffer);
    } catch (err) {
      if (err instanceof ZipError) return { ok: false, errors: { _form: `Không đọc được EPUB: ${err.message}` } };
      throw err;
    }
    const storedName = await saveFile('books', buffer, 'epub');
    let coverName = null;
    if (epub.coverPath) {
      const cover = extractEntry(buffer, epub.entries, epub.coverPath);
      const ext = cover && imageExt(cover);
      if (ext) coverName = await saveFile('covers', cover, ext);
    }
    const id = await repo.createBook({
      title: epub.title || fallbackTitle, author: epub.author, format: 'epub', storedName,
      originalName: originalName || 'book.epub', sizeBytes: buffer.length, coverName, origin, totalUnits: epub.spine.length,
    });
    return { ok: true, data: await getBook(id) };
  }

  return {
    ok: false,
    errors: { _form: 'Định dạng chưa hỗ trợ. Bản đầu chỉ đọc được PDF và EPUB — hãy đổi sang một trong hai định dạng này.' },
  };
}

export async function epubStructure(id) {
  const book = await getBook(id);
  if (book.format !== 'epub') throw notFound();
  const { spine, toc } = await loadEpub(book);
  return { spine, toc };
}

/** Lấy một tệp bên trong EPUB (chương XHTML, ảnh). */
export async function epubResource(id, filePath) {
  const book = await getBook(id);
  if (book.format !== 'epub' || typeof filePath !== 'string') throw notFound();
  const epub = await loadEpub(book);
  const data = extractEntry(epub.buffer, epub.entries, filePath);
  if (!data) throw notFound('Không tìm thấy nội dung này trong EPUB.');
  return { data, mime: mimeFor(filePath) };
}

export async function savePosition(id, input) {
  await getBook(id);
  const result = validate(positionSchema, input);
  if (!result.ok) return result;
  await repo.updatePosition(id, result.data);
  return { ok: true, data: null };
}

export const markOpened = (id) => repo.touchOpened(id);

export async function setCover(id, buffer) {
  const book = await getBook(id);
  const ext = buffer?.length && imageExt(buffer);
  if (!ext) return { ok: false, errors: { _form: 'Ảnh bìa phải là JPG, PNG hoặc WEBP.' } };
  const coverName = await saveFile('covers', buffer, ext);
  await repo.setCover(id, coverName);
  if (book.cover_name) await removeFile('covers', book.cover_name);
  return { ok: true, data: { coverName } };
}

export async function deleteBook(id) {
  const book = await getBook(id);
  await repo.deleteBook(id);
  epubCache.delete(book.stored_name);
  await removeFile('books', book.stored_name);
  if (book.cover_name) await removeFile('covers', book.cover_name);
}

// --- Bookmark & highlight ---
const withLocation = (rows) => rows.map((r) => ({ ...r, location: parseJson(r.location_json) }));

export async function listMarks(id) {
  await getBook(id);
  return {
    bookmarks: withLocation(await repo.listBookmarks(id)),
    highlights: withLocation(await repo.listHighlights(id)),
  };
}

export async function addBookmark(id, input) {
  await getBook(id);
  const result = validate(bookmarkSchema, input);
  if (!result.ok) return result;
  return { ok: true, data: { id: await repo.createBookmark(id, result.data.location, result.data.label) } };
}

export const removeBookmark = (id, bookmarkId) => repo.deleteBookmark(id, bookmarkId);

export async function addHighlight(id, input) {
  await getBook(id);
  const result = validate(highlightSchema, input);
  if (!result.ok) return result;
  return { ok: true, data: { id: await repo.createHighlight(id, result.data) } };
}

export async function updateHighlightNote(id, highlightId, input) {
  const result = validate(highlightNoteSchema, input);
  if (!result.ok) return result;
  const { changes } = await repo.updateHighlightNote(id, highlightId, result.data.note ?? null);
  if (!changes) throw notFound('Không tìm thấy highlight.');
  return { ok: true, data: null };
}

export const removeHighlight = (id, highlightId) => repo.deleteHighlight(id, highlightId);
