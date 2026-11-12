import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, postForm, csrfToken } from './helpers.js';
import { wordForDate, WORDS, ADVANCED, lookupLexicon } from '../src/modules/today/words.js';
import { findCandidates, pickCandidate } from '../src/modules/today/word-picker.js';
import { ensureSamples } from '../src/samples.js';
import { buildSamplePdf } from '../scripts/sample-files.mjs';
import { get, run } from '../src/db/client.js';

const { agent } = await setup();

test('word picker: dictionary words found in the text come first, with their sentence', () => {
  const chunks = [
    { text: 'Paving over gardens has exacerbated flooding during storms. The Riverside committee celebrated extraordinarily.', source: { type: 'book', label: 'Book · Page 3', url: '/books/1' } },
  ];
  const candidates = findCandidates(chunks);
  const exacerbate = candidates.find((c) => c.key === 'exacerbate');
  assert.ok(exacerbate.entry);
  assert.match(exacerbate.sentence, /Paving over gardens has exacerbated/);
  assert.ok(!candidates.some((c) => c.key === 'extraordinarily'), 'long but ordinary words are not candidates');
  assert.equal(pickCandidate(candidates, '2026-11-09').key, 'exacerbate');
  assert.equal(pickCandidate(candidates, '2026-11-09', new Set(['exacerbate'])), null);
  assert.equal(lookupLexicon('Municipalities').word, 'municipality');
  assert.ok(WORDS.length >= 40);
  assert.notEqual(wordForDate('2026-11-09').word, wordForDate('2026-11-10').word);
});

test('word picker: only C2+ words — C1 entries like "deliberate" or "much as" are never picked', () => {
  const chunks = [{ text: 'It was a deliberate choice, much as she disliked it, to read slowly and carefully. The board remained obdurate despite the magnificent evidence.', source: { type: 'book', label: 'B', url: '/books/1' } }];
  const candidates = findCandidates(chunks);
  assert.deepEqual(candidates.map((c) => c.key), ['obdurate']);
  assert.equal(pickCandidate(findCandidates([{ text: 'We walked carefully and thoughtfully home together that extraordinary evening.', source: {} }]), '2026-11-12'), null);
  assert.ok(ADVANCED.length >= 120);
  for (const easy of ['deliberate', 'much as', 'mitigate', 'albeit', 'scrutiny']) assert.ok(!ADVANCED.some((w) => w.word === easy), easy);
  const all = new Set(ADVANCED.map((w) => w.word.toLowerCase()));
  assert.equal(wordForDate('2026-11-12', all), null, 'returns null when every curated word is excluded');
});

test('"Another word" skips today’s word for good and picks a different one', async () => {
  await run('DELETE FROM daily_words');
  const first = await agent.get('/');
  assert.match(first.text, /Another word/);
  const before = (await get('SELECT word FROM daily_words')).word;
  const res = await postForm(agent, '/today/word/shuffle', {}, { from: '/' });
  assert.equal(res.status, 302);
  const after = (await get('SELECT word FROM daily_words')).word;
  assert.notEqual(after, before);
  assert.equal((await get('SELECT COUNT(*) AS n FROM daily_words')).n, 1);
  assert.ok(await get('SELECT 1 FROM skipped_words WHERE word = ?', [before.toLowerCase()]));
  assert.ok((await agent.get('/')).text.includes(after));
  await run('DELETE FROM daily_words');
  await run('DELETE FROM skipped_words');
});

test('a word saved today under the old, easier rules is replaced by a C2 word', async () => {
  const { todayISO } = await import('../src/lib/dates.js');
  await run('INSERT INTO daily_words (date, word, data_json) VALUES (?, ?, ?)', [todayISO(), 'much as', JSON.stringify({ word: 'much as', hasDefinition: true, fromSources: false, collocations: [] })]);
  await agent.get('/');
  const now = (await get('SELECT word FROM daily_words')).word;
  assert.notEqual(now, 'much as');
  assert.ok(ADVANCED.some((w) => w.word === now));
  await run('DELETE FROM daily_words');
});

