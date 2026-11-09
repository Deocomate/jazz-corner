-- Speaking: bài luyện (từ / câu / đoạn) và các bản ghi âm.
CREATE TABLE speaking_items (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('word', 'sentence', 'passage')),
  title TEXT,
  text TEXT NOT NULL,
  -- Bản gốc khi người dùng rút gọn/chỉnh nội dung luyện.
  original_text TEXT,
  origin TEXT NOT NULL DEFAULT 'mine' CHECK (origin IN ('mine', 'sample', 'ai')),
  sample_key TEXT UNIQUE,
  source_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('sample', 'manual', 'notebook', 'book', 'ielts', 'ai')),
  source_label TEXT,
  source_url TEXT,
  notebook_item_id INTEGER REFERENCES notebook_items (id) ON DELETE SET NULL,
  -- Audio mẫu dạng tệp (public/samples/...). audio_kind: human = người đọc, synthetic = giọng tổng hợp.
  audio_url TEXT,
  audio_kind TEXT CHECK (audio_kind IN ('human', 'synthetic')),
  audio_voice TEXT,
  -- Mốc thời gian theo cụm: JSON [{text, start, end}] (giây).
  segments_json TEXT,
  -- Đánh dấu nhấn/ngắt do người dùng chỉnh: JSON.
  markup_json TEXT,
  notes TEXT,
  last_practiced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE speaking_recordings (
  id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES speaking_items (id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('pronunciation', 'rhythm', 'read_aloud', 'shadowing', 'minimal_pairs')),
  stored_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  note TEXT,
  -- Câu/cụm cụ thể đang tập khi ghi (VD: một câu trong đoạn Read Aloud).
  target_text TEXT,
  needs_review INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_recordings_item ON speaking_recordings (item_id);
