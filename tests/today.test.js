import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, postForm, csrfToken } from './helpers.js';
import { wordForDate, WORDS } from '../src/modules/today/words.js';
import { todayISO } from '../src/lib/dates.js';
import { ensureSamples } from '../src/samples.js';
import { buildSamplePdf } from '../scripts/sample-files.mjs';
import { get } from '../src/db/client.js';

const { agent } = await setup();
await ensureSamples();

test('Word of the Day ổn định trong ngày và đổi theo ngày', () => {
  assert.equal(wordForDate('2026-11-09').word, wordForDate('2026-11-09').word);
  assert.notEqual(wordForDate('2026-11-09').word, wordForDate('2026-11-10').word);
  assert.ok(WORDS.length >= 20);
});

test('Today khi chưa có dữ liệu: dẫn tới Books và kho đề', async () => {
  const res = await agent.get('/');
  assert.equal(res.status, 200);
  assert.match(res.text, new RegExp(wordForDate(todayISO()).word));
  assert.match(res.text, /Đến Books để tải sách lên/);
  assert.match(res.text, /Đến kho đề/);
});

test('lưu Word of the Day hiện "Đã lưu" và không tạo trùng', async () => {
  await postForm(agent, '/today/word/save', {}, { from: '/' });
  await postForm(agent, '/today/word/save', {}, { from: '/' });
  assert.equal((await get("SELECT COUNT(*) AS n FROM notebook_items WHERE source_type = 'word_of_day'")).n, 1);
  assert.match((await agent.get('/')).text, /✓ Đã lưu/);
});

test('Today hiện Đọc tiếp, Tiếp tục làm bài và Xem lại lỗi theo dữ liệu', async () => {
  const token = await csrfToken(agent, '/books');
  const up = await agent.post('/api/books').set('x-csrf-token', token).set('x-file-name', 'essay.pdf').set('Content-Type', 'application/octet-stream').send(buildSamplePdf());
  await agent.put(`/api/books/${up.body.id}/position`).set('x-csrf-token', token).send({ position: { page: 2 }, label: 'Trang 2/3', progress: 0.67 });

  const sample = await get("SELECT id FROM ielts_tests WHERE sample_key IS NOT NULL");
  const exam = await postForm(agent, `/ielts/tests/${sample.id}/start`, { mode: 'practice' }, { from: '/ielts' });
  const attemptId = Number(exam.headers.location.split('/').pop());
  const q1 = await get('SELECT id FROM ielts_questions WHERE test_id = ? AND number = 1', [sample.id]);
  await agent.put(`/api/ielts/attempts/${attemptId}`).set('x-csrf-token', token).send({ answers: { [q1.id]: 'TRUE' }, flags: [] });

  let page = await agent.get('/');
  assert.match(page.text, /Trang 2\/3/);
  assert.match(page.text, new RegExp(`/books/${up.body.id}"[^>]*>Đọc tiếp`));
  assert.match(page.text, /Tiếp tục làm bài/);
  assert.match(page.text, /đã trả lời 1\/14 câu/);
  assert.doesNotMatch(page.text, /Xem lại lỗi/);

  await postForm(agent, `/ielts/attempts/${attemptId}/submit`, {}, { from: '/' });
  await postForm(agent, `/ielts/attempts/${attemptId}/mistakes/${q1.id}`, { reason: 'đọc nhầm phạm vi nhận định' }, { from: '/' });
  page = await agent.get('/');
  assert.match(page.text, /Lỗi gần đây/);
  assert.match(page.text, /đọc nhầm phạm vi nhận định/);
  assert.match(page.text, /Xem lại lỗi/);
});

test('Progress và trang trạng thái mở được với dữ liệu thật', async () => {
  const res = await agent.get('/progress');
  assert.equal(res.status, 200);
  assert.match(res.text, /True \/ False \/ Not Given/);
  assert.match(res.text, /đọc nhầm phạm vi nhận định/);
  assert.equal((await agent.get('/status')).status, 200);
});
