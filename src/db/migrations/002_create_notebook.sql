-- Notebook: kiến thức ngôn ngữ (từ, mẫu câu, idiom, cách triển khai ý) và lỗi IELTS.
-- Mỗi mục có lịch ôn riêng (due_date, interval_days).
CREATE TABLE notebook_items (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('word', 'pattern', 'idiom', 'discourse', 'ielts_mistake')),
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
  -- Lỗi IELTS: {testTitle, questionNumber, questionType, prompt, myAnswer, correctAnswer, evidence}
  ielts_json TEXT,
  attempt_id INTEGER,
  question_id INTEGER,
  -- Chống trùng khi lưu cùng một thẻ nhiều lần (VD: Word of the Day).
  dedupe_key TEXT UNIQUE,
  due_date TEXT,
  interval_days INTEGER NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notebook_due ON notebook_items (due_date);
CREATE INDEX idx_notebook_kind ON notebook_items (kind);
