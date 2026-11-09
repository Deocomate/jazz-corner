// Gom dữ liệu cho trang Today và Progress từ các module khác (không có SQL riêng).
import * as books from '#modules/books/books.service.js';
import * as notebook from '#modules/notebook/notebook.service.js';
import * as attempts from '#modules/ielts/attempts.service.js';
import { getStructure } from '#modules/ielts/ielts.service.js';
import * as speaking from '#modules/speaking/speaking.service.js';
import { wordOfTheDay } from './word-of-the-day.js';

export async function todayData() {
  const [wotd, book, open, mistakes, dueCount] = await Promise.all([
    wordOfTheDay(),
    books.lastOpenedBook(),
    attempts.latestOpenAttempt(),
    notebook.recentMistakes(1),
    notebook.countDue(),
  ]);
  let openTotal = null;
  if (open) openTotal = (await getStructure(open.test_id)).questions.length;
  return { wotd, book, open: open && { ...open, total: openTotal }, mistake: mistakes[0] || null, dueCount };
}

export async function progressData() {
  const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  const [bookList, dueCount, reviewed, submittedCount, recent, mistakes, sessions, recordings, flagged] = await Promise.all([
    books.listBooks(),
    notebook.countDue(),
    notebook.reviewedSince(since),
    attempts.countSubmitted(),
    attempts.listSubmitted(50),
    notebook.recentMistakes(100),
    speaking.sessionStats(),
    speaking.recentRecordings(8),
    speaking.flaggedRecordings(),
  ]);

  // Dạng câu hay sai: gom từ ảnh chụp kết quả các lần nộp.
  const byType = new Map();
  for (const a of recent) {
    for (const r of a.results || []) {
      const t = byType.get(r.typeLabel) || { label: r.typeLabel, total: 0, wrong: 0 };
      t.total += 1;
      if (!r.isCorrect) t.wrong += 1;
      byType.set(r.typeLabel, t);
    }
  }
  const types = [...byType.values()]
    .map((t) => ({ ...t, rate: Math.round((t.wrong / t.total) * 100) }))
    .sort((a, b) => b.rate - a.rate);

  // Lý do sai lặp lại (người dùng tự ghi khi lưu câu sai).
  const reasons = new Map();
  for (const m of mistakes) {
    const key = (m.note || '').trim().toLowerCase();
    if (!key) continue;
    reasons.set(key, { text: m.note.trim(), count: (reasons.get(key)?.count || 0) + 1 });
  }

  return {
    reading: bookList.filter((b) => b.last_opened_at).slice(0, 6),
    dueCount,
    reviewed,
    submittedCount,
    recent: recent.slice(0, 6),
    types,
    hasTypeData: recent.length > 0,
    reasons: [...reasons.values()].sort((a, b) => b.count - a.count).slice(0, 8),
    mistakeCount: mistakes.length,
    sessions,
    recordings,
    flagged,
  };
}
