// Nghĩa tiếng Việt: Wiktionary tiếng Việt + dịch máy (DeepL, dự phòng MyMemory) — dùng máy chủ giả thay cho mạng thật.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

const OLD_STYLE = `{{-eng-}}
{{-pron-}}
* {{IPA-old|/dɪ.ˈlɪ.bə.ˌreɪt/}}

{{-adj-}}
'''deliberate'''
# [[có|Có]] [[suy nghĩ]] [[cân nhắc]]; [[thận trọng]].
#: ''to be '''deliberate''' in speech'' —  ăn nói có suy nghĩ cân nhắc
# {{term|Thuộc}} [[cố ý]].

{{-verb-}}
# [[cân nhắc|Cân nhắc]] [[kỹ càng]].

{{-ref-}}
{{R:FVDP}}

{{-fra-}}
{{-adj-}}
# Từ tiếng Pháp — không lấy.`;

const NEW_STYLE = `=={{langname|en}}==
==={{ĐM|pron}}===
* {{IPA4|en|/ˌʌndəˈstænd/}}
==={{ĐM|v}}===
{{en-verb|understands|understanding|understood}}
# [[hiểu|Hiểu]], [[nắm]] được ý.`;

const PAGES = { deliberate: OLD_STYLE, understand: NEW_STYLE, spare: '{{-eng-}}\n{{-tr-verb-}}\n# Để dành.', spar: '{{-eng-}}\n{{-noun-}}\n# Cột buồm.' };

const wiki = createServer((req, res) => {
  const titles = new URL(req.url, 'http://x').searchParams.get('titles').split('|');
  const pages = titles.map((t) => (PAGES[t] ? { title: t, revisions: [{ slots: { main: { content: PAGES[t] } } }] } : { title: t, missing: true }));
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ query: { pages } }));
});
const translations = [];
const mt = createServer((req, res) => {
  const q = new URL(req.url, 'http://x').searchParams.get('q');
  translations.push(q);
  res.setHeader('Content-Type', 'application/json');
  const known = { 'look after': 'trông nom, chăm sóc', 'He handed me a notebook.': 'Ông ấy đưa tôi một cuốn sổ.' };
  res.end(JSON.stringify({ responseStatus: 200, responseData: { translatedText: known[q] ?? q } }));
});
// DeepL giả: chỉ biết một câu, câu khác trả 456 (hết hạn mức) → phải rơi về MyMemory.
const deeplCalls = [];
const deepl = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const { text, target_lang } = JSON.parse(body);
    deeplCalls.push({ auth: req.headers.authorization, text: text[0], target_lang });
    const known = { 'In an age that rewards speed, slow reading can seem almost subversive.': 'Trong thời đại đề cao tốc độ, đọc chậm gần như là một hành động nổi loạn.' };
    if (!known[text[0]]) return res.writeHead(456).end();
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ translations: [{ detected_source_language: 'EN', text: known[text[0]] }] }));
  });
});
await Promise.all([wiki, mt, deepl].map((s) => new Promise((r) => s.listen(0, '127.0.0.1', r))));
process.env.VI_DICTIONARY = 'on';
process.env.VI_WIKTIONARY_URL = `http://127.0.0.1:${wiki.address().port}/w/api.php`;
process.env.VI_TRANSLATE_URL = `http://127.0.0.1:${mt.address().port}/get`;
process.env.DEEPL_API_KEY = 'test-key:fx';
process.env.DEEPL_API_URL = `http://127.0.0.1:${deepl.address().port}/v2/translate`;
after(() => {
  wiki.close();
  mt.close();
  deepl.close();
});

const { setup } = await import('./helpers.js');
const vi = await import('../src/modules/today/vietnamese.js');
const { agent } = await setup();

test('parser reads old-style FVDP entries: POS, cleaned senses, bilingual examples, English only', () => {
  const entries = vi.parseWikitext(OLD_STYLE);
  assert.deepEqual(
    entries.map((e) => e.pos),
    ['adjective', 'verb'],
  );
  assert.equal(entries[0].senses[0].text, 'Có suy nghĩ cân nhắc; thận trọng.');
  assert.deepEqual(entries[0].senses[0].example, { en: 'to be deliberate in speech', vi: 'ăn nói có suy nghĩ cân nhắc' });
  assert.equal(entries[0].senses[1].text, '(Thuộc) cố ý.');
});

test('parser reads new-style pages ({{langname|en}} + {{ĐM|v}}) and skips pronunciation', () => {
  const entries = vi.parseWikitext(NEW_STYLE);
  assert.deepEqual(entries, [{ pos: 'verb', senses: [{ text: 'Hiểu, nắm được ý.', example: null }] }]);
});

test('candidates try the -d form before -ed (spared → spare before spar)', () => {
  const c = vi.candidates('spared');
  assert.ok(c.indexOf('spare') < c.indexOf('spar'));
  assert.equal(vi.candidates('Noticed', ['notice'])[2], 'notice', 'extra forms come before the guesses');
});

test('lookup: dictionary entry first, machine translation only as a fallback', async () => {
  const d = await vi.lookup('Deliberate');
  assert.equal(d.source, 'wiktionary');
  assert.equal(d.word, 'deliberate');
  assert.match(d.url, /vi\.wiktionary\.org\/wiki\/deliberate/);
  assert.equal((await vi.lookup('spared')).word, 'spare');
  assert.deepEqual(await vi.lookup('look after'), { found: true, source: 'machine', word: 'look after', translation: 'trông nom, chăm sóc' });
  assert.deepEqual(await vi.lookup('zzqx'), { found: false }, 'an echoed translation counts as none');
  assert.equal(vi.shortMeaning(d), 'Có suy nghĩ cân nhắc; thận trọng; (Thuộc) cố ý');
});

test('GET /api/dictionary includes the Vietnamese meaning', async () => {
  const res = await agent.get('/api/dictionary?word=%E2%80%9Cdeliberate,%E2%80%9D').expect(200);
  assert.equal(res.body.word, 'deliberate');
  assert.equal(res.body.vi.source, 'wiktionary');
  assert.equal(res.body.vi.entries[0].pos, 'adjective');
});

test('GET /api/dictionary/translate translates a passage and validates length', async () => {
  const res = await agent.get('/api/dictionary/translate').query({ text: 'He handed me   a notebook.' }).expect(200);
  assert.equal(res.body.translation, 'Ông ấy đưa tôi một cuốn sổ.');
  await agent.get('/api/dictionary/translate').query({ text: 'x'.repeat(501) }).expect(422);
  await agent.get('/api/dictionary/translate').query({ text: 'untranslatable' }).expect(502);
});

test('translate: DeepL first (with auth key), MyMemory only when DeepL fails', async () => {
  const sentence = 'In an age that rewards speed, slow reading can seem almost subversive.';
  translations.length = 0;
  assert.equal(await vi.translate(sentence), 'Trong thời đại đề cao tốc độ, đọc chậm gần như là một hành động nổi loạn.');
  assert.deepEqual(deeplCalls.at(-1), { auth: 'DeepL-Auth-Key test-key:fx', text: sentence, target_lang: 'VI' });
  assert.equal(translations.length, 0, 'MyMemory is not called when DeepL answers');
  assert.equal(await vi.translate('He handed me a notebook.'), 'Ông ấy đưa tôi một cuốn sổ.', 'falls back to MyMemory on 456');
});
