// Nghiệp vụ làm bài: bắt đầu, tự lưu, kiểm tra từng câu (chế độ Luyện), nộp bài, kết quả.
import { z } from 'zod';
import { AppError, notFound, badRequest } from '#lib/errors.js';
import { validate } from '#lib/validate.js';
import * as repo from './attempts.repo.js';
import { getStructure, getTest } from './ielts.service.js';
import { gradeAnswer, correctDisplay, estimateBand } from './scoring.js';
import { typeLabel } from './ielts.schema.js';
import * as notebook from '#modules/notebook/notebook.service.js';

const parseJson = (s, fallback) => {
  try {
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
};

const isExpired = (a) => a.mode === 'exam' && a.deadline_at && Date.now() > Date.parse(a.deadline_at);

const decorate = (a) => {
  if (!a) return a;
  const answers = parseJson(a.answers_json, {});
  return {
    ...a,
    answers,
    flags: parseJson(a.flags_json, []),
    results: parseJson(a.results_json, null),
    answeredCount: Object.values(answers).filter((v) => String(v ?? '').trim()).length,
    modeLabel: a.mode === 'exam' ? 'Làm đề' : 'Luyện',
    percent: a.total ? Math.round((a.score / a.total) * 100) : null,
    band: a.total ? estimateBand(a.score, a.total) : null,
  };
};

export async function getAttempt(id) {
  const attempt = await repo.findAttempt(id);
  if (!attempt) throw notFound('Không tìm thấy lượt làm bài.');
  return decorate(attempt);
}

/** Bắt đầu (hoặc tiếp tục lượt đang dở cùng chế độ). Chỉ đề đã duyệt mới làm được. */
export async function startAttempt(testId, mode) {
  const test = await getTest(testId);
  if (test.status !== 'published') return { ok: false, errors: { _form: 'Đề đang là bản nháp — hãy duyệt đề trước khi làm.' } };
  if (!['practice', 'exam'].includes(mode)) throw badRequest('Chế độ làm bài không hợp lệ.');
  const open = await repo.findOpenAttempt(testId, mode);
  if (open && !isExpired(open)) return { ok: true, data: { id: open.id, resumed: true } };
  if (open) await submit(open.id);
  const deadline = mode === 'exam' ? new Date(Date.now() + test.time_limit_minutes * 60000).toISOString() : null;
  return { ok: true, data: { id: await repo.createAttempt(testId, mode, deadline), resumed: false } };
}

const progressSchema = z.object({
  answers: z.record(z.string().regex(/^\d+$/), z.string().max(300)),
  flags: z.array(z.number().int().positive()).max(200).default([]),
});

export async function saveProgress(id, input) {
  const attempt = await getAttempt(id);
  if (attempt.status !== 'in_progress') throw new AppError(409, 'Bài đã nộp, không thể sửa câu trả lời.');
  if (isExpired(attempt)) throw new AppError(409, 'Đã hết giờ làm bài. Bài sẽ được nộp với các câu đã lưu.');
  const result = validate(progressSchema, input);
  if (!result.ok) return result;
  await repo.saveProgress(id, result.data.answers, result.data.flags);
  return { ok: true, data: { savedAt: new Date().toISOString() } };
}

/** Chế độ Luyện: kiểm tra một câu ngay. Chế độ Làm đề: chỉ sau khi nộp. */
export async function checkQuestion(id, questionId, answer) {
  const attempt = await getAttempt(id);
  if (attempt.mode === 'exam' && attempt.status !== 'submitted') throw new AppError(403, 'Chế độ Làm đề chỉ mở đáp án sau khi nộp bài.');
  const { questions } = await getStructure(attempt.test_id);
  const q = questions.find((x) => x.id === questionId);
  if (!q) throw notFound('Không tìm thấy câu hỏi.');
  const { isCorrect, note } = gradeAnswer(q, q.group, answer);
  return { isCorrect, note, correct: correctDisplay(q, q.group), explanation: q.explanation, evidence: q.evidence };
}

/** Nộp bài: chấm và lưu ảnh chụp kết quả. Gọi nhiều lần vẫn chỉ nộp một lần. */
export async function submit(id, finalAnswers) {
  const attempt = await getAttempt(id);
  if (attempt.status === 'submitted') return attempt;
  const answers = finalAnswers && !isExpired(attempt) ? { ...attempt.answers, ...finalAnswers } : attempt.answers;
  const { questions } = await getStructure(attempt.test_id);
  const results = questions.map((q) => {
    const myAnswer = String(answers[q.id] ?? '').trim();
    const { isCorrect, note } = gradeAnswer(q, q.group, myAnswer);
    const opts = q.group.type === 'mcq' ? q.options : q.group.options;
    const picked = opts?.find((o) => o.key.toLowerCase() === myAnswer.toLowerCase());
    return {
      questionId: q.id, number: q.number, type: q.group.type, typeLabel: typeLabel(q.group.type), prompt: q.prompt,
      passageId: q.group.passage_id, myAnswer, myDisplay: picked ? `${picked.key}. ${picked.text}` : myAnswer,
      correctDisplay: correctDisplay(q, q.group), isCorrect, note, evidence: q.evidence || '', explanation: q.explanation || '',
    };
  });
  const score = results.filter((r) => r.isCorrect).length;
  await repo.submitAttempt(id, answers, score, results.length, results);
  return getAttempt(id);
}

/** Bài thi hết giờ mà người dùng chưa bấm nộp -> tự nộp khi mở lại. */
export async function submitIfExpired(attempt) {
  if (attempt.status === 'in_progress' && isExpired(attempt)) return submit(attempt.id);
  return attempt;
}

export async function saveMistake(id, questionId, reason) {
  const attempt = await getAttempt(id);
  if (attempt.status !== 'submitted') throw new AppError(409, 'Chỉ lưu lỗi sau khi nộp bài.');
  const result = attempt.results.find((r) => r.questionId === questionId);
  if (!result) throw notFound('Không tìm thấy câu hỏi trong kết quả.');
  return notebook.createMistake({ attemptId: id, testTitle: attempt.test_title, result, reason: String(reason || '').trim().slice(0, 2000) });
}

/** Các câu đã lưu vào Notebook của lượt này (để hiện trạng thái "Đã lưu"). */
export async function savedMistakeIds(attempt) {
  const ids = new Set();
  for (const r of attempt.results || []) {
    if (await notebook.findByDedupeKey(`mistake:${attempt.id}:${r.questionId}`)) ids.add(r.questionId);
  }
  return ids;
}

export const latestOpenAttempt = async () => decorate(await repo.latestOpenAttempt());
export const listOpenAttempts = async () => (await repo.listOpenAttempts()).map(decorate);
export const listSubmitted = async (limit) => (await repo.listSubmitted(limit)).map(decorate);
export const countSubmitted = () => repo.countSubmitted();
