// Ngày giờ theo múi giờ của app (config.timezone), KHÔNG theo giờ máy chủ —
// server free thường chạy giờ UTC, lệch 7 tiếng so với Việt Nam.
import { config } from '#config';

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: config.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Ngày hôm nay dạng YYYY-MM-DD theo múi giờ app. */
export const todayISO = () => isoDateFormatter.format(new Date());

/** Thời điểm UTC của SQLite ("YYYY-MM-DD HH:MM:SS") -> ngày YYYY-MM-DD theo múi giờ app. */
export function localDateOf(sqliteUtc) {
  if (!sqliteUtc) return null;
  const date = new Date(`${String(sqliteUtc).replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? null : isoDateFormatter.format(date);
}

/** Cộng/trừ ngày cho chuỗi YYYY-MM-DD. */
export function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** YYYY-MM-DD -> DD/MM/YYYY (dùng trong thông báo, không phải trong view). */
export const formatDayVN = (isoDate) => (isoDate ? isoDate.split('-').reverse().join('/') : '');
