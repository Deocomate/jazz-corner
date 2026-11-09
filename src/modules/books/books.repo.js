// SQL cho sách, bookmark và highlight.
import { all, get, run } from '#db';

const BOOK_COLUMNS = `id, title, author, format, stored_name, original_name, size_bytes, cover_name, origin,
  position_json, location_label, progress, total_units, last_opened_at, created_at, updated_at`;

export const listBooks = () =>
  all(`SELECT ${BOOK_COLUMNS} FROM books ORDER BY COALESCE(last_opened_at, created_at) DESC, id DESC`);

export const findBook = (id) => get(`SELECT ${BOOK_COLUMNS} FROM books WHERE id = ?`, [id]);

export const findLastOpened = () =>
  get(`SELECT ${BOOK_COLUMNS} FROM books WHERE last_opened_at IS NOT NULL ORDER BY last_opened_at DESC, id DESC LIMIT 1`);

export const countBooks = async () => (await get('SELECT COUNT(*) AS n FROM books')).n;

export async function createBook(b) {
  const { id } = await run(
    `INSERT INTO books (title, author, format, stored_name, original_name, size_bytes, cover_name, origin, total_units)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.title, b.author ?? null, b.format, b.storedName, b.originalName, b.sizeBytes, b.coverName ?? null, b.origin ?? 'mine', b.totalUnits ?? null],
  );
  return id;
}

export const updatePosition = (id, p) =>
  run(
    `UPDATE books SET position_json = ?, location_label = ?, progress = ?, total_units = COALESCE(?, total_units),
       last_opened_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [JSON.stringify(p.position), p.label ?? null, p.progress, p.totalUnits ?? null, id],
  );

export const touchOpened = (id) => run(`UPDATE books SET last_opened_at = datetime('now') WHERE id = ?`, [id]);

export const setCover = (id, coverName) =>
  run(`UPDATE books SET cover_name = ?, updated_at = datetime('now') WHERE id = ?`, [coverName, id]);

export const deleteBook = (id) => run('DELETE FROM books WHERE id = ?', [id]);

// --- Bookmark ---
export const listBookmarks = (bookId) =>
  all('SELECT id, location_json, label, created_at FROM bookmarks WHERE book_id = ? ORDER BY id DESC', [bookId]);

export async function createBookmark(bookId, location, label) {
  const { id } = await run('INSERT INTO bookmarks (book_id, location_json, label) VALUES (?, ?, ?)', [
    bookId,
    JSON.stringify(location),
    label,
  ]);
  return id;
}

export const deleteBookmark = (bookId, id) => run('DELETE FROM bookmarks WHERE id = ? AND book_id = ?', [id, bookId]);

// --- Highlight ---
export const listHighlights = (bookId) =>
  all(
    'SELECT id, location_json, location_label, text, note, created_at FROM highlights WHERE book_id = ? ORDER BY id DESC',
    [bookId],
  );

export const countHighlights = async () => (await get('SELECT COUNT(*) AS n FROM highlights')).n;

export async function createHighlight(bookId, h) {
  const { id } = await run(
    'INSERT INTO highlights (book_id, location_json, location_label, text, note) VALUES (?, ?, ?, ?, ?)',
    [bookId, JSON.stringify(h.location), h.label ?? null, h.text, h.note ?? null],
  );
  return id;
}

export const updateHighlightNote = (bookId, id, note) =>
  run(`UPDATE highlights SET note = ?, updated_at = datetime('now') WHERE id = ? AND book_id = ?`, [note, id, bookId]);

export const deleteHighlight = (bookId, id) => run('DELETE FROM highlights WHERE id = ? AND book_id = ?', [id, bookId]);
