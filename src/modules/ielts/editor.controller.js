// Kho đề + soạn/duyệt đề IELTS Reading.
import { notFound } from '#lib/errors.js';
import { filePath } from '#lib/storage.js';
import * as service from './ielts.service.js';
import { importTest as importTestData, parseImportJson } from './ielts.import.js';
import * as attempts from './attempts.service.js';
import { QUESTION_TYPES, TFNG_OPTIONS, MODES, optionsToLines } from './ielts.schema.js';
import { SAMPLE_TEST } from './sample-test.js';

export async function index(req, res) {
  const [tests, open, recent] = await Promise.all([service.listTests(), attempts.listOpenAttempts(), attempts.listSubmitted(5)]);
  res.render('ielts/index', {
    title: 'IELTS',
    published: tests.filter((t) => !t.isDraft),
    drafts: tests.filter((t) => t.isDraft),
    open,
    recent,
    modes: MODES,
  });
}

// --- Đề ---
const renderTestForm = (res, { test = null, values = {}, errors = {}, status = 200 }) =>
  res.status(status).render('ielts/test-form', { title: test ? 'Edit test details' : 'New test', test, values, errors });

export const newTest = (req, res) => renderTestForm(res, { values: { time_limit_minutes: 60 } });

export async function createTest(req, res) {
  const result = await service.createTest(req.body);
  if (!result.ok) return renderTestForm(res, { values: req.body, errors: result.errors, status: 422 });
  req.flash('success', 'Draft created. Add passages and questions below.');
  res.redirect(`/ielts/tests/${result.data.id}/edit`);
}

export async function editTestForm(req, res) {
  const test = await service.getTest(req.params.id);
  renderTestForm(res, { test, values: test });
}

export async function updateTest(req, res) {
  const test = await service.getTest(req.params.id);
  const result = await service.updateTest(test.id, req.body);
  if (!result.ok) return renderTestForm(res, { test, values: req.body, errors: result.errors, status: 422 });
  req.flash('success', 'Test details saved.');
  res.redirect(`/ielts/tests/${test.id}/edit`);
}

export async function editor(req, res) {
  const structure = await service.getStructure(req.params.id);
  res.render('ielts/editor', { title: `Edit: ${structure.test.title}`, ...structure, problems: service.findProblems(structure), scripts: ['/js/upload.js'] });
}

export async function review(req, res) {
  const structure = await service.getStructure(req.params.id);
  res.render('ielts/review', { title: `Review: ${structure.test.title}`, ...structure, problems: service.findProblems(structure), modes: MODES });
}

export async function publish(req, res) {
  const result = await service.publish(req.params.id);
  if (result.ok) req.flash('success', 'Published. You can start the test now.');
  else req.flash('error', result.errors._form);
  res.redirect(`/ielts/tests/${req.params.id}/review`);
}

export async function unpublish(req, res) {
  await service.unpublish(req.params.id);
  req.flash('success', 'The test is a draft again.');
  res.redirect(`/ielts/tests/${req.params.id}/edit`);
}

export async function destroy(req, res) {
  await service.deleteTest(req.params.id);
  req.flash('success', 'The test and its attempts were deleted.');
  res.redirect('/ielts');
}

export async function sourcePdf(req, res) {
  const test = await service.getTest(req.params.id);
  const full = filePath('ielts', test.source_pdf_name);
  if (!full) throw notFound('This test has no source PDF.');
  res.type('application/pdf').sendFile(full);
}

// --- Nhập đề JSON ---
export const importForm = (req, res) =>
  res.render('ielts/import', { title: 'Import a test', values: { json: '' }, errors: {}, example: JSON.stringify(SAMPLE_TEST, null, 2).slice(0, 1800) });

