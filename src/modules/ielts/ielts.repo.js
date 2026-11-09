// SQL cho đề IELTS: đề, bài đọc, nhóm câu hỏi, câu hỏi.
import { all, get, run } from '#db';

// --- Đề ---
export const listTests = () =>
  all(`SELECT t.*, (SELECT COUNT(*) FROM ielts_questions q WHERE q.test_id = t.id) AS question_count
       FROM ielts_tests t ORDER BY t.status DESC, t.updated_at DESC, t.id DESC`);

export const findTest = (id) => get('SELECT * FROM ielts_tests WHERE id = ?', [id]);
export const findTestBySampleKey = (key) => get('SELECT * FROM ielts_tests WHERE sample_key = ?', [key]);

export async function createTest(t) {
  const { id } = await run(
    `INSERT INTO ielts_tests (title, description, time_limit_minutes, skill, status, origin, sample_key)
     VALUES (?, ?, ?, 'reading', ?, ?, ?)`,
    [t.title, t.description ?? null, t.time_limit_minutes, t.status ?? 'draft', t.origin ?? 'mine', t.sample_key ?? null],
  );
  return id;
}

export const updateTest = (id, t) =>
  run(`UPDATE ielts_tests SET title = ?, description = ?, time_limit_minutes = ?, updated_at = datetime('now') WHERE id = ?`, [
    t.title, t.description ?? null, t.time_limit_minutes, id,
  ]);

export const setStatus = (id, status) =>
  run(`UPDATE ielts_tests SET status = ?, updated_at = datetime('now') WHERE id = ?`, [status, id]);

export const setSourcePdf = (id, storedName, originalName) =>
  run(`UPDATE ielts_tests SET source_pdf_name = ?, source_pdf_original = ?, updated_at = datetime('now') WHERE id = ?`, [
    storedName, originalName, id,
  ]);

export const touchTest = (id) => run(`UPDATE ielts_tests SET updated_at = datetime('now') WHERE id = ?`, [id]);
export const deleteTest = (id) => run('DELETE FROM ielts_tests WHERE id = ?', [id]);

// --- Bài đọc ---
export const listPassages = (testId) => all('SELECT * FROM ielts_passages WHERE test_id = ? ORDER BY position, id', [testId]);
export const findPassage = (testId, id) => get('SELECT * FROM ielts_passages WHERE id = ? AND test_id = ?', [id, testId]);

export async function createPassage(testId, p) {
  const { id } = await run('INSERT INTO ielts_passages (test_id, position, title, body) VALUES (?, ?, ?, ?)', [testId, p.position, p.title, p.body]);
  return id;
}
export const updatePassage = (testId, id, p) =>
  run('UPDATE ielts_passages SET position = ?, title = ?, body = ? WHERE id = ? AND test_id = ?', [p.position, p.title, p.body, id, testId]);
export const deletePassage = (testId, id) => run('DELETE FROM ielts_passages WHERE id = ? AND test_id = ?', [id, testId]);

// --- Nhóm câu hỏi ---
export const listGroups = (testId) => all('SELECT * FROM ielts_groups WHERE test_id = ? ORDER BY position, id', [testId]);
export const findGroup = (testId, id) => get('SELECT * FROM ielts_groups WHERE id = ? AND test_id = ?', [id, testId]);

export async function createGroup(testId, g) {
  const { id } = await run(
    'INSERT INTO ielts_groups (test_id, passage_id, position, type, instructions, options_json, word_limit) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [testId, g.passage_id ?? null, g.position, g.type, g.instructions, g.options ? JSON.stringify(g.options) : null, g.word_limit ?? null],
  );
  return id;
}
export const updateGroup = (testId, id, g) =>
  run(
    'UPDATE ielts_groups SET passage_id = ?, position = ?, type = ?, instructions = ?, options_json = ?, word_limit = ? WHERE id = ? AND test_id = ?',
    [g.passage_id ?? null, g.position, g.type, g.instructions, g.options ? JSON.stringify(g.options) : null, g.word_limit ?? null, id, testId],
  );
export const deleteGroup = (testId, id) => run('DELETE FROM ielts_groups WHERE id = ? AND test_id = ?', [id, testId]);

// --- Câu hỏi ---
export const listQuestions = (testId) => all('SELECT * FROM ielts_questions WHERE test_id = ? ORDER BY number, id', [testId]);
export const findQuestion = (testId, id) => get('SELECT * FROM ielts_questions WHERE id = ? AND test_id = ?', [id, testId]);

export async function createQuestion(testId, groupId, q) {
  const { id } = await run(
    `INSERT INTO ielts_questions (group_id, test_id, number, prompt, options_json, answer, accepted_json, explanation, evidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [groupId, testId, q.number, q.prompt, q.options ? JSON.stringify(q.options) : null, q.answer,
      q.accepted?.length ? JSON.stringify(q.accepted) : null, q.explanation ?? null, q.evidence ?? null],
  );
  return id;
}
export const updateQuestion = (testId, id, q) =>
  run(
    `UPDATE ielts_questions SET number = ?, prompt = ?, options_json = ?, answer = ?, accepted_json = ?, explanation = ?, evidence = ?
     WHERE id = ? AND test_id = ?`,
    [q.number, q.prompt, q.options ? JSON.stringify(q.options) : null, q.answer, q.accepted?.length ? JSON.stringify(q.accepted) : null,
      q.explanation ?? null, q.evidence ?? null, id, testId],
  );
/** Cập nhật lời giải thích của đề mẫu theo số câu (giữ nguyên câu hỏi và các lượt làm). */
export const updateSampleQuestionText = (testId, number, q) =>
  run('UPDATE ielts_questions SET prompt = ?, explanation = ?, evidence = ? WHERE test_id = ? AND number = ?', [
    q.prompt, q.explanation ?? null, q.evidence ?? null, testId, number,
  ]);

export const deleteQuestion = (testId, id) => run('DELETE FROM ielts_questions WHERE id = ? AND test_id = ?', [id, testId]);
