// Làm bài và xem kết quả IELTS Reading.
import * as attempts from './attempts.service.js';
import { getStructure } from './ielts.service.js';
import { TFNG_OPTIONS } from './ielts.schema.js';

export async function start(req, res) {
  const result = await attempts.startAttempt(req.params.id, req.body.mode);
  if (!result.ok) {
    req.flash('error', result.errors._form);
    return res.redirect(`/ielts/tests/${req.params.id}/review`);
  }
  if (result.data.resumed) req.flash('info', 'Bạn đang có lượt làm dở ở chế độ này — tiếp tục từ chỗ đã lưu.');
  res.redirect(`/ielts/attempts/${result.data.id}`);
}

export async function take(req, res) {
  let attempt = await attempts.getAttempt(req.params.id);
  attempt = await attempts.submitIfExpired(attempt);
  if (attempt.status === 'submitted') return res.redirect(`/ielts/attempts/${attempt.id}/result`);

  const structure = await getStructure(attempt.test_id);
  const flagged = new Set(attempt.flags);
  const decorateQ = (q) => ({ ...q, value: attempt.answers[q.id] ?? '', flagged: flagged.has(q.id) });
  const passages = structure.passages.map((p) => ({
    ...p,
    groups: p.groups.map((g) => ({ ...g, questions: g.questions.map(decorateQ) })),
  }));
  res.render('ielts/take', {
    title: attempt.test_title,
    attempt,
    test: structure.test,
    passages,
    questions: structure.questions.map(decorateQ),
    tfngOptions: TFNG_OPTIONS,
    fullBleed: true,
    config: {
      id: attempt.id,
      mode: attempt.mode,
      deadline: attempt.deadline_at,
      serverNow: new Date().toISOString(),
      title: attempt.test_title,
    },
    scripts: ['/js/ielts-take.js'],
  });
}

export async function submit(req, res) {
  let answers;
  try {
    answers = req.body.answers_json ? JSON.parse(req.body.answers_json) : undefined;
  } catch {
    answers = undefined;
  }
  await attempts.submit(req.params.id, answers);
  req.flash('success', 'Đã nộp bài.');
  res.redirect(`/ielts/attempts/${req.params.id}/result`);
}

export async function result(req, res) {
  let attempt = await attempts.getAttempt(req.params.id);
  attempt = await attempts.submitIfExpired(attempt);
  if (attempt.status !== 'submitted') return res.redirect(`/ielts/attempts/${attempt.id}`);
  const [structure, saved] = await Promise.all([getStructure(attempt.test_id), attempts.savedMistakeIds(attempt)]);
  const results = attempt.results.map((r) => ({ ...r, saved: saved.has(r.questionId) }));
  res.render('ielts/result', {
    title: `Kết quả: ${attempt.test_title}`,
    attempt,
    results,
    wrong: results.filter((r) => !r.isCorrect).length,
    passages: structure.passages,
    config: { id: attempt.id, title: attempt.test_title, testId: attempt.test_id },
    scripts: ['/js/ielts-review.js'],
  });
}

export async function saveMistake(req, res) {
  await attempts.saveMistake(req.params.id, req.params.questionId, req.body.reason);
  req.flash('success', 'Đã lưu câu sai vào Notebook.');
  res.redirect(`/ielts/attempts/${req.params.id}/result#q-${req.params.questionId}`);
}
