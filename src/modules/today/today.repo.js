// SQL cho Word of the Day theo ngày.
import { all, get, run } from '#db';

export const findDailyWord = (date) => get('SELECT date, word, data_json FROM daily_words WHERE date = ?', [date]);

/** Ghi lựa chọn của ngày. Nếu đã có (hai yêu cầu cùng lúc) thì giữ bản ghi đầu tiên. */
export const saveDailyWord = (date, word, data) =>
  run('INSERT OR IGNORE INTO daily_words (date, word, data_json) VALUES (?, ?, ?)', [date, word, JSON.stringify(data)]);

/** Các từ đã dùng gần đây, để không lặp lại quá sớm. */
export const recentDailyWords = (sinceDate) => all('SELECT word FROM daily_words WHERE date >= ?', [sinceDate]);
