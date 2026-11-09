// Đọc cấu hình từ biến môi trường ở MỘT chỗ duy nhất.
// Code khác chỉ import `config`, không đọc process.env trực tiếp.

const env = process.env;
const DEV_SECRET = 'dev-only-secret-change-me';

const nodeEnv = env.NODE_ENV ?? 'development';

export const config = Object.freeze({
  env: nodeEnv,
  isProd: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  onRender: Boolean(env.RENDER), // Render tự đặt biến RENDER
  port: Number(env.PORT ?? 3000),
  appName: env.APP_NAME ?? 'Study Hub',
  timezone: env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh',
  locale: env.APP_LOCALE || 'vi-VN',
  sessionSecret: env.SESSION_SECRET ?? DEV_SECRET,
  db: Object.freeze({
    // Local: file SQLite. Production free: Turso (libsql://...), cùng API.
    url: env.DATABASE_URL || 'file:data/app.db',
    authToken: env.DATABASE_AUTH_TOKEN || undefined,
  }),
  // Thư mục lưu tệp người dùng tải lên (sách, PDF đề, bản ghi âm).
  uploadDir: env.UPLOAD_DIR || 'data/uploads',
  // Giới hạn dung lượng một tệp tải lên (MB).
  maxUploadMb: Number(env.MAX_UPLOAD_MB ?? 200),
  // [vibe:config]
});

if (config.isProd && config.sessionSecret === DEV_SECRET) {
  throw new Error('SESSION_SECRET chưa được đặt cho môi trường production.');
}
