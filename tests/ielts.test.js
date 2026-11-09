import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, postForm, csrfToken } from './helpers.js';
import { ensureSampleTest } from '../src/modules/ielts/ielts.import.js';
import { gradeAnswer, normalizeAnswer } from '../src/modules/ielts/scoring.js';
import { get, run } from '../src/db/client.js';

const { agent } = await setup();
await ensureSampleTest();
const sample = await get("SELECT id FROM ielts_tests WHERE sample_key = 'reading-practice-urban-forest'");

test('chấm Completion: chuẩn hoá hoa/thường, khoảng trắng, biến thể và giới hạn từ', () => {
  const group = { type: 'completion', word_limit: 2 };
  const q = { answer: 'heat island', accepted: ['heat-island'] };
  assert.equal(normalizeAnswer('  Heat   ISLAND. '), 'heat island');
  assert.equal(gradeAnswer(q, group, 'Heat  Island').isCorrect, true);
  assert.equal(gradeAnswer(q, group, 'heat-island').isCorrect, true);
  const over = gradeAnswer(q, group, 'heat island effect');
  assert.equal(over.isCorrect, false);
  assert.match(over.note, /giới hạn/);
  assert.equal(gradeAnswer({ answer: 'NOT GIVEN' }, { type: 'tfng' }, 'not given').isCorrect, true);
});

test('đề mẫu được tạo một lần, đã duyệt và có trong kho đề', async () => {
  await ensureSampleTest();
  assert.equal((await get("SELECT COUNT(*) AS n FROM ielts_tests WHERE sample_key IS NOT NULL")).n, 1);
  const res = await agent.get('/ielts');
  assert.match(res.text, /The Return of the Urban Forest/);
  assert.match(res.text, /Dữ liệu mẫu/);
});

test('soạn đề: tạo nháp, thêm bài đọc, nhóm, câu hỏi; không duyệt được khi thiếu; duyệt rồi làm', async () => {
  const created = await postForm(agent, '/ielts/tests', { title: 'My Test', time_limit_minutes: '20' }, { from: '/ielts/tests/new' });
  assert.equal(created.status, 302);
  const id = Number(created.headers.location.match(/tests\/(\d+)/)[1]);

  const early = await postForm(agent, `/ielts/tests/${id}/publish`, {}, { from: `/ielts/tests/${id}/review` });
  assert.equal(early.status, 302);
  assert.equal((await get('SELECT status FROM ielts_tests WHERE id = ?', [id])).status, 'draft');

  await postForm(agent, `/ielts/tests/${id}/passages`, { title: 'Bees', position: '1', body: 'Bees are important pollinators.\n\nCities can help bees thrive in many ways.' }, { from: `/ielts/tests/${id}/passages/new` });
  const passage = await get('SELECT id FROM ielts_passages WHERE test_id = ?', [id]);
  const grp = await postForm(agent, `/ielts/tests/${id}/groups`, { type: 'mcq', passage_id: String(passage.id), position: '1', instructions: 'Choose A, B or C.' }, { from: `/ielts/tests/${id}/groups/new` });
  assert.equal(grp.status, 302);
  const group = await get('SELECT id FROM ielts_groups WHERE test_id = ?', [id]);

  const bad = await postForm(agent, `/ielts/tests/${id}/groups/${group.id}/questions`, { number: '1', prompt: 'Bees are', options_text: 'A. pests\nB. pollinators', answer: 'D' }, { from: `/ielts/tests/${id}/groups/${group.id}/questions/new` });
  assert.equal(bad.status, 422);
  assert.match(bad.text, /ký hiệu lựa chọn/);

  const ok = await postForm(agent, `/ielts/tests/${id}/groups/${group.id}/questions`, { number: '1', prompt: 'Bees are', options_text: 'A. pests\nB. pollinators', answer: 'b', evidence: 'Bees are important pollinators.' }, { from: `/ielts/tests/${id}/groups/${group.id}/questions/new` });
  assert.equal(ok.status, 302);

  await postForm(agent, `/ielts/tests/${id}/publish`, {}, { from: `/ielts/tests/${id}/review` });
  assert.equal((await get('SELECT status FROM ielts_tests WHERE id = ?', [id])).status, 'published');
});

