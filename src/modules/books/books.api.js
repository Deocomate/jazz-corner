// API JSON cho trình đọc: tải sách lên, lưu vị trí, bìa, cấu trúc EPUB, bookmark, highlight.
import { Router } from 'express';
import { numericId } from '#middleware/params.js';
import { rawUpload, uploadedFileName } from '#middleware/raw-upload.js';
import * as service from './books.service.js';

const router = Router();
router.param('id', numericId);
router.param('markId', numericId);

const reply = (res, result, status = 200) =>
  result.ok ? res.status(status).json(result.data ?? { ok: true }) : res.status(422).json({ error: Object.values(result.errors)[0], errors: result.errors });

router.post('/', rawUpload, async (req, res) => {
  const result = await service.uploadBook(req.body, uploadedFileName(req));
  if (!result.ok) return reply(res, result);
  res.status(201).json({ id: result.data.id, url: `/books/${result.data.id}` });
});

router.put('/:id/position', async (req, res) => reply(res, await service.savePosition(req.params.id, req.body)));
router.post('/:id/cover', rawUpload, async (req, res) => reply(res, await service.setCover(req.params.id, req.body)));
router.get('/:id/epub', async (req, res) => res.json(await service.epubStructure(req.params.id)));

router.get('/:id/marks', async (req, res) => res.json(await service.listMarks(req.params.id)));
router.post('/:id/bookmarks', async (req, res) => reply(res, await service.addBookmark(req.params.id, req.body), 201));
router.delete('/:id/bookmarks/:markId', async (req, res) => {
  await service.removeBookmark(req.params.id, req.params.markId);
  res.json({ ok: true });
});
router.post('/:id/highlights', async (req, res) => reply(res, await service.addHighlight(req.params.id, req.body), 201));
router.patch('/:id/highlights/:markId', async (req, res) =>
  reply(res, await service.updateHighlightNote(req.params.id, req.params.markId, req.body)),
);
router.delete('/:id/highlights/:markId', async (req, res) => {
  await service.removeHighlight(req.params.id, req.params.markId);
  res.json({ ok: true });
});

export default router;
