// API JSON: lưu mục từ trình đọc sách / IELTS / Word of the Day.
import { Router } from 'express';
import * as service from './notebook.service.js';

const router = Router();

router.post('/', async (req, res) => {
  const result = await service.createItem(req.body);
  if (!result.ok) return res.status(422).json({ error: Object.values(result.errors)[0], errors: result.errors });
  res.status(201).json({ id: result.data.id, url: `/notebook/${result.data.id}` });
});

router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const { items } = await service.listItems({ q, kind: 'language' }, { perPage: 20, offset: 0 });
  res.json(items.map((i) => ({ id: i.id, kind: i.kind, content: i.content, meaning: i.meaning, source: i.source_label })));
});

export default router;