test('with no books or tests, the Word of the Day falls back to the curated list', async () => {
  const res = await agent.get('/');
  assert.equal(res.status, 200);
  assert.match(res.text, /Curated list/);
  assert.match(res.text, /Go to Books to upload/);
  assert.match(res.text, /Go to the test bank/);
  await run('DELETE FROM daily_words');
});

test('Word of the Day comes from your books/tests, stays stable, and saves once with its source', async () => {
  await ensureSamples();
  const token = await csrfToken(agent, '/books');
  const up = await agent.post('/api/books').set('x-csrf-token', token).set('x-file-name', 'essay.pdf').set('Content-Type', 'application/octet-stream').send(buildSamplePdf());
  await agent.put(`/api/books/${up.body.id}/position`).set('x-csrf-token', token).send({ position: { page: 1 }, label: 'Page 1/3', progress: 0.33 });

  const first = await agent.get('/');
  assert.match(first.text, /From your (reading|IELTS tests)/);
  assert.match(first.text, /Open the passage/);
  const row = await get('SELECT word, data_json FROM daily_words');
  const data = JSON.parse(row.data_json);
  assert.ok(data.sentence.toLowerCase().includes(data.word.split(' ')[0].toLowerCase().slice(0, 5)));
  assert.equal((await get('SELECT word FROM daily_words')).word, row.word, 'same word on reload');
  await agent.get('/');
  assert.equal((await get('SELECT COUNT(*) AS n FROM daily_words')).n, 1);

  await postForm(agent, '/today/word/save', {}, { from: '/' });
  await postForm(agent, '/today/word/save', {}, { from: '/' });
  const saved = await get("SELECT COUNT(*) AS n, MAX(excerpt) AS excerpt, MAX(source_url) AS url FROM notebook_items WHERE source_type = 'word_of_day'");
  assert.equal(saved.n, 1);
  assert.equal(saved.excerpt, data.sentence);
  assert.ok(saved.url.startsWith('/'));
  assert.match((await agent.get('/')).text, /✓ Saved/);
});

test('Today shows Continue reading, Continue the test and Review mistakes from real data', async () => {
  const book = await get('SELECT id FROM books ORDER BY id DESC LIMIT 1');
  const token = await csrfToken(agent, '/books');
  await agent.put(`/api/books/${book.id}/position`).set('x-csrf-token', token).send({ position: { page: 2 }, label: 'Page 2/3', progress: 0.67 });

  const sample = await get('SELECT id FROM ielts_tests WHERE sample_key IS NOT NULL');
  const exam = await postForm(agent, `/ielts/tests/${sample.id}/start`, { mode: 'practice' }, { from: '/ielts' });
  const attemptId = Number(exam.headers.location.split('/').pop());
  const q1 = await get('SELECT id FROM ielts_questions WHERE test_id = ? AND number = 1', [sample.id]);
  await agent.put(`/api/ielts/attempts/${attemptId}`).set('x-csrf-token', token).send({ answers: { [q1.id]: 'TRUE' }, flags: [] });

  let page = await agent.get('/');
  assert.match(page.text, /Page 2\/3/);
  assert.match(page.text, new RegExp(`/books/${book.id}"[^>]*>Continue reading`));
  assert.match(page.text, /Continue the test/);
  assert.match(page.text, /1\/14 answered/);
  assert.doesNotMatch(page.text, /Review mistakes/);

  await postForm(agent, `/ielts/attempts/${attemptId}/submit`, {}, { from: '/' });
  await postForm(agent, `/ielts/attempts/${attemptId}/mistakes/${q1.id}`, { reason: 'misread the scope of the statement' }, { from: '/' });
  page = await agent.get('/');
  assert.match(page.text, /Recent mistake/);
  assert.match(page.text, /misread the scope of the statement/);
  assert.match(page.text, /Review mistakes/);
});

test('Progress and Feature status open with real data', async () => {
  const res = await agent.get('/progress');
  assert.equal(res.status, 200);
  assert.match(res.text, /True \/ False \/ Not Given/);
  assert.match(res.text, /misread the scope of the statement/);
  assert.equal((await agent.get('/status')).status, 200);
});
