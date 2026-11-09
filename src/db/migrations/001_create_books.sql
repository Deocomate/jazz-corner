-- Sách người dùng tải lên (PDF/EPUB). Tệp gốc nằm trong UPLOAD_DIR/books/<stored_name>.
CREATE TABLE books (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  format TEXT NOT NULL CHECK (format IN ('pdf', 'epub')),
  stored_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  cover_name TEXT,
  origin TEXT NOT NULL DEFAULT 'mine' CHECK (origin IN ('mine', 'sample')),
  -- Vị trí đọc: PDF {page, zoom}; EPUB {chapter, scroll}. Lưu JSON.
  position_json TEXT,
  location_label TEXT,
  progress REAL NOT NULL DEFAULT 0,
  total_units INTEGER,
  last_opened_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_books_last_opened ON books (last_opened_at);

CREATE TABLE bookmarks (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  location_json TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_bookmarks_book ON bookmarks (book_id);

-- Highlight = đánh dấu đoạn trong sách (không tự vào hàng ôn).
CREATE TABLE highlights (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  location_json TEXT NOT NULL,
  location_label TEXT,
  text TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_highlights_book ON highlights (book_id);
