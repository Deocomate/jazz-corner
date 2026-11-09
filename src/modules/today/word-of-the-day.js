// Word of the Day: lấy chủ yếu từ sách đang đọc và bài đọc IELTS của người dùng.
// Lựa chọn được lưu theo ngày (daily_words) để ổn định khi tải lại.
import { todayISO, addDays } from '#lib/dates.js';
import * as books from '#modules/books/books.service.js';
import { textSamples } from '#modules/books/books.text.js';
import * as notebook from '#modules/notebook/notebook.service.js';
import { listTests, getStructure } from '#modules/ielts/ielts.service.js';
import * as repo from './today.repo.js';
import { findCandidates, pickCandidate } from './word-picker.js';
import { wordForDate } from './words.js';
import * as merriamWebster from './merriam-webster.js';

const wotdKey = (word) => `wotd:${word.toLowerCase()}`;

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

async function choose(date) {
  const recent = new Set((await repo.recentDailyWords(addDays(date, -30))).map((r) => r.word.toLowerCase()));
  const picked = pickCandidate(findCandidates(await collectChunks()), date, recent);
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
  const fallback = wordForDate(date);
  return { ...fallback, hasDefinition: true, fromSources: false, sentence: null, source: null };
}

export async function wordOfTheDay(date = todayISO()) {
  let row = await repo.findDailyWord(date);
  if (!row) {
    const data = await choose(date);
    await repo.saveDailyWord(date, data.word, data);
    row = await repo.findDailyWord(date);
  }
  const data = JSON.parse(row.data_json);
  // Tra Merriam-Webster một lần rồi lưu lại; lỗi mạng/chưa có khoá → không lưu, lần sau thử lại.
  if (!data.mw) {
    const mw = await merriamWebster.lookup(data.word);
    if (mw) {
      data.mw = mw;
      await repo.updateDailyWordData(date, data);
    }
  }
  return {
    ...data,
    mwFound: Boolean(data.mw?.found),
    mwUrl: merriamWebster.mwPageUrl(data.word),
    saved: await notebook.findByDedupeKey(wotdKey(data.word)),
  };
}

/** Nghĩa dùng khi lưu vào Notebook: từ điển dự án trước, không có thì nghĩa đầu tiên của MW. */
function meaningFor(w) {
  if (w.meaning) return w.meaning;
  const first = w.mw?.found ? w.mw.entries[0] : null;
  return first ? first.definitions.slice(0, 2).join('; ') : undefined;
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
