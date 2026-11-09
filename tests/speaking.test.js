import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, postForm, csrfToken } from './helpers.js';
import { ensureSampleItems } from '../src/modules/speaking/speaking.service.js';
import { analyzeRhythm } from '../src/lib/rhythm.js';
import { lookupPronunciation } from '../src/modules/speaking/pronunciation-data.js';
import { guessKind } from '../src/modules/speaking/speaking.schema.js';
import { get } from '../src/db/client.js';

const { agent } = await setup();
await ensureSampleItems();

const posOf = (word, context) => {
  const r = lookupPronunciation(word, context);
  return r.entries[r.suggested].pos;
};

test('phân tích nhịp: nhấn từ nội dung, đọc nhẹ từ chức năng, nối âm, chỉnh tay', () => {
  const [s] = analyzeRhythm('I wanted the blue one, not an apple.');
  const words = s.phrases.flatMap((p) => p.words);
  const by = (t) => words.find((w) => w.text.replace(/[^a-z]/gi, '') === t);
  assert.equal(by('blue').stressed, true);
  assert.equal(by('the').weak, true);
  assert.equal(by('not').stressed, true);
  assert.equal(s.phrases.length, 2);
  assert.equal(by('an').linkNext, true);
  const [edited] = analyzeRhythm('I wanted the blue one.', { stressOverrides: { 0: true, 3: false } });
  assert.equal(edited.phrases[0].words[0].stressed, true);
  assert.equal(edited.phrases[0].words[3].stressed, false);
});

test('phát âm: chỉ hiện dữ liệu đáng tin cậy; dùng câu gốc đoán từ loại của "record"', () => {
  assert.equal(lookupPronunciation('serendipity'), null);
  assert.equal(posOf('record', 'I want to record a song'), 'verb');
  assert.equal(posOf('record', 'She broke the record again'), 'noun');
  assert.equal(guessKind('record'), 'word');
  assert.equal(guessKind('I wanted the blue one.'), 'sentence');
  assert.equal(guessKind('One. Two sentences here.'), 'passage');
});

