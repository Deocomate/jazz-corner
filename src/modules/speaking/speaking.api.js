// API JSON cho trang luyện nói: tải bản ghi âm lên, lưu chỉnh sửa trọng âm.
import { Router } from 'express';
import { numericId } from '#middleware/params.js';
import { rawUpload } from '#middleware/raw-upload.js';
import * as service from './speaking.service.js';

const router = Router();
router.param('id', numericId);

router.post('/items/:id/recordings', rawUpload, async (req, res) => {
  let target = '';
  try {
    target = decodeURIComponent(req.get('x-target') || '');
  } catch {
    target = '';
  }
  const result = await service.saveRecording(req.params.id, req.body, {
    mime: req.get('content-type'),
    mode: req.get('x-mode'),
    durationMs: Number(req.get('x-duration')),
    target,
  });
  if (!result.ok) return res.status(422).json({ error: result.errors._form });
  res.status(201).json({ id: result.data.id, url: `/speaking/recordings/${result.data.id}/audio` });
});

router.put('/items/:id/markup', async (req, res) => {
  const result = await service.saveMarkup(req.params.id, req.body);
  if (!result.ok) return res.status(422).json({ error: 'Dữ liệu chỉnh sửa không hợp lệ.' });
  res.json({ ok: true });
});

export default router;
