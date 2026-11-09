import { Router } from 'express';
import { numericId } from '#middleware/params.js';
import * as controller from './books.controller.js';

const router = Router();
router.param('id', numericId);

router.get('/', controller.index);
router.get('/:id', controller.reader);
router.get('/:id/file', controller.file);
router.get('/:id/cover', controller.cover);
router.get('/:id/epub-file', controller.epubResource);
router.post('/:id/delete', controller.destroy);

export default router;
