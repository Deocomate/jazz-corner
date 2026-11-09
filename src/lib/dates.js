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

/**
 * Khoảng thời gian UTC (dạng SQLite "YYYY-MM-DD HH:MM:SS") ứng với một ngày theo múi giờ app.
 * Dùng để lấy các mục được ghi trong một ngày (một trang sổ tay).
 */
export function utcRangeOfLocalDate(isoDate) {
  const noonUtc = new Date(`${isoDate}T12:00:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: config.timezone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(noonUtc)
      .map((p) => [p.type, p.value]),
  );
  const localNoonAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  const offsetMs = localNoonAsUtc - noonUtc.getTime();
  const start = new Date(Date.parse(`${isoDate}T00:00:00Z`) - offsetMs);
  const end = new Date(start.getTime() + 86400000);
  const sql = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
  return [sql(start), sql(end)];
}

/** Cộng/trừ ngày cho chuỗi YYYY-MM-DD. */
export function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** YYYY-MM-DD -> DD/MM/YYYY (dùng trong thông báo, không phải trong view). */
export const formatDayVN = (isoDate) => (isoDate ? isoDate.split('-').reverse().join('/') : '');
