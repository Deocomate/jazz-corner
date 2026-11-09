-- Word of the Day đã chọn cho từng ngày: giữ ổn định trong ngày kể cả khi thêm sách/đề mới.
CREATE TABLE daily_words (
  date TEXT PRIMARY KEY,
  word TEXT NOT NULL,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
