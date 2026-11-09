// Nạp dữ liệu mẫu: đề Reading mẫu, bài luyện nói mẫu, và 2 sách mẫu (PDF có lớp văn bản + EPUB).
// Chạy nhiều lần không tạo trùng. Mọi dữ liệu mẫu đều có nhãn "Dữ liệu mẫu".
//   npm run seed
import { runMigrations } from '../src/db/migrate.js';
import { ensureSamples } from '../src/samples.js';
import { uploadBook, listBooks } from '../src/modules/books/books.service.js';
import { buildSamplePdf, buildSampleEpub, ESSAY_TITLE, STORY_TITLE } from './sample-files.mjs';

await runMigrations();
await ensureSamples();

const existing = new Set((await listBooks()).filter((b) => b.origin === 'sample').map((b) => b.original_name));
const books = [
  { name: 'sample-slow-reading.pdf', title: ESSAY_TITLE, build: buildSamplePdf },
  { name: 'sample-lighthouse.epub', title: STORY_TITLE, build: buildSampleEpub },
];
for (const b of books) {
  if (existing.has(b.name)) continue;
  const result = await uploadBook(b.build(), b.name, { origin: 'sample', title: b.title });
  console.info(result.ok ? `[seed] đã thêm sách mẫu: ${result.data.title}` : `[seed] lỗi: ${result.errors._form}`);
}
console.info('[seed] xong — dữ liệu mẫu đã sẵn sàng.');
process.exit(0);
