// Word of the Day lấy nghĩa từ Merriam-Webster: dùng một máy chủ giả thay cho API thật.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

const SAMPLE = [
  {
    meta: { id: 'mitigate', stems: ['mitigate', 'mitigated', 'mitigates', 'mitigating'] },
    hwi: { hw: 'mit*i*gate', prs: [{ mw: 'ˈmi-tə-ˌgāt' }] },
    fl: 'verb',
    def: [{ sseq: [[['sense', { dt: [['text', '{bc}to make less severe'], ['vis', [{ t: 'trees {it}mitigate{/it} the heat' }]]] }]]] }],
    shortdef: ['to cause to become less harsh or hostile', 'to make less severe or painful'],
  },
  { meta: { id: 'unrelated', stems: ['unrelated'] }, fl: 'adjective', shortdef: ['not connected'] },
];

const hits = [];
const fake = createServer((req, res) => {
  hits.push(req.url);
  const word = decodeURIComponent(req.url.split('?')[0].split('/').pop());
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(word === 'mitigate' ? SAMPLE : ['suggestion one', 'suggestion two']));
});
await new Promise((r) => fake.listen(0, '127.0.0.1', r));
process.env.MW_API_KEY = 'test-key';
process.env.MW_API_URL = `http://127.0.0.1:${fake.address().port}/json`;
after(() => fake.close());

const { setup, postForm } = await import('./helpers.js');
const { parseEntries, cleanMarkup } = await import('../src/modules/today/merriam-webster.js');
const { get, run } = await import('../src/db/client.js');
const { todayISO } = await import('../src/lib/dates.js');
const { agent } = await setup();

test('parser keeps matching entries, cleans MW markup and pulls examples', () => {
  assert.equal(cleanMarkup('{bc}a {it}very{/it} {sx|small||} {ldquo}thing{rdquo}'), 'a very small “thing”');
  const parsed = parseEntries(SAMPLE, 'mitigated');
  assert.equal(parsed.entries.length, 1, 'the unrelated entry is dropped');
  assert.equal(parsed.word, 'mitigate');
  assert.equal(parsed.entries[0].headword, 'mit·i·gate');
  assert.equal(parsed.entries[0].pronunciation, 'ˈmi-tə-ˌgāt');
  assert.deepEqual(parsed.entries[0].examples, ['trees mitigate the heat']);
  assert.equal(parseEntries(['suggestion'], 'xyz'), null, 'suggestion list = not found');
});

test('Today shows Merriam-Webster definitions, looks the word up once, and saves the meaning', async () => {
  await run("INSERT INTO daily_words (date, word, data_json) VALUES (?, 'mitigate', ?)", [todayISO(), 
    JSON.stringify({ word: 'mitigate', hasDefinition: false, fromSources: false, sentence: null, source: null, collocations: [] }),
  ]);
  const page = await agent.get('/');
  assert.equal(page.status, 200);
  assert.match(page.text, /Merriam-Webster/);
  assert.match(page.text, /to make less severe or painful/);
  assert.match(page.text, /mit·i·gate/);
  assert.match(page.text, /trees mitigate the heat/);
  assert.ok(hits[0].includes('key=test-key'));

  await agent.get('/');
  assert.equal(hits.length, 1, 'cached with the day, not looked up again');

  await postForm(agent, '/today/word/save', {}, { from: '/' });
  const item = await get("SELECT meaning, example FROM notebook_items WHERE source_type = 'word_of_day'");
  assert.match(item.meaning, /less harsh or hostile/);
  assert.equal(item.example, 'trees mitigate the heat');
});

test('a word Merriam-Webster does not have shows a clear message and a link', async () => {
  await run('DELETE FROM daily_words');
  await run("INSERT INTO daily_words (date, word, data_json) VALUES (?, 'zzqx', ?)", [todayISO(), 
    JSON.stringify({ word: 'zzqx', hasDefinition: false, fromSources: false, sentence: null, source: null, collocations: [] }),
  ]);
  const page = await agent.get('/');
  assert.match(page.text, /Merriam-Webster has no entry/);
  assert.match(page.text, /merriam-webster\.com\/dictionary\/zzqx/);
});
