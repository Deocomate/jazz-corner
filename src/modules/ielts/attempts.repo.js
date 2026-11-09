// SQL cho lượt làm bài IELTS.
import { all, get, run } from '#db';

const COLUMNS = `a.id, a.test_id, a.mode, a.status, a.answers_json, a.flags_json, a.deadline_at, a.score, a.total,
  a.results_json, a.started_at, a.submitted_at, a.updated_at, t.title AS test_title, t.skill AS test_skill`;

export const findAttempt = (id) =>
  get(`SELECT ${COLUMNS} FROM ielts_attempts a JOIN ielts_tests t ON t.id = a.test_id WHERE a.id = ?`, [id]);

export const findOpenAttempt = (testId, mode) =>
  get(
    `SELECT ${COLUMNS} FROM ielts_attempts a JOIN ielts_tests t ON t.id = a.test_id
     WHERE a.test_id = ? AND a.mode = ? AND a.status = 'in_progress' ORDER BY a.id DESC LIMIT 1`,
    [testId, mode],
  );

export const latestOpenAttempt = () =>
  get(
    `SELECT ${COLUMNS} FROM ielts_attempts a JOIN ielts_tests t ON t.id = a.test_id
     WHERE a.status = 'in_progress' ORDER BY a.updated_at DESC, a.id DESC LIMIT 1`,
  );

export const listOpenAttempts = () =>
  all(
    `SELECT ${COLUMNS} FROM ielts_attempts a JOIN ielts_tests t ON t.id = a.test_id
     WHERE a.status = 'in_progress' ORDER BY a.updated_at DESC, a.id DESC LIMIT 10`,
  );

export const listSubmitted = (limit = 10) =>
  all(
    `SELECT ${COLUMNS} FROM ielts_attempts a JOIN ielts_tests t ON t.id = a.test_id
     WHERE a.status = 'submitted' ORDER BY a.submitted_at DESC, a.id DESC LIMIT ?`,
    [limit],
  );

export const countSubmitted = async () => (await get("SELECT COUNT(*) AS n FROM ielts_attempts WHERE status = 'submitted'")).n;

export async function createAttempt(testId, mode, deadlineAt) {
  const { id } = await run('INSERT INTO ielts_attempts (test_id, mode, deadline_at) VALUES (?, ?, ?)', [testId, mode, deadlineAt]);
  return id;
}

/** Chỉ lưu khi bài còn đang làm — tránh ghi đè bài đã nộp. */
export const saveProgress = (id, answers, flags) =>
  run(
    `UPDATE ielts_attempts SET answers_json = ?, flags_json = ?, updated_at = datetime('now') WHERE id = ? AND status = 'in_progress'`,
    [JSON.stringify(answers), JSON.stringify(flags), id],
  );

/** Nộp bài một lần duy nhất (điều kiện status nằm trong cùng câu lệnh). */
export const submitAttempt = (id, answers, score, total, results) =>
  run(
    `UPDATE ielts_attempts SET status = 'submitted', answers_json = ?, score = ?, total = ?, results_json = ?,
       submitted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'in_progress'`,
    [JSON.stringify(answers), score, total, JSON.stringify(results), id],
  );
