-- Đề IELTS tương tác (tách khỏi PDF nguồn). Bản đầu: Academic Reading.
CREATE TABLE ielts_tests (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  skill TEXT NOT NULL DEFAULT 'reading' CHECK (skill IN ('reading', 'listening', 'writing', 'speaking')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  origin TEXT NOT NULL DEFAULT 'mine' CHECK (origin IN ('mine', 'sample', 'ai')),
  sample_key TEXT UNIQUE,
  description TEXT,
  time_limit_minutes INTEGER NOT NULL DEFAULT 60,
  source_pdf_name TEXT,
  source_pdf_original TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- audio_name/transcript/image_name: để dành cho Listening và đề có hình (giai đoạn sau).
CREATE TABLE ielts_passages (
  id INTEGER PRIMARY KEY,
  test_id INTEGER NOT NULL REFERENCES ielts_tests (id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audio_name TEXT,
  transcript TEXT,
  image_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_passages_test ON ielts_passages (test_id);

CREATE TABLE ielts_groups (
  id INTEGER PRIMARY KEY,
  test_id INTEGER NOT NULL REFERENCES ielts_tests (id) ON DELETE CASCADE,
  passage_id INTEGER REFERENCES ielts_passages (id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 1,
  type TEXT NOT NULL CHECK (type IN ('mcq', 'tfng', 'headings', 'completion')),
  instructions TEXT NOT NULL,
  -- headings: danh sách tiêu đề dùng chung; JSON [{key:'i', text:'...'}]
  options_json TEXT,
  word_limit INTEGER,
  image_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_groups_test ON ielts_groups (test_id);

CREATE TABLE ielts_questions (
  id INTEGER PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES ielts_groups (id) ON DELETE CASCADE,
  test_id INTEGER NOT NULL REFERENCES ielts_tests (id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  -- mcq: JSON [{key:'A', text:'...'}]
  options_json TEXT,
  answer TEXT NOT NULL,
  -- completion: các biến thể đáp án hợp lệ, JSON ["..."]
  accepted_json TEXT,
  explanation TEXT,
  evidence TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_questions_group ON ielts_questions (group_id);

CREATE TABLE ielts_attempts (
  id INTEGER PRIMARY KEY,
  test_id INTEGER NOT NULL REFERENCES ielts_tests (id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('practice', 'exam')),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted')),
  answers_json TEXT NOT NULL DEFAULT '{}',
  flags_json TEXT NOT NULL DEFAULT '[]',
  -- Hạn nộp (UTC ISO) cho chế độ Làm đề.
  deadline_at TEXT,
  score INTEGER,
  total INTEGER,
  -- Ảnh chụp kết quả lúc nộp, để sửa đề sau này không làm đổi kết quả cũ.
  results_json TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_attempts_test ON ielts_attempts (test_id);
CREATE INDEX idx_attempts_status ON ielts_attempts (status);
