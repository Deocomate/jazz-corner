// API JSON khi làm bài: tự lưu câu trả lời, kiểm tra câu (chế độ Luyện), gắn PDF nguồn.
import { Router } from 'express';
import { numericId } from '#middleware/params.js';
import { rawUpload, uploadedFileName } from '#middleware/raw-upload.js';
import * as attempts from './attempts.service.js';
import * as service from './ielts.service.js';

const router = Router();
router.param('id', numericId);
router.param('questionId', numericId);

router.put('/attempts/:id', async (req, res) => {
  const result = await attempts.saveProgress(req.params.id, req.body);
  if (!result.ok) return res.status(422).json({ error: Object.values(result.errors)[0] });
  res.json(result.data);
});

router.post('/attempts/:id/check/:questionId', async (req, res) => {
  res.json(await attempts.checkQuestion(req.params.id, req.params.questionId, String(req.body.answer ?? '')));
});

router.post('/tests/:id/source', rawUpload, async (req, res) => {
  const result = await service.attachSourcePdf(req.params.id, req.body, uploadedFileName(req));
  if (!result.ok) return res.status(422).json({ error: result.errors._form });
  res.status(201).json({ url: `/ielts/tests/${req.params.id}/edit` });
});

export default router;
