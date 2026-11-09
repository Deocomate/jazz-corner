// Nghiệp vụ Notebook: thêm/sửa/xoá mục, lưu lỗi IELTS, hàng ôn theo ngày.
import { notFound } from '#lib/errors.js';
import { validate } from '#lib/validate.js';
import { todayISO, addDays } from '#lib/dates.js';
import * as repo from './notebook.repo.js';
import { itemSchema, sourceSchema, reviewSchema, KIND_OPTIONS } from './notebook.schema.js';

const kindInfo = Object.fromEntries(KIND_OPTIONS.map((k) => [k.value, k]));
const parseJson = (s) => {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};

export const decorate = (item) =>
  item && {
    ...item,
    kindInfo: kindInfo[item.kind],
    tagList: item.tags ? item.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    ielts: parseJson(item.ielts_json),
    isDue: item.due_date && item.due_date <= todayISO(),
  };

/**
 * Lịch ôn đơn giản, dễ đoán: Đã nhớ -> 1, 3, 7, 15, 33… ngày (nhân ~2.2); Ôn lại -> gặp lại ngày mai.
 * Trả về { intervalDays, dueDate }.
 */
export function nextSchedule(intervalDays, result, today = todayISO()) {
  if (result === 'again') return { intervalDays: 0, dueDate: addDays(today, 1) };
  const next = intervalDays <= 0 ? 1 : intervalDays === 1 ? 3 : Math.min(180, Math.round(intervalDays * 2.2));
  return { intervalDays: next, dueDate: addDays(today, next) };
}

export async function listItems(filters, page) {
  const [items, total] = await Promise.all([repo.listItems(filters, { limit: page.perPage, offset: page.offset }), repo.countItems(filters)]);
  return { items: items.map(decorate), total };
}

export async function getItem(id) {
  const item = await repo.findItem(id);
  if (!item) throw notFound('Không tìm thấy mục trong Notebook.');
  return decorate(item);
}

export async function listTags() {
  const rows = await repo.allTags();
  return [...new Set(rows.flatMap((r) => r.tags.split(',').map((t) => t.trim())).filter(Boolean))].sort();
}

/** Thêm mục ngôn ngữ (form hoặc API). Mục mới vào hàng ôn ngay hôm nay. */
export async function createItem(input, { origin = 'mine', dedupeKey = null } = {}) {
  const fields = validate(itemSchema, input);
  const source = validate(sourceSchema, input);
  if (!fields.ok || !source.ok) return { ok: false, errors: { ...source.errors, ...fields.errors } };
  const id = await repo.createItem({ ...fields.data, ...source.data, origin, dedupe_key: dedupeKey, due_date: todayISO() });
  if (!id) return { ok: true, data: decorate(await repo.findByDedupeKey(dedupeKey)), duplicate: true };
  return { ok: true, data: await getItem(id) };
}

/** Lưu câu IELTS làm sai, kèm lý do do người dùng ghi. Một câu của một lần làm chỉ lưu một lần. */
export async function createMistake({ attemptId, testTitle, result, reason }) {
  const id = await repo.createItem({
    kind: 'ielts_mistake',
    content: `Q${result.number}: ${result.prompt}`.slice(0, 500),
    note: reason || null,
    excerpt: result.evidence || null,
    tags: 'IELTS Reading',
    source_type: 'ielts',
    source_label: `${testTitle} · Câu ${result.number}`,
    source_url: `/ielts/attempts/${attemptId}/result#q-${result.questionId}`,
    ielts: {
      testTitle,
      questionNumber: result.number,
      questionType: result.type,
      typeLabel: result.typeLabel,
      prompt: result.prompt,
      myAnswer: result.myAnswer,
      correctAnswer: result.correctDisplay,
      evidence: result.evidence,
      explanation: result.explanation,
    },
    attempt_id: attemptId,
    question_id: result.questionId,
    dedupe_key: `mistake:${attemptId}:${result.questionId}`,
    due_date: todayISO(),
  });
  return id ? getItem(id) : decorate(await repo.findByDedupeKey(`mistake:${attemptId}:${result.questionId}`));
}

export const findByDedupeKey = async (key) => decorate(await repo.findByDedupeKey(key));

export async function updateItem(id, input) {
  const item = await getItem(id);
  const result = validate(itemSchema, { ...input, kind: item.kind === 'ielts_mistake' ? 'ielts_mistake' : input.kind });
  if (!result.ok) return result;
  await repo.updateItem(id, result.data);
  return { ok: true, data: await getItem(id) };
}

export async function deleteItem(id) {
  await getItem(id);
  await repo.deleteItem(id);
}

// --- Ôn tập ---
export const dueItems = async (limit) => (await repo.listDue(todayISO(), limit)).map(decorate);
export const countDue = () => repo.countDue(todayISO());
export const recentMistakes = async (limit) => (await repo.recentMistakes(limit)).map(decorate);
export const reviewedSince = (since) => repo.reviewedSince(since);

export async function review(id, input) {
  const item = await getItem(id);
  const result = validate(reviewSchema, input);
  if (!result.ok) return result;
  const { intervalDays, dueDate } = nextSchedule(item.interval_days, result.data.result);
  await repo.saveReview(id, dueDate, intervalDays);
  return { ok: true, data: { id, dueDate, intervalDays } };
}
