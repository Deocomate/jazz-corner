-- Từ người dùng bấm "Another word" để bỏ qua: không bao giờ chọn lại làm Word of the Day.
CREATE TABLE skipped_words (
  word TEXT PRIMARY KEY,
  skipped_at TEXT NOT NULL DEFAULT (datetime('now'))
);