test('bài mẫu: có từ, câu, đoạn kèm audio tổng hợp và mốc thời gian; không tạo trùng', async () => {
  await ensureSampleItems();
  const rows = await get(
    "SELECT COUNT(*) AS n, SUM(audio_url IS NOT NULL) AS audio, SUM(audio_kind = 'synthetic') AS synth FROM speaking_items WHERE origin = 'sample'",
  );
  assert.deepEqual([rows.n, rows.audio, rows.synth], [3, 3, 3]);
  const passage = await get("SELECT id FROM speaking_items WHERE sample_key = 'passage-slow-reading'");
  const page = await agent.get(`/speaking/items/${passage.id}?mode=shadowing`);
  assert.equal(page.status, 200);
  assert.match(page.text, /Shadow it/);
  assert.match(page.text, /&quot;segments&quot;:\[\{&quot;text&quot;:&quot;Slow reading/);
  const word = await get("SELECT id FROM speaking_items WHERE sample_key = 'word-phenomenon'");
  const pron = await agent.get(`/speaking/items/${word.id}`);
  assert.match(pron.text, /fəˈnɒmɪnən/);
});

test('tự nhập câu -> mở chế độ Rhythm; lưu chỉnh trọng âm', async () => {
  const res = await postForm(agent, '/speaking/items', { text: 'Much as I sympathise with this view, I disagree.' }, { from: '/speaking' });
  assert.equal(res.status, 302);
  const id = Number(res.headers.location.match(/items\/(\d+)/)[1]);
  const item = await get('SELECT kind, source_type FROM speaking_items WHERE id = ?', [id]);
  assert.deepEqual([item.kind, item.source_type], ['sentence', 'manual']);
  const page = await agent.get(`/speaking/items/${id}`);
  assert.match(page.text, /Automatic suggestion/);
  const token = await csrfToken(agent, '/speaking');
  const save = await agent.put(`/api/speaking/items/${id}/markup`).set('x-csrf-token', token).send({ stress: { 0: true } });
  assert.equal(save.status, 200);
  assert.match((await agent.get(`/speaking/items/${id}`)).text, /Edited by you/);
  const empty = await postForm(agent, '/speaking/items', { text: '' }, { from: '/speaking' });
  assert.equal(empty.status, 422);
});

test('chuyển đoạn từ Books sang Speaking giữ bản gốc và liên kết nguồn', async () => {
  const res = await postForm(
    agent,
    '/speaking/items',
    {
      text: 'Slow reading can seem almost subversive.',
      original_text: 'In an age that rewards speed, slow reading can seem almost subversive.',
      source_type: 'book',
      source_label: 'The Art of Slow Reading · Trang 1/3',
      source_url: '/books/1?loc=%7B%22page%22%3A1%7D',
    },
    { from: '/speaking/new' },
  );
  const id = Number(res.headers.location.match(/items\/(\d+)/)[1]);
  const page = await agent.get(`/speaking/items/${id}`);
  assert.match(page.text, /Open the original: The Art of Slow Reading/);
  assert.match(page.text, /In an age that rewards speed/);
  const bad = await postForm(agent, '/speaking/items', { text: 'x', source_type: 'book', source_url: 'https://evil.example' }, { from: '/speaking/new' });
  assert.equal(bad.status, 422);
});

test('từ Notebook mở thẳng sang Speaking (không tạo trùng)', async () => {
  const token = await csrfToken(agent, '/notebook');
  const nb = await agent.post('/api/notebook').set('x-csrf-token', token).send({ kind: 'word', content: 'mitigate', source_type: 'manual' });
  assert.equal(nb.status, 201);
  const a = await postForm(agent, `/speaking/from-notebook/${nb.body.id}`, {}, { from: '/speaking' });
  const b = await postForm(agent, `/speaking/from-notebook/${nb.body.id}`, {}, { from: '/speaking' });
  assert.equal(a.headers.location, b.headers.location);
  const page = await agent.get(a.headers.location);
  assert.match(page.text, /ˈmɪtɪɡeɪt/);
  assert.match(page.text, /Source: Notebook/);
});

test('lưu bản ghi, nghe lại sau khi tải lại, ghi chú + cần ôn, chặn tệp sai', async () => {
  const item = await get("SELECT id FROM speaking_items WHERE sample_key = 'sentence-blue-one'");
  const token = await csrfToken(agent, '/speaking');
  const up = await agent
    .post(`/api/speaking/items/${item.id}/recordings`)
    .set('x-csrf-token', token)
    .set('Content-Type', 'audio/webm;codecs=opus')
    .set('x-mode', 'shadowing')
    .set('x-duration', '3200')
    .set('x-target', encodeURIComponent('not the green one.'))
    .send(Buffer.from('fake webm bytes for test'));
  assert.equal(up.status, 201);
  const file = await agent.get(up.body.url);
  assert.equal(file.status, 200);
  assert.match(file.headers['content-type'], /audio\/webm/);
  const page = await agent.get(`/speaking/items/${item.id}?mode=shadowing`);
  assert.match(page.text, new RegExp(`rec-${up.body.id}`));
  const note = await postForm(agent, `/speaking/recordings/${up.body.id}`, { note: 'paused mid-phrase', needs_review: 'on' }, { from: '/speaking' });
  assert.equal(note.status, 302);
  const row = await get('SELECT note, needs_review, target_text FROM speaking_recordings WHERE id = ?', [up.body.id]);
  assert.deepEqual([row.note, row.needs_review, row.target_text], ['paused mid-phrase', 1, 'not the green one.']);
  const bad = await agent
    .post(`/api/speaking/items/${item.id}/recordings`)
    .set('x-csrf-token', token)
    .set('Content-Type', 'text/plain')
    .set('x-mode', 'rhythm')
    .send('hi');
  assert.equal(bad.status, 422);
});

test('trang Speaking và minimal pairs mở được', async () => {
  assert.equal((await agent.get('/speaking')).status, 200);
  const mp = await agent.get('/speaking/minimal-pairs');
  assert.equal(mp.status, 200);
  assert.match(mp.text, /sheep/);
});
