// Today (trang chủ), Progress và trang trạng thái tính năng.
import { Router } from 'express';
import * as service from './today.service.js';
import { saveWordOfTheDay } from './word-of-the-day.js';

const router = Router();

router.get('/', async (req, res) => {
  res.render('today/index', { title: 'Today', ...(await service.todayData()) });
});

router.post('/today/word/save', async (req, res) => {
  const result = await saveWordOfTheDay();
  req.flash('success', result.duplicate ? 'This word is already in your Notebook.' : 'Word of the Day saved to your Notebook.');
  res.redirect('/');
});

router.get('/progress', async (req, res) => {
  res.render('today/progress', { title: 'Progress', ...(await service.progressData()) });
});

router.get('/status', (req, res) => res.render('today/status', { title: 'Feature status' }));

export default router;
