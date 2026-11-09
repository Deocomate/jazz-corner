import { Router } from 'express';
import { numericId } from '#middleware/params.js';
import * as editor from './editor.controller.js';
import * as attempts from './attempts.controller.js';

const router = Router();
for (const p of ['id', 'partId', 'groupId', 'questionId']) router.param(p, numericId);

router.get('/', editor.index);
router.get('/tests/new', editor.newTest);
router.post('/tests', editor.createTest);
router.get('/tests/import', editor.importForm);
router.post('/tests/import', editor.importTest);
router.get('/tests/:id/edit', editor.editor);
router.get('/tests/:id/settings', editor.editTestForm);
router.post('/tests/:id/settings', editor.updateTest);
router.get('/tests/:id/review', editor.review);
router.post('/tests/:id/publish', editor.publish);
router.post('/tests/:id/unpublish', editor.unpublish);
router.post('/tests/:id/delete', editor.destroy);
router.get('/tests/:id/source.pdf', editor.sourcePdf);

router.get('/tests/:id/passages/new', editor.passageForm);
router.post('/tests/:id/passages', editor.savePassage);
router.get('/tests/:id/passages/:partId/edit', editor.passageForm);
router.post('/tests/:id/passages/:partId', editor.savePassage);
router.get('/tests/:id/groups/new', editor.groupForm);
router.post('/tests/:id/groups', editor.saveGroup);
router.get('/tests/:id/groups/:partId/edit', editor.groupForm);
router.post('/tests/:id/groups/:partId', editor.saveGroup);
router.get('/tests/:id/groups/:groupId/questions/new', editor.questionForm);
router.post('/tests/:id/groups/:groupId/questions', editor.saveQuestion);
router.get('/tests/:id/groups/:groupId/questions/:partId/edit', editor.questionForm);
router.post('/tests/:id/groups/:groupId/questions/:partId', editor.saveQuestion);
router.post('/tests/:id/:kind/:partId/delete', editor.deletePart);

router.post('/tests/:id/start', attempts.start);
router.get('/attempts/:id', attempts.take);
router.post('/attempts/:id/submit', attempts.submit);
router.get('/attempts/:id/result', attempts.result);
router.post('/attempts/:id/mistakes/:questionId', attempts.saveMistake);

export default router;