test('Làm đề: tự lưu, tải lại giữ câu trả lời và hạn nộp, chặn xem đáp án, nộp và chấm đúng', async () => {
  const start = await postForm(agent, `/ielts/tests/${sample.id}/start`, { mode: 'exam' }, { from: '/ielts' });
  const attemptId = Number(start.headers.location.match(/attempts\/(\d+)/)[1]);
  const first = await agent.get(`/ielts/attempts/${attemptId}`);
  assert.equal(first.status, 200);
  const deadline = (await get('SELECT deadline_at FROM ielts_attempts WHERE id = ?', [attemptId])).deadline_at;
  assert.ok(deadline);

  const qs = await get("SELECT json_group_object(number, id) AS map FROM ielts_questions WHERE test_id = ?", [sample.id]);
  const byNumber = JSON.parse(qs.map);
  const token = await csrfToken(agent, '/ielts');
  const answers = { [byNumber[1]]: 'FALSE', [byNumber[2]]: 'true', [byNumber[5]]: 'C', [byNumber[8]]: 'ii', [byNumber[12]]: 'Heat Island', [byNumber[13]]: 'pipes' };
  const saved = await agent.put(`/api/ielts/attempts/${attemptId}`).set('x-csrf-token', token).send({ answers, flags: [byNumber[3]] });
  assert.equal(saved.status, 200);

  const check = await agent.post(`/api/ielts/attempts/${attemptId}/check/${byNumber[1]}`).set('x-csrf-token', token).send({ answer: 'FALSE' });
  assert.equal(check.status, 403);

  // Tải lại: vẫn cùng lượt, cùng hạn nộp, câu trả lời còn nguyên
  const again = await postForm(agent, `/ielts/tests/${sample.id}/start`, { mode: 'exam' }, { from: '/ielts' });
  assert.match(again.headers.location, new RegExp(`/attempts/${attemptId}$`));
  const reload = await agent.get(`/ielts/attempts/${attemptId}`);
  assert.match(reload.text, /value="Heat Island"/);
  assert.equal((await get('SELECT deadline_at FROM ielts_attempts WHERE id = ?', [attemptId])).deadline_at, deadline);

  const submit = await postForm(agent, `/ielts/attempts/${attemptId}/submit`, {}, { from: '/ielts' });
  assert.equal(submit.status, 302);
  const row = await get('SELECT score, total, status FROM ielts_attempts WHERE id = ?', [attemptId]);
  assert.deepEqual([row.status, row.score, row.total], ['submitted', 5, 14]);

  const result = await agent.get(`/ielts/attempts/${attemptId}/result`);
  assert.match(result.text, /5<span class="text-xl text-muted">\/14/);
  assert.match(result.text, /drainage systems/);

  const late = await agent.put(`/api/ielts/attempts/${attemptId}`).set('x-csrf-token', token).send({ answers: {}, flags: [] });
  assert.equal(late.status, 409);
});

test('lưu câu sai vào Notebook kèm lý do và mở lại đúng câu', async () => {
  const attempt = await get("SELECT id FROM ielts_attempts WHERE status = 'submitted' ORDER BY id DESC LIMIT 1");
  const q13 = await get('SELECT id FROM ielts_questions WHERE test_id = ? AND number = 13', [sample.id]);
  const res = await postForm(agent, `/ielts/attempts/${attempt.id}/mistakes/${q13.id}`, { reason: 'bỏ qua cách paraphrase' }, { from: '/ielts' });
  assert.equal(res.status, 302);
  await postForm(agent, `/ielts/attempts/${attempt.id}/mistakes/${q13.id}`, { reason: 'lần 2' }, { from: '/ielts' });
  const items = await get("SELECT COUNT(*) AS n, MAX(source_url) AS url, MAX(note) AS note FROM notebook_items WHERE kind = 'ielts_mistake'");
  assert.equal(items.n, 1);
  assert.equal(items.note, 'bỏ qua cách paraphrase');
  assert.equal(items.url, `/ielts/attempts/${attempt.id}/result#q-${q13.id}`);
  const result = await agent.get(`/ielts/attempts/${attempt.id}/result`);
  assert.match(result.text, /Đã lưu vào Notebook/);
});

test('hết giờ: mở lại sẽ tự nộp với câu trả lời đã lưu', async () => {
  const start = await postForm(agent, `/ielts/tests/${sample.id}/start`, { mode: 'exam' }, { from: '/ielts' });
  const attemptId = Number(start.headers.location.match(/attempts\/(\d+)/)[1]);
  await run('UPDATE ielts_attempts SET deadline_at = ? WHERE id = ?', [new Date(Date.now() - 1000).toISOString(), attemptId]);
  const res = await agent.get(`/ielts/attempts/${attemptId}`);
  assert.equal(res.status, 302);
  assert.match(res.headers.location, /result$/);
  assert.equal((await get('SELECT status FROM ielts_attempts WHERE id = ?', [attemptId])).status, 'submitted');
});

test('chế độ Luyện cho kiểm tra từng câu kèm giải thích', async () => {
  const start = await postForm(agent, `/ielts/tests/${sample.id}/start`, { mode: 'practice' }, { from: '/ielts' });
  const attemptId = Number(start.headers.location.match(/attempts\/(\d+)/)[1]);
  const q = await get('SELECT id FROM ielts_questions WHERE test_id = ? AND number = 6', [sample.id]);
  const token = await csrfToken(agent, '/ielts');
  const res = await agent.post(`/api/ielts/attempts/${attemptId}/check/${q.id}`).set('x-csrf-token', token).send({ answer: 'B' });
  assert.equal(res.status, 200);
  assert.equal(res.body.isCorrect, true);
  assert.match(res.body.explanation, /cheaper/);
});

test('nhập đề JSON lỗi báo rõ, hợp lệ thì thành bản nháp', async () => {
  const bad = await postForm(agent, '/ielts/tests/import', { json: '{oops' }, { from: '/ielts/tests/import' });
  assert.equal(bad.status, 422);
  assert.match(bad.text, /JSON không hợp lệ/);
  const json = JSON.stringify({ title: 'Imported', passages: [{ title: 'P', body: 'Some passage text that is long enough.' }], groups: [{ passage: 1, type: 'tfng', instructions: 'TFNG', questions: [{ number: 1, prompt: 'S', answer: 'TRUE' }] }] });
  const ok = await postForm(agent, '/ielts/tests/import', { json }, { from: '/ielts/tests/import' });
  assert.equal(ok.status, 302);
  assert.equal((await get("SELECT status FROM ielts_tests WHERE title = 'Imported'")).status, 'draft');
});
