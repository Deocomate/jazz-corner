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
  appName: env.APP_NAME ?? 'Jazz Corner',
  timezone: env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh',
  locale: env.APP_LOCALE || 'en-GB',
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
  // Merriam-Webster Collegiate Dictionary API (khoá miễn phí tại dictionaryapi.com).
  // Không có khoá → Word of the Day chỉ hiện link sang merriam-webster.com.
  merriamWebster: Object.freeze({
    apiKey: env.MW_API_KEY || '',
    baseUrl: env.MW_API_URL || 'https://www.dictionaryapi.com/api/v3/references/collegiate/json',
  }),
  // Nghĩa tiếng Việt: Wiktionary tiếng Việt (không cần khoá), không có thì dịch máy (DeepL nếu có khoá, không thì MyMemory).
  // Khi chạy test thì tắt (không gọi mạng thật) trừ khi đặt VI_DICTIONARY=on.
  vietnamese: Object.freeze({
    enabled: env.VI_DICTIONARY ? env.VI_DICTIONARY !== 'off' : nodeEnv !== 'test',
    wiktionaryUrl: env.VI_WIKTIONARY_URL || 'https://vi.wiktionary.org/w/api.php',
    translateUrl: env.VI_TRANSLATE_URL || 'https://api.mymemory.translated.net/get',
    // DeepL (dịch mượt hơn MyMemory). Khoá miễn phí: https://www.deepl.com/pro-api → DeepL API Free.
    deeplKey: env.DEEPL_API_KEY || '',
    deeplUrl: env.DEEPL_API_URL || '', // để trống: tự chọn api-free / api theo khoá
  }),
  // [vibe:config]
});

if (config.isProd && config.sessionSecret === DEV_SECRET) {
  throw new Error('SESSION_SECRET must be set in production.');
}
