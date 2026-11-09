-- Thêm loại mục "note" (ghi chép tự do) cho Notebook dạng sổ tay.
-- SQLite không sửa được CHECK -> dựng lại bảng theo cách SQLite khuyên dùng:
-- tắt khoá ngoại để DROP không làm mất liên kết ở speaking_items, rồi bật lại.
PRAGMA foreign_keys = OFF;

CREATE TABLE notebook_items_new (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('note', 'word', 'pattern', 'idiom', 'discourse', 'ielts_mistake')),
  content TEXT NOT NULL,
  meaning TEXT,
  note TEXT,
  example TEXT,
  excerpt TEXT,
  tags TEXT,
  origin TEXT NOT NULL DEFAULT 'mine' CHECK (origin IN ('mine', 'sample', 'ai')),
  source_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'book', 'ielts', 'word_of_day', 'speaking')),
  source_label TEXT,
  source_url TEXT,
  book_id INTEGER REFERENCES books (id) ON DELETE SET NULL,
  location_json TEXT,
  ielts_json TEXT,
  attempt_id INTEGER,
  question_id INTEGER,
  dedupe_key TEXT UNIQUE,
  -- NULL = không nằm trong hàng ôn (VD: ghi chép tự do không chọn ôn).
  due_date TEXT,
  interval_days INTEGER NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO notebook_items_new SELECT
  id, kind, content, meaning, note, example, excerpt, tags, origin, source_type, source_label, source_url,
  book_id, location_json, ielts_json, attempt_id, question_id, dedupe_key, due_date, interval_days, review_count,
  last_reviewed_at, created_at, updated_at
FROM notebook_items;

DROP TABLE notebook_items;
ALTER TABLE notebook_items_new RENAME TO notebook_items;
CREATE INDEX idx_notebook_due ON notebook_items (due_date);
CREATE INDEX idx_notebook_kind ON notebook_items (kind);
CREATE INDEX idx_notebook_created ON notebook_items (created_at);

PRAGMA foreign_keys = ON;
