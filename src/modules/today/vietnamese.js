// Nghĩa tiếng Việt cho từ/cụm tiếng Anh.
//   1. Wiktionary tiếng Việt (vi.wiktionary.org): mục từ tiếng Anh, phần lớn từ Từ điển Anh–Việt FVDP,
//      có từ loại, các nghĩa và ví dụ song ngữ. Thử cả dạng gốc (noticed → notice) và headword của MW.
//   2. Không có mục từ → dịch máy (ghi rõ là dịch máy), xem translate.js.
// Wiktionary và MyMemory không cần khoá API. Kết quả thành công được nhớ trong bộ nhớ tiến trình.
import { config } from '#config';
import { translate } from './translate.js';

const TIMEOUT_MS = 5000;
const HEADERS = { 'user-agent': 'JazzCorner/0.1 (personal study app)' };
const MAX_POS = 3;
const MAX_SENSES = 4;
const CACHE_LIMIT = 300;
export { translate, MAX_TRANSLATE_CHARS } from './translate.js';

export const isEnabled = () => config.vietnamese.enabled;
export const wiktionaryPageUrl = (title) => `https://vi.wiktionary.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

// Mã mục từ loại trên vi.wiktionary → nhãn tiếng Anh hiển thị.
const POS = {
  noun: 'noun',
  'proper-noun': 'proper noun',
  verb: 'verb',
  'tr-verb': 'transitive verb',
  'intr-verb': 'intransitive verb',
  adj: 'adjective',
  adv: 'adverb',
  pronoun: 'pronoun',
  prep: 'preposition',
  conj: 'conjunction',
  intj: 'interjection',
  art: 'article',
  num: 'numeral',
  phrase: 'phrase',
  idiom: 'idiom',
  prefix: 'prefix',
  suffix: 'suffix',
  abbr: 'abbreviation',
};
// Kiểu trang mới: ==={{ĐM|v}}=== (chú ý: ĐM|pron là phát âm, không phải đại từ).
const DM_POS = { n: 'noun', noun: 'noun', 'proper-noun': 'proper noun', v: 'verb', verb: 'verb', 'tr-verb': 'transitive verb', 'intr-verb': 'intransitive verb', adj: 'adjective', adv: 'adverb', pronoun: 'pronoun', prep: 'preposition', conj: 'conjunction', intj: 'interjection', art: 'article', num: 'numeral', phrase: 'phrase', idiom: 'idiom', prefix: 'prefix', suffix: 'suffix', abbr: 'abbreviation', det: 'determiner' };
const VI_POS = { 'danh từ': 'noun', 'động từ': 'verb', 'ngoại động từ': 'transitive verb', 'nội động từ': 'intransitive verb', 'tính từ': 'adjective', 'phó từ': 'adverb', 'trạng từ': 'adverb', 'đại từ': 'pronoun', 'giới từ': 'preposition', 'liên từ': 'conjunction', 'thán từ': 'interjection', 'thành ngữ': 'idiom', 'cụm từ': 'phrase', 'mạo từ': 'article', 'số từ': 'numeral', 'từ hạn định': 'determiner' };
// Mục không phải từ loại (phát âm, tham khảo, thành ngữ đi kèm…) — bỏ qua nội dung.
const OTHER_SECTIONS = new Set(['pron', 'ref', 'expr', 'forms', 'etym', 'syn', 'ant', 'rel', 'der', 'trans', 'usage', 'also', 'see', 'note', 'hyph', 'drv', 'anagram', 'quote', 'paro', 'hom']);

/** Bỏ cú pháp wiki: [[a|b]] → b, '''đậm''', {{term|X}} → (X), các template khác, chú thích, thẻ HTML. */
export function cleanWiki(text) {
  let s = String(text)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>|<ref[\s\S]*?<\/ref>/g, '')
    .replace(/\{\{term\|([^{}|]*)\}\}/g, '($1)');
  for (let i = 0; i < 3; i++) s = s.replace(/\{\{[^{}]*\}\}/g, '');
  return s
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim();
}

/**
 * Lấy phần tiếng Anh của một trang vi.wiktionary → [{ pos, senses: [{ text, example: { en, vi } | null }] }].
 * Ngôn ngữ mở đầu bằng {{-eng-}} (hoặc "== Tiếng Anh =="), từ loại bằng {{-adj-}}, {{-tr-verb-}}…
 */
export function parseWikitext(wikitext) {
  let inEnglish = false;
  let current = null;
  const entries = [];
  for (const raw of String(wikitext).split('\n')) {
    const line = raw.trim();
    const level2 = line.match(/^==\s*([^=].*?)\s*==$/);
    if (level2) {
      inEnglish = /Tiếng Anh|langname\|en\b|\{\{-en(g)?-\}\}/i.test(level2[1]);
      current = null;
      continue;
    }
    // Kiểu mới: ==={{ĐM|v}}=== hoặc === Động từ ===
    const level3 = line.match(/^={3,4}\s*(.+?)\s*={3,4}$/);
    if (level3) {
      const dm = level3[1].match(/^\{\{ĐM\|([a-z-]+)/);
      const pos = dm ? DM_POS[dm[1]] : VI_POS[level3[1].toLowerCase()];
      current = null;
      if (pos && inEnglish) entries.push((current = { pos, senses: [] }));
      continue;
    }
    const header = line.match(/^\{\{-([a-z-]+)-\}\}$/);
    if (header) {
      const code = header[1];
      current = null;
      if (code === 'eng' || code === 'en') inEnglish = true;
      else if (POS[code]) {
        if (inEnglish) entries.push((current = { pos: POS[code], senses: [] }));
      } else if (!OTHER_SECTIONS.has(code) && /^[a-z]{2,3}$/.test(code)) inEnglish = false; // ngôn ngữ khác
      continue;
    }
    if (!current) continue;
    if (/^#+[:*]/.test(line)) {
      // Ví dụ: ''to be '''deliberate''' in speech'' — ăn nói có suy nghĩ cân nhắc
      const last = current.senses.at(-1);
      const cleaned = cleanWiki(line.replace(/^#+[:*]+\s*/, ''));
      const [en, vi] = cleaned.split(/\s+[—–]\s+/);
      if (last && !last.example && en && vi) last.example = { en: en.trim(), vi: vi.trim() };
    } else if (/^#+\s*\S/.test(line)) {
      const text = cleanWiki(line.replace(/^#+\s*/, ''));
      if (text && current.senses.length < MAX_SENSES) current.senses.push({ text, example: null });
    }
  }
  return entries.filter((e) => e.senses.length).slice(0, MAX_POS);
}

/** Các dạng nên thử: nguyên văn, chữ thường, headword MW, rồi bỏ đuôi -s/-ed/-ing/-ly. */
export function candidates(term, extra = []) {
  const w = term.toLowerCase();
  const out = [term, w, ...extra.map((x) => x.toLowerCase())];
  if (!w.includes(' ')) {
    const add = (cond, ...forms) => cond && out.push(...forms);
    add(w.endsWith('ies') || w.endsWith('ied'), `${w.slice(0, -3)}y`);
    add(w.endsWith('es'), w.slice(0, -2));
    add(w.endsWith('s') && !w.endsWith('ss'), w.slice(0, -1));
    add(w.endsWith('ed'), w.slice(0, -1), w.slice(0, -2)); // spared → spare trước spar
    add(/(.)\1ed$/.test(w), w.slice(0, -3));
    add(w.endsWith('ing'), w.slice(0, -3), `${w.slice(0, -3)}e`);
    add(/(.)\1ing$/.test(w), w.slice(0, -4));
    add(w.endsWith('ly'), w.slice(0, -2));
  }
  return [...new Set(out.filter((x) => x.length >= 2))].slice(0, 12);
}

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Tải nội dung nhiều trang trong MỘT request → Map(tiêu đề được hỏi → { title, wikitext }). */
async function fetchPages(titles) {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    titles: titles.join('|'),
  });
  const json = await getJson(`${config.vietnamese.wiktionaryUrl}?${params}`);
  const q = json.query || {};
  const follow = (t) => {
    const n = (q.normalized || []).find((x) => x.from === t);
    const after = n ? n.to : t;
    const r = (q.redirects || []).find((x) => x.from === after);
    return r ? r.to : after;
  };
  const byTitle = new Map((q.pages || []).filter((p) => !p.missing && p.revisions).map((p) => [p.title, p.revisions[0]?.slots?.main?.content ?? p.revisions[0]?.content ?? '']));
  const out = new Map();
  for (const t of titles) {
    const title = follow(t);
    if (byTitle.has(title)) out.set(t, { title, wikitext: byTitle.get(title) });
  }
  return out;
}

const cache = new Map();
const remember = (key, value) => {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  return value;
};

/**
 * Tra nghĩa tiếng Việt của một từ/cụm ngắn.
 *   { found: true, source: 'wiktionary', word, entries, url }
 *   { found: true, source: 'machine', word, translation }
 *   { found: false }  — không nguồn nào có
 *   null              — tắt / lỗi mạng (để lần sau thử lại)
 * `also`: các dạng khác nên thử (vd. headword từ Merriam-Webster).
 */
export async function lookup(term, { also = [] } = {}) {
  if (!isEnabled() || !term) return null;
  const key = `${term.toLowerCase()}|${also.join('|').toLowerCase()}`;
  if (cache.has(key)) return cache.get(key);

  let wikiFailed = false;
  try {
    const list = candidates(term, also);
    const pages = await fetchPages(list);
    for (const c of list) {
      const page = pages.get(c);
      let entries = page ? parseWikitext(page.wikitext) : [];
      // "noticed", "taking" tra ra trang gốc → đưa nghĩa động từ lên trước.
      if (page && page.title.toLowerCase() !== term.toLowerCase() && /(ed|ing)$/i.test(term)) {
        entries = [...entries].sort((a, b) => /verb/.test(b.pos) - /verb/.test(a.pos));
      }
      if (entries.length) return remember(key, { found: true, source: 'wiktionary', word: page.title, entries, url: wiktionaryPageUrl(page.title) });
    }
  } catch {
    wikiFailed = true;
  }
  const translation = await translate(term);
  if (translation) return remember(key, { found: true, source: 'machine', word: term, translation });
  return wikiFailed ? null : { found: false };
}

/** Một dòng ngắn để điền vào Notebook: 2 nghĩa đầu của từ loại đầu tiên, hoặc bản dịch máy. */
export function shortMeaning(vi) {
  if (!vi?.found) return '';
  if (vi.source === 'machine') return vi.translation;
  return vi.entries[0].senses
    .slice(0, 2)
    .map((s) => s.text.replace(/[.;]+$/, ''))
    .join('; ');
}
