import { Router } from 'express';
import { numericId } from '#middleware/params.js';
import * as controller from './notebook.controller.js';

const router = Router();
router.param('id', numericId);

router.get('/', controller.index);
router.get('/new', controller.newForm);
router.post('/', controller.create);
router.post('/quick', controller.quickCapture);
router.get('/review', controller.reviewPage);
router.get('/:id', controller.show);
router.get('/:id/edit', controller.editForm);
router.post('/:id', controller.update);
router.post('/:id/delete', controller.destroy);
router.post('/:id/review', controller.review);
router.post('/:id/queue', controller.toggleQueue);

export default router;
