// SQL cho Notebook và hàng ôn.
import { all, get, run } from '#db';

const COLUMNS = `id, kind, content, meaning, note, example, excerpt, tags, origin, source_type, source_label, source_url,
  book_id, location_json, ielts_json, attempt_id, question_id, dedupe_key, due_date, interval_days, review_count,
  last_reviewed_at, created_at, updated_at`;

/** Lọc: q (tìm trong nội dung), kind, source, tag. Chỉ ghép đoạn SQL cố định, giá trị luôn qua `?`. */
function whereFor({ q, kind, source, tag } = {}) {
  const parts = [];
  const args = [];
  if (q) {
    parts.push('(content LIKE ? OR meaning LIKE ? OR note LIKE ? OR excerpt LIKE ? OR example LIKE ?)');
    const like = `%${q}%`;
    args.push(like, like, like, like, like);
  }
  if (kind === 'language') parts.push("kind <> 'ielts_mistake'");
  else if (kind) {
    parts.push('kind = ?');
    args.push(kind);
  }
  if (source) {
    parts.push('source_type = ?');
    args.push(source);
  }
  if (tag) {
    parts.push("(', ' || tags || ',') LIKE ?");
    args.push(`%, ${tag},%`);
  }
  // parts chỉ chứa đoạn SQL cố định viết trong hàm này; giá trị người dùng nằm trong args.
  const whereSql = parts.length ? ['WHERE', parts.join(' AND ')].join(' ') : '';
  return { whereSql, args };
}

export function listItems(filters, { limit = 30, offset = 0 } = {}) {
  const { whereSql, args } = whereFor(filters);
  return all(`SELECT ${COLUMNS} FROM notebook_items ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`, [...args, limit, offset]);
}

export async function countItems(filters) {
  const { whereSql, args } = whereFor(filters);
  return (await get(`SELECT COUNT(*) AS n FROM notebook_items ${whereSql}`, args)).n;
}

/** Thời điểm ghi của mọi mục (để chia trang sổ theo ngày). */
export const listCreatedAt = () => all('SELECT created_at FROM notebook_items ORDER BY created_at');

/** Các mục ghi trong khoảng [start, end) — cũ trước, mới sau như một trang nhật ký. */
export const listBetween = (start, end) =>
  all(`SELECT ${COLUMNS} FROM notebook_items WHERE created_at >= ? AND created_at < ? ORDER BY created_at, id`, [start, end]);

export const findItem = (id) => get(`SELECT ${COLUMNS} FROM notebook_items WHERE id = ?`, [id]);
export const findByDedupeKey = (key) => get(`SELECT ${COLUMNS} FROM notebook_items WHERE dedupe_key = ?`, [key]);
export const allTags = () => all("SELECT tags FROM notebook_items WHERE tags IS NOT NULL AND tags <> ''");

/** Thêm mục. Có dedupe_key trùng thì không thêm (trả null) — kiểm tra và ghi trong cùng một câu lệnh. */
export async function createItem(item) {
  const { id, changes } = await run(
    `INSERT OR IGNORE INTO notebook_items (kind, content, meaning, note, example, excerpt, tags, origin, source_type,
       source_label, source_url, book_id, location_json, ielts_json, attempt_id, question_id, dedupe_key, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.kind, item.content, item.meaning ?? null, item.note ?? null, item.example ?? null, item.excerpt ?? null,
      item.tags ?? null, item.origin ?? 'mine', item.source_type ?? 'manual', item.source_label ?? null,
      item.source_url ?? null, item.book_id ?? null, item.location ? JSON.stringify(item.location) : null,
      item.ielts ? JSON.stringify(item.ielts) : null, item.attempt_id ?? null, item.question_id ?? null,
      item.dedupe_key ?? null, item.due_date,
    ],
  );
  return changes > 0 ? id : null;
}

export const updateItem = (id, d) =>
  run(
    `UPDATE notebook_items SET kind = ?, content = ?, meaning = ?, note = ?, example = ?, excerpt = ?, tags = ?,
       updated_at = datetime('now') WHERE id = ?`,
    [d.kind, d.content, d.meaning ?? null, d.note ?? null, d.example ?? null, d.excerpt ?? null, d.tags ?? null, id],
  );

export const setDue = (id, dueDate) =>
  run(`UPDATE notebook_items SET due_date = ?, updated_at = datetime('now') WHERE id = ?`, [dueDate, id]);

export const deleteItem = (id) => run('DELETE FROM notebook_items WHERE id = ?', [id]);

// --- Hàng ôn ---
export const listDue = (today, limit = 50) =>
  all(`SELECT ${COLUMNS} FROM notebook_items WHERE due_date <= ? ORDER BY due_date, id LIMIT ?`, [today, limit]);

export const countDue = async (today) =>
  (await get('SELECT COUNT(*) AS n FROM notebook_items WHERE due_date <= ?', [today])).n;

export const saveReview = (id, dueDate, intervalDays) =>
  run(
    `UPDATE notebook_items SET due_date = ?, interval_days = ?, review_count = review_count + 1,
       last_reviewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [dueDate, intervalDays, id],
  );

export const recentMistakes = (limit = 5) =>
  all(`SELECT ${COLUMNS} FROM notebook_items WHERE kind = 'ielts_mistake' ORDER BY id DESC LIMIT ?`, [limit]);

export const reviewedSince = async (since) =>
  (await get('SELECT COUNT(*) AS n FROM notebook_items WHERE last_reviewed_at >= ?', [since])).n;
