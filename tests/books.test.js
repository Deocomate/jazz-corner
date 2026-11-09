import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, csrfToken } from './helpers.js';
import { buildSamplePdf, buildSampleEpub, STORY_CHAPTERS } from '../scripts/sample-files.mjs';

const { agent } = await setup();

async function upload(buffer, name) {
  const token = await csrfToken(agent, '/books');
  return agent
    .post('/api/books')
    .set('x-csrf-token', token)
    .set('x-file-name', encodeURIComponent(name))
    .set('Content-Type', 'application/octet-stream')
    .send(buffer);
}

const api = async (method, url, body) => {
  const token = await csrfToken(agent, '/books');
  return agent[method](url).set('x-csrf-token', token).send(body);
};

test('thư viện trống hiện hướng dẫn tải sách', async () => {
  const res = await agent.get('/books');
  assert.equal(res.status, 200);
  assert.match(res.text, /No books yet/);
});

test('tải PDF lên, mở trình đọc, lưu và khôi phục vị trí', async () => {
  const res = await upload(buildSamplePdf(), 'slow-reading.pdf');
  assert.equal(res.status, 201);
  const id = res.body.id;
  const reader = await agent.get(`/books/${id}`);
  assert.equal(reader.status, 200);
  assert.match(reader.text, /pdf-reader\.js/);

  const file = await agent.get(`/books/${id}/file`);
  assert.equal(file.status, 200);
  assert.match(file.headers['content-type'], /pdf/);

  const save = await api('put', `/api/books/${id}/position`, { position: { page: 2, zoom: 1.25 }, label: 'Trang 2/3', progress: 2 / 3, totalUnits: 3 });
  assert.equal(save.status, 200);
  const again = await agent.get(`/books/${id}`);
  assert.match(again.text, /&quot;page&quot;:2/);
  const list = await agent.get('/books');
  assert.match(list.text, /67%/);
});

test('tải EPUB lên: đọc tên sách, mục lục và nội dung chương', async () => {
  const res = await upload(buildSampleEpub(), 'story.epub');
  assert.equal(res.status, 201);
  const id = res.body.id;
  const structure = await agent.get(`/api/books/${id}/epub`);
  assert.equal(structure.body.spine.length, STORY_CHAPTERS.length);
  assert.equal(structure.body.toc[1].label, 'Chapter 2: The Notebook');
  const chapter = await agent.get(`/books/${id}/epub-file`).query({ path: structure.body.spine[0] });
  assert.equal(chapter.status, 200);
  assert.match(chapter.headers['content-type'], /text\/plain/);
  assert.match(chapter.text, /The boat left me on the rocks/);
  const list = await agent.get('/books');
  assert.match(list.text, /The Lighthouse Keeper/);
});

test('tệp sai định dạng hoặc EPUB hỏng báo lỗi rõ ràng', async () => {
  const txt = await upload(Buffer.from('hello world'), 'notes.txt');
  assert.equal(txt.status, 422);
  assert.match(txt.body.error, /PDF and EPUB/);
  const broken = await upload(Buffer.from('PK\u0003\u0004 not really a zip'), 'broken.epub');
  assert.equal(broken.status, 422);
  assert.match(broken.body.error, /Could not read the EPUB/);
});

test('bookmark và highlight kèm ghi chú', async () => {
  const { body } = await upload(buildSamplePdf(), 'marks.pdf');
  const id = body.id;
  const bm = await api('post', `/api/books/${id}/bookmarks`, { location: { page: 3 }, label: 'Trang 3/3' });
  assert.equal(bm.status, 201);
  const hl = await api('post', `/api/books/${id}/highlights`, { location: { page: 1 }, label: 'Trang 1/3', text: 'slow reading can seem almost subversive', note: 'nice adjective' });
  assert.equal(hl.status, 201);
  const marks = await agent.get(`/api/books/${id}/marks`);
  assert.equal(marks.body.bookmarks[0].location.page, 3);
  assert.equal(marks.body.highlights[0].note, 'nice adjective');
  const empty = await api('post', `/api/books/${id}/highlights`, { location: { page: 1 }, text: '' });
  assert.equal(empty.status, 422);
});

test('xoá sách và id lạ trả 404', async () => {
  const { body } = await upload(buildSamplePdf(), 'delete-me.pdf');
  const token = await csrfToken(agent, '/books');
  const del = await agent.post(`/books/${body.id}/delete`).type('form').send({ _csrf: token });
  assert.equal(del.status, 302);
  assert.equal((await agent.get(`/books/${body.id}`)).status, 404);
  assert.equal((await agent.get('/books/abc')).status, 404);
});
