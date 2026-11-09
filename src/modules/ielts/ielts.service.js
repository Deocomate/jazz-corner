// Nghiệp vụ soạn và duyệt đề IELTS Reading.
import { notFound } from '#lib/errors.js';
import { validate } from '#lib/validate.js';
import { saveFile, removeFile } from '#lib/storage.js';
import * as repo from './ielts.repo.js';
import { testSchema, passageSchema, groupSchema, questionSchema, parseOptionLines, typeLabel } from './ielts.schema.js';
import { normalizeAnswer, countWords } from './scoring.js';

const parseJson = (s, fallback = null) => {
  try {
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
};
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const toParagraphs = (body) =>
  String(body || '')
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((text, i) => ({ label: LETTERS[i] || String(i + 1), text }));

export async function listTests() {
  return (await repo.listTests()).map((t) => ({ ...t, isDraft: t.status === 'draft' }));
}

export async function getTest(id) {
  const test = await repo.findTest(id);
  if (!test) throw notFound('Không tìm thấy đề.');
  return { ...test, isDraft: test.status === 'draft' };
}

/** Toàn bộ đề: bài đọc (chia đoạn A, B, C…), nhóm câu hỏi kèm câu hỏi. */
export async function getStructure(id) {
  const test = await getTest(id);
  const [passages, groups, questions] = await Promise.all([repo.listPassages(id), repo.listGroups(id), repo.listQuestions(id)]);
  const decoratedGroups = groups.map((g) => ({
    ...g,
    typeLabel: typeLabel(g.type),
    options: parseJson(g.options_json, []),
    questions: questions
      .filter((q) => q.group_id === g.id)
      .map((q) => ({ ...q, options: parseJson(q.options_json, []), accepted: parseJson(q.accepted_json, []) })),
  }));
  const passageList = passages.map((p) => ({
    ...p,
    paragraphs: toParagraphs(p.body),
    groups: decoratedGroups.filter((g) => g.passage_id === p.id),
  }));
  const allQuestions = decoratedGroups.flatMap((g) => g.questions.map((q) => ({ ...q, group: g })));
  allQuestions.sort((a, b) => a.number - b.number);
  return { test, passages: passageList, groups: decoratedGroups, questions: allQuestions, unassignedGroups: decoratedGroups.filter((g) => !g.passage_id) };
}

/** Kiểm tra đề trước khi duyệt. Trả về danh sách vấn đề (rỗng = sẵn sàng). */
export function findProblems(structure) {
  const problems = [];
  if (!structure.passages.length) problems.push('Chưa có bài đọc nào.');
  if (!structure.questions.length) problems.push('Chưa có câu hỏi nào.');
  for (const g of structure.groups) if (!g.questions.length) problems.push(`Nhóm "${g.typeLabel}" chưa có câu hỏi.`);
  const seen = new Set();
  for (const q of structure.questions) {
    if (seen.has(q.number)) problems.push(`Số câu ${q.number} bị trùng.`);
    seen.add(q.number);
    const keys = (q.group.type === 'mcq' ? q.options : q.group.options).map((o) => normalizeAnswer(o.key));
    if ((q.group.type === 'mcq' || q.group.type === 'headings') && !keys.includes(normalizeAnswer(q.answer))) {
      problems.push(`Câu ${q.number}: đáp án "${q.answer}" không nằm trong danh sách lựa chọn.`);
    }
    if (q.group.type === 'mcq' && q.options.length < 2) problems.push(`Câu ${q.number}: cần ít nhất 2 lựa chọn.`);
    if (q.group.type === 'completion' && q.group.word_limit && countWords(q.answer) > q.group.word_limit) {
      problems.push(`Câu ${q.number}: đáp án dài hơn giới hạn ${q.group.word_limit} từ.`);
    }
  }
  const ordered = structure.questions.map((q) => q.number);
  if (ordered.length && ordered.some((n, i) => n !== ordered[0] + i)) problems.push('Số thứ tự câu hỏi bị nhảy cóc — kiểm tra lại thứ tự.');
  return problems;
}

// --- Đề ---
export async function createTest(input) {
  const result = validate(testSchema, input);
  if (!result.ok) return result;
  return { ok: true, data: { id: await repo.createTest(result.data) } };
}

export async function updateTest(id, input) {
  await getTest(id);
  const result = validate(testSchema, input);
  if (!result.ok) return result;
  await repo.updateTest(id, result.data);
  return { ok: true, data: { id } };
}

export async function publish(id) {
  const problems = findProblems(await getStructure(id));
  if (problems.length) return { ok: false, errors: { _form: `Chưa duyệt được: ${problems.join(' ')}` } };
  await repo.setStatus(id, 'published');
  return { ok: true, data: { id } };
}

export async function unpublish(id) {
  await getTest(id);
  await repo.setStatus(id, 'draft');
}

export async function deleteTest(id) {
  const test = await getTest(id);
  await repo.deleteTest(id);
  if (test.source_pdf_name) await removeFile('ielts', test.source_pdf_name);
}

export async function attachSourcePdf(id, buffer, originalName) {
  const test = await getTest(id);
  if (!buffer?.length || buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return { ok: false, errors: { _form: 'Tài liệu nguồn phải là tệp PDF.' } };
  }
  const stored = await saveFile('ielts', buffer, 'pdf');
  await repo.setSourcePdf(id, stored, originalName || 'source.pdf');
  if (test.source_pdf_name) await removeFile('ielts', test.source_pdf_name);
  return { ok: true, data: { id } };
}

// --- Bài đọc ---
export async function savePassage(testId, passageId, input) {
  await getTest(testId);
  const result = validate(passageSchema, input);
  if (!result.ok) return result;
  if (passageId) {
    if (!(await repo.findPassage(testId, passageId))) throw notFound();
    await repo.updatePassage(testId, passageId, result.data);
  } else await repo.createPassage(testId, result.data);
  await repo.touchTest(testId);
  return { ok: true, data: null };
}

export async function getPassage(testId, id) {
  const p = await repo.findPassage(testId, id);
  if (!p) throw notFound();
  return p;
}
export const deletePassage = (testId, id) => repo.deletePassage(testId, id);

// --- Nhóm câu hỏi ---
export async function getGroup(testId, id) {
  const g = await repo.findGroup(testId, id);
  if (!g) throw notFound();
  return { ...g, typeLabel: typeLabel(g.type), options: parseJson(g.options_json, []) };
}

export async function saveGroup(testId, groupId, input) {
  await getTest(testId);
  const result = validate(groupSchema, input);
  if (!result.ok) return result;
  const d = result.data;
  if (d.passage_id && !(await repo.findPassage(testId, d.passage_id))) return { ok: false, errors: { passage_id: 'Bài đọc không hợp lệ' } };
  const data = { ...d, options: d.type === 'headings' ? parseOptionLines(d.options_text) : null, word_limit: d.type === 'completion' ? d.word_limit : null };
  if (groupId) {
    await getGroup(testId, groupId);
    await repo.updateGroup(testId, groupId, data);
  } else groupId = await repo.createGroup(testId, data);
  await repo.touchTest(testId);
  return { ok: true, data: { id: groupId } };
}
export const deleteGroup = (testId, id) => repo.deleteGroup(testId, id);

// --- Câu hỏi ---
export async function getQuestion(testId, id) {
  const q = await repo.findQuestion(testId, id);
  if (!q) throw notFound();
  return { ...q, options: parseJson(q.options_json, []), accepted: parseJson(q.accepted_json, []) };
}

export async function saveQuestion(testId, groupId, questionId, input) {
  const group = await getGroup(testId, groupId);
  const result = validate(questionSchema, input);
  if (!result.ok) return result;
  const d = result.data;
  const errors = {};
  let options = null;
  let answer = d.answer;
  if (group.type === 'mcq') {
    options = parseOptionLines(d.options_text, { upper: true });
    if (options.length < 2 || options.some((o) => !o.key)) errors.options_text = 'Nhập ít nhất 2 lựa chọn, mỗi dòng dạng "A. ..."';
    answer = answer.toUpperCase();
    if (!errors.options_text && !options.some((o) => o.key === answer)) errors.answer = 'Đáp án phải là một ký hiệu lựa chọn (VD: B)';
  } else if (group.type === 'tfng') {
    answer = answer.toUpperCase();
    if (!['TRUE', 'FALSE', 'NOT GIVEN'].includes(answer)) errors.answer = 'Đáp án phải là TRUE, FALSE hoặc NOT GIVEN';
  } else if (group.type === 'headings') {
    answer = answer.toLowerCase();
    if (!group.options.some((o) => o.key === answer)) errors.answer = `Đáp án phải là một ký hiệu tiêu đề của nhóm (${group.options.map((o) => o.key).join(', ')})`;
  } else if (group.word_limit && countWords(answer) > group.word_limit) {
    errors.answer = `Đáp án dài hơn giới hạn ${group.word_limit} từ của nhóm`;
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  const accepted = group.type === 'completion' ? String(d.accepted_text || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
  const data = { ...d, answer, options, accepted };
  if (questionId) {
    await getQuestion(testId, questionId);
    await repo.updateQuestion(testId, questionId, data);
  } else await repo.createQuestion(testId, groupId, data);
  await repo.touchTest(testId);
  return { ok: true, data: null };
}
export const deleteQuestion = (testId, id) => repo.deleteQuestion(testId, id);
