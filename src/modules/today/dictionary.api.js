// API tra nghĩa cho thanh thao tác khi bôi chọn văn bản trong sách.
//   GET /api/dictionary?word=between
//     -> { word, configured, found, entries[], url, mwError?, vi }   (MW + nghĩa tiếng Việt)
//   GET /api/dictionary/translate?text=...  -> { translation, source: 'machine' }  (câu/đoạn dài)
import { Router } from 'express';
import * as merriamWebster from './merriam-webster.js';
import * as vietnamese from './vietnamese.js';

const router = Router();
const MAX_WORDS = 4;

/** Bỏ dấu câu/ngoặc kép ở hai đầu, gộp khoảng trắng. */
export const normalizeTerm = (text) =>
  String(text || '')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .trim();

router.get('/', async (req, res) => {
  const word = normalizeTerm(req.query.word);
  if (!word || word.length > 60 || word.split(' ').length > MAX_WORDS) {
    return res.status(422).json({ error: 'Select a single word or a short phrase to see its meaning.' });
  }
  const url = merriamWebster.mwPageUrl(word);
  const configured = merriamWebster.isConfigured();
  // Tra song song; nếu tiếng Việt không có mà MW tìm ra dạng gốc khác (went → go) thì thử lại với dạng đó.
  const [mw, vi0] = await Promise.all([configured ? merriamWebster.lookup(word) : null, vietnamese.lookup(word)]);
  let vi = vi0;
  // Dạng gốc do MW xác định đáng tin hơn quy tắc bỏ đuôi (spared → spare, không phải spar).
  // Lấy mọi headword MW trả về (understood → understand) làm dạng gốc để thử.
  const lower = word.toLowerCase();
  const heads = mw?.found ? [...new Set(mw.entries.map((e) => e.headword.replace(/[·*]/g, '').toLowerCase()))].filter((h) => h !== lower) : [];
  const viWiki = vi?.found && vi.source === 'wiktionary' ? vi.word.toLowerCase() : null;
  if (heads.length && viWiki !== lower && !heads.includes(viWiki)) {
    const again = await vietnamese.lookup(word, { also: heads });
    if (again?.found) vi = again;
  }
  if (configured && !mw && !vi?.found) return res.status(502).json({ error: 'Could not reach the dictionaries right now.', url });
  res.json({ word, configured, found: false, url, ...(mw || {}), mwError: configured && !mw, vi: vi || null });
});

router.get('/translate', async (req, res) => {
  const text = String(req.query.text || '').replace(/\s+/g, ' ').trim();
  if (!text) return res.status(422).json({ error: 'Select some text to translate.' });
  if (text.length > vietnamese.MAX_TRANSLATE_CHARS) {
    return res.status(422).json({ error: `Select a shorter passage (up to ${vietnamese.MAX_TRANSLATE_CHARS} characters) to translate.` });
  }
  if (!vietnamese.isEnabled()) return res.status(503).json({ error: 'Vietnamese translation is turned off.' });
  const translation = await vietnamese.translate(text);
  if (!translation) return res.status(502).json({ error: 'Could not get a Vietnamese translation right now. Try again in a moment.' });
  res.json({ translation, source: 'machine' });
});

export default router;