export async function importTest(req, res) {
  const parsed = parseImportJson(req.body.json);
  const result = parsed.ok ? await importTestData(parsed.data) : parsed;
  if (!result.ok) {
    return res.status(422).render('ielts/import', { title: 'Import a test', values: req.body, errors: result.errors, example: '' });
  }
  req.flash('success', 'Imported as a draft. Check the question order, answers and explanations before publishing.');
  res.redirect(`/ielts/tests/${result.data.id}/review`);
}

// --- Bài đọc / nhóm / câu hỏi ---
async function renderPart(res, view, testId, data, status = 200) {
  const structure = await service.getStructure(testId);
  res.status(status).render(`ielts/${view}`, {
    title: 'Test editor',
    test: structure.test,
    passages: structure.passages,
    typeOptions: QUESTION_TYPES,
    tfngOptions: TFNG_OPTIONS,
    errors: {},
    ...data,
  });
}

export async function passageForm(req, res) {
  const passage = req.params.partId ? await service.getPassage(req.params.id, req.params.partId) : null;
  await renderPart(res, 'passage-form', req.params.id, { passage, values: passage || { position: 1 } });
}

export async function savePassage(req, res) {
  const result = await service.savePassage(req.params.id, req.params.partId, req.body);
  if (!result.ok) return renderPart(res, 'passage-form', req.params.id, { passage: req.params.partId ? { id: req.params.partId } : null, values: req.body, errors: result.errors }, 422);
  req.flash('success', 'Passage saved.');
  res.redirect(`/ielts/tests/${req.params.id}/edit`);
}

export async function groupForm(req, res) {
  const group = req.params.partId ? await service.getGroup(req.params.id, req.params.partId) : null;
  const values = group ? { ...group, options_text: optionsToLines(group.options) } : { type: req.query.type || 'tfng', position: 1, passage_id: req.query.passage };
  await renderPart(res, 'group-form', req.params.id, { group, values });
}

export async function saveGroup(req, res) {
  const result = await service.saveGroup(req.params.id, req.params.partId, req.body);
  if (!result.ok) return renderPart(res, 'group-form', req.params.id, { group: req.params.partId ? { id: req.params.partId } : null, values: req.body, errors: result.errors }, 422);
  req.flash('success', 'Question group saved.');
  res.redirect(`/ielts/tests/${req.params.id}/edit#group-${result.data.id}`);
}

export async function questionForm(req, res) {
  const group = await service.getGroup(req.params.id, req.params.groupId);
  const question = req.params.partId ? await service.getQuestion(req.params.id, req.params.partId) : null;
  const structure = await service.getStructure(req.params.id);
  const nextNumber = (structure.questions.at(-1)?.number || 0) + 1;
  const values = question
    ? { ...question, options_text: optionsToLines(question.options), accepted_text: question.accepted.join('\n') }
    : { number: nextNumber, options_text: group.type === 'mcq' ? 'A. \nB. \nC. \nD. ' : '' };
  await renderPart(res, 'question-form', req.params.id, { group, question, values });
}

export async function saveQuestion(req, res) {
  const { id, groupId, partId } = req.params;
  const result = await service.saveQuestion(id, groupId, partId, req.body);
  if (!result.ok) {
    const group = await service.getGroup(id, groupId);
    return renderPart(res, 'question-form', id, { group, question: partId ? { id: partId } : null, values: req.body, errors: result.errors }, 422);
  }
  req.flash('success', 'Question saved.');
  res.redirect(req.body.next === 'add' ? `/ielts/tests/${id}/groups/${groupId}/questions/new` : `/ielts/tests/${id}/edit#group-${groupId}`);
}

export async function deletePart(req, res) {
  const { id, kind, partId } = req.params;
  if (kind === 'passages') await service.deletePassage(id, partId);
  else if (kind === 'groups') await service.deleteGroup(id, partId);
  else if (kind === 'questions') await service.deleteQuestion(id, partId);
  else throw notFound();
  req.flash('success', 'Deleted.');
  res.redirect(`/ielts/tests/${id}/edit`);
}
