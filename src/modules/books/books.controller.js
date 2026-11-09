// Trang Books (thư viện, trình đọc) và phục vụ tệp sách.
import { notFound } from '#lib/errors.js';
import { filePath } from '#lib/storage.js';
import * as service from './books.service.js';

export async function index(req, res) {
  const books = await service.listBooks();
  res.render('books/index', { title: 'Books', books, scripts: ['/js/upload.js'] });
}

export async function reader(req, res) {
  const book = await service.getBook(req.params.id);
  await service.markOpened(book.id);
  // ?loc=... mở đúng vị trí nguồn (từ Notebook/Speaking); ?find=... tô sáng đoạn trích.
  let target = null;
  try {
    target = req.query.loc ? JSON.parse(String(req.query.loc)) : null;
  } catch {
    target = null;
  }
  const config = {
    id: book.id,
    title: book.title,
    format: book.format,
    position: target || book.position || null,
    find: typeof req.query.find === 'string' ? req.query.find.slice(0, 500) : null,
    hasCover: Boolean(book.cover_name),
    fileUrl: `/books/${book.id}/file`,
  };
  res.render('books/reader', {
    title: book.title,
    book,
    config,
    fullBleed: true,
    scripts: [book.format === 'pdf' ? '/js/reader/pdf-reader.js' : '/js/reader/epub-reader.js'],
  });
}

export async function file(req, res) {
  const book = await service.getBook(req.params.id);
  const full = filePath('books', book.stored_name);
  if (!full) throw notFound('The book file is missing on this computer.');
  res.type(book.format === 'pdf' ? 'application/pdf' : 'application/epub+zip').sendFile(full);
}

export async function cover(req, res) {
  const book = await service.getBook(req.params.id);
  const full = filePath('covers', book.cover_name);
  if (!full) throw notFound();
  res.set('Cache-Control', 'private, max-age=3600').sendFile(full);
}

export async function epubResource(req, res) {
  const { data, mime } = await service.epubResource(req.params.id, req.query.path);
  // Chương XHTML trả về dạng văn bản: trình đọc tự làm sạch rồi mới hiển thị (không chạy script trong sách).
  const safeMime = /html/.test(mime) ? 'text/plain; charset=utf-8' : mime;
  res.set({ 'Content-Type': safeMime, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': 'sandbox' });
  res.send(data);
}

export async function destroy(req, res) {
  await service.deleteBook(req.params.id);
  req.flash('success', 'The book was removed from your library.');
  res.redirect('/books');
}
