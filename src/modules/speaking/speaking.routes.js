import { Router } from 'express';
import { numericId } from '#middleware/params.js';
import * as controller from './speaking.controller.js';

const router = Router();
router.param('id', numericId);

router.get('/', controller.index);
router.get('/new', controller.newForm);
router.post('/items', controller.create);
router.post('/from-notebook/:id', controller.fromNotebook);
router.get('/minimal-pairs', controller.minimalPairs);
router.get('/items/:id', controller.practice);
router.post('/items/:id/notes', controller.saveNotes);
router.post('/items/:id/notebook', controller.saveToNotebook);
router.post('/items/:id/delete', controller.destroy);
router.get('/recordings/:id/audio', controller.audio);
router.post('/recordings/:id', controller.updateRecording);
router.post('/recordings/:id/delete', controller.deleteRecording);

export default router;
