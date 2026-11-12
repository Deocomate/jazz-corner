// Word of the Day: lấy chủ yếu từ sách đang đọc và bài đọc IELTS của người dùng.
// Lựa chọn được lưu theo ngày (daily_words) để ổn định khi tải lại.
import { todayISO, addDays } from '#lib/dates.js';
import * as books from '#modules/books/books.service.js';
import { textSamples } from '#modules/books/books.text.js';
import * as notebook from '#modules/notebook/notebook.service.js';
import { listTests, getStructure } from '#modules/ielts/ielts.service.js';
import * as repo from './today.repo.js';
import { findCandidates, pickCandidate } from './word-picker.js';
import { wordForDate, ADVANCED } from './words.js';
import * as merriamWebster from './merriam-webster.js';
import * as vietnamese from './vietnamese.js';

const wotdKey = (word) => `wotd:${word.toLowerCase()}`;

const advancedWords = new Set(ADVANCED.map((w) => w.word.toLowerCase()));
/** Từ đã lưu không còn đạt chuẩn C2: mục từ điển cơ bản, hoặc từ lấy trong sách mà không có trong từ điển dự án. */
const isTooEasy = (data) => (data.hasDefinition || data.fromSources) && !advancedWords.has(String(data.word).toLowerCase());

/** Gom đoạn văn: tối đa 3 sách đọc gần nhất (quanh vị trí đang đọc) + bài đọc của đề đã duyệt. */
async function collectChunks() {
  const all = await books.listBooks();
  const opened = all.filter((b) => b.last_opened_at);
  const chosen = (opened.length ? opened : all).slice(0, 3);
  const chunks = [];
  for (const book of chosen) {
    for (const s of await textSamples(book)) {
      chunks.push({
        text: s.text,
        source: { type: 'book', label: `${book.title} · ${s.label}`, url: `/books/${book.id}?loc=${encodeURIComponent(JSON.stringify(s.location))}`, bookId: book.id, location: s.location },
      });
    }
  }
  const tests = (await listTests()).filter((t) => !t.isDraft).slice(0, 6);
  for (const test of tests) {
    const { passages } = await getStructure(test.id);
    for (const p of passages) {
      chunks.push({ text: p.body, source: { type: 'ielts', label: `${test.title} · ${p.title}`, url: `/ielts/tests/${test.id}/review` } });
    }
  }
  return chunks;
}

/** Các từ không được chọn: đã dùng trong 30 ngày qua + từ người dùng đã bỏ qua. */
async function excludedWords(date) {
  const [recent, skipped] = await Promise.all([repo.recentDailyWords(addDays(date, -30)), repo.skippedWords()]);
  return new Set([...recent, ...skipped].map((r) => r.word.toLowerCase()));
}

async function choose(date, exclude) {
  const picked = pickCandidate(findCandidates(await collectChunks()), date, exclude);
  if (picked) {
    const e = picked.entry;
    const url = picked.source.type === 'book' ? `${picked.source.url}&find=${encodeURIComponent(picked.sentence.slice(0, 300))}` : picked.source.url;
    return {
      word: e ? e.word : picked.form,
      pos: e?.pos ?? null,
      meaning: e?.meaning ?? null,
      nuance: e?.nuance ?? null,
      collocations: e?.collocations ?? [],
      example: e?.example ?? null,
      hasDefinition: Boolean(e),
      fromSources: true,
      sentence: picked.sentence,
      source: { ...picked.source, url },
    };
  }
  const fallback = wordForDate(date, exclude);
  if (!fallback) return null;
  return { ...fallback, hasDefinition: true, fromSources: false, sentence: null, source: null };
}

