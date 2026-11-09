// Điểm khởi động: chạy migration rồi mở cổng.
import { config } from '#config';
import { usingEphemeralDb } from '#db';
import { runMigrations } from './db/migrate.js';
import { createApp } from './app.js';
import { ensureSamples } from './samples.js';
// [vibe:server-imports]

async function main() {
  await runMigrations();
  // Dữ liệu mẫu tối thiểu (đề Reading mẫu, bài luyện nói mẫu) — không tạo trùng.
  await ensureSamples();
  // [vibe:server-startup]

  if (usingEphemeralDb()) {
    console.warn(
      '[warning] Using a SQLite file on a free host: data will be LOST when the server sleeps or restarts. ' +
        'Set DATABASE_URL + DATABASE_AUTH_TOKEN (Turso) for durable storage.',
    );
  }

  const server = createApp().listen(config.port, () => {
    console.info(`[server] ${config.appName} running at http://localhost:${config.port} (${config.env})`);
  });

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
