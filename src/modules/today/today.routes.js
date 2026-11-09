// Today (trang chủ), Progress và trang trạng thái tính năng.
import { Router } from 'express';
import * as service from './today.service.js';

const router = Router();

router.get('/', async (req, res) => {
  res.render('today/index', { title: 'Today', ...(await service.todayData()) });
});

router.post('/today/word/save', async (req, res) => {
  const result = await service.saveWordOfTheDay();
  req.flash('success', result.duplicate ? 'Từ này đã có trong Notebook.' : 'Đã lưu Word of the Day vào Notebook.');
  res.redirect('/');
});

router.get('/progress', async (req, res) => {
  res.render('today/progress', { title: 'Progress', ...(await service.progressData()) });
});

router.get('/status', (req, res) => res.render('today/status', { title: 'Trạng thái tính năng' }));

export default router;