export async function wordOfTheDay(date = todayISO()) {
  let row = await repo.findDailyWord(date);
  if (!row) {
    // Hiếm: đã bỏ qua hết mọi từ → cho phép lặp lại thay vì để trống trang.
    const data = (await choose(date, await excludedWords(date))) || (await choose(date, new Set()));
    await repo.saveDailyWord(date, data.word, data);
    row = await repo.findDailyWord(date);
  } else if (isTooEasy(JSON.parse(row.data_json))) {
    // Từ đã lưu theo quy tắc cũ (vd. "much as", hoặc từ dài bất kỳ trong sách) → chọn lại từ C2.
    const data = await choose(date, await excludedWords(date));
    if (data) {
      await repo.replaceDailyWord(date, data.word, data);
      row = await repo.findDailyWord(date);
    }
  }
  const data = JSON.parse(row.data_json);
  // Tra Merriam-Webster một lần rồi lưu lại; lỗi mạng/chưa có khoá → không lưu, lần sau thử lại.
  // Bản lưu cũ chưa có trường `audio` (file phát âm) → tra lại một lần.
  const missingAudio = data.mw?.found && !('audio' in (data.mw.entries[0] ?? {}));
  if (!data.mw || missingAudio) {
    const mw = await merriamWebster.lookup(data.word);
    if (mw) {
      data.mw = mw;
      await repo.updateDailyWordData(date, data);
    }
  }
  // Nghĩa tiếng Việt: cũng tra một lần rồi lưu (key `vi`); null = lỗi mạng/tắt → lần sau thử lại.
  if (!data.vi) {
    const vi = await vietnamese.lookup(data.word, { also: data.mw?.found ? [data.mw.word] : [] });
    if (vi) {
      data.vi = vi;
      await repo.updateDailyWordData(date, data);
    }
  }
  return {
    ...data,
    mwFound: Boolean(data.mw?.found),
    viFound: Boolean(data.vi?.found),
    viShort: shortVietnamese(data.vi),
    mwUrl: merriamWebster.mwPageUrl(data.word),
    saved: await notebook.findByDedupeKey(wotdKey(data.word)),
  };
}

/**
 * Nút "Another word": bỏ qua từ hiện tại (không chọn lại nữa) và chọn từ khác cho hôm nay.
 * Trả về false nếu không còn từ nào để đổi.
 */
export async function shuffleWordOfTheDay(date = todayISO()) {
  const row = await repo.findDailyWord(date);
  if (row) await repo.skipWord(row.word);
  const data = await choose(date, await excludedWords(date));
  if (!data) return false;
  if (row) await repo.replaceDailyWord(date, data.word, data);
  else await repo.saveDailyWord(date, data.word, data);
  return true;
}

/** Bản rút gọn để hiện trên Today: tối đa 2 từ loại × 2 nghĩa, mỗi từ loại một dòng, bỏ ví dụ. */
function shortVietnamese(vi) {
  if (!vi?.found || vi.source !== 'wiktionary') return null;
  return vi.entries.slice(0, 2).map((e) => ({
    pos: e.pos,
    text: e.senses
      .slice(0, 2)
      .map((s) => s.text.replace(/[.;]+$/, ''))
      .join('; '),
  }));
}

/** Nghĩa dùng khi lưu vào Notebook: từ điển dự án (không có thì MW), kèm một dòng nghĩa tiếng Việt. */
function meaningFor(w) {
  const first = w.mw?.found ? w.mw.entries[0] : null;
  const en = w.meaning || (first ? first.definitions.slice(0, 2).join('; ') : '');
  const vi = vietnamese.shortMeaning(w.vi);
  return [en, vi && `VI: ${vi}`].filter(Boolean).join(' · ') || undefined;
}

export async function saveWordOfTheDay() {
  const w = await wordOfTheDay();
  return notebook.createItem(
    {
      kind: ['idiom', 'phrase'].includes(w.pos) ? 'idiom' : 'word',
      content: w.word,
      meaning: meaningFor(w),
      note: w.hasDefinition ? `${w.nuance}\nCollocations: ${w.collocations.join('; ')}` : w.mwFound ? 'Definition: Merriam-Webster' : undefined,
      example: w.example || (w.mwFound ? w.mw.entries[0].examples[0] : undefined) || undefined,
      excerpt: w.sentence || undefined,
      source_type: 'word_of_day',
      source_label: w.source ? `Word of the Day · ${w.source.label}` : `Word of the Day · ${todayISO()}`,
      source_url: w.source?.url,
      book_id: w.source?.bookId,
      location: w.source?.location,
    },
    { origin: w.fromSources ? 'mine' : 'sample', dedupeKey: wotdKey(w.word) },
  );
}
