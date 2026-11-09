import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, postForm, csrfToken } from './helpers.js';
import { nextSchedule } from '../src/modules/notebook/notebook.service.js';
import { todayISO, addDays } from '../src/lib/dates.js';
import { get } from '../src/db/client.js';

const { agent } = await setup();

test('lịch ôn: Đã nhớ giãn dần 1→3→7 ngày, Ôn lại gặp lại ngày mai', () => {
  const t = '2026-11-09';
  assert.deepEqual(nextSchedule(0, 'remembered', t), { intervalDays: 1, dueDate: '2026-11-10' });
  assert.deepEqual(nextSchedule(1, 'remembered', t), { intervalDays: 3, dueDate: '2026-11-12' });
  assert.equal(nextSchedule(3, 'remembered', t).intervalDays, 7);
  assert.deepEqual(nextSchedule(7, 'again', t), { intervalDays: 0, dueDate: '2026-11-10' });
});

test('Notebook trống có hướng dẫn', async () => {
  const res = await agent.get('/notebook');
  assert.equal(res.status, 200);
  assert.match(res.text, /Notebook đang trống/);
});

test('lưu đoạn từ sách (API) giữ trích đoạn, nguồn, vị trí; mở lại và ôn được', async () => {
  const token = await csrfToken(agent, '/notebook');
  const res = await agent.post('/api/notebook').set('x-csrf-token', token).send({
    kind: 'pattern',
    content: 'Much as I sympathise with this view',
    excerpt: 'Much as I sympathise with the view that time is scarce, I would argue…',
    meaning: 'nhượng bộ trước khi phản biện',
    tags: 'Academic Writing, Speaking, Academic Writing',
    source_type: 'book',
    source_label: 'The Art of Slow Reading · Trang 1/3',
    source_url: '/books/1?loc=%7B%22page%22%3A1%7D&find=Much%20as',
    location: { page: 1 },
  });
  assert.equal(res.status, 201);
  const row = await get('SELECT tags, due_date, location_json FROM notebook_items WHERE id = ?', [res.body.id]);
  assert.equal(row.tags, 'Academic Writing, Speaking');
  assert.equal(row.due_date, todayISO());
  assert.equal(row.location_json, '{"page":1}');

  const show = await agent.get(`/notebook/${res.body.id}`);
  assert.match(show.text, /Mở đoạn nguồn/);
  // Handlebars escape dấu "=" trong thuộc tính thành &#x3D; (trình duyệt vẫn hiểu đúng).
  assert.match(show.text, /books\/1\?loc(=|&#x3D;)/);

  const review = await agent.get('/notebook/review');
  assert.match(review.text, /Much as I sympathise/);
  const done = await postForm(agent, `/notebook/${res.body.id}/review`, { result: 'remembered' }, { from: '/notebook/review' });
  assert.equal(done.status, 302);
  const after = await get('SELECT due_date, interval_days, review_count FROM notebook_items WHERE id = ?', [res.body.id]);
  assert.deepEqual([after.due_date, after.interval_days, after.review_count], [addDays(todayISO(), 1), 1, 1]);
});

test('thêm thủ công, lọc theo loại/nhãn/tìm kiếm, sửa, xoá; thiếu nội dung báo lỗi', async () => {
  const bad = await postForm(agent, '/notebook', { kind: 'word', content: '' }, { from: '/notebook/new' });
  assert.equal(bad.status, 422);
  assert.match(bad.text, /Vui lòng nhập nội dung chính/);
  const ok = await postForm(agent, '/notebook', { kind: 'idiom', content: 'a double-edged sword', tags: 'Speaking' }, { from: '/notebook/new' });
  assert.equal(ok.status, 302);
  const id = Number(ok.headers.location.split('/').pop());
  assert.match((await agent.get('/notebook?kind=idiom')).text, /double-edged/);
  assert.match((await agent.get('/notebook?tag=Speaking')).text, /double-edged/);
  assert.doesNotMatch((await agent.get('/notebook?q=zzz')).text, /double-edged/);
  await postForm(agent, `/notebook/${id}`, { kind: 'idiom', content: 'a double-edged sword', meaning: 'con dao hai lưỡi' }, { from: `/notebook/${id}/edit` });
  assert.match((await agent.get(`/notebook/${id}`)).text, /con dao hai lưỡi/);
  await postForm(agent, `/notebook/${id}/delete`, {}, { from: '/notebook' });
  assert.equal((await agent.get(`/notebook/${id}`)).status, 404);
});

test('liên kết nguồn ra ngoài ứng dụng bị từ chối', async () => {
  const token = await csrfToken(agent, '/notebook');
  const res = await agent.post('/api/notebook').set('x-csrf-token', token).send({ kind: 'word', content: 'x', source_url: '//evil.example' });
  assert.equal(res.status, 422);
});
